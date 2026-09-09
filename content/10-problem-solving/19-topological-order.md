---
title: "Topological order and DAG DP"
navTitle: "Topological order"
summary: >-
  Put a directed acyclic graph in an order where every edge points forward, and
  dynamic programming over it becomes a single sweep.
objectives:
  - Produce a topological order with Kahn's algorithm and with DFS
  - Detect a cycle from the length of Kahn's output
  - Get the lexicographically smallest order with a heap
  - Write a DP over a DAG in topological order
status: complete
standard: c++20
requires: [dfs]
---

A directed acyclic graph can always be laid out on a line so that every edge
points to the right. Once it is, any quantity defined in terms of a vertex's
predecessors can be computed in one left-to-right pass — no recursion, no
memoisation, no question about which subproblem to solve first.

That is the whole value of a topological order, and it is why "the constraints
say the graph is acyclic" is a strong hint.

## Two ways to get one

```cpp run title="Kahn's algorithm and reverse DFS finishing order"
#include <algorithm>
#include <cstdio>
#include <queue>
#include <random>
#include <vector>

// Kahn: repeatedly take a vertex with no remaining incoming edges.
std::vector<int> kahn(int n, const std::vector<std::vector<int>>& g) {
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
    return order;                      // shorter than n means a cycle
}

// DFS: a vertex is finished only after everything it points to is finished,
// so the reverse finishing order is a topological order.
std::vector<int> by_dfs(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> colour(n, 0), iter(n, 0), stack, order;
    for (int s = 0; s < n; ++s) {
        if (colour[s] != 0) continue;
        colour[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (colour[w] == 0) { colour[w] = 1; stack.push_back(w); }
            } else {
                colour[v] = 2;
                order.push_back(v);    // finished
                stack.pop_back();
            }
        }
    }
    std::reverse(order.begin(), order.end());
    return order;
}

bool is_topological(int n, const std::vector<std::vector<int>>& g,
                    const std::vector<int>& order) {
    if (static_cast<int>(order.size()) != n) return false;
    std::vector<int> position(n, -1);
    for (int i = 0; i < n; ++i) {
        if (order[i] < 0 || order[i] >= n || position[order[i]] != -1) return false;
        position[order[i]] = i;
    }
    for (int v = 0; v < n; ++v)
        for (int w : g[v]) if (position[v] >= position[w]) return false;
    return true;
}

int main() {
    // 0 -> 1 -> 3, 0 -> 2 -> 3, 2 -> 4
    std::vector<std::vector<int>> g{{1, 2}, {3}, {3, 4}, {}, {}};
    auto a = kahn(5, g), b = by_dfs(5, g);
    std::printf("Kahn :");
    for (int v : a) std::printf(" %d", v);
    std::printf("\nDFS  :");
    for (int v : b) std::printf(" %d", v);
    std::printf("\nboth valid: %s / %s\n",
                is_topological(5, g, a) ? "yes" : "no",
                is_topological(5, g, b) ? "yes" : "no");

    std::mt19937 rng(60);
    bool ok = true;
    int same = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<std::vector<int>> dag(n);
        for (int u = 0; u < n; ++u)                       // only forward edges
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 30) dag[u].push_back(v);
        auto x = kahn(n, dag), y = by_dfs(n, dag);
        if (!is_topological(n, dag, x) || !is_topological(n, dag, y)) ok = false;
        if (x == y) ++same;
    }
    std::printf("3000 random DAGs: both algorithms always valid: %s "
                "(and identical in %d of them)\n", ok ? "yes" : "NO", same);
}
```

`0 1 2 3 4` from Kahn and `0 2 4 1 3` from DFS — different orders, both valid,
and 3,000 random DAGs confirm it. The two agree on only 547 of them, which is
worth seeing: **a topological order is not unique**, and a problem that expects
a specific one will say which.

The two algorithms differ in what they are convenient for:

- **Kahn** maintains in-degrees and takes whatever is ready. It detects cycles
  for free (see below), and swapping the queue for another container changes
  *which* valid order you get.
- **DFS** produces the reverse finishing order. It needs no in-degree array, it
  falls out of a search you may already be doing, and it is the basis of
  Tarjan's strongly-connected-components algorithm.

Note the DFS version does not need the three colours here, because the graph is
assumed acyclic — but it does need the `iter[v]` cursor, because "finished" is
the moment that matters.

