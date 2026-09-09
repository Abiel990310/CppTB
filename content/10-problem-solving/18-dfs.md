---
title: "DFS: components, cycles, bridges"
navTitle: "DFS"
summary: >-
  The same loop as BFS with a stack instead of a queue — and the three things
  that only a depth-first order can tell you.
objectives:
  - Write DFS iteratively and know when the recursive form will overflow
  - Count connected components
  - Detect a cycle in a directed graph with three colours
  - Find bridges with entry times and low-links
  - Use entry/exit intervals as an ancestor test
status: complete
standard: c++20
requires: [bfs]
---

Breadth-first search answers "how far". Depth-first search answers questions
about *structure*: what is connected to what, whether a cycle exists, which
edges hold the graph together. The code is BFS with a stack, and everything
interesting comes from the order in which vertices are finished.

## The stack, and the one that overflows

```cpp run title="Two hundred thousand deep"
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <sys/resource.h>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

std::vector<std::vector<int>> g;
std::vector<char> seen;
std::uintptr_t deepest = 0;

// A recursive DFS, instrumented to report how much stack one frame costs.
void dfs_recursive(int v, int depth, int limit) {
    seen[v] = 1;
    if (depth == limit) { deepest = reinterpret_cast<std::uintptr_t>(&v); return; }
    for (int w : g[v]) if (!seen[w]) dfs_recursive(w, depth + 1, limit);
}

// The same walk with the stack made explicit -- no depth limit but the heap.
int components_iterative(const std::vector<std::vector<int>>& adj) {
    int n = static_cast<int>(adj.size());
    std::vector<char> visited(n, 0);
    std::vector<int> stack;
    int components = 0;
    for (int s = 0; s < n; ++s) {
        if (visited[s]) continue;
        ++components;
        visited[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            stack.pop_back();
            for (int w : adj[v])
                if (!visited[w]) { visited[w] = 1; stack.push_back(w); }
        }
    }
    return components;
}

int main() {
    // A path of 200,000 vertices, plus two isolated ones.
    const int n = 200'002;
    g.assign(n, {});
    for (int i = 0; i + 1 < n - 2; ++i) { g[i].push_back(i + 1); g[i + 1].push_back(i); }

    auto t0 = std::chrono::steady_clock::now();
    int parts = components_iterative(g);
    double ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();
    keep(parts);
    std::printf("iterative DFS over %d vertices: %d components in %.1f ms\n",
                n, parts, ms);

    // Measure this function's frame cost at a depth that is certainly safe.
    volatile int marker = 0;
    std::uintptr_t top = reinterpret_cast<std::uintptr_t>(&marker);
    const int probe = 2000;
    seen.assign(n, 0);
    dfs_recursive(0, 0, probe);
    std::size_t span = top > deepest ? top - deepest : deepest - top;
    double per_frame = static_cast<double>(span) / probe;

    rlimit rl{};
    getrlimit(RLIMIT_STACK, &rl);
    double limit_frames = rl.rlim_cur == RLIM_INFINITY
        ? 0 : static_cast<double>(rl.rlim_cur) / per_frame;

    std::printf("one recursive DFS frame costs about %.0f bytes here\n", per_frame);
    std::printf("stack limit %.1f MB, so about %.0f frames -- and the path needs %d\n",
                static_cast<double>(rl.rlim_cur) / (1024 * 1024), limit_frames, n - 2);
    std::printf("recursing over this graph would %s\n",
                limit_frames < n - 2 ? "overflow the stack" : "fit");
}
```

Three components found in 80 ms, and the measurement that matters: a recursive
DFS frame costs about 854 bytes in this build, an 8 MB stack holds about 9,800
of them, and the path needs 200,000. The sample does not run that recursion,
because it would not survive it.

**A graph with 2 × 10⁵ vertices can be 2 × 10⁵ deep.** Long paths are not
exotic — a linked list, a caterpillar tree, a grid corridor — and a recursive
DFS on one is a segfault reported as "runtime error" with no line number. The
build here inflates the frame (chapter 10.11 measured about 80 bytes without
sanitizers, giving roughly 100,000 frames), so the exact threshold moves; the
conclusion does not.

