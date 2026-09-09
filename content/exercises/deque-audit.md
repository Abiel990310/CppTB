---
id: deque-audit
title: "Three windows that see too much"
difficulty: core
chapter: deques-and-window-extrema
topics: [monotonic-deque, sliding-window, algorithms]
check: unit
standard: c++20
---

Three functions over a window of fixed size `k` (with `1 ≤ k ≤ n`), each using a
monotonic deque. Each has one bug, and all three bugs are about *which elements
are in the window* rather than about the deque's ordering.

- `window_max(a, k)` — the maximum of every window of size `k`, left to right.
  Expires the front one step late, so each window is one element too wide.
- `window_min(a, k)` — the same for minima. Never expires the front at all, so
  every answer is the minimum over the whole prefix.
- `sum_of_window_maxima(a, k)` — the sum of those maxima. Records an answer for
  every position, including the first `k - 1` where the window is not yet full.

All three return exactly `n - k + 1` results (the third, a single sum over them).

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <deque>
#include <vector>

std::vector<int> window_max(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    std::vector<int> out;
    std::deque<int> dq;                                   // indices
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k < i) dq.pop_front();            // one step late
        if (i + 1 >= k) out.push_back(a[dq.front()]);
    }
    return out;
}

std::vector<int> window_min(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    std::vector<int> out;
    std::deque<int> dq;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
        dq.push_back(i);
        // nothing ever leaves the front, so old minima never age out
        if (i + 1 >= k) out.push_back(a[dq.front()]);
    }
    return out;
}

long long sum_of_window_maxima(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    long long total = 0;
    std::deque<int> dq;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k <= i) dq.pop_front();
        total += a[dq.front()];                            // even before the window fills
    }
    return total;
}
```

## Tests
```cpp
std::vector<int> a{9, 1, 2, 3, 8, 2, 1, 5};

// window_max
CHECK_EQ(window_max(a, 1), (std::vector<int>{9, 1, 2, 3, 8, 2, 1, 5}));
CHECK_EQ(window_max(a, 2), (std::vector<int>{9, 2, 3, 8, 8, 2, 5}));
CHECK_EQ(window_max(a, 3), (std::vector<int>{9, 3, 8, 8, 8, 5}));
CHECK_EQ(window_max(a, 4), (std::vector<int>{9, 8, 8, 8, 8}));
CHECK_EQ(window_max(a, 8), (std::vector<int>{9}));
CHECK_EQ(window_max({1, 3, -1, -3, 5, 3, 6, 7}, 3), (std::vector<int>{3, 3, 5, 5, 6, 7}));
CHECK_EQ(window_max({5, 5, 5}, 2), (std::vector<int>{5, 5}));
CHECK_EQ(window_max({7}, 1), (std::vector<int>{7}));

// window_min
CHECK_EQ(window_min(a, 1), (std::vector<int>{9, 1, 2, 3, 8, 2, 1, 5}));
CHECK_EQ(window_min(a, 2), (std::vector<int>{1, 1, 2, 3, 2, 1, 1}));
CHECK_EQ(window_min(a, 3), (std::vector<int>{1, 1, 2, 2, 1, 1}));
CHECK_EQ(window_min(a, 4), (std::vector<int>{1, 1, 2, 1, 1}));
CHECK_EQ(window_min(a, 8), (std::vector<int>{1}));
CHECK_EQ(window_min({1, 3, -1, -3, 5, 3, 6, 7}, 3), (std::vector<int>{-1, -3, -3, -3, 3, 3}));
CHECK_EQ(window_min({5, 5, 5}, 2), (std::vector<int>{5, 5}));
CHECK_EQ(window_min({7}, 1), (std::vector<int>{7}));

