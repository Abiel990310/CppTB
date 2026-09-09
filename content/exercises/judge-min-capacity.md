---
id: judge-min-capacity
title: "Shipping within D days"
difficulty: stretch
chapter: binary-search
topics: [binary-search, monotonicity, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Packages must be shipped in the order given. Each day the ship carries a
contiguous run of packages whose total weight is at most its capacity. Find the
smallest capacity that gets everything shipped within `d` days.

**Input.** The first line contains `n` and `d`. The second line contains `n`
package weights.

**Output.** One line: the smallest sufficient capacity.

**Constraints.** `1 ≤ d ≤ n ≤ 100000`, and `1 ≤ weight ≤ 10^9`.

The answer is somewhere between the largest single package and the total. That
range can be 10¹⁴ wide, so it is not a range you scan.

## Starter
```cpp
#include <iostream>
#include <vector>

// Can everything ship within `days` at this capacity?
static bool feasible(const std::vector<long long>& weights, int days, long long capacity) {
    long long used = 1;
    long long load = 0;
    for (long long w : weights) {
        if (w > capacity) return false;
        if (load + w > capacity) { ++used; load = 0; }
        load += w;
    }
    return used <= days;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, d;
    std::cin >> n >> d;

    std::vector<long long> weights(n);
    for (long long& w : weights) std::cin >> w;

    long long total = 0;
    for (long long w : weights) total += w;

    // Correct, and it scans every candidate one at a time.
    for (long long capacity = 1; capacity <= total; ++capacity) {
        if (feasible(weights, d, capacity)) {
            std::cout << capacity << '\n';
            return 0;
        }
    }
    std::cout << total << '\n';
}
```

## Cases

### Sample
```in
10 5
1 2 3 4 5 6 7 8 9 10
```
```out
15
```

### one day, everything at once
```in
10 1
1 2 3 4 5 6 7 8 9 10
```
```out
55
```

### as many days as packages
```in
10 10
1 2 3 4 5 6 7 8 9 10
```
```out
10
```

### a single package
```in
1 1
7
```
```out
7
```

### equal weights
```in
4 2
5 5 5 5
```
```out
10
```

### one package dominates the total
```in
5 3
1 1 1000000000 1 1
```
```out
1000000000
```

### large weights, wide answer range
```in
6 3
1000000000 999999999 999999998 999999997 999999996 999999995
```
```out
1999999999
```

## Hints
- The predicate is monotone: if capacity `c` ships everything within `d` days, so does every capacity above it. That is the only property binary search needs — nothing has to be sorted.
- The lowest possible answer is the **largest single weight** (below that, one package never fits). The highest is the **total** (one day for everything). Search that interval.
- Keep the given `feasible` exactly as it is; only the search around it changes.
- The loop: `while (lo < hi) { mid = lo + (hi - lo) / 2; if (feasible(mid)) hi = mid; else lo = mid + 1; }` and the answer is `lo`.
- `hi = mid`, not `mid - 1` — `mid` is a candidate and must not be discarded. `lo = mid + 1`, not `mid` — otherwise the interval stops shrinking and the loop hangs.
- `mid = lo + (hi - lo) / 2`. With a total up to 10¹⁴, `(lo + hi)` would still fit in a `long long`, but write the safe form anyway; it is the same length.
- Every value here — total, capacity, midpoint — needs `long long`. 100000 packages of 10⁹ is 10¹⁴.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

static bool feasible(const std::vector<long long>& weights, int days, long long capacity) {
    long long used = 1;
    long long load = 0;
    for (long long w : weights) {
        if (w > capacity) return false;
        if (load + w > capacity) { ++used; load = 0; }
        load += w;
    }
    return used <= days;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, d;
    if (!(std::cin >> n >> d)) return 0;

    std::vector<long long> weights(n);
    for (long long& w : weights) std::cin >> w;

    // Below the largest package nothing fits; above the total nothing is gained.
    long long lo = 0;
    long long hi = 0;
    for (long long w : weights) {
        lo = std::max(lo, w);
        hi += w;
    }

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (feasible(weights, d, mid)) hi = mid;      // mid works; try smaller
        else                           lo = mid + 1;  // mid does not; go higher
    }

    std::cout << lo << '\n';
}
```

## Notes
The starter is correct and scans. With a total of 10¹⁴ and a linear `feasible`,
it would take longer than the age of the universe — but on the sample, where
the total is 55, it finishes instantly and prints the right answer. That is what
a scan over the answer space looks like: perfect on the example, hopeless on the
constraints.

Replacing the scan with a binary search takes the number of `feasible` calls
from 10¹⁴ to about 47, and each call is one pass over the packages. The whole
solution is `n log(total)` — around 5 × 10⁶ operations at the limits.

The bounds are worth choosing deliberately rather than starting at 1. Beginning
at the largest single weight is not an optimisation; it makes the search space
contain only sensible candidates, and it means the "one package dominates"
case — where the answer *is* that package — falls out immediately. Starting at 1
also works, because `feasible` rejects any capacity below the largest package,
but then the bound and the predicate are saying the same thing in two places.

The monotonicity is the thing to be able to state. If capacity `c` suffices,
then at capacity `c + 1` every day can carry at least what it carried before, so
the same schedule still works and the day count cannot rise. That argument is
short, and it is what licenses the whole technique — without it you would be
binary searching over something with no boundary to find, and getting a
confident wrong answer.

One detail in `feasible` worth noticing: `if (w > capacity) return false;` is
checked per package rather than assumed away. Without it, a package heavier than
the capacity starts a new day, still does not fit, and is counted as shipped
anyway — so an infeasible capacity is reported feasible and the search converges
on something far too small.

The "one package dominates" case is what catches it, and it is worth seeing the
numbers: on `1 1 1000000000 1 1` with three days, the guarded version answers
1000000000 and the unguarded one answers **2**. Removing that line does not
shift the answer slightly; it produces a capacity that could not carry a single
one of the packages.
