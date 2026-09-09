---
title: "Dijkstra"
navTitle: "Dijkstra"
summary: >-
  A heap, a distance array, and one line of lazy deletion — plus the reason it
  needs non-negative weights, demonstrated rather than asserted.
objectives:
  - Write Dijkstra with a priority queue and lazy deletion
  - Explain why a negative edge breaks it, with a four-vertex counterexample
  - Reconstruct a shortest path and count how many there are
  - Layer the graph to answer "with at most k free moves"
status: complete
standard: c++20
requires: [union-find]
---

BFS finds shortest paths when every edge costs the same. Dijkstra finds them
when the costs differ and are non-negative, by always expanding the closest
unfinished vertex — a greedy choice (chapter 10.13) whose exchange argument is
exactly the non-negativity.

## The algorithm

```cpp run title="Lazy deletion, cross-checked against Bellman-Ford"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <limits>
#include <queue>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

struct Edge { int to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;

long long pushes = 0, pops = 0, stale = 0;

// Lazy deletion: a vertex may sit in the heap several times, and every copy but
// the first to come out is discarded.
std::vector<long long> dijkstra(const std::vector<std::vector<Edge>>& g, int src) {
    std::vector<long long> dist(g.size(), INF);
    using Item = std::pair<long long, int>;                // (distance, vertex)
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    dist[src] = 0;
    pq.emplace(0, src);
    ++pushes;

    while (!pq.empty()) {
        auto [d, v] = pq.top();
        pq.pop();
        ++pops;
        if (d != dist[v]) { ++stale; continue; }           // an out-of-date copy
        for (Edge e : g[v])
            if (d + e.weight < dist[e.to]) {
                dist[e.to] = d + e.weight;
                pq.emplace(dist[e.to], e.to);
                ++pushes;
            }
    }
    return dist;
}

// Bellman-Ford: relax every edge n-1 times. Slow and obviously correct.
std::vector<long long> bellman_ford(const std::vector<std::vector<Edge>>& g, int src) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round < n - 1; ++round)
        for (int v = 0; v < n; ++v)
            if (dist[v] < INF)
                for (Edge e : g[v])
                    dist[e.to] = std::min(dist[e.to], dist[v] + e.weight);
    return dist;
}

int main() {
    std::mt19937 rng(120);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<std::vector<Edge>> g(n);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 40)
                    g[u].push_back({v, static_cast<long long>(rng() % 20)});
        if (dijkstra(g, 0) != bellman_ford(g, 0)) ok = false;
    }
    std::printf("2000 random non-negative graphs agree with Bellman-Ford: %s\n",
                ok ? "yes" : "NO");

    const int n = 100'000, m = 300'000;
    std::vector<std::vector<Edge>> g(n);
    for (int i = 0; i < m; ++i) {
        int u = static_cast<int>(rng() % n), v = static_cast<int>(rng() % n);
        long long w = 1 + static_cast<long long>(rng() % 1'000'000);
        g[u].push_back({v, w});
        g[v].push_back({u, w});
    }

    pushes = pops = stale = 0;
    auto t0 = std::chrono::steady_clock::now();
    std::vector<long long> d = dijkstra(g, 0);
    double ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();

    long long reached = 0, farthest = 0;
    for (long long x : d) if (x < INF) { ++reached; farthest = std::max(farthest, x); }
    keep(d);
    std::printf("n = %d, %d edges: %.1f ms, %lld reached, farthest %lld\n",
                n, 2 * m, ms, reached, farthest);
    std::printf("  heap pushes %lld, pops %lld, of which stale %lld (%.0f%%)\n",
                pushes, pops, stale, 100.0 * static_cast<double>(stale) / static_cast<double>(pops));
}
```

2,000 random graphs agree with a relax-everything reference, and on 100,000
vertices with 600,000 edges the search takes 1.26 seconds — 157,718 heap pushes,
of which 37% come out stale.

That last number is what the `if (d != dist[v]) continue;` line is for.

**C++ has no decrease-key on `std::priority_queue`**, so when a vertex's distance
improves we push a *second* copy rather than adjusting the first. Every copy but
the best is garbage, and the guard discards it in O(1) when it surfaces. The
cost is a heap of up to `m` entries instead of `n`; the benefit is that the whole
thing is fifteen lines of standard library.

Four details worth stating:

