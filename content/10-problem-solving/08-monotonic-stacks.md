---
title: "Monotonic stacks"
navTitle: "Monotonic stacks"
summary: >-
  A stack you keep sorted as you go, and the amortised argument that makes
  "for each element, look left until…" a single linear pass.
objectives:
  - Recognise the "nearest greater or smaller element" shape in a problem
  - State and maintain the invariant a monotonic stack keeps
  - Explain why the nested while loop is O(n) in total
  - Use previous-smaller and next-smaller spans to count subarrays
  - Choose the tie-breaking rule that avoids double counting
status: complete
standard: c++20
requires: [prefix-sums]
---

Some questions are about each element's *neighbourhood* rather than a range:
the next taller building, the previous smaller price, how far a bar in a
histogram can extend before something shorter stops it. Written directly they
are all "walk outwards from `i` until the condition breaks", which is O(n²).

A monotonic stack does all of them in one pass. It is a plain
`std::vector<int>` of indices with one rule attached: **the values at those
indices stay sorted.** Everything else follows.

## The shape

For each element, the index of the next strictly greater element to its right.

```cpp run title="Scanning forward, and not scanning forward"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// For each i, the index of the next element to the right that is strictly
// greater, or n if there is none.
std::vector<int> naive(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, n);
    for (int i = 0; i < n; ++i)
        for (int j = i + 1; j < n; ++j)
            if (a[j] > a[i]) { out[i] = j; break; }
    return out;
}

std::vector<int> with_stack(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> out(n, n);
    std::vector<int> stack;                 // indices, values strictly decreasing
    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] < a[i]) {
            out[stack.back()] = i;          // a[i] is the answer for that index
            stack.pop_back();
        }
        stack.push_back(i);
    }
    return out;
}

int main() {
    const int n = 12'000;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = n - i;    // strictly decreasing: no answers

    auto start = std::chrono::steady_clock::now();
    std::vector<int> slow = naive(a);
    double slow_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    start = std::chrono::steady_clock::now();
    std::vector<int> fast = with_stack(a);
    double fast_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    keep(slow); keep(fast);
    std::printf("scan forward %8.1f ms\n", slow_ms);
    std::printf("stack        %8.1f ms\n", fast_ms);
    std::printf("same answers: %s\n", slow == fast ? "yes" : "no");
}
```

About 1.2 seconds against 6 milliseconds on a decreasing array of 12,000
elements — the worst case for the forward scan, which finds no answer for any
index and therefore walks to the end every time.

Read `with_stack` again and notice what it is *not* doing. It never searches for
an element's answer. It waits until the answer arrives and then hands it out,
possibly to several indices at once. That inversion — from "find my answer" to
"I am somebody's answer" — is the whole technique, and it is why the loop runs
forward while the question points backward.

## The invariant, and why the nested loop is linear

The invariant is one sentence: **the indices on the stack have strictly
decreasing values, and they are exactly the elements whose answer is not yet
known.** An element leaves the stack precisely when its answer appears.

The `while` inside the `for` looks quadratic and is not, by the same argument
chapter 10.2 used for two pointers, in its cleanest form: *every index is pushed
exactly once and popped at most once*, so the body of the `while` runs at most
`n` times over the whole program, no matter how it clusters.

```cpp run title="Counting the pushes and the pops"
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> a{2, 1, 4, 3, 5, 1, 6};
    int n = static_cast<int>(a.size());

    std::vector<int> next_greater(n, -1);
    std::vector<int> stack;
    int pushes = 0, pops = 0;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] < a[i]) {
            next_greater[stack.back()] = a[i];
            stack.pop_back();
            ++pops;
        }
        stack.push_back(i);
        ++pushes;

        std::printf("i=%d a=%d  stack:", i, a[i]);
        for (int idx : stack) std::printf(" %d", a[idx]);
        std::printf("\n");
    }

    std::printf("next greater:");
    for (int v : next_greater) std::printf(" %d", v);
    std::printf("\n");
    std::printf("n = %d, pushes = %d, pops = %d, total = %d\n",
                n, pushes, pops, pushes + pops);
}
```

Seven elements, seven pushes, six pops — thirteen operations, against the 2n = 14
the bound allows. Watch the printed stack: it is decreasing at every step, and
`i=2` pops two entries at once while `i=1` pops none. Individual steps are not
O(1); the total is O(n), which is what "amortised" means.

The four variants are the same code with two knobs — which direction you scan,
and which comparison pops:

| Want | Scan | Pop while |
|---|---|---|
| next greater to the right | left → right | `a[top] < a[i]` |
| next smaller to the right | left → right | `a[top] > a[i]` |
| previous greater to the left | left → right | `a[top] <= a[i]`, answer is the new top |
| previous smaller to the left | left → right | `a[top] >= a[i]`, answer is the new top |

The last two are worth staring at: for "previous", you do not record anything on
the way out. You pop until the top *is* the answer, and read it before pushing
`i`. One loop can compute both directions at once — the element you pop learns
its next, and the element left behind is your previous.

## Largest rectangle in a histogram

