---
title: "BFS, 0–1 BFS, and multi-source BFS"
navTitle: "BFS"
summary: >-
  One queue, shortest paths in edges — and the two variations that cover most
  of what a contest asks for.
objectives:
  - Write BFS and know why it gives shortest paths in an unweighted graph
  - Mark vertices when they are enqueued, and know what it costs not to
  - Seed the queue with many sources to get "distance to the nearest"
  - Use a deque for 0/1 edge weights instead of a heap
status: complete
standard: c++20
requires: [representing-graphs]
---

Breadth-first search visits vertices in order of distance from the start. That
one property makes it the answer to every "fewest moves" question, and the two
variations in this chapter — many sources at once, and edges of weight 0 or 1 —
cover most of the rest.

The invariant is worth stating before the code: **the queue always holds
vertices at distance `d` followed by vertices at distance `d + 1`, and never
anything else.** Every rule below exists to preserve it.

## The search

```cpp run title="A maze, and an obviously-correct cross-check"
#include <algorithm>
#include <array>
#include <climits>
#include <cstdio>
#include <queue>
#include <random>
#include <string>
#include <vector>

// Shortest path in edges from (0,0) to the bottom-right, moving on open cells.
int bfs(const std::vector<std::string>& g) {
    int rows = static_cast<int>(g.size()), cols = static_cast<int>(g[0].size());
    if (g[0][0] == '#' || g[rows - 1][cols - 1] == '#') return -1;

    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, -1));
    std::queue<std::pair<int, int>> q;
    dist[0][0] = 0;
    q.emplace(0, 0);

    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;      // marked the moment it is enqueued
            q.emplace(nr, nc);
        }
    }
    return dist[rows - 1][cols - 1];
}

// Obviously correct and slow: relax every edge until nothing changes.
int relax_until_stable(const std::vector<std::string>& g) {
    int rows = static_cast<int>(g.size()), cols = static_cast<int>(g[0].size());
    if (g[0][0] == '#' || g[rows - 1][cols - 1] == '#') return -1;
    const int INF = INT_MAX / 2;
    std::vector<std::vector<int>> d(rows, std::vector<int>(cols, INF));
    d[0][0] = 0;
    bool changed = true;
    while (changed) {
        changed = false;
        for (int r = 0; r < rows; ++r)
            for (int c = 0; c < cols; ++c) {
                if (g[r][c] == '#') continue;
                int best = d[r][c];
                if (r > 0 && g[r - 1][c] == '.') best = std::min(best, d[r - 1][c] + 1);
                if (r + 1 < rows && g[r + 1][c] == '.') best = std::min(best, d[r + 1][c] + 1);
                if (c > 0 && g[r][c - 1] == '.') best = std::min(best, d[r][c - 1] + 1);
                if (c + 1 < cols && g[r][c + 1] == '.') best = std::min(best, d[r][c + 1] + 1);
                if (best < d[r][c]) { d[r][c] = best; changed = true; }
            }
    }
    int answer = d[rows - 1][cols - 1];
    return answer >= INF ? -1 : answer;
}

int main() {
    std::vector<std::string> maze = {
        ".....#....",
        "####.#.##.",
        "...#.#.#..",
        ".#...#.#.#",
        ".#####.#..",
        ".....#.#.#",
        "####...#..",
        "...#.####.",
        ".#.#......",
        ".#...####.",
    };
    std::printf("10x10 maze: shortest path %d steps (relaxation says %d)\n",
                bfs(maze), relax_until_stable(maze));

    std::mt19937 rng(8);
    int checked = 0, blocked = 0;
    bool ok = true;
    for (int trial = 0; trial < 3000; ++trial) {
        int rows = 1 + static_cast<int>(rng() % 6), cols = 1 + static_cast<int>(rng() % 6);
        std::vector<std::string> g(rows, std::string(cols, '.'));
        for (int r = 0; r < rows; ++r)
            for (int c = 0; c < cols; ++c)
                if (rng() % 100 < 30) g[r][c] = '#';
        int a = bfs(g), b = relax_until_stable(g);
        if (a != b) ok = false;
        if (a == -1) ++blocked;
        ++checked;
    }
    std::printf("%d random mazes (%d unreachable) agree with relaxation: %s\n",
                checked, blocked, ok ? "yes" : "NO");
}
```