## Cycles, and choosing the order

Kahn's loop stops when nothing is ready. On a cyclic graph the vertices in the
cycle each keep a positive in-degree forever, so the output is short — which is
a cycle test that costs nothing.

Swap the queue for a min-heap and the same algorithm produces the
lexicographically smallest valid order.

```cpp run title="A heap instead of a queue"
#include <algorithm>
#include <cstdio>
#include <functional>
#include <queue>
#include <random>
#include <vector>

// Kahn with a min-heap instead of a queue: the lexicographically smallest order.
std::vector<int> smallest_order(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> indeg(n, 0);
    for (int v = 0; v < n; ++v) for (int w : g[v]) ++indeg[w];
    std::priority_queue<int, std::vector<int>, std::greater<>> ready;
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.top(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }
    return order;
}

// Reference: try every permutation and keep the smallest valid one.
std::vector<int> smallest_brute(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> perm(n);
    for (int i = 0; i < n; ++i) perm[i] = i;
    std::vector<int> best;
    do {
        std::vector<int> pos(n);
        for (int i = 0; i < n; ++i) pos[perm[i]] = i;
        bool ok = true;
        for (int v = 0; v < n && ok; ++v)
            for (int w : g[v]) if (pos[v] >= pos[w]) { ok = false; break; }
        if (ok) { best = perm; break; }             // permutations come out sorted
    } while (std::next_permutation(perm.begin(), perm.end()));
    return best;
}

int main() {
    // 0 -> 2, 1 -> 2, 2 -> 3. Both 0 and 1 are free at the start.
    std::vector<std::vector<int>> g{{2}, {2}, {3}, {}};
    auto s = smallest_order(4, g);
    std::printf("smallest order:");
    for (int v : s) std::printf(" %d", v);
    std::printf("\n");

    // A cycle: Kahn emits fewer than n vertices.
    std::vector<std::vector<int>> cyc{{1}, {2}, {0}};
    std::printf("on a 3-cycle Kahn emits %zu of 3 vertices -> %s\n",
                smallest_order(3, cyc).size(),
                smallest_order(3, cyc).size() == 3 ? "acyclic" : "cyclic");

    std::mt19937 rng(64);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 7);
        std::vector<int> label(n);
        for (int i = 0; i < n; ++i) label[i] = i;
        std::shuffle(label.begin(), label.end(), rng);     // a random DAG, relabelled
        std::vector<std::vector<int>> dag(n);
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 30) dag[label[u]].push_back(label[v]);
        if (smallest_order(n, dag) != smallest_brute(n, dag)) ok = false;
    }
    std::printf("2000 random DAGs: the heap gives the smallest order: %s\n",
                ok ? "yes" : "NO");
}
```

The three-cycle emits zero vertices, and the heap version matches a brute-force
search over all permutations on 2,000 random DAGs.

Two things to take from that.

**"Fewer than `n` emitted" is the cycle test.** No colours, no extra pass — if
the order is short, the vertices missing from it are exactly those on or
downstream of a cycle. That makes Kahn the natural choice when the problem asks
"schedule these tasks, or report that it is impossible".

**Greedy is correct for the smallest order**, and the reason is an exchange
argument (chapter 10.13): among the currently-ready vertices, the smallest can
be placed first without invalidating anything, because nothing ready depends on
anything else ready. Note that the same greedy does *not* give the smallest order
when the objective is something else — "smallest at each step" and "smallest
overall" coincide here and often do not.

## The point of it: DP in one sweep

