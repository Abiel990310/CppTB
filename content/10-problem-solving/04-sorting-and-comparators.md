---
title: "Sorting, comparators, and coordinate compression"
navTitle: "Sorting and comparators"
summary: >-
  Ordering by whatever you like, without breaking the rule that makes sorting work.
objectives:
  - Write a comparator that is a valid strict weak ordering
  - Choose between sort and stable_sort on evidence
  - Compress a large value range into small indices
status: complete
standard: c++20
requires: [contest-template]
---

Sorting is the most common first move in a solution, and not because the answer
is a sorted list. Sorting puts equal things next to each other, puts the
extremes at the ends, and makes binary search possible — so a great many
problems become easy the moment the input is in the right order.

This chapter is about ordering by something other than `<`, and about the one
rule a comparator must obey.

## The rule: strict weak ordering

`std::sort` requires its comparator to define a **strict weak ordering**. The
part that matters in practice is one word: **strict**. `comp(a, a)` must be
`false`. Two elements that compare equal must have `comp(a, b)` and
`comp(b, a)` both false.

Write `<=` where you meant `<` and the program does not merely produce a wrong
order:

```cpp run expect-ub title="A comparator that is not strict"
#include <algorithm>
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> values;
    for (int i = 0; i < 200; ++i) values.push_back(i % 5);   // lots of equal elements

    // <= is not a strict weak ordering: comp(a, a) must be false.
    std::sort(values.begin(), values.end(), [](int a, int b) { return a <= b; });

    std::printf("first %d, last %d\n", values.front(), values.back());
}
```

> ERROR: AddressSanitizer: heap-buffer-overflow

Not a wrong answer — a **read past the end of the vector**. `std::sort`'s
partitioning step advances a pointer while the comparator keeps saying "keep
going", and with `<=` a run of equal elements never says stop. The standard
calls this undefined behaviour and libstdc++ takes it literally.

The same applies to `std::max_element`, `std::set`, `std::map`, and anything
else taking a comparator. The rules a comparator must satisfy:

- **Irreflexive.** `comp(a, a)` is false.
- **Asymmetric.** If `comp(a, b)` then not `comp(b, a)`.
- **Transitive.** If `comp(a, b)` and `comp(b, c)` then `comp(a, c)`.
- **Transitive on equivalence.** If `a` and `b` are equivalent and `b` and `c`
  are equivalent, then `a` and `c` are equivalent.

In practice you get all four by building the comparator out of `<` on the keys
and never writing `<=` or `>=`.

## Ordering by several keys

The safe pattern is to compare tuples, which the library already orders
lexicographically:

```cpp run title="Three keys, one line"
#include <algorithm>
#include <cstdio>
#include <string>
#include <tuple>
#include <vector>

struct Player {
    std::string name;
    int score;
    int seconds;
};

int main() {
    std::vector<Player> players{
        {"ada", 90, 300}, {"grace", 95, 250}, {"alan", 90, 250}, {"edsger", 95, 250},
    };

    // Highest score first; then fastest; then by name.
    std::sort(players.begin(), players.end(), [](const Player& a, const Player& b) {
        return std::tie(b.score, a.seconds, a.name) < std::tie(a.score, b.seconds, b.name);
    });

    for (const Player& p : players)
        std::printf("%-8s %3d  %4ds\n", p.name.c_str(), p.score, p.seconds);
}
```

`std::tie` makes a tuple of references — no copying — and tuple comparison does
the lexicographic work. Note how "descending by score" is expressed: by swapping
`a` and `b` for that one field only, inside a comparison that is still `<`. That
keeps the ordering strict, which a hand-written chain of `>=`s very often does
not.

Writing it out by hand is the alternative, and it is longer and easier to get
wrong:

```cpp
if (a.score != b.score) return a.score > b.score;
if (a.seconds != b.seconds) return a.seconds < b.seconds;
return a.name < b.name;
```

That version *is* correct — the `!=` guards keep it strict — and it is what you
write when the keys are expensive to tie or the logic is not a simple field
comparison. What you must not write is `return a.score >= b.score;` and hope.

## `sort` or `stable_sort`

`std::sort` is introsort: quicksort, falling back to heapsort, with insertion
sort for small ranges. `std::stable_sort` is a merge sort that preserves the
original relative order of equal elements.

Two differences, both measured.

**They order equal elements differently.** With keys `i % 3` and 20 elements
tagged by their input position:

| | Equal pairs left out of original order |
|---|---|
| `std::sort` | 12 |
| `std::stable_sort` | 0 |

At 1,000 elements it is 500 against 0. `std::sort` is not "usually stable" — it
is routinely and visibly not.

**Stability costs about a third.** One million rows:

| | Time |
|---|---|
| `std::sort` | 53.8 ms |
| `std::stable_sort` | 71.5 ms |

`stable_sort` also allocates a temporary buffer, and falls back to a slower
in-place algorithm if it cannot get one.

The decision is easy once stated: **use `std::sort` unless the original order of
equal elements is part of the answer.** When it is, you have a choice — use
`stable_sort`, or add the original index as a final tie-breaking key and keep
`sort`. The second is usually better, because it makes the tie-break explicit in
the comparator instead of implicit in the algorithm, and a reader of your code
can see what the order actually is.

## Coordinate compression

Values up to 10⁹, but only 10⁵ of them. Many techniques — counting arrays,
Fenwick trees, segment trees, DP over values — need an array indexed by value,
and an array of 10⁹ is not happening.

**Coordinate compression** replaces each value by its rank among the distinct
values, which is an index into an array of size *n*.

