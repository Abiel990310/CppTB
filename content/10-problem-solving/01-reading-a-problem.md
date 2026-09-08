---
title: "How to read a problem and its limits"
navTitle: "Reading a problem"
summary: >-
  The constraints are half the statement, and they usually name the algorithm.
objectives:
  - Read a problem's constraints and derive the operation budget they imply
  - Identify the edge cases a statement implies but does not list
  - Write a solution that reads input and writes output in the format required
status: complete
standard: c++20
requires: [project]
---

The rest of this book was about writing C++ well. This part is about a narrower
skill: given a problem statement and a time limit, work out *which* algorithm
you are allowed to use, and then write it without bugs on the first attempt.

That skill starts before any code, with a habit most people take years to
acquire: **read the constraints first**. A competitive problem statement has
three parts — a story, an input/output format, and a block of limits — and
beginners read them in that order. The limits are the part that tells you what
to write.

## Your operation budget

A judge gives you a time limit, usually one or two seconds. To turn that into a
decision you need one number: how many simple operations a second buys.

```cpp run title="How much a second is worth"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    std::vector<int> data(1000, 1);

    for (long long n : {1'000'000LL, 10'000'000LL}) {
        auto start = std::chrono::steady_clock::now();
        long long total = 0;
        for (long long i = 0; i < n; ++i) total += data[i % 1000] + int(i & 7);
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        keep(total);
        std::printf("%11lld operations: %7.1f ms  (%.0f million per second)\n",
                    n, ms, n / ms / 1000.0);
    }
}
```

Press Run and you will see roughly **100 million operations per second**. That
is not the number to plan with, because this page compiles at `-O0` with
sanitizers. The same program built the way a judge builds it — `-O2`, no
sanitizers — does **770 million per second** on the same machine.

So the working figure is: **a judge does a few hundred million simple operations
per second.** Round it to 10⁸ per second and you will rarely be wrong in a way
that matters. "Simple" is load, add, compare, branch. A division is several. A
`std::map` lookup is dozens. A memory access that misses cache is hundreds —
which is why Chapter 7.3 exists.

## The table that reads constraints backwards

Given *n*, and a budget of about 10⁸ operations, this is what fits:

| n up to | Budget allows | Which usually means |
|---|---|---|
| 10¹⁸ | O(log n) or O(1) | binary search on the answer, maths, bit tricks |
| 10⁸ | O(n) | one pass, prefix sums, two pointers |
| 10⁶ | O(n log n) | sorting, a set or map, binary search per element |
| 10⁵ | O(n log n), or O(n √n) | sorting, segment tree, Mo's algorithm |
| 5 × 10³ | O(n²) | nested loops, simple DP over pairs |
| 500 | O(n³) | Floyd–Warshall, interval DP |
| 100 | O(n⁴) | almost anything polynomial |
| 24 | O(2ⁿ) | subset enumeration, bitmask DP |
| 20 | O(2ⁿ · n) | bitmask DP with a transition per bit |
| 11 | O(n!) | try every permutation |

Read it in whichever direction you need. `n ≤ 200000` rules out O(n²) —
4 × 10¹⁰ operations, several minutes — so the answer sorts, or uses a hash map,
or sweeps. `n ≤ 18` in a problem about choosing a subset is not a coincidence:
2¹⁸ is 262,144, and the setter chose 18 so that the exponential solution fits
and nothing smarter is required.

:::tip
The constraint is a message from the problem setter. They picked it so that the
intended solution passes and the obvious one does not. If `n ≤ 100` where you
expected 10⁵, they are telling you an O(n³) solution is welcome — which usually
means the clever linear approach you were about to spend an hour on is not
needed. Small limits are permission, not a trap.
:::

## The other half of the constraints: how big the *values* are

`n` bounds the loop. The value bounds decide the **type**, and getting that
wrong is the single most common way to fail a problem you had solved.

```cpp run expect-ub title="A sum that does not fit"
#include <cstdio>

int main() {
    // 100,000 values of up to 1,000,000 each: the sum is 10^11.
    int total = 0;
    for (int i = 0; i < 100'000; ++i) total += 1'000'000;
    std::printf("%d\n", total);
}
```

