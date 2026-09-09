---
id: judge-degree-sequence
title: "The degree of every vertex"
difficulty: core
chapter: representing-graphs
topics: [graphs, input, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Read an undirected graph and print the degree of every vertex. A self-loop
contributes **2** to its vertex's degree; parallel edges each contribute.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains two 1-indexed vertex numbers.

**Output.** One line of `n` integers separated by single spaces: the degrees of
vertices 1 through `n`.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`. Self-loops and repeated
edges may appear.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;

    std::vector<int> degree(n, 0);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        --u; --v;
        ++degree[u];
        if (u != v) ++degree[v];        // how much does a self-loop add?
    }

    for (int i = 0; i < n; ++i) std::cout << degree[i] << " \n"[i == n - 1];
}
```

## Cases

### Sample
```in
5 6
1 2
2 3
1 2
3 1
4 4
4 5
```
```out
3 3 2 3 1
```

### a lone self-loop
```in
3 1
1 1
```
```out
2 0 0
```

### no edges
```in
4 0
```
```out
0 0 0 0
```

### a path
```in
4 3
1 2
2 3
3 4
```
```out
1 2 2 1
```

### parallel edges
```in
3 3
1 2
1 2
1 2
```
```out
3 3 0
```

### both directions given
```in
2 2
1 2
2 1
```
```out
2 2
```

### one vertex, one loop
```in
1 1
1 1
```
```out
2
```

## Hints
- Every edge has two endpoints, and both of them belong to the count. A self-loop's two endpoints are the same vertex, so it adds 2 there.
- That convention is what makes the handshake lemma work: the sum of all degrees is exactly `2m`. Check your output against it.
- So the loop body is two unconditional increments, with no test for `u == v`.
- The guard `if (u != v)` *is* right when you are building a neighbour list — it stops the vertex appearing twice in its own list — which is why the line looks familiar and is wrong here.
- Convert 1-indexed input to 0-indexed once, at the point of reading, and stay 0-indexed everywhere after.
- With `n` up to 2 × 10⁵, print with `'\n'` and `sync_with_stdio(false)` rather than `std::endl`.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;

    std::vector<int> degree(n, 0);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        --u; --v;
        ++degree[u];
        ++degree[v];                    // both endpoints, even when they coincide
    }

    for (int i = 0; i < n; ++i) std::cout << degree[i] << " \n"[i == n - 1];
}
```

## Notes
Two lines, one `if` too many.

The degree of a vertex counts *edge endpoints* at that vertex. A self-loop has
two endpoints and both are at the same vertex, so it adds 2. The convention is
not arbitrary: it is what makes the handshake lemma — the sum of the degrees
equals `2m` — hold for every graph, and that identity is used constantly, from
Euler tours to counting arguments.

The starter's guard is the right line in a different function. When building an
adjacency list, `if (u != v) adj[v].push_back(u);` stops a self-loop appearing
twice in its own neighbour list, which is usually what you want for traversal.
The same three tokens mean the wrong thing here. **Graph-reading code looks
identical across problems and is not**, which is why the four decisions —
indexing, direction, self-loops, multi-edges — are worth making explicitly each
time rather than pasted.

Two checks worth running on any degree computation:

- **The sum.** `sum(degree) == 2 * m`. On the sample that is 12, and the starter
  produces 11 — the missing endpoint of the self-loop.
- **The extremes.** No degree exceeds `2m`, and no degree is negative. Both are
  cheap and catch index errors immediately.

**Parallel edges just count.** `1 2` three times gives both vertices degree 3.
Nothing here deduplicates, and the statement says so; when a statement instead
promises a *simple* graph, that promise is a licence to skip the handling, not a
reason to add it.

**On the output.** `" \n"[i == n - 1]` indexes a two-character string literal
with a `bool` converted to 0 or 1, giving a space between values and a newline
after the last. It avoids the trailing space that some judges reject, and at
2 × 10⁵ numbers it matters that the whole line goes through one buffered stream —
chapter 10.3 measured what `std::endl` costs here.
