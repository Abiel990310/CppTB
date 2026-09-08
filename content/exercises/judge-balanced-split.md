---
id: judge-balanced-split
title: "Balanced split"
difficulty: core
chapter: reading-a-problem
topics: [bitmask, enumeration, constraints, io]
check: output
standard: c++20
timeLimitMs: 3000
---

You are given `n` integers. Print `YES` if they can be split into two
**non-empty** groups with equal sums, and `NO` otherwise. Every value must go
into exactly one of the two groups.

**Input.** The first line contains `n`. The second line contains `n` integers.

**Output.** One line: `YES` or `NO`.

**Constraints.** `1 ≤ n ≤ 20`, and `1 ≤ aᵢ ≤ 10^9`.

Read the constraints before choosing an approach. `n ≤ 20` is a much smaller
limit than a problem about sums would need if there were a clever solution, and
that is the setter telling you something.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    long long total = 0;
    for (int i = 0; i < n; ++i) {
        long long value;
        std::cin >> value;
        total += value;
    }

    // An even total is necessary. It is not sufficient.
    std::cout << (total % 2 == 0 ? "YES" : "NO") << '\n';
}
```

## Cases

### Sample
```in
4
1 2 3 4
```
```out
YES
```

### odd total
```in
3
1 2 4
```
```out
NO
```

### even total, but no split
```in
3
1 1 4
```
```out
NO
```

### one element cannot be split
```in
1
4
```
```out
NO
```

### two equal elements
```in
2
7 7
```
```out
YES
```

### twenty elements, no split, full enumeration
```in
20
999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 999999937 3
```
```out
NO
```

### large values that do split
```in
6
1000000000 1000000000 1000000000 1000000000 1000000000 1000000000
```
```out
YES
```

## Hints
- `n ≤ 20` means 2²⁰ ≈ 10⁶ subsets. Enumerating every one of them and summing it is 2ⁿ · n ≈ 2 × 10⁷ operations — well inside the limit, and exactly the size the setter chose.
- Represent a subset as the bits of an integer `mask` from 0 to 2ⁿ − 1: bit `i` set means element `i` is in the first group.
- `mask & (1 << i)` tests whether element `i` is in the subset.
- Both groups must be non-empty, so skip `mask == 0` and `mask == (1 << n) - 1`.
- If the total is odd, no split can exist — return early rather than enumerating a million subsets to find out.
- The target is `total / 2`. With `n ≤ 20` and values up to 10⁹, the total reaches 2 × 10¹⁰, so every sum here is a `long long`.
- `1 << n` for `n = 20` is fine in an `int`. `1 << 31` would not be; the habit of writing `1LL << n` costs nothing.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<long long> values(n);
    long long total = 0;
    for (long long& value : values) {
        std::cin >> value;
        total += value;                 // up to 20 * 10^9 = 2 * 10^10
    }

    // Fewer than two elements cannot make two non-empty groups, and an odd
    // total cannot be halved. Both checks avoid a pointless million-step loop.
    if (n < 2 || total % 2 != 0) {
        std::cout << "NO\n";
        return 0;
    }

    const long long half = total / 2;

    // Every subset except the empty one and the whole set.
    for (int mask = 1; mask < (1 << n) - 1; ++mask) {
        long long sum = 0;
        for (int i = 0; i < n; ++i)
            if (mask & (1 << i)) sum += values[i];
        if (sum == half) {
            std::cout << "YES\n";
            return 0;
        }
    }

    std::cout << "NO\n";
}
```

## Notes
The whole problem is in the line `1 ≤ n ≤ 20`.

Twenty is not a number a setter picks by accident. Subset-sum has no known
polynomial algorithm, so a problem asking it either keeps `n` small enough to
enumerate — around 20 to 25 — or keeps the *values* small enough for a
pseudo-polynomial DP over achievable sums, which needs the total to be at most a
few million. Here the values go up to 10⁹, so the DP is out, and `n ≤ 20` is the
other door. Reading those two constraints together names the algorithm before
you have thought about the problem at all.

The budget check: 2²⁰ masks × 20 bits is about 2 × 10⁷ operations. At a few
hundred million per second that is a fraction of the limit, and the
twenty-element case in the hidden tests is there to confirm it — those values
are chosen so that no subset sums to half, which forces every one of the
1,048,574 masks to be examined. A solution that is right but a complexity class
too slow fails on that case rather than passing quietly.

The starter is the trap this problem is built around, and it is a real one:
**an even total is necessary but not sufficient.** `{1, 1, 4}` sums to 6, half is
3, and no subset of `{1, 1, 4}` sums to 3. Checking parity alone passes the
sample and two of the other cases, which is exactly the kind of partial
correctness that feels like a solution. So is `{4}` with `n = 1` — an even total
and no possible split, because a single element cannot fill two non-empty
groups.

Two details in the loop bounds worth stating. Starting at `mask = 1` excludes the
empty group; stopping before `(1 << n) - 1` excludes the group containing
everything. Both exclusions are required by "non-empty", and both are the sort of
off-by-one that a statement communicates in a single word.

The early return on an odd total is not an optimisation for the judge — the
enumeration would finish in time anyway. It is worth writing because it states a
fact about the problem in one line, and a reader of the code learns something
from it that a million-iteration loop would not have told them.
