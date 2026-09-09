---
id: bfs-audit
title: "Three searches in the wrong order"
difficulty: core
chapter: bfs
topics: [graphs, bfs, algorithms]
check: unit
standard: c++20
---

Three breadth-first searches over an undirected graph given as adjacency lists.
Each keeps the marking rule and breaks something else.

- `distances(g, src)` — the distance in edges from `src` to every vertex, or
  `-1` where unreachable. Takes vertices from the **back** of the container, so
  it explores depth-first and the distances are whatever path it happened to
  take.
- `nearest_source(g, sources)` — the distance from every vertex to the closest
  of several sources. Searches from the first source only.
- `count_at_distance(g, src, k)` — how many vertices are at distance exactly
  `k`. Counts everything within `k`.

## Starter
```cpp
#include <cstddef>
#include <queue>
#include <vector>

std::vector<int> distances(const std::vector<std::vector<int>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::vector<int> pending;                  // taken from the back: a stack
    dist[src] = 0;
    pending.push_back(src);
    while (!pending.empty()) {
        int v = pending.back();
        pending.pop_back();
        for (int w : g[v])
            if (dist[w] == -1) { dist[w] = dist[v] + 1; pending.push_back(w); }
    }
    return dist;
}

std::vector<int> nearest_source(const std::vector<std::vector<int>>& g,
                                const std::vector<int>& sources) {
    std::vector<int> dist(g.size(), -1);
    std::queue<int> q;
    if (!sources.empty()) { dist[sources[0]] = 0; q.push(sources[0]); }  // only one
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (int w : g[v])
            if (dist[w] == -1) { dist[w] = dist[v] + 1; q.push(w); }
    }
    return dist;
}

int count_at_distance(const std::vector<std::vector<int>>& g, int src, int k) {
    std::vector<int> dist = distances(g, src);
    int total = 0;
    for (int d : dist)
        if (d != -1 && d <= k) ++total;        // "exactly k", not "within k"
    return total;
}
```

## Tests
```cpp
using G = std::vector<std::vector<int>>;

// 0-1-2-3 and 0-4-5
const G tree{{1, 4}, {0, 2}, {1, 3}, {2}, {0, 5}, {4}};

// distances
CHECK_EQ(distances(tree, 0), (std::vector<int>{0, 1, 2, 3, 1, 2}));
CHECK_EQ(distances(G{{1}, {0}, {3}, {2}}, 0), (std::vector<int>{0, 1, -1, -1}));
CHECK_EQ(distances(G{{}}, 0), (std::vector<int>{0}));
CHECK_EQ(distances(G{{1, 2}, {0, 2}, {0, 1}, {4}, {3}}, 0),
         (std::vector<int>{0, 1, 1, -1, -1}));
CHECK_EQ(distances(G{{1, 2}, {0, 2}, {0, 1}}, 0), (std::vector<int>{0, 1, 1}));
// A five-cycle: a depth-first walk reaches vertex 2 the long way round.
CHECK_EQ(distances(G{{1, 4}, {0, 2}, {1, 3}, {2, 4}, {3, 0}}, 0),
         (std::vector<int>{0, 1, 2, 2, 1}));

// nearest_source
CHECK_EQ(nearest_source(tree, {0, 5}), (std::vector<int>{0, 1, 2, 3, 1, 0}));
CHECK_EQ(nearest_source(G{{1}, {0}, {3}, {2}}, {0, 3}), (std::vector<int>{0, 1, 1, 0}));
CHECK_EQ(nearest_source(G{{}}, {0}), (std::vector<int>{0}));
CHECK_EQ(nearest_source(G{{1, 2}, {0, 2}, {0, 1}, {4}, {3}}, {0, 4}),
         (std::vector<int>{0, 1, 1, 1, 0}));
CHECK_EQ(nearest_source(G{{1, 2}, {0, 2}, {0, 1}}, {0, 2}),
         (std::vector<int>{0, 1, 0}));

// count_at_distance
CHECK_EQ(count_at_distance(tree, 0, 0), 1);
CHECK_EQ(count_at_distance(tree, 0, 1), 2);
CHECK_EQ(count_at_distance(tree, 0, 2), 2);
CHECK_EQ(count_at_distance(tree, 0, 3), 1);
CHECK_EQ(count_at_distance(tree, 0, 4), 0);
CHECK_EQ(count_at_distance(G{{1, 2}, {0, 2}, {0, 1}}, 0, 1), 2);
CHECK_EQ(count_at_distance(G{{1}, {0}, {3}, {2}}, 0, 1), 1);
```

