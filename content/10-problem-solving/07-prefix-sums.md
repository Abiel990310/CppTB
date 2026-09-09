---
title: "Prefix sums and difference arrays"
navTitle: "Prefix sums"
summary: >-
  Pay once up front so every range question afterwards costs two lookups — and
  the same trick run backwards, so every range update costs two writes.
objectives:
  - Answer range-sum queries in O(1) after an O(n) precomputation
  - Get the half-open index convention right, in one and two dimensions
  - Apply many range updates in O(1) each with a difference array
  - Recognise a sweep as a difference array over sparse coordinates
  - Use prefix sums where a sliding window is invalid
status: complete
standard: c++20
requires: [two-pointers]
---

The window in chapter 10.6 needed a precondition — every value positive — and
when that fails the technique does not degrade, it breaks. This chapter is the
tool that does not need it, and it is the simplest idea in the whole part: store
running totals instead of values.

Everything here follows from one line.

```
sum of a[l .. r]  ==  P[r + 1] - P[l]
```

Get that line and its index convention into your fingers and half the sequence
problems in a contest set become bookkeeping.

## Range queries

The question: given an array and many queries `(l, r)`, report the sum of each
range. The loop is the obvious answer and it is the wrong one.

```cpp run title="One pass up front, two lookups per query"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long naive(const std::vector<int>& a,
                const std::vector<std::pair<int, int>>& q) {
    long long total = 0;
    for (auto [l, r] : q) {
        long long sum = 0;
        for (int i = l; i <= r; ++i) sum += a[i];
        total += sum;
    }
    return total;
}

long long prefixed(const std::vector<int>& a,
                   const std::vector<std::pair<int, int>>& q) {
    std::vector<long long> p(a.size() + 1, 0);
    for (std::size_t i = 0; i < a.size(); ++i) p[i + 1] = p[i] + a[i];

    long long total = 0;
    for (auto [l, r] : q) total += p[r + 1] - p[l];
    return total;
}

int main() {
    const int n = 100'000, m = 2'000;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = 1 + (i * 37) % 1000;

    std::vector<std::pair<int, int>> q;
    q.reserve(m);
    for (int i = 0; i < m; ++i) {
        int l = static_cast<int>(i * 7919LL % n);
        int r = static_cast<int>(i * 104729LL % n);
        if (l > r) std::swap(l, r);
        q.emplace_back(l, r);
    }

    auto start = std::chrono::steady_clock::now();
    long long slow = naive(a, q);
    double slow_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    start = std::chrono::steady_clock::now();
    long long fast = prefixed(a, q);
    double fast_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    keep(slow); keep(fast);
    std::printf("loop per query %8.1f ms -> %lld\n", slow_ms, slow);
    std::printf("prefix sums    %8.1f ms -> %lld\n", fast_ms, fast);
    std::printf("same answer: %s\n", slow == fast ? "yes" : "no");
}
```

On this machine: about 645 ms against 3.4 ms, for 2,000 queries over 100,000
values. Note that the prefix version *includes* building the table — the O(n)
setup is inside the timed region, and it is still nearly two hundred times faster,
because the setup is one pass and the loop version is 2,000 of them.

The asymptotics say O(n + q) against O(nq). With the real contest limits —
n and q both 2 × 10⁵ — the loop version does 10¹⁰ additions and the prefix
version does 4 × 10⁵. That is not a constant factor, it is the difference
between a solution and a time limit.

## The index convention

`P` has `n + 1` entries and `P[0] = 0`. That extra slot is not a rounding
error; it is what removes every boundary case:

```
P[0] = 0
P[i + 1] = P[i] + a[i]

P[k]  ==  sum of the first k elements  ==  sum of a[0 .. k-1]
```

So `P[k]` is a *count of elements*, not an index into the array, and the sum of
the half-open range `[l, r)` is `P[r] - P[l]`. If the problem hands you an
inclusive `r`, convert once at the boundary — `P[r + 1] - P[l]` — and think in
half-open ranges everywhere else.

Two consequences worth stating flatly:

- **The empty range works.** `l == r` gives `P[l] - P[l] == 0`, no special case.
- **The whole array works.** `P[n] - P[0]` is the total, and there is no
  `P[-1]` to guard against, which is exactly what the leading zero bought.

The alternative convention — `P[i] = a[0] + … + a[i]`, no leading zero — needs
`l == 0 ? P[r] : P[r] - P[l-1]` at every use, and that ternary is where the bug
lives. Pay one integer of memory instead.

## The type is not `int`

