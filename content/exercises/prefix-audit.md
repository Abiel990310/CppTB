---
id: prefix-audit
title: "Three tables that are off by one"
difficulty: core
chapter: prefix-sums
topics: [prefix-sums, difference-arrays, sweep, algorithms]
check: unit
standard: c++20
---

Three functions built on running totals. Each one has a single off-by-one, and
each off-by-one is in a different place: the query, the update, or the endpoint
convention.

- `range_sum(a, l, r)` — the sum of `a[l] … a[r]`, inclusive. Builds the prefix
  table without a leading zero and then subtracts the wrong entry.
- `apply_ranges(n, updates)` — start from `n` zeros and apply each
  `{l, r, d}`, adding `d` to every index from `l` to `r` inclusive. Closes each
  range one slot early.
- `max_overlap(intervals)` — the largest number of half-open intervals
  `[start, end)` covering any single point. Treats a shared endpoint as an
  overlap.

## Starter
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <map>
#include <vector>

long long range_sum(const std::vector<int>& a, int l, int r) {
    if (a.empty()) return 0;
    std::vector<long long> p(a.size());
    p[0] = a[0];                                   // no leading zero
    for (std::size_t i = 1; i < a.size(); ++i) p[i] = p[i - 1] + a[i];
    return p[r] - p[l];                            // drops a[l], and breaks at l == 0
}

std::vector<long long> apply_ranges(int n,
                                    const std::vector<std::array<int, 3>>& updates) {
    std::vector<long long> diff(n + 1, 0);
    for (const auto& u : updates) {
        diff[u[0]] += u[2];
        diff[u[1]] -= u[2];                        // closes one slot too early
    }
    std::vector<long long> out(n, 0);
    long long running = 0;
    for (int i = 0; i < n; ++i) { running += diff[i]; out[i] = running; }
    return out;
}

int max_overlap(const std::vector<std::pair<int, int>>& intervals) {
    std::map<int, int> delta;
    for (auto [start, end] : intervals) {
        delta[start] += 1;
        delta[end + 1] -= 1;                       // as if the intervals were closed
    }
    int active = 0, peak = 0;
    for (auto [time, change] : delta) {
        (void)time;
        active += change;
        peak = std::max(peak, active);
    }
    return peak;
}
```

## Tests
```cpp
std::vector<int> a{2, 1, 5, 1, 3, 2};

// range_sum
CHECK_EQ(range_sum(a, 0, 5), 14LL);        // the whole array
CHECK_EQ(range_sum(a, 0, 0), 2LL);         // the first element alone
CHECK_EQ(range_sum(a, 5, 5), 2LL);         // the last element alone
CHECK_EQ(range_sum(a, 2, 4), 9LL);         // 5 + 1 + 3
CHECK_EQ(range_sum(a, 1, 3), 7LL);         // 1 + 5 + 1
CHECK_EQ(range_sum({}, 0, 0), 0LL);

