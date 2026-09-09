---
id: judge-interval-cover
title: "Covering the points"
difficulty: core
chapter: greedy
topics: [greedy, sorting, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given `n` points on a line and a length `L`, print the fewest closed intervals
of length exactly `L` needed so that every point lies inside one. An interval
placed at `s` covers every coordinate in `[s, s + L]`, and `s` may be any
integer.

**Input.** The first line contains `n` and `L`. The second line contains `n`
point coordinates.

**Output.** One line: the minimum number of intervals.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ L ≤ 10⁹`, `|xᵢ| ≤ 10⁹`. Points may
repeat.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long length;
    std::cin >> n >> length;
    std::vector<long long> x(n);
    for (long long& v : x) std::cin >> v;

    std::sort(x.begin(), x.end());

    int used = 0;
    long long covered_to = 0;
    for (int i = 0; i < n; ++i) {
        if (used > 0 && x[i] <= covered_to) continue;
        ++used;
        covered_to = x[i] + length / 2;      // the interval is centred on the point
    }

    std::cout << used << '\n';
}
```

## Cases

### Sample
```in
7 2
1 2 3 4 5 6 7
```
```out
3
```

### one interval is enough
```in
5 4
0 1 2 3 4
```
```out
1
```

### spread out
```in
3 2
1 10 20
```
```out
3
```

### zero length
```in
3 0
1 2 3
```
```out
3
```

### repeated points
```in
3 1
2 2 2
```
```out
1
```

### unsorted input
```in
3 1
3 1 2
```
```out
2
```

### negative coordinates
```in
4 3
-5 -4 0 1
```
```out
2
```

### a single point
```in
1 0
5
```
```out
1
```

## Hints
- Sort the points. Then repeatedly: find the leftmost point not yet covered, and place one interval for it.
- The interval you place should **start** at that point, covering `[p, p + L]`. That reaches as far right as any interval containing `p` possibly can.
- Centring the interval on the point wastes half its length to the left, where there is nothing left to cover — everything to the left is already covered by construction.
- `length / 2` is also integer division, so an odd length loses another half unit.
- Coordinates reach 10⁹ and `L` reaches 10⁹, so `x[i] + length` reaches 2 × 10⁹ and must be computed in `long long`.
- Do not use a sentinel like `covered_to = 0` to mean "nothing covered yet": 0 is a legal coordinate. Track whether any interval has been placed instead.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long length;
    std::cin >> n >> length;
    std::vector<long long> x(n);
    for (long long& v : x) std::cin >> v;

    std::sort(x.begin(), x.end());

    int used = 0;
    long long covered_to = 0;
    for (int i = 0; i < n; ++i) {
        if (used > 0 && x[i] <= covered_to) continue;
        ++used;
        covered_to = x[i] + length;          // start at the point, reach furthest right
    }

    std::cout << used << '\n';
}
```

## Notes
One line, and the greedy choice inside it.

To cover the leftmost uncovered point `p`, an interval must contain `p`. Every
such interval reaches at most `p + L`, and the one starting exactly at `p`
achieves that. Since everything to the left of `p` is already covered, extending
leftwards buys nothing — so starting at `p` is never worse than any alternative.

The exchange argument makes it a proof rather than an intuition. Take any
optimal cover, and look at the interval that covers `p`. Slide it right until its
left end is at `p`. It still covers `p`, and every point it covered to the right
of `p` it still covers, because sliding right only adds coverage on that side.
So there is an optimal cover whose first interval starts at `p`, and the
remaining problem is the same problem on the points beyond `p + L`.

**Centring is the plausible wrong answer.** `[p - L/2, p + L/2]` reaches only
`L/2` to the right, so on the sample it needs four intervals where three suffice.
It also loses a half unit to integer division when `L` is odd. Both are symptoms
of the same mistake: choosing a placement for its symmetry rather than for what
it accomplishes.

Two details that the cases check.

**The sentinel.** `covered_to` starts at 0, which is a perfectly ordinary
coordinate — the negative-coordinates case has points at −5 and −4, and without
the `used > 0` guard the first of them would look "already covered". Whenever a
sentinel value is drawn from the same set as the real data, guard on a separate
fact instead; here that fact is whether any interval exists yet.

**The width.** `x[i] + length` reaches 2 × 10⁹ with the stated limits, which
overflows a signed 32-bit `int`. Reading the coordinates straight into
`long long` makes every later expression wide, which is cheaper than remembering
to cast at each use — the same conclusion as chapter 10.7.

The whole solution is a sort plus a linear scan: O(n log n), dominated by the
sort. When a greedy is correct, this is usually what it looks like, and the code
being short is exactly why the *argument* has to carry the weight.
