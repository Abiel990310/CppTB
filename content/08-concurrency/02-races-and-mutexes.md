---
title: "Data races and mutexes"
navTitle: "Races and mutexes"
summary: >-
  The bug class that only appears in production, and how to exclude it.
objectives:
  - Define a data race precisely
  - Protect shared state with a mutex and a lock guard
  - Explain how a deadlock forms and how to avoid one
status: complete
standard: c++20
requires: [threads]
---

Four threads, one counter, a hundred thousand increments each. Four hundred
thousand at the end.

```cpp run title="Four hundred thousand increments, half of them lost"
#include <cstdio>
#include <thread>
#include <vector>

int counter = 0;

int main() {
    constexpr int threads = 4;
    constexpr int per_thread = 100'000;

    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < threads; ++i)
            workers.emplace_back([] {
                for (int k = 0; k < per_thread; ++k) ++counter;
            });
    }

    std::printf("expected %d, got %d, lost %d\n",
                threads * per_thread, counter, threads * per_thread - counter);
}
```

Press Run. The answer is wrong, differently wrong each time, and somewhere
between a third and two thirds of the increments have vanished.

`++counter` is not one operation. It is a load, an add, and a store, and nothing
stops another thread loading the same value between your load and your store.
Both threads then write back the same number, and one increment is gone. Do
that four hundred thousand times across four threads and most of them collide.

## What a data race is, precisely

The standard's definition has three parts. A **data race** occurs when:

1. two or more threads access the same memory location,
2. at least one of those accesses is a **write**, and
3. the accesses are not **ordered** — neither happens-before the other, by a
   mutex, an atomic, a thread start, or a join.

If all three hold, the program has **undefined behaviour**. Not "an unpredictable
value" — undefined behaviour, with everything Chapter 6.3 said about it. The
compiler is entitled to assume `counter` is not modified elsewhere and keep it
in a register across the whole loop, which is why the number you get is not even
reliably "some interleaving of the increments".

The corollaries are worth stating explicitly:

- **Two reads are never a race.** Any number of threads may read the same
  memory concurrently, provided nobody writes it.
- **Different memory locations are never a race**, even in the same object.
  Chapter 8.1's `results[i]` per thread was safe for this reason.
- **A single `bool` is not exempt.** There is no size below which racing is
  permitted, and no "it's just a flag" defence.

:::warning
**The sanitizers on this page will not catch this.** They are AddressSanitizer
and UndefinedBehaviorSanitizer, which find memory errors, not races.
Data races are ThreadSanitizer's job, and TSan cannot be combined with ASan —
you build separately with `-fsanitize=thread`. Doing so on the sample above
gives:

```
WARNING: ThreadSanitizer: data race (pid=15852)
  Read of size 4 at 0x55a5ea2ff024 by thread T2:
    #0 operator() race.cpp:8
  Previous write of size 4 at 0x55a5ea2ff024 by thread T1:
    #0 operator() race.cpp:8
```

Add `-fsanitize=thread` to your test build. It has perhaps a 5–15× runtime cost
and finds races that only manifest one run in ten thousand — which is the entire
problem with this bug class, and the reason a test suite that has passed a
thousand times proves very little about it.
:::

## The mutex, and the lock that owns it

A **mutex** — mutual exclusion — is a lock at most one thread may hold. Locking
it while another thread holds it blocks until they let go.

Never call `lock()` and `unlock()` yourself. An early `return`, a `break`, or an
exception between the two leaves the mutex locked forever, and every other
thread stops. Use a guard object, which is Chapter 3.2's RAII with a different
resource:

```cpp run title="The same program, with a mutex"
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

int counter = 0;
std::mutex counter_mutex;

int main() {
    constexpr int threads = 4;
    constexpr int per_thread = 100'000;

    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < threads; ++i)
            workers.emplace_back([] {
                for (int k = 0; k < per_thread; ++k) {
                    std::scoped_lock lock(counter_mutex);   // locked here
                    ++counter;
                }                                           // unlocked here
            });
    }

    std::printf("expected %d, got %d\n", threads * per_thread, counter);
}
```

Exactly 400,000, every time.

There are three guards, and one of them is the answer almost always:

| Guard | Use |
|---|---|
| `std::scoped_lock` | **the default.** One or more mutexes, locked for the scope |
| `std::unique_lock` | when you need to unlock early, relock, or wait on a condition variable |
| `std::lock_guard` | the C++11 original; `scoped_lock` supersedes it |

:::pitfall
`std::scoped_lock lock(m);` declares a variable called `lock`. `std::scoped_lock(m);`
declares a variable called `m`, of type `scoped_lock`, default-constructed —
locking nothing at all, and then immediately destroyed. The parentheses make it
look like a statement and it is a declaration. **Always name the guard.** GCC
and Clang warn about the unnamed form under `-Wunused-variable`, which is one
more reason to build with warnings on.
:::

