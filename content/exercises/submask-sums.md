---
id: submask-sums
title: "Subset sums, reused"
difficulty: core
chapter: bitmask-enumeration
topics: [bitmask, subset-sums, algorithms]
check: unit
standard: c++20
---

Two functions built on the observation that the answer for a mask `m` is one
step from the answer for `m & (m - 1)` — the same mask with its lowest set bit
removed.

- `subset_sums(a)` — a table where entry `m` is the sum of the elements chosen
  by mask `m`. Reuses the right previous entry and adds the wrong element.
- `can_split_evenly(a)` — whether `a` can be split into two parts with equal
  sums. Divides the total by two without checking that the total is even.

Assume `a.size() ≤ 20`, so `2ⁿ` entries is affordable.

## Starter
```cpp
#include <bit>
#include <cstddef>
#include <vector>

std::vector<long long> subset_sums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums(std::size_t{1} << n, 0);
    for (unsigned m = 1; m < (1u << n); ++m) {
        unsigned rest = m & (m - 1);                // m without its lowest set bit
        sums[m] = sums[rest] + a[rest];             // ... but `rest` is not an index
    }
    return sums;
}

bool can_split_evenly(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums = subset_sums(a);

    long long total = sums[(std::size_t{1} << n) - 1];
    long long half = total / 2;                     // rounds down, silently
    for (unsigned m = 0; m < (1u << n); ++m)
        if (sums[m] == half) return true;
    return false;
}
```

## Tests
```cpp
// subset_sums
CHECK_EQ(subset_sums({}), (std::vector<long long>{0}));
CHECK_EQ(subset_sums({7}), (std::vector<long long>{0, 7}));
CHECK_EQ(subset_sums({1, 2}), (std::vector<long long>{0, 1, 2, 3}));
CHECK_EQ(subset_sums({1, 2, 3}),
         (std::vector<long long>{0, 1, 2, 3, 3, 4, 5, 6}));
CHECK_EQ(subset_sums({5, 5}), (std::vector<long long>{0, 5, 5, 10}));
CHECK_EQ(subset_sums({-1, 4}), (std::vector<long long>{0, -1, 4, 3}));

// can_split_evenly
CHECK(can_split_evenly({1, 2, 3}));                  // {3} and {1,2}
CHECK(can_split_evenly({1, 5, 11, 5}));
CHECK(can_split_evenly({3, 3}));
CHECK(can_split_evenly({2, 2, 3, 3}));
CHECK(can_split_evenly({1, 1}));
CHECK(can_split_evenly({}));                         // two empty halves
CHECK(!can_split_evenly({7}));                       // an odd total
CHECK(!can_split_evenly({1, 2, 4}));                 // total 7, and {1,2} sums to 3
CHECK(!can_split_evenly({1, 1, 1, 1, 1}));           // total 5, and {1,1} sums to 2
CHECK(!can_split_evenly({10, 20, 15, 5, 25}));
```

## Hints
- `m & (m - 1)` is the right mask to reuse, but the element to add is the one that was *removed* — the lowest set bit of `m`. Its index is `std::countr_zero(m)`, not `m & (m - 1)`.
- `subset_sums({1, 2, 3})[4]` is mask `100`, so the answer is `a[2] == 3`. Check that one by hand and the index bug is obvious.
- Watch the type of the table's size: `std::size_t{1} << n` avoids the `int` shift, which matters if `n` ever reaches 31.
- An equal split requires the total to be **even**. `total / 2` on an odd total rounds down, and a subset matching that rounded value is not half of anything.
- `{1, 2, 4}` has total 7 and a subset summing to 3, so the starter says yes where the answer is no. Test `total % 2 != 0` first and return `false`.
- `can_split_evenly({})` is `true`: the total is 0, which is even, and the empty mask sums to 0.
- If you want the complementary mask for any reason, it is `m ^ ((1u << n) - 1)` — never `~m`, which flips every bit the type has and is out of range as a subscript.

## Solution
```cpp
#include <bit>
#include <cstddef>
#include <vector>

std::vector<long long> subset_sums(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums(std::size_t{1} << n, 0);
    for (unsigned m = 1; m < (1u << n); ++m) {
        int low = std::countr_zero(m);              // index of the removed element
        unsigned rest = m & (m - 1);                // m without it
        sums[m] = sums[rest] + a[low];
    }
    return sums;
}

bool can_split_evenly(const std::vector<int>& a) {
    int n = static_cast<int>(a.size());
    std::vector<long long> sums = subset_sums(a);

    long long total = sums[(std::size_t{1} << n) - 1];
    if (total % 2 != 0) return false;               // no even split of an odd total
    long long half = total / 2;
    for (unsigned m = 0; m < (1u << n); ++m)
        if (sums[m] == half) return true;
    return false;
}
```

## Notes
**The reuse is the whole technique, so the index has to be exact.** Every mask
`m` differs from `m & (m - 1)` by one element, and that element's *index* is
`countr_zero(m)`. The starter uses `rest` — a mask — as an index into `a`, which
is a type confusion the compiler cannot catch because both are integers.

`subset_sums({1, 2, 3})` is the test that says so. Entry 4 is mask `100`, the
subset `{a[2]}`, so it should be 3; the starter computes `sums[0] + a[0]`, which
is 1. The habit that prevents this: **name the two things differently and never
let a mask reach a subscript of the item array.** `low` is an index; `rest` is a
mask; only `low` may index `a`.

This construction is worth recognising in its own right. It fills the whole
table in O(2ⁿ) — one addition per mask — where the obvious loop over the bits of
each mask costs O(2ⁿ · n). This chapter's opening sample measures that: 47 ms
against 280 ms at `n = 20`.

**Integer division hides a precondition.** `total / 2` is always *a* number, and
it is half of the total only when the total is even. On `{1, 2, 4}` the total is
7, `half` becomes 3, and `{1, 2}` sums to 3 — so the starter finds a "half" that
is not one, and answers yes to a question whose answer is no.

The fix is one line, `if (total % 2 != 0) return false;`, and the general lesson
is that **integer division is a place where a precondition can be silently
dropped.** Every `/ 2` on a quantity that is supposed to split evenly deserves
the parity check next to it; the same goes for `(lo + hi) / 2` in a binary
search, where rounding down is deliberate and must be, for the loop to
terminate.

Note also that the empty case is `true`: the total is 0, which is even, and both
halves are empty. Answering the degenerate case correctly is usually a matter of
letting the general code run rather than special-casing it — here `sums[0] == 0`
matches `half == 0` on the first iteration.

**Why the complement is `m ^ full` and never `~m`.** `~` flips every bit the type
has, so for `n = 3` and `m = 0b101` it gives `0xFFFFFFFA`, not `0b010`. Used as a
subscript into a table of size 8 that is out of bounds — undefined behaviour, not
a wrong answer. `m ^ ((1u << n) - 1)` is one operation, says what it means, and
cannot be half-forgotten.
