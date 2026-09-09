---
id: judge-cycle-detection
title: "Does this dependency graph have a cycle?"
difficulty: core
chapter: dfs
topics: [graphs, dfs, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Read a **directed** graph and print `YES` if it contains a cycle and `NO`
otherwise. A self-loop counts as a cycle.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains two 1-indexed vertex numbers `u v`, meaning an edge from `u` to `v`.

**Output.** One line: `YES` or `NO`.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`.

## Starter
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
    }

    std::vector<char> visited(n, 0);          // one flag for two different facts
    std::vector<int> stack, iter(n, 0);

    for (int s = 0; s < n; ++s) {
        if (visited[s]) continue;
        visited[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (visited[w]) { std::cout << "YES\n"; return 0; }
                visited[w] = 1;
                stack.push_back(w);
            } else {
                stack.pop_back();
            }
        }
    }

    std::cout << "NO\n";
}
```

## Cases

### Sample
```in
3 3
1 2
2 3
3 1
```
```out
YES
```

### a diamond is not a cycle
```in
4 4
1 2
1 3
2 4
3 4
```
```out
NO
```

### two routes to the same vertex
```in
3 3
1 2
1 3
2 3
```
```out
NO
```

### a self-loop
```in
1 1
1 1
```
```out
YES
```

### no edges
```in
4 0
```
```out
NO
```

### a chain
```in
4 3
1 2
2 3
3 4
```
```out
NO
```

### a cycle reached from outside
```in
4 4
1 2
2 3
3 4
4 2
```
```out
YES
```

### two components, one cyclic
```in
5 4
1 2
3 4
4 5
5 3
```
```out
YES
```

## Hints
- A directed graph has a cycle exactly when a depth-first search finds an edge back to a vertex that is **still on the current path** — an ancestor, not merely something visited earlier.
- That needs three states: unvisited, on the path, and finished. One flag cannot tell the last two apart.
- Mark a vertex "on the path" when you push it and "finished" when you pop it. Only an edge to a vertex in the first state is a cycle.
- `1→2, 1→3, 2→3` is the smallest counterexample to the two-state version: vertex 3 is reached from 2 and then again from 1, by which time it is finished.
- The `iter[v]` cursor is what lets an iterative search know when a vertex is finished: it stays on the stack until its neighbour list is exhausted.
- Start a search from every unvisited vertex — a cycle may sit in a component the first search never reaches.

## Solution
```cpp
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    for (int i = 0; i < m; ++i) {
        int u, v;
        std::cin >> u >> v;
        g[u - 1].push_back(v - 1);
    }

    std::vector<int> colour(n, 0);            // 0 white, 1 on the path, 2 finished
    std::vector<int> stack, iter(n, 0);

    for (int s = 0; s < n; ++s) {
        if (colour[s] != 0) continue;
        colour[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (colour[w] == 1) { std::cout << "YES\n"; return 0; }   // back edge
                if (colour[w] == 0) { colour[w] = 1; stack.push_back(w); }
            } else {
                colour[v] = 2;                                            // finished
                stack.pop_back();
            }
        }
    }

    std::cout << "NO\n";
}
```

## Notes
One flag, two facts, and the difference between them is the answer.

A DFS classifies every edge it meets. An edge to an **unvisited** vertex extends
the tree; an edge to a vertex **still on the stack** closes a loop; an edge to a
**finished** vertex leads into territory already fully explored, and proves
nothing. The second and third are indistinguishable with a single `visited`
array, so the starter reports a cycle on `1→2, 1→3, 2→3` — a graph you could
draw as a task list with no circular dependency at all.

The error only goes one way: a two-state search never *misses* a cycle, so every
cyclic test passes and only the acyclic ones fail. That is worth knowing when a
submission scores partial marks — the failing cases are the `NO` answers, which
narrows the search enormously.

**Where "finished" is recorded.** The `else` branch — reached when `iter[v]` has
walked the whole neighbour list — is the iterative equivalent of returning from
a recursive call. Setting `colour[v] = 2` there is what makes the three-state
scheme work, and it is the piece a simple push-and-pop DFS has nowhere to put.

**Undirected graphs use a different test.** There, any edge to a visited vertex
other than the one you arrived along closes a cycle, and no colours are needed —
because an undirected DFS has no cross edges. Three graph types, three tests;
this problem is the directed one, which the phrase "an edge from `u` to `v`"
settles.

**On the size.** With `n` and `m` up to 2 × 10⁵, the search is O(n + m) and the
stack is explicit — the recursive version would need up to 2 × 10⁵ frames, and
chapter 10.18 measures the available depth at roughly 9,800 in this build. A
chain of 200,000 vertices is a perfectly ordinary input for this problem.