- **`std::greater<>` makes the min-heap.** `std::priority_queue` is a max-heap by
  default, which would expand the *farthest* vertex first and compute nothing
  useful.
- **The pair is `(distance, vertex)`, in that order**, because pairs compare on
  the first element.
- **`INF` is `max() / 4`, not `max()`.** `dist[v] + weight` must not overflow,
  and a quarter of the range leaves room for any sum that can arise.
- **Relax, then push.** The `if (d + e.weight < dist[e.to])` test is what keeps
  the heap from filling with useless copies; without it every edge pushes.

## Why the weights must be non-negative

```cpp run title="A four-vertex counterexample"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <queue>
#include <vector>

struct Edge { int to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;

long long relaxations = 0;

// The textbook form: once a vertex is popped it is final and never revisited.
std::vector<long long> dijkstra_final(const std::vector<std::vector<Edge>>& g, int src) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    std::vector<char> done(n, 0);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (done[v]) continue;
        done[v] = 1;                                   // v is now frozen
        for (Edge e : g[v])
            if (d + e.weight < dist[e.to]) { dist[e.to] = d + e.weight; pq.emplace(dist[e.to], e.to); }
    }
    return dist;
}

// The lazy form: no "done" flag, so a vertex can be improved after it is popped.
std::vector<long long> dijkstra_lazy(const std::vector<std::vector<Edge>>& g, int src) {
    std::vector<long long> dist(g.size(), INF);
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (Edge e : g[v]) {
            ++relaxations;
            if (d + e.weight < dist[e.to]) { dist[e.to] = d + e.weight; pq.emplace(dist[e.to], e.to); }
        }
    }
    return dist;
}

std::vector<long long> bellman_ford(const std::vector<std::vector<Edge>>& g, int src) {
    int n = static_cast<int>(g.size());
    std::vector<long long> dist(n, INF);
    dist[src] = 0;
    for (int round = 0; round < n - 1; ++round)
        for (int v = 0; v < n; ++v)
            if (dist[v] < INF)
                for (Edge e : g[v])
                    dist[e.to] = std::min(dist[e.to], dist[v] + e.weight);
    return dist;
}

int main() {
    // 0->1 costs 1, 0->2 costs 5, 2->1 costs -10, 1->3 costs 1.
    // The cheap route to 3 goes 0 -> 2 -> 1 -> 3 and costs -4.
    std::vector<std::vector<Edge>> g(4);
    g[0].push_back({1, 1});
    g[0].push_back({2, 5});
    g[2].push_back({1, -10});
    g[1].push_back({3, 1});

    std::vector<long long> a = dijkstra_final(g, 0);
    std::vector<long long> b = dijkstra_lazy(g, 0);
    std::vector<long long> c = bellman_ford(g, 0);
    std::printf("vertex   frozen-Dijkstra   lazy-Dijkstra   Bellman-Ford\n");
    for (int v = 0; v < 4; ++v)
        std::printf("  %d           %4lld            %4lld           %4lld%s\n",
                    v, a[v], b[v], c[v], a[v] == c[v] ? "" : "   <-- wrong");

    std::printf("\nThe frozen form pops vertex 1 at distance 1 and freezes it, then\n"
                "pops vertex 2 and lowers dist[1] to -5 -- too late to re-propagate\n"
                "through the edge 1 -> 3, which keeps the stale value 2.\n");

    // The lazy form gets away with it here -- by doing more work.
    relaxations = 0;
    dijkstra_lazy(g, 0);
    std::printf("lazy form on this 4-vertex graph: %lld edge relaxations for 4 edges\n",
                relaxations);

    std::vector<std::vector<Edge>> h(4);
    h[0].push_back({1, 1});
    h[0].push_back({2, 5});
    h[2].push_back({1, 10});
    h[1].push_back({3, 1});
    relaxations = 0;
    dijkstra_lazy(h, 0);
    std::printf("same shape with that edge at +10:  %lld relaxations\n", relaxations);
    std::printf("all three agree once the weight is non-negative: %s\n",
                (dijkstra_final(h, 0) == bellman_ford(h, 0) &&
                 dijkstra_lazy(h, 0) == bellman_ford(h, 0)) ? "yes" : "no");
}
```

The frozen form answers 2 for vertex 3 where the true distance is −4.

Trace it. Vertex 1 is popped at distance 1 and frozen; its edge to 3 sets
`dist[3] = 2`. Only later does vertex 2 come out at distance 5 and lower
`dist[1]` to −5 — correct, but too late, because vertex 1 will never be expanded
again and the improvement never reaches vertex 3.

