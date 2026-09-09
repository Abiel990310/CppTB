---
id: topo-audit
title: "Three orders that are not quite topological"
difficulty: core
chapter: topological-order
topics: [graphs, topological-sort, algorithms]
check: unit
standard: c++20
---

Three routines over a directed graph. Each runs Kahn's algorithm correctly and
then misreads the result.

- `topological_order(n, g)` — any valid order, or an empty vector when the graph
  has a cycle. Returns whatever partial order it managed instead.
- `smallest_topological_order(n, g)` — the lexicographically smallest valid
  order, or empty when cyclic. Takes whatever is ready first rather than the
  smallest.
- `longest_chain(n, g)` — the number of **vertices** on the longest path, or
  `-1` when cyclic. Counts edges.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <functional>
#include <queue>
#include <vector>

std::vector<int> topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];

    std::queue<int> ready;
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    return order;                        // ... even when it is short
}

std::vector<int> smallest_topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];

    std::queue<int> ready;               // first ready, not smallest ready
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    if (static_cast<int>(order.size()) != n) return {};
    return order;
}

int longest_chain(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> order = topological_order(n, g);
    if (static_cast<int>(order.size()) != n) return -1;

    std::vector<int> best(n, 0);         // edges, not vertices
    int answer = 0;
    for (int v : order)
        for (int w : g[v]) {
            best[w] = std::max(best[w], best[v] + 1);
            answer = std::max(answer, best[w]);
        }
    return answer;
}
```

## Tests
```cpp
using G = std::vector<std::vector<int>>;

// topological_order
CHECK_EQ(topological_order(5, G{{1, 2}, {3}, {3, 4}, {}, {}}),
         (std::vector<int>{0, 1, 2, 3, 4}));
CHECK_EQ(topological_order(3, G{{1}, {2}, {0}}), (std::vector<int>{}));  // a cycle
CHECK_EQ(topological_order(1, G{{}}), (std::vector<int>{0}));
CHECK_EQ(topological_order(4, G{{}, {0}, {1}, {2}}), (std::vector<int>{3, 2, 1, 0}));
CHECK_EQ(topological_order(2, G{{}, {}}), (std::vector<int>{0, 1}));
CHECK_EQ(topological_order(2, G{{0}, {}}), (std::vector<int>{}));        // a self-loop

// smallest_topological_order
CHECK_EQ(smallest_topological_order(4, G{{2}, {2}, {3}, {}}),
         (std::vector<int>{0, 1, 2, 3}));
// 2 and 0 are ready at the start; the smaller must come first.
CHECK_EQ(smallest_topological_order(4, G{{1}, {3}, {}, {}}),
         (std::vector<int>{0, 1, 2, 3}));
CHECK_EQ(smallest_topological_order(3, G{{}, {}, {0}}), (std::vector<int>{1, 2, 0}));
CHECK_EQ(smallest_topological_order(3, G{{1}, {2}, {0}}), (std::vector<int>{}));
CHECK_EQ(smallest_topological_order(1, G{{}}), (std::vector<int>{0}));

// longest_chain
CHECK_EQ(longest_chain(5, G{{1, 2}, {3}, {3, 4}, {}, {}}), 3);
CHECK_EQ(longest_chain(4, G{{2}, {2}, {3}, {}}), 3);
CHECK_EQ(longest_chain(1, G{{}}), 1);
CHECK_EQ(longest_chain(2, G{{}, {}}), 1);
CHECK_EQ(longest_chain(4, G{{}, {0}, {1}, {2}}), 4);
CHECK_EQ(longest_chain(3, G{{1}, {2}, {0}}), -1);
CHECK_EQ(longest_chain(4, G{{1, 2, 3}, {3}, {3}, {}}), 3);
```

## Hints
- Kahn's loop stops when nothing is ready, which on a cyclic graph happens early. Check `order.size() != n` and return `{}` — that check *is* the cycle test.
- `{{0}}` — a single vertex with a self-loop — is a cycle, and its in-degree never reaches zero.
- For the smallest order, replace the queue with `std::priority_queue<int, std::vector<int>, std::greater<>>`, which pops the smallest ready vertex. Everything else is identical.
- `std::priority_queue` is a max-heap by default, so the `std::greater<>` comparator is what turns it around — and it is why the type needs all three template arguments.
- A path with `k` edges visits `k + 1` vertices. `longest_chain` of a single vertex with no edges is 1, not 0.
- Seeding `best` with 1 rather than 0 makes the count come out in vertices, and then the answer for an edgeless graph is 1 without a special case.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <functional>
#include <queue>
#include <vector>

std::vector<int> topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];

    std::queue<int> ready;
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    if (static_cast<int>(order.size()) != n) return {};   // short means cyclic
    return order;
}

std::vector<int> smallest_topological_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];

    std::priority_queue<int, std::vector<int>, std::greater<>> ready;   // min-heap
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.top(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    if (static_cast<int>(order.size()) != n) return {};
    return order;
}

int longest_chain(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> order = topological_order(n, g);
    if (order.empty() && n > 0) return -1;

    std::vector<int> best(n, 1);         // one vertex is a chain of length 1
    int answer = n > 0 ? 1 : 0;
    for (int v : order)
        for (int w : g[v]) {
            best[w] = std::max(best[w], best[v] + 1);
            answer = std::max(answer, best[w]);
        }
    return answer;
}
```

## Notes
**A short output is the answer, not a partial result.** Kahn emits a vertex when
its in-degree reaches zero, and a vertex on a cycle always retains at least one
incoming edge from within that cycle — so it never becomes ready, and neither
does anything downstream of it. The count is therefore an exact cycle test, and
it costs one comparison.

Returning the partial order instead is the kind of bug that produces something
that *looks* like an answer. On `0→1→2→0` the starter returns an empty vector by
luck, since nothing is ever ready; on a graph with a cycle hanging off an
acyclic prefix it returns the prefix, which is a valid order of a different
graph.

**Ready is not a set of one.** The queue and the heap differ only in which of
the currently-ready vertices comes next, and both give valid orders — the
difference is only visible when the problem asks for a *specific* order. The
greedy is correct for the lexicographically smallest one by an exchange argument
(chapter 10.13): none of the ready vertices depends on another, so placing the
smallest first can never block anything.

`std::priority_queue<int, std::vector<int>, std::greater<>>` is the min-heap
spelling. The default is a max-heap, which would give the lexicographically
*largest* order — occasionally what a problem wants, and never what it wants by
accident.

**Edges or vertices is a question, not a convention.** A path through `k`
vertices has `k − 1` edges, and problems ask for both. Seeding `best` with 1
counts vertices; seeding with 0 counts edges. The single-vertex case pins it
down: `longest_chain(1, {{}})` is 1 as a vertex count and 0 as an edge count,
and neither is more correct than the other — the statement decides.

Note the guard in the solution: `order.empty() && n > 0`. An empty graph
(`n == 0`) legitimately produces an empty order, so "empty means cyclic" needs
that qualification. It is the sort of edge case a judge includes precisely
because it separates a copied answer from a considered one.