The iterative form is the same algorithm with the recursion stack written out:

- **`std::vector<int>` as the stack**, with `back()` and `pop_back()`. This is
  the only difference from BFS, which uses `front()` and `pop()`.
- **Mark on push**, exactly as in BFS, so each vertex enters once.
- **The visit order differs from recursive DFS** — the neighbours come off the
  stack in reverse — which does not matter for connectivity and does matter if
  you are printing an order. Push the neighbours in reverse to match.

This simple form is enough for components and reachability. The next two
sections need something the simple form throws away: the moment a vertex is
*finished*.

## Three colours, and a cycle

A directed graph has a cycle exactly when a DFS finds an edge back to a vertex
that is still on the current path.

```cpp run title="White, grey, black"
#include <cstdio>
#include <random>
#include <vector>

// White = 0 (unvisited), grey = 1 (on the current path), black = 2 (finished).
// A grey neighbour is a back edge, which is a cycle.
bool has_cycle(const std::vector<std::vector<int>>& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> colour(n, 0);
    std::vector<int> stack, iter(n, 0);

    for (int s = 0; s < n; ++s) {
        if (colour[s] != 0) continue;
        colour[s] = 1;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(g[v].size())) {
                int w = g[v][iter[v]++];
                if (colour[w] == 1) return true;        // grey: back edge
                if (colour[w] == 0) { colour[w] = 1; stack.push_back(w); }
            } else {
                colour[v] = 2;                          // finished
                stack.pop_back();
            }
        }
    }
    return false;
}

// Reference: v is on a cycle exactly when v can reach itself in one or more steps.
bool has_cycle_brute(const std::vector<std::vector<int>>& g) {
    int n = static_cast<int>(g.size());
    std::vector<std::vector<char>> reach(n, std::vector<char>(n, 0));
    for (int v = 0; v < n; ++v) for (int w : g[v]) reach[v][w] = 1;
    for (int k = 0; k < n; ++k)                          // transitive closure
        for (int i = 0; i < n; ++i)
            if (reach[i][k])
                for (int j = 0; j < n; ++j)
                    if (reach[k][j]) reach[i][j] = 1;
    for (int v = 0; v < n; ++v) if (reach[v][v]) return true;
    return false;
}

int main() {
    std::printf("0->1->2->0        : %s\n",
                has_cycle({{1}, {2}, {0}}) ? "cycle" : "acyclic");
    std::printf("0->1, 0->2, 1->2  : %s\n",
                has_cycle({{1, 2}, {2}, {}}) ? "cycle" : "acyclic");
    std::printf("self-loop 0->0    : %s\n",
                has_cycle({{0}}) ? "cycle" : "acyclic");

    std::mt19937 rng(33);
    int cyclic = 0, checked = 0;
    bool ok = true;
    for (int trial = 0; trial < 4000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 7);
        std::vector<std::vector<int>> g(n);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v)
                if (rng() % 100 < 20) g[u].push_back(v);
        bool a = has_cycle(g), b = has_cycle_brute(g);
        if (a != b) ok = false;
        if (b) ++cyclic;
        ++checked;
    }
    std::printf("%d random digraphs (%d cyclic) agree with the transitive closure: %s\n",
                checked, cyclic, ok ? "yes" : "NO");
}
```

4,000 random directed graphs, 2,493 of them cyclic, all agreeing with a
transitive closure that asks whether any vertex reaches itself.

The three colours are the whole idea, and each has to be distinguishable:

- **White**: not yet visited.
- **Grey**: visited and still on the stack — an *ancestor* of the current
  vertex.
- **Black**: visited and finished — its whole subtree is explored.

An edge to a **grey** vertex is a back edge and proves a cycle. An edge to a
**black** vertex is a cross or forward edge and proves nothing. Collapsing grey
and black into a single "visited" flag is the classic mistake: it reports a
cycle on `0→1, 0→2, 1→2`, which is a perfectly good DAG.

