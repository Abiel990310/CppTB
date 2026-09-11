---
id: judge-widest-route
title: "The lightest bridge you must cross"
difficulty: stretch
chapter: minimum-spanning-trees
topics: [graphs, mst, bottleneck, io]
check: output
standard: c++20
timeLimitMs: 3000
---

A lorry must get from depot 1 to depot `n`. Every road has a weight limit, and
the lorry can only use a road whose limit is at least its load. Print the
heaviest load that can make the journey, or `-1` if no route exists.

Equivalently: over all routes, minimise the *smallest* limit on the route, then
report the best you can do.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `u`, `v` and `c`: a two-way road between depots `u` and `v` with
weight limit `c`.

**Output.** One line: the heaviest load that can travel from 1 to `n`, or `-1`.
When `n = 1` the lorry is already there, so print `-1` only if there is no
route at all — and there always is, so print the largest value the problem
allows: `1000000000`.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`, `1 ≤ c ≤ 10⁹`. Roads may
repeat.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

struct Road { int u, v; long long c; };

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<Road> roads(m);
    for (Road& r : roads) {
        std::cin >> r.u >> r.v >> r.c;
        --r.u;
        --r.v;
    }

    // Ascending, so the flimsiest roads are admitted first.
    std::sort(roads.begin(), roads.end(),
              [](const Road& a, const Road& b) { return a.c < b.c; });

    std::vector<int> parent(n);
    std::iota(parent.begin(), parent.end(), 0);
    auto find = [&](int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    };

    for (const Road& r : roads) {
        parent[find(r.u)] = find(r.v);
        if (find(0) == find(n - 1)) {
            std::cout << r.c << '\n';
            return 0;
        }
    }

    std::cout << -1 << '\n';
}
```

## Cases

### Sample
```in
4 4
1 2 8
2 4 3
1 3 5
3 4 5
```
```out
5
```

### the long way round carries more
```in
5 5
1 2 10
2 5 1
1 3 4
3 4 4
4 5 4
```
```out
4
```

### one road only
```in
2 1
1 2 7
```
```out
7
```

### no route
```in
3 1
1 2 5
```
```out
-1
```

### no roads at all
```in
2 0
```
```out
-1
```

### already at the destination
```in
1 0
```
```out
1000000000
```

### parallel roads, the strongest wins
```in
2 3
1 2 2
1 2 9
1 2 5
```
```out
9
```

### a limit no int would survive doubling
```in
3 2
1 2 1000000000
2 3 1000000000
```
```out
1000000000
```

### a detour through many strong roads beats one weak direct road
```in
6 6
1 6 1
1 2 100
2 3 100
3 4 100
4 5 100
5 6 100
```
```out
100
```

### the bottleneck is in the middle
```in
5 4
1 2 50
2 3 2
3 4 50
4 5 50
```
```out
2
```

## Hints
- Sorting **ascending** admits the weakest roads first, so the first moment 1
  and `n` are connected you are holding the *weakest* road on the best route —
  which is the answer for a *minimum* bottleneck, not this one.
- This problem wants the strongest possible weakest link, so admit the
  **strongest** roads first and stop the moment 1 and `n` connect.
- The starter also unites before testing, and calls `find` twice more after
  mutating `parent` — cheap, but write the roots into locals first so the test
  reads what you think it does.
- `n = 1` never enters the loop, so handle it before the loop.
- 200,000 roads and 200,000 depots is comfortably within the time limit for one
  sort plus a near-linear union-find; nothing cleverer is needed.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

struct Road { int u, v; long long c; };

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<Road> roads(m);
    for (Road& r : roads) {
        std::cin >> r.u >> r.v >> r.c;
        --r.u;
        --r.v;
    }

    if (n == 1) {
        std::cout << 1000000000 << '\n';
        return 0;
    }

    // Descending: admit the strongest roads first.
    std::sort(roads.begin(), roads.end(),
              [](const Road& a, const Road& b) { return a.c > b.c; });

    std::vector<int> parent(n);
    std::vector<int> size(n, 1);
    std::iota(parent.begin(), parent.end(), 0);

    auto find = [&](int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    };

    for (const Road& r : roads) {
        int a = find(r.u), b = find(r.v);
        if (a != b) {
            if (size[a] < size[b]) std::swap(a, b);
            parent[b] = a;
            size[a] += size[b];
        }
        if (find(0) == find(n - 1)) {
            std::cout << r.c << '\n';
            return 0;
        }
    }

    std::cout << -1 << '\n';
}
```

## Notes
This is the chapter's bottleneck property, and the whole problem is deciding
which direction to sort.

Admitting edges **in descending order** and stopping the moment the two depots
connect gives the *maximum* bottleneck: every road stronger than `r.c` has
already been admitted and did not connect them, so no route avoids a road this
weak; and this route exists, so `r.c` is achievable. That is the same exchange
argument as the ascending version in the chapter, with the inequality reversed
— which is why the maximum spanning tree answers maximum-bottleneck questions
exactly as the minimum one answers minimum-bottleneck questions.

The starter sorts ascending, which answers a different and perfectly reasonable
question: *what is the flimsiest road I am forced to cross if I want to keep to
the flimsiest roads available?* Nobody asks that, and it is the shape of mistake
that produces a submission failing on the second test case with no obvious
reason — the sample happens to agree, because on the sample graph both
directions connect 1 and 4 on a road of limit 5.

Two details in the fixed version. The roots go into `a` and `b` **before** the
union, because `find(r.u)` after `parent[b] = a` is a different question from
`find(r.u)` before it — the starter's version happens to work, and only because
path halving leaves the answer correct rather than because the code says what
it means. And `n == 1` is handled before the loop: with one depot the loop body
never runs and the fall-through prints `-1`, which is wrong for a lorry that
has already arrived.

Note what this problem does **not** need: the tree itself. Like `bottleneck` in
`mst-bottleneck`, the answer is the weight of the edge that closes the gap, and
the remaining edges are never examined. Building the full MST and then walking
the path between 1 and `n` gives the same answer and is strictly more work —
correct, and the sort of thing that turns a comfortable time limit into a tight
one on a larger constraint.
