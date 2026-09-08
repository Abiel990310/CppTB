---
title: "Threads"
navTitle: "Threads"
summary: >-
  Starting work in parallel, and joining it back.
objectives:
  - Start and join a thread correctly
  - Explain what happens if a joinable thread is destroyed
  - Use jthread and stop tokens
status: complete
standard: c++20
requires: [translation-units]
---

A thread is a second place your program can be executing at once. On a machine
with more than one core that means real parallelism; on one core it means the
operating system slicing time between them. Either way, the moment you start one
you have given up the single most useful property your programs have had so far:
that statements happen in the order they are written.

This part of the book is about what you get in exchange and what it costs. This
chapter is only about starting a thread and getting it back — which sounds like
the easy part, and contains three ways to end your process.

```cpp run title="Four threads, and how many the machine has"
#include <cstdio>
#include <thread>
#include <vector>

int main() {
    std::printf("hardware_concurrency reports %u\n", std::thread::hardware_concurrency());

    std::vector<std::thread> workers;
    for (int i = 0; i < 4; ++i)
        workers.emplace_back([i] { std::printf("worker %d running\n", i); });

    for (std::thread& worker : workers) worker.join();

    std::printf("all four finished\n");
}
```

`std::thread`'s constructor takes anything callable and starts running it
immediately. `join()` blocks until that function returns. Between those two
lines, two things are happening at once and you cannot say which order the four
`printf` lines will come out in — run it a few times.

`hardware_concurrency()` is a *hint*: the number of threads that could genuinely
run at once. It is allowed to return 0 if the implementation cannot tell.

## A `std::thread` is a handle you must dispose of

`std::thread` owns an operating-system thread the way `unique_ptr` owns memory,
with one loud difference: its destructor does not clean up. Destroying a
`std::thread` that is still **joinable** — started and neither joined nor
detached — calls `std::terminate` and kills the process.

```cpp run expect-abort title="Forgetting to join is fatal, on purpose"
#include <cstdio>
#include <thread>

int main() {
    {
        std::thread worker([] { std::printf("worker running\n"); });
    }   // worker is destroyed here, still joinable

    std::printf("this line is never reached\n");
}
```

> terminate called without an active exception

:::history
This looks harsh, and it was argued about for years. The alternatives are worse.
Auto-joining in the destructor means an exception on the main path silently
blocks until an unrelated thread finishes — a deadlock with no obvious cause.
Auto-detaching means the thread keeps running with references to a stack frame
that has just been destroyed — undefined behaviour, appearing later, somewhere
else. Crashing immediately, at the line that made the mistake, is the only one
of the three you can debug.
:::

## `detach`, and why it is rarely what you want

The other way to dispose of a thread is to disown it:

```cpp run title="Detached work is not waited for"
#include <chrono>
#include <cstdio>
#include <thread>

int main() {
    std::thread([] {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        std::printf("detached thread finished\n");     // never printed
    }).detach();

    std::printf("main is done\n");
}
```

Only one line appears. `main` returns, the process exits, and the detached
thread is killed mid-sleep without ceremony. Nothing warns you.

Detaching also removes your last way of knowing when the thread is done, which
means you can no longer reason about the lifetime of anything it refers to. A
detached thread capturing a local by reference is a use-after-free the moment
its creator returns.

There are real uses — a genuinely fire-and-forget background task in a program
that runs forever — and they are rarer than the number of `detach()` calls in
the wild suggests.

## `std::jthread`: the one you should use

C++20 added `std::jthread`, which does the obvious thing: **j**oins in its
destructor.

```cpp run title="jthread joins itself"
#include <cstdio>
#include <thread>
#include <vector>

int main() {
    {
        std::vector<std::jthread> workers;
        for (int i = 0; i < 3; ++i)
            workers.emplace_back([i] { std::printf("worker %d running\n", i); });
    }   // every jthread joins here, in order

    std::printf("all joined, no terminate\n");
}
```

That is RAII applied to threads, and it is the same argument Chapter 3.2 made
about files and memory: the destructor is the only place cleanup happens
reliably, because it also happens when an exception unwinds past it.

**Prefer `std::jthread` to `std::thread` by default.** You still call `join()`
explicitly when you need the result before the end of the scope; the destructor
is there for every path where you do not.

## Stop tokens: asking a thread to finish

A joining destructor is only useful if the thread will actually finish. A worker
looping until told otherwise will block the destructor forever — so `jthread`
carries the other half: a cooperative cancellation channel.

```cpp run title="Cooperative cancellation"
#include <chrono>
#include <cstdio>
#include <stop_token>
#include <thread>

int main() {
    std::jthread worker([](std::stop_token stop) {
        int ticks = 0;
        while (!stop.stop_requested()) {
            ++ticks;
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
        std::printf("worker stopped after %d ticks\n", ticks);
    });

    std::this_thread::sleep_for(std::chrono::milliseconds(60));
    std::printf("main is requesting a stop\n");
    worker.request_stop();
}   // the destructor requests a stop too, then joins
```

If the callable's first parameter is a `std::stop_token`, `jthread` passes one
in. `request_stop()` sets the flag; the worker sees it on its next check and
returns. The destructor calls `request_stop()` before joining, so even the code
above would terminate correctly with the explicit call removed.

The word to hold on to is **cooperative**. Nothing interrupts the thread. If the
worker is blocked in a long `sleep_for`, or in a read from a socket, it will not
notice the request until it comes back and checks. There is no portable way to
kill a thread from outside, and every platform-specific one leaves locks held
and destructors unrun.

:::tip
For a thread blocked waiting on a condition variable, use
`std::condition_variable_any::wait` with a `stop_token` overload — it wakes on a
stop request as well as on a notification. Chapter 8.2 covers condition
variables.
:::

