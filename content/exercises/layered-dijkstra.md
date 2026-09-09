---
id: layered-dijkstra
title: "When the vertex is not a place"
difficulty: stretch
chapter: dijkstra
topics: [graphs, dijkstra, state-space, algorithms]
check: unit
standard: c++20
---

Two Dijkstra variants where the search is over something other than the plain
graph. Each has one bug.

- `cheapest_with_free_edges(g, src, dst, k)` — the cheapest route from `src` to
  `dst` when at most `k` edges may be taken for free, or `-1` if `dst` is
  unreachable. The graph is layered by "free moves used so far"; the answer is
  read from the last layer only, rather than the best of all of them.
- `min_max_edge(g, src, dst)` — the smallest possible value of the *largest*
  edge on a route from `src` to `dst`, or `-1` if unreachable. Adds the weights
  instead of taking their maximum.

Weights are non-negative.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

using Graph = std::vector<std::vector<std::pair<int, long long>>>;   // (to, weight)
const long long INF = std::numeric_limits<long long>::max() / 4;

long long cheapest_with_free_edges(const Graph& g, int src, int dst, int k) {
    int n = static_cast<int>(g.size());
    auto id = [n](int v, int used) { return used * n + v; };

    std::vector<long long> dist(static_cast<std::size_t>(n) * (k + 1), INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    dist[id(src, 0)] = 0;
    pq.emplace(0, id(src, 0));

    while (!pq.empty()) {
        auto [d, s] = pq.top(); pq.pop();
        if (d != dist[s]) continue;
        int v = s % n, used = s / n;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[id(to, used)]) {
                dist[id(to, used)] = d + w;
                pq.emplace(dist[id(to, used)], id(to, used));
            }
            if (used < k && d < dist[id(to, used + 1)]) {
                dist[id(to, used + 1)] = d;
                pq.emplace(d, id(to, used + 1));
            }
        }
    }

    long long best = dist[id(dst, k)];        // only the layer where all k were used
    return best >= INF ? -1 : best;
}

long long min_max_edge(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> best(n, INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    best[src] = 0;
    pq.emplace(0, src);

    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != best[v]) continue;
        for (auto [to, w] : g[v]) {
            long long candidate = d + w;      // the cost of a route, not its worst edge
            if (candidate < best[to]) {
                best[to] = candidate;
                pq.emplace(candidate, to);
            }
        }
    }
    return best[dst] >= INF ? -1 : best[dst];
}
```

## Tests
```cpp
// 0 ->1 (1), 1 ->2 (50), 2 ->3 (1)
const Graph road{{{1, 1}}, {{2, 50}}, {{3, 1}}, {}};

// cheapest_with_free_edges
CHECK_EQ(cheapest_with_free_edges(road, 0, 3, 0), 52LL);
CHECK_EQ(cheapest_with_free_edges(road, 0, 3, 1), 2LL);
CHECK_EQ(cheapest_with_free_edges(road, 0, 3, 2), 1LL);
CHECK_EQ(cheapest_with_free_edges(road, 0, 3, 3), 0LL);
CHECK_EQ(cheapest_with_free_edges(Graph{{{1, 7}}, {}}, 0, 1, 0), 7LL);
CHECK_EQ(cheapest_with_free_edges(Graph{{{1, 7}}, {}}, 0, 1, 1), 0LL);
CHECK_EQ(cheapest_with_free_edges(Graph{{}}, 0, 0, 2), 0LL);      // already there
CHECK_EQ(cheapest_with_free_edges(Graph{{}, {}}, 0, 1, 2), -1LL); // no route
CHECK_EQ(cheapest_with_free_edges(Graph{{{2, 9}, {1, 1}}, {{2, 1}}, {}}, 0, 2, 1), 0LL);

