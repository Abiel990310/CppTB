---
title: "Binary search: on a range, and on the answer"
navTitle: "Binary search"
summary: >-
  Halving a sorted range, and the larger trick of halving the space of possible answers.
objectives:
  - Use lower_bound, upper_bound and equal_range correctly
  - Write a binary search whose invariant you can state
  - Recognise a problem where the answer itself can be searched for
status: complete
standard: c++20
requires: [sorting-and-comparators]
---

Binary search is two techniques wearing one name. The first is finding a value
in a sorted array, which the standard library already does. The second is
finding the boundary of a *monotone predicate* — and that one turns a large
class of "what is the smallest X such that…" problems into twenty iterations of
a loop.

The second is what makes this chapter worth its length. The first is what you
have to get exactly right before it works.

## The library's four

Every one of these needs a range that is **sorted with respect to the same
comparison** you are searching with. On an unsorted range they compile, run, and
return nonsense.

```cpp run title="Four questions about a sorted range"
#include <algorithm>
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> v{1, 3, 3, 3, 5, 8};

    // Is it there at all?
    std::printf("binary_search(3): %d   binary_search(4): %d\n",
                std::binary_search(v.begin(), v.end(), 3),
                std::binary_search(v.begin(), v.end(), 4));

    // First element not less than x -> how many are strictly smaller.
    auto low = std::lower_bound(v.begin(), v.end(), 3);
    // First element greater than x -> how many are less than or equal.
    auto high = std::upper_bound(v.begin(), v.end(), 3);

    std::printf("lower_bound(3) at index %ld, upper_bound(3) at index %ld\n",
                low - v.begin(), high - v.begin());
    std::printf("count of 3s: %ld\n", high - low);

    // Both at once.
    auto [first, last] = std::equal_range(v.begin(), v.end(), 3);
    std::printf("equal_range(3): [%ld, %ld)\n", first - v.begin(), last - v.begin());

    // A value that is absent: both bounds land at the insertion point.
    auto missing = std::lower_bound(v.begin(), v.end(), 4);
    std::printf("lower_bound(4) at index %ld, and *it == %d\n",
                missing - v.begin(), *missing);
}
```

The distinction that matters:

| | Returns |
|---|---|
| `lower_bound(x)` | first element **not less than** `x` — so `>= x` |
| `upper_bound(x)` | first element **greater than** `x` |
| `equal_range(x)` | both, as a pair |
| `binary_search(x)` | just whether `x` is present |

`lower_bound` is the one you want almost always: its index is the count of
elements strictly smaller, it is where `x` would be inserted to keep the range
sorted, and it points at `x` itself when `x` is present.

:::warning
`lower_bound` returns `end()` when every element is smaller than `x`.
Dereferencing it is undefined behaviour, and the sanitizers will not always
catch it because `end()` may be a valid address inside the allocation. Always
check `it != v.end()` before reading through it — and check `*it == x` too,
because "not less than" is not "equal to".
:::

## Writing one, with an invariant

The library's version is enough for a sorted array. For everything else you
write the loop, and the way to write it correctly is to state the invariant
first.

**The invariant:** the answer is always in `[lo, hi]`. Every iteration shrinks
that interval without ever excluding the answer, and the loop ends when it holds
exactly one value.

```cpp run title="The shape to memorise"
#include <cstdio>
#include <vector>

// The smallest index i such that v[i] >= target, or v.size() if none.
std::size_t first_at_least(const std::vector<int>& v, int target) {
    std::size_t lo = 0;
    std::size_t hi = v.size();          // one past the last candidate

    while (lo < hi) {                   // invariant: the answer is in [lo, hi]
        std::size_t mid = lo + (hi - lo) / 2;
        if (v[mid] >= target) hi = mid;         // mid is a candidate; keep it
        else                  lo = mid + 1;     // mid is not; discard it
    }
    return lo;                          // lo == hi: one candidate left
}

int main() {
    std::vector<int> v{1, 3, 3, 3, 5, 8};
    for (int target : {0, 1, 3, 4, 8, 9})
        std::printf("first index with value >= %d: %zu\n", target, first_at_least(v, target));
}
```

