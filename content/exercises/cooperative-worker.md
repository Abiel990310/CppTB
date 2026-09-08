---
id: cooperative-worker
title: "A worker that can be told to stop"
difficulty: core
chapter: threads
topics: [threads, concurrency, stop-token, jthread]
check: unit
standard: c++20
---

Two functions, and the second one hangs.

- `count_until_stopped(stop, limit)` — count up from zero, stopping either at
  `limit` or as soon as a stop is requested, whichever comes first. Return how
  far it got. The starter ignores the token entirely.
- `run_and_stop(limit)` — run that counter on a `std::jthread`, ask it to stop,
  wait for it, and return the count it reached. The starter uses a plain
  `std::thread` and never joins it.

The checks call `run_and_stop` with a limit of a billion. If the worker does not
notice the stop request, the program does not finish.

## Starter
```cpp
#include <stop_token>
#include <thread>

int count_until_stopped(std::stop_token stop, int limit) {
    int count = 0;
    while (count < limit) ++count;      // the token is never consulted
    return count;
}

int run_and_stop(int limit) {
    int result = -1;
    std::thread worker([&](std::stop_token stop) { result = count_until_stopped(stop, limit); });
    return result;
}
```

## Tests
```cpp
// A token whose stop has already been requested: nothing should be counted.
std::stop_source stopped;
stopped.request_stop();
CHECK_EQ(count_until_stopped(stopped.get_token(), 100), 0);

// A token that is never stopped: the limit is what ends the loop.
std::stop_source running;
CHECK_EQ(count_until_stopped(running.get_token(), 5), 5);
CHECK_EQ(count_until_stopped(running.get_token(), 0), 0);
CHECK_EQ(count_until_stopped(running.get_token(), 1000), 1000);

// The worker must stop when asked. With a limit of a billion, a worker that
// ignores the token never returns and this problem times out instead of
// failing — which is itself the lesson.
int reached = run_and_stop(1'000'000'000);
CHECK(reached >= 0);
CHECK(reached < 1'000'000'000);

// A small limit finishes on its own before any stop is needed.
CHECK_EQ(run_and_stop(0), 0);

// And it must actually have run: the result is never left at its initial -1.
CHECK(run_and_stop(10) >= 0);
CHECK(run_and_stop(10) <= 10);
```

## Hints
- The loop condition needs both halves: `while (count < limit && !stop.stop_requested())`.
- `stop.stop_requested()` returns `true` once anyone has called `request_stop()` on the matching `std::stop_source` — including a `jthread`'s own destructor.
- In `run_and_stop`, use `std::jthread`. Its destructor calls `request_stop()` and *then* joins, which is exactly the sequence you need.
- Give the `jthread` its own scope so the destructor runs before `return result;`. Otherwise you return the value before the worker has written it.
- A callable whose first parameter is a `std::stop_token` gets one passed in automatically by `jthread`. That is why the lambda's signature already takes one.
- You do not need to call `request_stop()` yourself — but doing so explicitly before the scope ends is clearer, and works the same.

## Solution
```cpp
#include <stop_token>
#include <thread>

int count_until_stopped(std::stop_token stop, int limit) {
    int count = 0;
    while (count < limit && !stop.stop_requested()) ++count;
    return count;
}

int run_and_stop(int limit) {
    int result = -1;
    {
        std::jthread worker([&](std::stop_token stop) {
            result = count_until_stopped(stop, limit);
        });
    }   // request_stop(), then join
    return result;
}
```

## Notes
`reached` is usually 0, sometimes a few million, and the test only asserts that
it is somewhere between zero and the limit. That range is the honest answer:
how far the worker gets before it sees the flag depends on how the operating
system schedules the two threads, and on this machine the destructor often
requests the stop before the worker has been given any time at all.

That non-determinism is the reason the check is a range rather than a number,
and it is worth internalising early. A test over threaded code that asserts an
exact interleaving is a test that will fail on someone else's machine, or on
yours next Tuesday. Assert the invariants — it stopped, it stopped in bounds, it
did not hang — and nothing more.

The mechanism is a flag and nothing else. `request_stop()` sets it;
`stop_requested()` reads it. There is no interruption, no exception, no signal.
A worker that never checks simply never stops, which is why the starter turns a
one-second test into a timeout: `std::jthread`'s destructor would join a thread
that has a billion iterations left to run.

Which leads to the practical rule. A cooperative worker must check the token
**often enough**, and must not block for long between checks. A loop over items
should check once per item. A worker that waits on a condition variable should
use the `std::condition_variable_any::wait` overload that takes a stop token, so
a stop request wakes it. A worker that calls `sleep_for(30s)` will take up to
thirty seconds to shut down, and a worker blocked on a socket read may never
shut down at all — which is why long blocking calls in cancellable threads want
a timeout, not patience.

The starter's `std::thread` has a second problem the fix removes on the way
past: it is never joined, so its destructor would call `std::terminate` — and it
would do so *after* `return result;` had already returned `-1`, since nothing
was waiting for the worker.
