---
title: "Union-Find"
navTitle: "Union-Find"
summary: >-
  Two arrays, twenty lines, and a structure that answers "are these connected"
  fast enough that the answer stops being the interesting part.
objectives:
  - Implement find with path compression and union by size
  - Measure what each optimisation is worth
  - Maintain component counts and sizes as edges arrive
  - Answer deletion queries offline by running time backwards
  - Encode a two-sided constraint by doubling the vertices
status: complete
standard: c++20
requires: [topological-order]
---

A disjoint-set union — union-find, DSU — keeps a partition of `0 … n-1` under
two operations: merge two parts, and ask which part something is in. It is the
smallest data structure in this part of the book and one of the most useful,
because a surprising number of problems are "which things are connected"
underneath.

The whole structure is a `parent` array. Everything else is two optimisations,
and it is worth seeing what they are worth.

## What the optimisations buy

```cpp run title="No optimisation, path compression, and both"
#include <chrono>
#include <cstdio>
#include <numeric>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long steps = 0;

// Neither optimisation: find walks to the root, union hangs one root on the other.
struct Plain {
    std::vector<int> parent;
    explicit Plain(int n) : parent(n) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int v) { while (parent[v] != v) { ++steps; v = parent[v]; } return v; }
    void unite(int a, int b) { a = find(a); b = find(b); if (a != b) parent[a] = b; }
};

// Path compression only: every node on the path is reattached to the root.
struct Compressed {
    std::vector<int> parent;
    explicit Compressed(int n) : parent(n) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int v) {
        int root = v;
        while (parent[root] != root) { ++steps; root = parent[root]; }
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    void unite(int a, int b) { a = find(a); b = find(b); if (a != b) parent[a] = b; }
};

// Both: the smaller tree is hung under the larger one.
struct Both {
    std::vector<int> parent, size;
    explicit Both(int n) : parent(n), size(n, 1) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int v) {
        int root = v;
        while (parent[root] != root) { ++steps; root = parent[root]; }
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
    }
};

template <class DSU>
std::pair<double, long long> run(int n, const char* label) {
    DSU dsu(n);
    steps = 0;
    auto t0 = std::chrono::steady_clock::now();
    for (int v = 0; v + 1 < n; ++v) dsu.unite(v, v + 1);   // build one long chain
    long long roots = 0;
    for (int v = 0; v < n; ++v) if (dsu.find(v) == dsu.find(0)) ++roots;
    double ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();
    keep(dsu.parent);
    std::printf("  %-18s %8.1f ms, %11lld parent hops, %lld in one set\n",
                label, ms, steps, roots);
    return {ms, steps};
}

int main() {
    const int n = 10'000;
    std::printf("n = %d, unite(v, v+1) for every v, then find() on all of them\n", n);
    run<Plain>(n, "no optimisation");
    run<Compressed>(n, "path compression");
    run<Both>(n, "compression + size");
}
```

1,799 ms and 150 million parent hops with no optimisation; 1.3 ms and 30
thousand hops with path compression; 1.9 ms and 20 thousand hops with both.

Read that carefully, because it does not say what people usually claim.

- **Path compression is the one that matters here.** Uniting `v` with `v+1` in
  order builds a chain, and without compression each `find` walks it — O(n²) in
  total, which is the 150 million.
- **Union by size does fewer hops and costs slightly more time** at this size.
  The bookkeeping is a comparison and an addition per union, and on this
  workload compression alone has already flattened the trees.
- **Both together are what the O(α(n)) bound requires.** α is the inverse
  Ackermann function, under 5 for any input that fits in the universe, and the
  guarantee needs both optimisations. Compression alone is O(log n) amortised,
  which is why it wins on a friendly workload and is not what you want against
  an adversarial one.

In a contest, write both. They are four extra lines and the difference between
"fast" and "provably fast".

The `find` here is written iteratively — walk to the root, then walk again
reattaching — rather than as `return parent[v] = find(parent[v]);`. The
recursive one-liner is prettier and is a recursion as deep as the tree, which on
an un-compressed chain of 2 × 10⁵ is a stack overflow (chapter 10.18 measures
the available depth).

## Connectivity as edges arrive

