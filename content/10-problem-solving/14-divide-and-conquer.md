---
title: "Divide and conquer"
navTitle: "Divide and conquer"
summary: >-
  Split, solve, combine — and the three questions that decide whether the
  combine step is worth what the split costs.
objectives:
  - Recognise the split / solve / combine shape and its recurrence
  - Count inversions in O(n log n) by piggy-backing on a merge
  - Choose a base-case cutoff by measurement
  - Halve an exponent instead of decrementing it
  - Know when divide and conquer is the wrong tool
status: complete
standard: c++20
requires: [greedy]
---

Divide and conquer splits a problem into smaller copies of itself, solves those,
and combines the results. Merge sort and binary search are the ones everybody
meets first; the technique matters because of what you can hide in the *combine*
step.

The cost is a recurrence. Splitting into `a` pieces of size `n/b` and combining
in `f(n)` gives

```
T(n) = a·T(n/b) + f(n)
```

and the three cases you actually meet are: two halves with a linear combine
(`2T(n/2) + n`, which is `n log n` — merge sort), two halves with a constant
combine (`2T(n/2) + 1`, which is `n`), and **one** half with a constant combine
(`T(n/2) + 1`, which is `log n` — binary search, fast exponentiation). Knowing
which one you have written is usually enough.

## Free information in the combine step

Merge sort's combine step compares an element from the left half with one from
the right. When the right one is smaller, it is smaller than *every* remaining
element of the left half — and that is an inversion count, for free.

```cpp run title="Counting inversions while sorting"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Merge sort that also counts inversions: pairs i < j with a[i] > a[j].
long long sort_and_count(std::vector<int>& a, std::vector<int>& buffer,
                         int lo, int hi) {
    if (hi - lo <= 1) return 0;
    int mid = lo + (hi - lo) / 2;
    long long total = sort_and_count(a, buffer, lo, mid)
                    + sort_and_count(a, buffer, mid, hi);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        if (a[i] <= a[j]) buffer[k++] = a[i++];
        else { total += mid - i; buffer[k++] = a[j++]; }   // a[i..mid) all beat a[j]
    }
    while (i < mid) buffer[k++] = a[i++];
    while (j < hi) buffer[k++] = a[j++];
    std::copy(buffer.begin() + lo, buffer.begin() + hi, a.begin() + lo);
    return total;
}

long long count_inversions(std::vector<int> a) {
    std::vector<int> buffer(a.size());
    return sort_and_count(a, buffer, 0, static_cast<int>(a.size()));
}

long long brute(const std::vector<int>& a) {
    long long total = 0;
    for (std::size_t i = 0; i < a.size(); ++i)
        for (std::size_t j = i + 1; j < a.size(); ++j)
            if (a[i] > a[j]) ++total;
    return total;
}

int main() {
    std::printf("3 1 2 -> %lld inversions\n", count_inversions({3, 1, 2}));
    std::printf("5 4 3 2 1 -> %lld\n", count_inversions({5, 4, 3, 2, 1}));
    std::printf("1 2 3 4 5 -> %lld\n", count_inversions({1, 2, 3, 4, 5}));

    std::mt19937 rng(7);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 10);
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 8);
        if (count_inversions(v) != brute(v)) ok = false;
    }
    std::printf("2000 random arrays agree with the quadratic count: %s\n",
                ok ? "yes" : "NO");

    const int n = 100'000;
    std::vector<int> big(n);
    for (int i = 0; i < n; ++i) big[i] = static_cast<int>(i * 7919LL % 100003);

    auto t0 = std::chrono::steady_clock::now();
    long long inv = count_inversions(big);
    auto t1 = std::chrono::steady_clock::now();

    keep(inv);
    std::printf("n = %d: %lld inversions in %.1f ms "
                "(the quadratic count would do %lld comparisons)\n",
                n, inv, std::chrono::duration<double, std::milli>(t1 - t0).count(),
                static_cast<long long>(n) * (n - 1) / 2);
}
```

2,500,038,684 inversions found in 128 ms, where counting them directly would take
five billion comparisons.

The line that does it is `total += mid - i`. When `a[j]` is taken because it is
smaller than `a[i]`, every element still unconsumed in the left half — there are
`mid - i` of them — is greater than `a[j]` and sits before it, so each is an
inversion. Both halves being *sorted* is what makes that count valid, and it is
exactly the property the recursion has already established.

