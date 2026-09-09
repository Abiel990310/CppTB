---
id: judge-set-cover
title: "Covering everything with the fewest sets"
difficulty: stretch
chapter: bitmask-enumeration
topics: [bitmask, search, io]
check: output
standard: c++20
timeLimitMs: 3000
---

You are given `n` items and `m` sets of them. Print the smallest number of sets
whose union is all `n` items, or `-1` if no combination covers everything.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
describes one set: an integer `k`, then `k` distinct item indices in `[0, n)`.

**Output.** One line: the minimum number of sets, or `-1`.

**Constraints.** `1 ≤ n ≤ 15`, `1 ≤ m ≤ 60`.

## Starter
```cpp
#include <bit>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;

    std::vector<unsigned> sets(m, 0);
    for (int i = 0; i < m; ++i) {
        int k;
        std::cin >> k;
        for (int j = 0; j < k; ++j) {
            int item;
            std::cin >> item;
            sets[i] |= 1u << item;
        }
    }

    const unsigned full = (1u << n) - 1;

    // Repeatedly take whichever set covers the most items not yet covered.
    unsigned covered = 0;
    int used = 0;
    while (covered != full) {
        int best_gain = 0;
        unsigned best_set = 0;
        for (unsigned s : sets) {
            int gain = std::popcount(s & ~covered & full);
            if (gain > best_gain) { best_gain = gain; best_set = s; }
        }
        if (best_gain == 0) { used = -1; break; }
        covered |= best_set;
        ++used;
    }

    std::cout << used << '\n';
}
```

## Cases

### Sample
```in
6 3
4 0 1 2 3
3 0 1 4
3 2 3 5
```
```out
2
```

### the same shape, larger
```in
8 3
4 0 1 2 3
4 0 1 4 5
4 2 3 6 7
```
```out
2
```

### only singletons
```in
3 3
1 0
1 1
1 2
```
```out
3
```

### one set covers everything
```in
3 1
3 0 1 2
```
```out
1
```

### nothing covers item 1
```in
2 1
1 0
```
```out
-1
```

### a single item
```in
1 1
1 0
```
```out
1
```

### a redundant big set
```in
4 3
2 0 1
2 2 3
4 0 1 2 3
```
```out
1
```

### two overlapping sets
```in
3 2
2 0 1
2 0 2
```
```out
2
```

## Hints
- Taking the set that covers the most new items is a *greedy* choice, and greedy is not optimal for set cover. The sample is a counterexample: the biggest set is a trap.
- `n ≤ 15` means there are at most 32,768 possible "covered so far" states. That is a signal: search over the states, not over the choices.
- Treat each state as a node and each set as an edge from `mask` to `mask | set`. Every edge costs 1, so the answer is a shortest path — a breadth-first search from 0 finds it.
- A `std::vector<int> dist(1 << n, -1)` with `dist[0] = 0` is all the bookkeeping needed; the first time you reach `full`, that distance is the answer.
- A dynamic-programming form works equally well: `dp[mask | s] = min(dp[mask | s], dp[mask] + 1)`, iterating masks in increasing order — every edge only moves to a numerically larger mask, because bits are only ever added.
- If nothing reaches `full`, print `-1`. The union of every set is the test: if it is not `full`, no combination can be.

## Solution
```cpp
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;

    std::vector<unsigned> sets(m, 0);
    for (int i = 0; i < m; ++i) {
        int k;
        std::cin >> k;
        for (int j = 0; j < k; ++j) {
            int item;
            std::cin >> item;
            sets[i] |= 1u << item;
        }
    }

    const unsigned full = (1u << n) - 1;

    // Shortest path over "which items are covered" states; every set costs 1.
    std::vector<int> dist(full + 1, -1);
    dist[0] = 0;
    std::deque<unsigned> queue{0u};

    while (!queue.empty()) {
        unsigned mask = queue.front();
        queue.pop_front();
        if (mask == full) break;
        for (unsigned s : sets) {
            unsigned next = mask | s;
            if (dist[next] == -1) {
                dist[next] = dist[mask] + 1;
                queue.push_back(next);
            }
        }
    }

    std::cout << dist[full] << '\n';
}
```

## Notes
The starter is a good greedy and a wrong answer, which makes it a useful thing
to have written once.

On the sample the sets are `{0,1,2,3}`, `{0,1,4}` and `{2,3,5}`. Greedy takes
the first because it covers four items, then needs both of the others to reach
items 4 and 5 — three sets. The optimum is the second and third together, which
cover everything in two. The greedy choice is locally the best and globally
wrong, and no tie-breaking rule fixes it: the second case is the same trap with
all three sets the same size.

Set cover is NP-hard, and the greedy algorithm is the classic approximation —
it is guaranteed to be within a factor of about `ln n` of the optimum, which is
excellent for a real system and useless for a judge that wants the exact
number. Chapter 10.13 is about when a greedy *is* provably optimal, and the
short answer is: only when you can prove it, usually by an exchange argument.

**Reading the constraint.** `n ≤ 15` is the setter saying "2ⁿ is affordable".
32,768 states times 60 sets is about two million edges, which is nothing. The
size of `m` barely matters; it is `n` that decides the technique, because the
state is *which items are covered* rather than *which sets are chosen*. Getting
that the right way round is the whole insight — there are 2⁶⁰ subsets of the
sets, and only 2¹⁵ subsets of the items.

**Why breadth-first search rather than a `while` loop with a minimum.** Every
edge has the same weight, so the first time a state is reached is via a shortest
path, and each state is enqueued once. That is O(2ⁿ · m) with a tiny constant.
The DP form in the hints computes the same thing in the same time by iterating
masks in increasing numeric order; it works because `mask | s >= mask` always,
so the dependencies point one way. Chapter 10.17 makes the BFS argument
properly, and chapter 10.30 makes the DP one.

**The `-1` case falls out.** If no combination covers everything, `dist[full]`
is never assigned and stays `-1`, which is exactly what the problem asks you to
print. A sentinel chosen to match the required output removes a branch — the
same trick as chapter 10.8's `left == -1` meaning "nothing stopped it".