28 steps through the maze, and 3,000 random grids — two thirds of them with no
route at all — agree with a relaxation that keeps sweeping until nothing changes.

Four things the code commits to, each worth a sentence:

- **`dist` doubles as the visited flag.** `-1` means "not reached", and setting
  it is what marks the cell. One array instead of two, and no way for them to
  disagree.
- **Bounds first, then the grid.** `nr < 0 || nr >= rows` before `g[nr][nc]`,
  because the second is undefined behaviour when the first is true. `||`
  short-circuits, and the order is load-bearing.
- **`-1` is also the answer for "unreachable"**, which is what the problem
  usually wants printed, so no conversion is needed at the end.
- **The start is checked separately.** A blocked start is not a path of length
  0, and the loop would never notice.

## Mark on enqueue, not on dequeue

The rule that keeps the queue small: set `dist[w]` at the moment `w` is pushed.
Setting it when `w` is popped is also correct — but not free.

```cpp run title="The same answers, three times the pushes"
#include <chrono>
#include <cstdio>
#include <queue>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Mark a vertex the moment it is pushed. Each vertex enters the queue once.
std::pair<std::vector<int>, long long> mark_on_push(
        const std::vector<std::vector<int>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::queue<int> q;
    long long pushes = 0;
    dist[src] = 0;
    q.push(src); ++pushes;
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (int w : g[v])
            if (dist[w] == -1) { dist[w] = dist[v] + 1; q.push(w); ++pushes; }
    }
    return {dist, pushes};
}

// Mark a vertex only when it is popped. A vertex can be pushed once per in-edge.
std::pair<std::vector<int>, long long> mark_on_pop(
        const std::vector<std::vector<int>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::vector<bool> done(g.size(), false);
    std::queue<std::pair<int, int>> q;
    long long pushes = 0;
    q.emplace(src, 0); ++pushes;
    while (!q.empty()) {
        auto [v, d] = q.front(); q.pop();
        if (done[v]) continue;
        done[v] = true;
        dist[v] = d;
        for (int w : g[v])
            if (!done[w]) { q.emplace(w, d + 1); ++pushes; }
    }
    return {dist, pushes};
}

int main() {
    const int n = 100'000;
    std::vector<std::vector<int>> g(n);
    std::mt19937 rng(12);
    for (int i = 0; i < 3 * n; ++i) {
        int u = static_cast<int>(rng() % n), v = static_cast<int>(rng() % n);
        if (u == v) continue;
        g[u].push_back(v);
        g[v].push_back(u);
    }

    auto t0 = std::chrono::steady_clock::now();
    auto [d1, p1] = mark_on_push(g, 0);
    auto t1 = std::chrono::steady_clock::now();
    auto [d2, p2] = mark_on_pop(g, 0);
    auto t2 = std::chrono::steady_clock::now();

    keep(d1); keep(d2);
    std::printf("n = %d, about %d directed edges\n", n, 6 * n);
    std::printf("  mark on push  %8.1f ms, %8lld pushes\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(), p1);
    std::printf("  mark on pop   %8.1f ms, %8lld pushes\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count(), p2);
    std::printf("  same distances: %s\n", d1 == d2 ? "yes" : "NO");
}
```

99,745 pushes against 299,998, and 49 ms against 351 ms — for identical
distances.

