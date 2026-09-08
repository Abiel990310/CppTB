---
id: guard-the-counter
title: "Three races and a deadlock"
difficulty: core
chapter: races-and-mutexes
topics: [concurrency, mutexes, deadlock, data-races]
check: unit
standard: c++20
---

`Ledger` tracks a running total and a high-water mark across threads. It has a
mutex. It uses it wrongly in three different ways, and a fourth function
deadlocks.

1. `record` updates two members without locking at all.
2. `snapshot` locks, but returns the two values through two separate locked
   reads, so they can disagree.
3. `reset` locks and then returns early on one path, leaving the mutex held —
   it calls `lock()` and `unlock()` by hand.
4. `merge` locks both ledgers in argument order, so `merge(a, b)` running
   against `merge(b, a)` deadlocks.

Fix all four. The public interface stays as it is.

## Starter
```cpp
#include <algorithm>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>

class Ledger {
public:
    // 1. No lock at all.
    void record(int amount) {
        total_ += amount;
        highest_ = std::max(highest_, amount);
        ++entries_;
    }

    // 2. Two separate critical sections: the values need not agree.
    std::pair<long long, int> snapshot() const {
        long long total;
        int entries;
        { std::scoped_lock lock(mutex_); total = total_; }
        { std::scoped_lock lock(mutex_); entries = entries_; }
        return {total, entries};
    }

    // 3. Hand-rolled locking with an early return that never unlocks.
    void reset_if_over(long long limit) {
        mutex_.lock();
        if (total_ <= limit) return;          // mutex still held
        total_ = 0;
        highest_ = 0;
        entries_ = 0;
        mutex_.unlock();
    }

    // 4. Locks in argument order, so opposite calls deadlock.
    void merge(Ledger& other) {
        std::scoped_lock mine(mutex_);
        std::scoped_lock theirs(other.mutex_);
        total_ += other.total_;
        entries_ += other.entries_;
        highest_ = std::max(highest_, other.highest_);
    }

    int highest() const {
        std::scoped_lock lock(mutex_);
        return highest_;
    }

private:
    mutable std::mutex mutex_;
    long long total_ = 0;
    int highest_ = 0;
    int entries_ = 0;
};
```

## Tests
```cpp
// Four threads recording a thousand entries each: nothing may be lost.
Ledger ledger;
{
    std::vector<std::jthread> workers;
    for (int t = 0; t < 4; ++t)
        workers.emplace_back([&ledger] {
            for (int i = 1; i <= 1000; ++i) ledger.record(i);
        });
}
auto [total, entries] = ledger.snapshot();
CHECK_EQ(total, 4 * 500500LL);
CHECK_EQ(entries, 4000);
CHECK_EQ(ledger.highest(), 1000);

// reset_if_over must not leave the mutex held: the call after it would block
// forever if it did.
Ledger small;
small.record(5);
small.reset_if_over(1000);                 // under the limit: nothing reset
auto [kept_total, kept_entries] = small.snapshot();
CHECK_EQ(kept_total, 5LL);
CHECK_EQ(kept_entries, 1);

small.record(2000);
small.reset_if_over(1000);                 // over the limit: reset
auto [cleared_total, cleared_entries] = small.snapshot();
CHECK_EQ(cleared_total, 0LL);
CHECK_EQ(cleared_entries, 0);
CHECK_EQ(small.highest(), 0);

// Merging in both directions at once must not deadlock. If it does, this
// problem times out rather than failing.
Ledger a;
Ledger b;
for (int i = 1; i <= 100; ++i) { a.record(i); b.record(i); }
{
    std::vector<std::jthread> mergers;
    for (int t = 0; t < 8; ++t) {
        mergers.emplace_back([&a, &b] { a.merge(b); });
        mergers.emplace_back([&b, &a] { b.merge(a); });
    }
}
// How much each ledger ends up holding depends on the interleaving, so the
// checks are invariants rather than exact numbers: nothing was lost, and the
// two members still describe the same instant.
auto [a_total, a_entries] = a.snapshot();
auto [b_total, b_entries] = b.snapshot();
CHECK(a_entries >= 100);
CHECK(b_entries >= 100);
CHECK(a_total >= 5050LL);          // at least what it started with
CHECK(b_total >= 5050LL);
CHECK_EQ(a.highest(), 100);        // merging never lowers the high-water mark
CHECK_EQ(b.highest(), 100);
```