## Passing data in

`std::thread` and `std::jthread` **copy** their arguments into storage the new
thread owns, then invoke the callable with those copies as rvalues. That is
deliberate: the caller's stack frame may be gone by the time the thread runs.

The consequence is that passing a reference does not work by accident:

```cpp run expect-error title="A reference parameter is not deduced through"
#include <thread>

void bump(int& n) { ++n; }

int main() {
    int value = 0;
    std::thread t(bump, value);      // value is copied; the copy is an rvalue
    t.join();
    return value;
}
```

> static assertion failed: std::thread arguments must be invocable after
> conversion to rvalues

The fix is to say you meant it:

```cpp run title="std::ref passes a reference deliberately"
#include <cstdio>
#include <functional>
#include <thread>

void bump(int& n) { ++n; }

int main() {
    int value = 0;
    std::thread t(bump, std::ref(value));
    t.join();
    std::printf("value is now %d\n", value);
}
```

:::warning
`std::ref` hands the thread a reference to something the caller owns, so the
caller is now responsible for keeping it alive until the thread is finished.
With `join()` before the end of the scope, that is guaranteed. With `detach()`,
it is guaranteed to be wrong. The same applies to a lambda capturing by
reference — `[&]` on a thread that outlives its scope is a dangling reference,
and one of the most common bugs in threaded C++.
:::

## Two threads, one `std::cout`

```cpp run title="Why the output is shredded"
#include <iostream>
#include <thread>
#include <vector>

int main() {
    std::vector<std::jthread> workers;
    for (int i = 0; i < 4; ++i)
        workers.emplace_back([i] {
            for (int line = 0; line < 3; ++line)
                std::cout << "thread " << i << " line " << line << '\n';
        });
}
```

The output is interleaved mid-line — `thread thread 0 line 10 line 0`. This is
*not* a data race and not undefined behaviour: the standard stream objects are
synchronised, so concurrent writes do not corrupt anything. What is not
guaranteed is that a chain of `<<` operators stays together, because it is four
separate function calls with nothing holding a lock across them.

Two fixes. Build the whole line first and write it in one call:

```cpp
std::cout << ("thread " + std::to_string(i) + " line " + std::to_string(line) + "\n");
```

or use `std::printf`, which is required to be atomic per call — which is why
every other sample in this chapter uses it.

For anything more than diagnostics, log through one object that owns a mutex.
Chapter 8.2 is about how to build that correctly.

## How many threads?

Not one per task. Threads are not free: each gets a stack, typically 8 MB of
reserved address space, and switching between them costs the operating system
real work. A thousand threads on four cores spend most of their time being
scheduled.

The usual shape is a **pool**: `hardware_concurrency()` threads, fed a queue of
work items. Chapter 8.4 builds up to that with `std::async` and futures, and
explains why the standard library still has no thread pool of its own.

## Check yourself

:::quiz
{
  "question": "A function creates a `std::thread`, and then throws before reaching `join()`. What happens?",
  "options": [
    { "text": "The thread's destructor runs during unwinding, finds it still joinable, and calls `std::terminate`", "correct": true, "why": "This is exactly the case `std::jthread` exists for: its destructor requests a stop and joins, so the exception propagates normally." },
    { "text": "The thread is detached automatically and keeps running", "why": "That was considered and rejected — it leaves the thread holding references to a stack frame that is being destroyed." },
    { "text": "The exception propagates and the thread is joined automatically", "why": "`std::thread`'s destructor does not join. `std::jthread`'s does." },
    { "text": "The exception is delivered to the new thread", "why": "Exceptions do not cross threads. An exception escaping a thread's function calls `std::terminate` in that thread." }
  ]
}
:::

:::quiz
{
  "question": "A `jthread` worker loops on `while (!stop.stop_requested())` and calls `sleep_for(30s)` inside the loop. The destructor runs. When does the program continue?",
  "options": [
    { "text": "Up to 30 seconds later — cancellation is cooperative, and the thread cannot notice the request while it is asleep", "correct": true, "why": "`request_stop` sets a flag. Nothing interrupts a sleeping or blocked thread, which is why a worker should wait on something that can be woken by a stop request." },
    { "text": "Immediately; the destructor interrupts the sleep", "why": "There is no portable thread interruption in C++, and for good reason: it would leave locks held and destructors unrun." },
    { "text": "Immediately; `request_stop` throws inside the worker", "why": "It sets a flag. No exception is involved anywhere in the mechanism." },
    { "text": "Never — this deadlocks", "why": "It does finish, just slowly. The sleep ends, the loop checks the token, and the thread returns." }
  ]
}
:::

## Practice

:::exercise join-every-thread

:::exercise cooperative-worker

:::recap
- `std::thread` starts running immediately and must be joined or detached before
  it is destroyed. Destroying a joinable thread calls `std::terminate` —
  deliberately, because both alternatives fail silently instead.
- `detach` gives up all knowledge of when the thread finishes, so anything it
  refers to must outlive the process. A detached thread is killed at exit,
  mid-work, without notice.
- `std::jthread` joins in its destructor and is the right default. It also
  requests a stop first, so a cooperative worker shuts down cleanly.
- A `std::stop_token` is a flag the worker checks. Nothing interrupts a thread
  that is asleep or blocked; there is no portable way to kill one.
- Thread arguments are copied and passed as rvalues. Use `std::ref` for a
  genuine reference, and then make sure the referent outlives the thread.
- Concurrent `std::cout` is not a data race but does interleave mid-line.
  `std::printf` is atomic per call; anything more needs a mutex.
:::