> runtime error: signed integer overflow: 2147000000 + 1000000 cannot be
> represented in type 'int'

The sanitizers on this page catch it. **A judge does not.** There, signed
overflow is undefined behaviour that in practice wraps silently, the program
prints `1215752192`, and you get "wrong answer" on a case you cannot see with no
hint as to why. Change `total` to `long long` and it prints
`100000000000`.

The arithmetic to do before writing the loop:

| `int` | up to about 2.1 × 10⁹ |
| `unsigned` | up to about 4.2 × 10⁹ |
| `long long` | up to about 9.2 × 10¹⁸ |
| `double` | exact integers only up to 2⁵³ ≈ 9 × 10¹⁵ |

And the multiplication trap, which catches people who *did* use `long long`:

```cpp
long long product = a * b;          // WRONG if a and b are int
long long product = 1LL * a * b;    // right
```

`a * b` is computed in `int` and overflows *before* the assignment widens it.
The `1LL *` forces the whole expression into 64 bits. If both operands are `int`
and their product can exceed 2 × 10⁹, this is a bug regardless of what you
assign it to.

## The edge cases the statement does not list

A statement says `1 ≤ n ≤ 10^5`. It does not say "and please check n = 1". The
hidden tests do.

The list worth running through every time, before submitting:

- **The smallest legal input.** `n = 1`, or `n = 0` if zero is allowed. Does the
  loop body run? Does an empty answer print correctly, or print nothing at all?
- **The largest legal input.** Does it fit the time limit, and does the answer
  fit the type?
- **All elements identical.** Breaks anything that assumes a strict order or a
  unique maximum.
- **Already sorted, and sorted backwards.** The two extremes for anything
  order-sensitive.
- **Negative values and zero**, whenever the constraints permit them. `x % 2 == 1`
  is false for every negative odd number, as Chapter 7.1 showed.
- **The answer being zero, or empty, or "impossible".** Many statements specify
  what to print when there is no answer, in one sentence, once.

```cpp run title="The same function, at its edges"
#include <cstdio>
#include <vector>

// The largest gap between consecutive elements of a sorted list.
long long largest_gap(std::vector<long long> values) {
    if (values.size() < 2) return 0;              // no pair exists
    long long best = 0;
    for (std::size_t i = 1; i < values.size(); ++i)
        best = (values[i] - values[i - 1] > best) ? values[i] - values[i - 1] : best;
    return best;
}

int main() {
    std::printf("empty:      %lld\n", largest_gap({}));
    std::printf("one:        %lld\n", largest_gap({7}));
    std::printf("identical:  %lld\n", largest_gap({4, 4, 4}));
    std::printf("normal:     %lld\n", largest_gap({1, 3, 9, 10}));
    std::printf("huge:       %lld\n", largest_gap({-1'000'000'000LL, 1'000'000'000LL}));
}
```

The last line is the one that matters: two values at opposite ends of a 10⁹
range give a gap of 2 × 10⁹, which does not fit in an `int`. The function
returns `long long` for exactly that reason, and the check is what makes the
decision visible.

## Reading input and writing output

A judge compares your stdout with the expected output, byte for byte, after
trimming trailing whitespace. That leads to three rules that are not negotiable.

**Read exactly what the format section describes**, in order. `std::cin >>`
skips whitespace including newlines, so the layout of the input across lines
almost never matters — read the counts and the values in sequence.

**Print exactly what the output section asks for**, and nothing else. No
`"Enter n: "`, no `"The answer is "`, no decorative separators. A prompt is a
wrong answer.

**One value per line, or space-separated on one line** — whichever the statement
shows. Follow the sample output's shape exactly.

```cpp run title="The shape of every solution in this part"
#include <iostream>

int main() {
    // Every judge problem starts like this.
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) return 0;      // no input: nothing to do

    long long total = 0;
    for (int i = 0; i < n; ++i) {
        long long value;
        std::cin >> value;
        total += value;
    }

    std::cout << total << '\n';
}
```

Press Run: with no input on this page, it reads nothing and prints nothing,
which is the correct behaviour for an empty file.