```cpp run title="Components, cycles, and sizes, one edge at a time"
#include <algorithm>
#include <cstdio>
#include <numeric>
#include <queue>
#include <random>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    int components;
    explicit Dsu(int n) : parent(n), size(n, 1), components(n) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int v) {
        int root = v;
        while (parent[root] != root) root = parent[root];
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    // Returns false when a and b were already together -- that edge closes a cycle.
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a;
        size[a] += size[b];
        --components;
        return true;
    }
    int component_size(int v) { return size[find(v)]; }
};

// Reference: rebuild the graph and count components from scratch.
int components_bfs(int n, const std::vector<std::pair<int, int>>& edges, int upto) {
    std::vector<std::vector<int>> adj(n);
    for (int i = 0; i < upto; ++i) {
        adj[edges[i].first].push_back(edges[i].second);
        adj[edges[i].second].push_back(edges[i].first);
    }
    std::vector<char> seen(n, 0);
    int parts = 0;
    std::vector<int> st;
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

int main() {
    std::vector<std::pair<int, int>> edges{{0, 1}, {2, 3}, {1, 2}, {0, 3}, {4, 4}};
    Dsu dsu(5);
    std::printf("edge        joins?  components  size of 0's set\n");
    for (auto [u, v] : edges) {
        bool joined = dsu.unite(u, v);
        std::printf("  %d - %d       %-4s      %2d           %d\n",
                    u, v, joined ? "yes" : "no", dsu.components, dsu.component_size(0));
    }

    std::mt19937 rng(90);
    bool ok = true;
    for (int trial = 0; trial < 2000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 9);
        int m = static_cast<int>(rng() % 12);
        std::vector<std::pair<int, int>> e;
        for (int i = 0; i < m; ++i)
            e.emplace_back(static_cast<int>(rng() % n), static_cast<int>(rng() % n));
        Dsu d(n);
        for (int i = 0; i < m; ++i) {
            d.unite(e[i].first, e[i].second);
            if (d.components != components_bfs(n, e, i + 1)) ok = false;
        }
    }
    std::printf("2000 random edge sequences match a rebuilt-from-scratch count: %s\n",
                ok ? "yes" : "NO");
}
```

The component count falls from 5 to 2 and then stops; the fourth edge and the
self-loop join nothing. 2,000 random sequences agree with rebuilding the graph
after every edge.

Three things fall out of the twenty lines, and they are why DSU appears so
often:

- **`unite` returning `false` is a cycle test.** In an undirected graph, an edge
  whose endpoints are already together closes a cycle. That is the whole of
  Kruskal's algorithm's edge filter (chapter 10.23).
- **`components` is maintained for free**, decremented on each real merge.
- **`size[find(v)]` is the size of `v`'s component**, and any other
  per-component quantity — a maximum, a sum, a count of marked vertices — rides
  along the same way, updated in `unite` when the two roots merge.

What DSU does *not* do is remove an edge. The structure only ever merges, which
is why "are these two connected" is easy and "are they still connected after
this deletion" is not.

## Running time backwards

When the deletions are all known in advance, reverse them: a sequence of
removals read from the end is a sequence of additions.

