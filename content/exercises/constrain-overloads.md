---
id: constrain-overloads
title: "Let the constraint choose"
difficulty: stretch
chapter: concepts
topics: [concepts, overloading, templates]
check: unit
standard: c++20
---

`render` should produce a different string depending on what it is given:

- an integral type → `"int:<value>"`
- a floating-point type → `"float:<value>"` with one decimal place
- anything with a `.size()` member → `"sized:<size>"`
- anything else → `"other"`

Write four overloads, constrained so the compiler selects the right one. Do not
use `if constexpr` or tag dispatch — the selection must come from the
constraints.

## Starter
```cpp
#include <concepts>
#include <string>

// Write the overloads here.
```

## Tests
```cpp
CHECK_EQ(render(42), std::string("int:42"));
CHECK_EQ(render(-7), std::string("int:-7"));
CHECK_EQ(render('a'), std::string("int:97"));

CHECK_EQ(render(2.5), std::string("float:2.5"));
CHECK_EQ(render(1.0f), std::string("float:1.0"));

CHECK_EQ(render(std::string("hello")), std::string("sized:5"));
CHECK_EQ(render(std::vector<int>{1, 2, 3}), std::string("sized:3"));
CHECK_EQ(render(std::vector<int>{}), std::string("sized:0"));

struct Opaque { int id; };
CHECK_EQ(render(Opaque{1}), std::string("other"));
CHECK_EQ(render(nullptr), std::string("other"));
```

## Hints
- Write a `HasSize` concept with a requires-expression: `{ t.size() } -> std::convertible_to<std::size_t>;`
- `std::integral` and `std::floating_point` come from `<concepts>`.
- Give **every** overload the same parameter form — `const T&` throughout — or they tie on conversion before constraints are considered and the call is ambiguous.
- For the one-decimal float, `std::format("{:.1f}", value)` is simplest; `<format>` provides it.
- `bool` and `char` are integral, which is why `render('a')` expects `"int:97"`.

## Solution
```cpp
#include <concepts>
#include <format>
#include <string>
#include <vector>

template <class T>
concept HasSize = requires(const T& t) {
    { t.size() } -> std::convertible_to<std::size_t>;
};

template <class T>
std::string render(const T&) { return "other"; }

template <HasSize T>
std::string render(const T& value) {
    return "sized:" + std::to_string(value.size());
}

template <std::integral T>
std::string render(const T& value) {
    return "int:" + std::to_string(static_cast<long long>(value));
}

template <std::floating_point T>
std::string render(const T& value) {
    return std::format("float:{:.1f}", value);
}
```

## Notes
The identical `const T&` parameter across all four overloads is not a style
choice, it is a requirement. Overload resolution compares conversion sequences
first and only consults constraints to break a tie among equally good
candidates. Give one overload a by-value parameter and the call becomes
ambiguous — with an error that says `call of overloaded 'render(int)' is
ambiguous` and never mentions concepts, which is a genuinely confusing half hour.

Note that `std::integral` and `HasSize` are unrelated concepts, and nothing
subsumes anything here. That is fine because no type satisfies both: an `int`
has no `.size()`, and a `std::vector` is not integral. Had a type satisfied
both, the call would be ambiguous and the fix would be to build one concept from
the other so subsumption has something to compare.

`render('a')` giving `"int:97"` is the `bool`-matches-`int` trap from Chapter 1.5
in another guise: `char` is an integral type, so it selects the integral
overload and `std::to_string` sees its numeric value. If you wanted characters
handled separately, that would be a fifth, more constrained overload —
`std::same_as<char>`.
