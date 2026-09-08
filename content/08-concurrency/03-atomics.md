---
title: "Atomics and the memory model"
navTitle: "Atomics"
summary: >-
  The guarantees the hardware and the standard actually give you.
objectives:
  - Use an atomic counter correctly
  - Explain sequential consistency versus acquire-release
  - Recognise when lock-free code is the wrong answer
status: complete
standard: c++20
requires: [races-and-mutexes]
---

The previous chapter fixed a racing counter with a mutex, and noted that
locking four hundred thousand times to protect one addition is the wrong shape.
`std::atomic` is the right shape: an operation the hardware performs
indivisibly, with no lock and no waiting.

It is also the point where "just be careful" stops working. Atomics come with a
memory model — a set of rules about what one thread is guaranteed to see of
another's writes — and getting it wrong produces code that is correct on your
machine and broken on a phone.

```cpp run title="Three ways to count to eight hundred thousand"
#include <atomic>
#include <chrono>
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

constexpr int threads = 4;
constexpr int per_thread = 200'000;

std::mutex mutex;
long long guarded = 0;
std::atomic<long long> sequential{0};
std::atomic<long long> relaxed{0};

template <class Body>
double time_threads(Body body) {
    auto start = std::chrono::steady_clock::now();
    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < threads; ++i) workers.emplace_back(body);
    }
    auto end = std::chrono::steady_clock::now();
    return std::chrono::duration<double, std::milli>(end - start).count();
}

int main() {
    double with_mutex = time_threads([] {
        for (int k = 0; k < per_thread; ++k) { std::scoped_lock lock(mutex); ++guarded; }
    });
    double with_seq_cst = time_threads([] {
        for (int k = 0; k < per_thread; ++k) ++sequential;
    });
    double with_relaxed = time_threads([] {
        for (int k = 0; k < per_thread; ++k) relaxed.fetch_add(1, std::memory_order_relaxed);
    });

    std::printf("mutex          %7.1f ms  ->  %lld\n", with_mutex, guarded);
    std::printf("atomic seq_cst %7.1f ms  ->  %lld\n", with_seq_cst, sequential.load());
    std::printf("atomic relaxed %7.1f ms  ->  %lld\n", with_relaxed, relaxed.load());
    std::printf("expected                     %d\n", threads * per_thread);
}
```

All three give 800,000. On this machine the mutex takes around 90 ms and both
atomic versions around 20 ms — about five times faster — and `relaxed` is barely
distinguishable from `seq_cst`. The last part is not an accident, and the rest
of this chapter explains it.

## What `std::atomic` guarantees

`std::atomic<T>` makes every operation on the value **indivisible**: no other
thread can observe it half-done, and two concurrent modifications cannot lose
one another. Accessing an atomic from several threads is not a data race, so it
is not undefined behaviour — which is the whole point.

The operations worth knowing:

| Operation | Does |
|---|---|
| `load()`, `store(v)` | read, write |
| `exchange(v)` | store and return the previous value |
| `fetch_add(n)`, `fetch_sub(n)` | add or subtract, returning the **previous** value |
| `compare_exchange_weak(expected, desired)` | if the value is `expected`, replace it; otherwise write the actual value into `expected`. Returns whether it succeeded |
| `++`, `--`, `+=` | shorthand for the `fetch_` forms |

`fetch_add` returning the old value is what makes it useful for handing out
tickets: every caller gets a distinct number, with no lock.

```cpp run title="fetch_add hands out unique numbers"
#include <atomic>
#include <cstdio>
#include <thread>
#include <vector>

std::atomic<int> next_id{0};

int main() {
    std::vector<int> ids(8);
    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < 8; ++i)
            workers.emplace_back([&ids, i] { ids[i] = next_id.fetch_add(1); });
    }

    std::vector<bool> seen(8, false);
    for (int id : ids) seen[static_cast<std::size_t>(id)] = true;

    int distinct = 0;
    for (bool s : seen) distinct += s ? 1 : 0;
    std::printf("handed out %d ids, %d distinct, next is %d\n",
                static_cast<int>(ids.size()), distinct, next_id.load());
}
```

