---
id: publish-safely
title: "Handing data to another thread"
difficulty: stretch
chapter: atomics
topics: [atomics, memory-model, concurrency]
check: unit
standard: c++20
---

`Channel` lets one thread hand a batch of ordinary, non-atomic data to another:
the producer fills in the fields and sets a flag, the consumer spins on the flag
and then reads the fields.

As written, the flag is a plain `bool`. That is a data race on the flag, and —
worse — it establishes no ordering at all, so the consumer may see `ready == true`
while the payload it was supposed to publish is still unwritten.

Fix it with an acquire-release handshake. No mutex, and the payload fields stay
ordinary non-atomic types.

## Starter
```cpp
#include <atomic>
#include <cstddef>
#include <string>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

struct Channel {
    // Ordinary data. These must stay non-atomic.
    std::string label;
    std::vector<int> values;

    // The handshake.
    bool ready = false;

    void publish(std::string new_label, std::vector<int> new_values) {
        label = std::move(new_label);
        values = std::move(new_values);
        ready = true;
    }

    // Blocks until publish() has happened.
    void wait() const {
        while (!ready) std::this_thread::yield();
    }
};
```

## Tests
```cpp
// The flag has to be an atomic. A plain bool read and written by two threads
// is a data race whatever else the code does.
static_assert(std::is_same_v<decltype(Channel::ready), std::atomic<bool>>,
              "ready must be a std::atomic<bool>");
static_assert(std::atomic<bool>::is_always_lock_free);

// The payload stays ordinary — that is the point of the exercise.
static_assert(std::is_same_v<decltype(Channel::label), std::string>);
static_assert(std::is_same_v<decltype(Channel::values), std::vector<int>>);

// A fresh channel is not ready.
Channel fresh;
CHECK(!fresh.ready.load());

// Single-threaded: publish then wait returns immediately.
Channel direct;
direct.publish("solo", {9, 8, 7});
direct.wait();
CHECK_EQ(direct.label, std::string("solo"));
CHECK_EQ(direct.values.size(), std::size_t{3});
CHECK_EQ(direct.values[0], 9);
CHECK(direct.ready.load());

// Two hundred rounds of a real handover. If the ordering is wrong the consumer
// can return before the payload is written, and the contents will not match.
int completed = 0;
for (int round = 0; round < 200; ++round) {
    Channel channel;
    {
        std::jthread producer([&channel, round] {
            channel.publish("round-" + std::to_string(round), {round, round + 1, round + 2});
        });
        std::jthread consumer([&channel] { channel.wait(); });
    }
    if (channel.label == "round-" + std::to_string(round) &&
        channel.values.size() == 3 &&
        channel.values[0] == round &&
        channel.values[2] == round + 2) {
        ++completed;
    }
}
CHECK_EQ(completed, 200);
```

## Hints
- Change the member to `std::atomic<bool> ready{false};`. The `static_assert` in the checks is what enforces it.
- `publish` should write the payload first and then `ready.store(true, std::memory_order_release)`. The order of those lines is the whole mechanism.
- `wait` should spin on `ready.load(std::memory_order_acquire)`.
- The release store publishes *everything the thread wrote before it*. The acquire load, if it reads that value, sees all of it. That is what makes reading the plain `std::string` and `std::vector` afterwards not a data race.
- Do not use `memory_order_relaxed` here. It makes the flag itself race-free and promises nothing about the payload, which is the one thing you need.
- The default ordering, `seq_cst`, would also be correct — it is strictly stronger. Writing acquire and release says what the code actually needs.
- `std::atomic<bool>` is not copyable, so `Channel` is not either. Nothing in the checks copies one.

## Solution
```cpp
#include <atomic>
#include <cstddef>
#include <string>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

struct Channel {
    std::string label;
    std::vector<int> values;

    std::atomic<bool> ready{false};

    void publish(std::string new_label, std::vector<int> new_values) {
        label = std::move(new_label);
        values = std::move(new_values);
        // Everything written above is published by this store.
        ready.store(true, std::memory_order_release);
    }

    void wait() const {
        // Reading `true` from here guarantees the writes above are visible.
        while (!ready.load(std::memory_order_acquire)) std::this_thread::yield();
    }
};
```

## Notes
The surprising part of this exercise is that the payload does not need to be
atomic, and should not be. Making `label` a `std::atomic<std::string>` would not
even be lock-free, and would not fix anything: the problem was never that the
string was written unsafely, it was that the consumer had no guarantee about
*when* it could read it.

That guarantee is what release and acquire buy. A release store is a one-way
barrier: everything the thread wrote before it is guaranteed visible to any
thread that performs an acquire load on that same variable and reads the stored
value. The two operations form a handshake, and the payload rides along.

The two lines in `publish` are in that order for a reason, and swapping them
breaks everything. Store the flag first and the release barrier publishes
nothing useful — the payload writes come afterwards and are not covered.
"Publish last" is the rule, and it is the same rule as "fully construct the
object before making the pointer to it visible".

Three things the starter got wrong, only one of which is obvious:

- **The flag was a plain `bool` written by one thread and read by another** —
  a data race, so undefined behaviour, so the compiler is entitled to hoist the
  load out of the spin loop and turn `wait()` into an infinite loop. At `-O0`
  this happens to work; at `-O2` it may not, which is the worst possible way for
  a bug to behave.
- **Nothing ordered the payload writes against the flag write.** Even with an
  atomic flag, `relaxed` ordering would leave the consumer free to see `ready`
  as true and the string as empty.
- **The failure is invisible on x86.** As the chapter's assembly table showed,
  x86-64 stores are already release and loads are already acquire, so this code
  would very likely pass every test you ran on a laptop and fail on ARM. The
  checks here assert on the *type* precisely because behaviour cannot be relied
  on to catch it.

For a one-shot handover like this one, `std::latch` (C++20) does the same job
with less to get wrong, and a `std::promise`/`std::future` pair — the next
chapter — carries the value as well as the signal. Write the handshake by hand
once, to understand what those are doing, and then use them.