std::vector<int> big(400, 10'000'000);     // a total no int can hold
CHECK_EQ(range_sum(big, 0, 399), 4'000'000'000LL);

// apply_ranges
CHECK_EQ(apply_ranges(5, {{{0, 4, 1}}}), (std::vector<long long>{1, 1, 1, 1, 1}));
CHECK_EQ(apply_ranges(5, {{{0, 4, 1}}, {{1, 2, 3}}, {{4, 4, 10}}}),
         (std::vector<long long>{1, 4, 4, 1, 11}));
CHECK_EQ(apply_ranges(3, {}), (std::vector<long long>{0, 0, 0}));
CHECK_EQ(apply_ranges(3, {{{2, 2, -5}}}), (std::vector<long long>{0, 0, -5}));
CHECK_EQ(apply_ranges(4, {{{0, 0, 7}}, {{3, 3, 7}}}),
         (std::vector<long long>{7, 0, 0, 7}));

// max_overlap
CHECK_EQ(max_overlap({{9, 12}, {10, 11}, {10, 13}, {12, 14}, {13, 16}, {15, 18}}), 3);
CHECK_EQ(max_overlap({{0, 1}, {1, 2}}), 1);          // touching, not overlapping
CHECK_EQ(max_overlap({{0, 5}, {1, 2}, {2, 3}}), 2);
CHECK_EQ(max_overlap({}), 0);
CHECK_EQ(max_overlap({{0, 1}}), 1);
CHECK_EQ(max_overlap({{0, 10}, {0, 10}, {0, 10}}), 3);
```

## Hints
- `range_sum`: give the table `n + 1` entries with `p[0] = 0` and
  `p[i + 1] = p[i] + a[i]`. Then `p[r + 1] - p[l]` is the inclusive sum, and
  `l == 0` needs no special case.
- Check the fix against `range_sum(a, 0, 0)`, which must be `a[0]`. The starter
  returns 0 for it, which is the classic symptom of a missing leading zero.
- `apply_ranges`: the `-d` belongs one past the end of the range. For an
  inclusive `r` that is `diff[r + 1]`, which is why `diff` was sized `n + 1`.
- The last element of the range is the one the starter misses, so a range of
  length 1 shows the bug immediately.
- `max_overlap`: the intervals are half-open, so an interval ending at `t` and
  another starting at `t` do not overlap. Write the `-1` at `end`, not at
  `end + 1`, and the two cancel in the same map slot.
- Only the convention changes between the two: `end + 1` is right for closed
  intervals and wrong here. Read the problem statement before choosing.

## Solution
```cpp
#include <algorithm>
#include <array>
#include <cstddef>
#include <map>
#include <vector>

long long range_sum(const std::vector<int>& a, int l, int r) {
    if (a.empty()) return 0;
    std::vector<long long> p(a.size() + 1, 0);     // the leading zero earns its slot
    for (std::size_t i = 0; i < a.size(); ++i) p[i + 1] = p[i] + a[i];
    return p[r + 1] - p[l];
}

std::vector<long long> apply_ranges(int n,
                                    const std::vector<std::array<int, 3>>& updates) {
    std::vector<long long> diff(n + 1, 0);
    for (const auto& u : updates) {
        diff[u[0]] += u[2];
        diff[u[1] + 1] -= u[2];                    // one past the inclusive end
    }
    std::vector<long long> out(n, 0);
    long long running = 0;
    for (int i = 0; i < n; ++i) { running += diff[i]; out[i] = running; }
    return out;
}

int max_overlap(const std::vector<std::pair<int, int>>& intervals) {
    std::map<int, int> delta;
    for (auto [start, end] : intervals) {
        delta[start] += 1;
        delta[end] -= 1;                           // half-open: ends where it ends
    }
    int active = 0, peak = 0;
    for (auto [time, change] : delta) {
        (void)time;
        active += change;
        peak = std::max(peak, active);
    }
    return peak;
}
```

## Notes
Three bugs, one root: the boundary was decided by habit rather than by reading.

**`range_sum` — the missing leading zero.** Without `p[0] = 0` the table has no
entry meaning "nothing summed yet", so `l == 0` has no correct answer to
subtract and every other `l` is off by `a[l]`. The test `range_sum(a, 0, 0)`
returns 0 in the starter, which is the fingerprint: a single-element range that
comes out empty. The fix costs one integer of memory and removes a conditional
from every call site, which is why the convention with the leading zero is worth
adopting everywhere rather than deriving each time.

Note the `4'000'000'000LL` test. Four hundred values that each fit comfortably in
an `int` produce a total that does not, and `long long` is what makes it work.
This is the most common wrong type in competitive programming, and it fails
silently — the starter here already returns `long long`, so you get the right
answer for the wrong reason.

**`apply_ranges` — the update that ends early.** A difference array encodes
"start adding here, stop adding *after* there", and "after there" is `r + 1`.
Writing `-d` at `r` cancels the update one element too soon, so every range comes
out one short. Length-1 ranges expose it hardest: `{2, 2, -5}` becomes a no-op
in the starter, because the `+d` and `-d` land in the same slot and annihilate.
That is why `diff` has `n + 1` entries — `r` may be the last index, and
`diff[n]` must exist to be written and then never read.

**`max_overlap` — the wrong interval convention.** `[0, 1)` and `[1, 2)` touch;
they do not overlap. Writing the `-1` at `end + 1` says otherwise and reports 2.
Neither convention is right in general — closed intervals genuinely do overlap
at a shared endpoint — so this is not a bug you can fix by remembering a rule.
It is one you fix by reading the statement, deciding once, and writing the
decision in a comment next to the `-1`, which is what the solution does.

One thing all three share: the fix is in the *writing*, not in the sweep. The
loop that accumulates the running total is identical in the starter and the
solution, in all three functions. When a prefix-based solution is wrong, the
loop is almost never where to look.
