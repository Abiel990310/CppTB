---
id: judge-multi-case
title: "Spread, over many test cases"
difficulty: intro
chapter: contest-template
topics: [io, multi-case, integers]
check: output
standard: c++20
timeLimitMs: 2000
---

The input holds several independent test cases. For each one, print the
difference between the largest and smallest value.

**Input.** The first line contains `t`, the number of test cases. Each case is
two lines: a count `n`, then `n` integers.

**Output.** One line per test case: the largest value minus the smallest.

**Constraints.** `1 ≤ t ≤ 100`, `1 ≤ n ≤ 1000`, and each value is between
`-10^9` and `10^9`.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int t;
    std::cin >> t;

    // Reads only the first case, and assumes every case has the same size.
    int n;
    std::cin >> n;
    std::vector<int> values(n);
    for (int& x : values) std::cin >> x;

    int smallest = values[0];
    int largest = values[0];
    for (int x : values) {
        if (x < smallest) smallest = x;
        if (x > largest) largest = x;
    }
    std::cout << largest - smallest << '\n';
}
```

## Cases

### Sample
```in
3
3
1 5 3
1
7
4
-1000000000 1000000000 0 5
```
```out
4
0
2000000000
```

### one case, all values equal
```in
1
4
-5 -5 -5 -5
```
```out
0
```

### many small cases
```in
5
2
1 2
2
10 3
2
-1 -1
2
0 100
2
-100 0
```
```out
1
7
0
100
100
```

### cases of different sizes
```in
2
1
42
5
5 4 3 2 1
```
```out
0
4
```

### the spread does not fit in an int
```in
2
2
-1000000000 1000000000
3
-999999999 0 999999999
```
```out
2000000000
1999999998
```

## Hints
- Wrap everything after reading `t` in a loop: `while (t--) { … }`. The count and the values must both be read inside it.
- Each case has its **own** `n`. Reading it once outside the loop works on a sample where every case happens to be the same length, which is why samples look like that.
- `1000000000 − (−1000000000)` is 2 × 10⁹, which does not fit in an `int` (about 2.147 × 10⁹ — so it *just* fits, and 1999999998 does too). Check the arithmetic rather than assuming either way, and use `long long` if you are not certain.
- Print one line per case as you go. There is no need to collect the answers and print them at the end.
- `n ≥ 1` is guaranteed, so `values[0]` is always safe as the initial minimum and maximum — but initialising both from the first element, rather than from 0, is what makes the all-negative case work.

## Solution
```cpp
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int t;
    if (!(std::cin >> t)) return 0;

    while (t--) {
        int n;
        std::cin >> n;                    // each case has its own count

        long long smallest = 0;
        long long largest = 0;
        for (int i = 0; i < n; ++i) {
            long long x;
            std::cin >> x;
            if (i == 0) {                 // seed from the first value, not from 0
                smallest = x;
                largest = x;
            } else {
                if (x < smallest) smallest = x;
                if (x > largest) largest = x;
            }
        }

        std::cout << largest - smallest << '\n';
    }
}
```

## Notes
The multi-case shape is the most common one in contests and the easiest to get
subtly wrong, because the mistake survives the sample.

Reading `n` once, outside the loop, is fine whenever every case is the same
size — and sample inputs very often are, because they are written by hand to be
readable. The "cases of different sizes" case exists for that reason alone. When
a solution passes the sample and fails everything else, this is one of the first
things to check.

The other trap is seeding the minimum and maximum from `0` rather than from the
first element. With all-negative input, `0` is larger than everything, so the
maximum comes out as `0` and the spread is wrong — the same bug the
`edge-case-audit` problem in Chapter 10.1 makes explicit. The check with
`-5 -5 -5 -5` catches it, and so does the `-100 0` case in the middle of the
small ones.

On the arithmetic: `1000000000 − (−1000000000)` is exactly 2,000,000,000, which
fits in a signed 32-bit `int` with about 147 million to spare. So `int` would in
fact work throughout this problem. The solution uses `long long` anyway, and
that is a defensible habit rather than a necessity — when the margin is 7%, the
cost of being wrong is a wrong answer on a hidden case and the cost of being
careful is nothing. Chapter 10.1's advice was to do the arithmetic; having done
it, "it fits, but barely" is a reason to widen rather than a reason not to.

`while (t--)` is idiomatic in contest code and worth reading carefully: it tests
`t`, then decrements, so it runs exactly `t` times and leaves `t` at `-1`. Nobody
looks at `t` afterwards, which is why it is acceptable here and would not be in
the rest of this book.
