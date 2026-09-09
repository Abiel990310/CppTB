---
id: judge-bounded-spread
title: "Longest window with a bounded spread"
difficulty: stretch
chapter: deques-and-window-extrema
topics: [monotonic-deque, sliding-window, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the length of the longest contiguous subarray in which the largest and
smallest elements differ by at most `limit`.

**Input.** The first line contains `n` and `limit`. The second line contains `n`
integers.

**Output.** One line: the length of the longest such subarray.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ limit ≤ 10⁹`, `|aᵢ| ≤ 10⁹`.

## Starter
```cpp
#include <algorithm>
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long limit;
    std::cin >> n >> limit;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::deque<int> maxq;                      // indices, values decreasing
    int best = 0, lo = 0;

    for (int hi = 0; hi < n; ++hi) {
        while (!maxq.empty() && a[maxq.back()] <= a[hi]) maxq.pop_back();
        maxq.push_back(hi);

        // Treats the newest element as the window's minimum.
        while (a[maxq.front()] - a[hi] > limit) {
            if (maxq.front() == lo) maxq.pop_front();
            ++lo;
        }
        best = std::max(best, hi - lo + 1);
    }

    std::cout << best << '\n';
}
```

## Cases

### Sample
```in
7 4
8 2 4 7 3 5 6
```
```out
5
```

### the newest element is not the smallest
```in
4 3
1 5 1 5
```
```out
1
```

### nothing may differ at all
```in
7 0
8 2 4 7 3 5 6
```
```out
1
```

### a flat array
```in
4 0
1 1 1 1
```
```out
4
```

### the limit covers everything
```in
7 100
8 2 4 7 3 5 6
```
```out
7
```

### a mixed array
```in
8 3
3 1 4 1 5 9 2 6
```
```out
4
```

### increasing
```in
5 2
1 2 3 4 5
```
```out
3
```

### a single element
```in
1 0
4
```
```out
1
```

## Hints
- This is the sliding window of chapter 10.6: `lo` and `hi` both move forward only, and the question is what makes a window invalid.
- The window is invalid when `max - min > limit`, so you need both extrema at once — two deques, maintained identically with the comparison flipped.
- `a[hi]` is the *newest* element, not the smallest. `1 5 1 5` with a limit of 3 is the case that says so.
- Maintain `minq` by popping the back while `a[minq.back()] >= a[hi]`, then test `a[maxq.front()] - a[minq.front()] > limit`.
- In the shrink loop, pop each front only if it equals `lo`. Each deque holds a subset of the window's indices, so the departing element may not be at the front — and popping unconditionally empties the deque and then reads past its end.
- The two `if`s are independent, not an `if`/`else`: in a one-element window both fronts are `lo`.

## Solution
```cpp
#include <algorithm>
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long limit;
    std::cin >> n >> limit;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::deque<int> maxq, minq;                // indices
    int best = 0, lo = 0;

    for (int hi = 0; hi < n; ++hi) {
        while (!maxq.empty() && a[maxq.back()] <= a[hi]) maxq.pop_back();
        maxq.push_back(hi);
        while (!minq.empty() && a[minq.back()] >= a[hi]) minq.pop_back();
        minq.push_back(hi);

        while (static_cast<long long>(a[maxq.front()]) - a[minq.front()] > limit) {
            if (maxq.front() == lo) maxq.pop_front();
            if (minq.front() == lo) minq.pop_front();
            ++lo;
        }
        best = std::max(best, hi - lo + 1);
    }

    std::cout << best << '\n';
}
```

## Notes
The starter has the right window and half the information.

Tracking only the maximum and using `a[hi]` in place of the minimum is a
substitution that happens to be true often enough to pass casual tests: in a
window that has just been extended by a small value, the newest element *is* the
minimum. On `1 5 1 5` with `limit = 3` it is not — at `hi = 1` the window
`{1, 5}` has spread 4, but the starter computes `5 - 5 = 0`, keeps the window,
and reports 2 where the answer is 1.

The fix is a second deque, and it is worth noticing how little new code that is:
the min-deque is the max-deque with `>=` in place of `<=`. Two structures, one
idea.

**The guarded front pops.** Each deque contains only the indices not yet beaten
— a subset of the window — so when `lo` leaves, it may not be at either front.
`if (maxq.front() == lo)` asks the right question. Popping unconditionally is
not merely wrong: it drains the deque and the next iteration reads `front()` on
an empty one, which is undefined behaviour, and in practice a segfault on the
judge and a "runtime error" verdict with no line number.

They are two independent `if`s. In a one-element window both fronts are `lo`,
and an `if`/`else` would leave one deque holding a stale index forever.

**Why the subtraction is widened.** `a[maxq.front()] - a[minq.front()]` with
values of magnitude 10⁹ can reach 2 × 10⁹, which overflows a signed `int` — and
signed overflow is undefined behaviour, so "it wraps to something negative and
the comparison passes" is not a reliable prediction, it is just the usual
outcome. Reading `limit` as `long long` and casting one operand makes the whole
comparison 64-bit. The alternative, reading the values themselves into
`long long`, is equally good and costs a little memory.

**Termination.** The shrink loop always ends: `lo` increases every iteration,
and once `lo == hi` the window is one element with spread 0, which satisfies any
`limit >= 0`. That argument depends on `limit` being non-negative, which the
constraints guarantee — worth checking rather than assuming, because a negative
limit would run `lo` past `hi` and off the end of both deques.
