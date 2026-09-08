---
id: optional-parse
title: "Absence with a reason"
difficulty: core
chapter: vocabulary-types
topics: [optional, api-design, error-handling]
check: unit
standard: c++20
---

`parse_age` returns `-1` when its input is not a valid age. That sentinel is
indistinguishable from a real answer in any code that forgets to check, and it
cannot represent *why* the input was rejected.

Change it to return `std::optional<int>`. An age is valid when the text parses
as an integer between 0 and 150 inclusive.

## Starter
```cpp
#include <optional>
#include <string>

int parse_age(const std::string& text) {
    try {
        const int value = std::stoi(text);
        if (value < 0 || value > 150) return -1;
        return value;
    } catch (const std::exception&) {
        return -1;
    }
}
```

## Tests
```cpp
CHECK(parse_age("30").has_value());
CHECK_EQ(parse_age("30").value(), 30);

CHECK(parse_age("0").has_value());
CHECK_EQ(parse_age("0").value(), 0);

CHECK(parse_age("150").has_value());
CHECK_EQ(parse_age("150").value(), 150);

CHECK(!parse_age("151").has_value());
CHECK(!parse_age("-1").has_value());
CHECK(!parse_age("abc").has_value());
CHECK(!parse_age("").has_value());

CHECK_EQ(parse_age("abc").value_or(18), 18);
CHECK_EQ(parse_age("42").value_or(18), 42);

// An out-of-range value must be rejected, not clamped.
CHECK(!parse_age("1000").has_value());
```

## Hints
- The return type becomes `std::optional<int>`; `return std::nullopt;` for the failure cases.
- Returning a plain `int` still works — it converts to a filled optional implicitly.
- `std::stoi` throws on unparseable input, so keep the try/catch and return nullopt from it.
- Nothing else changes. The validation logic is already correct.

## Solution
```cpp
#include <optional>
#include <string>

std::optional<int> parse_age(const std::string& text) {
    try {
        const int value = std::stoi(text);
        if (value < 0 || value > 150) return std::nullopt;
        return value;
    } catch (const std::exception&) {
        return std::nullopt;
    }
}
```

## Notes
The `parse_age("-1")` check is the one that matters. With the sentinel version
it is genuinely ambiguous: the function returns `-1` for the input `"-1"`, and
the caller cannot tell whether that means "the age is minus one, which we
rejected" or "parsing failed". Both are failures here, so the sentinel happens
to give the right *answer* — but for a function where negative values were
legal, it would not, and nothing about the signature would warn you.

`value_or` is what makes optional pleasant rather than ceremonial. Code that
would have been `int age = parse_age(s); if (age == -1) age = 18;` becomes
`int age = parse_age(s).value_or(18);` — shorter, and with no sentinel to
remember.

Note that `std::stoi` is doing something subtle: it parses a *leading* integer
and ignores trailing text, so `"30 years"` parses as 30. If that matters,
`std::from_chars` is the strict alternative and does not throw.