// min_max_edge
CHECK_EQ(min_max_edge(road, 0, 3), 50LL);
// The direct edge is 7; going round uses edges of 3 and 4.
CHECK_EQ(min_max_edge(Graph{{{1, 3}, {2, 7}}, {{2, 4}}, {}}, 0, 2), 4LL);
CHECK_EQ(min_max_edge(Graph{{{1, 5}}, {{2, 5}}, {}}, 0, 2), 5LL);
CHECK_EQ(min_max_edge(Graph{{}}, 0, 0), 0LL);
CHECK_EQ(min_max_edge(Graph{{}, {}}, 0, 1), -1LL);
CHECK_EQ(min_max_edge(Graph{{{1, 1}, {2, 100}}, {{2, 2}}, {}}, 0, 2), 2LL);
```

## Hints
- Using a free move is never worse than paying, so a route may finish having used fewer than `k` of them — especially when it is shorter than `k` edges long.
- Take the minimum of `dist[id(dst, used)]` over every `used` from 0 to `k`.
- `cheapest_with_free_edges(g, 0, 0, 2)` is the case that says so: you are already at the destination, no edges are used at all, and the answer is 0 — which lives in layer 0.
- `min_max_edge` optimises the worst edge on the route, so the value carried is `std::max(d, w)`, not `d + w`. Everything else about the search is unchanged.
- That substitution is general: Dijkstra works for any edge cost combined by an operation that is monotone — never decreasing as you extend the path — and `max` qualifies just as `+` does.
- `min_max_edge(g, v, v)` is 0: a route of no edges has no largest edge, and 0 is the identity for `max` over non-negative weights.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

using Graph = std::vector<std::vector<std::pair<int, long long>>>;
const long long INF = std::numeric_limits<long long>::max() / 4;

long long cheapest_with_free_edges(const Graph& g, int src, int dst, int k) {
    int n = static_cast<int>(g.size());
    auto id = [n](int v, int used) { return used * n + v; };

    std::vector<long long> dist(static_cast<std::size_t>(n) * (k + 1), INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    dist[id(src, 0)] = 0;
    pq.emplace(0, id(src, 0));

    while (!pq.empty()) {
        auto [d, s] = pq.top(); pq.pop();
        if (d != dist[s]) continue;
        int v = s % n, used = s / n;
        for (auto [to, w] : g[v]) {
            if (d + w < dist[id(to, used)]) {                  // pay for the edge
                dist[id(to, used)] = d + w;
                pq.emplace(dist[id(to, used)], id(to, used));
            }
            if (used < k && d < dist[id(to, used + 1)]) {      // or take it free
                dist[id(to, used + 1)] = d;
                pq.emplace(d, id(to, used + 1));
            }
        }
    }

    long long best = INF;
    for (int used = 0; used <= k; ++used)                      // any layer will do
        best = std::min(best, dist[id(dst, used)]);
    return best >= INF ? -1 : best;
}

long long min_max_edge(const Graph& g, int src, int dst) {
    int n = static_cast<int>(g.size());
    std::vector<long long> best(n, INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    best[src] = 0;
    pq.emplace(0, src);

    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != best[v]) continue;
        for (auto [to, w] : g[v]) {
            long long candidate = std::max(d, w);              // the worst edge so far
            if (candidate < best[to]) {
                best[to] = candidate;
                pq.emplace(candidate, to);
            }
        }
    }
    return best[dst] >= INF ? -1 : best[dst];
}
```

## Notes
**"At most k" means every layer is an answer.** The layered graph has `k + 1`
copies and a route may end in any of them: using a free move is optional, and a
short route may not even have `k` edges to spend them on. Reading only
`dist[dst][k]` answers "using exactly `k` free moves", which is a different and
usually unsatisfiable question — `cheapest_with_free_edges(g, 0, 0, 2)` has no
edges at all, so layer 2 is unreachable and the starter reports −1 where the
answer is 0.

There is a second way to write it that avoids the question: add a zero-cost edge
from `(dst, used)` to `(dst, used + 1)` for every `used`, so every route can
drift up to the top layer for free, and then read layer `k`. Both are correct;
taking the minimum is fewer lines and states the intent.

The encoding `used * n + v` is the standard flattening — the same
`row * cols + col` from chapter 10.16, with "layer" in place of "row". The
inverse is `v = s % n`, `used = s / n`, and getting those two the wrong way round
is the usual slip.

**Dijkstra is not tied to addition.** The relaxation `candidate = combine(d, w)`
works for any combining operation that is *monotone*: extending a path never
makes the value smaller. `+` on non-negative weights qualifies; so does `max`,
which gives the bottleneck path — the route whose worst edge is as good as
possible.

That variant answers a family of real questions: the heaviest lorry that can
cross a road network, the widest bandwidth path, the minimum spanning tree's
path between two vertices (which is exactly the bottleneck path — chapter 10.23).
Multiplication of probabilities in `[0, 1]` with a *max*-heap is the same idea
run the other way.

What does **not** work is a combining rule that can decrease — subtraction, or
addition with negative weights. That is the same precondition as chapter 10.21's
counterexample, stated in more general terms.

**On the cost.** The layered version has `(k+1)·n` vertices and `2(k+1)·m`
edges, so it costs a factor of `k + 1` in both time and memory. Problems that
intend this keep `k` small — 10 or so — and say so in the constraints. If `k`
were 10⁵ the intended solution would be something else.
