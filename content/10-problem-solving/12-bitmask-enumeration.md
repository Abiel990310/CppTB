---
title: "Bitmasks: enumerating subsets and permutations"
navTitle: "Bitmasks"
summary: >-
  A subset is an integer. What that buys you, what it costs, and the three
  idioms worth memorising.
objectives:
  - Represent a subset as an integer and enumerate all of them
  - Use the standard bit intrinsics instead of hand-rolled loops
  - Enumerate every submask of every mask in 3^n rather than 4^n
  - Generate distinct permutations and combinations without writing a recursion
status: complete
standard: c++20
requires: [recursion-and-backtracking]
---

Chapter 10.11 generated subsets by recursion. There is a second representation
— a subset of `n` items is an `n`-bit integer, bit `i` meaning "item `i` is in"
— and it is worth learning as a separate skill, because it makes the *state* of
a search an integer you can index an array with. That is what chapters 10.15 and
10.30 need.

It is not automatically faster. That is the first thing to measure.

## A subset is an integer

```cpp run title="Three ways over the same 1,048,576 subsets"
#include <bit>
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Sum of the maximum of every non-empty subset, three ways.
long long by_recursion(const std::vector<int>& a) {
    long long total = 0;
    auto go = [&](auto&& self, std::size_t i, int best, bool any) -> void {
        if (i == a.size()) { if (any) total += best; return; }
        self(self, i + 1, best, any);                       // skip
        self(self, i + 1, best > a[i] ? best : a[i], true); // take
    };
    go(go, 0, 0, false);
    return total;
}

long long by_bitmask(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    long long total = 0;
    for (int m = 1; m < (1 << n); ++m) {
        int best = 0;
        for (int i = 0; i < n; ++i)                          // rescans every bit
            if (m >> i & 1) best = best > a[i] ? best : a[i];
        total += best;
    }
    return total;
}

// Each mask reuses the answer for the mask with its lowest set bit removed.
long long by_mask_dp(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<int> best(1 << n, 0);
    long long total = 0;
    for (int m = 1; m < (1 << n); ++m) {
        int low = std::countr_zero(static_cast<unsigned>(m));   // lowest set bit index
        int rest = m & (m - 1);                                 // m without that bit
        best[m] = best[rest] > a[low] ? best[rest] : a[low];
        total += best[m];
    }
    return total;
}

int main() {
    const int n = 20;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = 1 + (i * 37) % 100;

    auto t0 = std::chrono::steady_clock::now();
    long long r1 = by_recursion(a);
    auto t1 = std::chrono::steady_clock::now();
    long long r2 = by_bitmask(a);
    auto t2 = std::chrono::steady_clock::now();
    long long r3 = by_mask_dp(a);
    auto t3 = std::chrono::steady_clock::now();

    keep(r1); keep(r2); keep(r3);
    std::printf("recursion %8.1f ms -> %lld\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(), r1);
    std::printf("bitmask   %8.1f ms -> %lld\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count(), r2);
    std::printf("mask + reuse %5.1f ms -> %lld\n",
                std::chrono::duration<double, std::milli>(t3 - t2).count(), r3);
    std::printf("subsets visited: %d, all three agree: %s\n", 1 << n,
                (r1 == r2 && r2 == r3) ? "yes" : "no");
}
```

114 ms, 280 ms, 47 ms — and the naive bitmask loop is the **slowest** of the
three.

That is worth understanding rather than filing away. The recursion carries the
running maximum down the tree, so it does O(1) work per subset: 2ⁿ steps. The
naive mask loop throws that away and rebuilds the answer from scratch for every
mask, which is O(2ⁿ · n). The third version gets the best of both — it is a mask
loop that *reuses* the answer for `m & (m - 1)`, the same mask with one item
removed, so it is O(2ⁿ) again and beats the recursion because there are no calls.

**The bitmask is not a speed-up on its own. It is an addressing scheme.** Its
value is that `m` is an array index, so a subset can be a DP state, cached,
compared, or passed around as a single integer. When you write a mask loop with
an inner scan over the bits, check whether the previous mask already told you
the answer.

## The intrinsics

Hand-rolled bit loops are where off-by-ones live. C++20's `<bit>` header has the
operations named.

