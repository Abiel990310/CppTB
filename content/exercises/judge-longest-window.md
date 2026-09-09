---
id: judge-longest-window
title: "Longest run under a budget"
difficulty: core
chapter: two-pointers
topics: [two-pointers, sliding-window, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given `n` positive integers and a limit `L`, print the length of the longest
contiguous run whose sum is at most `L`.

**Input.** The first line contains `n` and `L`. The second line contains `n`
integers.

**Output.** One line: the length of the longest such run, or `0` if every single
value already exceeds `L`.

**Constraints.** `1 ≤ n ≤ 200000`, `1 ≤ value ≤ 10^9`, and `1 ≤ L ≤ 10^18`.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    int limit;                       // the limit goes to 10^18
    std::cin >> n >> limit;

    std::vector<long long> a(n);
    for (long long& x : a) std::cin >> x;

    // Every start, extended until it breaks. Correct, and quadratic.
    int best = 0;
    for (int i = 0; i < n; ++i) {
        long long sum = 0;
        for (int j = i; j < n; ++j) {
            sum += a[j];
            if (sum > limit) break;
            best = std::max(best, j - i + 1);
        }
    }
    std::cout << best << '\n';
}
```

## Cases

### Sample
```in
6 8
2 1 5 1 3 2
```
```out
3
```

### one value that fits
```in
1 1
1
```
```out
1
```

### one value that does not
```in
1 0
1
```
```out
0
```

### equal values
```in
4 10
5 5 5 5
```
```out
2
```

### the whole array fits
```in
5 100
1 1 1 1 1
```
```out
5
```

### each value uses the whole budget
```in
3 1000000000
1000000000 1000000000 1000000000
```
```out
1
```

### a limit near the top of the range
```in
10 15
1 2 3 4 5 6 7 8 9 10
```
```out
5
```

### a limit that does not fit in an int
```in
5 3000000000
1000000000 1000000000 1000000000 1000000000 1000000000
```
```out
3
```

## Hints
- Every value is positive, so the sum is monotone in the window: extending can only increase it and shrinking can only decrease it. That is what licenses a sliding window.
- Keep `lo` and the running `sum` as state *outside* the loop over `hi`. Resetting either one per iteration turns the technique back into the quadratic scan.
- Extend on the right (`sum += a[hi]`), then shrink from the left while `sum > limit`, then record `hi - lo + 1`.
- Guard the shrinking loop with `lo <= hi`. A single value larger than the limit otherwise pushes `lo` past `hi`, and `hi - lo + 1` underflows if those are unsigned.
- `L` goes to 10¹⁸ and the values to 10⁹, so both the limit and every sum are `long long`. Reading the limit into an `int` fails on any input above 2147483647.
- The answer itself is at most `n`, so it fits an `int`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    long long limit;
    if (!(std::cin >> n >> limit)) return 0;

    std::vector<long long> a(n);
    for (long long& x : a) std::cin >> x;

    int best = 0;
    long long sum = 0;
    int lo = 0;

    for (int hi = 0; hi < n; ++hi) {
        sum += a[hi];                                   // extend right
        while (sum > limit && lo <= hi) {               // restore the invariant
            sum -= a[lo];
            ++lo;
        }
        best = std::max(best, hi - lo + 1);             // record
    }

    std::cout << best << '\n';
}
```

## Notes
The starter has two independent problems.

**It reads the limit into an `int`.** `L` goes to 10¹⁸, so on the last case
`std::cin >> limit` sees 3000000000, cannot represent it, and does what C++11
specifies for an out-of-range extraction: it stores `INT_MAX` and sets `failbit`.
Both halves of that matter. The clamped limit is already wrong, and the failed
stream means every later `std::cin >> x` is a no-op, so the array stays all
zeros. The program then finds nothing that exceeds 2147483647 and prints 5 for an
input whose answer is 3. That is the bug the cases catch.

**It is quadratic.** At `n = 200000` the double loop does 2 × 10¹⁰ additions
against the window's 4 × 10⁵. The cases here cannot demonstrate that, for the
reason `AUTHORING.md` records: timing out a quadratic scan over a list needs tens
of thousands of values, and cases live inline. The constraint in the statement is
real; here it is on your honour.

Three things this problem is arranged to check.

**The positivity precondition.** The constraints say `1 ≤ value`, and that is not
decoration — it is what makes the sum monotone in the window and therefore what
makes the technique valid. With negative values allowed, extending the window
could *reduce* the sum, `lo` would sometimes need to move backwards, and the
whole linear argument collapses. When you see a sliding-window problem, the
constraint that all values are positive is the setter telling you which tool to
use.

**The `lo <= hi` guard.** The "one value that does not fit" case is
`1 0` — a single 1 against a limit of 0. Without the guard, the shrinking loop
runs until `lo` passes `hi`, and then `hi - lo + 1` is 0 by luck with signed
`int`s and an enormous number if you used `std::size_t`. Writing the guard makes
it correct either way, which matters because the choice of index type is
otherwise arbitrary.

**The 64-bit limit.** `L` goes to 10¹⁸, so it does not fit in an `int`. Worth
knowing exactly what happens when you try: since C++11 an out-of-range extraction
stores the nearest representable value — `INT_MAX` here, not 0 — and sets
`failbit`, and once the stream is in a failed state every subsequent `>>` leaves
its target untouched. So a single wrong declaration silently costs you the rest
of the input as well. The more dangerous version of the same mistake is a
`long long` limit accumulated into an `int` sum, which wraps with no failbit at
all.

Worth noticing what the answer is *not*: the largest number of elements you can
pick, which would be a different problem solved by sorting. "Contiguous" is what
makes this a window, and reading that word off the statement is the first
decision.