```cpp run title="Longest path, swept and memoised"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <queue>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

std::vector<int> kahn(int n, const std::vector<std::vector<int>>& g) {
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
    return order;
}

// Longest path in edges, over a DAG. In topological order every predecessor is
// already final, so one sweep is enough.
long long longest_path(int n, const std::vector<std::vector<int>>& g) {
    std::vector<int> order = kahn(n, g);
    std::vector<long long> best(n, 0);
    long long answer = 0;
    for (int v : order)
        for (int w : g[v]) {
            best[w] = std::max(best[w], best[v] + 1);
            answer = std::max(answer, best[w]);
        }
    return answer;
}

// The same recurrence, memoised, without an explicit order.
long long longest_memo(int n, const std::vector<std::vector<int>>& g) {
    std::vector<long long> memo(n, -1);
    std::vector<int> iter(n, 0), stack;
    long long answer = 0;
    for (int s = 0; s < n; ++s) {
        if (memo[s] != -1) continue;
        stack.push_back(s);
        memo[s] = 0;                                  // provisional
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (memo[w] == -1) { memo[w] = 0; stack.push_back(w); }
            } else {
                stack.pop_back();
                long long best = 0;
                for (int w : g[v]) best = std::max(best, memo[w] + 1);
                memo[v] = best;
                answer = std::max(answer, best);
            }
        }
    }
    return answer;
}

int main() {
    std::mt19937 rng(70);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<std::vector<int>> dag(n);
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 35) dag[u].push_back(v);
        if (longest_path(n, dag) != longest_memo(n, dag)) ok = false;
    }
    std::printf("2000 random DAGs: the sweep and the memoised recursion agree: %s\n",
                ok ? "yes" : "NO");

    const int n = 200'000;
    std::vector<std::vector<int>> dag(n);
    for (int v = 0; v + 1 < n; ++v) dag[v].push_back(v + 1);          // a long chain
    for (int i = 0; i < n; ++i) {
        int u = static_cast<int>(rng() % n), w = static_cast<int>(rng() % n);
        if (u < w) dag[u].push_back(w);
    }

    auto t0 = std::chrono::steady_clock::now();
    long long a = longest_path(n, dag);
    auto t1 = std::chrono::steady_clock::now();
    long long b = longest_memo(n, dag);
    auto t2 = std::chrono::steady_clock::now();

    keep(a); keep(b);
    std::printf("n = %d, about %d edges, longest path %lld edges\n", n, 2 * n, a);
    std::printf("  topological sweep %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("  memoised search   %8.1f ms\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count());
    std::printf("  same answer: %s\n", a == b ? "yes" : "no");
}
```

Both agree on 2,000 random DAGs, and on a 200,000-vertex graph the sweep takes
127 ms against the memoised search's 183 ms — for a longest path of 199,999
edges.

The comparison is the point rather than the margin. **A topological sweep and a
memoised recursion compute the same thing**; the sweep replaces the recursion's
"solve this subproblem first" bookkeeping with an order fixed in advance. The
sweep is a little faster, uses no stack, and cannot overflow — the memoised
version here had to be written iteratively for exactly that reason (chapter
10.18 measures the depth available).

Note that **longest path is NP-hard on a general graph** and trivial on a DAG.
That is not a small distinction: the acyclicity is doing all the work, and it is
the reason "the tasks have no circular dependencies" is worth reading carefully.

## Counting, and the shape of every DAG DP

```cpp run title="How many ways to get there"
#include <cstdint>
#include <cstdio>
#include <queue>
#include <random>
#include <vector>

const std::uint64_t MOD = 1'000'000'007;

std::vector<int> kahn(int n, const std::vector<std::vector<int>>& g) {
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
    return order;
}

// Number of distinct paths from `src` to every vertex, modulo MOD.
std::vector<std::uint64_t> count_paths(int n, const std::vector<std::vector<int>>& g,
                                       int src) {
    std::vector<std::uint64_t> ways(n, 0);
    ways[src] = 1;                                   // the empty path
    for (int v : kahn(n, g))
        if (ways[v])                                 // unreachable contributes nothing
            for (int w : g[v]) ways[w] = (ways[w] + ways[v]) % MOD;
    return ways;
}

// Reference: enumerate every path explicitly.
long long enumerate_paths(int n, const std::vector<std::vector<int>>& g,
                          int v, int target) {
    if (v == target) return 1;
    long long total = 0;
    for (int w : g[v]) total += enumerate_paths(n, g, w, target);
    return total;
}

int main() {
    // A diamond with an extra route: 0->1->3, 0->2->3, 0->3.
    std::vector<std::vector<int>> g{{1, 2, 3}, {3}, {3}, {}};
    std::vector<std::uint64_t> ways = count_paths(4, g, 0);
    std::printf("paths from 0: ");
    for (std::uint64_t w : ways) std::printf("%llu ", static_cast<unsigned long long>(w));
    std::printf("\n");

    std::mt19937 rng(81);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<std::vector<int>> dag(n);
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 40) dag[u].push_back(v);
        std::vector<std::uint64_t> a = count_paths(n, dag, 0);
        for (int t = 0; t < n; ++t)
            if (a[t] != static_cast<std::uint64_t>(enumerate_paths(n, dag, 0, t)) % MOD)
                ok = false;
    }
    std::printf("2000 random DAGs agree with explicit enumeration: %s\n",
                ok ? "yes" : "NO");

    // A grid-like DAG where the count overflows anything but a modulus.
    const int n = 200;
    std::vector<std::vector<int>> big(n);
    for (int v = 0; v + 1 < n; ++v) {
        big[v].push_back(v + 1);
        if (v + 2 < n) big[v].push_back(v + 2);
    }
    std::printf("a 200-vertex ladder has %llu paths from 0 to 199 (mod 1e9+7)\n",
                static_cast<unsigned long long>(count_paths(n, big, 0)[n - 1]));
}
```

