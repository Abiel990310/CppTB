---
id: erase-while-iterating
title: "Erase while iterating"
difficulty: core
chapter: iterators
topics: [iterators, containers, lifetime]
check: unit
standard: c++20
---

`drop_negatives` walks a vector and erases every negative element. It advances
the iterator on every pass *and* erases, so it invalidates the iterator it is
holding and skips elements besides.

Fix the loop. Do not use `std::erase_if` — the point is to get the manual
version right, since you will meet it in code you did not write.

## Starter
```cpp
#include <vector>

void drop_negatives(std::vector<int>& v) {
    for (auto it = v.begin(); it != v.end(); ++it) {
        if (*it < 0) {
            v.erase(it);
        }
    }
}
```

## Tests
```cpp
{
    std::vector<int> v{1, -2, 3, -4, 5};
    drop_negatives(v);
    CHECK_EQ(v.size(), std::size_t{3});
    CHECK_EQ(v[0], 1);
    CHECK_EQ(v[1], 3);
    CHECK_EQ(v[2], 5);
}
{
    // Consecutive negatives: the broken version skips the second of each pair.
    std::vector<int> v{-1, -2, -3, 4};
    drop_negatives(v);
    CHECK_EQ(v.size(), std::size_t{1});
    CHECK_EQ(v[0], 4);
}
{
    std::vector<int> v{-1, -2, -3};
    drop_negatives(v);
    CHECK(v.empty());
}
{
    std::vector<int> v{1, 2, 3};
    drop_negatives(v);
    CHECK_EQ(v.size(), std::size_t{3});
}
{
    std::vector<int> v;
    drop_negatives(v);
    CHECK(v.empty());
}
{
    std::vector<int> v{5, -1};
    drop_negatives(v);
    CHECK_EQ(v.size(), std::size_t{1});
    CHECK_EQ(v[0], 5);
}
```

## Hints
- `erase` invalidates the iterator you passed it — but it *returns* an iterator to the element that followed.
- Take the loop's `++it` out of the header entirely.
- Advance in exactly one branch: `it = v.erase(it)` when you removed something, `++it` when you did not.
- The consecutive-negatives case is what catches the version that erases and then also increments.

## Solution
```cpp
#include <vector>

void drop_negatives(std::vector<int>& v) {
    for (auto it = v.begin(); it != v.end(); ) {
        if (*it < 0) {
            it = v.erase(it);
        } else {
            ++it;
        }
    }
}
```

## Notes
The empty loop header — `for (init; condition; )` with nothing after the second
semicolon — is the signature of this pattern. If you see a loop that erases and
still increments in the header, it is wrong.

The `{-1, -2, -3, 4}` case is the one that separates a real fix from a lucky
one. A version that erases and then increments skips the element that shifted
into the erased slot, so it leaves `-2` behind; with the trailing `4` there is
still an element to reach `end()` on, so it does not crash — it just returns the
wrong answer. That is the failure mode to fear.

In real code, prefer `std::erase_if(v, [](int x) { return x < 0; })`. It is one
line, cannot be written wrongly, and for a vector it is also faster: the manual
loop moves the tail down on every erase, making it O(n²), while `erase_if` does
a single pass.