Note what got slower: about three to four times, measured on this machine —
15 ms for the broken version against 60 ms for the correct one. Four threads are
now serialised through one lock and doing nothing else between acquisitions, so
they spend their time handing the lock back and forth. Locking a mutex four
hundred thousand times to protect a single addition is the wrong shape: the next
chapter's atomics do this particular job without a lock at all, and the general
answer is to make each critical section contain enough real work to be worth
entering.

## What the mutex actually protects

A mutex protects an **invariant**, not a variable. It has no connection to any
data except the one you maintain by convention, and the convention has to be:
*every* access to that data, read or write, holds the lock.

The usual way to make that convention hard to break is to put the mutex and the
data in the same class, and let nothing else reach the data:

```cpp run title="State and its lock, together"
#include <cstdio>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

class Tally {
public:
    void record(int amount) {
        std::scoped_lock lock(mutex_);
        total_ += amount;
        ++entries_;
    }

    // Both values read under one lock, so they always agree with each other.
    std::pair<long long, int> snapshot() const {
        std::scoped_lock lock(mutex_);
        return {total_, entries_};
    }

private:
    mutable std::mutex mutex_;     // mutable: locking is not a logical change
    long long total_ = 0;
    int entries_ = 0;
};

int main() {
    Tally tally;
    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < 4; ++i)
            workers.emplace_back([&tally] {
                for (int k = 1; k <= 1000; ++k) tally.record(k);
            });
    }

    auto [total, entries] = tally.snapshot();
    std::printf("total %lld over %d entries (expected %d over %d)\n",
                total, entries, 4 * 500500, 4000);
}
```

Two details worth copying. The mutex is `mutable`, so a `const` member function
can lock it — locking is not a change to the object's logical value. And
`snapshot` returns both numbers from **one** critical section: reading them
through two separate locked calls would let another thread record between the
two, and the caller would get a total and a count that never coexisted.

That last point generalises into the most common design mistake in concurrent
code: a class whose individual operations are each thread-safe, but whose
*combinations* are not. `if (!queue.empty()) queue.pop();` is two safe calls and
one race — another thread can empty the queue in between. The operation the
caller wanted was "pop if there is anything", and that has to be one locked
method.

## Deadlock

Two mutexes, two threads, opposite orders. Each takes one and waits forever for
the other.

```cpp run title="A deadlock, with a timeout so you can see it"
#include <chrono>
#include <cstdio>
#include <mutex>
#include <thread>

std::timed_mutex a;
std::timed_mutex b;

void take_both(std::timed_mutex& first, std::timed_mutex& second, const char* who) {
    std::unique_lock lock1(first);
    std::this_thread::sleep_for(std::chrono::milliseconds(50));   // let the other one get theirs

    if (second.try_lock_for(std::chrono::milliseconds(200))) {
        std::printf("%s: acquired both\n", who);
        second.unlock();
    } else {
        std::printf("%s: could not acquire the second lock — this is the deadlock\n", who);
    }
}

int main() {
    std::printf("opposite orders:\n");
    {
        std::jthread one(take_both, std::ref(a), std::ref(b), "A then B");
        std::jthread two(take_both, std::ref(b), std::ref(a), "B then A");
    }

    std::printf("\nsame order:\n");
    {
        std::jthread one(take_both, std::ref(a), std::ref(b), "A then B (1)");
        std::jthread two(take_both, std::ref(a), std::ref(b), "A then B (2)");
    }
}
```

With opposite orders, **both** threads fail: each holds one lock and cannot get
the other, and only the timeout lets the program finish at all. With the same
order, both succeed — the second thread simply waits for the first to be done.

Real deadlocks have no timeout. The program stops, with no error, no crash and
no output, and the only way to find out why is to attach a debugger and look at
where each thread is stuck.

Three defences, in order of preference:

1. **Lock in a consistent global order.** If every function that needs both `a`
   and `b` takes `a` first, no cycle can form. Order them by address if there is
   no natural order.
2. **Lock them together.** `std::scoped_lock lock(a, b);` uses a deadlock-free
   algorithm to acquire both, whatever order the arguments are in. This is what
   `scoped_lock`'s multi-mutex constructor exists for.
3. **Hold one lock at a time.** Deadlock needs a thread holding one lock while
   waiting for another. A design where that never happens cannot deadlock, and
   is usually simpler as well.

```cpp run title="scoped_lock takes both, safely"
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

struct Account {
    std::mutex mutex;
    int balance;
};

void transfer(Account& from, Account& to, int amount) {
    std::scoped_lock lock(from.mutex, to.mutex);   // both, deadlock-free
    from.balance -= amount;
    to.balance += amount;
}

int main() {
    Account a{{}, 1000};
    Account b{{}, 1000};

    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < 100; ++i) workers.emplace_back([&] { transfer(a, b, 1); });
        for (int i = 0; i < 100; ++i) workers.emplace_back([&] { transfer(b, a, 1); });
    }

    std::printf("a = %d, b = %d, total = %d\n", a.balance, b.balance, a.balance + b.balance);
}
```

Two hundred threads transferring in both directions at once, and the total is
always 2000. Written with two separate `scoped_lock`s in the order the arguments
happen to be in, this deadlocks within a few runs.

