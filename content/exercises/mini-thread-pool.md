---
id: mini-thread-pool
title: "Bounded workers, unbounded tasks"
difficulty: stretch
chapter: futures-and-tasks
topics: [futures, concurrency, thread-pool, packaged-task]
check: unit
standard: c++20
---

`Pool` is meant to run any number of tasks on a fixed number of threads, giving
each caller a `std::future` for its result. The skeleton has the members and the
interface; the two functions that matter are stubs.

- The constructor should start `worker_count` `std::jthread`s, each looping:
  wait for a job, take it, run it, repeat — and exit when a stop is requested.
- `submit` should wrap the callable so its result reaches a future, put it on
  the queue, wake a worker, and return the future.

Exceptions thrown by a task must come back out of `future::get()`, not kill the
process.

## Starter
```cpp
#include <condition_variable>
#include <cstddef>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <set>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

class Pool {
public:
    explicit Pool(int worker_count) {
        // TODO: start worker_count jthreads, each running jobs from the queue.
        (void)worker_count;
    }

    template <class F>
    auto submit(F f) -> std::future<decltype(f())> {
        // TODO: package f, queue it, notify a worker, return its future.
        using Result = decltype(f());
        std::promise<Result> unused;
        return unused.get_future();
    }

    std::size_t worker_count() const { return workers_.size(); }

private:
    std::mutex mutex_;
    std::condition_variable_any ready_;
    std::queue<std::function<void()>> jobs_;
    std::vector<std::jthread> workers_;     // declared last, so destroyed first
};
```

## Tests
```cpp
Pool pool(3);
CHECK_EQ(pool.worker_count(), std::size_t{3});

// Twenty tasks on three threads, every result correct.
std::vector<std::future<int>> results;
for (int i = 0; i < 20; ++i) results.push_back(pool.submit([i] { return i * i; }));

int total = 0;
for (std::future<int>& r : results) total += r.get();
CHECK_EQ(total, 2470);          // 0 + 1 + 4 + ... + 361

// Only the pool's own threads run the work, and never more of them than asked
// for. This is what separates a pool from one-thread-per-task.
std::mutex seen_mutex;
std::set<std::thread::id> seen;
std::vector<std::future<int>> probes;
for (int i = 0; i < 30; ++i)
    probes.push_back(pool.submit([&seen_mutex, &seen] {
        std::scoped_lock lock(seen_mutex);
        seen.insert(std::this_thread::get_id());
        return 1;
    }));
int counted = 0;
for (std::future<int>& p : probes) counted += p.get();
CHECK_EQ(counted, 30);
CHECK(seen.size() <= std::size_t{3});
CHECK(seen.find(std::this_thread::get_id()) == seen.end());   // not the caller's thread

// Tasks returning different types.
std::future<std::string> text = pool.submit([] { return std::string("hello"); });
CHECK_EQ(text.get(), std::string("hello"));

// A task returning void must compile and be waitable.
int side_effect = 0;
std::future<void> nothing = pool.submit([&side_effect] { side_effect = 7; });
nothing.get();
CHECK_EQ(side_effect, 7);

// An exception must travel back through the future.
std::future<int> failing = pool.submit([]() -> int { throw std::runtime_error("task failed"); });
bool threw = false;
try {
    failing.get();
} catch (const std::runtime_error& e) {
    threw = std::string(e.what()) == "task failed";
}
CHECK(threw);

// The pool keeps working after a task threw.
CHECK_EQ(pool.submit([] { return 99; }).get(), 99);
```

## Hints
- The worker body takes a `std::stop_token`: `workers_.emplace_back([this](std::stop_token stop) { ... });`.
- Inside the loop, take a `std::unique_lock`, then `ready_.wait(lock, stop, [this] { return !jobs_.empty(); })`. That overload returns `false` when the wait ended because of a stop request — `return` from the worker then.
- Move the job out of the queue, pop it, **release the lock**, and only then run the job. Running a task while holding the pool's mutex serialises the whole pool.
- `std::packaged_task<Result()>` gives you `get_future()` and turns a thrown exception into a stored one. That is the exception requirement, for free.
- `std::packaged_task` is move-only and `std::function` requires a copyable target, so wrap it: `auto task = std::make_shared<std::packaged_task<Result()>>(std::move(f));` and queue `[task] { (*task)(); }`.
- Get the future from the task **before** queueing it — after that, a worker may have already run and destroyed it.
- `notify_one()` after releasing the lock, or after the scoped block that held it.
- `decltype(f())` is `void` for a void task, and `std::packaged_task<void()>`, `std::future<void>` and `promise::set_value()` all handle that case with no special casing.

## Solution
```cpp
#include <condition_variable>
#include <cstddef>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <set>
#include <stdexcept>
#include <string>
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
                        // false means the stop was requested rather than work arriving.
                        if (!ready_.wait(lock, stop, [this] { return !jobs_.empty(); })) return;
                        job = std::move(jobs_.front());
                        jobs_.pop();
                    }
                    job();                      // lock released: other workers can proceed
                }
            });
    }

    template <class F>
    auto submit(F f) -> std::future<decltype(f())> {
        using Result = decltype(f());

        auto task = std::make_shared<std::packaged_task<Result()>>(std::move(f));
        std::future<Result> result = task->get_future();   // before it can be run

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
    std::vector<std::jthread> workers_;
};
```

## Notes
Every piece of Part 8 appears here, which is why it is the last problem in it: a
mutex around shared state, a condition variable so idle workers sleep instead of
spinning, a stop token so the destructor can shut them down, and a
`packaged_task` connecting a queued job to its future.

Four details in this that are easy to get wrong, and each one produces a
different failure.

**Release the lock before running the job.** If `job()` is called while the
`unique_lock` is still held, only one task ever runs at a time and the pool is an
expensive way to be single-threaded. The tests would still pass — which is why
this is worth stating rather than discovering.

**`workers_` is declared last.** Members are destroyed in reverse declaration
order, so the `jthread`s are joined *before* the mutex, condition variable and
queue they use are destroyed. Move that member up and shutdown becomes a
use-after-free of the condition variable — intermittently, at process exit,
which is the worst place to debug anything.

**Take the future before queueing.** `task->get_future()` must happen before the
job is visible to a worker. Queue first and a worker can run the task and drop
the last `shared_ptr` before you ask for the future.

**The `shared_ptr` is not laziness.** `std::packaged_task` is move-only, and
`std::function` requires its target to be copy-constructible, so a
`packaged_task` cannot go into a `std::function` directly. The `shared_ptr`
makes the lambda copyable while keeping one task alive. C++23's `std::move_only_function`
removes the need for it, and a hand-written type-erased job queue would too.

What this pool still lacks, in rough order of how much you would miss it: work
stealing (idle workers cannot take from a busy one's queue, though with one
shared queue that does not arise here), a bound on queue length so a producer
cannot exhaust memory, any notion of priority, and a way to wait for all
outstanding work without holding every future. Those are the reasons the answer
in real code is a library rather than these forty lines — but the forty lines
are what the library is doing.
