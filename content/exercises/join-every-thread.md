---
id: join-every-thread
title: "Five threads, none of them joined"
difficulty: core
chapter: threads
topics: [threads, concurrency, raii, lifetime]
check: unit
standard: c++20
---

`parallel_map` starts one thread per input and never keeps any of them. Each
`std::thread` is a temporary, destroyed at the end of its own statement while
still joinable — so the program calls `std::terminate` before it computes
anything.

Fix it. Keep the shape — one thread per input, each writing its own slot — and
make sure every thread is joined before the results are returned.

There is a second bug hiding behind the first. The lambda captures everything by
reference, including the loop counter `i`, which changes while the threads are
running.

## Starter
```cpp
#include <cstddef>
#include <thread>
#include <vector>

// Given: stands in for work worth parallelising.
long long transform(int n) {
    long long total = 0;
    for (int i = 0; i < 200; ++i) total += n * i;
    return total;
}

std::vector<long long> parallel_map(const std::vector<int>& inputs) {
    std::vector<long long> results(inputs.size());

    for (std::size_t i = 0; i < inputs.size(); ++i)
        std::thread([&] { results[i] = transform(inputs[i]); });

    return results;
}
```

## Tests
```cpp
std::vector<long long> results = parallel_map({1, 2, 3, 4, 5});
CHECK_EQ(results.size(), std::size_t{5});
CHECK_EQ(results[0], 19900LL);
CHECK_EQ(results[1], 39800LL);
CHECK_EQ(results[2], 59700LL);
CHECK_EQ(results[3], 79600LL);
CHECK_EQ(results[4], 99500LL);

// Every slot must be written — a result of 0 means a thread never ran, or ran
// after the vector was returned.
std::vector<long long> bigger = parallel_map({7, 7, 7, 7, 7, 7, 7, 7});
CHECK_EQ(bigger.size(), std::size_t{8});
for (long long value : bigger) CHECK_EQ(value, 139300LL);

// Empty input starts no threads and returns nothing.
CHECK(parallel_map({}).empty());

// A single input still works.
std::vector<long long> one = parallel_map({10});
CHECK_EQ(one.size(), std::size_t{1});
CHECK_EQ(one[0], 199000LL);
```

## Hints
- `std::thread(...)` on its own line creates a temporary that is destroyed immediately. Since it is still joinable at that point, the destructor calls `std::terminate`.
- Keep the threads: collect them in a `std::vector<std::jthread>` and let the vector's destructor join them all.
- `std::vector<std::jthread>` needs `emplace_back`, not `push_back` with a temporary — although both work here, `emplace_back` constructs in place.
- `reserve(inputs.size())` before the loop avoids reallocating a vector of running threads.
- The join must happen **before** `return results;`. Put the vector of threads in its own inner scope, or call `join()` on each in a second loop.
- `[&]` captures `i` by reference, and `i` keeps incrementing while the threads run. Capture it by value: `[&results, &inputs, i]`.
- Nothing here needs a mutex. Each thread writes to a different element of `results`, and `results` itself is never resized while they run — so no two threads ever touch the same memory.

## Solution
```cpp
#include <cstddef>
#include <thread>
#include <vector>

long long transform(int n) {
    long long total = 0;
    for (int i = 0; i < 200; ++i) total += n * i;
    return total;
}

std::vector<long long> parallel_map(const std::vector<int>& inputs) {
    std::vector<long long> results(inputs.size());

    {
        std::vector<std::jthread> workers;
        workers.reserve(inputs.size());
        for (std::size_t i = 0; i < inputs.size(); ++i)
            workers.emplace_back([&results, &inputs, i] { results[i] = transform(inputs[i]); });
    }   // every jthread joins here

    return results;
}
```

## Notes
Two bugs, and only one of them announces itself.

The first is loud: `std::thread(...)` as a statement creates a temporary that is
destroyed at the semicolon, still joinable, and `std::thread`'s destructor calls
`std::terminate`. The program dies before printing anything. That is the
standard doing you a favour — the alternatives were a silent detach or a silent
deadlock.

The second is silent. `[&]` captures `i` by reference, and `i` is the loop
counter, which the loop keeps incrementing while the threads run. Every thread
reads whatever `i` happens to be when it gets there, so several threads write
the same slot and others are never written — and it is also a genuine data race
on `i`, since the loop writes it while the threads read it. Capturing `i` by
value gives each thread its own copy of the index, fixed at the moment the
thread was created.

The inner scope is doing real work. Without it, `return results;` would run
while the threads were still writing into `results`, and the vector would be
copied out from under them. With it, the `std::vector<std::jthread>` destructor
joins every worker before control reaches the `return`.

Worth noticing what is *not* needed: no mutex, no atomics, no synchronisation of
any kind. Each thread writes to `results[i]` for a distinct `i`, and the vector
never reallocates, so no two threads ever touch the same bytes. Concurrent
writes to *different* elements of the same container are not a data race. This
is the cheapest kind of parallelism there is, and when a problem has this shape
you should take it — the next chapter is about what to do when it does not.