```cpp run title="Sort, unique, lower_bound"
#include <algorithm>
#include <cstdio>
#include <vector>

int main() {
    std::vector<long long> values{1'000'000'000, 5, 1'000'000'000, -7, 42, 5, 0};

    // The distinct values, in order.
    std::vector<long long> sorted = values;
    std::sort(sorted.begin(), sorted.end());
    sorted.erase(std::unique(sorted.begin(), sorted.end()), sorted.end());

    std::printf("%zu distinct values:", sorted.size());
    for (long long v : sorted) std::printf(" %lld", v);
    std::printf("\n");

    // Each original value, as an index into that list.
    std::printf("compressed:            ");
    for (long long v : values) {
        int rank = static_cast<int>(
            std::lower_bound(sorted.begin(), sorted.end(), v) - sorted.begin());
        std::printf(" %d", rank);
    }
    std::printf("\n");
}
```

Three lines of idiom, and they are worth memorising as a unit:

```cpp
sort(v.begin(), v.end());
v.erase(unique(v.begin(), v.end()), v.end());
int rank = lower_bound(v.begin(), v.end(), x) - v.begin();
```

`std::unique` does not remove anything — it shuffles the duplicates to the end
and returns where the unique range stops, which is why the `erase` is required.
Chapter 4.5 called this the erase–remove idiom; this is its sibling.

The compression preserves order: if `a < b` then `rank(a) < rank(b)`. So any
technique that only cares about *relative* order — sorting, ranking, range
queries, "how many are smaller than this" — works identically on the compressed
values. Anything that cares about the actual magnitudes, such as summing them or
measuring gaps, does not, and needs the original values kept alongside.

:::tip
`std::lower_bound` is O(log n) **only on a random-access range**. On a
`std::set`'s iterators it compiles and is O(n) — use the member `s.lower_bound(x)`.
Chapter 10.2's table has this; it is the mistake that turns a compressed
solution back into a quadratic one.
:::

## Sorting indices instead of values

Sometimes you need the order without disturbing the data — because other arrays
are indexed in parallel, or because you need to report positions.

```cpp run title="An order, without moving anything"
#include <algorithm>
#include <cstdio>
#include <numeric>
#include <string>
#include <vector>

int main() {
    std::vector<int> score{40, 90, 10, 70};
    std::vector<std::string> name{"ada", "grace", "alan", "edsger"};

    std::vector<int> order(score.size());
    std::iota(order.begin(), order.end(), 0);        // 0, 1, 2, 3

    std::sort(order.begin(), order.end(),
              [&score](int i, int j) { return score[i] > score[j]; });

    for (int i : order) std::printf("%-8s %d\n", name[i].c_str(), score[i]);
}
```

`order` ends up holding the indices in descending score order, and neither
`score` nor `name` moved. This is the standard way to keep several parallel
arrays consistent, and it is cheaper than sorting a vector of structs when the
elements are large.

`std::iota` fills a range with consecutive values and is in `<numeric>`.

## Check yourself

:::quiz
{
  "question": "You pass `[](int a, int b){ return a <= b; }` to `std::sort` on a vector with many equal elements. What happens?",
  "options": [
    { "text": "Undefined behaviour — in practice a read past the end of the vector, which AddressSanitizer reports as a heap-buffer-overflow", "correct": true, "why": "`std::sort`'s partition advances while the comparator keeps returning true, and with `<=` a run of equal elements never stops it. This is a crash, not a wrong order." },
    { "text": "The same result as `<`, just marginally slower", "why": "It is not a valid strict weak ordering, so the algorithm's precondition is violated and no result is promised." },
    { "text": "The sort becomes stable", "why": "Stability is a property of the algorithm, not the comparator, and a broken comparator has no defined behaviour at all." },
    { "text": "A compile error", "why": "It compiles: the signature is right and only the semantics are wrong, which is what makes it dangerous." }
  ]
}
:::

:::quiz
{
  "question": "You need to sort 10^5 values up to 10^9 and then index an array by value. What is the move?",
  "options": [
    { "text": "Coordinate compression: sort a copy, `unique` and `erase` it, then replace each value with its `lower_bound` index — giving indices in [0, n)", "correct": true, "why": "An array of 10^9 is not possible; there are at most 10^5 distinct values, so their ranks fit an array of that size. The compression preserves order, which is all a rank-based technique needs." },
    { "text": "Use a `std::map<long long, ...>` keyed by value", "why": "That works and is slower by a large constant. Compression converts the problem into plain array indexing, which is the point." },
    { "text": "Divide every value by 10^4 to make it fit", "why": "That merges distinct values, which changes the answer." },
    { "text": "Sort and then use the value itself as the index", "why": "The values go up to 10^9; that is the array you cannot allocate." }
  ]
}
:::

## Practice

:::exercise comparator-audit

:::exercise compress-coordinates

:::exercise judge-sort-by-keys

:::exercise judge-count-smaller

:::recap
- A comparator must be a **strict** weak ordering: `comp(a, a)` false, asymmetric,
  transitive. `<=` violates it and produces a heap overflow, not a wrong order.
- Build multi-key comparators from `std::tie` and a single `<`, reversing the
  argument order for a descending field. Never chain `>=`.
- `std::sort` is visibly unstable — 12 of 20 equal pairs reordered in the
  measurement here — and `std::stable_sort` costs about a third more. Prefer
  `sort` plus an explicit index tie-break, so the order is stated rather than
  assumed.
- Coordinate compression is `sort`, `unique` + `erase`, then `lower_bound` for
  the rank. It preserves order, so anything rank-based is unaffected.
- `unique` does not erase; it returns the new end.
- Sort an index array with `std::iota` when the data must not move or when
  parallel arrays have to stay aligned.
:::
