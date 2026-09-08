---
id: safe-loop-bounds
title: "The loop that runs forever"
difficulty: core
chapter: values-and-types
topics: [types, loops, containers]
check: unit
standard: c++20
---

`last_element` returns the final element of a vector, or `0` when the vector is
empty. It is written with unsigned arithmetic that goes badly wrong on an empty
vector — `v.size() - 1` does not produce `-1`.

Fix it. The checks include the empty case, and the whole thing runs under
AddressSanitizer, so reading out of bounds fails loudly rather than silently.

## Starter
```cpp
#include <vector>

int last_element(const std::vector<int>& v) {
    return v[v.size() - 1];
}
```

## Tests
```cpp
CHECK_EQ(last_element({1, 2, 3}), 3);
CHECK_EQ(last_element({42}), 42);
CHECK_EQ(last_element({}), 0);
CHECK_EQ(last_element({-1, -2}), -2);
```

## Hints
- `v.size()` is unsigned. When the vector is empty, `v.size() - 1` is about 18 quintillion, not -1.
- Handle the empty case before doing any arithmetic on `size()`.
- `v.back()` gives the last element directly — but it too is undefined on an empty vector.

## Solution
```cpp
#include <vector>

int last_element(const std::vector<int>& v) {
    if (v.empty()) return 0;
    return v.back();
}
```

## Notes
Two separate lessons meet here. The unsigned wraparound is why the empty case
misbehaves so spectacularly instead of merely returning garbage — the index is
enormous, so the read is far outside the allocation.

`v.empty()` is preferred over `v.size() == 0` because it is unambiguous for every
container, including ones where computing the size is not free.