```cpp run title="40,000 deletions, answered by adding"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <numeric>
#include <random>
#include <utility>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

struct Dsu {
    std::vector<int> parent, size;
    int components;
    explicit Dsu(int n) : parent(n), size(n, 1), components(n) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int v) {
        int root = v;
        while (parent[root] != root) root = parent[root];
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    bool unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return false;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a; size[a] += size[b]; --components;
        return true;
    }
};

// Edges are removed one at a time. Report the component count after each
// removal -- by running time backwards and adding them instead.
std::vector<int> components_after_each_removal(
        int n, const std::vector<std::pair<int, int>>& edges,
        const std::vector<int>& removal_order) {
    std::vector<char> removed(edges.size(), 0);
    for (int id : removal_order) removed[id] = 1;

    Dsu dsu(n);
    for (std::size_t i = 0; i < edges.size(); ++i)          // everything that survives
        if (!removed[i]) dsu.unite(edges[i].first, edges[i].second);

    std::vector<int> answer(removal_order.size());
    for (int step = static_cast<int>(removal_order.size()) - 1; step >= 0; --step) {
        answer[step] = dsu.components;                      // state after this removal
        int id = removal_order[step];
        dsu.unite(edges[id].first, edges[id].second);       // put the edge back
    }
    return answer;
}

int components_bfs(int n, const std::vector<std::pair<int, int>>& edges,
                   const std::vector<char>& removed) {
    std::vector<std::vector<int>> adj(n);
    for (std::size_t i = 0; i < edges.size(); ++i)
        if (!removed[i]) {
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

int main() {
    std::mt19937 rng(101);
    bool ok = true;
    for (int trial = 0; trial < 1500; ++trial) {
        int n = 2 + static_cast<int>(rng() % 7);
        int m = 1 + static_cast<int>(rng() % 10);
        std::vector<std::pair<int, int>> e;
        for (int i = 0; i < m; ++i)
            e.emplace_back(static_cast<int>(rng() % n), static_cast<int>(rng() % n));
        std::vector<int> order(m);
        std::iota(order.begin(), order.end(), 0);
        std::shuffle(order.begin(), order.end(), rng);
        int k = 1 + static_cast<int>(rng() % m);
        order.resize(k);

        std::vector<int> fast = components_after_each_removal(n, e, order);
        std::vector<char> removed(m, 0);
        for (int step = 0; step < k; ++step) {
            removed[order[step]] = 1;
            if (fast[step] != components_bfs(n, e, removed)) ok = false;
        }
    }
    std::printf("1500 random removal sequences match a rebuild after each step: %s\n",
                ok ? "yes" : "NO");

    const int n = 20'000, m = 40'000;
    std::vector<std::pair<int, int>> e;
    for (int i = 0; i < m; ++i)
        e.emplace_back(static_cast<int>(rng() % n), static_cast<int>(rng() % n));
    std::vector<int> order(m);
    std::iota(order.begin(), order.end(), 0);
    std::shuffle(order.begin(), order.end(), rng);

    auto t0 = std::chrono::steady_clock::now();
    std::vector<int> answer = components_after_each_removal(n, e, order);
    double fast_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t0).count();

    std::vector<char> removed(m, 0);
    auto t1 = std::chrono::steady_clock::now();
    int rebuilds = 20;                                    // only a sample of them
    for (int step = 0; step < rebuilds; ++step) {
        removed[order[step]] = 1;
        keep(components_bfs(n, e, removed));
    }
    double slow_ms = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - t1).count();

    keep(answer);
    std::printf("n = %d, %d edges, %d removals\n", n, m, m);
    std::printf("  offline, reversed  %8.1f ms for all %d answers\n", fast_ms, m);
    std::printf("  rebuilding         %8.1f ms for just the first %d\n", slow_ms, rebuilds);
    std::printf("  so all %d would take about %.0f ms\n",
                m, slow_ms / rebuilds * m);
}
```

8.2 ms for all 40,000 answers, against 1,261 ms for the first twenty rebuilds —
which extrapolates to about forty minutes for the lot. 1,500 random removal
sequences confirm the answers are the same ones.

The trick has a shape worth naming, because it is used far beyond connectivity:

1. **Apply everything that is never removed.**
2. **Walk the removal list backwards**, recording the answer *before* each
   undone removal and then undoing it.
3. **The recorded answers come out in forward order** because you filled the
   array from the back.

The precondition is that the whole sequence is known in advance — the technique
is *offline*. A problem that interleaves deletions with queries it must answer
immediately needs something else: a link-cut tree, or a segment tree over time
with rollback. Read the input format: if the queries all arrive before any
answer is required, reversing is available.

## Doubling the vertices

A DSU stores "these are the same". Constraints of the form "these are
*different*" can be encoded by giving every vertex two nodes.

```cpp run title="Bipartiteness without colours"
#include <algorithm>
#include <cstdio>
#include <numeric>
#include <queue>
#include <random>
#include <utility>
#include <vector>

struct Dsu {
    std::vector<int> parent, size;
    explicit Dsu(int n) : parent(n), size(n, 1) { std::iota(parent.begin(), parent.end(), 0); }
    int find(int v) {
        int root = v;
        while (parent[root] != root) root = parent[root];
        while (parent[v] != root) { int next = parent[v]; parent[v] = root; v = next; }
        return root;
    }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) std::swap(a, b);
        parent[b] = a; size[a] += size[b];
    }
    bool same(int a, int b) { return find(a) == find(b); }
};

// Two nodes per vertex: v means "v on side A", v + n means "v on side B".
// An edge u-v says they are on opposite sides.
bool bipartite_dsu(int n, const std::vector<std::pair<int, int>>& edges) {
    Dsu dsu(2 * n);
    for (auto [u, v] : edges) {
        if (dsu.same(u, v)) return false;          // forced onto the same side
        dsu.unite(u, v + n);
        dsu.unite(v, u + n);
    }
    return true;
}

// Reference: two-colour with BFS.
bool bipartite_bfs(int n, const std::vector<std::pair<int, int>>& edges) {
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) { adj[u].push_back(v); adj[v].push_back(u); }
    std::vector<int> colour(n, -1);
    for (int s = 0; s < n; ++s) {
        if (colour[s] != -1) continue;
        colour[s] = 0;
        std::queue<int> q;
        q.push(s);
        while (!q.empty()) {
            int v = q.front(); q.pop();
            for (int w : adj[v]) {
                if (colour[w] == -1) { colour[w] = 1 - colour[v]; q.push(w); }
                else if (colour[w] == colour[v]) return false;
            }
        }
    }
    return true;
}

int main() {
    std::printf("a 4-cycle   : %s\n",
                bipartite_dsu(4, {{0, 1}, {1, 2}, {2, 3}, {3, 0}}) ? "bipartite" : "not");
    std::printf("a triangle  : %s\n",
                bipartite_dsu(3, {{0, 1}, {1, 2}, {2, 0}}) ? "bipartite" : "not");
    std::printf("a self-loop : %s\n",
                bipartite_dsu(1, {{0, 0}}) ? "bipartite" : "not");
    std::printf("a forest    : %s\n",
                bipartite_dsu(4, {{0, 1}, {2, 3}}) ? "bipartite" : "not");

    std::mt19937 rng(111);
    bool ok = true;
    int bip = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 8);
        std::vector<std::pair<int, int>> e;
        for (int u = 0; u < n; ++u)
            for (int v = u + 1; v < n; ++v)
                if (rng() % 100 < 30) e.emplace_back(u, v);
        bool a = bipartite_dsu(n, e), b = bipartite_bfs(n, e);
        if (a != b) ok = false;
        if (b) ++bip;
    }
    std::printf("3000 random graphs (%d bipartite) agree with BFS colouring: %s\n",
                bip, ok ? "yes" : "NO");
}
```

