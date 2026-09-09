---
title: "Hashing, frequency maps, and multisets"
navTitle: "Hashing and counting"
summary: >-
  Four ways to count things, the one that is fifty times faster, and the
  hash-map attack that turns a linear solution into a quadratic one.
objectives:
  - Choose between an array, a hash map, an ordered map, and sorting
  - Explain why std::unordered_map can degrade to O(n) per operation
  - Write a custom hash that resists an anti-hash test
  - Use a custom hash or a packed key for pair and tuple keys
  - Know what std::multiset's two erase overloads do
status: complete
standard: c++20
requires: [deques-and-window-extrema]
---

Counting occurrences is the most common operation in a contest set, and there
are four reasonable ways to do it. The fastest and the slowest differ by a
factor of more than fifty, and one of them can be attacked by the person who
wrote the test data.

## Four ways to count

```cpp run title="Array, hash map, ordered map, sort"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <map>
#include <unordered_map>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    const int n = 200'000, range = 1'000;
    std::vector<int> a(n);
    for (int i = 0; i < n; ++i) a[i] = static_cast<int>(i * 7919LL % range);

    auto stamp = [] { return std::chrono::steady_clock::now(); };
    auto ms = [](auto t0, auto t1) {
        return std::chrono::duration<double, std::milli>(t1 - t0).count();
    };

    // 1. Direct indexing: the alphabet is known and small.
    auto t0 = stamp();
    std::vector<int> counts(range, 0);
    for (int x : a) ++counts[x];
    int best_array = static_cast<int>(
        std::max_element(counts.begin(), counts.end()) - counts.begin());
    auto t1 = stamp();

    // 2. Hash map.
    std::unordered_map<int, int> hashed;
    hashed.reserve(range * 2);
    for (int x : a) ++hashed[x];
    int best_hash = 0;
    for (auto [value, count] : hashed)
        if (count > hashed[best_hash]) best_hash = value;
    auto t2 = stamp();

    // 3. Ordered map.
    std::map<int, int> ordered;
    for (int x : a) ++ordered[x];
    int best_ordered = 0;
    for (auto [value, count] : ordered)
        if (count > ordered[best_ordered]) best_ordered = value;
    auto t3 = stamp();

    // 4. Sort, then count runs.
    std::vector<int> sorted = a;
    std::sort(sorted.begin(), sorted.end());
    int best_sorted = sorted[0], run = 1, longest = 1;
    for (std::size_t i = 1; i < sorted.size(); ++i) {
        run = (sorted[i] == sorted[i - 1]) ? run + 1 : 1;
        if (run > longest) { longest = run; best_sorted = sorted[i]; }
    }
    auto t4 = stamp();

    keep(counts); keep(hashed); keep(ordered); keep(sorted);
    std::printf("array index  %8.1f ms\n", ms(t0, t1));
    std::printf("unordered_map%8.1f ms\n", ms(t1, t2));
    std::printf("map          %8.1f ms\n", ms(t2, t3));
    std::printf("sort + scan  %8.1f ms\n", ms(t3, t4));
    std::printf("same answer: %s\n",
                (best_array == best_hash && best_hash == best_ordered &&
                 best_ordered == best_sorted) ? "yes" : "no");
}
```

About 6 ms, 46 ms, 170 ms and 320 ms on this machine, for the same answer.

That ordering is stable and worth internalising, because the reasons are
structural rather than incidental:

| Approach | Cost | Use it when |
|---|---|---|
| `std::vector` indexed by the value | O(n), one contiguous pass | the values are bounded and the bound is affordable |
| `std::unordered_map` | O(n) expected, a hash and a pointer chase per element | the keys are unbounded or sparse |
| `std::map` | O(n log n), a node and a tree walk per element | you need the keys in order |
| sort, then scan runs | O(n log n), but no allocation per element | you already sorted, or you need order and nothing else |

**Prefer the array.** Values up to 10⁶ cost 4 MB, which every judge allows, and
nothing else comes close. If the values are large but few, coordinate
compression (chapter 10.4) turns them into an array's indices in one sort — and
`sort + unique + lower_bound` is usually faster than the hash map it replaces.

