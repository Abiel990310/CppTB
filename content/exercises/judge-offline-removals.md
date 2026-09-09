---
id: judge-offline-removals
title: "Components after each removal"
difficulty: stretch
chapter: union-find
topics: [union-find, offline, graphs, io]
check: output
standard: c++20
timeLimitMs: 3000
---

An undirected graph loses one edge at a time. After each removal, print the
number of connected components.

**Input.** The first line contains `n`, `m` and `k`. Each of the next `m` lines
contains an edge as two 1-indexed vertices. The last line contains `k` distinct
edge numbers (1-indexed, in the order given) — the edges to remove, in the order
they are removed.

**Output.** `k` lines: the number of connected components after each removal.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ k ≤ m ≤ 200000`.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

std::vector<int> parent, size_of;
int components;

int find(int v) {
    int root = v;
    while (parent[root] != root) root = parent[root];
    while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
    return root;
}

void unite(int a, int b) {
    a = find(a); b = find(b);
    if (a == b) return;
    if (size_of[a] < size_of[b]) std::swap(a, b);
    parent[b] = a;
    size_of[a] += size_of[b];
    --components;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m, k;
    std::cin >> n >> m >> k;
    std::vector<std::pair<int, int>> edges(m);
    for (auto& [u, v] : edges) { std::cin >> u >> v; --u; --v; }
    std::vector<int> order(k);
    for (int& id : order) { std::cin >> id; --id; }

    std::vector<char> removed(m, 0);
    for (int id : order) removed[id] = 1;

    parent.resize(n);
    std::iota(parent.begin(), parent.end(), 0);
    size_of.assign(n, 1);
    components = n;

    for (int i = 0; i < m; ++i)                     // everything that survives
        if (!removed[i]) unite(edges[i].first, edges[i].second);

    std::vector<int> answer(k);
    for (int step = k - 1; step >= 0; --step) {
        unite(edges[order[step]].first, edges[order[step]].second);
        answer[step] = components;                  // the edge is already back
    }

    for (int step = 0; step < k; ++step) std::cout << answer[step] << '\n';
}
```

## Cases

### Sample
```in
4 3 1
1 2
2 3
3 4
2
```
```out
2
```

### two removals from a path
```in
4 3 2
1 2
2 3
3 4
1 3
```
```out
2
3
```

### the whole path comes apart
```in
3 2 2
1 2
2 3
1 2
```
```out
2
3
```

### the only edge
```in
2 1 1
1 2
1
```
```out
2
```

### a parallel edge keeps them together
```in
3 2 1
1 2
1 2
1
```
```out
2
```

### removals out of order
```in
5 4 4
1 2
2 3
4 5
3 4
4 1 2 3
```
```out
2
3
4
5
```

### nothing is removed
```in
3 2 0
1 2
2 3

```
```out
```

## Hints
- A union-find can merge and cannot split, so process the removals **backwards**: read from the end of the list and every removal becomes an insertion.
- Start by uniting every edge that is never removed. That is the state of the graph after all `k` removals — which is the answer to the last query.
- Then walk `step` from `k - 1` down to 0: record the answer for `step`, *then* put edge `order[step]` back.
- The order of those two lines is the whole problem. Re-adding first gives the state after removals `0 … step-1`, which is the previous query's answer.
- Fill `answer[step]` directly rather than pushing onto a vector — that way the answers come out in forward order with no reversal at the end.
- With up to 2 × 10⁵ lines of output, print with `'\n'` and `sync_with_stdio(false)`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

std::vector<int> parent, size_of;
int components;

int find(int v) {
    int root = v;
    while (parent[root] != root) root = parent[root];
    while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
    return root;
}

void unite(int a, int b) {
    a = find(a); b = find(b);
    if (a == b) return;
    if (size_of[a] < size_of[b]) std::swap(a, b);
    parent[b] = a;
    size_of[a] += size_of[b];
    --components;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m, k;
    std::cin >> n >> m >> k;
    std::vector<std::pair<int, int>> edges(m);
    for (auto& [u, v] : edges) { std::cin >> u >> v; --u; --v; }
    std::vector<int> order(k);
    for (int& id : order) { std::cin >> id; --id; }

    std::vector<char> removed(m, 0);
    for (int id : order) removed[id] = 1;

    parent.resize(n);
    std::iota(parent.begin(), parent.end(), 0);
    size_of.assign(n, 1);
    components = n;

    for (int i = 0; i < m; ++i)
        if (!removed[i]) unite(edges[i].first, edges[i].second);

    std::vector<int> answer(k);
    for (int step = k - 1; step >= 0; --step) {
        answer[step] = components;                  // record, then undo
        unite(edges[order[step]].first, edges[order[step]].second);
    }

    for (int step = 0; step < k; ++step) std::cout << answer[step] << '\n';
}
```

## Notes
Two lines, in the wrong order.

The identity the whole technique rests on is:

```
the graph after removals 0 … step   ==   the graph before removal `step` is undone
```

So in the backwards loop, the answer for `step` must be read *before* edge
`order[step]` goes back in. Re-adding first gives the state after removals
`0 … step-1`, so every answer is the previous one and the final line — the state
with everything removed — is never printed at all. On the sample, the answer 2
becomes 1.

The starting state is the other half of the identity. Uniting only the edges
that are *never* removed builds exactly the graph that exists after all `k`
removals, which is the answer to the last query. Everything after that is
undoing.

**Why backwards at all.** A disjoint-set union merges and never splits — there
is no `separate(a, b)`. Reversing the timeline converts every deletion into an
insertion, which is the one thing the structure does well. Chapter 10.20
measures what that is worth: 8.2 ms for 40,000 answers, against a rebuild-per-step
approach that extrapolates to about forty minutes.

**The precondition is that this is offline.** Every removal must be known before
any answer is required, which the input format here guarantees by listing them
all on one line. A problem that interleaves removals with queries it must answer
immediately needs a different structure — a link-cut tree, or a segment tree over
time with a rollback-capable DSU. Reading the input format is how you tell which
problem you have.

**Two details in the code.** `answer[step] = ...` fills the array by index rather
than pushing, so the results are already in forward order and no reversal is
needed. And `k` may be 0, in which case both loops do nothing and the program
prints nothing — which is a legitimate input and worth having a case for.
