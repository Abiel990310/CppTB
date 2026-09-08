---
id: atomic-statistics
title: "Counters without a lock"
difficulty: core
chapter: atomics
topics: [atomics, concurrency, lock-free]
check: unit
standard: c++20
---

`Stats` collects three numbers from many threads: how many samples arrived,
their total, and the largest one seen. It currently uses plain `int`s and
`long long`s, so all three race.

Rewrite it with `std::atomic`, without a mutex anywhere.

Two of the three are a single atomic operation. The third — the maximum — is
not, and needs a compare-exchange loop.

## Starter
```cpp
#include <atomic>
#include <cstddef>
#include <thread>
#include <vector>

class Stats {
public:
    void record(int sample) {
        ++count_;
        total_ += sample;
        if (sample > highest_) highest_ = sample;
    }

    int count() const { return count_; }
    long long total() const { return total_; }
    int highest() const { return highest_; }

    // Hands out a distinct number to each caller, starting at 0.
    int next_ticket() { return tickets_++; }

private:
    int count_ = 0;
    long long total_ = 0;
    int highest_ = 0;
    int tickets_ = 0;
};
```

## Tests
```cpp
// The design must be lock-free — otherwise this is a mutex with extra steps.
static_assert(std::atomic<int>::is_always_lock_free);
static_assert(std::atomic<long long>::is_always_lock_free);

// Single-threaded behaviour is unchanged.
Stats one;
one.record(5);
one.record(12);
one.record(3);
CHECK_EQ(one.count(), 3);
CHECK_EQ(one.total(), 20LL);
CHECK_EQ(one.highest(), 12);

// Four threads, a hundred thousand samples each. Enough contention that an
// unsynchronised version loses a large fraction of them every single run.
Stats shared;
{
    std::vector<std::jthread> workers;
    for (int t = 0; t < 4; ++t)
        workers.emplace_back([&shared, t] {
            for (int i = 1; i <= 100'000; ++i) shared.record(i * (t + 1));
        });
}
CHECK_EQ(shared.count(), 400'000);
CHECK_EQ(shared.total(), 10LL * 5'000'050'000LL);   // (1+2+3+4) * (1+...+100000)
CHECK_EQ(shared.highest(), 400'000);

// Negative samples must not break the maximum.
Stats negatives;
{
    std::vector<std::jthread> workers;
    for (int t = 0; t < 4; ++t)
        workers.emplace_back([&negatives] {
            for (int i = 1; i <= 100; ++i) negatives.record(-i);
        });
}
CHECK_EQ(negatives.count(), 400);
CHECK_EQ(negatives.highest(), 0);               // nothing beat the initial 0

// Tickets must all be distinct.
Stats dispenser;
std::vector<int> tickets(64);
{
    std::vector<std::jthread> workers;
    for (int t = 0; t < 64; ++t)
        workers.emplace_back([&dispenser, &tickets, t] { tickets[t] = dispenser.next_ticket(); });
}
std::vector<bool> seen(64, false);
for (int ticket : tickets) {
    CHECK(ticket >= 0);
    CHECK(ticket < 64);
    CHECK(!seen[static_cast<std::size_t>(ticket)]);   // no duplicates
    seen[static_cast<std::size_t>(ticket)] = true;
}
```

## Hints
- `count_`, `total_` and `tickets_` become `std::atomic<int>` and `std::atomic<long long>`. `++count_` and `total_ += sample` are then already atomic.
- `tickets_++` on an atomic returns the value *before* the increment, which is exactly what a ticket dispenser wants — the same as `fetch_add(1)`.
- The maximum cannot be one operation: reading, comparing and storing is three steps, and another thread can slip in between them.
- The shape is a compare-exchange loop: load the current value, and while your candidate is bigger, try to swap it in. If the swap fails, `compare_exchange_weak` has already updated your local copy with the real current value, so the loop condition is re-checked against it.
- `while (candidate > current && !highest_.compare_exchange_weak(current, candidate)) {}` — the empty body is deliberate; all the work is in the condition.
- Use `compare_exchange_weak`, not `strong`. It may fail spuriously, which costs nothing when it is already inside a retry loop.
- The getters can `load()` — or just rely on `std::atomic`'s conversion to `T`. Either is fine; each one is a single atomic read.

## Solution
```cpp
#include <atomic>
#include <cstddef>
#include <thread>
#include <vector>

class Stats {
public:
    void record(int sample) {
        ++count_;
        total_ += sample;

        // Read, compare, swap — retrying if someone changed it underneath us.
        int current = highest_.load();
        while (sample > current && !highest_.compare_exchange_weak(current, sample)) {
        }
    }

    int count() const { return count_.load(); }
    long long total() const { return total_.load(); }
    int highest() const { return highest_.load(); }

    int next_ticket() { return tickets_.fetch_add(1); }

private:
    std::atomic<int> count_{0};
    std::atomic<long long> total_{0};
    std::atomic<int> highest_{0};
    std::atomic<int> tickets_{0};
};
```

## Notes
Two of the three counters needed nothing but a change of type. `++count_` on a
`std::atomic<int>` is a `lock xadd` — indivisible, and about five times cheaper
than taking a mutex to do the same thing.

The maximum is the interesting one, because it is where "make it atomic" stops
being a type change and becomes an algorithm. `if (sample > highest_) highest_ =
sample;` is three separate operations, and making each of them atomic
individually does not help at all: two threads can both read 100, both decide
they are bigger, and the smaller one can win the race to write. Making an
*operation* atomic is not the same as making each of its *steps* atomic — which
is exactly the point Chapter 8.2 made about `if (!q.empty()) q.pop();`, arriving
again from a different direction.

The compare-exchange loop is how you build any operation the hardware does not
provide directly. Read the value you are basing your decision on, compute the
new one, and swap it in **only if nothing has changed**. If something has, you
are handed the new value and you decide again. Notice that the loop body is
empty: `compare_exchange_weak` writes the actual value back into `current` on
failure, so the next test of `sample > current` is against fresh data with no
extra load.

The negative-sample check is there for a reason worth generalising. `highest_`
starts at 0, so a stream of negative numbers must leave it at 0 — and a
"maximum" implemented by unconditionally swapping in whatever arrived would pass
every other check and fail this one. Initial values are part of the algorithm.

What this does *not* give you is a consistent snapshot. `count()` and `total()`
are two separate atomic reads, and another thread can record between them, so a
caller computing a mean can divide a newer total by an older count. Each value
is correct; the pair is not guaranteed to describe any one instant. If you need
that, you need a lock — and Chapter 8.2's `snapshot()` is what it looks like.
This is the real cost of going lock-free, and it is a design cost rather than a
performance one.
