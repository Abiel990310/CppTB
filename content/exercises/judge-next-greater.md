---
id: judge-next-greater
title: "Next greater element"
difficulty: core
chapter: monotonic-stacks
topics: [monotonic-stack, io]
check: output
standard: c++20
timeLimitMs: 2000
---

For each element of an array, print the first element to its right that is
**strictly** greater than it, or `-1` if there is none.

**Input.** The first line contains `n`. The second line contains `n` integers.

**Output.** One line of `n` integers separated by single spaces.

**Constraints.** `1 ≤ n ≤ 200000`, `1 ≤ aᵢ ≤ 10⁹`.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::vector<int> answer(n, -1);
    std::vector<int> stack;                       // indices

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] <= a[i]) {
            answer[stack.back()] = a[i];
            stack.pop_back();
        }
        stack.push_back(i);
    }

    for (int i = 0; i < n; ++i) std::cout << answer[i] << " \n"[i == n - 1];
}
```

## Cases

### Sample
```in
7
2 1 4 3 5 1 6
```
```out
4 4 5 5 6 6 -1
```

### equal neighbours are not greater
```in
3
5 5 5
```
```out
-1 -1 -1
```

### increasing
```in
3
1 2 3
```
```out
2 3 -1
```

### decreasing
```in
3
3 2 1
```
```out
-1 -1 -1
```

### a valley between equals
```in
3
2 1 2
```
```out
-1 2 -1
```

### repeated peaks
```in
5
1 3 2 3 1
```
```out
3 -1 3 -1 -1
```

### a single element
```in
1
7
```
```out
-1
```

## Hints
- Do not search rightwards from each element. Walk left to right and let each new element *answer* the pending questions on a stack.
- The stack holds indices whose answers are not yet known, and their values stay strictly decreasing. That is the invariant; check it holds after every push.
- "Strictly greater" means an equal element must not answer. Pop while `a[stack.back()] < a[i]`, not `<=`.
- Whatever is still on the stack at the end has no answer, which is why `answer` is initialised to `-1` and never revisited.
- Each index is pushed once and popped at most once, so the nested `while` is O(n) overall — no need to look for a cleverer loop.
- `" \n"[i == n - 1]` prints a space after every element but a newline after the last. Any spacing that puts the numbers on one line is accepted.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::vector<int> answer(n, -1);
    std::vector<int> stack;

    for (int i = 0; i < n; ++i) {
        while (!stack.empty() && a[stack.back()] < a[i]) {   // strictly greater
            answer[stack.back()] = a[i];
            stack.pop_back();
        }
        stack.push_back(i);
    }

    for (int i = 0; i < n; ++i) std::cout << answer[i] << " \n"[i == n - 1];
}
```

## Notes
One character. `<=` computes the next greater-*or-equal* element, which is a
different and equally reasonable function — just not the one asked for.

The case that separates them is `5 5 5`. Nothing there is strictly greater than
anything, so the answer is three `-1`s; with `<=` the first two 5s are answered
by their neighbours and the output is `5 5 -1`. Every other case in this problem
passes with the bug, which is the point: this mistake does not show up until
values repeat, and contest data always repeats values.

The habit worth forming is to read the comparison out of the statement and write
it down before writing the loop:

| Statement says | Pop while |
|---|---|
| strictly greater | `a[top] < a[i]` |
| greater or equal | `a[top] <= a[i]` |
| strictly smaller | `a[top] > a[i]` |
| smaller or equal | `a[top] >= a[i]` |

Two other things this problem quietly checks.

**Elements never popped keep their default.** Initialising `answer` to `-1` and
leaving the stack un-drained is deliberate: the indices still on the stack are
exactly those with no greater element to their right, and they already hold the
right value. A drain loop here would be code that does nothing, which is worse
than no code at all.

**Output volume.** 2 × 10⁵ integers is enough that `std::endl` per number, or
`std::cout` without `sync_with_stdio(false)`, is a measurable share of the time
limit. Chapter 10.3 measured it; the setup lines at the top of `main` are
habit, not decoration.
