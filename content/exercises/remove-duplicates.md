---
id: remove-duplicates
title: "Remove the duplicates"
difficulty: core
chapter: algorithms
topics: [algorithms, containers]
check: unit
standard: c++20
---

`dedupe` should leave a vector holding each distinct value once, in ascending
order. It calls `std::unique`, which — like `std::remove` — does not remove
anything on its own, and it forgets to sort first, so it only collapses runs of
*adjacent* duplicates.

Fix both problems.

## Starter
```cpp
#include <algorithm>
#include <vector>

void dedupe(std::vector<int>& v) {
    std::unique(v.begin(), v.end());
}
```

## Tests
```cpp
{
    std::vector<int> v{3, 1, 3, 2, 1};
    dedupe(v);
    CHECK_EQ(v.size(), std::size_t{3});
    CHECK_EQ(v[0], 1);
    CHECK_EQ(v[1], 2);
    CHECK_EQ(v[2], 3);
}
{
    std::vector<int> v{5, 5, 5, 5};
    dedupe(v);
    CHECK_EQ(v.size(), std::size_t{1});
    CHECK_EQ(v[0], 5);
}
{
    std::vector<int> v{1, 2, 3};
    dedupe(v);
    CHECK_EQ(v.size(), std::size_t{3});
}
{
    std::vector<int> v;
    dedupe(v);
    CHECK(v.empty());
}
{
    std::vector<int> v{-2, 7, -2, 0, 7, 0};
    dedupe(v);
    CHECK_EQ(v.size(), std::size_t{3});
    CHECK_EQ(v[0], -2);
    CHECK_EQ(v[2], 7);
}
```

## Hints
- `std::unique` only collapses *adjacent* equal elements, so equal values must be brought together first — sort.
- Like `remove`, `unique` returns the new logical end. The container's size does not change until you erase.
- `v.erase(first, v.end())` is the two-argument overload. One argument erases a single element instead.
- `std::ranges::sort(v)` and `std::ranges::unique(v)` are the C++20 spellings; the latter returns a subrange.

## Solution
```cpp
#include <algorithm>
#include <vector>

void dedupe(std::vector<int>& v) {
    std::ranges::sort(v);
    const auto stale = std::ranges::unique(v);
    v.erase(stale.begin(), stale.end());
}
```

## Notes
The C++17 spelling is
`std::sort(v.begin(), v.end()); v.erase(std::unique(v.begin(), v.end()), v.end());`
and passes equally. The ranges version is shown because `std::ranges::unique`
returns a *subrange* covering the stale tail, which reads better than an
iterator whose meaning you have to remember — and it makes the one-argument
`erase` mistake harder to write.

Both duplicated-element cases matter. `{5,5,5,5}` checks that a run collapses to
one, and `{-2,7,-2,0,7,0}` checks that non-adjacent duplicates are caught, which
is what the missing sort broke.

If you only need distinct values and do not care about doing it in place,
`std::set<int> unique(v.begin(), v.end());` says the same thing in one line —
sorted and deduplicated by construction. Prefer that when the vector is not
needed afterwards.