```cpp run title="What <bit> gives you"
#include <bit>
#include <cstdint>
#include <cstdio>

void show_bits(const char* label, std::uint32_t x) {
    std::printf("%-22s ", label);
    for (int b = 7; b >= 0; --b) std::printf("%d", x >> b & 1);
    std::printf("  (%u)\n", x);
}

int main() {
    const std::uint32_t x = 0b0010'1100;         // 44

    show_bits("x", x);
    show_bits("x & (x - 1)", x & (x - 1));       // clear the lowest set bit
    show_bits("x & -x", x & (~x + 1));           // isolate the lowest set bit
    show_bits("x | (x + 1)", x | (x + 1));       // set the lowest clear bit

    std::printf("popcount            %d\n", std::popcount(x));
    std::printf("countr_zero         %d   (index of the lowest set bit)\n",
                std::countr_zero(x));
    std::printf("countl_zero         %d\n", std::countl_zero(x));
    std::printf("bit_width           %d   (1 + index of the highest set bit)\n",
                std::bit_width(x));
    std::printf("has_single_bit(x)   %s\n", std::has_single_bit(x) ? "true" : "false");
    std::printf("has_single_bit(64)  %s\n",
                std::has_single_bit(64u) ? "true" : "false");

    // Iterate the set bits, cheapest first, without scanning the zeros.
    std::printf("set bit indices:");
    for (std::uint32_t m = x; m; m &= m - 1)
        std::printf(" %d", std::countr_zero(m));
    std::printf("\n");

    // A common contest need: is bit i set, set it, clear it, flip it.
    std::uint32_t f = 0;
    f |= 1u << 3;                                // set
    f |= 1u << 5;
    f &= ~(1u << 3);                             // clear
    f ^= 1u << 1;                                // flip
    show_bits("built by hand", f);
    std::printf("bit 5 set: %s, bit 3 set: %s\n",
                (f >> 5 & 1) ? "yes" : "no", (f >> 3 & 1) ? "yes" : "no");
}
```

Five things to take from that output.

- **`x & (x - 1)` clears the lowest set bit**, and `for (m = x; m; m &= m - 1)`
  iterates the set bits in `popcount(x)` steps rather than 32. Combined with
  `countr_zero` it gives you the indices.
- **`std::popcount` compiles to one instruction** on any modern CPU. It replaces
  GCC's `__builtin_popcount`, which is not portable, and a hand-written loop,
  which is not fast.
- **`std::has_single_bit(x)` is "is x a power of two"**, and it is the readable
  spelling of `x && !(x & (x - 1))`.
- **`std::bit_width(x)` is 1 + the index of the highest set bit**, which is
  `floor(log2(x)) + 1` for positive `x` and 0 for zero — the version of `log2`
  that does not involve floating point. Chapter 10.25 uses it for binary
  lifting.
- **These take unsigned types.** `std::popcount(-1)` does not compile, which is
  the library refusing to guess what you meant. Cast at the boundary.

One trap worth stating on its own: **`1 << i` is an `int`**, so `1 << 40` is
undefined behaviour and `1 << 31` is already the sign bit. For masks over more
than 30 items, write `1LL << i` or `1ULL << i`. This is the most common way a
bitmask solution fails on the largest test only.

## Every submask of every mask

Some problems need, for each set `m`, all of its subsets — partitioning a set
into groups, or a DP over subsets. The naive way is to test every pair of masks,
which is 4ⁿ. The idiom below is 3ⁿ, and the reason is a nice counting argument:
each item is in the submask, in the mask but not the submask, or in neither.