The distances are identical because BFS pops in non-decreasing distance order,
so the *first* pop of a vertex carries its correct distance and the `done` check
discards the rest. What changes is the size of the queue: with marking on
enqueue it holds at most `n` entries ever, and with marking on dequeue it can
hold up to `m`. On a dense graph that is the difference between 2 × 10⁵ and
2 × 10⁷ entries.

Two related habits:

- **Never push a vertex you have already marked.** The `if (dist[w] == -1)` is
  what bounds the total work at O(n + m).
- **Do not carry the distance in the queue.** It belongs in the `dist` array,
  where it can be read back by every neighbour. A queue of `pair<int,int>` is a
  sign that the marking rule has slipped.

The lazy-deletion pattern of `mark_on_pop` is not a mistake everywhere — it is
exactly what Dijkstra does with a heap, because there a better distance really
can arrive later (chapter 10.21). In an unweighted BFS it cannot, so the extra
entries buy nothing.

## Many sources, one sweep

"Distance from each cell to the nearest fire", "how far is every house from a
shop" — the same BFS, with every source pushed before the loop starts.

```cpp run title="Forty sources at once"
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdio>
#include <queue>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Distance from every cell to the nearest source, in one sweep.
std::vector<int> multi_source(int rows, int cols, const std::vector<int>& sources) {
    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};
    std::vector<int> dist(rows * cols, -1);
    std::queue<int> q;
    for (int s : sources) { dist[s] = 0; q.push(s); }   // every source starts at 0

    while (!q.empty()) {
        int id = q.front(); q.pop();
        int r = id / cols, c = id % cols;
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            int nid = nr * cols + nc;
            if (dist[nid] != -1) continue;
            dist[nid] = dist[id] + 1;
            q.push(nid);
        }
    }
    return dist;
}

// One BFS per source, taking the minimum.
std::vector<int> one_at_a_time(int rows, int cols, const std::vector<int>& sources) {
    std::vector<int> best(rows * cols, -1);
    for (int s : sources) {
        std::vector<int> d = multi_source(rows, cols, {s});
        for (int i = 0; i < rows * cols; ++i)
            if (best[i] == -1 || d[i] < best[i]) best[i] = d[i];
    }
    return best;
}

int main() {
    const int rows = 300, cols = 300;
    std::vector<int> sources;
    for (int i = 0; i < 40; ++i)
        sources.push_back((i * 7919) % (rows * cols));

    auto t0 = std::chrono::steady_clock::now();
    std::vector<int> a = multi_source(rows, cols, sources);
    auto t1 = std::chrono::steady_clock::now();
    std::vector<int> b = one_at_a_time(rows, cols, sources);
    auto t2 = std::chrono::steady_clock::now();

    keep(a); keep(b);
    std::printf("%d x %d grid, %zu sources\n", rows, cols, sources.size());
    std::printf("  one multi-source sweep %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("  one BFS per source     %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  identical results: %s\n", a == b ? "yes" : "NO");
    std::printf("  farthest cell is %d steps from any source\n",
                *std::max_element(a.begin(), a.end()));
}
```

23 ms against 996 ms, for identical output — a factor of 43, which is the number
of sources.

The change is two characters wide: a loop instead of a single push. Why it works
is worth being explicit about. Pushing every source at distance 0 is exactly the
same as adding a *virtual* vertex joined to all of them by zero-cost edges and
running one ordinary BFS from it. The queue invariant is untouched, because all
the seeds are at the same distance.

The same trick answers "which source is nearest", not just "how far": carry a
second array `owner[]`, set it alongside `dist[]`, and it propagates for free.

## Weights of 0 and 1

A deque generalises BFS to edges that cost 0 or 1, without the log factor a heap
would bring.

