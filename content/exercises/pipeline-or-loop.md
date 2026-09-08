---
id: pipeline-or-loop
title: "Which one is cheaper here"
difficulty: core
chapter: zero-cost
topics: [ranges, performance, laziness]
check: unit
standard: c++20
---

Two tasks over the same data, using the same two operations: `square`, which
counts every call, and `is_big`, which counts every call. The numbers `1..50`
are the input; `11 * 11 = 121` is the first square over 100.

- `first_big_square(v)` — the first square greater than 100, or `-1` if there is
  none. **Budget: 15 calls to `square`.**
- `sum_of_big_squares(v)` — the sum of every square greater than 100.
  **Budget: 50 calls to `square`, for 50 elements.**

Both budgets are achievable, and the two of them are not achievable the same
way. One task wants a lazy pipeline; the other wants a plain loop. Work out
which is which, then write each one that way.

## Starter
```cpp
#include <ranges>
#include <vector>

// --- given, do not change ---------------------------------------------
int transforms = 0;
int predicates = 0;

int square(int n)  { ++transforms; return n * n; }
bool is_big(int n) { ++predicates; return n > 100; }
// ----------------------------------------------------------------------

int first_big_square(const std::vector<int>& values) {
    std::vector<int> squares;
    for (int x : values) squares.push_back(square(x));
    for (int s : squares)
        if (is_big(s)) return s;
    return -1;
}

long long sum_of_big_squares(const std::vector<int>& values) {
    long long total = 0;
    for (int x : values | std::views::transform(square) | std::views::filter(is_big))
        total += x;
    return total;
}
```

## Tests
```cpp
std::vector<int> values(50);
for (int i = 0; i < 50; ++i) values[i] = i + 1;

transforms = 0; predicates = 0;
int first = first_big_square(values);
int first_transforms = transforms;
CHECK_EQ(first, 121);
CHECK(first_transforms <= 15);

transforms = 0; predicates = 0;
long long total = sum_of_big_squares(values);
int sum_transforms = transforms;
CHECK_EQ(total, 42540LL);
CHECK(sum_transforms <= 50);

// No match anywhere: still correct, and it may look at everything.
std::vector<int> small{1, 2, 3};
transforms = 0;
CHECK_EQ(first_big_square(small), -1);
CHECK_EQ(sum_of_big_squares(small), 0LL);

// Empty input: no calls at all.
std::vector<int> empty;
transforms = 0; predicates = 0;
CHECK_EQ(first_big_square(empty), -1);
CHECK_EQ(sum_of_big_squares(empty), 0LL);
CHECK_EQ(transforms, 0);
CHECK_EQ(predicates, 0);

// A match on the very first element: one transform is enough.
std::vector<int> immediate{40, 1, 2};
transforms = 0;
int early = first_big_square(immediate);
CHECK_EQ(early, 1600);
CHECK(transforms <= 2);
```

## Hints
- `first_big_square` can stop as soon as it finds one. The starter squares all fifty numbers before it looks at any of them.
- A ranges pipeline is **lazy**: `values | views::transform(square) | views::filter(is_big)` computes nothing until you iterate, and stops when you stop.
- To read just the first element of a pipeline: take `begin()`, compare it against `end()`, and dereference if they differ. Do not call `front()` on a view whose emptiness you have not checked.
- `sum_of_big_squares` has to look at every element, so laziness buys nothing — and the pipeline costs *more* than a loop. Work out why by counting: `filter` has to call the predicate on an element before you can read it.
- The loop version squares each element once into a local, tests it, and adds it. One call to each function per element.
- Do not try to satisfy both budgets with one style. That is the point of the problem.

## Solution
```cpp
#include <ranges>
#include <vector>

int transforms = 0;
int predicates = 0;

int square(int n)  { ++transforms; return n * n; }
bool is_big(int n) { ++predicates; return n > 100; }

// Lazy wins: the pipeline stops at the first match.
int first_big_square(const std::vector<int>& values) {
    auto big = values | std::views::transform(square) | std::views::filter(is_big);
    auto it = big.begin();
    return it == big.end() ? -1 : *it;
}

// The loop wins: every element must be looked at, and the loop looks once.
long long sum_of_big_squares(const std::vector<int>& values) {
    long long total = 0;
    for (int x : values) {
        int s = square(x);
        if (is_big(s)) total += s;
    }
    return total;
}
```

## Notes
The measured counts, for fifty elements:

| | `square` calls | `is_big` calls |
|---|---|---|
| `first_big_square`, eager loop | 50 | 11 |
| `first_big_square`, lazy pipeline | **12** | 11 |
| `sum_of_big_squares`, loop | **50** | 50 |
| `sum_of_big_squares`, pipeline | 90 | 50 |

Two opposite answers from the same pair of tools, and both are about the same
property: a view does exactly as much work as you ask it for, and no bookkeeping
to remember what it already did.

For `first_big_square` that is a win of four to one. The pipeline squares
elements one at a time and stops the instant `is_big` says yes — twelve calls,
not fifty. (Twelve rather than eleven because `filter_view::begin()` has to find
the first satisfying element before iteration starts, which costs one extra
evaluation.)

For `sum_of_big_squares` the same property is a loss of nearly two to one, and
the reason is worth knowing because it surprises people. In
`transform | filter`, the filter's iterator calls the predicate on
`*underlying_it` to decide whether to stop there — and then *you* dereference
the iterator to read the value, which invokes the transform a **second** time.
A view caches nothing, so every element that survives the filter is squared
twice: 50 elements plus 40 survivors is 90 calls.

That is not a bug and not a missed optimisation; it is what "views own nothing"
means. It also does not usually matter, because the transform is usually a
multiplication that the compiler inlines into the loop and the whole thing
compiles to what you would have written. It matters exactly when the transform
is expensive, which is when you were counting on it happening once.

The rule that falls out: **use a pipeline when it lets you stop early or skip
work; use a loop when every element has to be visited and the per-element work
is real.** Reversing the order of the stages — `filter | transform`, filtering
on the original values and transforming only the survivors — is the other fix,
and is worth reaching for whenever the transform is the expensive half.