## Hints
- `record` needs a `std::scoped_lock` like every other method. All three members are shared.
- `snapshot` should take **one** lock and read both members inside it, then return. Two critical sections let another thread record between them, and the caller gets a total and a count that never existed together.
- `reset_if_over` should use a guard instead of `lock()`/`unlock()`. Then the early `return` unlocks on the way out, and so would an exception.
- For `merge`, lock both mutexes in one statement: `std::scoped_lock lock(mutex_, other.mutex_);`. That uses a deadlock-free acquisition algorithm regardless of the order the arguments are in.
- `merge` also needs to handle `&other == this`, which would lock the same mutex twice — undefined behaviour on a non-recursive mutex. Return early if they are the same object.
- Do not add a `std::recursive_mutex`. Nothing here needs one, and reaching for one usually hides a design problem.

## Solution
```cpp
#include <algorithm>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>

class Ledger {
public:
    void record(int amount) {
        std::scoped_lock lock(mutex_);
        total_ += amount;
        highest_ = std::max(highest_, amount);
        ++entries_;
    }

    // One critical section, so the two values always describe the same instant.
    std::pair<long long, int> snapshot() const {
        std::scoped_lock lock(mutex_);
        return {total_, entries_};
    }

    // A guard unlocks on every path out, including the early return.
    void reset_if_over(long long limit) {
        std::scoped_lock lock(mutex_);
        if (total_ <= limit) return;
        total_ = 0;
        highest_ = 0;
        entries_ = 0;
    }

    // Both mutexes acquired together, in an order scoped_lock chooses.
    void merge(Ledger& other) {
        if (this == &other) return;
        std::scoped_lock lock(mutex_, other.mutex_);
        total_ += other.total_;
        entries_ += other.entries_;
        highest_ = std::max(highest_, other.highest_);
    }

    int highest() const {
        std::scoped_lock lock(mutex_);
        return highest_;
    }

private:
    mutable std::mutex mutex_;
    long long total_ = 0;
    int highest_ = 0;
    int entries_ = 0;
};
```

## Notes
Four bugs, and the way each one announces itself is different — which is most of
what makes concurrency hard.

**The missing lock** produces a wrong answer, silently, and usually not on the
first run. ASan and UBSan say nothing; only ThreadSanitizer finds it. Note that
`highest_` races too, and its race is nastier than the counter's: `std::max`
reads it, compares, and writes back, so two threads can each decide they are the
maximum and one of them wins.

**The split critical section** produces an answer that is not wrong so much as
*impossible* — a total and a count that were never simultaneously true. A caller
computing a mean from them gets a number describing no actual state of the
ledger. This bug survives code review constantly, because both lines have a lock
on them.

**The hand-rolled lock** is the only one that fails loudly, and it fails as a
hang rather than a crash: the next thread to call any method blocks forever with
no message. It is also the reason the rule is *always use a guard* rather than
*remember to unlock*: an exception thrown between `lock()` and `unlock()` does
exactly the same thing, and no amount of care at the `return` statements
prevents it.

**The lock ordering** is the one that passes every test until the day it does
not. `merge(a, b)` takes `a` then `b`; `merge(b, a)` takes `b` then `a`; run
both at once and each holds what the other needs. `std::scoped_lock(m1, m2)`
solves it properly — it uses an algorithm that acquires both or backs off and
retries, so the argument order stops mattering.

The self-merge guard is not decoration either. `a.merge(a)` with the fix would
pass the same mutex to `scoped_lock` twice, and locking a `std::mutex` you
already hold is undefined behaviour. Any function taking two references to the
same type should ask whether they might be the same object — the same question
Chapter 3.3's self-assignment check answers for copy assignment.
