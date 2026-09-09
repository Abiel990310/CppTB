---
title: "Two pointers and sliding windows"
navTitle: "Two pointers"
summary: >-
  Two indices that only move forward, and why that makes a nested loop linear.
objectives:
  - Explain why two forward-moving indices give O(n) rather than O(n²)
  - Write a variable-size window that maintains a condition
  - Recognise the precondition a sliding window needs
status: complete
standard: c++20
requires: [binary-search]
---

Chapter 10.2 introduced the counting argument in one paragraph: two indices that
only move forward do O(n) work in total, however nested the loops look. This
chapter is that argument turned into a technique.

The shape solves a large family of problems — longest subarray with some
property, shortest subarray reaching some threshold, counting pairs in a sorted
array — and it replaces an O(n²) scan with a single pass.

## The problem, twice

Longest contiguous subarray whose sum is at most a limit, over positive values.

```cpp run title="The same answer, seventy times faster"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Try every starting point, extending until the sum is too large.
int naive(const std::vector<int>& a, long long limit) {
    int best = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        long long sum = 0;
        for (std::size_t j = i; j < a.size(); ++j) {
            sum += a[j];
            if (sum > limit) break;
            best = std::max(best, static_cast<int>(j - i + 1));
        }
    }
    return best;
}

// One pass: extend on the right, shrink on the left when the sum is too large.
int windowed(const std::vector<int>& a, long long limit) {
    int best = 0;
    long long sum = 0;
    std::size_t lo = 0;

    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        sum += a[hi];                                   // grow to the right
        while (sum > limit) { sum -= a[lo]; ++lo; }     // shrink from the left
        best = std::max(best, static_cast<int>(hi - lo + 1));
    }
    return best;
}

int main() {
    std::vector<int> a;
    for (int i = 0; i < 40'000; ++i) a.push_back(1 + (i * 37) % 100);

    auto start = std::chrono::steady_clock::now();
    int slow = naive(a, 5000);
    double slow_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    start = std::chrono::steady_clock::now();
    int fast = windowed(a, 5000);
    double fast_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();

    keep(slow); keep(fast);
    std::printf("naive        %7.1f ms -> %d\n", slow_ms, slow);
    std::printf("two pointers %7.1f ms -> %d\n", fast_ms, fast);
    std::printf("same answer: %s\n", slow == fast ? "yes" : "no");
}
```

About 94 ms against 1.3 ms — seventy times, on 40,000 elements, for the same
answer.

## Why it is linear

The `while` inside the `for` looks quadratic. It is not, and the argument is
worth being able to give rather than remember.

`lo` only ever increases, and it never exceeds `hi`, which never exceeds `n`. So
across the *whole run* the inner loop's body executes at most `n` times in
total — not `n` times per outer iteration. The outer loop runs `n` times. Total
work: at most `2n`.

```cpp run title="Counting the steps"
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> a;
    for (int i = 0; i < 10'000; ++i) a.push_back(1 + (i * 37) % 100);

    long long outer = 0;
    long long inner = 0;
    long long sum = 0;
    std::size_t lo = 0;

    for (std::size_t hi = 0; hi < a.size(); ++hi) {
        ++outer;
        sum += a[hi];
        while (sum > 5000) { ++inner; sum -= a[lo]; ++lo; }
    }

    std::printf("n = %zu\n", a.size());
    std::printf("outer steps: %lld\n", outer);
    std::printf("inner steps: %lld  (not %lld)\n", inner, static_cast<long long>(a.size()) * a.size());
    std::printf("total:       %lld\n", outer + inner);
}
```

10,000 outer steps and 9,903 inner steps — 19,903 in total, against the 10⁸ a
genuinely nested loop would need. **Amortised counting**: the same argument
Chapter 10.2 used for `push_back`, applied to a loop index instead of a
capacity.

## The precondition

A sliding window works when extending the window can only push the quantity one
way, and shrinking can only push it back. Formally: the property must be
**monotone in the window**.

For "sum at most L over positive values" it holds — adding an element can only
increase the sum, removing one can only decrease it. So when the sum is too
large, shrinking from the left is guaranteed to help, and there is never a
reason to move `lo` backwards.

:::warning
**With negative values the technique breaks.** Adding an element can now
*decrease* the sum, so a window that was too large might become acceptable by
growing, and `lo` would need to move backwards — which is exactly what the
linear argument forbids. "Longest subarray with sum at most L" over arbitrary
integers is a different problem, solved with prefix sums and a sorted structure
(Chapter 10.7).

Before writing a window, state what makes the property monotone. If you cannot,
you have the wrong tool, and it will produce a confident wrong answer on inputs
your sample does not contain.
:::

## The variable window, in general

Almost every sliding-window solution has this shape:

```cpp
std::size_t lo = 0;
for (std::size_t hi = 0; hi < n; ++hi) {
    add(a[hi]);                            // extend right

    while (window_is_invalid()) {          // restore the invariant
        remove(a[lo]);
        ++lo;
    }

    consider(lo, hi);                      // record the answer
}
```

The three decisions are what `add` and `remove` maintain, what makes a window
invalid, and whether the answer is recorded after shrinking (longest valid) or
during it (shortest valid). Get those right and the loop writes itself.

A window over characters, where the state is "which letters are present":