Eight threads, eight distinct ids, every time.

## "Lock-free" is a property you must check

`std::atomic<T>` works for any trivially copyable `T`. When the hardware has no
instruction for that size, the library falls back to a hidden lock — so the type
still behaves atomically, and the performance argument evaporates.

```cpp run title="Which atomics are actually lock-free"
#include <atomic>
#include <cstdio>

struct Pair  { int a; int b; };                 // 8 bytes
struct Wide  { int a, b, c, d, e, f; };         // 24 bytes

int main() {
    std::printf("atomic<int>      lock-free: %d   size %zu\n",
                int(std::atomic<int>::is_always_lock_free), sizeof(std::atomic<int>));
    std::printf("atomic<double>   lock-free: %d   size %zu\n",
                int(std::atomic<double>::is_always_lock_free), sizeof(std::atomic<double>));
    std::printf("atomic<int*>     lock-free: %d   size %zu\n",
                int(std::atomic<int*>::is_always_lock_free), sizeof(std::atomic<int*>));
    std::printf("atomic<Pair>     lock-free: %d   size %zu\n",
                int(std::atomic<Pair>::is_always_lock_free), sizeof(std::atomic<Pair>));
    std::printf("atomic<Wide>     lock-free: %d   size %zu\n",
                int(std::atomic<Wide>::is_always_lock_free), sizeof(std::atomic<Wide>));
}
```

Everything up to the machine's word size is lock-free; the 24-byte struct is
not. `is_always_lock_free` is a `constexpr bool`, so you can `static_assert` on
it — and you should, in any code whose design depends on the answer.

## The memory model

Here is the part that is genuinely hard, stated as plainly as it can be.

Both your compiler and your CPU **reorder memory operations**. The compiler does
it to keep the pipeline full; the CPU does it because a store may sit in a
buffer for a while before other cores see it. Within one thread, none of this is
observable — the reordering is required to preserve what the thread itself sees.
Across threads, it is very observable.

So: `std::atomic` guarantees each *individual* operation is indivisible. The
**memory order** argument is a separate question — what other, ordinary memory
accesses are guaranteed to be visible around it.

Three orderings matter in practice.

**`memory_order_seq_cst`** — the default, and what you get if you write nothing.
Every `seq_cst` operation in the whole program appears to happen in one single
total order that every thread agrees on. This is the model your intuition
already has, and it is the one to use until you have a measured reason not to.

**`memory_order_acquire` / `memory_order_release`** — a one-way pairing. A
*release* store publishes everything the thread wrote before it; an *acquire*
load on the same variable, if it reads that value, sees all of it. Nothing is
promised about threads not participating in that handshake.

```cpp run title="Publishing data with release, reading it with acquire"
#include <atomic>
#include <cstdio>
#include <string>
#include <thread>

std::string payload;                 // ordinary, non-atomic data
std::atomic<bool> ready{false};

int main() {
    std::jthread producer([] {
        payload = "the answer is 42";              // (1) ordinary write
        ready.store(true, std::memory_order_release);  // (2) publishes (1)
    });

    std::jthread consumer([] {
        while (!ready.load(std::memory_order_acquire)) {   // (3) waits for (2)
            std::this_thread::yield();
        }
        std::printf("consumer read: %s\n", payload.c_str());   // (4) sees (1)
    });
}
```

The consumer reads a plain `std::string` with no lock and no atomic, and it is
not a data race — because the release store and the acquire load establish
*happens-before* between (1) and (4). Take the orderings off, make `ready` a
plain `bool`, and it is undefined behaviour with a plausible-looking output.

**`memory_order_relaxed`** — indivisible, and nothing else. Other threads will
see the value eventually, in some order, with no guarantee about anything else
the thread wrote. It is correct for a statistics counter that nobody uses to
decide anything, and for very little else.

## What the orderings cost, on this machine

x86-64 has a strong memory model, and you can see exactly what each ordering
costs by looking at the generated code.

