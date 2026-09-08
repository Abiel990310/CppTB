---
id: compare-versions
title: "Is this version good enough?"
difficulty: core
chapter: dependencies
topics: [strings, parsing, comparison, tooling]
check: unit
standard: c++20
---

Every package manager has to answer the same three questions about a version
string. Implement them.

- `parse(text)` — turn `"1.2.3"` into a `Version`, or return `std::nullopt` if
  it is not exactly three non-negative integers separated by dots. No leading
  `v`, no pre-release suffixes, no empty components.
- `operator<=>` on `Version` — order by major, then minor, then patch.
- `compatible(installed, required)` — whether `installed` may be used where
  `required` was asked for, under semantic versioning: the major versions must
  match and `installed` must be at least `required`. Below 1.0, every minor
  version is treated as a breaking change, so the minor must match too.

## Starter
```cpp
#include <compare>
#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

struct Version {
    int major = 0;
    int minor = 0;
    int patch = 0;

    // TODO: order by major, then minor, then patch.
    std::strong_ordering operator<=>(const Version&) const { return std::strong_ordering::equal; }
    bool operator==(const Version&) const = default;
};

std::optional<Version> parse(std::string_view text) {
    return std::nullopt;
}

bool compatible(Version installed, Version required) {
    return true;
}
```

## Tests
```cpp
// parse: the happy path
std::optional<Version> v = parse("1.2.3");
CHECK(v.has_value());
CHECK_EQ(v->major, 1);
CHECK_EQ(v->minor, 2);
CHECK_EQ(v->patch, 3);

CHECK(parse("0.0.0").has_value());
CHECK_EQ(parse("10.20.30")->minor, 20);
CHECK_EQ(parse("2.4.11")->patch, 11);

// parse: everything that is not three numbers separated by two dots
CHECK(!parse("").has_value());
CHECK(!parse("1").has_value());
CHECK(!parse("1.2").has_value());
CHECK(!parse("1.2.3.4").has_value());
CHECK(!parse("v1.2.3").has_value());          // no leading v
CHECK(!parse("1.2.x").has_value());
CHECK(!parse("1..3").has_value());            // empty component
CHECK(!parse(".2.3").has_value());
CHECK(!parse("1.2.").has_value());
CHECK(!parse("1.2.3-rc1").has_value());       // no suffixes
CHECK(!parse("-1.2.3").has_value());          // no negatives

// ordering
CHECK(*parse("1.0.0") < *parse("1.0.1"));
CHECK(*parse("1.0.9") < *parse("1.1.0"));
CHECK(*parse("1.9.9") < *parse("2.0.0"));
CHECK(*parse("2.0.0") > *parse("1.99.99"));
CHECK(*parse("1.2.3") == *parse("1.2.3"));
CHECK(*parse("1.2.3") <= *parse("1.2.3"));
CHECK(!(*parse("1.2.3") < *parse("1.2.3")));

// compatible: at or above, same major
CHECK(compatible(*parse("1.4.0"), *parse("1.2.0")));    // newer minor is fine
CHECK(compatible(*parse("1.2.5"), *parse("1.2.0")));    // newer patch is fine
CHECK(compatible(*parse("1.2.0"), *parse("1.2.0")));    // exact
CHECK(!compatible(*parse("1.1.0"), *parse("1.2.0")));   // too old
CHECK(!compatible(*parse("2.0.0"), *parse("1.2.0")));   // major bump breaks
CHECK(!compatible(*parse("0.9.0"), *parse("1.0.0")));   // older major

// compatible: below 1.0 the minor is the breaking component
CHECK(compatible(*parse("0.4.2"), *parse("0.4.0")));    // newer patch is fine
CHECK(!compatible(*parse("0.5.0"), *parse("0.4.0")));   // minor bump breaks
CHECK(!compatible(*parse("0.3.9"), *parse("0.4.0")));   // too old
CHECK(compatible(*parse("0.0.3"), *parse("0.0.3")));
CHECK(!compatible(*parse("0.0.4"), *parse("0.0.3")) == false);  // patch bump is fine
```