The `map` row is not a criticism of `std::map`; ordering is a real service and
the log factor buys it. Reaching for `std::map` when you never iterate in order
is the mistake.

## The attack

`std::unordered_map` promises O(1) *expected*. On libstdc++ — which is what
Codeforces and most judges run — the hash for integers is the identity function,
and the bucket index is `key % bucket_count`. Both facts are public, so anyone
can construct keys that all land in the same bucket, and then every insertion
walks a linked list that is `i` long.

```cpp run title="4,000 keys, chosen badly"
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <unordered_map>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// splitmix64: a cheap avalanche step. The random salt means an adversary
// cannot pick keys that collide, because the mapping differs every run.
struct scrambled_hash {
    static std::uint64_t splitmix64(std::uint64_t x) {
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    std::size_t operator()(std::uint64_t key) const {
        static const std::uint64_t salt =
            std::chrono::steady_clock::now().time_since_epoch().count();
        return static_cast<std::size_t>(splitmix64(key + salt));
    }
};

int main() {
    const int n = 4'000;

    std::unordered_map<std::uint64_t, int> probe;
    probe.reserve(n);
    const std::uint64_t buckets = probe.bucket_count();
    std::printf("bucket count after reserve(%d): %llu\n",
                n, static_cast<unsigned long long>(buckets));

    std::vector<std::uint64_t> friendly(n), hostile(n);
    for (int i = 0; i < n; ++i) {
        friendly[i] = static_cast<std::uint64_t>(i);
        hostile[i] = static_cast<std::uint64_t>(i + 1) * buckets;   // all in bucket 0
    }

    auto run = [&](auto& map, const std::vector<std::uint64_t>& keys) {
        map.reserve(n);
        auto start = std::chrono::steady_clock::now();
        for (std::uint64_t k : keys) ++map[k];
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        keep(map);
        return ms;
    };

    std::unordered_map<std::uint64_t, int> m1, m2;
    std::unordered_map<std::uint64_t, int, scrambled_hash> m3;

    double ok_ms = run(m1, friendly);
    double bad_ms = run(m2, hostile);
    double fixed_ms = run(m3, hostile);

    std::printf("default hash, consecutive keys %8.1f ms\n", ok_ms);
    std::printf("default hash, colliding keys   %8.1f ms\n", bad_ms);
    std::printf("scrambled hash, same keys      %8.1f ms\n", fixed_ms);
}
```

5.5 ms, 1228 ms, 3.6 ms. Four thousand keys — a fiftieth of a contest's `n` —
and the middle case is already two hundred times slower. At `n = 2 × 10⁵` the
same construction takes minutes.

This is not hypothetical. "Hacking" a submission by feeding it anti-hash data is
a standard part of Codeforces rounds, and `unordered_map<int, int>` with the
default hash is the single most hacked line in competitive C++.

Three defences, in order of preference:

1. **Do not use a hash map.** An array, or coordinate compression plus an array,
   cannot be attacked.
2. **Salt the hash**, as above. The salt must vary per run — a clock reading or
   `std::random_device` — because a fixed constant is just as public as the
   identity function. Note that `splitmix64` is doing the real work: it
   *avalanches*, so keys differing in one bit land in unrelated buckets.
3. **Use `std::map`.** A log factor is cheap insurance, and no data can make it
   worse than O(n log n).

What does *not* work: adding a constant to the keys, multiplying by a fixed odd
number, or calling `reserve` with a prime. All of those are deterministic
functions an attacker can invert.

## Keys that are not integers

`std::hash` has specialisations for the built-in types and `std::string`, and
notably **not** for `std::pair` or `std::tuple`. Trying to use one as a key is a
compile error, and there are two good answers.

