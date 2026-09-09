---
id: judge-window-max
title: "Sliding window maximum"
difficulty: core
chapter: deques-and-window-extrema
topics: [monotonic-deque, sliding-window, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the maximum of every contiguous window of length `k`, from left to right.

**Input.** The first line contains `n` and `k`. The second line contains `n`
integers.

**Output.** One line of `n - k + 1` integers separated by single spaces.

**Constraints.** `1 ≤ k ≤ n ≤ 200000`, `|aᵢ| ≤ 10⁹`.

## Starter
```cpp
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, k;
    std::cin >> n >> k;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::deque<int> dq;                       // indices, values decreasing
    bool first = true;

    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k < i) dq.pop_front();          // when is an index stale?
        if (i + 1 >= k) {
            if (!first) std::cout << ' ';
            std::cout << a[dq.front()];
            first = false;
        }
    }
    std::cout << '\n';
}
```

## Cases

### Sample
```in
8 3
9 1 2 3 8 2 1 5
```
```out
9 3 8 8 8 5
```

### every window is one element
```in
8 1
9 1 2 3 8 2 1 5
```
```out
9 1 2 3 8 2 1 5
```

### negatives
```in
8 3
1 3 -1 -3 5 3 6 7
```
```out
3 3 5 5 6 7
```

### one window covering everything
```in
5 5
5 4 3 2 1
```
```out
5
```

### all equal
```in
3 3
5 5 5
```
```out
5
```

### increasing
```in
5 2
1 2 3 4 5
```
```out
2 3 4 5
```

### a single element
```in
1 1
7
```
```out
7
```

## Hints
- Keep a deque of *indices* whose values are decreasing. The front is then the maximum of the current window, with no scanning.
- Before pushing `i`, drop every index at the back whose value is `<= a[i]`: it is both smaller and older, so it can never be the maximum again.
- The window ending at `i` starts at `i - k + 1`, so an index `j` is stale exactly when `j + k <= i`. The starter's `<` keeps it one step too long.
- `k == 1` is the case that exposes the boundary immediately: every answer must be the element itself.
- One `if` on the front, not a `while` — the window advances by one, so at most one index ages out per step.
- Nothing is printed until the window is full, which is the `i + 1 >= k` guard.

## Solution
```cpp
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, k;
    std::cin >> n >> k;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::deque<int> dq;
    bool first = true;

    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() + k <= i) dq.pop_front();         // stale: j + k <= i
        if (i + 1 >= k) {
            if (!first) std::cout << ' ';
            std::cout << a[dq.front()];
            first = false;
        }
    }
    std::cout << '\n';
}
```

## Notes
`j + k < i` against `j + k <= i` is the whole problem, and the arithmetic is
worth doing once rather than guessing.

The window whose last index is `i` covers `[i - k + 1, i]`. Index `j` is inside
it when `j >= i - k + 1`, so it is outside when `j < i - k + 1`, which
rearranges to `j + k <= i`. Written the other way round — `j <= i - k` — it says
the same thing and may be easier to read; what matters is that it is derived
rather than remembered.

`k = 1` is the case that catches it, and it is worth keeping as a first test for
any windowed algorithm. With `k = 1` every answer must be the element itself, so
a stale front is immediately visible: the starter prints `9 9 2 3 8 8 2 5`
where the answer is the array.

Three things this problem is also checking.

**The deque holds indices, not values.** Expiry is a question about *position*,
and you cannot ask it of a value. This is the reason for the indirection through
`a[dq.front()]` everywhere, and it is worth accepting rather than optimising
away.

**`<=` and not `<` on the back cleanup.** An equal element that arrives later is
strictly better: same value, younger, so it survives longer. Keeping both is not
wrong — the front is still a maximum — but it grows the deque and gives you a
tie to think about later. `<=` is the version to write by default.

**Output shape.** `n - k + 1` numbers on one line, with 2 × 10⁵ of them in the
worst case. The `first` flag keeps the separators between rather than after,
which avoids a trailing space; most judges tolerate one, and not all of them do.