## Hints
- A queue is what makes the search breadth-first. Taking from the *back* of a vector makes it a stack, and a depth-first walk records the length of whatever path it wandered down — not the shortest.
- On a *tree* the two agree, because there is only one path between any two vertices. The five-cycle test is the one that separates them: going round the long way reaches vertex 2 at distance 3 instead of 2.
- `std::queue<int>` with `front()` and `pop()` is the fix; the marking rule in the starter is already right.
- `nearest_source` should push **every** source, each at distance 0, before the loop begins. That is the only change: the loop body is identical.
- Pushing all the sources is the same as adding one virtual vertex joined to all of them; the queue still holds a non-decreasing run of distances, so the invariant survives.
- `count_at_distance` asks for exactly `k`, so the test is `d == k`. Note that `d != -1` then becomes unnecessary, since `-1` is never equal to a non-negative `k` — but leaving it costs nothing and says what you mean.
- `count_at_distance(tree, 0, 0)` is 1: the source is at distance 0 from itself.

## Solution
```cpp
#include <cstddef>
#include <queue>
#include <vector>

std::vector<int> distances(const std::vector<std::vector<int>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::queue<int> q;                         // first in, first out
    dist[src] = 0;
    q.push(src);
    while (!q.empty()) {
        int v = q.front();
        q.pop();
        for (int w : g[v])
            if (dist[w] == -1) { dist[w] = dist[v] + 1; q.push(w); }
    }
    return dist;
}

std::vector<int> nearest_source(const std::vector<std::vector<int>>& g,
                                const std::vector<int>& sources) {
    std::vector<int> dist(g.size(), -1);
    std::queue<int> q;
    for (int s : sources) { dist[s] = 0; q.push(s); }    // every source at once
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (int w : g[v])
            if (dist[w] == -1) { dist[w] = dist[v] + 1; q.push(w); }
    }
    return dist;
}

int count_at_distance(const std::vector<std::vector<int>>& g, int src, int k) {
    std::vector<int> dist = distances(g, src);
    int total = 0;
    for (int d : dist)
        if (d == k) ++total;                   // exactly
    return total;
}
```

## Notes
**The container is the algorithm.** Change `std::queue` to a stack and the code
still terminates, still visits every reachable vertex, still marks each once —
and computes something that is not the distance.

What makes this hard to catch is that on a **tree** the two agree exactly, since
there is a single path between any two vertices, so the six-vertex test above
passes either way. It takes a cycle to separate them: on
`{{1,4},{0,2},{1,3},{2,4},{3,0}}` the stack walks 0 → 4 → 3 → 2 and records
vertex 2 at distance 3, where the true distance is 2. Nothing about the output
looks wrong; the numbers are simply too large.

That is why BFS and DFS are usually written as the same loop with a different
container, and why the container deserves a comment. A stack gives a depth-first
walk, which is the right tool for connectivity, cycle detection and topological
order (chapters 10.18 and 10.19) and the wrong one for distance.

**Multi-source BFS is a one-line change.** Seeding the queue with every source
at distance 0 gives, for every vertex, the distance to the *nearest* of them.
The reason it is correct is the queue invariant: all the seeds share a distance,
so the queue is still a non-decreasing run, and everything downstream follows.
Nothing else in the loop changes.

Running one search per source and taking the minimum is also correct and costs a
factor of the number of sources — chapter 10.17 measures 23 ms against 996 ms
for forty of them.

**"Exactly k" is not "at most k".** The starter's `d <= k` is the answer to a
different question, and on a graph where most vertices are near the source the
two agree closely enough to look right. `count_at_distance(tree, 0, 4) == 0` is
the case that separates them: nothing is that far, and the starter reports 6.

A small point worth noticing: with `d == k` the guard `d != -1` becomes
redundant, because `k` is non-negative and `-1` never equals it. Redundant
guards are usually worth keeping when they document an assumption — but here the
assumption is about `k`, so if `k` could ever be negative the guard is the only
thing standing between you and a wrong answer. Decide which it is.