```cpp run title="A pair as a key, twice"
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <unordered_map>
#include <utility>
#include <vector>

// std::hash has no specialisation for std::pair, so a key of pair type needs
// one supplied. Combining the halves into a single 64-bit value first, then
// scrambling, is both simpler and better than mixing two hashes by hand.
struct pair_hash {
    static std::uint64_t splitmix64(std::uint64_t x) {
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    std::size_t operator()(const std::pair<int, int>& p) const {
        static const std::uint64_t salt =
            std::chrono::steady_clock::now().time_since_epoch().count();
        std::uint64_t packed = (static_cast<std::uint64_t>(
                                    static_cast<std::uint32_t>(p.first)) << 32) ^
                               static_cast<std::uint32_t>(p.second);
        return static_cast<std::size_t>(splitmix64(packed + salt));
    }
};

int main() {
    std::vector<std::pair<int, int>> edges = {
        {1, 2}, {2, 3}, {1, 2}, {3, 1}, {2, 3}, {1, 2}, {-4, 7}
    };

    std::unordered_map<std::pair<int, int>, int, pair_hash> seen;
    for (const auto& e : edges) ++seen[e];

    std::printf("distinct pairs: %zu\n", seen.size());
    std::printf("(1,2) appears %d times\n", seen[{1, 2}]);
    std::printf("(2,3) appears %d times\n", seen[{2, 3}]);
    std::printf("(-4,7) appears %d times\n", seen[{-4, 7}]);
    std::printf("(9,9) appears %d times\n", seen.count({9, 9}) ? seen[{9, 9}] : 0);

    // The same thing without a custom hash: pack the pair into one integer and
    // let the library hash that. Only works when the ranges are known.
    std::unordered_map<std::uint64_t, int> packed;
    for (const auto& e : edges) {
        std::uint64_t key = (static_cast<std::uint64_t>(
                                 static_cast<std::uint32_t>(e.first)) << 32) ^
                            static_cast<std::uint32_t>(e.second);
        ++packed[key];
    }
    std::printf("packed into one integer: %zu distinct\n", packed.size());
}
```

Four distinct pairs, `(1,2)` three times, and the packed version agrees.

**Packing is usually the better answer** in a contest: it is three lines, it
needs no struct, and it makes the key an integer that you can then feed to
whatever defence you were going to use anyway. The cast through `std::uint32_t`
is what makes it work for negative values — it reinterprets the bits rather than
sign-extending, so `-4` and `4` stay distinct and no bits of the top half are
clobbered.

The pattern generalises: two values under 10⁹ pack into `first * 2'000'000'007LL
+ second`, three small values into a base-`B` number. Whenever packing is
possible, it is preferable to writing a hash.

The classic wrong answer is `h1 ^ h2` or `h1 * 31 + h2` where `h1` and `h2` are
`std::hash<int>` of the halves — that is, of the values themselves. Then
`(a, b)` and `(b, a)` collide under XOR, and every pair on a diagonal collides
under the multiply. Scramble *after* combining, never before.

Note also that `seen.count({9, 9})` is used before `seen[{9, 9}]`: `operator[]`
on a missing key **inserts** it, which silently grows the map and, in a loop
over queries, can double its size. Use `find` or `count` when you only mean to
look.

## `std::multiset`, and its two erases

When you need counts *and* order — a running median, a window's k-th largest, a
"take the smallest remaining" loop — the ordered multiset is the tool. It has
one trap, and it is a good one.

```cpp run title="erase(value) is not erase(one value)"
#include <cstdio>
#include <set>

void show(const char* label, const std::multiset<int>& s) {
    std::printf("%-28s size %zu :", label, s.size());
    for (int v : s) std::printf(" %d", v);
    std::printf("\n");
}

int main() {
    std::multiset<int> s{5, 3, 5, 1, 5, 3};
    show("start", s);

    std::multiset<int> a = s;
    std::printf("count(5) = %zu\n", a.count(5));

    a.erase(5);                        // removes EVERY 5
    show("after erase(5)", a);

    std::multiset<int> b = s;
    b.erase(b.find(5));                // removes ONE 5
    show("after erase(find(5))", b);

    std::multiset<int> c = s;
    auto it = c.find(99);              // not present
    std::printf("find(99) == end(): %s\n", it == c.end() ? "yes" : "no");
    std::printf("erase(99) removed %zu elements\n", c.erase(99));

    // The extremes are cheap; the k-th element is not.
    std::printf("min %d  max %d\n", *b.begin(), *b.rbegin());
}
```

