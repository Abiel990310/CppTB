---
title: "Futures, promises, and tasks"
navTitle: "Futures and tasks"
summary: >-
  Getting results back from concurrent work.
objectives:
  - Use std::async and futures appropriately
  - Explain why std::async's default launch policy is a trap
  - Structure work as tasks rather than threads
status: complete
standard: c++20
requires: [atomics]
---

A `std::thread` runs a function that returns `void` and may not throw. If you
want a value back you write it into a captured variable, and if you want to know
whether it failed you invent a channel for that too — and both need the
synchronisation of the last two chapters to be correct.

A **future** is that channel, done properly: a handle to a result that does not
exist yet, carrying either the value or the exception.

```cpp run title="Two results, computed at once"
#include <chrono>
#include <cstdio>
#include <future>
#include <thread>

int slow_double(int n) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return n * 2;
}

int main() {
    auto start = std::chrono::steady_clock::now();

    std::future<int> a = std::async(std::launch::async, slow_double, 10);
    std::future<int> b = std::async(std::launch::async, slow_double, 21);

    int sum = a.get() + b.get();                 // blocks until both are ready

    double elapsed = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();
    std::printf("sum %d in %.0f ms (two 100 ms tasks)\n", sum, elapsed);
}
```

About 100 ms, not 200: the two tasks really do overlap. `get()` blocks until the
value is ready, returns it, and — importantly — may only be called once, because
it *moves* the result out.

## Exceptions come back too

This is the part that makes futures worth using even for a single task.

```cpp run title="An exception crossing a thread boundary"
#include <cstdio>
#include <future>
#include <stdexcept>
#include <thread>

int parse_or_throw(const char* text) {
    if (text[0] == '\0') throw std::invalid_argument("empty input");
    return text[0] - '0';
}

int main() {
    std::future<int> good = std::async(std::launch::async, parse_or_throw, "7");
    std::future<int> bad  = std::async(std::launch::async, parse_or_throw, "");

    std::printf("good: %d\n", good.get());

    try {
        std::printf("bad: %d\n", bad.get());
    } catch (const std::invalid_argument& e) {
        std::printf("caught from the other thread: %s\n", e.what());
    }
}
```

An exception escaping a plain `std::thread`'s function calls `std::terminate`
and kills the process — there is nowhere for it to go. `std::async` catches it,
stores it, and rethrows it out of `get()` on the calling thread. Error handling
composes again.

## Three traps in `std::async`

They are all worth knowing before you use it, and one of them silently removes
all the concurrency.

### The returned future's destructor blocks

```cpp run title="The same two tasks, run one after the other"
#include <chrono>
#include <cstdio>
#include <future>
#include <thread>

int slow_double(int n) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return n * 2;
}

int main() {
    {
        auto start = std::chrono::steady_clock::now();
        std::future<int> a = std::async(std::launch::async, slow_double, 10);
        std::future<int> b = std::async(std::launch::async, slow_double, 21);
        int sum = a.get() + b.get();
        double elapsed = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        std::printf("futures kept:      sum %d in %5.0f ms\n", sum, elapsed);
    }
    {
        auto start = std::chrono::steady_clock::now();
        std::async(std::launch::async, slow_double, 10);      // future discarded
        std::async(std::launch::async, slow_double, 21);      // future discarded
        double elapsed = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        std::printf("futures discarded:           %5.0f ms\n", elapsed);
    }
}
```

102 ms against 202 ms. The discarded version is *sequential*, because the
temporary `std::future` returned by `std::async` is destroyed at the end of its
own statement — and that destructor **waits for the task to finish**.

This is unique to futures from `std::async`; a future from a `std::promise`
does not block on destruction. It exists so that a task cannot outlive the data
it captured, and it means `std::async(...)` used as a fire-and-forget statement
is a synchronous function call with extra steps.

GCC and Clang mark `std::async` `[[nodiscard]]`, so this sample compiles with a
warning telling you exactly that:

```
warning: ignoring return value of 'std::async(...)', declared with attribute
'nodiscard' [-Wunused-result]
```

**Always keep the future.**

### The default launch policy is not "run it in parallel"

`std::async(f)` with no policy means `std::launch::async | std::launch::deferred`
— the implementation picks. `deferred` means the function does not run at all
until `get()` is called, and then it runs **on the calling thread**.

```cpp run title="Deferred means 'later, here, maybe never'"
#include <chrono>
#include <cstdio>
#include <future>
#include <thread>

int main() {
    auto start = std::chrono::steady_clock::now();
    auto elapsed = [start] {
        return std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
    };

    std::future<int> lazy = std::async(std::launch::deferred, [] {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        return 5;
    });

    double after_creating = elapsed();
    int value = lazy.get();                 // the work happens here
    double after_get = elapsed();

    std::printf("created in %.0f ms; got %d at %.0f ms\n", after_creating, value, after_get);

    auto main_thread = std::this_thread::get_id();
    std::future<bool> where = std::async([main_thread] {
        return std::this_thread::get_id() != main_thread;
    });
    std::printf("default policy ran on another thread: %s\n", where.get() ? "yes" : "no");
}
```

