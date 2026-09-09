---
id: backtracking-audit
title: "Three searches that forget"
difficulty: core
chapter: recursion-and-backtracking
topics: [recursion, backtracking, algorithms]
check: unit
standard: c++20
---

Three backtracking searches. Two forget to undo a choice, and one checks the
wrong constraint.

- `subset_sum_count(a, target)` — how many subsets of `a` sum to `target`
  (the empty subset counts, and sums to 0). Never removes the element it added.
- `permutations_of(s)` — every distinct permutation of `s`, sorted. Swaps to
  make a choice and never swaps back.
- `n_queens(n)` — the number of ways to place `n` non-attacking queens on an
  `n × n` board. Checks columns and one diagonal, not both.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <vector>

long long subset_sum_count(const std::vector<int>& a, long long target) {
    std::vector<int> chosen;

    auto go = [&](auto&& self, std::size_t i) -> long long {
        if (i == a.size()) {
            long long sum = 0;
            for (int v : chosen) sum += v;
            return sum == target ? 1 : 0;
        }
        long long total = self(self, i + 1);        // skip a[i]
        chosen.push_back(a[i]);                     // choose
        total += self(self, i + 1);                 // explore
        // ... and never un-choose
        return total;
    };
    return go(go, 0);
}

std::vector<std::string> permutations_of(std::string s) {
    std::vector<std::string> out;

    auto go = [&](auto&& self, std::size_t k) -> void {
        if (k == s.size()) { out.push_back(s); return; }
        for (std::size_t i = k; i < s.size(); ++i) {
            std::swap(s[k], s[i]);                  // choose
            self(self, k + 1);                      // explore
            // ... and never un-choose
        }
    };
    go(go, 0);

    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

long long n_queens(int n) {
    std::vector<int> col(n, 0);

    auto safe = [&](int row, int c) {
        for (int r = 0; r < row; ++r)
            if (col[r] == c || row - r == c - col[r]) return false;  // one diagonal
        return true;
    };

    auto go = [&](auto&& self, int row) -> long long {
        if (row == n) return 1;
        long long total = 0;
        for (int c = 0; c < n; ++c)
            if (safe(row, c)) { col[row] = c; total += self(self, row + 1); }
        return total;
    };
    return go(go, 0);
}
```

## Tests
```cpp
// subset_sum_count
CHECK_EQ(subset_sum_count({1, 2, 3}, 3), 2LL);            // {3} and {1,2}
CHECK_EQ(subset_sum_count({1, 2, 3}, 0), 1LL);            // the empty subset
CHECK_EQ(subset_sum_count({3, -1, 1, 2}, 3), 3LL);
CHECK_EQ(subset_sum_count({-5, 5}, 0), 2LL);              // {} and {-5,5}
CHECK_EQ(subset_sum_count({1, 1, 1, 1}, 2), 6LL);
CHECK_EQ(subset_sum_count({-2, -2, 4}, 0), 2LL);
CHECK_EQ(subset_sum_count({7}, 7), 1LL);
CHECK_EQ(subset_sum_count({7}, 0), 1LL);
CHECK_EQ(subset_sum_count({-1, -2, -3}, -3), 2LL);
CHECK_EQ(subset_sum_count({}, 0), 1LL);

// permutations_of
CHECK_EQ(permutations_of("abc"),
         (std::vector<std::string>{"abc", "acb", "bac", "bca", "cab", "cba"}));
CHECK_EQ(permutations_of("aab"), (std::vector<std::string>{"aab", "aba", "baa"}));
CHECK_EQ(permutations_of("ab"), (std::vector<std::string>{"ab", "ba"}));
CHECK_EQ(permutations_of("aa"), (std::vector<std::string>{"aa"}));
CHECK_EQ(permutations_of("a"), (std::vector<std::string>{"a"}));
CHECK_EQ(permutations_of(""), (std::vector<std::string>{""}));

// n_queens
CHECK_EQ(n_queens(1), 1LL);
CHECK_EQ(n_queens(2), 0LL);
CHECK_EQ(n_queens(3), 0LL);
CHECK_EQ(n_queens(4), 2LL);
CHECK_EQ(n_queens(5), 10LL);
CHECK_EQ(n_queens(6), 4LL);
CHECK_EQ(n_queens(8), 92LL);
```

## Hints
- Every `push_back` that represents a choice needs a matching `pop_back` after the recursive call returns. The same goes for every `swap`: swap back.
- `subset_sum_count({7}, 0)` is the smallest case that catches the first bug — the "skip" branch runs first and gets the right answer, then the "take" branch leaves 7 behind for nobody.
- Restoring is what lets one shared container stand in for a private copy per branch. Without it the container describes the *union* of the choices made so far, not the current path.
- For `n_queens`, two squares share a diagonal when `row - r == c - col[r]` (going one way) **or** `row - r == col[r] - c` (going the other). The starter checks only the first.
- Equivalently, `std::abs(row - r) == std::abs(c - col[r])` covers both in one comparison.
- `n_queens(2)` should be 0 — two queens on a 2×2 board always attack — and the starter says 1, which is the fastest possible check.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <cstdlib>
#include <string>
#include <vector>

long long subset_sum_count(const std::vector<int>& a, long long target) {
    std::vector<int> chosen;

    auto go = [&](auto&& self, std::size_t i) -> long long {
        if (i == a.size()) {
            long long sum = 0;
            for (int v : chosen) sum += v;
            return sum == target ? 1 : 0;
        }
        long long total = self(self, i + 1);        // skip a[i]
        chosen.push_back(a[i]);                     // choose
        total += self(self, i + 1);                 // explore
        chosen.pop_back();                          // un-choose
        return total;
    };
    return go(go, 0);
}

std::vector<std::string> permutations_of(std::string s) {
    std::vector<std::string> out;

    auto go = [&](auto&& self, std::size_t k) -> void {
        if (k == s.size()) { out.push_back(s); return; }
        for (std::size_t i = k; i < s.size(); ++i) {
            std::swap(s[k], s[i]);                  // choose
            self(self, k + 1);                      // explore
            std::swap(s[k], s[i]);                  // un-choose
        }
    };
    go(go, 0);

    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

long long n_queens(int n) {
    std::vector<int> col(n, 0);

    auto safe = [&](int row, int c) {
        for (int r = 0; r < row; ++r)
            if (col[r] == c || std::abs(row - r) == std::abs(c - col[r])) return false;
        return true;
    };

    auto go = [&](auto&& self, int row) -> long long {
        if (row == n) return 1;
        long long total = 0;
        for (int c = 0; c < n; ++c)
            if (safe(row, c)) { col[row] = c; total += self(self, row + 1); }
        return total;
    };
    return go(go, 0);
}
```

## Notes
**The un-choose is not cleanup, it is part of the algorithm.** A backtracking
search keeps one mutable state that every branch shares, and the restore is what
makes that equivalent to giving each branch a private copy. Skip it and the
state accumulates: `chosen` ends up holding every element the search has ever
taken rather than the ones on the current path, and the answers are wrong in a
way that depends on the traversal order — which is to say, wrong in a way that
does not look like a pattern.

`subset_sum_count({7}, 0)` shows it at minimum size. The skip branch runs first
and correctly finds the empty subset; then 7 is pushed, the take branch finds
`{7}` summing to 7 rather than 0, and the 7 is never removed. With one element
the count still comes out right by luck; with `{1, 1, 1, 1}` and target 2 it does
not.

The `permutations_of` version is the same bug wearing a different container. A
swap is a choice; the second swap is the un-choice. Notice that the *sorted and
deduplicated* output makes the bug harder to see, not easier — the starter still
produces plausible-looking strings, just not the right set of them.

**A wrong constraint is not a wrong optimisation.** `n_queens`'s `safe` is
missing the anti-diagonal, so it accepts boards where two queens attack each
other, and the count comes out far too high: 2113 instead of 92 for `n = 8`, and
1 instead of 0 for `n = 2`. The check is worth deriving rather than remembering:
two squares `(r₁, c₁)` and `(r₂, c₂)` are on a common diagonal exactly when
`|r₁ − r₂| == |c₁ − c₂|`, and writing it with `std::abs` makes both directions
one comparison, which is one fewer place to leave a term out.

A note on the small case: `n_queens(2) == 0` is worth keeping as a test
precisely because it is a *negative* result. Tests that assert an answer is
found check that the search explores; tests that assert an answer is not found
check that it prunes. A search with a missing constraint passes the first kind
and fails the second.