The classic. For each bar, the widest rectangle at that bar's height is bounded
on each side by the first strictly shorter bar — previous smaller and next
smaller, which is the table above run twice, or once with care.

```cpp run title="The widest rectangle each bar can support"
#include <algorithm>
#include <cstdio>
#include <random>
#include <vector>

// Largest rectangle in a histogram, in one pass.
long long largest_rectangle(const std::vector<int>& h) {
    int n = static_cast<int>(h.size());
    std::vector<int> stack;                     // indices, heights increasing
    long long best = 0;

    for (int i = 0; i <= n; ++i) {
        int height = (i == n) ? 0 : h[i];       // a zero sentinel drains the stack
        while (!stack.empty() && h[stack.back()] >= height) {
            int top = stack.back();
            stack.pop_back();
            // The bar at `top` extends right to i-1 and left to the bar below it.
            int left = stack.empty() ? -1 : stack.back();
            long long width = i - left - 1;
            best = std::max(best, width * h[top]);
        }
        stack.push_back(i);
    }
    return best;
}

long long brute(const std::vector<int>& h) {
    long long best = 0;
    for (std::size_t i = 0; i < h.size(); ++i) {
        int low = h[i];
        for (std::size_t j = i; j < h.size(); ++j) {
            low = std::min(low, h[j]);
            best = std::max(best,
                            static_cast<long long>(low) * static_cast<long long>(j - i + 1));
        }
    }
    return best;
}

int main() {
    std::vector<int> classic{2, 1, 5, 6, 2, 3};
    std::printf("2 1 5 6 2 3 -> %lld\n", largest_rectangle(classic));

    std::mt19937 rng(12345);
    int checked = 0;
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 12);
        std::vector<int> h(n);
        for (int& x : h) x = static_cast<int>(rng() % 8);   // zeros included
        if (largest_rectangle(h) != brute(h)) ok = false;
        ++checked;
    }
    std::printf("%d random histograms checked against brute force: %s\n",
                checked, ok ? "all agree" : "MISMATCH");
}
```

10 for the classic input, and 2,000 random histograms agree with an O(n²) check.
Three details do the work:

- **The sentinel.** Running `i` to `n` with `height = 0` forces every remaining
  bar off the stack, so there is no "drain the leftovers" loop after the main
  one to write and get wrong. Adding a zero to the end of the array is the same
  trick spelled differently.
- **The width comes from the stack, not from a scan.** After popping `top`, the
  new top is the nearest bar to the left that is *shorter* than `h[top]`, so the
  rectangle spans `(left, i)` exclusive on both ends — width `i - left - 1`.
  `left == -1` when the stack empties, which makes the formula give `i`, the
  whole prefix, with no special case.
- **`>=` rather than `>`.** Equal heights pop each other. That looks like it
  should lose a rectangle, and it does not: the *last* bar of a run of equal
  heights computes the full width for all of them, because the earlier equal
  bars have already been removed and cannot stop it. Convincing yourself of this
  once is worth more than memorising the sign.

That last point is the recurring difficulty with monotonic stacks, and it has a
name.

## Ties, and counting each thing once

When you use the stack to *count* rather than to maximise, equal elements will
double count unless you break the symmetry deliberately.

Take: sum, over every contiguous subarray, of that subarray's minimum. Element
`a[i]` is the minimum of `left[i] × right[i]` subarrays, where `left` and
`right` are how far it reaches before something smaller stops it. With
duplicates, "smaller" has to mean something slightly different on each side.

```cpp run title="Strict on one side, non-strict on the other"
#include <algorithm>
#include <cstdio>
#include <random>
#include <vector>

// Sum over every contiguous subarray of its minimum.
// left[i]  = how far a[i] extends left  before an element < a[i]   (strict)
// right[i] = how far a[i] extends right before an element <= a[i]  (non-strict)
// The asymmetry is what stops two equal minima from claiming the same subarray.
long long sum_of_minimums(const std::vector<int>& a, bool strict_on_both_sides) {
    int n = static_cast<int>(a.size());
    std::vector<long long> left(n), right(n);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {                       // previous strictly smaller
        while (!stack.empty() && a[stack.back()] >= a[i]) stack.pop_back();
        left[i] = stack.empty() ? i + 1 : i - stack.back();
        stack.push_back(i);
    }
    stack.clear();
    for (int i = n - 1; i >= 0; --i) {                  // next smaller-or-equal
        while (!stack.empty() &&
               (strict_on_both_sides ? a[stack.back()] >= a[i]
                                     : a[stack.back()] > a[i])) stack.pop_back();
        right[i] = stack.empty() ? n - i : stack.back() - i;
        stack.push_back(i);
    }

    long long total = 0;
    for (int i = 0; i < n; ++i) total += a[i] * left[i] * right[i];
    return total;
}

long long brute(const std::vector<int>& a) {
    long long total = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        int low = a[i];
        for (std::size_t j = i; j < a.size(); ++j) { low = std::min(low, a[j]); total += low; }
    }
    return total;
}

int main() {
    std::vector<int> dup{3, 1, 2, 1, 4};
    std::printf("3 1 2 1 4  brute      %lld\n", brute(dup));
    std::printf("           mixed ties %lld\n", sum_of_minimums(dup, false));
    std::printf("           both strict %lld\n", sum_of_minimums(dup, true));

    std::mt19937 rng(999);
    bool ok = true, ever_differed = false;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 10);
        std::vector<int> a(n);
        for (int& x : a) x = 1 + static_cast<int>(rng() % 4);   // many duplicates
        long long want = brute(a);
        if (sum_of_minimums(a, false) != want) ok = false;
        if (sum_of_minimums(a, true) != want) ever_differed = true;
    }
    std::printf("2000 random arrays: mixed ties %s, both-strict %s\n",
                ok ? "always correct" : "WRONG",
                ever_differed ? "sometimes wrong" : "also always correct");
}
```

