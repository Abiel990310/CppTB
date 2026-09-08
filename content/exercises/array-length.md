---
id: array-length
title: "Keep the length"
difficulty: core
chapter: arrays-and-decay
topics: [arrays, templates, decay]
check: unit
standard: c++20
---

`count_positive` is supposed to count the positive numbers in an array, but it
computes the length with `sizeof(values) / sizeof(values[0])` inside a function
— where `values` has already decayed to a pointer. It therefore always inspects
exactly two elements, whatever it was given.

Fix it so it counts every element, for arrays of any length, **without adding a
length parameter**. The checks call it with three different array sizes.

## Starter
```cpp
#include <cstddef>

int count_positive(const int values[]) {
    std::size_t n = sizeof(values) / sizeof(values[0]);
    int found = 0;
    for (std::size_t i = 0; i < n; ++i) {
        if (values[i] > 0) ++found;
    }
    return found;
}
```

## Tests
```cpp
int three[] = {1, -2, 3};
int five[]  = {-1, -2, -3, -4, -5};
int mixed[] = {5, 0, -1, 2, 8, -7, 4};
int one[]   = {42};

CHECK_EQ(count_positive(three), 2);
CHECK_EQ(count_positive(five), 0);
CHECK_EQ(count_positive(mixed), 4);
CHECK_EQ(count_positive(one), 1);
```

## Hints
- A parameter written `const int values[]` is really `const int*`. The length is already gone by the time the function body runs.
- Binding to a *reference to array* preserves the type, and with it the length.
- `template <std::size_t N> int count_positive(const int (&values)[N])` lets the compiler deduce N at each call site.
- With the length preserved, a range-based for loop knows where to stop on its own.

## Solution
```cpp
#include <cstddef>

template <std::size_t N>
int count_positive(const int (&values)[N]) {
    int found = 0;
    for (int v : values) {
        if (v > 0) ++found;
    }
    return found;
}
```

## Notes
The compiler stamps out one function per distinct array length — four of them
here. That is the trade: no run-time cost and no chance of a wrong length, at
the price of some code duplication.

Note that `0` is not positive, which is why `mixed` expects 4 and not 5.

The checks use four different lengths for a reason. The broken starter inspects
exactly two elements, so it returns the *correct* answer for `five` — every
element is negative, so two negatives and five negatives both give 0. A single
test case can easily be one the bug happens to survive. On `one` it is worse
than wrong: it reads `values[1]` past the end of a one-element array, which
AddressSanitizer reports as a buffer overflow.
