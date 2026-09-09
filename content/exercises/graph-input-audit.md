---
id: graph-input-audit
title: "Three graphs read wrongly"
difficulty: core
chapter: representing-graphs
topics: [graphs, input, algorithms]
check: unit
standard: c++20
---

Three functions that turn a list of edges into a graph. The edges arrive
**1-indexed**, as they do in a problem statement, and every function must return
0-indexed data. Each gets one of the four reading decisions wrong.

- `degrees(n, edges)` — the degree of each vertex in an **undirected** graph,
  with a self-loop contributing 2. Counts a self-loop once.
- `directed_adjacency(n, edges)` — for a **directed** graph, the list of
  out-neighbours of each vertex, in input order. Adds both directions.
- `distinct_neighbours(n, edges)` — for an undirected graph, each vertex's
  neighbours, sorted with duplicates removed. Calls `unique` without sorting
  first.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

std::vector<int> degrees(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<int> deg(n, 0);
    for (auto [u, v] : edges) {
        --u; --v;
        ++deg[u];
        if (u != v) ++deg[v];               // a self-loop contributes 2, not 1
    }
    return deg;
}

std::vector<std::vector<int>> directed_adjacency(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) {
        --u; --v;
        adj[u].push_back(v);
        adj[v].push_back(u);                // the edge only goes one way
    }
    return adj;
}

std::vector<std::vector<int>> distinct_neighbours(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) {
        --u; --v;
        adj[u].push_back(v);
        if (u != v) adj[v].push_back(u);
    }
    for (auto& list : adj)                  // unique needs a sorted range
        list.erase(std::unique(list.begin(), list.end()), list.end());
    return adj;
}
```

## Tests
```cpp
using E = std::vector<std::pair<int, int>>;
const E sample{{1, 2}, {2, 3}, {1, 2}, {3, 1}, {4, 4}, {4, 5}};

// degrees
CHECK_EQ(degrees(5, sample), (std::vector<int>{3, 3, 2, 3, 1}));
CHECK_EQ(degrees(3, E{{1, 1}}), (std::vector<int>{2, 0, 0}));
CHECK_EQ(degrees(1, E{}), (std::vector<int>{0}));
CHECK_EQ(degrees(4, E{{1, 2}, {2, 3}, {3, 4}}), (std::vector<int>{1, 2, 2, 1}));
CHECK_EQ(degrees(2, E{{1, 2}, {2, 1}}), (std::vector<int>{2, 2}));
CHECK_EQ(degrees(3, E{{1, 2}, {1, 2}, {1, 2}}), (std::vector<int>{3, 3, 0}));

// directed_adjacency
CHECK_EQ(directed_adjacency(5, sample),
         (std::vector<std::vector<int>>{{1, 1}, {2}, {0}, {3, 4}, {}}));
CHECK_EQ(directed_adjacency(4, E{{1, 2}, {2, 3}, {3, 4}}),
         (std::vector<std::vector<int>>{{1}, {2}, {3}, {}}));
CHECK_EQ(directed_adjacency(2, E{{1, 2}, {2, 1}}),
         (std::vector<std::vector<int>>{{1}, {0}}));
CHECK_EQ(directed_adjacency(3, E{{1, 2}, {1, 2}, {1, 2}}),
         (std::vector<std::vector<int>>{{1, 1, 1}, {}, {}}));
CHECK_EQ(directed_adjacency(1, E{}), (std::vector<std::vector<int>>{{}}));

// distinct_neighbours
CHECK_EQ(distinct_neighbours(5, sample),
         (std::vector<std::vector<int>>{{1, 2}, {0, 2}, {0, 1}, {3, 4}, {3}}));
CHECK_EQ(distinct_neighbours(3, E{{1, 1}}),
         (std::vector<std::vector<int>>{{0}, {}, {}}));
CHECK_EQ(distinct_neighbours(4, E{{1, 2}, {2, 3}, {3, 4}}),
         (std::vector<std::vector<int>>{{1}, {0, 2}, {1, 3}, {2}}));
CHECK_EQ(distinct_neighbours(3, E{{1, 2}, {1, 2}, {1, 2}}),
         (std::vector<std::vector<int>>{{1}, {0}, {}}));
CHECK_EQ(distinct_neighbours(1, E{}), (std::vector<std::vector<int>>{{}}));
```

## Hints
- In an undirected graph a self-loop uses up two of a vertex's edge endpoints, so it adds 2 to the degree. Drop the `if (u != v)` from `degrees` — the two `++` are the two endpoints.
- Note that the same guard is *correct* in `distinct_neighbours`, which stores neighbour lists rather than counting endpoints. The same line means different things in the two functions, which is why each needs its own decision.
- A directed edge `u → v` goes in `adj[u]` only. `directed_adjacency` should have one `push_back`.
- `std::unique` removes only *adjacent* duplicates, so it does nothing useful on an unsorted range. Sort each list first: `std::sort(list.begin(), list.end());` then `erase(unique(...), end())`.
- Sorting is also what the test expects — the neighbour lists come back in increasing order.
- The three-parallel-edges case, `{{1,2},{1,2},{1,2}}`, distinguishes all three functions at once: degrees 3 and 3, a directed list of `{1,1,1}`, and distinct neighbours `{1}`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <utility>
#include <vector>

std::vector<int> degrees(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<int> deg(n, 0);
    for (auto [u, v] : edges) {
        --u; --v;
        ++deg[u];
        ++deg[v];                           // both endpoints, even when equal
    }
    return deg;
}

std::vector<std::vector<int>> directed_adjacency(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) {
        --u; --v;
        adj[u].push_back(v);                // one direction only
    }
    return adj;
}

std::vector<std::vector<int>> distinct_neighbours(
        int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) {
        --u; --v;
        adj[u].push_back(v);
        if (u != v) adj[v].push_back(u);
    }
    for (auto& list : adj) {
        std::sort(list.begin(), list.end());              // unique needs sorted input
        list.erase(std::unique(list.begin(), list.end()), list.end());
    }
    return adj;
}
```

## Notes
Three of the four reading decisions from this chapter, one per function — and the
fourth, indexing, is already handled by the `--u; --v;` that all three share.

**A self-loop has two endpoints.** The handshake lemma — the sum of all degrees
equals twice the number of edges — is what fixes the convention, and it only
holds if a self-loop counts 2. So `degrees` has no guard, and the sum over
`{{1,1}}` is 2, matching one edge.

That the *same* guard is correct in `distinct_neighbours` is the point worth
taking away. There it prevents storing the vertex twice in its own list; here it
would undercount an endpoint. Copying a line from one graph routine to another
is how this bug travels.

**Direction is a property of the problem, not of the data structure.**
`adj[v].push_back(u)` in a directed graph invents edges that do not exist, and
the symptom is not a crash — it is a shortest path that is too short or a cycle
found where there is none. On the sample the starter reports vertex 3 (input
"3") as having an out-edge to vertex 1, which the input never stated.

Read the statement for "directed", "one-way", "→", or a story about roads that
run one way. When it is ambiguous, the sample explanation usually settles it.

**`std::unique` needs sorted input.** It removes runs of adjacent equal
elements, so on `{2, 0, 2}` it removes nothing. The erase-remove pairing is
always `sort`, then `unique`, then `erase` — chapter 4.5 has the general form.

This one is worth stating precisely because the buggy version *works on some
inputs*: a neighbour list where the duplicates happen to be adjacent, which
includes every list built from consecutive parallel edges. The sample here has
`{1, 2}` appearing twice in a row, so it comes out right; it is the interleaved
cases that fail. Tests that only exercise the easy shape are how this survives.