## Hints
- `operator<=>` over three members in order is one expression each: compare `major`, and if that is not `equal`, return it; otherwise compare `minor`; otherwise `patch`.
- A neat way to write it: `if (auto c = major <=> other.major; c != 0) return c;` and so on.
- For `parse`, scan the text yourself rather than reaching for a stream: find the two dots, then convert three substrings.
- `std::from_chars` (in `<charconv>`) parses an integer from a `string_view` without allocating and tells you where it stopped. It rejects a leading `+` or `-` when the target is unsigned, and reports the end pointer so you can insist the whole component was consumed.
- Simpler still: walk the characters, building each number, and fail on anything that is not a digit or a dot. Track how many components you have finished and reject anything other than three.
- Reject an empty component: `"1..3"` and `"1.2."` both have one. Requiring at least one digit before each dot and before the end handles all of them.
- `compatible` is two rules, and which one applies depends on `required.major == 0`.

## Solution
```cpp
#include <compare>
#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

struct Version {
    int major = 0;
    int minor = 0;
    int patch = 0;

    std::strong_ordering operator<=>(const Version& other) const {
        if (auto c = major <=> other.major; c != 0) return c;
        if (auto c = minor <=> other.minor; c != 0) return c;
        return patch <=> other.patch;
    }
    bool operator==(const Version&) const = default;
};

std::optional<Version> parse(std::string_view text) {
    int parts[3] = {0, 0, 0};
    int index = 0;
    bool digits_in_part = false;

    for (char c : text) {
        if (c == '.') {
            if (!digits_in_part) return std::nullopt;   // empty component
            if (++index > 2) return std::nullopt;       // too many dots
            digits_in_part = false;
        } else if (c >= '0' && c <= '9') {
            parts[index] = parts[index] * 10 + (c - '0');
            digits_in_part = true;
        } else {
            return std::nullopt;                        // any other character
        }
    }

    if (index != 2 || !digits_in_part) return std::nullopt;
    return Version{parts[0], parts[1], parts[2]};
}

bool compatible(Version installed, Version required) {
    if (installed < required) return false;
    if (required.major != installed.major) return false;
    if (required.major == 0 && required.minor != installed.minor) return false;
    return true;
}
```

## Notes
Three small functions, and every interesting decision is in what they *reject*.

`parse` returning `std::optional` rather than a `Version` with zeroes is the
Chapter 4.8 argument arriving in a practical setting. `"v1.2.3"` and `"1.2.x"`
and `"1.2.3-rc1"` are all things a real manifest contains, and a parser that
quietly returns `{0,0,0}` for them makes a dependency resolver that silently
picks the wrong package. The `digits_in_part` flag is what turns `"1..3"` and
`"1.2."` from plausible into rejected — an empty component is the case
hand-written parsers forget.

The `<=>` operator earns its place here. Written as three comparisons it is four
lines, and it gives you `<`, `>`, `<=`, `>=` and — with the defaulted `==` —
equality, all consistent with each other by construction. Writing those six
operators by hand is where inconsistent orderings come from.

`compatible` is where the actual policy lives, and it is worth noticing that it
is a *convention*, not a fact about software. Semantic versioning says the major
number changes when the interface breaks, so anything with the same major and a
higher number should be a drop-in — and the special case below 1.0 exists
because pre-1.0 projects are explicitly permitted to break at every minor
version. Every package manager implements a version of this, and they disagree
in the details: npm's `^` and `~`, Cargo's default caret, RubyGems' `~>`. The
rules only work as well as upstream's discipline in following them, which is a
large part of why this chapter argues for pinning an exact revision rather than
a range.

Note that `compatible(installed, required)` is deliberately not symmetric, and
the parameter order is the kind of thing to get wrong once and never again.
Reading it as "may I use *installed* where *required* was asked for" makes it
unambiguous, which is a good argument for naming parameters carefully in any
function whose arguments have the same type.