The deferred task costs nothing to create and 100 ms to `get`. On this
implementation the *default* policy happens to launch a thread — but that is a
choice libstdc++ makes, not a guarantee, and other implementations have chosen
differently.

The consequences of getting `deferred` when you wanted `async` are worse than
"it is slower". A deferred task whose future is never `get`-ed **never runs at
all**, and a loop that creates a hundred deferred tasks and then gets them all
runs them one after another on one thread.

**Always pass `std::launch::async` explicitly** when you want concurrency.

### It is not a thread pool

```cpp run title="Sixty-four tasks, sixty-four threads"
#include <chrono>
#include <cstdio>
#include <future>
#include <thread>
#include <vector>

int main() {
    auto start = std::chrono::steady_clock::now();

    std::vector<std::future<int>> tasks;
    for (int i = 0; i < 64; ++i)
        tasks.push_back(std::async(std::launch::async, [] {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            return 1;
        }));

    int completed = 0;
    for (std::future<int>& task : tasks) completed += task.get();

    double elapsed = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();
    std::printf("%d tasks of 100 ms each finished in %.0f ms on %u cores\n",
                completed, elapsed, std::thread::hardware_concurrency());
}
```

Around 120 ms on a four-core machine. Sixty-four tasks of 100 ms each ran in
essentially the time of one, which means sixty-four operating-system threads
were created — not a pool of four.

For sleeping tasks that is what you want. For sixty-four tasks that each want a
core, it is a disaster: they compete, each gets a fraction of a core, and you
have paid for sixty-four stacks and a great deal of scheduling. `std::async`
gives you no way to bound this.

## `std::promise`: a future not tied to a function

`std::async` couples "run this" with "here is where the answer goes".
`std::promise` separates them, for the cases where the value is produced
somewhere other than at the end of a function.

```cpp run title="Setting a value from wherever it becomes known"
#include <cstdio>
#include <future>
#include <string>
#include <thread>
#include <vector>

int main() {
    std::promise<std::string> promise;
    std::shared_future<std::string> result = promise.get_future().share();

    std::vector<std::string> seen(3);
    {
        std::vector<std::jthread> readers;
        for (int i = 0; i < 3; ++i)
            readers.emplace_back([result, &seen, i] { seen[static_cast<std::size_t>(i)] = result.get(); });

        std::this_thread::sleep_for(std::chrono::milliseconds(20));
        promise.set_value("the configuration loaded");   // all three wake
    }

    std::printf("[%s] [%s] [%s]\n", seen[0].c_str(), seen[1].c_str(), seen[2].c_str());
}
```

`set_value` fulfils the promise and releases every waiter. `set_exception` does
the same with a failure, which arrives at each `get()` as a throw.

`std::shared_future` is the multi-reader version: a plain `std::future::get`
moves the value out and may be called once, while `shared_future::get` returns a
`const&` and may be called by any number of threads.

## `std::packaged_task`, and the pool the standard does not give you

A `std::packaged_task` wraps a callable so that calling it delivers the result
to a future. That is exactly the piece needed to put work on a queue and get an
answer back.

```cpp run title="A thread pool in forty lines"
#include <condition_variable>
#include <cstdio>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <thread>
#include <vector>

class Pool {
public:
    explicit Pool(int worker_count) {
        for (int i = 0; i < worker_count; ++i)
            workers_.emplace_back([this](std::stop_token stop) {
                while (true) {
                    std::function<void()> job;
                    {
                        std::unique_lock lock(mutex_);
                        if (!ready_.wait(lock, stop, [this] { return !jobs_.empty(); })) return;
                        job = std::move(jobs_.front());
                        jobs_.pop();
                    }
                    job();                       // run it with the lock released
                }
            });
    }

    template <class F>
    auto submit(F f) -> std::future<decltype(f())> {
        using Result = decltype(f());
        // shared_ptr because std::function requires a copyable target and
        // packaged_task is move-only.
        auto task = std::make_shared<std::packaged_task<Result()>>(std::move(f));
        std::future<Result> result = task->get_future();
        {
            std::scoped_lock lock(mutex_);
            jobs_.emplace([task] { (*task)(); });
        }
        ready_.notify_one();
        return result;
    }

    std::size_t worker_count() const { return workers_.size(); }

private:
    std::mutex mutex_;
    std::condition_variable_any ready_;
    std::queue<std::function<void()>> jobs_;
    std::vector<std::jthread> workers_;         // declared last: joined first
};

int main() {
    Pool pool(3);

    std::vector<std::future<int>> results;
    for (int i = 0; i < 20; ++i) results.push_back(pool.submit([i] { return i * i; }));

    int total = 0;
    for (std::future<int>& r : results) total += r.get();
    std::printf("sum of squares 0..19 = %d, on %zu workers\n", total, pool.worker_count());

    auto failing = pool.submit([]() -> int { throw std::runtime_error("task failed"); });
    try {
        failing.get();
    } catch (const std::exception& e) {
        std::printf("exception travelled out of the pool: %s\n", e.what());
    }
}
```