Two things worth noticing about the shape:

- **The answer needs `long long`.** An array of 2 × 10⁵ elements in reverse
  order has about 2 × 10¹⁰ inversions. The measurement above already exceeds
  2³¹ at n = 100,000.
- **The buffer is allocated once**, outside the recursion, and passed down.
  Allocating a `std::vector` inside a function called 2n times is the most
  common way a correct merge sort ends up slower than the quadratic solution it
  replaced.

Counting inversions is worth knowing as a *technique*, not a party trick: "how
far is this permutation from sorted", "minimum adjacent swaps to sort", and
"count pairs `i < j` with some order-reversing property" are all the same
question, and a Fenwick tree (chapter 10.31) answers it too.

## The base case is a tuning parameter

Recursion has a per-call cost, and at the bottom of a divide-and-conquer tree
almost all the calls are tiny. Stopping early and running something simple is
not a hack; it is what every production sort does.

```cpp run title="Where to stop dividing"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long calls = 0;

void merge_sort(std::vector<int>& a, std::vector<int>& buf, int lo, int hi, int cutoff) {
    ++calls;
    if (hi - lo <= cutoff) {                     // small enough: insertion sort
        for (int i = lo + 1; i < hi; ++i) {
            int v = a[i], j = i - 1;
            while (j >= lo && a[j] > v) { a[j + 1] = a[j]; --j; }
            a[j + 1] = v;
        }
        return;
    }
    int mid = lo + (hi - lo) / 2;
    merge_sort(a, buf, lo, mid, cutoff);
    merge_sort(a, buf, mid, hi, cutoff);

    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) buf[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];
    while (i < mid) buf[k++] = a[i++];
    while (j < hi) buf[k++] = a[j++];
    std::copy(buf.begin() + lo, buf.begin() + hi, a.begin() + lo);
}

int main() {
    const int n = 200'000;
    std::vector<int> base(n);
    std::mt19937 rng(1);
    for (int i = 0; i < n; ++i) base[i] = static_cast<int>(rng());

    for (int cutoff : {1, 8, 32, 128}) {
        std::vector<int> a = base, buf(n);
        calls = 0;
        auto t0 = std::chrono::steady_clock::now();
        merge_sort(a, buf, 0, n, cutoff);
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - t0).count();
        bool sorted = std::is_sorted(a.begin(), a.end());
        keep(a);
        std::printf("cutoff %3d : %7.1f ms, %8lld calls, sorted %s\n",
                    cutoff, ms, calls, sorted ? "yes" : "NO");
    }

    std::vector<int> a = base;
    auto t0 = std::chrono::steady_clock::now();
    std::sort(a.begin(), a.end());
    keep(a);
    std::printf("std::sort  : %7.1f ms\n",
                std::chrono::duration<double, std::milli>(
                    std::chrono::steady_clock::now() - t0).count());
}
```

On this page's sanitizer build: 262 ms at cutoff 1, 143 at 8, **132 at 32**, and
191 at 128 — a curve with a minimum, and half the time saved by one `if`. The
call count falls from 400,000 to 16,000.

**The `std::sort` line needs its build flags to mean anything.** Here it reports
325 ms, slower than the hand-written merge sort — and at `-O2` the same program
reports 15.6 ms for the best cutoff and 12.8 ms for `std::sort`, the other way
round. `std::sort` is a template whose comparisons are function objects; without
inlining it pays for every one of them. Chapter 7.2's rule applies with force:
**a comparison of two implementations is a comparison of two builds.** The
cutoff's *shape* survives both builds — 32 is the best in each — which is why
that part of the result is worth keeping and the absolute ranking is not.

Why insertion sort at the bottom rather than something cleverer: on a nearly
sorted run of 32 elements it does almost no work, it has no recursion, and it
touches memory in one direction. `std::sort` uses the same idea with a cutoff of
16.

## Halving instead of decrementing

The `T(n/2) + 1` case: one subproblem, constant combine, logarithmic total.