```cpp run title="A deque instead of a heap"
#include <algorithm>
#include <chrono>
#include <climits>
#include <cstdio>
#include <deque>
#include <queue>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

struct Edge { int to, weight; };            // weight is 0 or 1

// Plain BFS: correct only when every edge costs the same.
std::vector<int> plain_bfs(const std::vector<std::vector<Edge>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::queue<int> q;
    dist[src] = 0;
    q.push(src);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (Edge e : g[v])
            if (dist[e.to] == -1) { dist[e.to] = dist[v] + 1; q.push(e.to); }
    }
    return dist;
}

// 0-1 BFS: a deque instead of a queue. Zero-weight edges go to the front.
std::vector<int> zero_one_bfs(const std::vector<std::vector<Edge>>& g, int src) {
    const int INF = INT_MAX / 2;
    std::vector<int> dist(g.size(), INF);
    std::deque<int> dq;
    dist[src] = 0;
    dq.push_back(src);
    while (!dq.empty()) {
        int v = dq.front(); dq.pop_front();
        for (Edge e : g[v]) {
            int candidate = dist[v] + e.weight;
            if (candidate < dist[e.to]) {
                dist[e.to] = candidate;
                if (e.weight == 0) dq.push_front(e.to);     // same layer
                else dq.push_back(e.to);                    // next layer
            }
        }
    }
    for (int& d : dist) if (d >= INF) d = -1;
    return dist;
}

// Dijkstra, as the reference.
std::vector<int> dijkstra(const std::vector<std::vector<Edge>>& g, int src) {
    const int INF = INT_MAX / 2;
    std::vector<int> dist(g.size(), INF);
    std::priority_queue<std::pair<int, int>, std::vector<std::pair<int, int>>,
                        std::greater<>> pq;
    dist[src] = 0;
    pq.emplace(0, src);
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (Edge e : g[v])
            if (d + e.weight < dist[e.to]) { dist[e.to] = d + e.weight; pq.emplace(dist[e.to], e.to); }
    }
    for (int& d : dist) if (d >= INF) d = -1;
    return dist;
}

int main() {
    std::mt19937 rng(21);
    bool matches_dijkstra = true, plain_ever_wrong = false;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 2 + static_cast<int>(rng() % 8);
        std::vector<std::vector<Edge>> g(n);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (u != v && rng() % 100 < 40)
                    g[u].push_back({v, static_cast<int>(rng() % 2)});
        std::vector<int> a = zero_one_bfs(g, 0), b = dijkstra(g, 0), c = plain_bfs(g, 0);
        if (a != b) matches_dijkstra = false;
        if (c != b) plain_ever_wrong = true;
    }
    std::printf("2000 random 0/1 graphs: deque BFS matches Dijkstra: %s\n",
                matches_dijkstra ? "always" : "NO");
    std::printf("                        plain BFS matches Dijkstra: %s\n",
                plain_ever_wrong ? "not always" : "always");

    // Timing on one large graph.
    const int n = 200'000;
    std::vector<std::vector<Edge>> g(n);
    for (int v = 0; v + 1 < n; ++v) {
        g[v].push_back({v + 1, static_cast<int>(rng() % 2)});
        g[v + 1].push_back({v, static_cast<int>(rng() % 2)});
    }
    for (int i = 0; i < n; ++i) {
        int u = static_cast<int>(rng() % n), v = static_cast<int>(rng() % n);
        int w = static_cast<int>(rng() % 2);
        g[u].push_back({v, w});
        g[v].push_back({u, w});
    }

    auto t0 = std::chrono::steady_clock::now();
    std::vector<int> d1 = zero_one_bfs(g, 0);
    auto t1 = std::chrono::steady_clock::now();
    std::vector<int> d2 = dijkstra(g, 0);
    auto t2 = std::chrono::steady_clock::now();

    keep(d1); keep(d2);
    std::printf("n = %d, about %d edges\n", n, 4 * n);
    std::printf("  0-1 BFS (deque)   %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("  Dijkstra (heap)   %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  same distances: %s\n", d1 == d2 ? "yes" : "NO");
}
```

