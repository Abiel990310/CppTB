---
id: remove-the-quadratic
title: "Three lines that make it quadratic"
difficulty: core
chapter: counting-the-work
topics: [complexity, containers, performance]
check: unit
standard: c++20
---

Three functions that are correct and quadratic. Each one's quadratic part is a
single standard-library call inside a loop.

Make all three linear, or `n log n`. The results must not change.

- `distinct_count(values)` — how many distinct values there are. Uses
  `std::find` per element.
- `drain_in_order(values)` — returns the elements in order, consuming the input
  from the front with `erase(begin())`.
- `running_labels(values)` — one string per element: the element, then a comma
  and a space, appended to everything so far. Uses `result = result + …`.

The checks count operations, so a version that is merely tidier will not pass.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

// --- given, do not change: counts the work the checks care about -------
inline long long comparisons = 0;
inline long long moves = 0;

struct Counted {
    int value;
    bool operator==(const Counted& other) const {
        ++comparisons;
        return value == other.value;
    }
};
// ----------------------------------------------------------------------

std::size_t distinct_count(const std::vector<Counted>& values) {
    std::vector<Counted> seen;
    for (const Counted& v : values)
        if (std::find(seen.begin(), seen.end(), v) == seen.end()) seen.push_back(v);
    return seen.size();
}

std::vector<int> drain_in_order(std::vector<int> values) {
    std::vector<int> out;
    while (!values.empty()) {
        out.push_back(values.front());
        moves += static_cast<long long>(values.size()) - 1;   // what erase() shifts
        values.erase(values.begin());
    }
    return out;
}

std::string running_labels(const std::vector<int>& values) {
    std::string result;
    for (int v : values) result = result + std::to_string(v) + ", ";
    return result;
}
```

## Tests
```cpp
// distinct_count: same answers, far fewer comparisons.
{
    std::vector<Counted> values;
    for (int i = 0; i < 2000; ++i) values.push_back(Counted{i % 500});

    comparisons = 0;
    std::size_t distinct = distinct_count(values);
    long long used = comparisons;

    CHECK_EQ(distinct, std::size_t{500});
    CHECK(used < 200000);            // the linear scan version uses ~500,000
}
CHECK_EQ(distinct_count({}), std::size_t{0});
CHECK_EQ(distinct_count({Counted{7}}), std::size_t{1});
CHECK_EQ(distinct_count({Counted{7}, Counted{7}, Counted{7}}), std::size_t{1});
CHECK_EQ(distinct_count({Counted{3}, Counted{1}, Counted{2}}), std::size_t{3});

// drain_in_order: same order, no shifting.
{
    std::vector<int> values;
    for (int i = 0; i < 5000; ++i) values.push_back(i);

    moves = 0;
    std::vector<int> out = drain_in_order(values);
    long long shifted = moves;

    CHECK_EQ(out.size(), std::size_t{5000});
    CHECK_EQ(out[0], 0);
    CHECK_EQ(out[4999], 4999);
    CHECK_EQ(shifted, 0LL);          // the erase version shifts ~12,500,000
}
CHECK(drain_in_order({}).empty());
CHECK_EQ(drain_in_order({9})[0], 9);

// running_labels: same string, built in place.
CHECK_EQ(running_labels({}), std::string(""));
CHECK_EQ(running_labels({1}), std::string("1, "));
CHECK_EQ(running_labels({1, 2, 3}), std::string("1, 2, 3, "));
{
    std::vector<int> values(2000, 7);
    std::string built = running_labels(values);
    CHECK_EQ(built.size(), std::size_t{6000});
    CHECK_EQ(built.substr(0, 6), std::string("7, 7, "));
}
```

## Hints
- `distinct_count` scans everything it has seen for every element. Put the seen values in an `std::unordered_set<int>` instead — insertion tells you whether it was new, and `Counted::operator==` is never called.
- `std::unordered_set::insert` returns a `pair` whose `.second` is `true` when the element was actually inserted. Counting those is the answer.
- `drain_in_order` does not need to erase anything. It is copying the elements out in order — a range-for over the input does that with no shifting at all.
- The `moves +=` line is bookkeeping the checks read; when nothing shifts any more, delete it along with the erase.
- `running_labels` uses `result = result + …`, which builds a whole new string every iteration. `result += …` appends in place. This is the same bug Chapter 7.2 profiled at 97% of a program's runtime.
- `result.reserve(...)` is optional here; `+=` alone is enough to make it linear.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

inline long long comparisons = 0;
inline long long moves = 0;

struct Counted {
    int value;
    bool operator==(const Counted& other) const {
        ++comparisons;
        return value == other.value;
    }
};

// Hashing instead of scanning: O(n) average rather than O(n^2).
std::size_t distinct_count(const std::vector<Counted>& values) {
    std::unordered_set<int> seen;
    for (const Counted& v : values) seen.insert(v.value);
    return seen.size();
}

// Nothing needs erasing; the elements are already in order.
std::vector<int> drain_in_order(std::vector<int> values) {
    std::vector<int> out;
    out.reserve(values.size());
    for (int v : values) out.push_back(v);
    return out;
}

// Append in place instead of rebuilding.
std::string running_labels(const std::vector<int>& values) {
    std::string result;
    for (int v : values) {
        result += std::to_string(v);
        result += ", ";
    }
    return result;
}
```

## Notes
None of the three loops was quadratic. In each case the loop was linear and the
thing it called was not, which is what makes this failure mode so easy to ship.

**`std::find` per element** is the most common one, and the giveaway is a
container being searched inside a loop over the same data. 2,000 elements over a
500-value alphabet costs about 500,000 comparisons; the hash set costs zero,
because `Counted::operator==` is never reached. The general move is: when the
question is "have I seen this before", the answer is a set or a map, not a scan.

**`erase(begin())`** was not needed at all here, which is the more interesting
lesson. The function was written as though the input had to be consumed, and
consuming a vector from the front costs `n(n-1)/2` element moves — 12.5 million
for 5,000 elements. When you genuinely need queue semantics, `std::deque` gives
O(1) at both ends; more often, as here, the erase exists because the code was
written to mirror the description rather than the data.

**`result = result + x`** allocates a new buffer holding everything so far, on
every iteration — the quadratic string build that Chapter 7.2 measured at 97% of
a program's runtime, and that Chapter 9.4's exercise counted at 795 allocations
against 1. `+=` appends into the existing buffer, which grows geometrically, so
the whole loop is linear.

The pattern worth taking away: when a solution times out and the loops all look
linear, the next place to look is what the loop *calls*. Chapter 10.2's table of
standard-library costs exists to be read at that moment.

One deliberate non-change: `drain_in_order` still takes its vector **by value**.
That is a copy of the whole input, which is O(n) — real work, but linear, and it
is what the signature promises callers. Fixing complexity is not a licence to
change an interface; the checks pass the same arguments either way.
