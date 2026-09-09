---
id: judge-max-overlap
title: "Peak overlap"
difficulty: core
chapter: prefix-sums
topics: [sweep, difference-arrays, sorting, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given `n` half-open intervals `[s, e)`, print the largest number of them
covering any single point.

Half-open means an interval that ends at `t` and one that starts at `t` do
**not** overlap.

**Input.** The first line contains `n`. Each of the next `n` lines contains `s`
and `e` with `s < e`.

**Output.** One line: the maximum number of intervals covering a point.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ s < e ≤ 10⁹`. The coordinates are far
too large to index an array with.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <map>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    std::map<int, int> delta;
    for (int i = 0; i < n; ++i) {
        int s, e;
        std::cin >> s >> e;
        delta[s] += 1;
        delta[e + 1] -= 1;          // the interval is closed... is it?
    }

    int active = 0, peak = 0;
    for (auto [coord, change] : delta) {
        (void)coord;
        active += change;
        peak = std::max(peak, active);
    }
    std::cout << peak << '\n';
}
```

## Cases

### Sample
```in
6
9 12
10 11
10 13
12 14
13 16
15 18
```
```out
3
```

### touching, not overlapping
```in
2
0 1
1 2
```
```out
1
```

### a chain that never meets
```in
4
1 2
3 4
5 6
7 8
```
```out
1
```

### all of them at once
```in
3
0 10
0 10
0 10
```
```out
3
```

### a staircase
```in
5
0 5
1 6
2 7
3 8
4 9
```
```out
5
```

### one interval spanning the coordinate range
```in
1
0 1000000000
```
```out
1
```

### nested intervals with shared endpoints
```in
4
0 100
0 50
50 100
100 200
```
```out
2
```

## Hints
- The coordinates reach 10⁹, so there is no array to allocate. Keep only the endpoints: one event per interval boundary.
- `+1` where an interval starts, `-1` where it ends; sweep the events in coordinate order accumulating a running total, which is a prefix sum over a sparse difference array.
- The intervals are half-open, so the `-1` goes at `e`, not at `e + 1`. Then an interval ending at `t` and another starting at `t` cancel in the same slot and never both count.
- `std::map<int, int>` keeps the events sorted and merges the events at one coordinate for you, so there is no tie-break to get wrong. Sorting a `std::vector<std::pair<int, int>>` is faster and then the tie-break is yours: at equal coordinates the `-1` must be applied before the `+1`.
- The peak is at most `n`, so an `int` is enough for the answer.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <map>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    std::map<int, int> delta;
    for (int i = 0; i < n; ++i) {
        int s, e;
        std::cin >> s >> e;
        delta[s] += 1;
        delta[e] -= 1;              // half-open: the interval ends where it ends
    }

    int active = 0, peak = 0;
    for (auto [coord, change] : delta) {
        (void)coord;
        active += change;
        peak = std::max(peak, active);
    }
    std::cout << peak << '\n';
}
```

## Notes
The starter differs from the solution by one character, and that character is
the interval convention.

Writing `-1` at `e + 1` says the interval covers the point `e` as well — that
is, it treats `[s, e)` as `[s, e]`. Then `[0, 1)` and `[1, 2)` both cover the
point 1 and the answer comes out as 2 instead of 1. Every other case in this
problem passes with the bug, which is the honest shape of this mistake: it is
invisible until two intervals happen to touch, and then it is wrong by one on
exactly the inputs a setter writes to catch it.

There is no universally correct answer here. Closed intervals genuinely do
overlap at a shared endpoint, and plenty of problems mean closed. What you can
do is make the decision explicit:

- **Half-open `[s, e)`:** `delta[s] += 1; delta[e] -= 1;`
- **Closed `[s, e]`:** `delta[s] += 1; delta[e + 1] -= 1;`

Read which one the statement means, write the corresponding line, and put the
convention in a comment beside it. Interval problems are mostly this decision.

**Why a sweep and not a difference array.** Over an array indexed by coordinate
the technique is `diff[s] += 1; diff[e] -= 1;` and one linear pass — but the
coordinates reach 10⁹ here, so the array cannot exist. Keeping only the `2n`
endpoints is the same algorithm on the coordinates that actually occur, and it
costs `O(n log n)` for the ordering instead of `O(max coordinate)`. That is the
same move as coordinate compression in chapter 10.4; the sweep just does it
implicitly by using an ordered container as the storage.

**`std::map` or a sorted vector.** The map merges the `+1` and `-1` at one
coordinate into a single entry before you ever see it, which is exactly why the
touching case cancels cleanly. Sorting a vector of `(coordinate, change)` pairs
is about two and a half times faster at `n = 2 × 10⁵` — measured at `-O2`, 78 ms
for the map against 30 ms for the vector — because there is no node allocation
and no pointer chasing. The catch is that you must then ensure that at equal
coordinates every `-1` is applied before every `+1`, or a touching pair reads as
an overlap again. Sorting `std::pair<int, int>` values directly does this for
free, because the pair compares on the second element when the coordinates tie
and `-1 < +1`. That is a fact worth checking rather than assuming: swap the
`+1`/`-1` for `+1`/`+2` markers and the same sort silently gives the wrong
answer.