**Dijkstra's correctness argument is that the closest unfinished vertex cannot
be improved later**, since any route to it through an unfinished vertex would
have to be at least as long. That is true exactly when no edge is negative, and
it is why non-negativity is a precondition rather than a convenience.

Note what the *lazy* form does here: with no `done` flag, a vertex is
re-expanded whenever its distance falls, so it happens to produce the right
answer — 5 edge relaxations for 4 edges, against 4 when the negative edge is
removed. That is not Dijkstra any more; it is a heap-ordered Bellman-Ford, and
on an adversarial graph it can re-expand vertices many times over. **If the
weights can be negative, use Bellman–Ford** (chapter 10.22), which also detects
negative cycles — something no version of this loop can do.

## Paths, and how many

```cpp run title="Reconstruction and counting, in the same pass"
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <queue>
#include <random>
#include <vector>

struct Edge { int to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;
const std::uint64_t MOD = 1'000'000'007;

// Distances, a parent for reconstruction, and how many shortest routes there are.
struct Result {
    std::vector<long long> dist;
    std::vector<int> parent;
    std::vector<std::uint64_t> ways;
};

Result dijkstra(const std::vector<std::vector<Edge>>& g, int src) {
    int n = static_cast<int>(g.size());
    Result r{std::vector<long long>(n, INF), std::vector<int>(n, -1),
             std::vector<std::uint64_t>(n, 0)};
    using Item = std::pair<long long, int>;
    std::priority_queue<Item, std::vector<Item>, std::greater<>> pq;

    r.dist[src] = 0;
    r.ways[src] = 1;
    pq.emplace(0, src);

    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != r.dist[v]) continue;
        for (Edge e : g[v]) {
            long long candidate = d + e.weight;
            if (candidate < r.dist[e.to]) {
                r.dist[e.to] = candidate;
                r.parent[e.to] = v;
                r.ways[e.to] = r.ways[v];              // a strictly better route
                pq.emplace(candidate, e.to);
            } else if (candidate == r.dist[e.to]) {
                r.ways[e.to] = (r.ways[e.to] + r.ways[v]) % MOD;   // another equally good one
            }
        }
    }
    return r;
}

std::vector<int> path_to(const Result& r, int dst) {
    if (r.dist[dst] >= INF) return {};
    std::vector<int> path;
    for (int v = dst; v != -1; v = r.parent[v]) path.push_back(v);
    std::reverse(path.begin(), path.end());
    return path;
}

// Reference: enumerate every simple path and keep the cheapest.
void walk(const std::vector<std::vector<Edge>>& g, int v, int dst, long long cost,
          std::vector<char>& on_path, long long& best, long long& count) {
    if (v == dst) {
        if (cost < best) { best = cost; count = 1; }
        else if (cost == best) ++count;
        return;
    }
    for (Edge e : g[v])
        if (!on_path[e.to]) {
            on_path[e.to] = 1;
            walk(g, e.to, dst, cost + e.weight, on_path, best, count);
            on_path[e.to] = 0;
        }
}

int main() {
    // Two equally short routes from 0 to 3, and a longer one.
    std::vector<std::vector<Edge>> g(4);
    g[0].push_back({1, 1}); g[1].push_back({3, 2});
    g[0].push_back({2, 2}); g[2].push_back({3, 1});
    g[0].push_back({3, 7});

    Result r = dijkstra(g, 0);
    std::printf("dist to 3 = %lld, shortest routes = %llu\n",
                r.dist[3], static_cast<unsigned long long>(r.ways[3]));
    std::printf("one of them:");
    for (int v : path_to(r, 3)) std::printf(" %d", v);
    std::printf("\n");

    std::mt19937 rng(130);
    bool ok = true;
    for (int trial = 0; trial < 1500; ++trial) {
        int n = 2 + static_cast<int>(rng() % 6);
        std::vector<std::vector<Edge>> h(n);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 40)
                    h[u].push_back({v, 1 + static_cast<long long>(rng() % 5)});
        Result q = dijkstra(h, 0);
        for (int t = 1; t < n; ++t) {
            long long best = INF, count = 0;
            std::vector<char> on_path(n, 0);
            on_path[0] = 1;
            walk(h, 0, t, 0, on_path, best, count);
            if (q.dist[t] != best) ok = false;
            if (best < INF && q.ways[t] != static_cast<std::uint64_t>(count)) ok = false;
            // The reconstructed path must exist and cost what it claims.
            std::vector<int> p = path_to(q, t);
            if (best < INF) {
                long long total = 0;
                for (std::size_t i = 1; i < p.size(); ++i) {
                    long long w = INF;
                    for (Edge e : h[p[i - 1]]) if (e.to == p[i]) w = std::min(w, e.weight);
                    total += w;
                }
                if (total != best) ok = false;
            }
        }
    }
    std::printf("1500 random graphs: distances, counts and reconstructed paths all "
                "agree with brute force: %s\n", ok ? "yes" : "NO");
}
```