The values fit in an `int`. Their running total does not, and prefix sums are
the single most common place this bites. Chapter 10.1 has the demonstration —
100,000 values of 10⁶ accumulated into an `int`, the sanitizer catching it, and
a judge that would not — and a prefix array is that same accumulator, stored.

The rule is mechanical, so apply it mechanically: **the prefix array is
`long long` unless you have proved otherwise.** The proof is one multiplication.
`n ≤ 2 × 10⁵` and `|a[i]| ≤ 10⁹` gives a worst case of 2 × 10¹⁴, which needs 48
bits; an `int` holds 31.

Two refinements that matter in practice:

- **Read the values into an `int` and accumulate into a `long long`.** The
  individual values fit; only the total does not. `p[i + 1] = p[i] + a[i]`
  promotes correctly because `p[i]` is already `long long`.
- **A small difference does not save you.** `P[r + 1] - P[l]` may be tiny, but
  it is computed from two entries that have already overflowed, and signed
  overflow is undefined behaviour rather than a defined wrap. There is no
  "it cancels out".


## Two dimensions

The same identity, applied twice, with inclusion–exclusion doing the corner
arithmetic.

```cpp run title="Submatrix sums by inclusion-exclusion"
#include <cstdio>
#include <vector>

int main() {
    const int rows = 6, cols = 7;
    std::vector<std::vector<int>> g(rows, std::vector<int>(cols));
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) g[r][c] = 1 + (r * 7 + c * 3) % 9;

    // p[r][c] is the sum of the rectangle [0,r) x [0,c). One extra row and
    // column of zeros removes every boundary case, exactly as in one dimension.
    std::vector<std::vector<long long>> p(rows + 1, std::vector<long long>(cols + 1, 0));
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c)
            p[r + 1][c + 1] = g[r][c] + p[r][c + 1] + p[r + 1][c] - p[r][c];

    auto rect = [&](int r0, int c0, int r1, int c1) {   // half-open [r0,r1) x [c0,c1)
        return p[r1][c1] - p[r0][c1] - p[r1][c0] + p[r0][c0];
    };

    int checked = 0;
    bool ok = true;
    for (int r0 = 0; r0 < rows; ++r0)
      for (int r1 = r0 + 1; r1 <= rows; ++r1)
        for (int c0 = 0; c0 < cols; ++c0)
          for (int c1 = c0 + 1; c1 <= cols; ++c1) {
            long long brute = 0;
            for (int r = r0; r < r1; ++r)
                for (int c = c0; c < c1; ++c) brute += g[r][c];
            if (brute != rect(r0, c0, r1, c1)) ok = false;
            ++checked;
          }

    std::printf("grid total       %lld\n", rect(0, 0, rows, cols));
    std::printf("middle 2x3 block %lld\n", rect(2, 2, 4, 5));
    std::printf("%d rectangles checked against a brute-force sum: %s\n",
                checked, ok ? "all agree" : "MISMATCH");
}
```

All 588 rectangles agree with a direct sum. Both formulas are the same shape:

- Build: `p[r+1][c+1] = g[r][c] + p[r][c+1] + p[r+1][c] - p[r][c]`. Add the two
  overlapping rectangles, subtract the part counted twice.
- Query: `p[r1][c1] - p[r0][c1] - p[r1][c0] + p[r0][c0]`. Take the big
  rectangle, cut off the strip above and the strip to the left, add back the
  corner that was cut off twice.

If you cannot remember the signs, draw the four rectangles once. It is faster
than deriving it, and you will draw it exactly once ever.

## Running it backwards: difference arrays

Prefix sums turn *queries* into O(1). Run the construction the other way and
you turn *updates* into O(1): to add 1 to every element of `[l, r]`, write
`+1` at `l` and `-1` just past `r`, and take a prefix sum at the end.

```cpp run title="Two writes per range instead of thousands"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    const int n = 100'000, m = 2'000;
    std::vector<std::pair<int, int>> updates;
    updates.reserve(m);
    for (int i = 0; i < m; ++i) {
        int l = static_cast<int>(i * 7919LL % n);
        int r = static_cast<int>(i * 104729LL % n);
        if (l > r) std::swap(l, r);
        updates.emplace_back(l, r);
    }

    // Touch every cell of every range.
    std::vector<long long> direct(n, 0);
    auto start = std::chrono::steady_clock::now();
    for (auto [l, r] : updates)
        for (int i = l; i <= r; ++i) direct[i] += 1;
    double direct_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    // Two writes per range, then one pass to turn it back into values.
    std::vector<long long> diff(n + 1, 0);
    start = std::chrono::steady_clock::now();
    for (auto [l, r] : updates) { diff[l] += 1; diff[r + 1] -= 1; }
    for (int i = 1; i < n; ++i) diff[i] += diff[i - 1];
    double diff_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    bool same = true;
    for (int i = 0; i < n; ++i) if (direct[i] != diff[i]) same = false;

    keep(direct); keep(diff);
    std::printf("write every cell %8.1f ms\n", direct_ms);
    std::printf("difference array %8.1f ms\n", diff_ms);
    std::printf("identical arrays: %s\n", same ? "yes" : "no");
}
```