// sum_of_window_maxima
CHECK_EQ(sum_of_window_maxima(a, 1), 31LL);
CHECK_EQ(sum_of_window_maxima(a, 2), 37LL);
CHECK_EQ(sum_of_window_maxima(a, 3), 41LL);
CHECK_EQ(sum_of_window_maxima(a, 4), 41LL);
CHECK_EQ(sum_of_window_maxima(a, 8), 9LL);
CHECK_EQ(sum_of_window_maxima({1, 3, -1, -3, 5, 3, 6, 7}, 3), 29LL);
CHECK_EQ(sum_of_window_maxima({5, 5, 5}, 2), 10LL);
CHECK_EQ(sum_of_window_maxima({7}, 1), 7LL);
```

## Hints
- The window ending at `i` starts at `i - k + 1`, so an index `j` is stale exactly when `j < i - k + 1`, that is `j + k <= i`. The starter's `<` keeps it one step too long.
- `k == 1` is the fastest way to see it: every window is a single element, so any leftover front is immediately visible as a wrong answer.
- `window_min` has no front expiry, so the smallest element ever seen stays at the front forever. Compare its output on `{9, 1, 2, 3, 8, 2, 1, 5}` with `k = 2` against the true answer: the 1 at index 1 goes on winning windows it left long ago.
- The back-cleanup alone is not enough. It removes elements beaten on *merit*; the front expiry removes them for *age*, and a sliding window needs both.
- Read from `dq.front()` only after `i` has been pushed, or the first complete window can find an empty deque — and `front()` on an empty deque is undefined behaviour, not an exception.
- `sum_of_window_maxima` must not record anything until the window is full — the same `if (i + 1 >= k)` guard the other two have. Windows are counted from the first *complete* one.
- One `if`, not a `while`, is enough for the front: the window advances one step at a time, so at most one index can age out per iteration.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <deque>
#include <vector>

std::vector<int> window_max(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    std::vector<int> out;
    std::deque<int> dq;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k <= i) dq.pop_front();           // stale: j + k <= i
        if (i + 1 >= k) out.push_back(a[dq.front()]);
    }
    return out;
}

std::vector<int> window_min(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    std::vector<int> out;
    std::deque<int> dq;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
        dq.push_back(i);                                   // push, then read
        if (dq.front() + k <= i) dq.pop_front();
        if (i + 1 >= k) out.push_back(a[dq.front()]);
    }
    return out;
}

long long sum_of_window_maxima(const std::vector<int>& a, int k) {
    int n = static_cast<int>(a.size());
    long long total = 0;
    std::deque<int> dq;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k <= i) dq.pop_front();
        if (i + 1 >= k) total += a[dq.front()];            // complete windows only
    }
    return total;
}
```

## Notes
All three functions have the same four steps, and the bugs are three different
ways of getting the order or the boundary wrong. Written once, correctly, the
body is:

```
1. clean the back   while the back cannot beat a[i]
2. push i
3. expire the front if it is now outside the window
4. read the front   if the window is full
```

**Step 3's condition.** The window ending at `i` is `[i - k + 1, i]`, so index
`j` is outside it when `j < i - k + 1`, which rearranges to `j + k <= i`. The
starter's `j + k < i` keeps one extra element, and at `k == 1` — where every
window is a single element — the error is unmissable: `window_max(a, 1)` should
be `a` itself, and the starter returns each element's running maximum over two.

Writing `dq.front() <= i - k` says the same thing and avoids the mental
rearrangement. Either is fine; guessing is not.

**Step 3 missing entirely.** `window_min` cleans the back and never touches the
front, which leaves a structure that is still perfectly monotonic and answers a
different question: the minimum over the whole prefix. On
`{9, 1, 2, 3, 8, 2, 1, 5}` with `k = 2` it returns seven 1s, because the 1 at
index 1 is never evicted and keeps winning windows it left five steps ago.

That is the distinction the chapter opens with. The back-cleanup removes
elements on **merit** — something better arrived — and it is the whole of a
monotonic *stack*. A sliding window also needs eviction by **age**, and the
front is where that happens. Leaving it out does not corrupt the deque; it
silently changes the problem being solved, which is why the code still looks
right.

**Step 4's guard.** Windows are counted from the first *complete* one, so no
result exists for `i < k - 1`. Summing the front at those positions adds the
maxima of partial windows: for `k = 3` the starter adds two extra values and
returns 59 instead of 41. The guard is `i + 1 >= k`, which reads as "at least
`k` elements have been seen".

**One `if`, not a `while`.** The front can only age out one index per step,
because the window's left edge advances by one. A `while` there is not wrong,
just a claim about the code that is not true — and if you ever find it popping
twice, the invariant broke somewhere above and the loop is hiding it.
