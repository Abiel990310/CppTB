---
id: find-the-ub
title: "Four bugs, one function"
difficulty: stretch
chapter: undefined-behaviour
topics: [undefined-behaviour, pointers, lifetime]
check: unit
standard: c++20
---

`summarise` contains four distinct pieces of undefined behaviour. Find and fix
all of them without changing what the function is meant to do: return the sum of
the first `count` elements, and report the largest through `out_max`.

The checks run under AddressSanitizer and UndefinedBehaviorSanitizer, so most of
the bugs will announce themselves — but not all of them, which is the lesson.

## Starter
```cpp
#include <vector>

int summarise(const std::vector<int>& values, int count, int* out_max) {
    int total;                                   // (1)
    int largest = values[0];                     // (2)

    for (int i = 0; i <= count; ++i) {           // (3)
        total += values[i];
        if (values[i] > largest) largest = values[i];
    }

    *out_max = largest;                          // (4)
    return total;
}
```

## Tests
```cpp
{
    std::vector<int> v{3, 1, 4, 1, 5};
    int max = 0;
    CHECK_EQ(summarise(v, 5, &max), 14);
    CHECK_EQ(max, 5);
}
{
    std::vector<int> v{7};
    int max = 0;
    CHECK_EQ(summarise(v, 1, &max), 7);
    CHECK_EQ(max, 7);
}
{
    // Fewer than all the elements.
    std::vector<int> v{1, 2, 3, 4};
    int max = 0;
    CHECK_EQ(summarise(v, 2, &max), 3);
    CHECK_EQ(max, 2);
}
{
    // An empty range must not read anything.
    std::vector<int> v;
    int max = -1;
    CHECK_EQ(summarise(v, 0, &max), 0);
    CHECK_EQ(max, -1);
}
{
    // A caller that does not want the maximum.
    std::vector<int> v{2, 9, 4};
    CHECK_EQ(summarise(v, 3, nullptr), 15);
}
{
    std::vector<int> v{-5, -2, -9};
    int max = 0;
    CHECK_EQ(summarise(v, 3, &max), -16);
    CHECK_EQ(max, -2);
}
```

## Hints
- **(1)** `total` is never initialised, and `+=` reads it before anything is written. No sanitizer will tell you — this is the one you must spot by reading.
- **(2)** `values[0]` reads the first element before checking there is one. The empty case makes it a buffer overflow.
- **(3)** `i <= count` reads one element past the range every call.
- **(4)** `out_max` may be null; the last-but-one check passes `nullptr` deliberately.
- For the empty case, the sum is 0 and `out_max` must be left alone — the check starts it at −1 and expects −1 back.

## Solution
```cpp
#include <vector>

int summarise(const std::vector<int>& values, int count, int* out_max) {
    int total = 0;
    if (count <= 0 || values.empty()) return 0;

    int largest = values[0];

    for (int i = 0; i < count; ++i) {
        total += values[i];
        if (values[i] > largest) largest = values[i];
    }

    if (out_max != nullptr) *out_max = largest;
    return total;
}
```

## Notes
Three of the four announce themselves. The out-of-bounds read, the empty-vector
read, and the null write are all caught the moment a check exercises them —
which is what the sanitizers are for.

The uninitialised `total` is the one to remember. It is undefined behaviour of
exactly the same severity, and **nothing reports it**: ASan tracks memory that
is out of bounds or freed, and `total` is neither. On a given run it may hold
zero and every check may pass. Only `-Wall`'s `-Wmaybe-uninitialized` has a
chance, and only because the declaration and the use are in one function.

That asymmetry is the point of the exercise. A green sanitizer run means "none
of the instrumented categories fired on the paths you ran" — not "this code is
correct".

Note also that the empty case is handled by returning early rather than by
guarding each read. Establishing the precondition once, at the top, is easier to
verify than three separate checks that must all agree.