```cpp run title="The submask walk, and why it is 3^n"
#include <chrono>
#include <cstdio>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    // Every submask of every mask. The idiom is one line and the total is 3^n.
    for (int n = 1; n <= 4; ++n) {
        long long visits = 0;
        for (int m = 0; m < (1 << n); ++m)
            for (int s = m;; s = (s - 1) & m) {   // walks the submasks of m, descending
                ++visits;
                if (s == 0) break;                // the empty submask is last
            }
        long long power = 1;
        for (int i = 0; i < n; ++i) power *= 3;
        std::printf("n=%d  submask visits %4lld   3^n = %4lld\n", n, visits, power);
    }

    // The submasks of 1011 in binary, in the order the idiom produces them.
    const int m = 0b1011;
    std::printf("submasks of 1011:");
    for (int s = m;; s = (s - 1) & m) {
        std::printf(" %d%d%d%d", s >> 3 & 1, s >> 2 & 1, s >> 1 & 1, s & 1);
        if (s == 0) break;
    }
    std::printf("\n");

    // The cost, measured: 3^n against the 4^n of testing every pair of masks.
    const int n = 12;
    auto t0 = std::chrono::steady_clock::now();
    long long pairs = 0;
    for (int a = 0; a < (1 << n); ++a)
        for (int b = 0; b < (1 << n); ++b)
            if ((b & a) == b) ++pairs;            // b is a submask of a
    auto t1 = std::chrono::steady_clock::now();
    long long subs = 0;
    for (int a = 0; a < (1 << n); ++a)
        for (int s = a;; s = (s - 1) & a) { ++subs; if (s == 0) break; }
    auto t2 = std::chrono::steady_clock::now();

    keep(pairs); keep(subs);
    std::printf("n=12: every pair %7.1f ms (%lld hits), submask walk %6.1f ms (%lld)\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(), pairs,
                std::chrono::duration<double, std::milli>(t2 - t1).count(), subs);
}
```

Exactly 3ⁿ visits at every size, and at `n = 12` the walk finds the same 531,441
submasks in 1.2 ms where the double loop takes 40.7 ms.

The idiom needs care in two places:

- **`s = (s - 1) & m`** subtracts one from `s` — borrowing through the bits `m`
  does not have — and masks back down. It steps through the submasks in
  descending numeric order.
- **The loop cannot be `for (s = m; s; s = (s-1) & m)`** if you need the empty
  submask, because that condition stops before reaching 0. Either write the
  `if (s == 0) break;` at the bottom, as above, or handle `s == 0` separately
  and take the shorter loop. Choose deliberately; forgetting the empty submask
  is a silent one-case-missing bug.

## Permutations, duplicates, and combinations

The standard library generates permutations, and it handles repeated elements
correctly, which a hand-written swap recursion does not.

```cpp run title="next_permutation, and what the swap recursion does instead"
#include <algorithm>
#include <bit>
#include <cstdio>
#include <string>
#include <vector>

int main() {
    // 1. next_permutation walks the DISTINCT permutations, in sorted order,
    //    and handles repeated elements without any extra work.
    std::string s = "aab";
    std::sort(s.begin(), s.end());               // it must start sorted
    std::printf("distinct permutations of aab:");
    int distinct = 0;
    do { std::printf(" %s", s.c_str()); ++distinct; }
    while (std::next_permutation(s.begin(), s.end()));
    std::printf("   (%d)\n", distinct);

    // 2. The swap recursion produces one branch per position, so repeated
    //    elements give repeated outputs.
    std::string t = "aab";
    std::vector<std::string> raw;
    auto go = [&](auto&& self, std::size_t k) -> void {
        if (k == t.size()) { raw.push_back(t); return; }
        for (std::size_t i = k; i < t.size(); ++i) {
            std::swap(t[k], t[i]);
            self(self, k + 1);
            std::swap(t[k], t[i]);
        }
    };
    go(go, 0);
    std::printf("swap recursion produced %zu strings:", raw.size());
    for (const std::string& r : raw) std::printf(" %s", r.c_str());
    std::printf("\n");

    // 3. Combinations: choose k of n, as a sorted bool selector run backwards.
    const int n = 5, k = 3;
    std::vector<bool> pick(n, false);
    std::fill(pick.begin(), pick.begin() + k, true);   // 1 1 1 0 0
    int combos = 0;
    std::printf("choose 3 of 5:");
    do {
        std::printf(" {");
        bool first = true;
        for (int i = 0; i < n; ++i)
            if (pick[i]) { std::printf("%s%d", first ? "" : ",", i); first = false; }
        std::printf("}");
        ++combos;
    } while (std::prev_permutation(pick.begin(), pick.end()));
    std::printf("   (%d)\n", combos);

    // 4. The same, as bitmasks with a fixed popcount.
    std::printf("same as masks:");
    int masks = 0;
    for (int m = 0; m < (1 << n); ++m)
        if (std::popcount(static_cast<unsigned>(m)) == k) { std::printf(" %d", m); ++masks; }
    std::printf("   (%d)\n", masks);
}
```