The two lines at the top untie C++'s streams from C's and stop `cin` flushing
`cout` before every read. They make `cin` several times faster and cost nothing
here; Chapter 10.3 measures exactly how much and explains when it matters.

`'\n'` rather than `std::endl` is the other habit to build now. `std::endl`
flushes the stream, and flushing after every line of a 200,000-line output is a
common and entirely avoidable way to exceed a time limit.

## A worked example

> **Balanced split.** You are given `n` integers. Print `YES` if they can be
> split into two groups with equal sums, and `NO` otherwise.
>
> `1 ≤ n ≤ 20`, `1 ≤ aᵢ ≤ 10^9`.

Read the constraints before thinking about the algorithm:

- `n ≤ 20` is small enough for 2²⁰ ≈ 10⁶ subsets. The limit is telling you to
  enumerate them, and it would be `n ≤ 100` if the setter wanted a subset-sum
  DP.
- `aᵢ ≤ 10⁹` with `n ≤ 20` means the total is up to 2 × 10¹⁰. **`long long`.**
- The total sum being odd means the answer is `NO` immediately — no split can
  give two equal halves of an odd number.

Then the edges the statement does not mention: `n = 1` cannot be split into two
non-empty groups, so it is `NO` unless the problem permits an empty group, which
it does not say. That ambiguity is real, and the practical resolution is to
assume the strict reading and check against the sample.

The solution writes itself once the reading is done — which is the entire point
of this chapter, and this problem is the practice below.

## Check yourself

:::quiz
{
  "question": "A problem says `1 ≤ n ≤ 300` and the time limit is 2 seconds. What does that suggest?",
  "options": [
    { "text": "An O(n³) solution is expected — 300³ is 2.7 × 10⁷, comfortably inside the budget", "correct": true, "why": "A limit that low is permission. If a linear solution were required the setter would have written 10⁵, because otherwise the cubic one passes and the problem does not test what they wanted." },
    { "text": "An O(n) solution is required", "why": "It would pass, but nothing in the constraints demands it — and looking for one wastes the time the low limit was meant to save you." },
    { "text": "An O(2ⁿ) solution is expected", "why": "2³⁰⁰ is not a number anything finishes. Exponential limits are in the region of n ≤ 25." },
    { "text": "Not enough information without knowing the memory limit", "why": "Memory matters, but the time limit and n together already point at a complexity class." }
  ]
}
:::

:::quiz
{
  "question": "`int a = 100000, b = 100000; long long c = a * b;` — what is `c`?",
  "options": [
    { "text": "Undefined behaviour: `a * b` is computed as `int` and overflows before the widening assignment happens", "correct": true, "why": "The type of an expression is decided by its operands, not by what it is assigned to. `1LL * a * b` forces the multiplication into 64 bits." },
    { "text": "10,000,000,000 — the assignment to `long long` widens the operands", "why": "The widening happens after the multiplication, which has already overflowed." },
    { "text": "A compile error about narrowing", "why": "Nothing narrows here; the compiler is happy, and that is the problem." },
    { "text": "1,410,065,408 — the wrapped value, reliably", "why": "That is what it prints in practice, but signed overflow is undefined behaviour, so it is not a value you may rely on. UBSan reports it." }
  ]
}
:::

## Practice

:::exercise overflow-audit

:::exercise edge-case-audit

:::exercise judge-sum-of-n

:::exercise judge-balanced-split

:::recap
- Read the constraints before the story. They tell you the complexity class the
  setter intended.
- Budget about 10⁸ simple operations per second. Measured here: 770 million at
  `-O2`, and 100 million on this page's `-O0` sanitized build — which is why the
  numbers you see when you press Run are not the numbers to plan with.
- Small limits are permission, not a trap. `n ≤ 300` means a cubic solution is
  welcome.
- The value bounds decide the type. A sum of 10⁵ values of 10⁶ needs
  `long long`, and `a * b` on two `int`s overflows before the assignment widens
  it — write `1LL * a * b`.
- Check the edges the statement omits: the smallest input, the largest, all
  equal, sorted both ways, negatives, and the "no answer" case.
- Read exactly the specified format and print exactly the specified output. No
  prompts. `'\n'`, not `std::endl`.
:::