Two shortest routes of length 3 from vertex 0 to vertex 3, one of them
reconstructed, and 1,500 random graphs agreeing with an exhaustive walk over
simple paths.

Both extras ride along on the relaxation, and the shape is worth memorising:

```cpp
if (candidate <  dist[to]) { dist[to] = candidate; parent[to] = v; ways[to] = ways[v]; }
else if (candidate == dist[to])                                    ways[to] += ways[v];
```

- **Strictly better** replaces everything: the distance, the parent, and the
  count, because the old routes are no longer shortest.
- **Equally good** adds to the count and leaves the parent alone. Any one parent
  will do if the problem wants *a* shortest path; keeping a list of them gives
  the shortest-path DAG, which is what "count them" or "find the one with fewest
  edges" needs.

`parent` reconstructs the path backwards from the destination, so the result is
reversed at the end. `parent[src] == -1` terminates the walk, which is why −1 is
the initial value rather than `src` itself.

The count needs a modulus for the same reason chapter 10.19's path counting did:
the number of shortest routes can be exponential in the number of vertices.

## Layering the graph

Many problems are Dijkstra on a graph that is not quite the one in the input.
"At most `k` free moves" is the standard example: make `k + 1` copies of the
graph and let a free move step between layers.

```cpp run title="k free edges, by copying the graph k+1 times"
#include <algorithm>
#include <cstdio>
#include <limits>
#include <queue>
#include <random>
#include <vector>

struct Edge { int to; long long weight; };
const long long INF = std::numeric_limits<long long>::max() / 4;

// The graph is copied k+1 times. State (v, used) means "at v, having made
// `used` of the k free moves". A free move steps between layers at zero cost.
long long cheapest_with_free_edges(const std::vector<std::vector<Edge>>& g,
                                   int src, int dst, int k) {
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
        for (Edge e : g[v]) {
            if (d + e.weight < dist[id(e.to, used)]) {          // pay for it
                dist[id(e.to, used)] = d + e.weight;
                pq.emplace(dist[id(e.to, used)], id(e.to, used));
            }
            if (used < k && d < dist[id(e.to, used + 1)]) {     // or take it free
                dist[id(e.to, used + 1)] = d;
                pq.emplace(d, id(e.to, used + 1));
            }
        }
    }

    long long best = INF;
    for (int used = 0; used <= k; ++used) best = std::min(best, dist[id(dst, used)]);
    return best;
}

// Reference: every simple path, with every choice of which edges to take free.
void walk(const std::vector<std::vector<Edge>>& g, int v, int dst, int k,
          long long cost, std::vector<char>& on_path, long long& best) {
    if (v == dst) { best = std::min(best, cost); return; }
    for (Edge e : g[v])
        if (!on_path[e.to]) {
            on_path[e.to] = 1;
            walk(g, e.to, dst, k, cost + e.weight, on_path, best);
            if (k > 0) walk(g, e.to, dst, k - 1, cost, on_path, best);
            on_path[e.to] = 0;
        }
}

int main() {
    // A road with one expensive middle section.
    std::vector<std::vector<Edge>> g(4);
    g[0].push_back({1, 1}); g[1].push_back({2, 50}); g[2].push_back({3, 1});

    for (int k = 0; k <= 2; ++k)
        std::printf("with %d free edge(s): %lld\n", k,
                    cheapest_with_free_edges(g, 0, 3, k));

    std::mt19937 rng(140);
    bool ok = true;
    for (int trial = 0; trial < 800; ++trial) {
        int n = 2 + static_cast<int>(rng() % 5);
        int k = static_cast<int>(rng() % 3);
        std::vector<std::vector<Edge>> h(n);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 45)
                    h[u].push_back({v, 1 + static_cast<long long>(rng() % 9)});
        long long fast = cheapest_with_free_edges(h, 0, n - 1, k);
        long long best = INF;
        std::vector<char> on_path(n, 0);
        on_path[0] = 1;
        walk(h, 0, n - 1, k, 0, on_path, best);
        if (fast != best) ok = false;
    }
    std::printf("800 random graphs agree with exhaustive search: %s\n",
                ok ? "yes" : "NO");
}
```