Three distinct permutations of `aab` from `next_permutation`; six strings from
the swap recursion, with `aab` and `aba` and `baa` each appearing twice.

The rules that fall out:

- **`next_permutation` needs a sorted start** and returns `false` after
  producing the last permutation, which is why the loop is `do { } while`. Start
  unsorted and you get the tail of the sequence and nothing before it.
- **It skips duplicates for free**, because it generates the next
  *lexicographically larger* arrangement, and equal elements have no larger
  arrangement between them. That is a real advantage over the recursion, which
  needs a sort plus a `if (i > k && t[i] == t[k]) continue;` guard to match it.
- **`prev_permutation` on a sorted-descending bool vector enumerates
  combinations.** `1 1 1 0 0` is the largest arrangement, so the walk goes
  downwards through all `C(n, k)` of them, in the natural order.
- **The mask version is simpler when `n ≤ 25` or so**: loop over all masks and
  keep those with the right `popcount`. It costs 2ⁿ rather than `C(n, k)`, which
  is only worth it when `k` is near `n / 2` anyway.

## Where the limits are

| n | 2ⁿ | 3ⁿ | n! |
|---|---|---|---|
| 10 | 1,024 | 59,049 | 3,628,800 |
| 15 | 32,768 | 14,348,907 | 1.3 × 10¹² |
| 20 | 1,048,576 | 3.5 × 10⁹ | 2.4 × 10¹⁸ |
| 25 | 33,554,432 | 8.5 × 10¹¹ | — |

Reading a constraint of `n ≤ 20` as "2ⁿ is intended" is the single most useful
thing this table does; `n ≤ 40` means meet-in-the-middle (10.15), and `n ≤ 10`
with a permutation flavour means `n!` is fine. Chapter 10.1's habit of reading
the limits before choosing a technique is the same habit, applied to exponents.

:::quiz
{
  "question": "You write `for (int m = 0; m < (1 << n); ++m)` to enumerate subsets, and it works for n = 20 but produces nonsense for n = 35. Why?",
  "options": [
    { "text": "`1 << 35` shifts an `int` by more than its width, which is undefined behaviour; the mask must be built with `1LL << n`", "correct": true, "why": "The literal `1` is an `int`. Shifting by 31 or more is undefined, and even if it were defined, 2^35 does not fit. `1LL << n` with a `long long` loop variable is the fix — though 2^35 subsets is far too many to enumerate anyway." },
    { "text": "The loop is fine; the problem must be elsewhere, since `m` is compared against a positive value", "why": "The comparison is not the issue. `(1 << n)` is evaluated first, and for n >= 31 that expression is already undefined behaviour." },
    { "text": "`std::popcount` fails above 32 bits", "why": "`std::popcount` is defined for every unsigned integer type including 64-bit ones. The bug is in constructing the loop bound." },
    { "text": "Signed integers cannot hold bit patterns above bit 30", "why": "A 32-bit `int` holds bits 0 to 30 plus a sign bit, but the failure here is the shift itself being undefined, not the storage." }
  ]
}
:::

## Practice

:::exercise bitmask-audit

:::exercise submask-sums

:::exercise judge-set-cover

:::exercise judge-distinct-permutations

:::recap
- A subset is an integer; bit `i` means item `i` is in. That makes a subset an
  array index, which is what turns a search state into a DP state.
- It is not automatically faster. Measured over 2²⁰ subsets: recursion 114 ms,
  a mask loop that rescans the bits 280 ms, and a mask loop that reuses
  `m & (m - 1)` 47 ms. If your inner loop scans the bits, the previous mask
  probably already knew the answer.
- `<bit>` names the operations: `popcount`, `countr_zero`, `bit_width`,
  `has_single_bit`. They take unsigned types and compile to single
  instructions.
- `1 << i` is an `int`. Past 30 items it must be `1LL << i`.
- `for (s = m; ; s = (s - 1) & m)` walks every submask, and over all masks that
  is exactly 3ⁿ visits — measured, and 34 times faster than testing every pair
  at n = 12. Remember to include `s == 0`.
- `next_permutation` needs a sorted start and gives distinct permutations for
  free; `prev_permutation` on `1…1 0…0` enumerates combinations.
:::
