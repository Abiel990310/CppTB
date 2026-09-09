---
id: judge-shortest-cover
title: "Shortest covering window"
difficulty: stretch
chapter: two-pointers
topics: [two-pointers, sliding-window, counting, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Given a string `s` and a string `t`, print the length of the shortest contiguous
substring of `s` that contains every character of `t`, counting multiplicity. If
no such substring exists, print `0`.

Multiplicity matters: if `t` is `aa`, the window must contain two `a`s.

**Input.** Two lines: `s`, then `t`. Both consist of upper- and lower-case
letters only.

**Output.** One line: the length of the shortest covering window, or `0`.

**Constraints.** `1 ≤ |s| ≤ 200000`, `1 ≤ |t| ≤ 200000`.

## Starter
```cpp
#include <algorithm>
#include <array>
#include <iostream>
#include <string>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::string s, t;
    std::cin >> s >> t;

    std::array<int, 128> need{};
    for (unsigned char c : t) ++need[c];

    std::array<int, 128> window{};
    int have = 0;                       // characters matched so far
    int best = static_cast<int>(s.size()) + 1;
    int lo = 0;

    for (int hi = 0; hi < static_cast<int>(s.size()); ++hi) {
        unsigned char c = s[hi];
        ++window[c];
        if (need[c] > 0) ++have;

        while (have == static_cast<int>(t.size())) {
            best = std::min(best, hi - lo + 1);
            unsigned char d = s[lo];
            --window[d];
            if (need[d] > 0) --have;
            ++lo;
        }
    }

    std::cout << (best > static_cast<int>(s.size()) ? 0 : best) << '\n';
}
```

## Cases

### Sample
```in
ADOBECODEBANC
ABC
```
```out
4
```

### a surplus of one letter before the others arrive
```in
aabbc
abc
```
```out
4
```

### the surplus is adjacent
```in
aaxb
ab
```
```out
3
```

### the whole string is the window
```in
a
a
```
```out
1
```

### no window exists
```in
abc
d
```
```out
0
```

### t is longer than s
```in
a
aa
```
```out
0
```

### multiplicity is respected
```in
baaa
aa
```
```out
2
```

### the window ends before it begins
```in
bba
ab
```
```out
2
```

## Hints
- The window is valid or it is not, and that is a monotone property: adding a character can only make it valid, removing one can only make it invalid. That is the licence for the two-pointer scan.
- Keep one counter for how many *required* character slots are currently filled. The whole problem is getting that counter right.
- A character you already have enough of does not fill another slot. `window[c] < need[c]` before the increment is the test.
- On the way out, a character stops filling a slot only when the window drops *below* what is needed — `window[d] < need[d]` after the decrement.
- Record `best` inside the shrinking loop, not after it: the shortest window ending at `hi` is the one you have the instant before it becomes invalid.
- `best` needs a sentinel that no real window can reach; `|s| + 1` is the obvious one, and mapping it back to 0 at the end is the whole "no window" case.

## Solution
```cpp
#include <algorithm>
#include <array>
#include <iostream>
#include <string>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::string s, t;
    std::cin >> s >> t;

    std::array<int, 128> need{};
    for (unsigned char c : t) ++need[c];

    std::array<int, 128> window{};
    int missing = static_cast<int>(t.size());   // required slots still empty
    int best = static_cast<int>(s.size()) + 1;
    int lo = 0;

    for (int hi = 0; hi < static_cast<int>(s.size()); ++hi) {
        unsigned char c = s[hi];
        if (window[c] < need[c]) --missing;      // this copy fills a slot
        ++window[c];

        while (missing == 0) {                   // valid: record, then shrink
            best = std::min(best, hi - lo + 1);
            unsigned char d = s[lo];
            --window[d];
            if (window[d] < need[d]) ++missing;  // this copy was load-bearing
            ++lo;
        }
    }

    std::cout << (best > static_cast<int>(s.size()) ? 0 : best) << '\n';
}
```

## Notes
The starter's shape is right and its counter is wrong, which is the usual way
this problem is failed.

`have` is incremented for *every* character of `s` that appears anywhere in `t`,
including copies the window already has enough of. On `aabbc` against `abc` the
second `a` bumps `have` to 2 and the first `b` bumps it to 3, so at `hi = 2` the
program believes `aab` covers `abc` and prints 3. It does not; there is no `c` in
it. The correct answer is 4, for `abbc`.

The fix is one condition in each direction, and they are mirror images:

- Going in, a copy only helps if you did not already have enough:
  `if (window[c] < need[c]) --missing;` **before** the increment.
- Coming out, a copy only hurts if losing it drops you below enough:
  `if (window[d] < need[d]) ++missing;` **after** the decrement.

Write them in the wrong order relative to the increment and you get an off-by-one
in the counter, which is why the solution above places them deliberately.

Three details worth taking away.

**`missing` counts slots, not distinct characters.** It starts at `t.size()`, not
at the number of distinct characters in `t`. That is what makes multiplicity fall
out for free: `baaa` against `aa` starts with two empty slots, and only the second
`a` closes the last one, so the answer is 2 rather than 1.

**Record inside the shrinking loop.** The moment the window becomes valid it is
usually not minimal — there is dead weight on the left. Shrinking until it breaks
and taking the length at each step is what finds the minimum ending at this `hi`.
A `best = std::min(best, hi - lo + 1)` placed after the `while` records the first
*invalid* window instead, which is off by one in the wrong direction.

**The array beats the map.** `std::array<int, 128>` indexed by the character is a
zeroing of 512 bytes and an O(1) lookup with no hashing; `std::unordered_map<char,
int>` is the same algorithm with a constant factor of ten or so, and at
|s| = 200000 with the window's two passes that is the difference between
comfortable and marginal. When the alphabet is small and known, index it directly
— the chapter on hashing and frequency maps, later in this part, comes back to this.
