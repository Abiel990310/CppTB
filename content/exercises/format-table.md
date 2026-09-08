---
id: format-table
title: "Line up the columns"
difficulty: intro
chapter: io-and-formatting
topics: [format, strings, io]
check: unit
standard: c++20
---

`format_row` builds one row of a table. It uses string concatenation, so nothing
lines up: names of different lengths push the numbers around.

Rewrite it with `std::format` so that every row is exactly the same shape:

- the name left-aligned in a field of 10
- one space
- the score right-aligned in a field of 5
- one space
- the ratio with exactly two decimal places, right-aligned in a field of 7

## Starter
```cpp
#include <string>

std::string format_row(const std::string& name, int score, double ratio) {
    return name + " " + std::to_string(score) + " " + std::to_string(ratio);
}
```

## Tests
```cpp
CHECK_EQ(format_row("ada", 90, 0.5),
         std::string("ada           90    0.50"));

CHECK_EQ(format_row("bartholomew", 5, 12.3456),
         std::string("bartholomew     5   12.35"));

CHECK_EQ(format_row("x", 100, 0.0),
         std::string("x            100    0.00"));

// Every row of equal-or-shorter names has the same length.
const auto a = format_row("ada", 1, 1.0);
const auto b = format_row("grace", 22, 33.5);
CHECK_EQ(a.size(), b.size());
CHECK_EQ(a.size(), std::size_t{24});
```

## Hints
- `{:<10}` is left-aligned in a field of 10; `{:>5}` is right-aligned in 5.
- `{:>7.2f}` gives two decimal places, right-aligned in a field of 7.
- The three fields are separated by a single literal space each.
- A name longer than the field is not truncated — the field grows, which is why the second case is wider.

## Solution
```cpp
#include <format>
#include <string>

std::string format_row(const std::string& name, int score, double ratio) {
    return std::format("{:<10} {:>5} {:>7.2f}", name, score, ratio);
}
```

## Notes
`std::to_string(0.5)` produces `"0.500000"` — six decimal places, always. That
is the immediate reason the starter is wrong, and it has no parameter to fix it;
controlling precision means `std::format`, a stream manipulator, or `printf`.

The `"bartholomew"` case shows what a width specifier does and does not promise.
It is a *minimum*: an eleven-character name in a field of ten produces eleven
characters and shifts the rest of the row. Formatting never truncates silently,
which is the right default — a truncated identifier is worse than a misaligned
one. If you need a hard maximum, `{:<10.10}` sets both.
