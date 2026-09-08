---
id: edge-case-audit
title: "Correct on the sample, wrong on the hidden tests"
difficulty: core
chapter: reading-a-problem
topics: [edge-cases, correctness, constraints]
check: unit
standard: c++20
---

Three functions that pass every example a statement would print and fail the
tests it would not.

- `second_largest(values)` — the second largest **distinct** value, or
  `std::nullopt` if fewer than two distinct values exist. Constraints allow
  `n = 0`, negatives, and duplicates.
- `count_odd(values)` — how many values are odd. Constraints allow negatives.
- `longest_run(values)` — the length of the longest run of equal consecutive
  values. Constraints allow `n = 0`.

Each is wrong on at least one edge the statement implies but does not spell out.
Fix all three; the signatures stay as they are.

## Starter
```cpp
#include <cstddef>
#include <optional>
#include <vector>

// n may be 0. Values may be negative and may repeat.
std::optional<int> second_largest(const std::vector<int>& values) {
    int best = 0;
    int second = 0;
    for (int v : values) {
        if (v > best) { second = best; best = v; }
        else if (v > second) second = v;
    }
    return second;
}

// Values may be negative.
int count_odd(const std::vector<int>& values) {
    int n = 0;
    for (int v : values)
        if (v % 2 == 1) ++n;
    return n;
}

// n may be 0.
int longest_run(const std::vector<int>& values) {
    int best = 1;
    int current = 1;
    for (std::size_t i = 1; i < values.size(); ++i) {
        if (values[i] == values[i - 1]) ++current;
        else current = 1;
        if (current > best) best = current;
    }
    return best;
}
```

## Tests
```cpp
// second_largest: the ordinary case, then everything the statement implies.
CHECK_EQ(second_largest({3, 1, 4, 1, 5}).value(), 4);
CHECK(!second_largest({}).has_value());              // no elements
CHECK(!second_largest({7}).has_value());             // one element
CHECK(!second_largest({7, 7, 7}).has_value());       // one distinct value
CHECK_EQ(second_largest({7, 7, 3}).value(), 3);      // duplicates of the largest
CHECK_EQ(second_largest({-5, -2, -9}).value(), -5);  // all negative
CHECK_EQ(second_largest({-1, -1, -2}).value(), -2);
CHECK_EQ(second_largest({0, -3}).value(), -3);       // zero is a real value
CHECK_EQ(second_largest({2, 1}).value(), 1);

// count_odd
CHECK_EQ(count_odd({1, 2, 3}), 2);
CHECK_EQ(count_odd({}), 0);
CHECK_EQ(count_odd({-1, -2, -3}), 2);                // -1 and -3 are odd
CHECK_EQ(count_odd({0}), 0);
CHECK_EQ(count_odd({-7, 7}), 2);

// longest_run
CHECK_EQ(longest_run({1, 1, 2, 2, 2, 3}), 3);
CHECK_EQ(longest_run({}), 0);                        // no run exists
CHECK_EQ(longest_run({5}), 1);
CHECK_EQ(longest_run({1, 2, 3}), 1);
CHECK_EQ(longest_run({4, 4}), 2);
```

## Hints
- `second_largest` starts both trackers at `0`, which is a *legal input value*. For all-negative input, `0` beats everything and the function returns a number that was never in the list.
- Use `std::optional` for the trackers, or collect the distinct values and look at the top two. Either way, "not seen yet" must be distinguishable from "the value zero".
- "Distinct" matters: `{7, 7, 3}` has second largest 3, and `{7, 7, 7}` has none at all.
- `count_odd` uses `v % 2 == 1`, which is false for every negative odd number, because `-3 % 2` is `-1` in C++. Compare against zero instead: `v % 2 != 0`.
- `longest_run` starts `best` at 1, so an empty list reports a run of one. Return 0 when there are no elements.
- Run through the list in the chapter before you submit: smallest input, largest, all identical, sorted both ways, negatives, and the "no answer" case.

## Solution
```cpp
#include <cstddef>
#include <optional>
#include <vector>

std::optional<int> second_largest(const std::vector<int>& values) {
    std::optional<int> best;
    std::optional<int> second;
    for (int v : values) {
        if (best && v == *best) continue;            // distinct values only
        if (!best || v > *best) {
            if (best && (!second || *best > *second)) second = best;
            best = v;
        } else if (!second || v > *second) {
            second = v;
        }
    }
    return second;
}

int count_odd(const std::vector<int>& values) {
    int n = 0;
    for (int v : values)
        if (v % 2 != 0) ++n;                         // works for negatives too
    return n;
}

int longest_run(const std::vector<int>& values) {
    if (values.empty()) return 0;                    // no run exists
    int best = 1;
    int current = 1;
    for (std::size_t i = 1; i < values.size(); ++i) {
        current = (values[i] == values[i - 1]) ? current + 1 : 1;
        if (current > best) best = current;
    }
    return best;
}
```

## Notes
Every one of these passes the example a problem statement would print, and each
fails a case the statement made legal without mentioning.

**Zero is not a sentinel.** `second_largest` initialising its trackers to `0` is
the classic version of this: it works for every list of positive numbers, and
returns `0` — a value that was never in the input — for `{-5, -2, -9}`. Any time
a "not seen yet" state is encoded as a particular value, check whether that value
is inside the constraints. `std::optional` says "not seen yet" without borrowing
a number that means something else, which is the Chapter 4.8 argument in its
natural habitat.

**`% 2 == 1` is not "is odd".** C++ integer division rounds towards zero, so
`-3 % 2` is `-1`, and a test against `1` silently answers "even" for half the
number line. `!= 0` is correct for every input. This is the same fact Chapter 7.1
used to explain why signed division by two costs three instructions more than
unsigned, arriving here as a wrong answer instead of a slow one.

**An empty input is a real input.** `longest_run` starting `best` at 1 encodes an
assumption — that at least one element exists — that the constraints explicitly
allow to be false. When `n = 0` is legal, the first line of the function should
usually say what happens.

The pattern across all three: the bug is never in the interesting part of the
algorithm. `second_largest`'s comparison logic is fine; `count_odd`'s loop is
fine; `longest_run`'s run tracking is fine. The failures are all in
initialisation and in the boundary between "no data" and "data". That is where
hidden tests live, because that is where setters know solutions break — and it
is why the checklist is worth running mechanically rather than by inspiration.
