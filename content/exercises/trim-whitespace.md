---
id: trim-whitespace
title: "Trim without copying"
difficulty: core
chapter: strings
topics: [strings, string_view, lifetime]
check: unit
standard: c++20
---

Write `trim`, which removes leading and trailing whitespace from a
`std::string_view` and returns a view of what is left. No allocation, no copy —
the result must point into the same bytes as the input.

Whitespace is space, tab, newline, and carriage return. A view that is entirely
whitespace trims to an empty view.

## Starter
```cpp
#include <string_view>

std::string_view trim(std::string_view text) {
    return text;
}
```

## Tests
```cpp
CHECK_EQ(trim("  hello  "), std::string_view("hello"));
CHECK_EQ(trim("hello"), std::string_view("hello"));
CHECK_EQ(trim("   "), std::string_view(""));
CHECK_EQ(trim(""), std::string_view(""));
CHECK_EQ(trim("\t\n mixed \r\n"), std::string_view("mixed"));
CHECK_EQ(trim("  a"), std::string_view("a"));
CHECK_EQ(trim("a  "), std::string_view("a"));
CHECK_EQ(trim(" one two "), std::string_view("one two"));

// The result must be a view INTO the input, not a copy of it.
std::string owner = "  borrowed  ";
std::string_view result = trim(owner);
CHECK(result.data() >= owner.data());
CHECK(result.data() + result.size() <= owner.data() + owner.size());
CHECK_EQ(result, std::string_view("borrowed"));
```

## Hints
- `find_first_not_of(" \t\n\r")` gives the index of the first non-whitespace character, or `npos` if there is none.
- `find_last_not_of` does the same from the other end.
- If the first search returns `npos`, everything is whitespace — return an empty view.
- `remove_prefix(n)` and `remove_suffix(n)` adjust a view in place, which is another way to write it.

## Solution
```cpp
#include <string_view>

std::string_view trim(std::string_view text) {
    constexpr std::string_view spaces = " \t\n\r";

    const std::size_t first = text.find_first_not_of(spaces);
    if (first == std::string_view::npos) return {};

    const std::size_t last = text.find_last_not_of(spaces);
    return text.substr(first, last - first + 1);
}
```

## Notes
The last three checks are the ones that make this a `string_view` exercise
rather than a string exercise. They confirm the returned bytes lie inside the
caller's buffer — an implementation that built a `std::string` and returned a
view of it would pass the equality checks and then dangle, which is exactly the
bug the chapter warns about.

Because `trim` only ever narrows its argument, it is safe: the result cannot
outlive the input, since it *is* the input. That is the shape to aim for when
writing functions that return views.
