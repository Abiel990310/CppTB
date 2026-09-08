---
id: stable-references
title: "The reference that goes stale"
difficulty: core
chapter: sequence-containers
topics: [containers, iterators, lifetime]
check: unit
standard: c++20
---

`running_max` walks a vector, remembering a reference to the largest element
seen so far, and appends a running total to the same vector as it goes. Because
it appends, the vector reallocates — and the remembered reference is left
pointing into a freed block.

Fix it so the function is correct for any input size. Do not change what it
returns or stop it appending; the appends are the point.

The checks run under AddressSanitizer, so reading through a stale reference
fails rather than silently returning a plausible number.

## Starter
```cpp
#include <vector>

int running_max(std::vector<int>& values) {
    if (values.empty()) return 0;

    const std::size_t original = values.size();
    int& best = values[0];

    for (std::size_t i = 1; i < original; ++i) {
        if (values[i] > best) best = values[i];
        values.push_back(values[i] + best);
    }
    return best;
}
```

## Tests
```cpp
{
    std::vector<int> v{3, 1, 4, 1, 5};
    CHECK_EQ(running_max(v), 5);
}
{
    std::vector<int> v{7};
    CHECK_EQ(running_max(v), 7);
}
{
    std::vector<int> v;
    CHECK_EQ(running_max(v), 0);
}
{
    std::vector<int> v{-5, -2, -9};
    CHECK_EQ(running_max(v), -2);
}
{
    // Large enough to force several reallocations.
    std::vector<int> v;
    for (int i = 0; i < 500; ++i) v.push_back(i);
    CHECK_EQ(running_max(v), 499);
}
{
    std::vector<int> v{1, 2, 3};
    running_max(v);
    CHECK(v.size() > std::size_t{3});   // the appends still happen
}
```

## Hints
- `int& best = values[0];` names a location inside the vector's buffer. `push_back` may move that buffer.
- An index survives reallocation; a reference does not. Track the best *value* or its index instead of a reference to it.
- The simplest fix is one word: make `best` an `int` rather than an `int&`.
- Be careful to keep the behaviour identical — `best` is read when computing the appended value, so it must be updated before the `push_back` as it was before.

## Solution
```cpp
#include <vector>

int running_max(std::vector<int>& values) {
    if (values.empty()) return 0;

    const std::size_t original = values.size();
    int best = values[0];               // a value, not a reference

    for (std::size_t i = 1; i < original; ++i) {
        if (values[i] > best) best = values[i];
        values.push_back(values[i] + best);
    }
    return best;
}
```

## Notes
The fix is a single character, which is the uncomfortable part: nothing about
the broken version *looks* wrong. `int&` reads as an efficiency-minded choice,
and for a container that is not being modified it would be a fine one.

Note that the small cases can pass even when broken. With three elements the
vector may have spare capacity and never reallocate, so the reference stays
valid by luck. The 500-element case is there to force several reallocations —
which is exactly how this bug behaves in production: fine in tests, wrong on
real data.

The general rule is in the chapter: do not hold a pointer, reference, or
iterator across an operation that can change the container's size. When you need
to remember a position, remember an index.
