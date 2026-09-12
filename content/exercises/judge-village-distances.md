---
id: judge-village-distances
title: "How far is everywhere"
difficulty: core
chapter: tree-dp-and-rerooting
topics: [graphs, trees, dynamic-programming, io]
check: output
standard: c++20
timeLimitMs: 3000
---

A country has `n` villages joined by `n − 1` roads, and you can get from any
village to any other. For **every** village, print the total distance from it to
all the other villages, counting one road as one unit.

**Input.** The first line contains `n`. Each of the next `n − 1` lines contains
`u` and `v`: a road between villages `u` and `v`.

**Output.** One line with `n` integers separated by single spaces — the total
for village 1, then village 2, and so on.

**Constraints.** `1 ≤ n ≤ 200000`. The roads always form a tree.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i + 1 < n; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
        g[v - 1].push_back(u - 1);
    }

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    order.reserve(n);
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<long long> size(n, 1), down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        size[p] += size[v];
        down[p] += down[v] + size[v];
    }

    std::vector<long long> ans(n, 0);
    ans[0] = down[0];
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        ans[v] = ans[p] + n - size[v];        // how much does moving the root cost?
    }

    for (int v = 0; v < n; ++v)
        std::cout << ans[v] << " \n"[v + 1 == n];
}
```

## Cases

### Sample
```in
6
1 2
1 3
2 4
2 5
3 6
```
```out
8 8 10 12 12 14
```

### one village
```in
1
```
```out
0
```

### two villages
```in
2
1 2
```
```out
1 1
```

### two equal branches
```in
3
1 2
1 3
```
```out
2 3 3
```

### a star
```in
6
1 2
1 3
1 4
1 5
1 6
```
```out
5 9 9 9 9 9
```

### a path
```in
7
1 2
2 3
3 4
4 5
5 6
6 7
```
```out
21 16 13 12 13 16 21
```

### roads in scrambled order
```in
8
7 8
3 6
1 3
4 7
2 4
1 2
5 6
```
```out
16 16 18 18 28 22 22 28
```

### a bigger tree
```in
40
13 29
11 17
11 20
6 28
21 34
2 23
4 24
5 37
18 27
6 16
13 26
30 32
8 15
1 2
5 6
3 7
1 30
7 31
3 9
3 8
11 13
13 22
2 11
35 39
13 18
7 14
4 35
12 33
30 38
25 40
8 12
3 19
1 5
8 10
19 21
2 3
11 25
23 36
3 4
```
```out
125 103 109 141 155 189 143 139 147 177 121 175 149 181 177 227 159 185 143 159 179 187 139 179 157 187 223 227 187 159 181 197 213 217 177 177 193 197 215 195
```

## Hints
- Everything above the rerooting step is already correct: the traversal, `size`, and `down` — the sum of distances from a vertex down into its own subtree.
- Moving the root from `p` across an edge to `v` changes two groups. The `size[v]` vertices in `v`'s subtree each get one step closer; all the others each get one step further.
- "All the others" is `n - size[v]` vertices. Write the change as `-size[v] + (n - size[v])` and simplify.
- The two smallest cases separate a right answer from a nearly-right one: on a path of three villages the answer is `2 3 3`, and on a star it is `5 9 9 9 9 9`.
- `n = 1` reads no roads at all. The loop `for (i = 0; i + 1 < n; ...)` already handles that; make sure the output is still one line.
- Totals reach about 4 × 10¹⁰ at the stated limit, so `ans`, `size` and `down` are all `long long`.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i + 1 < n; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
        g[v - 1].push_back(u - 1);
    }

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    order.reserve(n);
    seen[0] = true;
    while (!stack.empty()) {                  // iterative: a path would overflow
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<long long> size(n, 1), down(n, 0);
    for (int i = n - 1; i >= 1; --i) {        // children before parents
        int v = order[i], p = parent[v];
        size[p] += size[v];
        down[p] += down[v] + size[v];
    }

    std::vector<long long> ans(n, 0);
    ans[0] = down[0];
    for (int i = 1; i < n; ++i) {             // parents before children
        int v = order[i], p = parent[v];
        ans[v] = ans[p] + n - 2 * size[v];    // closer inside, further outside
    }

    for (int v = 0; v < n; ++v)
        std::cout << ans[v] << " \n"[v + 1 == n];
}
```

## Notes
**The whole problem is one coefficient.** The starter counts the vertices that
get closer and forgets that the rest get further, so it is short by exactly
`size[v]` at every step. That kind of bug survives a surprising number of tests:
it is right at the root, and on a star it is right at the centre, which is why
the cases include a path and a tree of 40 vertices where it is wrong everywhere.

Deriving it beats memorising it. Moving the root from `p` to `v` cuts the edge
between them and asks every vertex which side it is on:

```
inside  v's subtree : size[v] vertices, each one step nearer   → -size[v]
everything else     : n - size[v] vertices, each one further   → +(n - size[v])
```

Add them and the `2` appears on its own.

**Widths.** With `n = 2 × 10⁵` arranged in a path, the sum of distances from an
end is about 2 × 10¹⁰, which overflows a 32-bit `int`. Signed overflow is
undefined behaviour, not wraparound, so this is a real bug rather than a wrong
number. `size` is `long long` for the same reason once it is multiplied by 2 and
subtracted from `n`.

**What these cases do and do not check.** They check correctness — the
transition, the root, `n = 1`, ties, and roads given in an arbitrary order.
They do **not** enforce the linear bound: timing out a per-vertex traversal
needs tens of thousands of vertices, which is more input than fits legibly in
this file. The stated limit of 200,000 is the one a real judge would apply, and
the quadratic solution really would fail there; here, only the reading of the
problem enforces it.

**On the output.** `" \n"[v + 1 == n]` picks a space between values and a
newline after the last — a small idiom worth recognising, since printing a
trailing space before the newline is accepted here anyway (the judge ignores
trailing whitespace on a line) but is not accepted everywhere.
