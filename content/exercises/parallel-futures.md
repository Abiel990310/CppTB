---
id: parallel-futures
title: "Four tasks, four hundred milliseconds"
difficulty: core
chapter: futures-and-tasks
topics: [futures, async, concurrency]
check: unit
standard: c++20
---

`run_all` is supposed to run its jobs concurrently. It takes 400 ms to run four
100 ms jobs, which is exactly as long as doing them one at a time — because it
is doing them one at a time, for two separate reasons.

1. It launches with `std::launch::deferred`, so nothing runs until `get()` is
   called, and then it runs on the calling thread.
2. It calls `get()` inside the loop, so each job is collected before the next is
   started.

Fix both. The checks time it: four 100 ms jobs must complete in under 250 ms.

## Starter
```cpp
#include <chrono>
#include <future>
#include <thread>
#include <vector>

int slow_square(int n) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return n * n;
}

std::vector<int> run_all(const std::vector<int>& inputs) {
    std::vector<int> results;
    for (int value : inputs) {
        std::future<int> job = std::async(std::launch::deferred, slow_square, value);
        results.push_back(job.get());
    }
    return results;
}
```

## Tests
```cpp
// Results, in the order the inputs were given.
std::vector<int> results = run_all({2, 3, 4, 5});
CHECK_EQ(results.size(), std::size_t{4});
CHECK_EQ(results[0], 4);
CHECK_EQ(results[1], 9);
CHECK_EQ(results[2], 16);
CHECK_EQ(results[3], 25);

// And they have to actually overlap. Four 100 ms jobs, done in parallel,
// take a little over 100 ms; done one at a time they take 400.
auto start = std::chrono::steady_clock::now();
std::vector<int> timed = run_all({1, 2, 3, 4});
double elapsed = std::chrono::duration<double, std::milli>(
    std::chrono::steady_clock::now() - start).count();
CHECK_EQ(timed.size(), std::size_t{4});
CHECK(elapsed < 250.0);

// Edge cases.
CHECK(run_all({}).empty());
std::vector<int> single = run_all({7});
CHECK_EQ(single.size(), std::size_t{1});
CHECK_EQ(single[0], 49);

// Order must follow the input, not completion order.
std::vector<int> ordered = run_all({5, 1, 4, 2});
CHECK_EQ(ordered[0], 25);
CHECK_EQ(ordered[1], 1);
CHECK_EQ(ordered[2], 16);
CHECK_EQ(ordered[3], 4);
```

## Hints
- Two loops, not one. Launch everything first, then collect everything.
- Keep the futures: `std::vector<std::future<int>> jobs;` filled by the first loop, read by the second.
- Pass `std::launch::async` explicitly. The default policy is `async | deferred` and the implementation may choose either.
- `std::future` is move-only, so `push_back(std::async(...))` works (the temporary is moved) but you cannot copy one out of the vector. Iterate with `auto&`.
- Collecting in input order — `for (auto& job : jobs) results.push_back(job.get())` — is what keeps the results aligned with the inputs, even though the jobs finish in an arbitrary order.
- `reserve` on both vectors is free and avoids reallocating a vector of futures mid-flight.

## Solution
```cpp
#include <chrono>
#include <future>
#include <thread>
#include <vector>

int slow_square(int n) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return n * n;
}

std::vector<int> run_all(const std::vector<int>& inputs) {
    // Launch everything first: nothing is waited for in this loop.
    std::vector<std::future<int>> jobs;
    jobs.reserve(inputs.size());
    for (int value : inputs)
        jobs.push_back(std::async(std::launch::async, slow_square, value));

    // Then collect, in input order.
    std::vector<int> results;
    results.reserve(inputs.size());
    for (std::future<int>& job : jobs) results.push_back(job.get());
    return results;
}
```

## Notes
Measured: 402 ms for the starter, 103 ms for the fix.

The two-loop shape is the whole idea, and it is worth naming: **fan out, then
fan in.** Any `get()`, `join()`, or `wait()` inside the launching loop
serialises the work, because it blocks before the next task is created. The
mistake is easy to make because the single-loop version reads perfectly well —
launch a job, use its result, move on — and it is what you would write if the
call were synchronous.

The launch policy is the second half, and the more insidious one, because
removing the `get()` from the loop would not have fixed it on its own: with
`deferred`, all four jobs still run one after another in the collecting loop, on
the calling thread. The default policy is `async | deferred` and the standard
lets the implementation pick, so code that relies on getting `async` is code
that works on your machine.

Notice that the results come back in **input** order even though the jobs finish
in whatever order the scheduler produced. That falls out of collecting them in
the order they were launched: `jobs[2].get()` waits for the third job
specifically, however long it takes and whoever finished first. Getting ordered
results out of unordered work is free here, and it is a large part of why
futures are more pleasant than raw threads plus a shared output vector.

Two limits of this design, both real:

**It creates one thread per input.** Four is fine; forty thousand is not. This
shape is right when the number of tasks is small and bounded, and wants a pool
when it is not — the chapter's forty-line `Pool` is the same fan-out/fan-in
pattern with the thread count decoupled from the task count.

**The first `get()` that throws abandons the rest.** If job 0 throws, the loop
exits and jobs 1–3 are still running; their futures are destroyed during
unwinding, and `std::async`'s destructor blocks until each finishes. Correct,
but not obviously so. Collecting into a vector of `std::expected` or catching
per job is the fix when partial results matter.