```cpp run asm title="One instruction of difference"
#include <atomic>
#include <cstdio>

std::atomic<int> flag{0};

void store_seq_cst(int v) { flag.store(v, std::memory_order_seq_cst); }
void store_release(int v) { flag.store(v, std::memory_order_release); }
int  load_seq_cst()       { return flag.load(std::memory_order_seq_cst); }
int  load_acquire()       { return flag.load(std::memory_order_acquire); }
int  add_seq_cst()        { return flag.fetch_add(1); }
int  add_relaxed()        { return flag.fetch_add(1, std::memory_order_relaxed); }

int main() {
    store_release(1);
    std::printf("%d %d %d %d\n", load_acquire(), load_seq_cst(), add_seq_cst(), add_relaxed());
}
```

At `-O2`:

| Function | Instruction |
|---|---|
| `store_seq_cst` | `xchgl flag(%rip), %edi` — a locked read-modify-write |
| `store_release` | `movl %edi, flag(%rip)` — an ordinary store |
| `load_seq_cst` | `movl flag(%rip), %eax` |
| `load_acquire` | `movl flag(%rip), %eax` — identical |
| `add_seq_cst` | `lock xaddl %eax, flag(%rip)` |
| `add_relaxed` | `lock xaddl %eax, flag(%rip)` — identical |

On x86-64, loads are already acquire and stores are already release, for free.
The **only** thing sequential consistency costs is on stores, where it needs a
locked instruction rather than a plain one. And a read-modify-write is a locked
instruction whatever ordering you ask for — which is why `relaxed` bought
essentially nothing in the counter benchmark at the top of the chapter.

:::warning
Do not generalise from that table. On ARM, POWER, and RISC-V the orderings
compile to genuinely different instructions with genuinely different costs, and
a program that is accidentally correct because x86 does not reorder loads will
fail on a phone. Reason about your code against **the standard's model**, not
against the machine in front of you. The assembly here is worth looking at to
understand what the orderings mean, not to decide which one is safe.
:::

## Building something out of compare-exchange

Some operations have no single instruction. An atomic maximum, for instance:
read, compare, and store only if bigger — three steps that must not be
interrupted.

```cpp run title="An atomic maximum, by retrying"
#include <atomic>
#include <cstdio>
#include <thread>
#include <vector>

void record_max(std::atomic<int>& highest, int candidate) {
    int current = highest.load(std::memory_order_relaxed);
    // If nobody changed it, store; if somebody did, `current` is updated
    // to their value and we go round again.
    while (candidate > current &&
           !highest.compare_exchange_weak(current, candidate)) {
    }
}

int main() {
    std::atomic<int> highest{0};
    {
        std::vector<std::jthread> workers;
        for (int t = 0; t < 4; ++t)
            workers.emplace_back([&highest, t] {
                for (int i = 1; i <= 1000; ++i) record_max(highest, i * (t + 1));
            });
    }
    std::printf("highest recorded: %d (expected 4000)\n", highest.load());
}
```

This is the **compare-and-swap loop**, and it is the foundation of every
lock-free algorithm. Read the current value, compute the new one, and swap it in
only if nothing changed underneath you; if something did, you are handed the new
current value and you try again.

Two details of `compare_exchange_weak`. Its first argument is an **in-out
parameter** — on failure it is overwritten with the actual value, which is what
makes the loop work without a second load. And it is allowed to fail
*spuriously*, returning false even when the values matched, which is free on
some architectures and is fine because it is always used in a loop.
`compare_exchange_strong` never fails spuriously, costs more on those
architectures, and is for when you are not looping.

## When lock-free is the wrong answer

Almost always, is the honest answer.

**A mutex is not slow.** An uncontended `std::mutex` lock is an atomic operation
and nothing else — no system call, no context switch. The cost appears only
under contention, and under contention a lock-free algorithm is usually *also*
slow, because its CAS loop keeps failing and retrying. Chapter 8.2's mutexed
counter was three times slower than the racy version and about five times slower
than the atomic; those ratios only matter when the critical section is one
instruction.

**Lock-free does not mean wait-free.** A CAS loop can retry indefinitely under
heavy contention. The guarantee is that *some* thread makes progress, not that
yours does.

