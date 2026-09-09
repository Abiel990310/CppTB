---
id: judge-kth-smallest
title: "The k-th smallest, many times"
difficulty: core
chapter: binary-search
topics: [sorting, binary-search, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Answer `q` queries about one fixed array. Each query gives `k`; print the
`k`-th smallest value, counting duplicates and starting from 1.

**Input.** The first line contains `n` and `q`. The second line contains `n`
integers. The third line contains `q` values of `k`.

**Output.** `q` lines, one answer per query, in the order the queries are given.

**Constraints.** `1 ≤ n, q ≤ 200000`, `1 ≤ k ≤ n`, and each value is between
`-10^9` and `10^9`.

Answering one query from scratch is easy. Answering 200000 of them is the
problem.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    std::cin >> n >> q;

    std::vector<int> values(n);
    for (int& x : values) std::cin >> x;

    while (q--) {
        int k;
        std::cin >> k;

        // Correct, and it re-sorts for every single query.
        std::vector<int> sorted = values;
        std::sort(sorted.begin(), sorted.end());
        std::cout << sorted[k] << '\n';
    }
}
```

## Cases

### Sample
```in
5 3
5 1 5 3 9
1 3 5
```
```out
1
5
9
```

### one value, one query
```in
1 1
42
1
```
```out
42
```

### every k, in order
```in
4 4
-1000000000 1000000000 0 7
1 2 3 4
```
```out
-1000000000
0
7
1000000000
```

### duplicates everywhere
```in
6 2
3 3 3 3 3 3
1 6
```
```out
3
3
```

### queries out of order
```in
5 5
10 20 30 40 50
5 1 4 2 3
```
```out
50
10
40
20
30
```

### negative values only
```in
3 3
-5 -1 -3
1 2 3
```
```out
-5
-3
-1
```

## Hints
- The array never changes, so sorting it is work that only needs doing once.
- Sort before the query loop, then each query is a single indexed read.
- `k` is 1-based and array indices are 0-based, so the answer is `sorted[k - 1]`. The starter reads `sorted[k]`, which is off by one and reads out of bounds when `k == n`.
- Queries are not in increasing order, and the answers must come out in the order the queries were given — so answer each one as you read it.
- After sorting, no binary search is needed at all: the k-th smallest is at a known index. Binary search would be the tool if the query were "how many are below x" instead.
- Keep `sync_with_stdio(false)` and `'\n'`: this problem has up to 400000 numbers of input and 200000 lines of output.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    if (!(std::cin >> n >> q)) return 0;

    std::vector<int> values(n);
    for (int& x : values) std::cin >> x;

    std::sort(values.begin(), values.end());     // once, not per query

    while (q--) {
        int k;
        std::cin >> k;
        std::cout << values[k - 1] << '\n';      // k is 1-based
    }
}
```

## Notes
Two bugs, and only one of them is about speed.

**The off-by-one is the one the cases catch.** `k` is 1-based by the statement,
so `sorted[k]` is one too far — and when `k == n` it reads one past the end of
the vector, which is undefined behaviour that on this site's build usually
returns whatever is in the capacity slack rather than crashing. The "every k, in
order" case has `k = n` in it precisely for that reason. Getting 1-based input
into 0-based indexing right is a tax on every problem in this part; the habit
worth building is to subtract at the point of use and never store a decremented
copy, so there is exactly one place where the convention changes.

**Re-sorting per query is the shape error.** The array is fixed, so the sort is
loop-invariant work: `q` sorts of `n` elements is `q · n log n`, which at the
limits is 200000 × 200000 × 18 ≈ 7 × 10¹¹. Hoisting it out gives one sort plus
`q` constant-time reads — `n log n + q`, about 4 × 10⁶. As with `judge-count-smaller`,
the cases here are too small to time that out; the constraints are what say it,
and Chapter 10.2's doubling test is how you would find it.

The general move is worth naming, because it recurs for the rest of this part:
**preprocess once, then answer each query cheaply.** Sorting is the simplest
instance. Prefix sums (Chapter 10.7) are the next, sparse tables (10.34) and
segment trees (10.32) the more powerful ones. The question to ask of any
query problem is always the same — what can I compute once that makes every
query easy?

Note what this problem does *not* need. Having sorted, the k-th smallest is at
index `k - 1` by definition; there is nothing to search for. Binary search would
be the tool for the inverse question — "how many values are below x" — which is
`judge-count-smaller`. Recognising which of the two you have been asked is worth
more than knowing either technique.