```cpp run title="Longest run with no repeated character"
#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>

int longest_unique(const std::string& text) {
    std::vector<int> last_seen(256, -1);      // last index of each byte
    int best = 0;
    int lo = 0;

    for (int hi = 0; hi < static_cast<int>(text.size()); ++hi) {
        unsigned char c = static_cast<unsigned char>(text[hi]);

        // If this character is already inside the window, move lo past it.
        if (last_seen[c] >= lo) lo = last_seen[c] + 1;

        last_seen[c] = hi;
        best = std::max(best, hi - lo + 1);
    }
    return best;
}

int main() {
    for (const char* s : {"abcabcbb", "bbbbb", "pwwkew", "", "abcdef", "au"})
        std::printf("%-10s -> %d\n", s[0] ? s : "(empty)", longest_unique(s));
}
```

`lo` jumps rather than stepping, which is still forward-only and still linear.
The check is `last_seen[c] >= lo` rather than `last_seen[c] != -1`: a character
seen earlier but already *left behind* by `lo` is not in the window, and treating
it as if it were shrinks the window for no reason. That one comparison is the
whole difference between a correct solution and one that passes `"abcabcbb"`.

## Two pointers from both ends

The other common shape moves the indices towards each other. Over a **sorted**
array, finding a pair with a given sum:

```cpp run title="Converging from both ends"
#include <cstdio>
#include <vector>

// Indices of two values summing to target, or {-1, -1}.
std::pair<int, int> find_pair(const std::vector<int>& sorted, long long target) {
    int lo = 0;
    int hi = static_cast<int>(sorted.size()) - 1;

    while (lo < hi) {
        long long sum = static_cast<long long>(sorted[lo]) + sorted[hi];
        if (sum == target) return {lo, hi};
        if (sum < target) ++lo;              // need more: only lo can give it
        else              --hi;              // need less: only hi can give it
    }
    return {-1, -1};
}

int main() {
    std::vector<int> v{1, 3, 4, 6, 8, 11};
    for (long long target : {7, 12, 19, 2, 100}) {
        auto [i, j] = find_pair(v, target);
        if (i < 0) std::printf("target %3lld: none\n", target);
        else std::printf("target %3lld: %d + %d\n", target, v[i], v[j]);
    }
}
```

Each step discards one candidate permanently, so the loop runs at most `n` times.
The correctness argument is the interesting part: if the sum is too small, no
pair using `sorted[lo]` can work — every partner available to it is at most
`sorted[hi]`, which is the largest remaining — so `lo` can be discarded without
checking anything else. That reasoning is what makes it a *proof* rather than a
heuristic, and it is the thing to reconstruct when adapting the technique.

## Check yourself

:::quiz
{
  "question": "A `while` loop inside a `for` loop, both over the same array. When is that O(n) rather than O(n²)?",
  "options": [
    { "text": "When the inner loop's index only ever moves forward and is never reset — then its body runs at most n times across the whole outer loop, not per iteration", "correct": true, "why": "This is amortised counting: total work, not worst case per iteration. Reset the inner index at the top of the outer loop and it really is quadratic." },
    { "text": "When the inner loop usually runs a small number of times", "why": "\"Usually\" is not a bound. The argument has to hold for every input, and it does — because lo is bounded by n over the whole run." },
    { "text": "When the array is sorted", "why": "Sortedness is a precondition of some two-pointer problems, not the reason for the complexity." },
    { "text": "Never; nested loops are always O(n²)", "why": "The nesting is syntactic. What matters is how many times the inner body executes in total." }
  ]
}
:::

:::quiz
{
  "question": "You use a sliding window for \"longest subarray with sum at most L\", and the values may be negative. What happens?",
  "options": [
    { "text": "It gives wrong answers: adding an element can now decrease the sum, so a window that was invalid can become valid by growing, and `lo` would have to move backwards", "correct": true, "why": "The window technique needs the property to be monotone — extending pushes one way, shrinking the other. Negative values break that, and the problem needs prefix sums and a sorted structure instead." },
    { "text": "It still works but becomes O(n²)", "why": "It does not become slower; it becomes wrong, which is worse because there is no symptom." },
    { "text": "It works provided the array is sorted first", "why": "Sorting destroys contiguity, and the problem is about contiguous subarrays." },
    { "text": "It works if you also track the minimum", "why": "No amount of extra tracking restores monotonicity; the window can need to grow leftwards, which the single forward pass cannot do." }
  ]
}
:::

## Practice

:::exercise window-audit

:::exercise two-pointer-pairs

:::exercise judge-longest-window

:::exercise judge-shortest-cover

:::recap
- Two indices that only move forward do at most 2n steps in total, however
  nested the loops look. Measured here: 10,000 outer and 9,903 inner steps
  where a genuine nested loop would do 10⁸.
- The window shape is: extend right, shrink from the left while the window is
  invalid, then record. The three decisions are what to maintain, what makes a
  window invalid, and whether to record after shrinking or during.
- The precondition is monotonicity: extending must push the quantity one way and
  shrinking the other. State it before writing the loop.
- Negative values break "sum at most L" — that is a prefix-sum problem, not a
  window one.
- `lo` may jump rather than step and still be linear, as in the
  longest-unique-substring window; the guard `last_seen[c] >= lo` is what keeps
  it from shrinking for a character already outside the window.
- Converging pointers over a sorted array work because each step *proves* one
  candidate can be discarded — reconstruct that argument when adapting it.
:::
