---
id: checked-access
title: "Check at the boundary"
difficulty: core
chapter: undefined-behaviour
topics: [undefined-behaviour, containers, api-design]
check: unit
standard: c++20
---

`get_setting` looks up a configuration value by index. The index comes from
outside the program, so it may be anything — and `operator[]` does not check,
turning bad input into undefined behaviour rather than an error.

Make it safe: return the value when the index is valid, and the supplied
fallback when it is not. Do not let an out-of-range index reach `operator[]`.

## Starter
```cpp
#include <string>
#include <vector>

std::string get_setting(const std::vector<std::string>& settings,
                        int index,
                        const std::string& fallback) {
    return settings[index];
}
```

## Tests
```cpp
std::vector<std::string> settings{"alpha", "beta", "gamma"};
const std::string fallback = "default";

CHECK_EQ(get_setting(settings, 0, fallback), std::string("alpha"));
CHECK_EQ(get_setting(settings, 2, fallback), std::string("gamma"));

// Out of range in both directions.
CHECK_EQ(get_setting(settings, 3, fallback), std::string("default"));
CHECK_EQ(get_setting(settings, 100, fallback), std::string("default"));
CHECK_EQ(get_setting(settings, -1, fallback), std::string("default"));

// An empty container: every index is out of range.
std::vector<std::string> none;
CHECK_EQ(get_setting(none, 0, fallback), std::string("default"));
CHECK_EQ(get_setting(none, -5, fallback), std::string("default"));
```

## Hints
- The index is `int` and `size()` is unsigned, so comparing them directly invites the sign-conversion trap from Chapter 1.2.
- Reject negatives *first*, before any conversion to an unsigned type.
- `index >= 0 && static_cast<std::size_t>(index) < settings.size()` is the safe form.
- `at()` also works — catch the `std::out_of_range` and return the fallback — but the explicit check is cheaper and clearer here.

## Solution
```cpp
#include <string>
#include <vector>

std::string get_setting(const std::vector<std::string>& settings,
                        int index,
                        const std::string& fallback) {
    if (index < 0) return fallback;
    if (static_cast<std::size_t>(index) >= settings.size()) return fallback;
    return settings[index];
}
```

## Notes
The order of the two checks is the whole exercise. Writing
`if (index >= settings.size())` in one line looks equivalent and is not: the
comparison converts `index` to `std::size_t`, so `-1` becomes a value around
18 quintillion, the check passes, and `settings[-1]` reads far outside the
allocation. Testing for negative *before* converting is what makes it correct.

`-Wall -Wextra` warns about that comparison — `comparison of integer
expressions of different signedness` — which is a good reason to treat warnings
as errors on new code.

The principle generalises beyond this function: **check at the boundary where
untrusted input enters, then use the unchecked operation inside.** Validating
once at the edge is cheaper than `at()` on every access deep in a loop, and it
puts the error handling where the caller can see it.
