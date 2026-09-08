---
id: read-the-warning
title: "Fix what the warnings found"
difficulty: intro
chapter: your-toolchain
topics: [toolchain, warnings, types]
check: unit
standard: c++20
---

`average_of_positives` compiles, and produces the wrong answer for two separate
reasons that `-Wall -Wextra` warns about:

- `count` is compared against `values.size()`, mixing a signed and an unsigned
  type (`-Wsign-compare`)
- `total` is never initialised before it is added to (`-Wmaybe-uninitialized`)

Fix both. The function should return the mean of the positive values, or 0.0
when there are none.

## Starter
```cpp
#include <vector>

double average_of_positives(const std::vector<int>& values) {
    int total;
    int count = 0;

    for (int i = 0; i < values.size(); ++i) {
        if (values[i] > 0) {
            total += values[i];
            ++count;
        }
    }

    if (count == 0) return 0.0;
    return static_cast<double>(total) / count;
}
```

## Tests
```cpp
CHECK_NEAR(average_of_positives({2, 4, 6}), 4.0, 1e-9);
CHECK_NEAR(average_of_positives({1, -5, 3}), 2.0, 1e-9);
CHECK_NEAR(average_of_positives({-1, -2}), 0.0, 1e-9);
CHECK_NEAR(average_of_positives({}), 0.0, 1e-9);
CHECK_NEAR(average_of_positives({0, 0, 5}), 5.0, 1e-9);
CHECK_NEAR(average_of_positives({7}), 7.0, 1e-9);

// A larger input, where an uninitialised accumulator shows up clearly.
std::vector<int> many(1000, 3);
CHECK_NEAR(average_of_positives(many), 3.0, 1e-9);
```

## Hints
- `int total;` starts with whatever bytes were at that address. `total += ...` reads it before anything wrote to it.
- Initialise it where it is declared: `int total = 0;`.
- `values.size()` is unsigned, so `i < values.size()` with `int i` mixes signedness — that is the `-Wsign-compare` warning.
- Declaring `i` as `std::size_t` fixes it, and a range-based `for` avoids the index entirely.

## Solution
```cpp
#include <vector>

double average_of_positives(const std::vector<int>& values) {
    int total = 0;
    int count = 0;

    for (int value : values) {
        if (value > 0) {
            total += value;
            ++count;
        }
    }

    if (count == 0) return 0.0;
    return static_cast<double>(total) / count;
}
```

## Notes
The uninitialised `total` is the dangerous one, and the reason is what Chapter
6.3 says about sanitizer coverage: **AddressSanitizer does not catch it.** The
bytes it reads are inside a live stack frame, so nothing at run time objects. On
many runs the value happens to be 0 and every check passes — which is why the
1000-element case is there, making a non-zero starting value show up as an
obviously wrong mean rather than a near-miss.

Your only warning is the compiler's, and only because the declaration and the
use sit in one function. That is the argument for `-Wall` in one example: it
finds a bug that no run-time tool in the toolbox will.

Rewriting the loop as a range-based `for` removes the signedness question rather
than answering it. Declaring `std::size_t i` also works; not having an index at
all is better, because there is then no comparison to get wrong.
