---
id: reserve-and-fill
title: "reserve is not resize"
difficulty: intro
chapter: sequence-containers
topics: [containers, vector]
check: unit
standard: c++20
---

`build_squares` should return a vector holding the squares of `0` to `n - 1`,
in order. It uses `resize` where it meant `reserve`, so the result begins with
`n` zeros and is twice as long as it should be.

Fix it, and keep the pre-allocation — the function should still make exactly one
allocation for a non-empty result.

## Starter
```cpp
#include <vector>

std::vector<int> build_squares(int n) {
    std::vector<int> squares;
    squares.resize(static_cast<std::size_t>(n));

    for (int i = 0; i < n; ++i) {
        squares.push_back(i * i);
    }
    return squares;
}
```

## Tests
```cpp
auto five = build_squares(5);
CHECK_EQ(five.size(), std::size_t{5});
CHECK_EQ(five[0], 0);
CHECK_EQ(five[1], 1);
CHECK_EQ(five[4], 16);

auto one = build_squares(1);
CHECK_EQ(one.size(), std::size_t{1});
CHECK_EQ(one[0], 0);

auto none = build_squares(0);
CHECK(none.empty());

auto big = build_squares(1000);
CHECK_EQ(big.size(), std::size_t{1000});
CHECK_EQ(big[999], 998001);

// One allocation: capacity is exactly what was asked for, never grown past it.
auto exact = build_squares(64);
CHECK_EQ(exact.size(), std::size_t{64});
CHECK_EQ(exact.capacity(), std::size_t{64});
```

## Hints
- `resize(n)` changes the *size*: it creates `n` value-initialised elements, which is where the leading zeros come from.
- `reserve(n)` changes only the *capacity*: room for `n` elements, but the vector stays empty.
- With `reserve`, the loop's `push_back` calls fill the vector without ever reallocating.
- The last check requires capacity to be exactly 64, so reserve with the right number and let push_back do the rest.

## Solution
```cpp
#include <vector>

std::vector<int> build_squares(int n) {
    std::vector<int> squares;
    squares.reserve(static_cast<std::size_t>(n));

    for (int i = 0; i < n; ++i) {
        squares.push_back(i * i);
    }
    return squares;
}
```

## Notes
The other way to write it is `resize(n)` with `squares[i] = i * i;` in the loop —
also correct, and it avoids the capacity check entirely. The version above is
generally preferred because it never constructs an element it is about to
overwrite, which matters when the element type is not a trivially-constructed
`int`.

The capacity check is deliberately strict. `reserve(64)` gives capacity exactly
64 and the 64 `push_back` calls fit without growing, so no reallocation happens.
Had you left the `resize` in and merely fixed the loop bounds, the capacity
would tell on you.
