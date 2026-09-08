---
id: overflow-audit
title: "Four sums that do not fit"
difficulty: core
chapter: reading-a-problem
topics: [integers, overflow, constraints]
check: unit
standard: c++20
---

Four functions, each with the problem's constraints written above it. Each one
is correct for small inputs and overflows within the limits it is given.

Fix them. Do not change any signature — the return types are already wide
enough, and the bug is in the arithmetic.

- `total(values)` — the sum. `n ≤ 100000`, each value up to 10⁹.
- `area(width, height)` — the product. Both up to 10⁵.
- `triangular(n)` — `1 + 2 + … + n`. `n ≤ 2 × 10⁹`.
- `mean_times_two(values)` — twice the mean, rounded down. Same limits as
  `total`.

## Starter
```cpp
#include <cstddef>
#include <vector>

// n <= 100000, 0 <= values[i] <= 1000000000
long long total(const std::vector<int>& values) {
    int sum = 0;
    for (int v : values) sum += v;
    return sum;
}

// 1 <= width, height <= 100000
long long area(int width, int height) {
    return width * height;
}

// 1 <= n <= 2000000000
long long triangular(long long n) {
    return n * (n + 1) / 2;
}

// n <= 100000, 0 <= values[i] <= 1000000000, and values is never empty
long long mean_times_two(const std::vector<int>& values) {
    int sum = 0;
    for (int v : values) sum += v;
    return 2 * sum / static_cast<int>(values.size());
}
```

## Tests
```cpp
// total
CHECK_EQ(total({}), 0LL);
CHECK_EQ(total({1, 2, 3}), 6LL);
{
    std::vector<int> big(100000, 1000000000);
    CHECK_EQ(total(big), 100000000000000LL);      // 10^14
}

// area
CHECK_EQ(area(3, 4), 12LL);
CHECK_EQ(area(100000, 100000), 10000000000LL);    // 10^10
CHECK_EQ(area(1, 100000), 100000LL);

// triangular
CHECK_EQ(triangular(1), 1LL);
CHECK_EQ(triangular(10), 55LL);
CHECK_EQ(triangular(2000000000LL), 2000000001000000000LL);

// mean_times_two
CHECK_EQ(mean_times_two({4}), 8LL);
CHECK_EQ(mean_times_two({1, 2, 3}), 4LL);         // 2*6/3
{
    std::vector<int> big(100000, 1000000000);
    CHECK_EQ(mean_times_two(big), 2000000000LL);
}
{
    // Twice the mean must be computed from the true sum, not from a mean that
    // was already rounded down.
    std::vector<int> values{1, 1, 1, 2};
    CHECK_EQ(mean_times_two(values), 2LL);        // 2*5/4 = 2, not 2*(5/4) = 2
}
{
    std::vector<int> values{3, 3, 3, 3, 3, 3, 3};
    CHECK_EQ(mean_times_two(values), 6LL);
}
```

## Hints
- Work out the largest value each expression can reach *before* looking at the code. 100000 × 10⁹ is 10¹⁴, which needs more than 32 bits.
- `total`'s accumulator is an `int`. The return type is already `long long`; the loop variable is what overflows.
- `area` returns `long long`, but `width * height` is an `int` multiplication that overflows first. `1LL * width * height`, or make one operand `long long`.
- `triangular` takes `long long` already, so `n * (n + 1)` is a 64-bit multiplication — 2 × 10⁹ squared is 4 × 10¹⁸, which fits in `long long` (max 9.2 × 10¹⁸). This one is fine as written; check it rather than assuming.
- `mean_times_two` has the same accumulator bug as `total`, and the division has to happen last: multiply the sum by 2 first, then divide.
- Do not "fix" anything by casting the result. `static_cast<long long>(a * b)` casts a value that has already overflowed.

## Solution
```cpp
#include <cstddef>
#include <vector>

// n <= 100000, 0 <= values[i] <= 1000000000  ->  sum up to 10^14
long long total(const std::vector<int>& values) {
    long long sum = 0;
    for (int v : values) sum += v;
    return sum;
}

// 1 <= width, height <= 100000  ->  product up to 10^10
long long area(int width, int height) {
    return 1LL * width * height;
}

// 1 <= n <= 2000000000  ->  n*(n+1) up to 4 * 10^18, which fits in long long
long long triangular(long long n) {
    return n * (n + 1) / 2;
}

// Multiply before dividing, and accumulate wide.
long long mean_times_two(const std::vector<int>& values) {
    long long sum = 0;
    for (int v : values) sum += v;
    return 2 * sum / static_cast<long long>(values.size());
}
```

## Notes
Three bugs and one function that was already right — and being able to tell
which is which without running anything is the skill.

The arithmetic to do before writing any loop is: *what is the largest value this
expression can hold?* For `total` that is 100000 × 10⁹ = 10¹⁴, which is about
50,000 times what an `int` holds. The declared return type is `long long` and
it makes no difference: the overflow happens in the accumulator, and the widening
occurs afterwards on a value that is already wrong.

`area` is the same mistake in its most compact form. `width * height` is an
`int` expression because both operands are `int`, and the type of an expression
is decided by its operands and never by what it is assigned to. `1LL * width *
height` forces the whole thing into 64 bits by making the first multiplication
64-bit, and every subsequent operand is promoted to match.

`triangular` is the control. `n` is already `long long`, so `n * (n + 1)` is a
64-bit multiplication, and 2 × 10⁹ × (2 × 10⁹ + 1) ≈ 4 × 10¹⁸ sits comfortably
under `long long`'s 9.2 × 10¹⁸ ceiling. Changing it would be a wasted edit, and
noticing that is as much a part of the audit as finding the three real bugs.
Widen everything reflexively and you eventually write `__int128` where an `int`
was fine, which is slower and no more correct.

`mean_times_two` carries a second, independent bug that has nothing to do with
overflow: integer division truncates, so `2 * (sum / n)` and `(2 * sum) / n`
are different functions. The check with `{1, 1, 1, 2}` is what separates them —
sum is 5 and n is 4, so the correct answer is 10/4 = 2, while dividing first
gives 2 × (5/4) = 2 × 1 = 2. They agree there by luck; with `{1,1,1,1,1,1,3}`
they would not. **Multiply before you divide** whenever both are integers and
you can afford the range.

On a judge, none of these announce themselves. Signed overflow is undefined
behaviour, so there is no exception and no message — just a wrong number on a
test case you never see. The sanitizers on this site catch it, which is a
luxury; the habit of doing the arithmetic first is what you take to the contest.