Four rules make this loop correct, and breaking any one of them causes an
infinite loop or an off-by-one:

1. **`hi` starts one past the last candidate**, so `[lo, hi)` is the search
   space and `hi` is a legitimate answer meaning "none of them".
2. **`while (lo < hi)`**, not `<=`. With `hi` exclusive, `lo == hi` means the
   space is empty and the answer is `lo`.
3. **`hi = mid` when `mid` is a candidate** — never `mid - 1`, which would
   discard a possible answer.
4. **`lo = mid + 1` when it is not** — never `lo = mid`, which does not shrink
   the interval when `lo` and `hi` are adjacent, and hangs.

Write it this way every time and the off-by-one questions stop arising. The
version that asks "should this be `mid` or `mid ± 1`" case by case is the
version that has a bug in it somewhere.

## The midpoint overflows

```cpp run expect-ub title="The bug that was in the JDK for nine years"
#include <cstdio>

int main() {
    int lo = 2'000'000'000;
    int hi = 2'000'000'001;

    int mid = (lo + hi) / 2;            // 4 * 10^9 does not fit in an int
    std::printf("mid = %d\n", mid);
}
```

> runtime error: signed integer overflow: 2000000000 + 2000000001 cannot be
> represented in type 'int'

It prints `-147483647` — a midpoint outside the range, which indexes out of
bounds or loops forever. Josh Bloch found this in `java.util.Arrays.binarySearch`
in 2006, where it had been since 1997 and had been copied out of a textbook.

`lo + (hi - lo) / 2` cannot overflow when `lo <= hi`, because `hi - lo` is at
most the range size. Write it that way always; it costs nothing and removes a
whole category of bug.

This matters far more in the next section than it does when searching an array,
because there `hi` is a *value* rather than an index and can be 10¹⁸.

## Binary search on the answer

Here is the technique that earns the chapter.

Many problems ask for the smallest (or largest) value satisfying some condition,
where the condition is **monotone**: if a value works, everything larger works
too. When that holds, you do not need to *compute* the answer. You need only be
able to *check* a candidate, and then you can search for the boundary.

The recipe:

1. Identify the candidate answers and check that the predicate is monotone:
   `false, false, …, false, true, true, …, true`.
2. Write `feasible(x)` — can it be done with `x`?
3. Binary search for the first `x` where `feasible(x)` is true.

The cost is `log(range)` calls to `feasible`, which for a range of 10¹⁸ is sixty.

```cpp run title="The smallest capacity that finishes in time"
#include <cstdio>
#include <vector>

// Packages must ship in their given order, at most `capacity` per day.
// Can they all go within `days` days?
bool feasible(const std::vector<int>& weights, int days, long long capacity) {
    long long used = 1;
    long long load = 0;
    for (int w : weights) {
        if (w > capacity) return false;        // one package alone will not fit
        if (load + w > capacity) { ++used; load = 0; }
        load += w;
    }
    return used <= days;
}

long long min_capacity(const std::vector<int>& weights, int days) {
    long long lo = 1;                           // any capacity below 1 is useless
    long long hi = 0;
    for (int w : weights) hi += w;              // one day for everything always works

    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (feasible(weights, days, mid)) hi = mid;   // mid works; look lower
        else                              lo = mid + 1;
    }
    return lo;
}

int main() {
    std::vector<int> weights{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    for (int days : {1, 2, 3, 5, 10})
        std::printf("%2d days -> capacity %lld\n", days, min_capacity(weights, days));
}
```

Ten days needs a capacity of 10 — the largest single package. One day needs 55,
the total. The interesting values are in between, and no formula produces them:
`feasible` is a greedy simulation, and the search finds the boundary between
"too small" and "enough".

Notice what made this work. Nothing about the problem is sorted. What is
monotone is the *predicate*: if capacity 20 is enough, so is 21. That is the
only property the technique needs.