Even cycles are bipartite, odd ones are not, a self-loop never is, and 3,000
random graphs agree with a BFS two-colouring.

The encoding is the idea. Vertex `v` becomes two nodes: `v` meaning "`v` is on
side A" and `v + n` meaning "`v` is on side B". An edge `u–v` says they differ,
which is two merges — `u` with `v+n`, and `v` with `u+n` — and the graph is not
bipartite as soon as some `u` and `v` joined by an edge are already forced
together.

The same doubling handles "these two people must be in different teams", "this
variable is the negation of that one", and 2-satisfiability's implication graph
in a weaker form. It is worth recognising as *the* way to put a negation into a
structure that only knows about equality.

For a graph with weights on the "same or different" relation — parity, or
distance modulo `k` — the alternative is a **weighted DSU** that stores each
node's offset from its root and adjusts it during path compression. That is
denser to write and generalises better; the doubling is the one to reach for
under time pressure.

:::quiz
{
  "question": "You write `find` recursively as `int find(int v) { return parent[v] == v ? v : parent[v] = find(parent[v]); }`. What is the risk at contest sizes?",
  "options": [
    { "text": "Before compression has flattened the tree, the recursion is as deep as the tree — up to n — so a chain of 2·10^5 vertices overflows the stack", "correct": true, "why": "Compression makes later calls shallow, but the *first* find on a long chain must walk the whole thing, and it does so with one stack frame per node. Chapter 10.18 measures roughly 9,800 frames available in this build." },
    { "text": "It is wrong: assigning inside the return value gives undefined behaviour", "why": "`parent[v] = find(parent[v])` is well defined — the assignment's value is the assigned value, and there is no conflicting access to the same object in the same expression." },
    { "text": "It defeats path compression, since the assignment happens after the recursion returns", "why": "That order is exactly what makes compression work: the recursive call finds the root, and the assignment reattaches this node to it on the way out." },
    { "text": "There is no risk; union by size keeps every tree O(log n) deep", "why": "It does — but only if you also implemented union by size. Many DSU implementations use compression alone, and even with both the risk is real if a single find happens before any union has balanced anything." }
  ]
}
:::

## Practice

:::exercise dsu-audit

:::exercise dsu-applications

:::exercise judge-connected-queries

:::exercise judge-offline-removals

:::recap
- A DSU is a `parent` array plus two optimisations. Measured on a chain of
  10,000: 1,799 ms and 150 million hops with neither, 1.3 ms with path
  compression, 1.9 ms with both — and the O(α(n)) guarantee needs both.
- Write `find` iteratively. The recursive one-liner is as deep as the tree before
  compression flattens it.
- `unite` returning `false` means the edge closed a cycle; `components` and
  `size[find(v)]` come along for free, and any other per-component quantity
  merges in `unite`.
- A DSU cannot delete. When every deletion is known in advance, run the sequence
  backwards and turn removals into merges: measured at 8.2 ms for 40,000 answers
  against an extrapolated forty minutes of rebuilding.
- To express "these must differ", give every vertex two nodes. Bipartiteness,
  team assignment and negation all use the same doubling.
:::
