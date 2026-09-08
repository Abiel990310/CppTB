---
id: judge-fib
title: "Fibonacci, modulo a prime"
difficulty: core
chapter: counting-the-work
topics: [recursion, complexity, modular-arithmetic, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the `n`-th Fibonacci number modulo `1000000007`, where `F(0) = 0`,
`F(1) = 1`, and `F(i) = F(i-1) + F(i-2)`.

**Input.** One line containing `n`.

**Output.** One line: `F(n) mod 1000000007`.

**Constraints.** `0 ≤ n ≤ 1000000`.

The definition is a recurrence and the obvious code is a recursion. Count what
that recursion costs before you submit it: `n` goes to a million.

## Starter
```cpp
#include <iostream>

const long long MOD = 1000000007;

long long fib(long long n) {
    if (n < 2) return n;
    return (fib(n - 1) + fib(n - 2)) % MOD;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    long long n;
    std::cin >> n;
    std::cout << fib(n) << '\n';
}
```

## Cases

### Sample
```in
10
```
```out
55
```

### zero
```in
0
```
```out
0
```

### one
```in
1
```
```out
1
```

### past where the naive recursion finishes
```in
50
```
```out
586268941
```

### past where a long long overflows
```in
90
```
```out
210345902
```

### a million
```in
1000000
```
```out
918091266
```

## Hints
- The naive recursion recomputes the same values over and over: `fib(n)` calls `fib(n-1)` and `fib(n-2)`, and both of those recompute `fib(n-3)`. The number of calls is itself roughly `F(n)`, which is exponential.
- Measured on this machine, the recursion takes about a second for `n = 40` and would take minutes for `n = 50`. `n = 1000000` is not a number it ever reaches.
- Build upwards instead. Keep the last two values and loop `n` times, which is O(n) and one pass.
- Two variables are enough: no array, no memoisation table.
- Take the modulus at every step, not at the end. `F(90)` is about 2.9 × 10¹⁸, which is close to `long long`'s ceiling, and `F(91)` exceeds it.
- `F(50)` is 12,586,269,025, which is larger than the modulus, so the expected output is the reduced value. A program that forgets the modulus prints the full number and fails this case.
- `n = 0` must print `0`, so the loop must handle running zero times.

## Solution
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    long long n;
    std::cin >> n;

    const long long MOD = 1000000007;

    // a = F(i), b = F(i+1). After n steps, a is F(n).
    long long a = 0;
    long long b = 1;
    for (long long i = 0; i < n; ++i) {
        long long next = (a + b) % MOD;
        a = b;
        b = next;
    }

    std::cout << a << '\n';
}
```

## Notes
The recursion is not slow because recursion is slow. It is slow because it
computes the same subproblems repeatedly: `fib(n-2)` is evaluated twice,
`fib(n-3)` three times, `fib(n-4)` five times, and the multipliers are the
Fibonacci numbers themselves. The call count is Θ(φⁿ) — exponential, from four
lines that read like a direct transcription of the definition.

The numbers, measured on this machine at the settings this site compiles with:
`n = 30` takes 23 ms, `n = 38` takes 390 ms, `n = 40` takes 987 ms. Each step of
`+1` multiplies by about 1.6, so `n = 50` is about two minutes and `n = 60` is
about three hours. The iterative version does `n = 1000000` in 18 ms.

That gap is the chapter's point arriving as a verdict rather than a graph. The
recursion is fine for `n = 10`, and a sample case of `n = 10` is exactly what a
statement shows you.

Two details that are easy to get wrong and that the cases check.

**Take the modulus inside the loop.** `F(90)` is 2,880,067,194,370,816,120,
which fits in a `long long` with little room; `F(93)` does not. Reducing at every
step keeps both values under `10^9 + 7` so the addition can never overflow.
Reducing only at the end means overflowing long before you get there — and
signed overflow is undefined behaviour, not a wrapped answer you can correct.

**`n = 50` is the first case where the modulus does anything.** `F(50)` is
12,586,269,025, and `12586269025 − 12 × 1000000007 = 586268941`, which is what
the case expects. Every smaller case in this problem has `F(n)` below the
modulus, so a program that never reduces at all passes all of them — which is
precisely why this case is here. Cases that only exercise the path where a step
is a no-op test nothing about that step.

The general technique here — turn a recurrence into a loop that builds upwards,
keeping only the state the next step needs — is dynamic programming in its
smallest possible form, and Chapter 10.26 is the same idea with more state.