```cpp run title="x^n in 23 multiplications, not five million"
#include <bit>
#include <chrono>
#include <cstdint>
#include <cstdio>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

const std::uint64_t MOD = 1'000'000'007;

// Multiply n times.
std::uint64_t slow_pow(std::uint64_t base, std::uint64_t exp) {
    std::uint64_t result = 1;
    for (std::uint64_t i = 0; i < exp; ++i) result = result * base % MOD;
    return result;
}

// Halve the exponent each step: x^n = (x^(n/2))^2, times x if n is odd.
std::uint64_t fast_pow(std::uint64_t base, std::uint64_t exp) {
    std::uint64_t result = 1;
    base %= MOD;
    while (exp > 0) {
        if (exp & 1) result = result * base % MOD;
        base = base * base % MOD;
        exp >>= 1;
    }
    return result;
}

int main() {
    // Same answers on small exponents.
    bool agree = true;
    for (std::uint64_t e = 0; e <= 1000; ++e)
        if (slow_pow(3, e) != fast_pow(3, e)) agree = false;
    std::printf("3^e for e = 0..1000 agrees: %s\n", agree ? "yes" : "NO");

    const std::uint64_t exp = 5'000'000;
    auto t0 = std::chrono::steady_clock::now();
    std::uint64_t a = slow_pow(3, exp);
    auto t1 = std::chrono::steady_clock::now();
    std::uint64_t b = fast_pow(3, exp);
    auto t2 = std::chrono::steady_clock::now();

    keep(a); keep(b);
    std::printf("3^%llu mod 1e9+7\n", static_cast<unsigned long long>(exp));
    std::printf("  %llu multiplications %8.1f ms -> %llu\n",
                static_cast<unsigned long long>(exp),
                std::chrono::duration<double, std::milli>(t1 - t0).count(),
                static_cast<unsigned long long>(a));
    std::printf("  about %d squarings   %8.4f ms -> %llu\n",
                std::bit_width(exp),
                std::chrono::duration<double, std::milli>(t2 - t1).count(),
                static_cast<unsigned long long>(b));

    // The exponent a contest actually asks for.
    std::printf("3^1000000000000000000 mod 1e9+7 = %llu\n",
                static_cast<unsigned long long>(fast_pow(3, 1'000'000'000'000'000'000ULL)));
}
```

31 ms against 0.0008 ms, and the same answer. The last line does an exponent of
10¹⁸ — sixty squarings — instantly.

Three things about that loop.

- **It is written iteratively.** `x^n = (x^(n/2))²` is a recursion, but the
  iterative form has no call overhead and no depth limit, and it reads as "walk
  the bits of the exponent" — which is exactly what it is.
- **`std::uint64_t` throughout.** `result * base` with both under 10⁹ reaches
  10¹⁸, which fits a 64-bit type and does not fit a 32-bit one. This is the
  single most common bug in modular arithmetic.
- **The same shape works for anything associative.** Replace multiply-mod with
  matrix multiplication and you get the O(log n) Fibonacci and the linear
  recurrence solver (chapter 10.37); replace it with function composition and you
  get binary lifting (chapter 10.25).

## When it is the wrong tool

Divide and conquer is a hammer with a real cost: `log n` levels, a call per
node, and often a buffer. Sometimes a single pass does the same job.

```cpp run title="Maximum subarray, both ways"
#include <algorithm>
#include <chrono>
#include <climits>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long dc_calls = 0;

// Divide and conquer: the best subarray is entirely left, entirely right, or
// crosses the middle -- and the crossing case is a linear scan outwards.
long long best_sum(const std::vector<int>& a, int lo, int hi) {
    ++dc_calls;
    if (hi - lo == 1) return a[lo];
    int mid = lo + (hi - lo) / 2;
    long long left = best_sum(a, lo, mid);
    long long right = best_sum(a, mid, hi);

    long long run = 0, best_left = LLONG_MIN;
    for (int i = mid - 1; i >= lo; --i) { run += a[i]; best_left = std::max(best_left, run); }
    run = 0;
    long long best_right = LLONG_MIN;
    for (int i = mid; i < hi; ++i) { run += a[i]; best_right = std::max(best_right, run); }

    return std::max({left, right, best_left + best_right});
}

// Kadane: one pass, carrying the best subarray ending here.
long long kadane(const std::vector<int>& a) {
    long long best = a[0], here = a[0];
    for (std::size_t i = 1; i < a.size(); ++i) {
        here = std::max<long long>(a[i], here + a[i]);
        best = std::max(best, here);
    }
    return best;
}

int main() {
    std::mt19937 rng(5);
    bool agree = true;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 12);
        std::vector<int> v(n);
        for (int& x : v) x = static_cast<int>(rng() % 21) - 10;
        dc_calls = 0;
        if (best_sum(v, 0, n) != kadane(v)) agree = false;
    }
    std::printf("3000 random arrays: the two agree: %s\n", agree ? "yes" : "NO");

    const int n = 1'000'000;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = static_cast<int>(rng() % 201) - 100;

    dc_calls = 0;
    auto t0 = std::chrono::steady_clock::now();
    long long r1 = best_sum(a, 0, n);
    auto t1 = std::chrono::steady_clock::now();
    long long r2 = kadane(a);
    auto t2 = std::chrono::steady_clock::now();

    keep(r1); keep(r2);
    std::printf("n = %d, answer %lld\n", n, r1);
    std::printf("  divide and conquer %8.1f ms, %lld calls  (O(n log n))\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(), dc_calls);
    std::printf("  Kadane             %8.1f ms                (O(n))\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  same answer: %s\n", r1 == r2 ? "yes" : "no");
}
```