Twenty tasks, three threads, results and exceptions both delivered. Every piece
of it comes from the last three chapters: a mutex around the queue, a condition
variable to sleep on, a stop token so the destructor can shut the workers down,
and `packaged_task` to connect a job to its future.

The member order matters. `workers_` is declared **last**, so it is destroyed
**first** — the `jthread`s request a stop and join before the queue and mutex
they use are destroyed. Reverse the two and the workers wake up to a destroyed
condition variable.

:::standards
There is still no thread pool in the standard library. C++26 adds
`std::execution` — "senders and receivers" — which provides schedulers and a
`static_thread_pool`, and is a considerably larger idea than the forty lines
above. Until then, real projects use a library: Intel TBB, Folly, Taskflow, or
the pool their framework already has. Write the forty lines to understand the
machinery; do not maintain them.
:::

## Waiting with a deadline

`get()` waits forever. `wait_for` and `wait_until` do not.

```cpp run title="Not waiting forever"
#include <chrono>
#include <cstdio>
#include <future>
#include <thread>

int main() {
    std::future<int> slow = std::async(std::launch::async, [] {
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
        return 42;
    });

    if (slow.wait_for(std::chrono::milliseconds(50)) == std::future_status::ready) {
        std::printf("finished early: %d\n", slow.get());
    } else {
        std::printf("still running after 50 ms; waiting properly now\n");
        std::printf("eventually: %d\n", slow.get());
    }
}
```

`wait_for` returns `ready`, `timeout`, or `deferred` — that last one telling you
the task has not started and never will until you call `get()`, which is a
useful way to detect the policy trap at run time.

## Check yourself

:::quiz
{
  "question": "`std::async(std::launch::async, work); std::async(std::launch::async, work);` — two statements, two tasks. Do they run in parallel?",
  "options": [
    { "text": "No. Each returned future is a temporary destroyed at its own semicolon, and that destructor blocks until the task finishes — so they run one after the other", "correct": true, "why": "This is why `std::async` is `[[nodiscard]]`. Keeping the futures in named variables is what allows the overlap." },
    { "text": "Yes, both threads start immediately and run concurrently", "why": "Both start immediately; the first one is then waited for before the second statement begins." },
    { "text": "Only if `hardware_concurrency()` is at least 2", "why": "The serialisation here is caused by the destructor, not by the core count." },
    { "text": "Undefined behaviour — the tasks outlive their futures", "why": "They cannot: the destructor's blocking is precisely what prevents that." }
  ]
}
:::

:::quiz
{
  "question": "Why should you pass `std::launch::async` explicitly rather than relying on the default?",
  "options": [
    { "text": "The default is `async | deferred`, so the implementation may defer — meaning the task runs on the calling thread inside `get()`, or never runs if `get()` is never called", "correct": true, "why": "Deferred is a lazy synchronous call. A loop of a hundred deferred tasks executes them one at a time on one thread when they are collected." },
    { "text": "The default is always `deferred`", "why": "It is neither; it is a choice left to the implementation, which is exactly the problem." },
    { "text": "The default policy leaks a thread", "why": "It does not. The concern is which of the two behaviours you get." },
    { "text": "Explicit policies are faster to compile", "why": "Irrelevant — the issue is runtime semantics." }
  ]
}
:::

## Practice

:::exercise parallel-futures

:::exercise mini-thread-pool

:::recap
- A `std::future` carries a result that does not exist yet — either the value or
  the exception, which is why futures compose with error handling and raw
  threads do not.
- The future returned by `std::async` blocks in its destructor. Discard it and
  the call becomes synchronous; `[[nodiscard]]` is your compiler saying so.
- The default launch policy may defer, which means running on the calling thread
  inside `get()`, or not at all. Pass `std::launch::async` when you mean it.
- `std::async` is not a pool: sixty-four tasks create sixty-four threads.
- `std::promise` separates "produce a value" from "run a function";
  `std::shared_future` lets many threads read one result.
- `std::packaged_task` connects a queued job to its future, which is the missing
  piece for a pool — forty lines with a mutex, a condition variable and a stop
  token. Declare the workers last so they are joined first.
- `wait_for` gives you a deadline, and reports `deferred` when the task has not
  started.
:::
