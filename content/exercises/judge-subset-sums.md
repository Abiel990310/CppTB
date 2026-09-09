---
id: judge-subset-sums
title: "Subsets that hit a target"
difficulty: core
chapter: recursion-and-backtracking
topics: [recursion, backtracking, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Given `n` integers and a target `S`, print how many subsets sum to exactly `S`.
The empty subset counts, and sums to 0.

**Input.** The first line contains `n` and `S`. The second line contains `n`
integers.

**Output.** One line: the number of subsets summing to `S`.

**Constraints.** `1 ≤ n ≤ 20`, `|aᵢ| ≤ 10⁹`, `|S| ≤ 2 × 10¹⁰`. The values **may
be negative.**

## Starter
```cpp
#include <iostream>
#include <vector>

int n;
long long target;
std::vector<long long> a;

long long count_from(int i, long long sum) {
    if (sum > target) return 0;              // a prune -- is it justified?
    if (i == n) return sum == target ? 1 : 0;
    return count_from(i + 1, sum) + count_from(i + 1, sum + a[i]);
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cin >> n >> target;
    a.resize(n);
    for (long long& x : a) std::cin >> x;

    std::cout << count_from(0, 0) << '\n';
}
```

## Cases

### Sample
```in
3 3
1 2 3
```
```out
2
```

### a subset that dips below its own total
```in
2 3
5 -2
```
```out
1
```

### the empty subset
```in
3 0
1 2 3
```
```out
1
```

### negatives mixed in
```in
4 3
3 -1 1 2
```
```out
3
```

### two ways to make zero
```in
2 0
-5 5
```
```out
2
```

### duplicates
```in
4 2
1 1 1 1
```
```out
6
```

### a long detour above the target
```in
3 3
10 -5 -2
```
```out
1
```

### a target no int can hold
```in
3 2000000000
1000000000 1000000000 1000000000
```
```out
3
```

### a single element and a zero target
```in
1 0
7
```
```out
1
```

## Hints
- With `n ≤ 20` there are at most 1,048,576 subsets, so plain enumeration is fast enough. The difficulty is not speed.
- Look hard at `if (sum > target) return 0;`. What does it assume about the values still to come?
- A prune is only valid if no completion of the current partial choice could still reach the target. With negative values available, a running sum above the target can come back down.
- `5 -2` with a target of 3 is the smallest counterexample: the only subset that works passes through 5 on the way.
- Delete the prune and the search is correct. If the values were guaranteed positive it would be a genuine and useful optimisation — the constraint is what licenses it.
- `S` reaches 2 × 10¹⁰ and the sums reach 2 × 10¹⁰, so both are `long long`. The *count* is at most 2²⁰ and fits an `int`, but there is no reason not to use `long long` there too.

## Solution
```cpp
#include <iostream>
#include <vector>

int n;
long long target;
std::vector<long long> a;

long long count_from(int i, long long sum) {
    if (i == n) return sum == target ? 1 : 0;
    // No prune: with negative values a partial sum above the target can return.
    return count_from(i + 1, sum) + count_from(i + 1, sum + a[i]);
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cin >> n >> target;
    a.resize(n);
    for (long long& x : a) std::cin >> x;

    std::cout << count_from(0, 0) << '\n';
}
```

## Notes
The starter is a correct search with one extra line, and the extra line is the
bug. That is worth sitting with, because it is the usual way pruning goes wrong:
the prune is not a mistake in the code, it is a claim about the *problem*, and
the claim is false here.

`if (sum > target) return 0;` says: once the running total exceeds the target,
no completion can reach it. True when every remaining value is non-negative,
because the sum can only grow. The constraints say `|aᵢ| ≤ 10⁹` with no sign
restriction, so it is false — `5 -2` with target 3 has exactly one answer and
the prune cuts it off at the first element.

This is the same reasoning as chapter 10.6's sliding window, which needs
positive values so that the window's sum is monotone, and chapter 10.5's binary
search, which needs a predicate that flips once. **A technique's precondition is
in the constraints, and the constraints are part of the statement, not
decoration.** Read them before choosing.

Two ways to prune this search legitimately:

- **If the values are all positive**, the starter's line is correct and worth
  having.
- **In general**, precompute suffix minimum and maximum sums: from index `i`,
  the reachable totals lie between `sum + minSuffix[i]` and `sum + maxSuffix[i]`.
  If the target is outside that interval, no completion reaches it. That prune
  is valid whatever the signs, and it costs one linear pass to set up.

A note on scale. `n ≤ 20` is a deliberate signal: 2²⁰ is about a million, which
is nothing, so the setter is telling you that exponential enumeration is the
intended solution. Chapter 10.1's habit of reading the limits first would have
said the same. When `n ≤ 40` appears instead, that is 10¹² and the signal is
meet-in-the-middle (chapter 10.15).