About 642 ms against 1.4 ms, and the arrays come out identical. Three details
carry the technique:

- **`diff` has `n + 1` slots.** `r` can be the last index, and `diff[r + 1]`
  must have somewhere to land. The extra slot is written and never read, which
  is cheaper than branching on `r == n - 1`.
- **The final pass is the prefix sum.** `diff[i] += diff[i - 1]` in place. After
  it, `diff` holds values rather than deltas — and you cannot apply further
  range updates to it without going back.
- **It is offline.** Every update must be known before any value is read. That
  is the price, and it is why the technique is called a difference array rather
  than a data structure. If updates and queries interleave, you need a Fenwick
  tree (chapter 10.31).

## The sweep is the same array, sparsely

When the coordinates are large or not integers, do not allocate an array over
them — keep only the endpoints. That is a sweep, and it is a difference array
with a `std::map` for storage.

```cpp run title="Peak occupancy from start and end times"
#include <algorithm>
#include <cstdio>
#include <map>
#include <vector>

int main() {
    // Bookings as half-open intervals [start, end).
    std::vector<std::pair<int, int>> bookings = {
        {9, 12}, {10, 11}, {10, 13}, {12, 14}, {13, 16}, {15, 18}
    };

    // One event per endpoint: +1 where an interval starts, -1 where it ends.
    std::map<int, int> delta;
    for (auto [start, end] : bookings) { delta[start] += 1; delta[end] -= 1; }

    int active = 0, peak = 0, peak_at = 0;
    for (auto [time, change] : delta) {
        active += change;                     // prefix sum over the events
        if (active > peak) { peak = active; peak_at = time; }
        std::printf("%2d:00  %+d  -> %d in the room\n", time, change, active);
    }
    std::printf("peak %d, first reached at %d:00\n", peak, peak_at);

    // Cross-check by counting each hour directly.
    int brute = 0;
    for (int hour = 0; hour < 24; ++hour) {
        int here = 0;
        for (auto [start, end] : bookings) if (start <= hour && hour < end) ++here;
        brute = std::max(brute, here);
    }
    std::printf("hour-by-hour count agrees: %s\n", brute == peak ? "yes" : "no");
}
```

Peak 3, first reached at 10:00, and the hour-by-hour count agrees.

Look at 12:00 and 13:00 in the output: the change is `+0`. One booking ends at
12 and another starts at 12, and the two events cancel in the same map slot.
That is the half-open convention paying off again — a room vacated at 12 and
occupied at 12 holds one person, not two, and writing `-1` at `end` rather than
at `end + 1` is what encodes it. If the problem says the intervals are closed
and a shared endpoint *does* count as an overlap, convert at the boundary by
writing the `-1` at `end + 1`, and say so in a comment. This one decision is the
whole difficulty of most interval problems.

Ordering matters and `std::map` gives it for free: keys come out sorted, and
the `+1` and `-1` at one coordinate have already been summed into a single
entry, so there is no "process ends before starts" tie-break to get wrong.
Sorting a vector of events is faster (chapter 10.4) but then the tie-break is
yours to write.

## Where a window cannot go

Chapter 10.6 ended on the case that breaks the sliding window: negative values.
"How many contiguous subarrays sum to exactly `k`" has no monotonicity for a
window to exploit — but it is one identity away from prefix sums.

If `P[i]` is the prefix sum, then `sum(a[j .. i-1]) == P[i] - P[j]`, so a
subarray ending just before `i` sums to `k` exactly when `P[j] == P[i] - k`.
Count how many earlier prefixes had that value.