The deque agrees with Dijkstra on all 2,000 random graphs and plain BFS does
not, and on 200,000 vertices the deque takes 176 ms against Dijkstra's 2,443 ms.

Why it works: the deque holds at most two distinct distances at any moment, `d`
at the front and `d + 1` behind. A zero-weight edge reaches a vertex at the
*same* distance, so it belongs with the front group; a weight-one edge reaches
one further out, so it belongs behind. That is the ordinary BFS invariant with
one extra case, and it is the whole proof.

Three details:

- **Relax, do not check-and-mark.** The condition is
  `if (dist[v] + w < dist[e.to])`, not `if (dist[e.to] == -1)`. A vertex can be
  improved after it is first reached, via a chain of zero-weight edges, so the
  BFS test is too strict here.
- **A vertex may enter the deque more than once**, and that is fine: the
  distance only ever decreases, so the total work stays O(n + m).
- **Only 0 and 1.** With weights 0, 1, 2 the deque no longer holds two adjacent
  distances and the technique breaks. Either split an edge of weight 2 into two
  edges of weight 1 through a dummy vertex, or use Dijkstra.

The classic disguise is a grid where moving straight is free and turning costs
one, or where you may break a limited number of walls: the "vertices" are
(cell, direction) or (cell, walls broken), and the edges are 0 or 1.

## Choosing

| The problem says | Use |
|---|---|
| fewest moves, every move alike | BFS |
| distance to the nearest of several starts | BFS, all sources pushed first |
| every edge costs 0 or 1 | 0–1 BFS with a deque |
| edge costs are small integers up to `k` | dial's algorithm, or split edges |
| arbitrary non-negative costs | Dijkstra (10.21) |
| any negative cost | Bellman–Ford (10.22) |

:::quiz
{
  "question": "In a BFS over an unweighted graph you set `dist[w]` only when `w` is popped, not when it is pushed, and skip vertices already finished. What is the consequence?",
  "options": [
    { "text": "The distances are still correct, but the queue can hold O(m) entries instead of O(n) — measured here as 300,000 pushes against 100,000, and 351 ms against 49 ms", "correct": true, "why": "BFS pops in non-decreasing distance order, so the first pop of a vertex carries the right distance and the duplicates are discarded. Only the queue size and the running time suffer." },
    { "text": "Some distances come out too large, because a vertex can be popped with a stale value", "why": "The first pop of any vertex is via the shortest route, precisely because the queue is ordered by distance. Later copies are skipped by the finished check." },
    { "text": "It becomes an infinite loop on a cyclic graph", "why": "The finished check stops re-expansion, so each vertex is expanded once and the search terminates." },
    { "text": "Nothing changes; the two versions do the same work", "why": "A vertex is pushed once per in-edge rather than once in total. On the measured graph that is three times the pushes and seven times the running time." }
  ]
}
:::

## Practice

:::exercise bfs-audit

:::exercise zero-one-bfs

:::exercise judge-maze

:::exercise judge-nearest-source

:::recap
- BFS visits in order of distance, so the first time a vertex is reached is via a
  shortest path. `dist` initialised to −1 doubles as the visited flag.
- Mark a vertex when it is *enqueued*. Marking on dequeue is still correct and
  measured three times the pushes and seven times the time here; the queue grows
  from O(n) to O(m).
- Pushing every source before the loop gives "distance to the nearest source" in
  one sweep: 23 ms against 996 ms for forty separate searches.
- With edge weights of 0 and 1, a deque replaces the heap — zero-weight edges to
  the front, weight-one to the back. 176 ms against Dijkstra's 2,443 ms on
  200,000 vertices, and plain BFS is simply wrong.
- 0–1 BFS relaxes (`dist[v] + w < dist[to]`) rather than testing for unvisited,
  because a vertex can be improved through a chain of zero-weight edges.
- Bounds checks come before grid accesses; `||` short-circuiting is what makes
  the single `open_cell` predicate safe.
:::
