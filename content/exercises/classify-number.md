---
id: classify-number
title: "Classify without falling through"
difficulty: intro
chapter: making-decisions
topics: [control-flow, switch]
check: unit
standard: c++20
---

`classify` should return a word for each score from 0 to 4, and `"high"` for
anything else. It is missing `break` statements, so every case falls through to
the next and almost everything returns `"high"`.

Fix it. Keep the `switch`.

## Starter
```cpp
#include <string>

std::string classify(int score) {
    std::string result = "high";
    switch (score) {
        case 0:
        case 1:
            result = "low";
        case 2:
        case 3:
            result = "medium";
        case 4:
            result = "good";
        default:
            result = "high";
    }
    return result;
}
```

## Tests
```cpp
CHECK_EQ(classify(0), std::string("low"));
CHECK_EQ(classify(1), std::string("low"));
CHECK_EQ(classify(2), std::string("medium"));
CHECK_EQ(classify(3), std::string("medium"));
CHECK_EQ(classify(4), std::string("good"));
CHECK_EQ(classify(5), std::string("high"));
CHECK_EQ(classify(-1), std::string("high"));
CHECK_EQ(classify(1000), std::string("high"));
```

## Hints
- Without `break`, control continues into the next case body — so every path reaches `default` and overwrites the answer with `"high"`.
- Stacked labels like `case 0: case 1:` are *not* fallthrough; they share one body, which is what you want here.
- Each of the four bodies needs a `break` (or a `return`).
- Returning directly from each case is shorter and makes the fallthrough question disappear entirely.

## Solution
```cpp
#include <string>

std::string classify(int score) {
    switch (score) {
        case 0:
        case 1:
            return "low";
        case 2:
        case 3:
            return "medium";
        case 4:
            return "good";
        default:
            return "high";
    }
}
```

## Notes
Returning from each case rather than assigning and breaking is the version worth
writing. There is no local to leave in a wrong state, no `break` to forget, and
the compiler will tell you if a path falls off the end without returning.

Note the difference between stacked labels and fallthrough. `case 0: case 1:`
with one body is two labels for the same code and is completely ordinary.
Fallthrough is a case body that *runs* and then continues into the next one —
which is what the starter does, and what `[[fallthrough]]` exists to mark when
it is deliberate.