21 against 25 on a five-element array, and the mixed rule is right on all 2,000
random arrays while the symmetric one is not.

Why: `3 1 2 1 4` has two 1s. The subarray `1 2 1` has minimum 1 — and with a
strict rule on both sides, *both* 1s claim it, because neither is stopped by the
other. Making one side non-strict says "of two equal minima, the leftmost owns
the subarray", which is an arbitrary but consistent choice, and consistency is
all that is needed.

The rule generalises. Whenever a monotonic stack counts subarrays by their
extreme element:

- Use a **strict** comparison on one side and a **non-strict** one on the other.
- Which side gets which does not matter, as long as you pick one and keep it.
- Maximisation problems tolerate a symmetric rule, because measuring the same
  rectangle twice does not change a maximum — and extending a bar past an equal
  neighbour is legitimate, since an equal bar still supports the rectangle. The
  histogram code above nevertheless ends up asymmetric: popping on `>=` makes
  the right bound "next smaller-or-equal" and leaves a strictly smaller bar as
  the left bound. That is the mixed rule arriving by itself, which is a good
  sign that it is the natural one.

Also note the type: `a[i] * left[i] * right[i]` is `long long` because `left`
and `right` are, and that promotion is load-bearing. At `n = 2 × 10⁵` a single
element can own 10¹⁰ subarrays.

## Recognising it

The tell is a question about **the nearest element satisfying a comparison**,
even when the statement never says "nearest":

| The problem says | It means |
|---|---|
| "the next day the price is higher" | next greater |
| "how many days until a warmer temperature" | next greater, answer as a distance |
| "the largest rectangle / widest span at this height" | previous and next smaller |
| "sum/count over subarrays of their minimum or maximum" | spans, with the tie rule |
| "how many buildings can you see from the roof" | the stack's size, or a pop count |
| "remove k digits to make the smallest number" | greedy pop while the top is larger |

If the answer for each element depends only on the nearest element beating it in
some direction, a monotonic stack computes all of them in one pass. If it
depends on the nearest element in a *window* that also slides, that is the next
chapter.

:::quiz
{
  "question": "You compute, for each element, how many contiguous subarrays it is the maximum of — using \"previous strictly greater\" on the left and \"next strictly greater\" on the right. The array contains duplicates. What goes wrong?",
  "options": [
    { "text": "Subarrays whose maximum appears more than once get counted once per copy, so the total exceeds the true number of subarrays", "correct": true, "why": "With a strict rule on both sides, neither of two equal maxima stops the other, so both claim the subarray between them. Making one side non-strict picks a consistent owner." },
    { "text": "Nothing — strict on both sides is the standard formulation", "why": "It is correct only when all values are distinct. With duplicates it double counts, which the sample in this chapter measures: 25 against a true 21." },
    { "text": "It undercounts, because equal elements pop each other off the stack", "why": "The error is in the other direction. Popping equals shortens one span but lengthens the other's, and with strict rules on both sides the spans overlap rather than tile." },
    { "text": "It becomes O(n²), because equal elements are pushed repeatedly", "why": "Each index is still pushed once and popped at most once whatever the comparison is; the complexity is unaffected. The bug is arithmetic, not asymptotic." }
  ]
}
:::

## Practice

:::exercise stack-audit

:::exercise span-counting

:::exercise judge-next-greater

:::exercise judge-histogram

:::recap
- A monotonic stack holds *indices* whose values stay sorted; an index leaves
  exactly when its answer arrives. The loop runs forward even when the question
  points backward, because the technique is "I am somebody's answer" rather than
  "find my answer".
- Each index is pushed once and popped at most once, so the nested `while` costs
  O(n) in total. Measured here: 7 pushes and 6 pops on 7 elements, and 1.2
  seconds of forward scanning replaced by 6 milliseconds on 12,000.
- The four variants differ only in scan direction and in which comparison pops.
  For "previous", read the new top after popping instead of recording on the way
  out.
- A sentinel — running the index one past the end with a value that pops
  everything — removes the drain loop and the special cases that come with it.
- When counting rather than maximising, use a strict comparison on one side and
  a non-strict one on the other, or subarrays with a repeated extreme get
  counted twice. Measured: 25 instead of 21 on `3 1 2 1 4`.
- Span products reach 10¹⁰ at contest sizes, so `left * right` is `long long`.
:::
