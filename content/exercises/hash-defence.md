---
id: hash-defence
title: "Packing keys, and counting pairs"
difficulty: core
chapter: hashing-and-frequency
topics: [hashing, frequency-maps, bit-manipulation, algorithms]
check: unit
standard: c++20
---

Two independent problems, both about what a hash map's *key* really is.

- `pack(x, y)` and `unpack(key)` — an injective encoding of a pair of `int`s
  into one `std::uint64_t`, and its inverse. The conversion sign-extends, so
  every pair with a negative second component collides with something.
- `count_pairs_summing_to(a, target)` — the number of index pairs `i < j` with
  `a[i] + a[j] == target`, counted in one pass with a frequency map. Inserts the
  current element before looking it up, so an element pairs with itself.

`count_distinct_pairs(ps)` is written for you in terms of `pack`, and is correct
as soon as `pack` is.

## Starter
```cpp
#include <cstddef>
#include <cstdint>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

std::uint64_t pack(int x, int y) {
    // A negative y sign-extends to 64 bits and wipes out the top half.
    return (static_cast<std::uint64_t>(x) << 32) | static_cast<std::uint64_t>(y);
}

std::pair<int, int> unpack(std::uint64_t key) {
    return { static_cast<int>(key >> 32),
             static_cast<int>(key & 0xffffffffULL) };
}

std::size_t count_distinct_pairs(const std::vector<std::pair<int, int>>& ps) {
    std::unordered_set<std::uint64_t> seen;
    for (const auto& p : ps) seen.insert(pack(p.first, p.second));
    return seen.size();
}

long long count_pairs_summing_to(const std::vector<int>& a, long long target) {
    std::unordered_map<long long, long long> seen;
    long long total = 0;
    for (int x : a) {
        ++seen[x];                                  // inserted before the lookup
        auto it = seen.find(target - x);
        if (it != seen.end()) total += it->second;
    }
    return total;
}
```

## Tests
```cpp
// pack / unpack round-trip
CHECK_EQ(unpack(pack(0, 0)), (std::pair<int, int>{0, 0}));
CHECK_EQ(unpack(pack(1, 2)), (std::pair<int, int>{1, 2}));
CHECK_EQ(unpack(pack(-1, -1)), (std::pair<int, int>{-1, -1}));
CHECK_EQ(unpack(pack(5, -1)), (std::pair<int, int>{5, -1}));
CHECK_EQ(unpack(pack(-4, 7)), (std::pair<int, int>{-4, 7}));
CHECK_EQ(unpack(pack(2147483647, -2147483648)),
         (std::pair<int, int>{2147483647, -2147483648}));

// pack must be injective
CHECK(pack(5, -1) != pack(0, -1));
CHECK(pack(1, 2) != pack(2, 1));
CHECK(pack(0, -1) != pack(-1, 0));
CHECK(pack(7, 0) != pack(0, 7));

// count_distinct_pairs
CHECK_EQ(count_distinct_pairs({{1, 2}, {2, 3}, {1, 2}, {3, 1}, {2, 3}}), 3UL);
CHECK_EQ(count_distinct_pairs({{5, -1}, {0, -1}, {5, -1}}), 2UL);
CHECK_EQ(count_distinct_pairs({{-4, 7}, {7, -4}}), 2UL);
CHECK_EQ(count_distinct_pairs({}), 0UL);

// count_pairs_summing_to
CHECK_EQ(count_pairs_summing_to({1, 2, 3, 4, 3}, 6), 2LL);
CHECK_EQ(count_pairs_summing_to({1, 2, 3, 4, 3}, 5), 3LL);
CHECK_EQ(count_pairs_summing_to({3, 3, 3}, 6), 3LL);
CHECK_EQ(count_pairs_summing_to({1, 1, 1, 1}, 2), 6LL);
CHECK_EQ(count_pairs_summing_to({2, 2, 2, 2}, 4), 6LL);
CHECK_EQ(count_pairs_summing_to({0, 0}, 0), 1LL);
CHECK_EQ(count_pairs_summing_to({-1, 1, 2, -2}, 0), 2LL);
CHECK_EQ(count_pairs_summing_to({5}, 10), 0LL);
CHECK_EQ(count_pairs_summing_to({}, 0), 0LL);
```