530 ms and two million calls, against 37 ms and one pass. Same answer, and the
divide-and-conquer version is fourteen times slower because it is solving an
easier problem the hard way.

The tell: **if the answer for a prefix can be extended to the next element in
O(1), you do not need to divide.** Kadane's carried state — the best subarray
ending here — is exactly that. Divide and conquer earns its keep when the combine
step needs *global* information from both halves that a left-to-right scan does
not have: merge sort's merge, the closest-pair strip, counting inversions across
the split.

Worth keeping the divide-and-conquer version in mind anyway: it generalises to
range queries, where "the best subarray inside `[l, r]`" is asked many times.
That is a segment tree storing four numbers per node, and chapter 10.32 builds
it.

:::quiz
{
  "question": "Your merge sort allocates its scratch buffer inside the recursive function — `std::vector<int> buf(hi - lo);` at the top of each call — rather than once outside. What happens?",
  "options": [
    { "text": "It stays O(n log n) in comparisons but does an allocation per call, which dominates the runtime and can make it slower than a quadratic sort on realistic sizes", "correct": true, "why": "There are about 2n calls, so 2n allocations and deallocations. Each is far more expensive than the handful of comparisons the small calls perform, and the total allocated across a level is n — the asymptotics survive, the constant does not." },
    { "text": "It becomes O(n^2) because each level copies the whole array", "why": "Each level still moves n elements in total; the buffers at one level sum to n, not n per call. The complexity is unchanged and the constant factor is what suffers." },
    { "text": "Nothing measurable: the allocator reuses the same block each time", "why": "Allocators do cache freed blocks, but the bookkeeping still runs on every call, and the pattern here is nested rather than repeated — several buffers are live at once, one per active frame." },
    { "text": "It runs out of memory, since 2n buffers are live simultaneously", "why": "Only the buffers on the current path are live, which is O(log n) of them summing to O(n). Memory is fine; time is not." }
  ]
}
:::

## Practice

:::exercise divide-audit

:::exercise fast-power

:::exercise judge-count-inversions

:::exercise judge-power-tower

:::recap
- Split, solve, combine. The recurrence tells you the cost: `2T(n/2) + n` is
  `n log n`, `2T(n/2) + 1` is `n`, and `T(n/2) + 1` is `log n`.
- The combine step can carry extra information for free. Merge sort's merge
  counts inversions with one added line: 2.5 billion of them found in 128 ms at
  n = 100,000, where the direct count needs five billion comparisons.
- The base case is a tuning parameter. Measured here: 262 ms at cutoff 1 versus
  132 ms at cutoff 32, and 400,000 calls versus 16,000.
- Any comparison against `std::sort` is a comparison of builds: it lost by 2.5×
  at `-O0` with sanitizers and won by 1.2× at `-O2`, on the same data.
- Halving the exponent turns 5,000,000 multiplications into 23 squarings —
  31 ms into 0.0008 ms — and the same shape covers matrix powers and binary
  lifting.
- If a left-to-right pass can extend its answer by one element in O(1), divide
  and conquer is the wrong tool: Kadane beat the recursive maximum-subarray by
  fourteen times.
:::