Note the shape of the loop. Simple DFS pops a vertex and is done with it; here a
vertex stays on the stack, with `iter[v]` remembering how far through its
neighbour list we are, until every neighbour is explored — and only then turns
black. **That `iter` array is what makes an iterative DFS able to do anything a
recursive one can**, because it recreates the "after the recursive call returns"
moment that the simple form has no place for.

For an **undirected** graph the test is different: any edge to a visited vertex
that is not the edge you arrived on is a cycle, and the colours are unnecessary.

## Bridges

An edge is a bridge when removing it disconnects the graph. DFS finds all of
them in one pass, using the earliest entry time reachable from each subtree.

```cpp run title="Low-links, checked by removing every edge"
#include <algorithm>
#include <cstdio>
#include <random>
#include <utility>
#include <vector>

// Tarjan's low-link, iteratively. An edge (v, w) is a bridge when the subtree
// at w can reach nothing above w except through that edge.
std::vector<std::pair<int, int>> bridges(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<std::pair<int, int>>> adj(n);   // (neighbour, edge id)
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        adj[edges[i].first].emplace_back(edges[i].second, i);
        adj[edges[i].second].emplace_back(edges[i].first, i);
    }

    std::vector<int> entry(n, -1), low(n, 0), iter(n, 0), parent_edge(n, -1);
    std::vector<int> stack;
    std::vector<std::pair<int, int>> found;
    int timer = 0;

    for (int s = 0; s < n; ++s) {
        if (entry[s] != -1) continue;
        entry[s] = low[s] = timer++;
        stack.push_back(s);
        while (!stack.empty()) {
            int v = stack.back();
            if (iter[v] < static_cast<int>(adj[v].size())) {
                auto [w, id] = adj[v][iter[v]++];
                if (id == parent_edge[v]) continue;         // do not re-cross the same edge
                if (entry[w] == -1) {
                    parent_edge[w] = id;
                    entry[w] = low[w] = timer++;
                    stack.push_back(w);
                } else {
                    low[v] = std::min(low[v], entry[w]);    // an edge to an ancestor
                }
            } else {
                stack.pop_back();
                if (!stack.empty()) {
                    int p = stack.back();
                    low[p] = std::min(low[p], low[v]);
                    if (low[v] > entry[p]) found.emplace_back(std::min(p, v), std::max(p, v));
                }
            }
        }
    }
    std::sort(found.begin(), found.end());
    return found;
}

// Reference: remove one edge and see whether the component count rises.
int count_components(int n, const std::vector<std::pair<int, int>>& edges, int skip) {
    std::vector<std::vector<int>> adj(n);
    for (int i = 0; i < static_cast<int>(edges.size()); ++i) {
        if (i == skip) continue;
        adj[edges[i].first].push_back(edges[i].second);
        adj[edges[i].second].push_back(edges[i].first);
    }
    std::vector<char> seen(n, 0);
    std::vector<int> st;
    int parts = 0;
    for (int s = 0; s < n; ++s) {
        if (seen[s]) continue;
        ++parts; seen[s] = 1; st.push_back(s);
        while (!st.empty()) {
            int v = st.back(); st.pop_back();
            for (int w : adj[v]) if (!seen[w]) { seen[w] = 1; st.push_back(w); }
        }
    }
    return parts;
}

std::vector<std::pair<int, int>> bridges_brute(int n, const std::vector<std::pair<int, int>>& edges) {
    int base = count_components(n, edges, -1);
    std::vector<std::pair<int, int>> found;
    for (int i = 0; i < static_cast<int>(edges.size()); ++i)
        if (count_components(n, edges, i) > base)
            found.emplace_back(std::min(edges[i].first, edges[i].second),
                               std::max(edges[i].first, edges[i].second));
    std::sort(found.begin(), found.end());
    return found;
}

int main() {
    // A triangle with a tail: 0-1-2-0 and 2-3.
    std::vector<std::pair<int, int>> g1{{0, 1}, {1, 2}, {2, 0}, {2, 3}};
    auto b1 = bridges(4, g1);
    std::printf("triangle 0-1-2 plus tail 2-3: %zu bridge(s):", b1.size());
    for (auto [u, v] : b1) std::printf(" (%d,%d)", u, v);
    std::printf("\n");

    // A path: every edge is a bridge.
    std::vector<std::pair<int, int>> g2{{0, 1}, {1, 2}, {2, 3}};
    std::printf("path of 4 vertices: %zu bridges\n", bridges(4, g2).size());

    std::mt19937 rng(41);
    bool ok = true;
    int with_bridges = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 7);
        std::vector<std::pair<int, int>> e;
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 35) e.emplace_back(u, v);
        auto a = bridges(n, e), b = bridges_brute(n, e);
        if (a != b) ok = false;
        if (!b.empty()) ++with_bridges;
    }
    std::printf("3000 random graphs (%d with bridges) agree with edge removal: %s\n",
                with_bridges, ok ? "yes" : "NO");
}
```