## Hints
- `static_cast<std::uint64_t>(y)` on a negative `y` first sign-extends to 64 bits: `-1` becomes `0xFFFFFFFFFFFFFFFF`, and OR-ing that leaves nothing of `x`.
- Convert through the 32-bit unsigned type first: `static_cast<std::uint32_t>(y)` reinterprets the bits without widening, so `-1` becomes `0x00000000FFFFFFFF`.
- Do the same on the way in for `x`, then shift: `static_cast<std::uint64_t>(static_cast<std::uint32_t>(x)) << 32`.
- `unpack` is already correct once `pack` is — `static_cast<int>` of an out-of-range unsigned value is well defined and wraps, since C++20.
- `count_pairs_summing_to` counts each pair once by looking up the *earlier* elements only. So: look up `target - x` first, add what you find, and only then record `x`.
- Doing it the other way round makes `x` pair with itself whenever `2 * x == target` — `{3, 3, 3}` with target 6 gives 6 instead of 3.
- The count can exceed 2 × 10⁹ (200,000 equal values and a matching target), which is why it returns `long long`.

## Solution
```cpp
#include <cstddef>
#include <cstdint>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

std::uint64_t pack(int x, int y) {
    // Reinterpret each half as 32 unsigned bits before widening.
    return (static_cast<std::uint64_t>(static_cast<std::uint32_t>(x)) << 32) |
            static_cast<std::uint64_t>(static_cast<std::uint32_t>(y));
}

std::pair<int, int> unpack(std::uint64_t key) {
    return { static_cast<int>(static_cast<std::uint32_t>(key >> 32)),
             static_cast<int>(static_cast<std::uint32_t>(key)) };
}

std::size_t count_distinct_pairs(const std::vector<std::pair<int, int>>& ps) {
    std::unordered_set<std::uint64_t> seen;
    for (const auto& p : ps) seen.insert(pack(p.first, p.second));
    return seen.size();
}

long long count_pairs_summing_to(const std::vector<int>& a, long long target) {
    std::unordered_map<long long, long long> seen;
    long long total = 0;
    for (int x : a) {
        auto it = seen.find(target - x);            // earlier elements only
        if (it != seen.end()) total += it->second;
        ++seen[x];                                  // then record this one
    }
    return total;
}
```

## Notes
**Sign extension is a conversion, not a reinterpretation.** `static_cast` from
`int` to `std::uint64_t` preserves the *value* modulo 2⁶⁴, so `-1` becomes
2⁶⁴ − 1 — sixty-four one bits. OR that into a packed key and the other half is
gone. Going through `std::uint32_t` first preserves the value modulo 2³², which
is the 32 bits you actually meant.

The rule to remember: **narrow first, then widen.** `uint64_t(uint32_t(y))` is
the idiom, and it is worth writing out rather than hoping the compiler infers
your intent, because it will not: both conversions are well defined and mean
different things.

`pack(5, -1) == pack(0, -1)` in the starter — both are all ones — so a set of
pairs silently merges entries that differ. That is a *correctness* bug, not a
performance one, which is the distinction worth drawing here: a bad hash costs
time, a bad key encoding costs answers. A hash may collide freely, because the
container compares keys for equality afterwards. A packing may not collide at
all, because the packed value *is* the key.

**Look up before you insert.** The one-pass pair-counting idiom works because
when `x` is processed, `seen` holds exactly the elements before it, so every pair
is counted once, at its later element. Inserting first breaks that: `x` is now in
`seen`, and if `2 * x == target` it counts itself. On `{3, 3, 3}` with target 6
the starter returns 6 where the answer is 3 — each 3 pairs with itself and with
its predecessors.

This is the same "seed the map correctly" discipline as chapter 10.7's
`seen[0] = 1`, seen from the other side: there a needed entry was missing, here
an unwanted one is present. Both come from being precise about *which* elements
the map is supposed to represent at the moment of the lookup. Write that down in
a comment and the order stops being guesswork.

**The `long long` count.** 200,000 copies of the same value and a matching
target give about 2 × 10¹⁰ pairs. Values fit in an `int`; counts of pairs
rarely do.