:::warning
A `std::mutex` is **not reentrant**. Locking one you already hold — usually by
calling a locked method from another locked method of the same class — is
undefined behaviour, and in practice deadlocks the thread against itself.
`std::recursive_mutex` allows it, and reaching for it is almost always a sign
that a locked public method should have been split into a public locking wrapper
and a private unlocked implementation.
:::

## Waiting for something to happen

Polling a flag under a mutex burns a core. `std::condition_variable` lets a
thread sleep until another one says something changed.

```cpp run title="A consumer that sleeps until there is work"
#include <condition_variable>
#include <cstdio>
#include <mutex>
#include <queue>
#include <thread>

int main() {
    std::mutex mutex;
    std::condition_variable_any ready;
    std::queue<int> work;
    int consumed = 0;

    std::jthread consumer([&](std::stop_token stop) {
        while (true) {
            std::unique_lock lock(mutex);
            // Returns false if the stop was requested instead of work arriving.
            if (!ready.wait(lock, stop, [&] { return !work.empty(); })) return;
            work.pop();
            ++consumed;
        }
    });

    for (int i = 0; i < 5; ++i) {
        { std::scoped_lock lock(mutex); work.push(i); }
        ready.notify_one();
    }

    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    consumer.request_stop();
    ready.notify_all();
    consumer.join();

    std::printf("consumed %d items, %zu left\n", consumed, work.size());
}
```

Three things this shows that are all mandatory:

**The predicate.** `wait(lock, predicate)` re-checks the condition after every
wake-up, because a condition variable is allowed to wake **spuriously** — with
no notification at all. A bare `wait(lock)` without a predicate is almost always
a bug.

**The `unique_lock`.** `wait` unlocks the mutex while sleeping and relocks it
before returning, so it needs a guard it can unlock — which `scoped_lock` cannot
do.

**The stop token.** `condition_variable_any::wait` has an overload taking a
`std::stop_token`; it returns `false` when the wait ended because of a stop
request rather than the predicate. Without it, the consumer would sleep forever
and `jthread`'s destructor would hang waiting to join it — which is the promise
Chapter 8.1 made and this is where it is kept.

## Check yourself

:::quiz
{
  "question": "Two threads read the same `int` while a third writes it once. Is that a data race?",
  "options": [
    { "text": "Yes — one write plus any concurrent unsynchronised access to the same location is a race, and therefore undefined behaviour", "correct": true, "why": "The count of readers is irrelevant. What matters is that at least one access is a write and none of them are ordered relative to the others." },
    { "text": "No, because reading an int is atomic on every real machine", "why": "It usually is at the hardware level, and that is not the guarantee. The compiler is entitled to assume no other thread writes the variable and to cache it in a register." },
    { "text": "No, because only one thread writes", "why": "One writer and one reader is the classic race. The rule needs *at least* one write, not more than one." },
    { "text": "Only if the int is larger than a machine word", "why": "There is no size below which racing is permitted. A racing `bool` is undefined behaviour too." }
  ]
}
:::

:::quiz
{
  "question": "A thread-safe queue makes every method lock a mutex. Why is `if (!q.empty()) q.pop();` still wrong?",
  "options": [
    { "text": "Both calls are individually safe, but another thread can empty the queue between them — the operation the caller wanted has to be one locked method", "correct": true, "why": "This is the most common design error in concurrent code: safe operations that are not safe in combination. The fix is a `try_pop` that checks and pops under one lock." },
    { "text": "`empty()` cannot be made thread-safe", "why": "It can, and is. The problem is the gap between the two calls, not either one of them." },
    { "text": "`pop()` needs a recursive mutex", "why": "Nothing here locks twice from the same thread." },
    { "text": "It is fine as long as there is only one consumer", "why": "True, and that is exactly the fragile assumption. A class advertised as thread-safe should not be safe only for one caller." }
  ]
}
:::

## Practice

:::exercise guard-the-counter

:::exercise thread-safe-queue

:::recap
- A data race is: two threads, the same memory location, at least one write, no
  ordering between them. It is undefined behaviour, not merely an unpredictable
  value.
- Concurrent reads are fine. Distinct memory locations are fine. There is no
  size small enough to be exempt.
- ASan and UBSan do not find races. `-fsanitize=thread` does, at a 5–15× cost,
  and belongs in your test build.
- Lock with a guard, never by hand, and always name the guard —
  `std::scoped_lock lock(m);`, not `std::scoped_lock(m);`.
- A mutex protects an invariant by convention. Keep it in the same class as the
  data, make the mutex `mutable`, and return related values from one critical
  section.
- Individually thread-safe operations do not compose. `if (!q.empty()) q.pop();`
  is two safe calls and one race.
- Deadlock needs a cycle. Break it with a consistent lock order, with
  `std::scoped_lock(a, b)`, or by never holding two locks at once.
- `condition_variable` waits need a predicate (spurious wake-ups are legal), a
  `unique_lock`, and — for a cancellable thread — the `stop_token` overload.
:::
