---
id: erase-evens
title: "Erase without invalidating"
difficulty: core
chapter: algorithms
topics: [containers, algorithms, iterators]
check: unit
standard: c++20
---

Write `erase_evens`, which removes every even number from a `std::vector<int>`
while keeping the odd ones in their original order.

The obvious loop — iterate and call `erase` — invalidates the iterator you are
holding. Use an approach that does not.

## Starter
```cpp
#include <vector>

void erase_evens(std::vector<int>& v) {
}
```

## Tests
```cpp
std::vector<int> v{1, 2, 3, 4, 5, 6};
erase_evens(v);
CHECK_EQ(v.size(), std::size_t{3});
CHECK_EQ(v[0], 1);
CHECK_EQ(v[1], 3);
CHECK_EQ(v[2], 5);

std::vector<int> all_even{2, 4, 6};
erase_evens(all_even);
CHECK(all_even.empty());

std::vector<int> none{1, 3};
erase_evens(none);
CHECK_EQ(none.size(), std::size_t{2});

std::vector<int> empty;
erase_evens(empty);
CHECK(empty.empty());
```

## Hints
- `std::erase_if(v, predicate)` does the whole job in C++20. Try it first, then try it the hard way.
- The classic version is the erase-remove idiom: `v.erase(std::remove_if(v.begin(), v.end(), pred), v.end());`
- `std::remove_if` does not remove anything. It shuffles the survivors to the front and returns where the new end is.

## Solution
```cpp
#include <vector>
#include <algorithm>

void erase_evens(std::vector<int>& v) {
    std::erase_if(v, [](int n) { return n % 2 == 0; });
}
```

## Notes
`std::erase_if` arrived in C++20 precisely because the erase-remove idiom was
easy to get half-right. The half that people forgot was the second argument to
`erase`: without it you delete a single element instead of the whole tail, and
the vector quietly keeps stale values.
