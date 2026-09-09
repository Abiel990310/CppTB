---
id: judge-components
title: "How many pieces, and how big"
difficulty: core
chapter: dfs
topics: [graphs, dfs, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Read an undirected graph and print the number of connected components and the
number of vertices in the largest one.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains two 1-indexed vertex numbers.

**Output.** One line: the number of components, a space, and the size of the
largest.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`. Self-loops and repeated
edges may appear.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> adj(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        --u; --v;
        adj[u].push_back(v);
        if (u != v) adj[v].push_back(u);
    }

    std::vector<char> seen(n, 0);
    std::vector<int> stack;
    int components = 0, largest = 0;

    // Explore from vertex 0.
    ++components;
    seen[0] = 1;
    stack.push_back(0);
    int size = 0;
    while (!stack.empty()) {
        int v = stack.back();
        stack.pop_back();
        ++size;
        for (int w : adj[v]) if (!seen[w]) { seen[w] = 1; stack.push_back(w); }
    }
    largest = std::max(largest, size);

    std::cout << components << ' ' << largest << '\n';
}
```

## Cases

### Sample
```in
5 3
1 2
2 3
4 5
```
```out
2 3
```

### no edges at all
```in
4 0
```
```out
4 1
```

### one big cycle
```in
3 3
1 2
2 3
3 1
```
```out
1 3
```

### three separate pairs
```in
6 3
1 2
3 4
5 6
```
```out
3 2
```

### one vertex
```in
1 0
```
```out
1 1
```

### a self-loop and an isolated vertex
```in
2 1
1 1
```
```out
2 1
```

### the largest component is not the first
```in
6 3
1 2
3 4
4 5
```
```out
3 3
```

### parallel edges
```in
4 3
1 2
1 2
3 4
```
```out
2 2
```

## Hints
- A depth-first search reaches exactly one component, so counting components means starting a fresh search from every vertex that nothing has reached yet.
- Wrap the search in `for (int s = 0; s < n; ++s) if (!seen[s]) { ... }`, and count the vertices popped in each search to get its size.
- `4 0` — four isolated vertices — is the case that catches a missing outer loop: the answer is `4 1`, and one search from vertex 0 says `1 1`.
- The last case matters too: the first component explored need not be the largest, so take a running maximum rather than the first size.
- Use an explicit `std::vector<int>` as the stack. A recursive DFS over 2 × 10⁵ vertices can be 2 × 10⁵ deep, which overflows — chapter 10.18 measures the limit at roughly 9,800 frames in this build.
- Self-loops and parallel edges change nothing about connectivity, and the reading code already handles them.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> adj(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        --u; --v;
        adj[u].push_back(v);
        if (u != v) adj[v].push_back(u);
    }

    std::vector<char> seen(n, 0);
    std::vector<int> stack;
    int components = 0, largest = 0;

    for (int s = 0; s < n; ++s) {              // one search per unreached vertex
        if (seen[s]) continue;
        ++components;
        seen[s] = 1;
        stack.push_back(s);
        int size = 0;
        while (!stack.empty()) {
            int v = stack.back();
            stack.pop_back();
            ++size;
            for (int w : adj[v]) if (!seen[w]) { seen[w] = 1; stack.push_back(w); }
        }
        largest = std::max(largest, size);
    }

    std::cout << components << ' ' << largest << '\n';
}
```

## Notes
The search is right and there is only one of it.

A DFS from a vertex reaches its component and stops. Counting components is
therefore a loop *around* the search, once per vertex that nothing has yet
reached — and the search itself is a subroutine. The starter runs it once, so it
answers `1` for every input and reports the size of vertex 1's component as the
largest.

`4 0` is the smallest input that exposes it. Four isolated vertices are four
components of size 1, and any missing outer loop says `1 1`. It is worth keeping
in a test set for anything that partitions a graph.

Three details the other cases pin down.

**The largest need not be first.** The seventh case puts a three-vertex
component after a two-vertex one, so the maximum has to be taken across all the
searches. Recording only the first size is a bug that a sample input with a
convenient ordering will not catch.

**Counting the size.** Incrementing on *pop* counts each vertex exactly once,
because a vertex is pushed once (it is marked at the push) and therefore popped
once. Counting on push works equally well; counting inside the neighbour loop
does not, since a vertex has as many neighbours as it has edges.

**Self-loops and parallel edges are noise here.** They change degrees, which
chapter 10.16's problem cares about, and they change nothing about which
vertices are connected. The `if (u != v)` guard keeps a self-loop out of its own
neighbour list, which is what a traversal wants; storing it twice would be
harmless too, since the vertex is already marked.

**Use an explicit stack.** `n` can be 2 × 10⁵ and a path of that length is a
legitimate input, so the recursive version would need 2 × 10⁵ frames — about
twenty times what fits. The failure is a segfault reported as a runtime error
with no line number, which makes it one of the harder verdicts to diagnose from
a judge's feedback alone.