```cpp run title="Subarray counting with a prefix-sum frequency map"
#include <cstdio>
#include <unordered_map>
#include <vector>

// Number of contiguous subarrays whose sum is exactly k. Values may be negative.
long long count_subarrays(const std::vector<int>& a, long long k) {
    std::unordered_map<long long, int> seen;
    seen[0] = 1;                          // the empty prefix
    long long running = 0, total = 0;

    for (int x : a) {
        running += x;
        auto it = seen.find(running - k);  // P[j] == P[i] - k  =>  sum(j..i-1) == k
        if (it != seen.end()) total += it->second;
        ++seen[running];
    }
    return total;
}

int main() {
    std::vector<int> a = {3, 4, -7, 1, 3, 3, 1, -4};
    std::printf("subarrays summing to 7: %lld\n", count_subarrays(a, 7));
    std::printf("subarrays summing to 0: %lld\n", count_subarrays(a, 0));

    long long brute = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        long long s = 0;
        for (std::size_t j = i; j < a.size(); ++j) { s += a[j]; if (s == 0) ++brute; }
    }
    std::printf("brute force agrees on 0: %s\n",
                brute == count_subarrays(a, 0) ? "yes" : "no");
}
```

Four subarrays sum to 7 and three sum to 0, confirmed against the quadratic
count.

`seen[0] = 1` is the line everyone forgets. Without it, a subarray that starts
at index 0 is never counted, because the prefix it needs to match is the empty
one. It is the same leading zero as `P[0] = 0`, in a different container.

Two variations fall out of the same identity, and it is worth seeing that they
are the same problem:

- **Sum divisible by `m`:** two prefixes give a divisible range exactly when
  they are congruent mod `m`. Key the map on `((running % m) + m) % m` — the
  double modulus because `%` on a negative left operand is negative in C++.
- **Longest range with sum `k`:** store the *first* index at which each prefix
  value appeared (`seen.emplace(running, i)`, which does nothing if the key is
  already there) and take `i - seen[running - k]`.

## The shape to recognise

The decision is quick once you have seen it:

| The problem says | Reach for |
|---|---|
| Many range-sum queries, array never changes | Prefix sums |
| Many range updates, all known up front, then read | Difference array |
| Intervals, "how many overlap", large coordinates | Sweep over endpoints |
| Contiguous subarrays with an exact property, values may be negative | Prefix sums + a hash map |
| Contiguous subarray, monotone property, all values positive | Sliding window (10.6) |
| Updates and queries interleaved | Fenwick tree (10.31) |

:::quiz
{
  "question": "You build `P` with `P[i + 1] = P[i] + a[i]` and answer `P[r + 1] - P[l]`. The array holds up to 2·10^5 values, each up to 10^9 in magnitude, and `P` is a `std::vector<int>`. What happens?",
  "options": [
    { "text": "Signed overflow — undefined behaviour — once the running total passes 2^31, and the wrong answers it produces can still look plausible", "correct": true, "why": "The worst-case total is 2·10^14, which needs 48 bits. The values fit in an `int`; their running total does not, and nothing warns you at runtime without a sanitizer." },
    { "text": "It is fine, because each individual value fits in an `int`", "why": "The prefix array stores totals, not values. That is the whole point of it." },
    { "text": "It is fine, because the differences `P[r+1] - P[l]` are small", "why": "The difference may be small, but it is computed from two entries that have already wrapped, and wrapping is undefined behaviour rather than a well-defined truncation." },
    { "text": "The compiler promotes the arithmetic to 64 bits because the result is stored in a wider type later", "why": "C++ never widens arithmetic based on what the result is used for. `int + int` is `int` arithmetic, and the overflow happens before any conversion." }
  ]
}
:::

## Practice

:::exercise prefix-audit

:::exercise prefix-map-counts

:::exercise judge-range-queries

:::exercise judge-max-overlap

:::recap
- `P[0] = 0` and `P[i + 1] = P[i] + a[i]`; then `sum(a[l .. r]) == P[r + 1] - P[l]`.
  The leading zero is what removes every boundary case, in one dimension and two.
- Prefix arrays hold totals, so they are `long long` unless you have proved
  otherwise. Multiply `n` by `max|a[i]|` before choosing the type.
- Measured here: 2,000 range queries over 100,000 values took 645 ms by looping
  and 3.4 ms with a prefix table that was built inside the timed region.
- A difference array is the construction run backwards: `+d` at `l`, `-d` at
  `r + 1`, one prefix pass at the end. 642 ms of range updates became 1.4 ms.
  The cost is that it is offline — every update must be known before any read.
- A sweep is a difference array over sparse coordinates. Half-open intervals
  make a shared endpoint cancel, which is almost always the behaviour you want;
  decide it deliberately and write it in a comment.
- With negative values a sliding window is invalid, but `P[i] - P[j] == k` plus
  a frequency map counts subarrays in one pass. Seed the map with `seen[0] = 1`.
:::
