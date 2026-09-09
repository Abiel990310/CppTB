---
id: judge-histogram
title: "Largest rectangle in a histogram"
difficulty: stretch
chapter: monotonic-stacks
topics: [monotonic-stack, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given `n` bars of width 1 standing side by side, the `i`-th of height `hᵢ`,
print the area of the largest axis-aligned rectangle that fits inside the
histogram.

**Input.** The first line contains `n`. The second line contains `n` heights.

**Output.** One line: the largest area.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ hᵢ ≤ 10⁹`. The area can reach 2 × 10¹⁴.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<long long> h(n);
    for (long long& x : h) std::cin >> x;

    std::vector<int> stack;                        // indices, heights increasing
    long long best = 0;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && h[stack.back()] >= h[i]) {
            int top = stack.back();
            stack.pop_back();
            int left = stack.empty() ? -1 : stack.back();
            best = std::max(best, (i - left - 1) * h[top]);
        }
        stack.push_back(i);
    }

    std::cout << best << '\n';
}
```

## Cases

### Sample
```in
6
2 1 5 6 2 3
```
```out
10
```

### the tallest bar is last
```in
2
2 4
```
```out
4
```

### a flat histogram
```in
4
1 1 1 1
```
```out
4
```

### one bar
```in
1
5
```
```out
5
```

### a notch in the middle
```in
7
6 2 5 4 5 1 6
```
```out
12
```

### increasing all the way
```in
5
1 2 3 4 5
```
```out
9
```

### an area no int can hold
```in
3
1000000000 1000000000 1000000000
```
```out
3000000000
```

### zero heights
```in
2
0 0
```
```out
0
```

## Hints
- For each bar, the widest rectangle *at that bar's height* runs from just past the nearest shorter bar on its left to just before the nearest shorter bar on its right. That is a previous-smaller and a next-smaller query, which is one monotonic stack.
- Keep indices on the stack with increasing heights. When a bar arrives that is not taller, the bars it stops are exactly the ones you can now measure.
- After popping `top`, the new stack top is the left boundary, so the width is `i - left - 1`, and `left == -1` when the stack empties gives the whole prefix with no special case.
- The starter never measures the bars still on the stack when the loop ends — in an increasing histogram that is every bar. Run `i` from `0` to `n` **inclusive** and use height 0 at `i == n`; that sentinel pops everything through the same code path.
- `int height = (i == n) ? 0 : h[i];` — do not index `h[n]`.
- 2 × 10⁵ bars of height 10⁹ is an area of 2 × 10¹⁴. Everything about the area is `long long`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<long long> h(n);
    for (long long& x : h) std::cin >> x;

    std::vector<int> stack;
    long long best = 0;

    for (int i = 0; i <= n; ++i) {                 // one past the end
        long long height = (i == n) ? 0 : h[i];    // the sentinel drains the stack
        while (!stack.empty() && h[stack.back()] >= height) {
            int top = stack.back();
            stack.pop_back();
            int left = stack.empty() ? -1 : stack.back();
            best = std::max(best, (i - left - 1) * h[top]);
        }
        stack.push_back(i);
    }

    std::cout << best << '\n';
}
```

## Notes
The starter's loop is correct and stops one step early.

Every bar is measured at the moment something not taller arrives to its right.
Bars with nothing shorter after them are never measured at all — and in
`1 2 3 4 5` that is all five, so the starter prints 0. Even in the two-bar case
`2 4` it prints 2, having measured the bar of height 2 and never the taller one.

There are two ways to finish the job. A drain loop after the main one:

```cpp
while (!stack.empty()) { /* the same five lines, with i == n */ }
```

or the sentinel, which is the same idea written once instead of twice. The
sentinel wins for a reason worth generalising: **duplicated code is duplicated
bugs.** The width formula `i - left - 1` is subtle enough to get wrong once;
writing it in two places doubles the chance and halves the chance you notice.

Three details behind the formula.

**Why the new top is the left boundary.** The stack holds increasing heights, so
after `top` is popped, everything remaining is shorter than `h[top]` — and the
nearest such bar is the top. The rectangle therefore spans the open interval
`(left, i)`, whose width is `i - left - 1`.

**Why `>=` and not `>`.** Equal heights pop each other, which looks like it
would truncate a run of equal bars. It does not: the last bar of the run is
popped by whatever ends the run, and by then the earlier equal bars are gone
from the stack, so nothing stops it and it measures the full width for all of
them. Try `1 1 1 1` by hand once and the argument sticks.

**Why the area is `long long`.** The `1000000000` case exists to catch a `h`
declared as `std::vector<int>` combined with an `int` width: `3 * 10⁹` overflows
before it ever reaches the `long long` result. Reading the heights straight into
`long long` makes the multiplication wide at the point it happens, which is the
robust place to fix it rather than casting at each use.
