---
id: judge-n-queens
title: "Counting the queens"
difficulty: core
chapter: recursion-and-backtracking
topics: [recursion, backtracking, pruning, io]
check: output
standard: c++20
timeLimitMs: 4000
---

Print the number of ways to place `n` queens on an `n × n` board so that no two
attack each other. Two queens attack along a shared row, column, or diagonal.

**Input.** One line containing `n`.

**Output.** One line: the number of arrangements.

**Constraints.** `1 ≤ n ≤ 12`.

## Starter
```cpp
#include <iostream>
#include <vector>

int n;
std::vector<int> col;                     // col[r] is the column of the queen in row r

bool safe(int row, int c) {
    for (int r = 0; r < row; ++r)
        if (col[r] == c || row - r == c - col[r]) return false;
    return true;
}

long long place(int row) {
    if (row == n) return 1;
    long long total = 0;
    for (int c = 0; c < n; ++c)
        if (safe(row, c)) { col[row] = c; total += place(row + 1); }
    return total;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cin >> n;
    col.assign(n, 0);
    std::cout << place(0) << '\n';
}
```

## Cases

### Sample
```in
8
```
```out
92
```

### two queens never fit
```in
2
```
```out
0
```

### one queen
```in
1
```
```out
1
```

### three do not fit either
```in
3
```
```out
0
```

### the smallest board with a solution
```in
4
```
```out
2
```

### an odd one
```in
6
```
```out
4
```

### bigger
```in
10
```
```out
724
```

### the largest allowed
```in
12
```
```out
14200
```

## Hints
- Place one queen per row, so rows never conflict by construction and the state is just "which column in each row so far".
- Two squares `(r₁, c₁)` and `(r₂, c₂)` share a diagonal when `|r₁ − r₂| == |c₁ − c₂|`. The starter checks `row - r == c - col[r]`, which is only one of the two directions.
- `std::abs(row - r) == std::abs(c - col[r])` covers both, in one comparison with nothing to leave out.
- `n = 2` is the fastest check: two queens on a 2 × 2 board always attack, so the answer is 0. A search with a missing constraint reports 1.
- Reject a column the moment it conflicts, inside the loop — not after the board is full. At `n = 8` that is the difference between 19,173,961 nodes and 2,057, as this chapter measures.
- If you want it faster still, replace the `safe` loop with three boolean arrays (column used, diagonal used, anti-diagonal used) indexed by `c`, `row + c`, and `row - c + n`. That makes each test O(1).

## Solution
```cpp
#include <cstdlib>
#include <iostream>
#include <vector>

int n;
std::vector<int> col;

bool safe(int row, int c) {
    for (int r = 0; r < row; ++r)
        if (col[r] == c || std::abs(row - r) == std::abs(c - col[r])) return false;
    return true;
}

long long place(int row) {
    if (row == n) return 1;
    long long total = 0;
    for (int c = 0; c < n; ++c)
        if (safe(row, c)) { col[row] = c; total += place(row + 1); }   // prune here
    return total;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cin >> n;
    col.assign(n, 0);
    std::cout << place(0) << '\n';
}
```

## Notes
`row - r == c - col[r]` catches queens on the diagonal running down-and-right.
The other diagonal — down-and-left — needs `row - r == col[r] - c`, and the
starter never checks it, so it counts boards that are not solutions: 2113 for
`n = 8` instead of 92, and 1 for `n = 2` instead of 0.

Writing it as `std::abs(row - r) == std::abs(c - col[r])` is better than writing
both comparisons, for the reason most one-line simplifications are better: there
is no second term to forget. Deriving it takes ten seconds — two squares are on
a common diagonal exactly when the row distance equals the column distance —
and it is worth doing once rather than memorising a pair of inequalities.

**The negative test is the important one.** `n = 2` and `n = 3` both answer 0,
and those are the cases a broken constraint fails. Tests that assert a count is
found only check that the search explores; tests that assert nothing is found
check that it rejects. When a backtracking solution is wrong, it is usually
because it accepts too much, so the zero cases are the ones to write first.

**Where the pruning lives.** Placing a queen anywhere on every row and checking
the completed board is a valid program and a hopeless one: at `n = 8` it visits
19,173,961 nodes against 2,057, as this chapter's sample measures. The change is
purely *where* the `safe` call sits. Rejecting at row `r` eliminates every board
below it at once, so a prune near the root is worth exponentially more than one
near a leaf.

**Making it faster.** The `safe` loop is O(row) per candidate. Three boolean
arrays make it O(1):

```cpp
bool used_col[12] = {}, used_diag[24] = {}, used_anti[24] = {};
// column c, diagonal row + c, anti-diagonal row - c + n
```

Measured at `n = 12`: 910 ms against 132 ms in the sanitizer build used on this
site, and 138 ms against 53 ms at `-O2` — between two and a half and seven
times, depending on how much the build already charges for each array access.
It is not needed to pass here, and it is the standard next step when the limit
rises to `n = 14` or so.
Beyond that, the counts are looked up rather than computed — the sequence grows
about as fast as `n!`, and no amount of constant-factor work changes that.
