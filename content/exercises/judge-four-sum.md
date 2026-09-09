---
id: judge-four-sum
title: "Quadruples that cancel"
difficulty: core
chapter: meet-in-the-middle
topics: [meet-in-the-middle, hashing, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Four lists of `n` integers each. Print how many quadruples `(i, j, k, l)`
satisfy `A[i] + B[j] + C[k] + D[l] == 0`. Indices are counted separately, so
equal values in different positions give different quadruples.

**Input.** The first line contains `n`. Each of the next four lines contains `n`
integers: list `A`, then `B`, then `C`, then `D`.

**Output.** One line: the number of quadruples.

**Constraints.** `1 ≤ n ≤ 400`, `|value| ≤ 10⁹`. There are up to `n⁴` = 2.56 ×
10¹⁰ quadruples, so they cannot all be examined.

## Starter
```cpp
#include <iostream>
#include <unordered_map>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<long long>> list(4, std::vector<long long>(n));
    for (auto& v : list) for (long long& x : v) std::cin >> x;

    // Every sum from the first two lists, with how many pairs produce it.
    std::unordered_map<long long, int> left;
    left.reserve(static_cast<std::size_t>(n) * n * 2);
    for (long long a : list[0]) for (long long b : list[1]) ++left[a + b];

    long long total = 0;
    for (long long c : list[2])
        for (long long d : list[3])
            if (left.find(-(c + d)) != left.end()) ++total;   // one quadruple, or many?

    std::cout << total << '\n';
}
```

## Cases

### Sample
```in
2
1 2
-2 -1
-1 2
0 2
```
```out
2
```

### every combination works
```in
2
1 1
1 1
-1 -1
-1 -1
```
```out
16
```

### all zeros
```in
1
0
0
0
0
```
```out
1
```

### nothing works
```in
1
1
2
3
4
```
```out
0
```

### a symmetric spread
```in
3
-1 0 1
-1 0 1
-1 0 1
-1 0 1
```
```out
19
```

### values at the limit
```in
1
1000000000
1000000000
-1000000000
-1000000000
```
```out
1
```

### two values, four ways
```in
2
2 -2
2 -2
2 -2
2 -2
```
```out
6
```

## Hints
- Four nested loops is `n⁴` = 2.56 × 10¹⁰ at the limit. Two nested loops twice is `2n²` = 320,000.
- Build a map from `a + b` to the **number of pairs** that produce it, then for each `c + d` look up `-(c + d)`.
- A single lookup can stand for many pairs: add `it->second`, not 1. `{1,1}` against `{1,1}` produces the sum 2 four times over.
- The second case is the one that catches it — sixteen quadruples where the starter reports four.
- Use `find` rather than `operator[]` for the lookup: `operator[]` inserts a zero entry for every miss, which at `n = 400` adds up to 160,000 useless entries.
- Values reach 10⁹ and four of them sum to 4 × 10⁹, so the arithmetic is `long long`. The count reaches `n⁴` = 2.56 × 10¹⁰, so it is `long long` too.

## Solution
```cpp
#include <iostream>
#include <unordered_map>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<long long>> list(4, std::vector<long long>(n));
    for (auto& v : list) for (long long& x : v) std::cin >> x;

    std::unordered_map<long long, int> left;
    left.reserve(static_cast<std::size_t>(n) * n * 2);
    for (long long a : list[0]) for (long long b : list[1]) ++left[a + b];

    long long total = 0;
    for (long long c : list[2])
        for (long long d : list[3]) {
            auto it = left.find(-(c + d));
            if (it != left.end()) total += it->second;        // every stored pair
        }

    std::cout << total << '\n';
}
```

## Notes
The map stores multiplicities, and the starter throws them away.

`left[s]` is how many `(a, b)` pairs sum to `s`. When a `(c, d)` pair matches,
each of those `(a, b)` pairs completes a distinct quadruple, so the contribution
is `left[-(c+d)]` and not 1. The starter answers "how many `(c, d)` pairs have at
least one partner", which is a smaller number that grows with the same inputs —
plausible, and wrong.

The `1 1 / 1 1 / -1 -1 / -1 -1` case makes it unmissable: every one of the
2 × 2 × 2 × 2 = 16 quadruples sums to zero, and the starter reports 4.

**Why this is meet in the middle.** The four lists are the "items", and the split
is `A × B` against `C × D`. Enumerating one side costs `n²`, and the other side
is scanned once against a hash table, so the total is `O(n²)` rather than
`O(n⁴)` — the same `2^(n/2)` versus `2^n` trade in different clothing. Chapter
10.15's sample measures it at `n = 60`: 329 ms against 5.5 ms, and the ratio is
`n²`.

**`find`, not `operator[]`.** `left[-(c+d)]` on a missing key inserts it with the
value 0. The answer stays correct, and the map grows by one entry per miss — at
`n = 400` that is up to 160,000 spurious entries and the rehashing that comes
with them. Chapter 10.10 has the measurement; the habit is to reach for `find`
whenever you are only reading.

**Two widths, for two reasons.** The sums are `long long` because four values of
10⁹ reach 4 × 10⁹, past a signed 32-bit integer. The *count* is `long long`
because `n⁴` at `n = 400` is 2.56 × 10¹⁰. They are independent decisions, and
getting the second one wrong is easier to miss because the arithmetic is only
`++`.

**On hashing and safety.** `std::unordered_map` with the default hash is
attackable — chapter 10.10 measures 1228 ms against 5.5 ms on adversarial keys.
Here the keys are sums of input values, so a setter can construct them; on a
judge that allows hacks, salt the hash or sort the `A × B` sums and use
`equal_range` instead, which costs a log factor and cannot be attacked.