One bridge in the triangle-with-a-tail, three in a four-vertex path, and 3,000
random graphs agreeing with the definition — remove the edge, count the
components.

Two numbers per vertex carry the whole argument:

- **`entry[v]`** — when `v` was first reached. Earlier means higher in the DFS
  tree.
- **`low[v]`** — the smallest `entry` reachable from `v`'s subtree using tree
  edges downwards and at most one non-tree edge upwards.

Then `(p, v)` with `v` a child of `p` is a bridge exactly when `low[v] >
entry[p]`: nothing under `v` can reach `p` or above except through that edge.
Change `>` to `>=` and you get the test for an **articulation point** instead,
which is the same walk answering a different question.

**Use edge ids, not the parent vertex.** `if (id == parent_edge[v]) continue;`
skips the specific edge you arrived on. The common shortcut, `if (w == parent[v])
continue;`, skips *every* edge to the parent — so a pair of parallel edges
between `p` and `v` is reported as a bridge when it is not. Parallel edges are
rare in statements that say "simple graph" and common in ones that do not.

## Entry and exit times

The same two timestamps answer ancestry questions in O(1), which is what
chapter 10.25's binary lifting and 10.35's decompositions are built on.

```cpp run title="A subtree is an interval"
#include <cstdio>
#include <random>
#include <vector>

// Entry and exit times from one DFS over a rooted tree.
void times(const std::vector<std::vector<int>>& children, int root,
           std::vector<int>& tin, std::vector<int>& tout) {
    int timer = 0;
    std::vector<int> stack{root}, iter(children.size(), 0);
    tin[root] = timer++;
    while (!stack.empty()) {
        int v = stack.back();
        if (iter[v] < static_cast<int>(children[v].size())) {
            int w = children[v][iter[v]++];
            tin[w] = timer++;
            stack.push_back(w);
        } else {
            tout[v] = timer++;
            stack.pop_back();
        }
    }
}

int main() {
    // A small tree: 0 -> 1, 2 ; 1 -> 3, 4 ; 2 -> 5
    std::vector<std::vector<int>> children{{1, 2}, {3, 4}, {5}, {}, {}, {}};
    std::vector<int> tin(6), tout(6);
    times(children, 0, tin, tout);
    for (int v = 0; v < 6; ++v)
        std::printf("vertex %d: [%2d, %2d)\n", v, tin[v], tout[v]);

    auto is_ancestor = [&](int u, int v) {
        return tin[u] <= tin[v] && tout[v] <= tout[u];
    };
    std::printf("0 is an ancestor of 5: %s\n", is_ancestor(0, 5) ? "yes" : "no");
    std::printf("1 is an ancestor of 5: %s\n", is_ancestor(1, 5) ? "yes" : "no");
    std::printf("3 is an ancestor of 4: %s\n", is_ancestor(3, 4) ? "yes" : "no");

    // Cross-check the interval test against walking up the parent chain.
    std::mt19937 rng(55);
    bool ok = true;
    int checked = 0;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 12);
        std::vector<int> parent(n, -1);
        std::vector<std::vector<int>> kids(n);
        for (int v = 1; v < n; ++v) {
            parent[v] = static_cast<int>(rng() % v);
            kids[parent[v]].push_back(v);
        }
        std::vector<int> a(n), b(n);
        times(kids, 0, a, b);
        for (int u = 0; u < n; ++u)
            for (int v = 0; v < n; ++v) {
                bool interval = a[u] <= a[v] && b[v] <= b[u];
                bool walked = false;
                for (int x = v; x != -1; x = parent[x]) if (x == u) walked = true;
                if (interval != walked) ok = false;
                ++checked;
            }
    }
    std::printf("%d ancestor questions over 2000 random trees agree: %s\n",
                checked, ok ? "yes" : "NO");
}
```

