---
id: constexpr-sieve
title: "A table built before the program starts"
difficulty: core
chapter: constexpr
topics: [constexpr, compile-time, arrays]
check: unit
standard: c++20
---

`digit_sum_table()` should return a lookup table where entry `i` holds the sum
of the decimal digits of `i`, for `i` in `[0, 256)`. It works — but it works at
run time, which means every program that uses it pays for 256 iterations at
startup and nothing checks the table before shipping.

Make it a compile-time computation. The checks initialise `constexpr`
variables from it, so a version that can only run at run time will not compile
at all.

You may allocate inside the function; you may not return anything that owns
memory.

## Starter
```cpp
#include <array>
#include <cstddef>
#include <vector>

int digit_sum(int n) {
    int total = 0;
    while (n > 0) {
        total += n % 10;
        n /= 10;
    }
    return total;
}

std::array<int, 256> digit_sum_table() {
    std::array<int, 256> table{};
    for (std::size_t i = 0; i < table.size(); ++i)
        table[i] = digit_sum(static_cast<int>(i));
    return table;
}

// Returns how many entries in the table equal `target`.
int count_with_digit_sum(int target) {
    std::vector<int> matches;
    auto table = digit_sum_table();
    for (int value : table)
        if (value == target) matches.push_back(value);
    return static_cast<int>(matches.size());
}
```

## Tests
```cpp
// Each of these forces evaluation in the compiler. If any function below is
// not usable in a constant expression, this file does not compile.
constexpr auto table = digit_sum_table();
static_assert(table[0] == 0);
static_assert(table[9] == 9);
static_assert(table[10] == 1);
static_assert(table[255] == 12);

constexpr int nines = count_with_digit_sum(9);
static_assert(nines > 0);

CHECK_EQ(table[199], 19);
CHECK_EQ(table.size(), std::size_t{256});
CHECK_EQ(nines, 25);

// Still perfectly usable at run time, with a value the compiler cannot know.
int runtime_target = 1;
CHECK_EQ(count_with_digit_sum(runtime_target), 3);
```

## Hints
- Every function reachable from a constant expression must itself be `constexpr`. There are three of them here, not one.
- A `constexpr` function may loop, mutate its locals, and allocate — the C++11 "single return statement" rule is long gone.
- `std::vector` is usable inside a constant evaluation in C++20, as long as it is destroyed before the evaluation finishes. `count_with_digit_sum` returns an `int`, so its vector dies in time.
- `std::array::size()` and `operator[]` are already `constexpr`; you do not need to change how the table is indexed.
- Marking a function `constexpr` does not stop it working at run time. The last check calls the same function with a value the compiler cannot see.

## Solution
```cpp
#include <array>
#include <cstddef>
#include <vector>

constexpr int digit_sum(int n) {
    int total = 0;
    while (n > 0) {
        total += n % 10;
        n /= 10;
    }
    return total;
}

constexpr std::array<int, 256> digit_sum_table() {
    std::array<int, 256> table{};
    for (std::size_t i = 0; i < table.size(); ++i)
        table[i] = digit_sum(static_cast<int>(i));
    return table;
}

constexpr int count_with_digit_sum(int target) {
    std::vector<int> matches;
    auto table = digit_sum_table();
    for (int value : table)
        if (value == target) matches.push_back(value);
    return static_cast<int>(matches.size());
}
```

## Notes
Three keywords, no other change. That is the usual shape of this refactor: the
body of a modern `constexpr` function looks exactly like the body of an ordinary
one, because since C++20 almost everything is allowed.

Note what `count_with_digit_sum` gets away with. It builds a `std::vector`, and
the compiler runs the allocation, the pushes, and the deallocation. That is
legal because the vector is gone by the time the function returns — only an
`int` escapes. Try returning the `matches` vector itself and the constant
initialisation fails with a message about `operator new`: the compiler's heap
does not survive into the running program, so no pointer into it may.

The run-time call at the end is the other half of the lesson. `constexpr` is
permission, not obligation; adding it took nothing away.
