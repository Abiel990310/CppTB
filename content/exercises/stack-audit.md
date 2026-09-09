---
id: stack-audit
title: "Three stacks that lose an element"
difficulty: core
chapter: monotonic-stacks
topics: [monotonic-stack, algorithms]
check: unit
standard: c++20
---

Three monotonic stacks. Each keeps the right invariant and then mishandles one
thing: the comparison, the moment it reads the answer, or the elements still on
the stack when the loop ends.

- `next_greater_index(a)` — for each `i`, the index of the next element to the
  right that is **strictly** greater, or `n` if there is none. Pops on `<=`, so
  an equal element answers a question it should not.
- `previous_smaller_index(a)` — for each `i`, the index of the nearest element
  to the **left** that is strictly smaller, or `-1`. Pushes `i` before reading
  the answer, so every element reports itself.
- `largest_rectangle(h)` — the largest rectangle in a histogram. Never drains
  the stack, so the bars still on it at the end are never measured.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

std::vector<int> next_greater_index(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, n);
    std::vector<int> stack;
    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] <= a[i]) {   // equal counts
            out[stack.back()] = i;
            stack.pop_back();
        }
        stack.push_back(i);
    }
    return out;
}

std::vector<int> previous_smaller_index(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, -1);
    std::vector<int> stack;
    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        stack.push_back(i);                                  // pushed too early
        out[i] = stack.empty() ? -1 : stack.back();
    }
    return out;
}

long long largest_rectangle(const std::vector<int>& h) {
    int n = static_cast<int>(h.size());
    std::vector<int> stack;
    long long best = 0;
    for (int i = 0; i < n; ++i) {                            // stops at n - 1
        while (!stack.empty() && h[stack.back()] >= h[i]) {
            int top = stack.back();
            stack.pop_back();
            int left = stack.empty() ? -1 : stack.back();
            best = std::max(best, static_cast<long long>(i - left - 1) * h[top]);
        }
        stack.push_back(i);
    }
    return best;
}
```

## Tests
```cpp
// next_greater_index
CHECK_EQ(next_greater_index({2, 1, 4, 3, 5, 1, 6}), (std::vector<int>{2, 2, 4, 4, 6, 6, 7}));
CHECK_EQ(next_greater_index({1, 2, 3}), (std::vector<int>{1, 2, 3}));
CHECK_EQ(next_greater_index({3, 2, 1}), (std::vector<int>{3, 3, 3}));
CHECK_EQ(next_greater_index({5, 5, 5}), (std::vector<int>{3, 3, 3}));   // equal is not greater
CHECK_EQ(next_greater_index({2, 1, 2}), (std::vector<int>{3, 2, 3}));
CHECK_EQ(next_greater_index({1, 3, 2, 3, 1}), (std::vector<int>{1, 5, 3, 5, 5}));
CHECK_EQ(next_greater_index({7}), (std::vector<int>{1}));
CHECK_EQ(next_greater_index({}), (std::vector<int>{}));

// previous_smaller_index
CHECK_EQ(previous_smaller_index({2, 1, 4, 3, 5, 1, 6}), (std::vector<int>{-1, -1, 1, 1, 3, -1, 5}));
CHECK_EQ(previous_smaller_index({1, 2, 3}), (std::vector<int>{-1, 0, 1}));
CHECK_EQ(previous_smaller_index({3, 2, 1}), (std::vector<int>{-1, -1, -1}));
CHECK_EQ(previous_smaller_index({5, 5, 5}), (std::vector<int>{-1, -1, -1}));
CHECK_EQ(previous_smaller_index({2, 1, 2}), (std::vector<int>{-1, -1, 1}));
CHECK_EQ(previous_smaller_index({1, 3, 2, 3, 1}), (std::vector<int>{-1, 0, 0, 2, -1}));
CHECK_EQ(previous_smaller_index({}), (std::vector<int>{}));

