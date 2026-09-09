---
id: judge-distinct-window
title: "Distinct values in every window"
difficulty: core
chapter: hashing-and-frequency
topics: [hashing, frequency-maps, sliding-window, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the number of distinct values in every contiguous window of length `k`.

**Input.** The first line contains `n` and `k`. The second line contains `n`
integers.

**Output.** One line of `n - k + 1` integers separated by single spaces.

**Constraints.** `1 ≤ k ≤ n ≤ 200000`, `1 ≤ aᵢ ≤ 10⁹`.

## Starter
```cpp
#include <iostream>
#include <unordered_map>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, k;
    std::cin >> n >> k;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::unordered_map<int, int> counts;
    bool first = true;

    for (int i = 0; i < n; ++i) {
        ++counts[a[i]];
        if (i >= k) --counts[a[i - k]];        // the entry stays behind at zero
        if (i + 1 >= k) {
            if (!first) std::cout << ' ';
            std::cout << counts.size();
            first = false;
        }
    }
    std::cout << '\n';
}
```

## Cases

### Sample
```in
6 3
3 1 3 2 1 3
```
```out
2 3 3 3
```

### a value leaves the window
```in
4 2
1 1 2 2
```
```out
1 2 1
```

### alternating
```in
5 3
1 2 1 2 1
```
```out
2 2 2
```

### all the same
```in
3 2
4 4 4
```
```out
1 1
```

### a mixed array
```in
8 4
9 1 2 3 8 2 1 5
```
```out
4 4 3 4 4
```

### one window
```in
4 4
1 2 3 4
```
```out
4
```

### a single element
```in
1 1
5
```
```out
1
```

## Hints
- Maintain a count per value, add the incoming element, subtract the outgoing one, and report how many values have a non-zero count.
- `counts.size()` counts *entries*, not non-zero entries. An entry left behind with a count of 0 keeps being counted.
- So erase on zero: `auto it = counts.find(a[i - k]); if (--it->second == 0) counts.erase(it);`
- Taking the iterator once and reusing it does one hash lookup instead of three — worth it at `n = 2 × 10⁵`.
- The alternative is a separate `distinct` counter: increment it when a count rises from 0 to 1, decrement when it falls from 1 to 0. That avoids the erase and is slightly faster.
- The values reach 10⁹, so no array indexed by value is possible. Compressing the values first (chapter 10.4) turns this into an array and removes any hashing risk.

## Solution
```cpp
#include <iostream>
#include <unordered_map>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, k;
    std::cin >> n >> k;
    std::vector<int> a(n);
    for (int& x : a) std::cin >> x;

    std::unordered_map<int, int> counts;
    bool first = true;

    for (int i = 0; i < n; ++i) {
        ++counts[a[i]];
        if (i >= k) {
            auto it = counts.find(a[i - k]);
            if (--it->second == 0) counts.erase(it);   // zero is not "present"
        }
        if (i + 1 >= k) {
            if (!first) std::cout << ' ';
            std::cout << counts.size();
            first = false;
        }
    }
    std::cout << '\n';
}
```

## Notes
`size()` answers "how many keys does this map have", and the question is "how
many values are in the window". Those agree only if you never leave a key behind
with a count of zero.

The second case is the smallest demonstration: `1 1 2 2` with `k = 2` has
windows `{1,1}`, `{1,2}`, `{2,2}` — one, two, one distinct value. The starter
prints `1 2 2`, because after the second 1 leaves, its entry is still in the map
holding a 0.

Two ways to fix it, and they are worth knowing as a pair:

```cpp
// A. erase on zero: size() stays meaningful
auto it = counts.find(x);
if (--it->second == 0) counts.erase(it);

// B. keep a separate counter: no erase at all
if (--counts[x] == 0) --distinct;
if (++counts[y] == 1) ++distinct;
```

B is faster — no rehashing, no node deallocation — and it generalises to
questions `size()` cannot answer, like "how many values occur exactly twice".
A keeps the container honest, which matters when something else also reads it.
Either is fine here; guessing that `size()` will look after itself is not.

**One lookup, not three.** `--counts[x]` followed by `counts.erase(x)` hashes
`x` twice, and if you also wrote `if (counts[x] == 0)` that is three times. Take
the iterator once. At `n = 2 × 10⁵` this is the difference between comfortable
and merely acceptable, and it costs nothing to write.

**The container choice.** Values up to 10⁹ rule out a direct array, but they do
not rule out an array: sort the distinct values, `unique` them, and replace each
value by its rank (chapter 10.4). That is one `O(n log n)` pass, after which the
window uses a plain `std::vector<int>` — faster than any hash map, and immune to
the anti-hash tests this chapter measured. When `n` is large and hacking is
allowed, compression is the answer that does not have to be defended.