`erase(5)` takes the size from 6 to 3; `erase(find(5))` takes it to 5.

In a sliding window you almost always want `erase(find(x))` — one occurrence,
the one leaving the window. Writing `erase(x)` there removes every copy and the
window quietly loses elements it still contains. The bug does not show on data
without duplicates, which is most of your own test data and none of the judge's.

Three more facts worth having:

- **`erase(iterator)` is O(1) amortised; `erase(value)` is O(log n + count).**
  Another reason to prefer the iterator form.
- **`*rbegin()` is the maximum, `*begin()` the minimum**, both O(1). There is no
  `back()`.
- **There is no random access.** `std::next(s.begin(), k)` is O(k), so a
  multiset is the wrong structure for "the k-th smallest" at contest sizes. That
  wants an order-statistic tree — a Fenwick tree over compressed values
  (chapter 10.31) is the usual substitute.

`std::unordered_multiset` exists and is almost never what you want: it gives up
the ordering, which was the only reason to prefer a multiset over a hash map
holding counts.

## Choosing

| The problem needs | Reach for |
|---|---|
| counts of values in a known, small range | `std::vector<int>` indexed by the value |
| counts of sparse or huge values | compress (10.4) into an array, else a hash map with a salted hash |
| counts, plus iteration in key order | `std::map` |
| a key that is a pair or a tuple | pack into one integer, else a custom hash |
| the smallest or largest remaining, with duplicates | `std::multiset`, erased through `find` |
| the k-th smallest, repeatedly | Fenwick over compressed values (10.31) |
| membership only, small range | `std::vector<bool>` or a bitset |

:::quiz
{
  "question": "Your solution uses `std::unordered_map<int, int>` for frequencies and passes every test locally, but gets \"time limit exceeded\" on one specific judge test with n = 2·10^5. What is the most likely cause, and the cheapest fix?",
  "options": [
    { "text": "The test contains keys constructed to collide in libstdc++'s buckets; salt the hash with a per-run random value, or replace the map with an array over compressed values", "correct": true, "why": "libstdc++ hashes integers with the identity function and takes the key modulo the bucket count, both public. Adversarial keys make every operation walk one long chain — measured here as 1228 ms against 5.5 ms for only 4,000 keys." },
    { "text": "The map is rehashing repeatedly; call reserve() with the expected size", "why": "Reserving helps a little and is good practice, but it does not defend against collisions — and reserving a known size makes the bucket count *easier* to predict, not harder." },
    { "text": "unordered_map is O(n log n), so it cannot handle 2·10^5 elements", "why": "It is O(1) expected per operation. The failure mode is the worst case, not the average, and the worst case has to be constructed deliberately." },
    { "text": "The judge's machine is slower; there is nothing to do but optimise constants elsewhere", "why": "A factor of two hundred is not a machine difference. When one test fails and the rest pass comfortably, the test is doing something specific." }
  ]
}
:::

## Practice

:::exercise counting-audit

:::exercise hash-defence

:::exercise judge-frequency-queries

:::exercise judge-distinct-window

:::recap
- Four ways to count, measured on 200,000 values in a range of 1,000: array
  6 ms, `unordered_map` 46 ms, `map` 170 ms, sort-and-scan 320 ms. Prefer the
  array; compress the values (10.4) if they are too large to index directly.
- `std::unordered_map` is O(1) *expected*, and libstdc++'s integer hash is the
  identity. Keys chosen to share a bucket turned 5.5 ms into 1228 ms with only
  4,000 of them.
- The defence is a salted avalanche hash — `splitmix64` plus a per-run random
  value — or not using a hash map at all. A fixed constant is no defence.
- `std::pair` has no `std::hash`. Pack the halves into one integer through
  `std::uint32_t` casts, or write a hash that scrambles *after* combining.
- `operator[]` inserts on a missing key. Use `find` or `count` to look without
  writing.
- `ms.erase(x)` removes every copy; `ms.erase(ms.find(x))` removes one. In a
  sliding window it is always the second, and the difference is invisible on
  data without duplicates.
:::
