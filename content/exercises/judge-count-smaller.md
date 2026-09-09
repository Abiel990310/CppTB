---
id: judge-count-smaller
title: "How many are smaller"
difficulty: core
chapter: sorting-and-comparators
topics: [sorting, binary-search, complexity, io]
check: output
standard: c++20
timeLimitMs: 2000
---

For each value in the input, print how many values in the whole input are
**strictly smaller** than it.

**Input.** The first line contains `n`. The second line contains `n` integers.

**Output.** `n` lines: for each input value, in input order, the count of values
strictly smaller than it.

**Constraints.** `1 ≤ n ≤ 200000`, and each value is between `-10^9` and `10^9`.

`n` is 200000. Chapter 10.1's table says what that rules out — and the starter
here is wrong twice over: it is quadratic, and it counts the wrong set.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    std::vector<int> values(n);
    for (int& x : values) std::cin >> x;

    // Quadratic, and it counts the wrong thing.
    for (int x : values) {
        int smaller = 0;
        for (int y : values)
            if (y <= x) ++smaller;
        std::cout << smaller << '\n';
    }
}
```

## Cases

### Sample
```in
5
5 1 5 3 9
```
```out
2
0
2
1
4
```

### one value
```in
1
7
```
```out
0
```

### every value the same
```in
4
2 2 2 2
```
```out
0
0
0
0
```

### the extremes of the range
```in
3
-1000000000 0 1000000000
```
```out
0
1
2
```

### descending input
```in
5
5 4 3 2 1
```
```out
4
3
2
1
0
```

### duplicates around a boundary
```in
7
3 1 3 1 2 3 1
```
```out
4
0
4
0
3
4
0
```

## Hints
- Sort a **copy** of the values. The answers must come out in input order, so the original order has to survive.
- In the sorted copy, the number of values strictly smaller than `x` is the index of the first element that is not less than `x` — which is exactly what `std::lower_bound` returns.
- `std::lower_bound(s.begin(), s.end(), x) - s.begin()` gives that index.
- `lower_bound` finds the *first* element not less than `x`, so for duplicates it lands before all of them, which is what "strictly smaller" wants. `upper_bound` would count the equal ones too.
- Sorting is O(n log n) and each query is O(log n), so the whole thing is O(n log n) — inside the budget for 200000.
- The values fit in an `int` and so do the counts, since `n ≤ 200000`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<int> values(n);
    for (int& x : values) std::cin >> x;

    std::vector<int> sorted = values;          // copy: input order must survive
    std::sort(sorted.begin(), sorted.end());

    for (int x : values) {
        // The first element not less than x is at index (count of smaller ones).
        auto position = std::lower_bound(sorted.begin(), sorted.end(), x);
        std::cout << (position - sorted.begin()) << '\n';
    }
}
```

## Notes
The starter has two independent bugs, and they fail differently.

**It counts `y <= x`**, which includes the value itself and every duplicate of
it — so "every value the same" gives 4, 4, 4, 4 where the answer is 0, 0, 0, 0.
That one the cases here catch.

**It is quadratic.** At `n = 200000` it performs 4 × 10¹⁰ comparisons, which at
a few hundred million per second is over a minute. The cases here do *not* catch
that, and it is worth being straight about why: a case large enough to time out
a quadratic solution needs tens of thousands of values, and this book's problems
carry their inputs inline in a text file. The complexity constraint in the
statement is real and a real judge would enforce it; here it is on your honour,
and the two problems in Chapter 10.2 — whose inputs are a single number — are
where a time limit does the enforcing.

The fix is the standard one for "answer many questions about a static
collection": **sort once, then answer each question in logarithmic time.** The
sort costs `n log n` and the queries cost `n log n` between them, so the whole
solution is `n log n` — about 3.5 million operations for this input rather than
40 billion.

`std::lower_bound` is doing the real work, and *which* bound is the decision
that matters. It returns an iterator to the first element **not less than** `x`,
so everything before it is strictly less — the exact quantity asked for. Its
distance from `begin()` is therefore the answer with no adjustment.

`std::upper_bound` returns the first element *greater* than `x`, so its index
counts the values equal to `x` as well. That is precisely the starter's `<=`
bug, arriving through a different door: choosing the wrong bound and writing the
wrong comparison are the same mistake, and the "every value the same" case
catches either.

Two details worth stating.

**Sort a copy.** The answers are required in input order, so the original vector
has to keep its order. Sorting in place and then looking values up gives the
right *counts* attached to the wrong *positions* — and on the sorted-descending
case, which is a permutation of an ascending one, it produces a plausible-looking
set of numbers in the wrong order.

**Nothing here needs coordinate compression.** The values reach 10⁹, so an array
indexed by value is impossible — but this problem never indexes by value. It only
ever asks about *relative order*, which sorting already gives. Compression earns
its place when you need an array slot per distinct value, as in Chapter 10.4's
`compress-coordinates`; reaching for it here would be extra code for no benefit.
