---
id: judge-connected-queries
title: "Connect and ask"
difficulty: core
chapter: union-find
topics: [union-find, graphs, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Maintain a set of `n` vertices under three operations.

**Input.** The first line contains `n` and `q`. Each of the next `q` lines is
one of:

- `1 u v` — connect `u` and `v`.
- `2 u v` — print `YES` if `u` and `v` are connected, `NO` otherwise.
- `3` — print the number of connected components.

Vertices are 1-indexed.

**Output.** One line for each operation of type 2 or 3.

**Constraints.** `1 ≤ n ≤ 200000`, `1 ≤ q ≤ 200000`.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

std::vector<int> parent, size_of;

int find(int v) {
    int root = v;
    while (parent[root] != root) root = parent[root];
    while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
    return root;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    std::cin >> n >> q;
    parent.resize(n);
    std::iota(parent.begin(), parent.end(), 0);
    size_of.assign(n, 1);

    int components = n;
    for (int i = 0; i < q; ++i) {
        int op;
        std::cin >> op;
        if (op == 1) {
            int u, v;
            std::cin >> u >> v;
            int a = find(u - 1), b = find(v - 1);
            if (a != b) {
                if (size_of[a] < size_of[b]) std::swap(a, b);
                parent[b] = a;
                size_of[a] += size_of[b];
            }
            --components;                    // one per instruction, not per merge
        } else if (op == 2) {
            int u, v;
            std::cin >> u >> v;
            std::cout << (find(u - 1) == find(v - 1) ? "YES" : "NO") << '\n';
        } else {
            std::cout << components << '\n';
        }
    }
}
```

## Cases

### Sample
```in
5 9
2 1 2
1 1 2
2 1 2
3
1 2 3
3
1 1 3
3
2 1 3
```
```out
NO
YES
4
3
3
YES
```

### connecting a vertex to itself
```in
3 4
3
1 1 1
3
2 1 1
```
```out
3
3
YES
```

### everything joins up
```in
4 5
1 1 2
1 3 4
1 2 3
3
2 1 4
```
```out
1
YES
```

### nothing connected
```in
2 2
2 1 2
3
```
```out
NO
2
```

### a single vertex
```in
1 2
3
2 1 1
```
```out
1
YES
```

### the same edge three times
```in
6 4
1 1 2
1 1 2
1 1 2
3
```
```out
5
```

### a chain then a query
```in
4 4
1 1 2
1 2 3
2 1 3
2 1 4
```
```out
YES
NO
```

## Hints
- The component count falls only when two *different* components merge. Decrement inside the `if (a != b)` branch.
- A `1 u u` instruction connects a vertex to itself and merges nothing; so does repeating an edge that has already been applied.
- `find` with path compression, written iteratively — the recursive one-liner recurses as deep as the tree, which can be 2 × 10⁵ before any compression has happened.
- Union by size (hang the smaller tree under the larger) keeps the trees shallow; it is two extra lines and it is what the O(α(n)) bound needs.
- A vertex is always connected to itself, so `2 u u` prints `YES`.
- With up to 2 × 10⁵ lines of output, use `'\n'` and `sync_with_stdio(false)`, not `std::endl`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

std::vector<int> parent, size_of;

int find(int v) {
    int root = v;
    while (parent[root] != root) root = parent[root];
    while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
    return root;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, q;
    std::cin >> n >> q;
    parent.resize(n);
    std::iota(parent.begin(), parent.end(), 0);
    size_of.assign(n, 1);

    int components = n;
    for (int i = 0; i < q; ++i) {
        int op;
        std::cin >> op;
        if (op == 1) {
            int u, v;
            std::cin >> u >> v;
            int a = find(u - 1), b = find(v - 1);
            if (a != b) {
                if (size_of[a] < size_of[b]) std::swap(a, b);
                parent[b] = a;
                size_of[a] += size_of[b];
                --components;                // only when something merged
            }
        } else if (op == 2) {
            int u, v;
            std::cin >> u >> v;
            std::cout << (find(u - 1) == find(v - 1) ? "YES" : "NO") << '\n';
        } else {
            std::cout << components << '\n';
        }
    }
}
```

## Notes
One line, moved inside an `if`.

The count of components falls by one when two distinct components become one.
An instruction that connects two already-connected vertices — or a vertex to
itself — is a no-op for the structure, and counting it makes the total drift
downwards until it is meaningless. On the sample the first `3` should print 4;
the starter prints 3, and after enough redundant instructions it would go
negative.

The general form is worth adopting: have `unite` **return whether it merged**,
and let the caller do the accounting.

```cpp
bool unite(int a, int b) {
    a = find(a); b = find(b);
    if (a == b) return false;
    ...
    return true;
}
// then: if (unite(u, v)) --components;
```

That single boolean is also the cycle test for Kruskal's algorithm (chapter
10.23) and the redundant-edge count of this chapter's other problem, so it earns
its place three times over.

**Two other things the cases check.**

`1 u u` connects a vertex to itself. `find` returns the same root twice, nothing
merges, and the count is unchanged — which is the correct behaviour and the same
reason a repeated edge changes nothing.

`2 u u` prints `YES`. A vertex is connected to itself, and the general code says
so with no special case, because `find(v) == find(v)`.

**On the two optimisations.** Path compression is what keeps `find` fast, and
union by size is what bounds the tree depth before compression has had a chance
to act. Chapter 10.20 measures the difference: on a chain of 10,000 vertices, no
optimisation costs 1,799 ms and 150 million parent hops, path compression alone
1.3 ms, and both together 20 thousand hops. At the constraints here either
optimisation alone would pass, and writing both is four lines.
