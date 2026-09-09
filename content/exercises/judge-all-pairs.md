---
id: judge-all-pairs
title: "Every distance, once"
difficulty: core
chapter: negative-weights
topics: [graphs, floyd-warshall, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Answer `q` queries asking the shortest distance between two cities.

**Input.** The first line contains `n`, `m` and `q`. Each of the next `m` lines
contains `u`, `v` and `w`: a **one-way** road from `u` to `v` costing `w`. Each
of the next `q` lines contains `a` and `b`.

**Output.** `q` lines: the shortest distance from `a` to `b`, or `-1` if there
is no route. The distance from a city to itself is 0.

**Constraints.** `1 ≤ n ≤ 300`, `0 ≤ m ≤ 20000`, `1 ≤ q ≤ 100000`,
`0 ≤ w ≤ 10⁹`. Roads may repeat. Cities are 1-indexed.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <limits>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m, q;
    std::cin >> n >> m >> q;
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (int i = 0; i < m; ++i) {
        int u, v;
        long long w;
        std::cin >> u >> v >> w;
        d[u - 1][v - 1] = std::min(d[u - 1][v - 1], w);
    }

    for (int i = 0; i < n; ++i)                 // which loop belongs outside?
        for (int j = 0; j < n; ++j)
            for (int k = 0; k < n; ++k)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];

    for (int i = 0; i < q; ++i) {
        int a, b;
        std::cin >> a >> b;
        long long answer = d[a - 1][b - 1];
        std::cout << (answer >= INF ? -1 : answer) << '\n';
    }
}
```

## Cases

### Sample
```in
4 3 3
1 2 1
2 4 1
4 3 1
1 3
1 4
3 1
```
```out
3
2
-1
```

### a shortcut that is not
```in
4 4 2
1 2 5
2 3 5
3 4 5
1 4 20
1 4
2 4
```
```out
15
10
```

### a city to itself
```in
3 1 2
1 2 7
1 1
3 3
```
```out
0
0
```

### no roads
```in
2 0 2
1 2
2 1
```
```out
-1
-1
```

### repeated roads keep the cheapest
```in
3 3 1
1 2 9
1 2 2
2 3 1
1 3
```
```out
3
```

### a long chain
```in
5 4 2
1 2 1
2 3 1
3 4 1
4 5 1
1 5
2 5
```
```out
4
3
```

### costs that need 64 bits
```in
4 3 1
1 2 1000000000
2 3 1000000000
3 4 1000000000
1 4
```
```out
3000000000
```

### one city
```in
1 0 1
1 1
```
```out
0
```

## Hints
- With `n ≤ 300` and up to 10⁵ queries, precompute every distance once — 2.7 × 10⁷ operations — rather than running a search per query.
- Floyd–Warshall's intermediate vertex `k` must be the **outermost** loop. Its invariant is "after processing `k = 0 … K`, `d[i][j]` uses only those vertices as intermediates", and that only holds in that order.
- The sample is the demonstration: the route from 1 to 3 passes through city 4, which the wrong order has not yet considered when it finalises `d[1][3]`.
- Initialise `d[v][v] = 0`, everything else to a large sentinel, then take the *minimum* over repeated roads.
- `INF` is `max() / 4`, because `d[i][k] + d[k][j]` is evaluated for pairs where both are infinite.
- Roads are one-way, so fill `d[u][v]` only — filling both directions answers a different problem.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <limits>
#include <vector>

const long long INF = std::numeric_limits<long long>::max() / 4;

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m, q;
    std::cin >> n >> m >> q;
    std::vector<std::vector<long long>> d(n, std::vector<long long>(n, INF));
    for (int v = 0; v < n; ++v) d[v][v] = 0;
    for (int i = 0; i < m; ++i) {
        int u, v;
        long long w;
        std::cin >> u >> v >> w;
        d[u - 1][v - 1] = std::min(d[u - 1][v - 1], w);
    }

    for (int k = 0; k < n; ++k)                 // the intermediate vertex, outermost
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j)
                if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];

    for (int i = 0; i < q; ++i) {
        int a, b;
        std::cin >> a >> b;
        long long answer = d[a - 1][b - 1];
        std::cout << (answer >= INF ? -1 : answer) << '\n';
    }
}
```

## Notes
Three loops, and only one order works.

The invariant is: **after the outermost loop has processed `k = 0 … K`,
`d[i][j]` is the shortest route from `i` to `j` using only vertices `0 … K` as
intermediates.** Each new `k` extends the permitted set by one vertex, and every
pair is brought up to date before the set grows again.

With `k` innermost, a pair is finalised before the higher-numbered vertices have
been allowed as intermediates at all, so routes through them are missed. The
sample makes it concrete: the route from city 1 to city 3 goes through city 4,
and the wrong order reports no route. Chapter 10.22 measures the frequency —
the two orders disagree on 524 of 2,000 random graphs, which is often enough to
fail and rare enough to pass a small sample.

**Why all-pairs here at all.** `n ≤ 300` and `q ≤ 10⁵` is a deliberate shape.
Floyd–Warshall costs `n³ = 2.7 × 10⁷` once and then answers each query in O(1);
running Dijkstra per query would be 10⁵ searches. When the constraints put `n`
in the hundreds and `q` in the tens of thousands, the setter is asking for the
matrix.

The crossover is about density. Chapter 10.22 measures a dense 250-vertex graph
at 538 ms for Floyd–Warshall against 2,387 ms for `n` runs of Dijkstra; on a
sparse graph with `n` in the thousands the ranking reverses.

**Three details in the setup.**

*One-way roads fill one cell.* Writing `d[v][u]` as well would make the graph
undirected and change every answer. The sample's third query — no route from 3
back to 1 — is there to catch it.

*Repeated roads take the minimum.* `d[u][v] = min(d[u][v], w)` rather than plain
assignment, or a later expensive road overwrites an earlier cheap one.

*The sentinel must survive addition.* `d[i][k] + d[k][j]` runs for every triple,
including pairs that are both unreachable, so `INF` at `max() / 4` keeps the sum
representable. With `max()` it would overflow — undefined behaviour, and in
practice a large negative number that looks like a wonderful shortcut.
