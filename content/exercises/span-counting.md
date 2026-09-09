---
id: span-counting
title: "Counting subarrays by their extreme"
difficulty: stretch
chapter: monotonic-stacks
topics: [monotonic-stack, counting, algorithms]
check: unit
standard: c++20
---

Three functions that use previous- and next-span computations to count or
maximise over every contiguous subarray without enumerating them.

- `sum_of_minimums(a)` — the sum, over every contiguous subarray, of that
  subarray's minimum.
- `sum_of_maximums(a)` — the same with maxima.
- `max_min_times_length(a)` — the largest value of (minimum of a subarray) ×
  (its length).

**Two of the three are wrong and one is already correct.** Working out which is
the exercise: all three use a strict comparison on both sides, and that is fatal
for one kind of question and harmless for the other.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

// left[i]: how far a[i] reaches left before something smaller stops it.
// right[i]: how far it reaches right. Both use a strict comparison here.
long long sum_of_minimums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long total = 0;
    for (int i = 0; i < n; ++i) total += a[i] * left[i] * right[i];
    return total;
}

long long sum_of_maximums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] <= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {
        while (!stack.empty() && a[stack.back()] <= a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long total = 0;
    for (int i = 0; i < n; ++i) total += a[i] * left[i] * right[i];
    return total;
}

long long max_min_times_length(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long best = 0;
    for (int i = 0; i < n; ++i)
        best = std::max(best, a[i] * (left[i] + right[i] - 1));
    return best;
}
```

## Tests
```cpp
// sum_of_minimums
CHECK_EQ(sum_of_minimums({3, 1, 2, 1, 4}), 21LL);
CHECK_EQ(sum_of_minimums({1, 2, 3}), 10LL);
CHECK_EQ(sum_of_minimums({3, 3, 3}), 18LL);
CHECK_EQ(sum_of_minimums({2, 1, 2}), 8LL);
CHECK_EQ(sum_of_minimums({4, 2, 4, 2, 4}), 36LL);
CHECK_EQ(sum_of_minimums({5}), 5LL);
CHECK_EQ(sum_of_minimums({}), 0LL);

// sum_of_maximums
CHECK_EQ(sum_of_maximums({3, 1, 2, 1, 4}), 42LL);
CHECK_EQ(sum_of_maximums({1, 2, 3}), 14LL);
CHECK_EQ(sum_of_maximums({3, 3, 3}), 18LL);
CHECK_EQ(sum_of_maximums({2, 1, 2}), 11LL);
CHECK_EQ(sum_of_maximums({4, 2, 4, 2, 4}), 56LL);
CHECK_EQ(sum_of_maximums({5}), 5LL);
CHECK_EQ(sum_of_maximums({}), 0LL);

// max_min_times_length
CHECK_EQ(max_min_times_length({3, 1, 2, 1, 4}), 5LL);
CHECK_EQ(max_min_times_length({1, 2, 3}), 4LL);
CHECK_EQ(max_min_times_length({3, 3, 3}), 9LL);
CHECK_EQ(max_min_times_length({2, 1, 2}), 3LL);
CHECK_EQ(max_min_times_length({4, 2, 4, 2, 4}), 10LL);
CHECK_EQ(max_min_times_length({5}), 5LL);
CHECK_EQ(max_min_times_length({}), 0LL);
```

## Hints
- Start with `{3, 3, 3}`. The true sum of minimums is 18, over six subarrays; the starter returns 30. Work out where the extra 12 comes from and the pattern will be obvious.
- With a strict comparison on both sides, neither of two equal elements stops the other, so both claim the subarray lying between them. The subarray is counted twice.
- The fix is to make exactly one side non-strict — say, previous strictly smaller and next smaller-or-equal. Which side you pick does not matter; picking one and keeping it does.
- Concretely: leave the left pass popping on `>=` and change the right pass to pop on `>` only. For maxima, mirror it.
- `max_min_times_length` measures rather than counts, so double counting is harmless: the same product is simply computed twice, and a maximum does not care. Do not "fix" it.
- The counting versions overflow an `int` easily — a single element of an array of 2 × 10⁵ equal values owns about 10¹⁰ subarrays — which is why `left` and `right` are `long long`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

long long sum_of_minimums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {                  // previous strictly smaller
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {             // next smaller-or-equal
        while (!stack.empty() && a[stack.back()] > a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long total = 0;
    for (int i = 0; i < n; ++i) total += a[i] * left[i] * right[i];
    return total;
}

long long sum_of_maximums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {                  // previous strictly greater
        while (!stack.empty() && a[stack.back()] <= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {             // next greater-or-equal
        while (!stack.empty() && a[stack.back()] < a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long total = 0;
    for (int i = 0; i < n; ++i) total += a[i] * left[i] * right[i];
    return total;
}

// Unchanged: a maximum is unaffected by measuring the same subarray twice.
long long max_min_times_length(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long best = 0;
    for (int i = 0; i < n; ++i)
        best = std::max(best, a[i] * (left[i] + right[i] - 1));
    return best;
}
```

## Notes
The difference between the two outcomes is worth stating precisely, because it
is the rule that decides every problem of this shape.

**Counting needs the subarrays to tile.** Each of the `n(n+1)/2` subarrays must
be attributed to exactly one element — its minimum — and when the minimum
appears twice, something must break the tie. A strict comparison on both sides
breaks nothing: on `{3, 3, 3}` every 3 believes it reaches past its equal
neighbours in both directions, the spans overlap instead of tiling, and the
total comes out as 30 against the true 18. Making one side non-strict says "the
leftmost copy owns it", every subarray is claimed exactly once, and the counts
tile.

**Maximising does not need them to tile.** `max_min_times_length` asks for the
largest product, and computing the same product twice does not change a maximum.
More importantly, the symmetric spans never produce an *invalid* product: if
`a[i]` reaches past an equal neighbour, that neighbour is not smaller, so `a[i]`
really is the minimum over the wider span. Every product computed is achievable,
and the best of them is the answer. Symmetric spans here are not a bug you got
away with; they are correct.

The general rule: **if the answer is a sum or a count, break ties; if it is a
max or a min, you need not.** When unsure, test on an array of equal values —
`{3, 3, 3}` distinguishes the two behaviours in one line, and it is the case
worth writing first.

Two smaller notes.

`left[i] + right[i] - 1` is the length of the whole span in
`max_min_times_length`, not `left[i] * right[i]`. The product counts subarrays;
the sum counts elements, minus one because `a[i]` is in both halves. Using the
wrong one is the other easy mistake here, and `{5}` catches it: one element,
`left = right = 1`, span 1, product 1.

`a[i] * left[i] * right[i]` is `long long` arithmetic because `left[i]` is
`long long` and the multiplication promotes — with `int` spans it would silently
wrap at contest sizes. Declaring the span arrays wide is cheaper than
remembering to cast at the point of use.
