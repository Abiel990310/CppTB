---
id: thread-safe-queue
title: "Safe methods, unsafe together"
difficulty: core
chapter: races-and-mutexes
topics: [concurrency, mutexes, api-design]
check: unit
standard: c++20
---

`Queue` locks a mutex in every method, so each one is individually thread-safe.
It is still unusable by more than one consumer, because the operation a consumer
actually needs — *take an item if there is one* — cannot be built from them.

```cpp
while (!q.empty()) {        // another thread can empty it here …
    int value = q.pop();    // … and this pops from an empty queue
    …
}
```

Fix the interface, not just the implementation:

- Add `std::optional<int> try_pop()`, which checks and pops **under one lock**
  and returns `std::nullopt` when the queue is empty.
- Make `pop()` go away. Leaving it there leaves the bug available.
- Keep `push`, `size` and `empty` — `size` and `empty` are still useful for
  diagnostics, and the checks use them from a single thread.

## Starter
```cpp
#include <cstddef>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>
#include <vector>

class Queue {
public:
    void push(int value) {
        std::scoped_lock lock(mutex_);
        items_.push(value);
    }

    // Unsafe: the caller has to check empty() first, and cannot do so atomically.
    int pop() {
        std::scoped_lock lock(mutex_);
        int value = items_.front();
        items_.pop();
        return value;
    }

    bool empty() const {
        std::scoped_lock lock(mutex_);
        return items_.empty();
    }

    std::size_t size() const {
        std::scoped_lock lock(mutex_);
        return items_.size();
    }

private:
    mutable std::mutex mutex_;
    std::queue<int> items_;
};
```

## Tests
```cpp
// Single-threaded behaviour first.
Queue q;
CHECK(q.empty());
CHECK_EQ(q.size(), std::size_t{0});
CHECK(!q.try_pop().has_value());          // empty queue: no value, no crash

q.push(10);
q.push(20);
CHECK_EQ(q.size(), std::size_t{2});
CHECK(!q.empty());

std::optional<int> first = q.try_pop();
CHECK(first.has_value());
CHECK_EQ(*first, 10);                     // FIFO order
CHECK_EQ(*q.try_pop(), 20);
CHECK(!q.try_pop().has_value());
CHECK(q.empty());

// Four consumers draining two thousand items. Every item must be taken exactly
// once: the totals must add up and nothing may be left behind.
Queue shared;
for (int i = 1; i <= 2000; ++i) shared.push(i);

std::vector<long long> per_thread(4, 0);
{
    std::vector<std::jthread> consumers;
    for (int t = 0; t < 4; ++t)
        consumers.emplace_back([&shared, &per_thread, t] {
            while (std::optional<int> value = shared.try_pop()) per_thread[t] += *value;
        });
}

long long total = 0;
for (long long part : per_thread) total += part;
CHECK_EQ(total, 2001000LL);               // 1 + 2 + … + 2000
CHECK(shared.empty());
CHECK_EQ(shared.size(), std::size_t{0});

// Producers and consumers at the same time.
Queue mixed;
std::vector<long long> taken(2, 0);
{
    std::vector<std::jthread> workers;
    for (int t = 0; t < 2; ++t)
        workers.emplace_back([&mixed] { for (int i = 1; i <= 500; ++i) mixed.push(i); });
    for (int t = 0; t < 2; ++t)
        workers.emplace_back([&mixed, &taken, t] {
            for (int spin = 0; spin < 100000; ++spin)
                if (std::optional<int> v = mixed.try_pop()) taken[t] += *v;
        });
}
long long drained = taken[0] + taken[1];
while (std::optional<int> v = mixed.try_pop()) drained += *v;
CHECK_EQ(drained, 2 * 125250LL);          // whatever the interleaving, nothing is lost
```

## Hints
- `try_pop` needs one `std::scoped_lock` covering both the emptiness check and the pop. Two locked calls is exactly the bug.
- Return `std::nullopt` when `items_` is empty, and `std::optional<int>` holding the front value otherwise.
- `std::optional` is contextually convertible to `bool`, which is why `while (std::optional<int> v = q.try_pop())` works as a loop condition.
- Delete `pop()`. A method that cannot be called safely is not an asset.
- `empty()` and `size()` are safe to keep and unsafe to *act on* in a multi-threaded caller — their answers are stale the moment they return. Say so in a comment; the checks only use them from one thread.
- `mutable std::mutex` is already there. That is what lets the `const` methods lock.

## Solution
```cpp
#include <cstddef>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>
#include <vector>

class Queue {
public:
    void push(int value) {
        std::scoped_lock lock(mutex_);
        items_.push(value);
    }

    // Check and pop under one lock: the whole operation, or none of it.
    std::optional<int> try_pop() {
        std::scoped_lock lock(mutex_);
        if (items_.empty()) return std::nullopt;
        int value = items_.front();
        items_.pop();
        return value;
    }

    // Honest answers, immediately stale in a multi-threaded caller.
    // Useful for diagnostics; never for deciding whether to pop.
    bool empty() const {
        std::scoped_lock lock(mutex_);
        return items_.empty();
    }

    std::size_t size() const {
        std::scoped_lock lock(mutex_);
        return items_.size();
    }

private:
    mutable std::mutex mutex_;
    std::queue<int> items_;
};
```

## Notes
The fix is not "add a lock" — every method already had one. The fix is to
change **where the operation boundary is**, so that the thing the caller wanted
to do is the thing the lock covers.

This is the general shape of thread-safe interface design, and it is worth
stating as a rule: *a lock makes an operation atomic; it is your job to make the
operation match what callers need.* Two atomic operations are not one atomic
operation, and no amount of locking inside the class fixes a caller that needs
both at once.

Notice what `try_pop` returns and why. It cannot return `int` and signal
emptiness separately, because that splits the answer into two values the caller
would have to combine — the same problem again. `std::optional<int>` carries
both in one, and `while (auto v = q.try_pop())` reads naturally. The standard
library's own concurrent-ish interfaces are shaped this way for the same reason.

`empty()` and `size()` survive, and it is worth being precise about what they
are now. Their answers are correct at the instant the lock is held and possibly
false by the time the caller reads them — so they are fine for logging, for a
single-threaded test, and for a metric, and never a basis for deciding whether
the next `pop` will succeed. That is not a flaw to fix; it is inherent. A number
describing shared mutable state is a photograph, not a promise.

`pop()` is deleted rather than fixed, and that is the most important line of the
answer. Leaving an unsafe method available, with a comment saying not to use it,
means someone uses it — at three in the morning, in the one code path your tests
do not cover. The safest interface is the one where the wrong thing cannot be
written.

One thing this queue still cannot do: block until an item arrives. The consumers
above spin, taking `nullopt` over and over and burning a core. That needs a
condition variable, and the chapter's last sample shows the shape — a
`wait(lock, stop, predicate)` inside `try_pop`'s more useful sibling, usually
called `wait_and_pop`.
