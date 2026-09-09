---
id: judge-count-inversions
title: "How far from sorted"
difficulty: core
chapter: divide-and-conquer
topics: [divide-and-conquer, sorting, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print the number of inversions in an array — pairs of positions `i < j` with
`a[i] > a[j]`.

**Input.** The first line contains `n`. The second line contains `n` integers.

**Output.** One line: the number of inversions.

**Constraints.** `1 ≤ n ≤ 200000`, `|aᵢ| ≤ 10⁹`. Values may repeat, and equal
values are **not** an inversion.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

std::vector<int> a, buf;

long long sort_and_count(int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = lo + (hi - lo) / 2;
    long long total = sort_and_count(lo, mid) + sort_and_count(mid, hi);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        if (a[i] <= a[j]) buf[k++] = a[i++];
        else { total += 1; buf[k++] = a[j++]; }      // one inversion, or more?
    }
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    std::copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
    return total;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    a.resize(n);
    for (int& x : a) std::cin >> x;
    buf.resize(n);

    std::cout << sort_and_count(0, n) << '\n';
}
```

## Cases

### Sample
```in
3
3 1 2
```
```out
2
```

### fully reversed
```in
5
5 4 3 2 1
```
```out
10
```

### already sorted
```in
5
1 2 3 4 5
```
```out
0
```

### a longer reversal
```in
10
10 9 8 7 6 5 4 3 2 1
```
```out
45
```

### equal values are not inversions
```in
3
2 2 2
```
```out
0
```

### one element
```in
1
7
```
```out
0
```

### large values
```in
4
1000000000 1 1000000000 1
```
```out
3
```

### mixed signs
```in
6
-1 5 -3 4 0 2
```
```out
7
```

## Hints
- Merge sort, with one extra line in the merge. Both halves are already sorted when the merge runs — that is what makes the counting cheap.
- When you take `a[j]` from the right half because it is smaller than `a[i]`, it is smaller than **every** element still waiting in the left half, and all of them came before it. That is `mid - i` inversions, not one.
- `{5, 4, 3, 2, 1}` has 10 inversions; counting one per merge step gives 7, which is close enough to look plausible and is wrong.
- Equal values must not count, which is why the comparison is `a[i] <= a[j]` — taking from the left on a tie.
- The answer reaches `n(n-1)/2`, which is about 2 × 10¹⁰ at the stated limit. It is a `long long`.
- Allocate the scratch buffer once, outside the recursion. A `std::vector` constructed inside a function called 2n times costs more than the sorting does.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

std::vector<int> a, buf;

long long sort_and_count(int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = lo + (hi - lo) / 2;
    long long total = sort_and_count(lo, mid) + sort_and_count(mid, hi);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        if (a[i] <= a[j]) buf[k++] = a[i++];
        else { total += mid - i; buf[k++] = a[j++]; }   // all the waiting left elements
    }
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    std::copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
    return total;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    a.resize(n);
    for (int& x : a) std::cin >> x;
    buf.resize(n);

    std::cout << sort_and_count(0, n) << '\n';
}
```

## Notes
`total += 1` against `total += mid - i` — one term, and it is the whole problem.

The merge takes `a[j]` when `a[j] < a[i]`. The left half is sorted, so
`a[i] ≤ a[i+1] ≤ … ≤ a[mid-1]`, and all of them exceed `a[j]`; they also all
occupy positions before `j` in the original array. So this single step has
discovered `mid - i` inversions at once. Counting one is counting *merge steps
won by the right half*, which is a smaller number that happens to grow with
disorder — plausible enough to pass the reversed-array test by luck if you only
try `n = 2`.

The key phrase is "the left half is sorted". That is not an assumption; it is
what the recursive call has already accomplished. Divide-and-conquer combine
steps are cheap precisely because they may rely on the guarantee the recursion
provides, and writing that guarantee down is usually how you find the formula.

**The width.** `n(n-1)/2` at `n = 2 × 10⁵` is 19,999,900,000 — five times what a
signed 32-bit integer holds. The array elements stay `int`; the count does not.
This is the same lesson as chapter 10.7's prefix sums, and it shows up here in a
place that looks like a loop counter.

**The buffer.** Declaring `std::vector<int> buf(hi - lo);` at the top of
`sort_and_count` is correct and costs an allocation on each of the ~2n calls. It
does not change the complexity — the buffers on any one level of the recursion
sum to `n` — but it dominates the runtime, and it is the usual reason a
hand-written merge sort disappoints. One buffer, allocated once, indexed by the
same `lo`/`hi` as the array.

**Two other routes to the same answer.** A Fenwick tree over compressed values
(chapters 10.4 and 10.31) counts, for each element, how many larger values came
before it — also O(n log n), and the natural choice when the problem asks for
something the merge cannot carry. And a `std::set` with `order_of_key` is what
this looks like in languages with an order-statistic tree; C++'s standard
library does not have one, which is why the merge or the Fenwick tree is the
answer here.