`1 1 1 3` for the diamond — three routes from 0 to 3 — matching an explicit
enumeration on 2,000 random DAGs. The 200-vertex ladder counts Fibonacci-many
paths, which is why the answer is taken modulo 10⁹+7.

Every DAG DP has the same three parts, and it is worth naming them:

1. **A base case** at the sources. `ways[src] = 1`; `best[v] = 0` for the longest
   path.
2. **A relaxation along each edge**, applied when the *source* of the edge is
   final. In topological order, that is always.
3. **A sweep in topological order**, which makes part 2's condition automatic.

Written as "push" — `for v in order: for w in g[v]: update w from v` — or as
"pull" — `for v in order: for u in predecessors(v): update v from u` — they are
the same DP. Push needs the forward adjacency and pull needs the reverse one;
whichever the input gives you is the one to use.

The `if (ways[v])` guard is not an optimisation but a statement: a vertex with
no paths to it contributes nothing, and skipping it keeps unreachable vertices at
zero rather than propagating a spurious 1.

## Recognising it

| The problem says | Do |
|---|---|
| tasks with prerequisites, is a schedule possible | Kahn; short output means no |
| output any valid order | Kahn or DFS |
| output the alphabetically first order | Kahn with a min-heap |
| longest chain of dependencies | DAG DP, longest path |
| how many ways to get from A to B, acyclic | DAG DP, counting, modulo something |
| the graph has cycles | condense them first (10.35), or Bellman–Ford (10.22) |

:::quiz
{
  "question": "Kahn's algorithm on an n-vertex graph outputs only k < n vertices. What does that tell you, and about which vertices?",
  "options": [
    { "text": "The graph has a cycle, and the missing n − k vertices are exactly those on a cycle or reachable from one", "correct": true, "why": "A vertex is emitted only when its in-degree reaches zero. Vertices on a cycle always retain at least one incoming edge from within it, and anything downstream of them keeps an edge from them — so precisely those never become ready." },
    { "text": "The graph is disconnected, and the missing vertices are in the other components", "why": "Kahn starts from every zero-in-degree vertex at once, so separate components are handled together. Disconnection alone never shortens the output." },
    { "text": "The graph has a cycle, and the missing vertices are exactly the cycle's vertices", "why": "Everything reachable from a cycle is also stuck, because it keeps an incoming edge from a vertex that is never emitted. The missing set is usually larger than the cycle itself." },
    { "text": "The queue was exhausted early; restarting from any unemitted vertex completes the order", "why": "There is nothing to restart from — every remaining vertex has a positive in-degree, which is the definition of not being ready, and forcing one out would break the order." }
  ]
}
:::

## Practice

:::exercise topo-audit

:::exercise dag-dp

:::exercise judge-task-order

:::exercise judge-count-paths

:::recap
- A topological order puts every edge pointing forward, so a DP over a DAG needs
  no memoisation and no ordering argument: one sweep, and every predecessor is
  already final.
- Kahn takes vertices whose in-degree has reached zero; reverse DFS finishing
  order does the same job. Both are valid and they usually differ — measured
  here, identical on only 547 of 3,000 random DAGs.
- Kahn emitting fewer than `n` vertices *is* the cycle test, and the missing
  vertices are those on or downstream of a cycle.
- Swapping Kahn's queue for a min-heap gives the lexicographically smallest
  order, verified here against a brute-force search over permutations.
- Longest path is NP-hard in general and a one-line sweep on a DAG: 127 ms
  against 183 ms for a memoised search on 200,000 vertices, and no stack to
  overflow.
- Every DAG DP is a base case at the sources, a relaxation along each edge, and
  a sweep in topological order. Push or pull depending on which adjacency you
  have.
:::
