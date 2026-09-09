---
id: bitmask-audit
title: "Three masks that lose a bit"
difficulty: core
chapter: bitmask-enumeration
topics: [bitmask, bit-manipulation, algorithms]
check: unit
standard: c++20
---

Three small bit routines, each losing exactly one thing: the top half of a
value, the meaning of a test, or the empty case.

- `count_bits(x)` — the number of set bits in a 64-bit value. Narrows to 32 bits
  before counting.
- `count_supersets(n, required)` — how many masks in `[0, 2ⁿ)` contain **every**
  bit of `required`. Tests for *any* shared bit instead of all.
- `submasks(m)` — every submask of `m`, in descending order, including the empty
  one. Stops before reaching 0.

## Starter
```cpp
#include <bit>
#include <cstdint>
#include <vector>

int count_bits(std::uint64_t x) {
    return std::popcount(static_cast<std::uint32_t>(x));   // the top half is gone
}

long long count_supersets(int n, unsigned required) {
    long long total = 0;
    for (unsigned m = 0; m < (1u << n); ++m)
        if (m & required) ++total;                         // any bit, not all of them
    return total;
}

std::vector<unsigned> submasks(unsigned m) {
    std::vector<unsigned> out;
    for (unsigned s = m; s; s = (s - 1) & m) out.push_back(s);   // never reaches 0
    return out;
}
```

## Tests
```cpp
// count_bits
CHECK_EQ(count_bits(0), 0);
CHECK_EQ(count_bits(1), 1);
CHECK_EQ(count_bits(0xFFu), 8);
CHECK_EQ(count_bits(1099511627783ULL), 4);            // 2^40 + 7
CHECK_EQ(count_bits(0xFFFFFFFFFFFFFFFFULL), 64);
CHECK_EQ(count_bits(1ULL << 63), 1);
CHECK_EQ(count_bits(0xFFFFFFFF00000000ULL), 32);

// count_supersets
CHECK_EQ(count_supersets(3, 0b101u), 2LL);            // 101 and 111
CHECK_EQ(count_supersets(3, 0u), 8LL);                // everything contains nothing
CHECK_EQ(count_supersets(4, 0b1111u), 1LL);
CHECK_EQ(count_supersets(5, 0b1u), 16LL);
CHECK_EQ(count_supersets(1, 0b1u), 1LL);
CHECK_EQ(count_supersets(4, 0b1010u), 4LL);

// submasks
CHECK_EQ(submasks(0b1011u), (std::vector<unsigned>{11, 10, 9, 8, 3, 2, 1, 0}));
CHECK_EQ(submasks(0u), (std::vector<unsigned>{0}));
CHECK_EQ(submasks(1u), (std::vector<unsigned>{1, 0}));
CHECK_EQ(submasks(0b111u), (std::vector<unsigned>{7, 6, 5, 4, 3, 2, 1, 0}));
```

## Hints
- `std::popcount` is defined for every unsigned type. Pass the `std::uint64_t` straight through and it counts all 64 bits; the cast to `std::uint32_t` throws away the top half before it ever gets there.
- "Contains every bit of `required`" is `(m & required) == required`. `m & required` alone is non-zero as soon as *one* bit overlaps, which is a different question.
- `required == 0` is the case that shows the difference: every mask contains the empty set, so the answer is 2ⁿ, and the starter says 0.
- The submask idiom cannot use `s` as the loop condition and still produce 0 — `(s - 1) & m` reaches 0 and the loop exits before the body runs. Move the test to the bottom: `for (unsigned s = m;; s = (s - 1) & m) { out.push_back(s); if (s == 0) break; }`.
- `submasks(0)` must return `{0}`, not an empty vector: the empty set has exactly one submask, itself.
- If you prefer the shorter loop, handle 0 explicitly afterwards. Either is fine; silently dropping it is not.

## Solution
```cpp
#include <bit>
#include <cstdint>
#include <vector>

int count_bits(std::uint64_t x) {
    return std::popcount(x);                               // all 64 bits
}

long long count_supersets(int n, unsigned required) {
    long long total = 0;
    for (unsigned m = 0; m < (1u << n); ++m)
        if ((m & required) == required) ++total;           // every required bit
    return total;
}

std::vector<unsigned> submasks(unsigned m) {
    std::vector<unsigned> out;
    for (unsigned s = m;; s = (s - 1) & m) {
        out.push_back(s);
        if (s == 0) break;                                 // the empty submask is last
    }
    return out;
}
```

## Notes
**A cast is not a formality.** `static_cast<std::uint32_t>(x)` is a well-defined
narrowing that keeps the low 32 bits and discards the rest, and `std::popcount`
then correctly counts what it was given. Nothing is wrong except the input.
`count_bits(1ULL << 63)` returns 0 in the starter, which is as clear a symptom as
this bug produces — and the reason to test with a value above 2³² rather than
only with small ones.

The general habit: when a function takes a wide type, check that every
intermediate is wide too. This is the same failure as chapter 10.7's prefix sums
in an `int`, one level down.

**`&` is not a containment test.** `m & required` asks "do these overlap"; the
question was "does `m` include all of `required`". The two agree only when
`required` has a single bit, which is exactly the case people test with. The
identity worth knowing:

```
(m & r) == r     m contains all of r
(m & r) != 0     m contains at least one bit of r
(m & r) == 0     m and r are disjoint
(m | r) == m     m contains all of r  (the same test, written the other way)
```

`required == 0` separates them at once: everything contains the empty set, so
the answer is 2ⁿ, and a test for `m & 0` is never true.

**The submask walk cannot use `s` as its condition.** `for (s = m; s; s = (s-1)
& m)` is the form you will see written most often, and it is correct only when
the empty submask does not matter. When it does — which is most of the time, an
empty group being a legitimate group — the loop must test at the bottom.

`submasks(0)` returning `{0}` rather than `{}` is the case to keep. An empty
mask has exactly one submask, and a routine that returns nothing for it will
make some outer loop silently skip an entire case.
