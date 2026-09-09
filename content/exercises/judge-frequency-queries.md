---
id: judge-frequency-queries
title: "A multiset by hand"
difficulty: core
chapter: hashing-and-frequency
topics: [hashing, frequency-maps, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Maintain a multiset of integers under three operations.

**Input.** The first line contains `q`. Each of the next `q` lines is one of:

- `1 x` — insert one copy of `x`.
- `2 x` — remove one copy of `x`. If `x` is not present, do nothing.
- `3 x` — report how many copies of `x` are currently present.

**Output.** One line per operation of type 3.

**Constraints.** `1 ≤ q ≤ 200000`, `1 ≤ x ≤ 10⁹`. The values are far too large
to index an array with.

## Starter
```cpp
#include <iostream>
#include <unordered_map>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int q;
    std::cin >> q;

    std::unordered_map<int, int> counts;

    for (int i = 0; i < q; ++i) {
        int op, x;
        std::cin >> op >> x;
        if (op == 1) {
            ++counts[x];
        } else if (op == 2) {
            counts.erase(x);                 // removes the entry, not one copy
        } else {
            std::cout << counts[x] << '\n';
        }
    }
}
```

## Cases

### Sample
```in
8
1 5
1 5
3 5
2 5
3 5
2 5
3 5
3 7
```
```out
2
1
0
0
```

### removing what is not there
```in
5
1 3
2 3
2 3
1 3
3 3
```
```out
1
```

### asking about the absent
```in
4
3 1
1 1
3 1
3 2
```
```out
0
1
0
```

### large values
```in
7
1 1000000000
1 1000000000
1 1000000000
2 1000000000
3 1000000000
2 1000000000
3 1000000000
```
```out
2
1
```

### the same question twice
```in
3
1 4
3 4
3 4
```
```out
1
1
```

### many copies
```in
9
1 2
1 2
1 2
1 2
2 2
2 2
3 2
2 2
3 2
```
```out
2
1
```

## Hints
- Operation 2 removes *one* copy, not the value. Decrement the count instead of erasing the entry.
- Removing a value that is absent must leave the map unchanged. Look it up with `find` and do nothing when it is not there — do not decrement blindly, or the count goes to −1 and a later query reports a negative.
- Erasing an entry once its count reaches zero is optional here, but keeps the map's size proportional to the number of distinct values present rather than the number ever seen.
- Beware `operator[]` on a query: `counts[x]` *inserts* `x` with count 0 when it is absent. The answer is right, but the map grows by one entry per distinct query. Prefer `count`, or `find` and a default.
- The values reach 10⁹, so no array is possible. A hash map is the natural choice — and `std::map` is a perfectly good one here, at a log factor.
- If you use `std::unordered_map` on a judge that allows hacks, give it a salted hash: the default integer hash on libstdc++ is the identity, and adversarial keys make every operation linear.

## Solution
```cpp
#include <iostream>
#include <unordered_map>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int q;
    std::cin >> q;

    std::unordered_map<int, int> counts;

    for (int i = 0; i < q; ++i) {
        int op, x;
        std::cin >> op >> x;
        if (op == 1) {
            ++counts[x];
        } else if (op == 2) {
            auto it = counts.find(x);
            if (it != counts.end() && --it->second == 0) counts.erase(it);
        } else {
            auto it = counts.find(x);        // find, not [], so nothing is inserted
            std::cout << (it == counts.end() ? 0 : it->second) << '\n';
        }
    }
}
```

## Notes
`erase(x)` on a map removes the *entry*. That is the right operation when the
key means "a thing that exists or does not", and the wrong one when the value
attached to it is a count. Here it throws away every copy at once: after two
inserts of 5, a single `2 5` leaves nothing rather than one copy. The starter
answers the sample `2 0 0 0` where the answer is `2 1 0 0`.

The same confusion has a sibling in `std::multiset`, where `ms.erase(x)` removes
every copy and `ms.erase(ms.find(x))` removes one. If you solved this with a
multiset instead of a count map, that is the line to check.

Three details the cases are checking.

**Removing something absent.** `--counts[x]` on a missing key inserts it with 0
and then decrements to −1, and a later `3 x` reports −1. The `find` guard is not
defensive programming; it is the difference between right and wrong on the
second case, where `2 3` is issued against an empty multiset.

**Querying with `operator[]`.** `std::cout << counts[x]` prints the right number
and inserts an entry as a side effect. With 2 × 10⁵ queries for distinct absent
values, the map ends up holding 2 × 10⁵ entries that mean nothing. It is not a
wrong answer, which is exactly why it is worth knowing: it is a memory and time
cost that no test will point at.

**Erasing on zero.** Optional for correctness, useful in general: it keeps the
container's size proportional to what is present rather than to what has ever
been present, which matters when the map is inside a sliding window rather than
a global tally.

One last thing about the choice of container. `std::unordered_map<int, int>` is
the obvious answer and is hackable — see this chapter's measurement, where 4,000
adversarially chosen keys took 1228 ms against 5.5 ms. On a judge with open
hacking, either salt the hash or use `std::map` and accept the log factor. At
q = 2 × 10⁵ the ordered map costs a few tens of milliseconds, which is almost
always affordable.