Vertex 0 spans `[0, 11)`, its child 1 spans `[1, 6)` — strictly inside — and
107,615 ancestor questions over 2,000 random trees agree with walking the parent
chain.

The property is worth stating once, carefully: **`u` is an ancestor of `v`
exactly when `[tin[v], tout[v]]` is contained in `[tin[u], tout[u]]`.** DFS
intervals are either nested or disjoint, never partially overlapping, because a
vertex is finished before its parent is. That single fact turns tree questions
into interval questions, and interval questions into array questions — which is
how a subtree becomes a contiguous range that a Fenwick tree or segment tree can
update in one operation.

Two conventions are in use and both appear in other people's code: incrementing
the timer on exit as well as on entry (as here, giving `2n` distinct times), or
only on entry (giving `tout[v]` as the largest `tin` in the subtree). The
containment test differs by one `<` versus `<=` between them. Pick one and check
it against a tiny tree.

:::quiz
{
  "question": "You detect cycles in a directed graph with a single `visited` array: if a neighbour is already visited, report a cycle. What happens on the graph 0→1, 0→2, 1→2?",
  "options": [
    { "text": "It reports a cycle where there is none: vertex 2 is visited via 1 and then reached again from 0, but it is finished rather than on the current path", "correct": true, "why": "Only an edge to a vertex still on the stack — grey — is a back edge. An edge to a finished vertex is a cross or forward edge and is perfectly legal in a DAG, which is why the three colours are needed rather than two." },
    { "text": "Nothing: the graph is acyclic and the check reports so", "why": "Vertex 2 is reached twice, from 1 and from 0. With only a visited flag the second arrival looks the same as a back edge." },
    { "text": "It misses cycles rather than inventing them", "why": "The error is in the other direction. A visited flag is too strict, not too loose: everything a three-colour search would call a back edge, it also flags, plus edges that are not." },
    { "text": "It works for directed graphs but fails for undirected ones", "why": "It is the directed case that needs the distinction. Undirected DFS uses a different test — any edge to a visited vertex other than the one you arrived on." }
  ]
}
:::

## Practice

:::exercise dfs-audit

:::exercise bridges-and-cuts

:::exercise judge-components

:::exercise judge-cycle-detection

:::recap
- DFS is BFS with a stack. Mark on push, exactly as in BFS.
- A recursive DFS frame costs about 854 bytes in this build, so an 8 MB stack
  holds roughly 9,800 — and a graph with 2 × 10⁵ vertices can be 2 × 10⁵ deep.
  Long paths are ordinary, and the failure is a segfault with no line number.
- An iterative DFS that needs the *finish* moment keeps an `iter[v]` cursor per
  vertex, so a vertex leaves the stack only when its neighbour list is
  exhausted. That is what recreates "after the recursive call returns".
- Directed cycle detection needs three colours: an edge to a **grey** vertex is
  a back edge, an edge to a **black** one proves nothing. Two colours report a
  cycle on the DAG `0→1, 0→2, 1→2`.
- `low[v] > entry[p]` marks a bridge; `>=` marks an articulation point. Skip the
  edge you arrived on by its **id**, not by the parent vertex, or parallel edges
  are misreported.
- A subtree is an interval: `u` is an ancestor of `v` exactly when `v`'s
  `[tin, tout]` sits inside `u`'s. Checked here on 107,615 pairs.
:::