**How to spot one.** The signals are: the question says "minimum X such that" or
"maximum X such that"; checking a candidate is much easier than constructing the
optimum; and the answer's range is large but bounded. Chapter 10.1's constraint
table points here too — an answer bounded by 10¹⁸ with a one-second limit leaves
room for about sixty checks and nothing else.

:::pitfall
The predicate must be monotone, and it is worth *proving* rather than assuming.
"The largest k such that some k elements sum to at most S" is monotone; "the
largest k such that exactly k elements sum to S" is not, and binary search on it
returns a confident wrong answer. When you cannot state why a smaller candidate
must also work, the technique does not apply.
:::

## Searching a real-valued answer

When the answer is a `double`, halving cannot terminate exactly. Fix the
iteration count instead:

```cpp
double lo = 0, hi = 1e9;
for (int step = 0; step < 100; ++step) {        // 100 halvings, not a condition
    double mid = lo + (hi - lo) / 2;
    if (feasible(mid)) hi = mid; else lo = mid;
}
// lo and hi now agree to far more precision than any judge asks for
```

A hundred iterations divides the interval by 2¹⁰⁰, which is beyond `double`'s
precision long before it finishes — so a hundred is a safe number to write
without thinking. A `while (hi - lo > 1e-9)` condition is the version that hangs
when the interval cannot get that small in floating point.

## Check yourself

:::quiz
{
  "question": "`std::lower_bound` on a sorted vector returns an iterator. When can you dereference it safely?",
  "options": [
    { "text": "Only after checking it is not `end()` — and if you want to know whether the value is present, also that `*it == x`", "correct": true, "why": "It returns the first element *not less than* x, which is `end()` when every element is smaller, and points at a larger element when x is absent." },
    { "text": "Always; it returns a valid element or the closest one", "why": "There is no closest element when x is larger than everything, and it returns `end()`." },
    { "text": "Only when `binary_search` returned true first", "why": "That works but does the search twice. Checking the iterator is one search." },
    { "text": "Always, provided the range is sorted", "why": "Sortedness is required for a meaningful answer, and does not prevent `end()`." }
  ]
}
:::

:::quiz
{
  "question": "A problem asks for the minimum capacity such that a job finishes in D days. What makes binary search applicable?",
  "options": [
    { "text": "The predicate is monotone — if capacity c is enough, every larger capacity is too — so the feasible values form one contiguous block with a boundary to find", "correct": true, "why": "Nothing needs to be sorted. Monotonicity of `feasible` is the whole requirement, and checking a candidate is usually far easier than constructing the optimum." },
    { "text": "The input is sorted", "why": "It need not be, and in this problem the package order is fixed and arbitrary." },
    { "text": "The answer can be computed with a formula", "why": "If it could, you would use the formula. The technique exists for when it cannot." },
    { "text": "The range of answers is small", "why": "The opposite: the technique is most valuable when the range is huge, because log2(10^18) is only 60." }
  ]
}
:::

## Practice

:::exercise bounds-audit

:::exercise search-the-answer

:::exercise judge-min-capacity

:::exercise judge-kth-smallest

:::recap
- `lower_bound` gives the first element `>= x`; `upper_bound` the first `> x`;
  their gap is the count of `x`. `lower_bound`'s index is the number of elements
  strictly smaller.
- All of them need the range sorted by the same comparison, and any of them can
  return `end()`.
- Write the loop with `hi` exclusive, `while (lo < hi)`, `hi = mid` for a
  candidate and `lo = mid + 1` for a non-candidate. State the invariant — the
  answer is in `[lo, hi]` — and the off-by-ones stop.
- `mid = lo + (hi - lo) / 2`, never `(lo + hi) / 2`. The second overflows, as it
  did in the JDK for nine years.
- Binary search on the *answer* needs only a monotone predicate, not a sorted
  input: find the boundary between "not enough" and "enough" with about sixty
  checks for a range of 10¹⁸.
- Prove monotonicity rather than assuming it; a non-monotone predicate gives a
  confident wrong answer.
- For a real-valued answer, run a fixed hundred iterations rather than testing a
  tolerance.
:::
