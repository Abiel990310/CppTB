---
id: judge-sum-of-n
title: "Sum of n integers"
difficulty: intro
chapter: reading-a-problem
topics: [io, integers, overflow]
check: output
standard: c++20
timeLimitMs: 2000
---

Read an integer `n`, then `n` integers. Print their sum.

**Input.** The first line contains `n`. The next line contains `n` integers
separated by spaces. They may be spread across several lines instead; read them
in order and do not assume where the line breaks are.

**Output.** One line containing the sum.

**Constraints.** `0 ≤ n ≤ 100000`, and each value is between `-10^9` and `10^9`.

Do the arithmetic on those constraints before you write the loop. Two of the
hidden cases exist only to punish getting it wrong.

## Starter
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    int total = 0;
    for (int i = 0; i < n; ++i) {
        int value;
        std::cin >> value;
        total += value;
    }

    std::cout << total << '\n';
}
```

## Cases

### Sample
```in
3
1 2 3
```
```out
6
```

### n is zero
```in
0
```
```out
0
```

### negatives
```in
5
-5 5 -7 7 -1
```
```out
-1
```

### split across lines
```in
4
10
20
30
40
```
```out
100
```

### the sum does not fit in an int
```in
6
1000000000 1000000000 1000000000 1000000000 1000000000 1000000000
```
```out
6000000000
```

### and neither does the negative one
```in
4
-1000000000 -1000000000 -1000000000 -1000000000
```
```out
-4000000000
```

## Hints
- 100000 values of up to 10⁹ each is a sum of up to 10¹⁴. An `int` holds about 2.1 × 10⁹.
- The accumulator is the thing that overflows, not the printed value. Widening the output does nothing if the addition already wrapped.
- `long long total = 0;` is the entire fix.
- `n = 0` means the loop body never runs and the answer is `0`. Nothing special is needed for it — but check that your program prints `0` rather than nothing.
- `std::cin >>` skips all whitespace, including newlines, so a program that reads `n` values in a loop handles any line layout without extra work.
- Print `'\n'` rather than `std::endl`: `endl` flushes, which you do not need here and cannot afford on a problem with a large output.

## Solution
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    long long total = 0;              // up to 10^14; an int holds 2.1 * 10^9
    for (int i = 0; i < n; ++i) {
        int value;                    // each value fits in an int
        std::cin >> value;
        total += value;
    }

    std::cout << total << '\n';
}
```

## Notes
This is the smallest problem that has all the parts, which is why it is the
first one.

The only real decision is the accumulator's type, and it is decided by
arithmetic on the constraints rather than by taste: `100000 × 10^9 = 10^14`, an
`int` holds about `2.1 × 10^9`, so the sum needs 64 bits. Note that the
individual *values* fit in an `int` perfectly well — widening every variable in
sight is not the lesson. Widen the one that accumulates.

Two things about how a judge differs from the `CHECK` problems elsewhere in this
book. The program is run once per case, from scratch, with that case's input on
stdin — so there is no shared state between cases and nothing to reset. And it is
judged on its **stdout**, compared byte for byte after trailing whitespace is
trimmed. A `std::cout << "Sum: "` prefix is a wrong answer. A missing newline is
not, since trailing whitespace is trimmed, but print one anyway; some judges are
stricter than this one.

The `n = 0` case is worth pausing on. The loop body never runs, `total` keeps
its initial value, and the program prints `0`. That is correct without any
special handling — but only because the accumulator was *initialised*. An
uninitialised `long long total;` would print whatever was on the stack, pass the
sample, and fail here. Chapter 1.2 made that point with a sanitizer; a judge
makes it with a verdict.

The two overflow cases are deliberately at the top and bottom of the range. A
solution that switches to `unsigned` instead of `long long` passes the positive
one and fails the negative one, which is the kind of thing hidden tests are for.