// largest_rectangle
CHECK_EQ(largest_rectangle({2, 1, 5, 6, 2, 3}), 10LL);
CHECK_EQ(largest_rectangle({2, 4}), 4LL);              // the tallest bar is last
CHECK_EQ(largest_rectangle({1, 1, 1, 1}), 4LL);
CHECK_EQ(largest_rectangle({5}), 5LL);
CHECK_EQ(largest_rectangle({6, 2, 5, 4, 5, 1, 6}), 12LL);
CHECK_EQ(largest_rectangle({3, 1, 3}), 3LL);
CHECK_EQ(largest_rectangle({0, 0}), 0LL);
CHECK_EQ(largest_rectangle({}), 0LL);
```

## Hints
- `next_greater_index` asks for **strictly** greater, so an equal element must not answer. Pop only while `a[stack.back()] < a[i]`, and `{5, 5, 5}` is the case that tells you which you wrote.
- `previous_smaller_index` reads the answer off the stack rather than recording it on the way out. Pop the elements that are not smaller, *then* read the new top, *then* push `i`. The order of those three lines is the whole function.
- Reading the top after pushing always finds `i` itself, because `i` is the top. That is why the starter returns each index as its own answer whenever the stack was emptied.
- `largest_rectangle` leaves bars on the stack when the loop ends — exactly the bars nothing shorter ever followed, which includes the tallest one in an increasing histogram. Run `i` from `0` to `n` inclusive and treat the height at `i == n` as 0; that sentinel pops everything.
- Guard `h[i]` against `i == n`. `int height = (i == n) ? 0 : h[i];` is the usual spelling.
- The area needs `long long`: 2 × 10⁵ bars of height 10⁹ is 2 × 10¹⁴.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

std::vector<int> next_greater_index(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, n);
    std::vector<int> stack;
    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] < a[i]) {    // strictly greater
            out[stack.back()] = i;
            stack.pop_back();
        }
        stack.push_back(i);
    }
    return out;
}

std::vector<int> previous_smaller_index(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, -1);
    std::vector<int> stack;
    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        out[i] = stack.empty() ? -1 : stack.back();           // read, then push
        stack.push_back(i);
    }
    return out;
}

long long largest_rectangle(const std::vector<int>& h) {
    int n = static_cast<int>(h.size());
    std::vector<int> stack;
    long long best = 0;
    for (int i = 0; i <= n; ++i) {                            // one past the end
        int height = (i == n) ? 0 : h[i];                     // the sentinel
        while (!stack.empty() && h[stack.back()] >= height) {
            int top = stack.back();
            stack.pop_back();
            int left = stack.empty() ? -1 : stack.back();
            best = std::max(best, static_cast<long long>(i - left - 1) * h[top]);
        }
        stack.push_back(i);
    }
    return best;
}
```

## Notes
**Strict or not is a reading question, not a style question.** `next_greater`
with `<=` computes next *greater-or-equal*, which is a different function with
the same shape. On `{5, 5, 5}` the correct answer is `{3, 3, 3}` — nothing is
strictly greater than 5 — and the starter says `{1, 2, 3}`. Whenever a statement
says "greater", "taller", or "warmer", check whether it means strictly, and note
that the tests here are what settle it: `{5, 5, 5}` and `{2, 1, 2}` exist to pin
the convention down.

**"Next" records, "previous" reads.** They are not symmetric in the code even
though they are in the description:

```
next:      pop while the top loses to me   -> each popped element's answer is i
previous:  pop while the top loses to me   -> my answer is whatever is left on top
```

So for "previous" the three statements must be in the order pop, read, push. The
starter pushes first, which makes `stack.back()` be `i`, so every element that
cleared the stack reports itself — visible as `previous_smaller_index({1, 2,
3})` returning `{0, 1, 2}` instead of `{-1, 0, 1}`.

**Elements left on the stack are not leftovers, they are answers.** The bars
still on the stack when the histogram loop ends are exactly the ones nothing
shorter ever followed, and in an increasing histogram that is all of them —
`{2, 4}` returns 2 in the starter, having never measured the bar of height 4.
There are two ways to fix it: a drain loop after the main one, or the sentinel.
The sentinel is better because it is the same code path, so there is one place
for the width formula to be wrong rather than two.

One last thing all three share: `left == -1` and `out[i] = -1` mean "nothing
stopped it", and the width formula `i - left - 1` already handles that, giving
the full prefix. Sentinel values chosen so the general formula covers the
boundary are worth more than a branch that covers it explicitly.
