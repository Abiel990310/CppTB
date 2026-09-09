---
id: prefix-map-counts
title: "Counting subarrays with a frequency map"
difficulty: core
chapter: prefix-sums
topics: [prefix-sums, hashing, counting, algorithms]
check: unit
standard: c++20
---

Three questions about contiguous subarrays where the values **may be negative**,
so no sliding window applies. All three are the identity `sum(a[j .. i-1]) ==
P[i] - P[j]` plus a map from prefix value to something.

- `count_sum_k(a, k)` — how many contiguous subarrays sum to exactly `k`.
  Forgets that the empty prefix counts.
- `count_divisible(a, m)` — how many contiguous subarrays have a sum divisible
  by `m` (`m ≥ 1`). Uses `%` on a negative left operand and gets a negative key.
- `longest_sum_k(a, k)` — the length of the longest contiguous subarray summing
  to exactly `k`, or `0` if there is none. Remembers the most recent index at
  which each prefix value occurred instead of the earliest.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <unordered_map>
#include <vector>

long long count_sum_k(const std::vector<int>& a, long long k) {
    std::unordered_map<long long, long long> seen;
    // The empty prefix is missing, so subarrays starting at index 0 go uncounted.
    long long running = 0, total = 0;
    for (int x : a) {
        running += x;
        auto it = seen.find(running - k);
        if (it != seen.end()) total += it->second;
        ++seen[running];
    }
    return total;
}

long long count_divisible(const std::vector<int>& a, int m) {
    std::unordered_map<long long, long long> seen;
    seen[0] = 1;
    long long running = 0, total = 0;
    for (int x : a) {
        running += x;
        long long key = running % m;               // negative when running is
        auto it = seen.find(key);
        if (it != seen.end()) total += it->second;
        ++seen[key];
    }
    return total;
}

int longest_sum_k(const std::vector<int>& a, long long k) {
    std::unordered_map<long long, int> first;
    first[0] = -1;                                 // the empty prefix ends before index 0
    long long running = 0;
    int best = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        running += a[i];
        auto it = first.find(running - k);
        if (it != first.end())
            best = std::max(best, static_cast<int>(i) - it->second);
        first[running] = static_cast<int>(i);      // overwrites the earliest index
    }
    return best;
}
```

## Tests
```cpp
std::vector<int> a{3, 4, -7, 1, 3, 3, 1, -4};

// count_sum_k
CHECK_EQ(count_sum_k(a, 7), 4LL);
CHECK_EQ(count_sum_k(a, 0), 3LL);
CHECK_EQ(count_sum_k(a, 3), 4LL);
CHECK_EQ(count_sum_k(a, 1), 6LL);
CHECK_EQ(count_sum_k(a, 100), 0LL);
CHECK_EQ(count_sum_k({1, 2, 3}, 3), 2LL);          // [3] and [1,2]
CHECK_EQ(count_sum_k({-1, -1, 1, 1}, 0), 2LL);
CHECK_EQ(count_sum_k({5}, 5), 1LL);
CHECK_EQ(count_sum_k({}, 0), 0LL);

// count_divisible
CHECK_EQ(count_divisible(a, 3), 13LL);
CHECK_EQ(count_divisible(a, 2), 16LL);
CHECK_EQ(count_divisible(a, 5), 4LL);
CHECK_EQ(count_divisible({1, 2, 3}, 3), 3LL);
CHECK_EQ(count_divisible({-1, -1, 1, 1}, 2), 4LL);
CHECK_EQ(count_divisible({5}, 5), 1LL);
CHECK_EQ(count_divisible({}, 7), 0LL);

