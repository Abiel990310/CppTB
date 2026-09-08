---
id: compile-time-hex
title: "Reject the bad literal at build time"
difficulty: stretch
chapter: constexpr
topics: [constexpr, compile-time, validation, strings]
check: unit
standard: c++20
---

`parse_hex` turns a string like `"#3b82f6"` into a packed `0x3b82f6`. As
written it can only run at run time, so a typo in a colour literal becomes a
thrown exception in production rather than a compiler error.

Make it usable in a constant expression, without giving up the run-time
behaviour: a bad literal known at compile time must fail the build, and a bad
string that only appears at run time must still throw `std::invalid_argument`.

One function, both jobs.

## Starter
```cpp
#include <cstdint>
#include <stdexcept>
#include <string_view>

int hex_digit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

std::uint32_t parse_hex(std::string_view text) {
    if (text.size() != 7 || text[0] != '#')
        throw std::invalid_argument("a colour literal must look like #rrggbb");

    std::uint32_t value = 0;
    for (char c : text.substr(1)) {
        int digit = hex_digit(c);
        if (digit < 0)
            throw std::invalid_argument("a colour literal must be hex digits");
        value = value * 16 + static_cast<std::uint32_t>(digit);
    }
    return value;
}
```

## Tests
```cpp
// Compile-time use. These do not compile unless parse_hex is a constant
// expression for these inputs.
constexpr std::uint32_t accent = parse_hex("#3b82f6");
constexpr std::uint32_t white  = parse_hex("#FFFFFF");
static_assert(accent == 0x3b82f6u);
static_assert(white == 0xffffffu);
static_assert(parse_hex("#000000") == 0u);

CHECK_EQ(accent, 0x3b82f6u);
CHECK_EQ(parse_hex("#0a0b0c"), 0x0a0b0cu);

// Run-time use with a bad string must still throw, not abort and not
// silently return a wrong number.
std::string typo = "#3b82fg";
bool threw_on_digit = false;
try { (void)parse_hex(typo); } catch (const std::invalid_argument&) { threw_on_digit = true; }
CHECK(threw_on_digit);

std::string too_short = "#abc";
bool threw_on_length = false;
try { (void)parse_hex(too_short); } catch (const std::invalid_argument&) { threw_on_length = true; }
CHECK(threw_on_length);

// And a valid run-time string still parses.
std::string ok = "#102030";
CHECK_EQ(parse_hex(ok), 0x102030u);
```

## Hints
- Both functions need `constexpr`, not just the one the checks name.
- A `throw` inside a `constexpr` function is allowed. It only matters if the throw is actually *reached* during constant evaluation.
- That is the whole trick: reaching a `throw` while the compiler is evaluating makes the expression not a constant expression, which is a compile error at the call site. The same `throw` at run time is an ordinary exception.
- `std::string_view`'s `size()`, `operator[]`, and `substr` are all `constexpr` already.
- You do not need `std::is_constant_evaluated()` here, and you should not reach for it — one body serves both environments.

## Solution
```cpp
#include <cstdint>
#include <stdexcept>
#include <string_view>

constexpr int hex_digit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

constexpr std::uint32_t parse_hex(std::string_view text) {
    if (text.size() != 7 || text[0] != '#')
        throw std::invalid_argument("a colour literal must look like #rrggbb");

    std::uint32_t value = 0;
    for (char c : text.substr(1)) {
        int digit = hex_digit(c);
        if (digit < 0)
            throw std::invalid_argument("a colour literal must be hex digits");
        value = value * 16 + static_cast<std::uint32_t>(digit);
    }
    return value;
}
```

## Notes
Two keywords, and the error-handling strategy changes meaning depending on who
is running the code. That is the part worth keeping.

During constant evaluation, throwing is not permitted, so an argument that
reaches a `throw` simply fails to be a constant expression. The compiler
reports it at the line that asked for the constant, and — on GCC and Clang —
names the `throw` that caused it. Nothing is thrown, because nothing runs.

At run time the same statement is an ordinary `throw` and the same function
behaves like any other validator.

If you want to *guarantee* the compile-time path rather than merely allow it,
declare `parse_hex` `consteval` instead. That rules out the run-time calls
entirely — which is right for a function that exists only to validate literals,
and wrong here, because the checks parse a `std::string` that is not known until
the program runs.