**The hard part is not the atomics.** Consider popping from a lock-free stack:
read `head`, read `head->next`, CAS `head` to `next`. Between the two reads,
another thread can pop A and B and push A back. Your CAS now succeeds — `head`
is A again, exactly as expected — and sets `head` to a node that has been freed.
This is the **ABA problem**, and defending against it needs tagged pointers,
hazard pointers, or epoch reclamation. None of it is checkable by a test suite,
because the failure is a specific interleaving in a specific order.

**Memory reclamation is unsolved in the standard library.** When can you delete
a node no thread has a pointer to? There is no portable answer in C++20, which
is why there is no `std::lock_free_queue`.

:::tip
The order to try things in: **one thread**, then a **mutex**, then a
**standard-library concurrency tool** (`std::atomic` counters and flags,
`std::async`, a queue with a mutex and a condition variable), and only then
a hand-written lock-free structure — with a benchmark proving it was necessary
and, ideally, someone else's reviewed implementation. Almost nobody gets past
step two, and that is the correct outcome.
:::

## Check yourself

:::quiz
{
  "question": "You change a shared counter from `fetch_add(1)` to `fetch_add(1, std::memory_order_relaxed)` and see no speed-up on x86-64. Why?",
  "options": [
    { "text": "A read-modify-write compiles to a `lock`-prefixed instruction whatever ordering you request — on x86 the ordering only changes what stores cost", "correct": true, "why": "`lock xaddl` is the same instruction for both. The one place seq_cst costs extra on x86 is a plain store, which becomes an `xchg`." },
    { "text": "The compiler ignores relaxed ordering", "why": "It does not — it changes what reordering is permitted around the operation, which can matter a great deal on other architectures." },
    { "text": "Relaxed ordering is only faster with more than four threads", "why": "The instruction is identical regardless of thread count." },
    { "text": "`std::atomic<long long>` is not lock-free", "why": "It is on any 64-bit platform, and `is_always_lock_free` confirms it." }
  ]
}
:::

:::quiz
{
  "question": "A thread writes a `std::string`, then does `ready.store(true, std::memory_order_release)`. Another spins on `ready.load(std::memory_order_acquire)` and then reads the string. Is that a data race?",
  "options": [
    { "text": "No — the release store and the acquire load establish happens-before, so the ordinary write is visible to the ordinary read", "correct": true, "why": "This is exactly what acquire-release is for: publishing non-atomic data through one atomic handshake. Everything written before the release is visible after a matching acquire." },
    { "text": "Yes, because `std::string` is not atomic", "why": "It does not need to be. The ordering on the flag creates the happens-before relationship that removes the race." },
    { "text": "No, but only because x86 does not reorder stores", "why": "It is guaranteed by the standard's model on every platform, not by the hardware being forgiving." },
    { "text": "Yes, unless the string is also `const`", "why": "Constness has nothing to do with the memory model; one thread does write it." }
  ]
}
:::

## Practice

:::exercise atomic-statistics

:::exercise publish-safely

:::recap
- `std::atomic<T>` makes each operation indivisible, so concurrent access is not
  a data race. `fetch_add` returns the *previous* value, which is what makes it
  a ticket dispenser.
- Only types up to the machine's word size are lock-free. Check with
  `is_always_lock_free`, and `static_assert` it when the design depends on it.
- The default, `seq_cst`, gives one total order every thread agrees on. Use it
  until a measurement says otherwise.
- Acquire-release is a handshake: a release store publishes everything written
  before it to any acquire load that reads that value. That is how non-atomic
  data is safely handed between threads.
- `relaxed` gives indivisibility and nothing else. It is right for counters
  nobody makes decisions from.
- On x86-64 the only ordering that costs an extra instruction is a `seq_cst`
  store. Do not conclude from that that orderings are free — on ARM they are
  not, and reasoning must be against the standard's model.
- A compare-exchange loop is the basis of lock-free code; `compare_exchange_weak`
  updates its first argument on failure and may fail spuriously.
- Reach for a mutex first. Lock-free is not wait-free, ABA is real, and the
  standard library still has no answer for memory reclamation.
:::