// longest_sum_k
CHECK_EQ(longest_sum_k(a, 0), 4);
CHECK_EQ(longest_sum_k(a, 7), 6);
CHECK_EQ(longest_sum_k(a, 3), 4);
CHECK_EQ(longest_sum_k(a, 100), 0);
CHECK_EQ(longest_sum_k({1, 2, 3}, 3), 2);
CHECK_EQ(longest_sum_k({-1, -1, 1, 1}, 0), 4);
CHECK_EQ(longest_sum_k({5}, 5), 1);
CHECK_EQ(longest_sum_k({}, 0), 0);
```

## Hints
- `count_sum_k`: seed the map with `seen[0] = 1` before the loop. A subarray that
  starts at index 0 needs to match the prefix "nothing summed yet", and that
  prefix has value 0.
- Order matters: look up `running - k` *before* inserting `running`, or a
  subarray of length 0 counts itself whenever `k == 0`.
- `count_divisible`: in C++, `-7 % 3` is `-1`, not `2`. Two prefixes give a
  divisible range when they are congruent mod `m`, and congruent values must map
  to the same key — so normalise with `((running % m) + m) % m`.
- `longest_sum_k`: `first[running] = i` on every step overwrites the earliest
  occurrence with the latest, which is exactly backwards for a *longest* range.
  Insert only if the key is new — `first.emplace(running, i)` does nothing when
  the key is already present.
- Keep `first[0] = -1`. The empty prefix ends just before index 0, and using
  `-1` makes `i - first[...]` come out as the correct length with no special case.
- Store `-1` as an `int` index and take the difference as `int`; the *count* in
  `count_sum_k` needs `long long`, because an array of 2 × 10⁵ zeros has about
  2 × 10¹⁰ zero-sum subarrays.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <unordered_map>
#include <vector>

long long count_sum_k(const std::vector<int>& a, long long k) {
    std::unordered_map<long long, long long> seen;
    seen[0] = 1;                                   // the empty prefix
    long long running = 0, total = 0;
    for (int x : a) {
        running += x;
        auto it = seen.find(running - k);
        if (it != seen.end()) total += it->second;
        ++seen[running];
    }
    return total;
}

long long count_divisible(const std::vector<int>& a, int m) {
    std::unordered_map<long long, long long> seen;
    seen[0] = 1;
    long long running = 0, total = 0;
    for (int x : a) {
        running += x;
        long long key = ((running % m) + m) % m;   // a non-negative residue
        auto it = seen.find(key);
        if (it != seen.end()) total += it->second;
        ++seen[key];
    }
    return total;
}

int longest_sum_k(const std::vector<int>& a, long long k) {
    std::unordered_map<long long, int> first;
    first[0] = -1;
    long long running = 0;
    int best = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        running += a[i];
        auto it = first.find(running - k);
        if (it != first.end())
            best = std::max(best, static_cast<int>(i) - it->second);
        first.emplace(running, static_cast<int>(i));   // keep the earliest only
    }
    return best;
}
```

## Notes
One identity, three bugs, and each bug is a different way of mishandling the
*keys* rather than the sums.

**The empty prefix.** `seen[0] = 1` is not a special case bolted on; it is the
statement that `P[0] = 0` exists, the same leading zero as in the array version.
Drop it and every subarray beginning at index 0 becomes invisible —
`count_sum_k({5}, 5)` returns 0 in the starter, which is as small a
counterexample as the bug admits.

**Negative operands to `%`.** C++ rounds integer division toward zero, so
`-7 % 3 == -1`. `-7` and `2` are congruent mod 3 and must share a key, but they
produce `-1` and `2`. The double modulus `((x % m) + m) % m` is the standard
normalisation and costs one extra instruction; the alternative, `x % m + (x < 0
? m : 0)`, is the same thing with a branch. Note that this is not a C++ wart to
route around so much as a difference between two definitions of `%` — the
mathematician's, which is always non-negative, and the machine's, which agrees
with truncating division. The number-theory chapter (10.36) needs the same normalisation everywhere.

**Earliest versus latest.** For the *longest* range you want the earliest
occurrence of each prefix value; for the shortest you want the most recent. The
starter's `first[running] = i` is the assignment for the shortest, in a function
that asks for the longest, and the two differ only in `emplace` versus
`operator[]`. `emplace` inserts only when the key is absent, which is exactly
"remember the first" — it is worth knowing that `insert`, `emplace`, and
`try_emplace` all leave an existing value alone, and only `operator[]` and
`insert_or_assign` overwrite.

**Why the count is `long long`.** An array of `n` zeros has `n(n+1)/2` zero-sum
subarrays. At `n = 2 × 10⁵` that is just over 2 × 10¹⁰, which is comfortably
past what an `int` holds — and it is an easy input for a setter to include. The
*length* returned by `longest_sum_k` is at most `n` and stays an `int`.