52 with no free edge, 2 with one, 1 with two — and 800 random graphs agree with
an exhaustive search.

The technique is worth naming: **the vertex of the search is a *state*, not
necessarily a place.** Here the state is `(vertex, free moves used)`, encoded as
`used * n + v`, and the edges are the two things you may do with a road: pay for
it (staying in the layer) or take it free (moving up one). Everything else is
ordinary Dijkstra.

The same shape covers a large family:

| The problem adds | The state becomes |
|---|---|
| at most `k` free / discounted edges | `(vertex, k used)` |
| you may be carrying one of `t` items | `(vertex, item)` |
| the cost depends on the direction you arrived from | `(vertex, direction)` |
| you alternate between two modes of travel | `(vertex, mode)` |
| at most `k` edges may be used in total | `(vertex, edges used)` |

The cost is a factor of the number of extra states, in both time and memory:
`k + 1` copies here means `(k+1)·n` vertices and `2(k+1)·m` edges. Read the
constraint on `k` before committing — it is usually small precisely because the
setter intends this.

## Choosing

| Weights | Use | Cost |
|---|---|---|
| all equal | BFS (10.17) | O(n + m) |
| 0 or 1 | deque BFS (10.17) | O(n + m) |
| small integers, at most `C` | Dial's buckets | O(n·C + m) |
| arbitrary non-negative | Dijkstra with a heap | O((n + m) log n) |
| any, no negative cycle | Bellman–Ford (10.22) | O(n·m) |
| all pairs, small `n` | Floyd–Warshall (10.22) | O(n³) |

:::quiz
{
  "question": "Your Dijkstra pushes a vertex into the heap every time an edge to it is relaxed, and skips a popped entry when `d != dist[v]`. Someone suggests removing the skip line, since the distances are correct anyway. What breaks?",
  "options": [
    { "text": "Nothing about correctness — but every stale copy is re-expanded, so each vertex's whole neighbour list is walked once per push instead of once in total", "correct": true, "why": "The distances still converge, since relaxation only ever lowers them. What is lost is the O((n+m) log n) bound: with 37% of pops stale in the measurement here, the extra work is a large constant, and on adversarial graphs it is worse than constant." },
    { "text": "Distances come out too large, because a stale entry overwrites a better one", "why": "A stale entry cannot overwrite anything: the relaxation test `d + w < dist[to]` only ever lowers a distance, and re-expanding a vertex at an out-of-date distance simply fails every test." },
    { "text": "The loop never terminates on a graph with a cycle", "why": "Each push follows a strict decrease in some `dist` entry, and distances are bounded below, so the number of pushes is finite regardless of cycles." },
    { "text": "It becomes incorrect for graphs with equal-weight edges", "why": "Ties are handled by the relaxation test either way; the skip line is about work, not about which distances are computed." }
  ]
}
:::

## Practice

:::exercise dijkstra-audit

:::exercise layered-dijkstra

:::exercise judge-shortest-route

:::exercise judge-count-shortest

:::recap
- Dijkstra expands the closest unfinished vertex. With no decrease-key in
  `std::priority_queue`, push a second copy and discard stale pops with
  `if (d != dist[v]) continue;` — measured at 37% stale on a 100,000-vertex
  graph, and the reason the heap holds up to `m` entries.
- `std::greater<>` for a min-heap, `(distance, vertex)` in that order, and `INF`
  as `max() / 4` so that `dist + weight` cannot overflow.
- A negative edge breaks the greedy argument. Measured on four vertices: the
  frozen form answers 2 where the truth is −4, because vertex 1 was finalised
  before the cheaper route to it was discovered.
- Reconstruction and counting ride on the relaxation: strictly better replaces
  distance, parent and count; equally good adds to the count.
- When the problem adds a mode, a budget, or a direction, put it in the vertex.
  `(vertex, free moves used)` costs a factor of `k + 1` and needs no new
  algorithm.
:::
