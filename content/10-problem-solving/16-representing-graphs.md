---
title: "Representing graphs"
navTitle: "Representing graphs"
summary: >-
  Three ways to store a graph, the one that is nine times faster to build, and
  the graphs you never store at all.
objectives:
  - Choose between an adjacency list, a matrix, and an edge list
  - Build a compressed adjacency structure in one pass
  - Read a graph correctly: indexing, direction, self-loops, multi-edges
  - Treat a grid as a graph without materialising it
status: complete
standard: c++20
requires: [meet-in-the-middle]
---

Everything in Wave D — traversal, shortest paths, trees, flows — starts by
reading a graph into memory. That step is short enough to write without thinking
and consequential enough that it is worth thinking about once.

There are three representations and one non-representation.

| Form | Space | Neighbours of `v` | Is `u–v` an edge? |
|---|---|---|---|
| Adjacency list | O(n + m) | walk the list | O(deg v) |
| Adjacency matrix | O(n²) | scan a row, O(n) | O(1) |
| Edge list | O(m) | not directly | O(m) |
| Implicit (grid, state space) | O(1) | computed | computed |

For contest sizes — `n` and `m` up to a few hundred thousand — the answer is
almost always the adjacency list. The matrix is for `n ≤ 1000`, where n² is a
million; the edge list is for algorithms that sort edges (Kruskal, chapter
10.23) or relax them repeatedly (Bellman–Ford, 10.22).

## Two adjacency lists

The obvious `std::vector<std::vector<int>>` is one allocation per vertex. The
alternative stores the same information in two flat arrays, and the difference
is not small.

```cpp run title="Vector of vectors against compressed rows"
#include <chrono>
#include <cstdio>
#include <random>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    const int n = 200'000, m = 400'000;
    std::vector<std::pair<int, int>> edges;
    edges.reserve(m);
    std::mt19937 rng(4);
    for (int i = 0; i < m; ++i)
        edges.emplace_back(static_cast<int>(rng() % n), static_cast<int>(rng() % n));

    // 1. Vector of vectors: one allocation per vertex, pointers everywhere.
    auto t0 = std::chrono::steady_clock::now();
    std::vector<std::vector<int>> adj(n);
    for (auto [u, v] : edges) { adj[u].push_back(v); adj[v].push_back(u); }
    auto t1 = std::chrono::steady_clock::now();

    // 2. Compressed rows: count degrees, prefix-sum them, then fill.
    std::vector<int> start(n + 1, 0), target(2 * m);
    for (auto [u, v] : edges) { ++start[u + 1]; ++start[v + 1]; }
    for (int i = 0; i < n; ++i) start[i + 1] += start[i];      // a prefix sum (10.7)
    {
        std::vector<int> cursor(start.begin(), start.end() - 1);
        for (auto [u, v] : edges) { target[cursor[u]++] = v; target[cursor[v]++] = u; }
    }
    auto t2 = std::chrono::steady_clock::now();

    // Both must agree on every degree.
    bool same = true;
    for (int v = 0; v < n; ++v)
        if (static_cast<int>(adj[v].size()) != start[v + 1] - start[v]) same = false;

    // Walk every edge in each representation.
    auto t3 = std::chrono::steady_clock::now();
    long long sum1 = 0;
    for (int v = 0; v < n; ++v) for (int w : adj[v]) sum1 += w;
    auto t4 = std::chrono::steady_clock::now();
    long long sum2 = 0;
    for (int v = 0; v < n; ++v)
        for (int i = start[v]; i < start[v + 1]; ++i) sum2 += target[i];
    auto t5 = std::chrono::steady_clock::now();

    keep(adj); keep(target); keep(sum1); keep(sum2);
    auto ms = [](auto a, auto b) {
        return std::chrono::duration<double, std::milli>(b - a).count(); };
    std::printf("n = %d, m = %d\n", n, m);
    std::printf("  build vector<vector>  %7.1f ms\n", ms(t0, t1));
    std::printf("  build compressed rows %7.1f ms\n", ms(t1, t2));
    std::printf("  walk  vector<vector>  %7.1f ms\n", ms(t3, t4));
    std::printf("  walk  compressed rows %7.1f ms\n", ms(t4, t5));
    std::printf("  degrees agree: %s, sums agree: %s\n",
                same ? "yes" : "no", sum1 == sum2 ? "yes" : "no");
    std::printf("  an adjacency matrix would need %lld bytes\n",
                static_cast<long long>(n) * n / 8);
}
```

745 ms to build the vector of vectors against 80 ms for the compressed rows, and
70 ms against 16 ms to walk them. The same graph as a bit matrix would need five
gigabytes.

The compressed form — the same layout a sparse matrix uses, and often called CSR
— is three passes and no per-vertex allocation:

1. **Count.** `++start[u + 1]` for each endpoint, so `start[v + 1]` ends up
   holding the degree of `v`.
2. **Prefix-sum.** `start[i + 1] += start[i]`, which turns degrees into offsets.
   This is chapter 10.7's construction, and the shift by one is what makes
   `start[v]` the first index of `v`'s block.
3. **Fill.** A cursor per vertex, initialised to `start[v]` and incremented as
   each neighbour lands.

Whether it is worth it depends. `std::vector<std::vector<int>>` is two lines,
reads better, and is fast enough for most problems. The gap survives
optimisation but shrinks: at `-O2` the same program reports 87 ms against 13 ms
to build and 5.9 ms against 2.2 ms to walk — still six and three times, on a
graph that takes a few tens of milliseconds either way. Reach for the compressed
form when the graph is large and the traversal is the inner loop of something
that runs many times.

What does not shrink with optimisation is the memory: 200,000 `std::vector`
headers are 24 bytes each before a single edge is stored, and the edges
themselves land in 200,000 separate heap blocks.

The middle ground worth knowing: `adj[v].reserve(degree[v])` after a counting
pass gives most of the locality with none of the index arithmetic.

## Reading it correctly

More contest submissions fail here than in the algorithm.

```cpp run title="One-indexed input, self-loops, and repeats"
#include <algorithm>
#include <cstdio>
#include <sstream>
#include <string>
#include <vector>

int main() {
    // A typical input block: n vertices, m edges, 1-indexed, undirected.
    // It contains a self-loop (4 4) and a repeated edge (1 2 twice).
    const std::string input =
        "5 6\n"
        "1 2\n"
        "2 3\n"
        "1 2\n"
        "3 1\n"
        "4 4\n"
        "4 5\n";

    std::istringstream in(input);
    int n, m;
    in >> n >> m;

    std::vector<std::vector<int>> adj(n);          // 0-indexed internally
    std::vector<std::pair<int, int>> edges;
    for (int i = 0; i < m; ++i) {
        int u, v;
        in >> u >> v;
        --u; --v;                                  // the one line everybody forgets
        edges.emplace_back(u, v);
        adj[u].push_back(v);
        if (u != v) adj[v].push_back(u);           // a self-loop is stored once
    }

    std::printf("degrees (self-loop counted once):");
    for (int v = 0; v < n; ++v) std::printf(" %zu", adj[v].size());
    std::printf("\n");

    // Distinct neighbours, if the problem says multi-edges do not matter.
    std::printf("distinct neighbours          :");
    for (int v = 0; v < n; ++v) {
        std::vector<int> u = adj[v];
        std::sort(u.begin(), u.end());
        u.erase(std::unique(u.begin(), u.end()), u.end());
        std::printf(" %zu", u.size());
    }
    std::printf("\n");

    long long stored = 0;
    for (int v = 0; v < n; ++v) stored += static_cast<long long>(adj[v].size());
    std::printf("entries stored %lld for %d edges (2m would be %d)\n", stored, m, 2 * m);

    std::printf("vertex 1 (input \"2\") sees:");
    for (int w : adj[1]) std::printf(" %d", w + 1);
    std::printf("\n");
}
```

Degrees `3 3 2 2 1`, distinct neighbours `2 2 2 2 1`, and 11 stored entries for
6 edges rather than 12 — the self-loop accounts for the difference.

Four decisions, each of which has to be made deliberately:

- **Indexing.** Input is usually 1-based and arrays are 0-based. Convert once,
  at the point of reading (`--u; --v;`), and never think about it again. The
  alternative — sizing everything `n + 1` and staying 1-based — is also fine, and
  mixing the two is not.
- **Direction.** An undirected edge goes in both lists. A *directed* one does
  not, and reading a directed graph with `adj[v].push_back(u)` in it is a bug
  that produces plausible answers.
- **Self-loops.** `if (u != v)` stops the loop being stored twice. Whether that
  is right depends on the problem — for a degree count in an undirected graph a
  self-loop conventionally contributes 2 — so the point is to decide rather than
  to inherit whatever the code does.
- **Multi-edges.** Two identical edges are two entries. Most traversal
  algorithms do not care; anything that counts edges, or that expects a simple
  graph, does. Sorting and `unique`-ing a neighbour list is the cheap fix, and it
  costs O(m log m) overall.

**Read the constraints for the word "simple".** A statement that guarantees no
self-loops and no repeated edges is telling you not to write this code; one that
says nothing is telling you the data will contain both.

## The graph you do not build

Grids, and state spaces generally, are graphs whose edges are *computed*.
Building an adjacency list for them is wasted memory and wasted time.

```cpp run title="A grid, and the four-direction idiom"
#include <array>
#include <cstdio>
#include <string>
#include <vector>

int main() {
    // A grid is a graph nobody builds: the neighbours are computed, not stored.
    const std::vector<std::string> grid = {
        "....#",
        ".##..",
        ".....",
        "#..#.",
    };
    const int rows = static_cast<int>(grid.size());
    const int cols = static_cast<int>(grid[0].size());

    // The four-direction idiom. Two parallel arrays, one loop.
    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    auto open_cell = [&](int r, int c) {
        return r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] == '.';
    };

    int open = 0;
    long long directed_edges = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (!open_cell(r, c)) continue;
            ++open;
            for (int d = 0; d < 4; ++d)
                if (open_cell(r + dr[d], c + dc[d])) ++directed_edges;
        }

    std::printf("%d x %d grid, %d open cells\n", rows, cols, open);
    std::printf("directed edges %lld, so undirected edges %lld\n",
                directed_edges, directed_edges / 2);

    // Cross-check by counting adjacent open pairs directly.
    long long pairs = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (!open_cell(r, c)) continue;
            if (open_cell(r, c + 1)) ++pairs;      // right neighbour
            if (open_cell(r + 1, c)) ++pairs;      // neighbour below
        }
    std::printf("counted once per pair: %lld -- %s\n", pairs,
                pairs == directed_edges / 2 ? "agrees" : "MISMATCH");

    // The flattened index, for when a grid must become a plain graph.
    auto id = [cols](int r, int c) { return r * cols + c; };
    std::printf("cell (2,3) has id %d; id 13 is cell (%d,%d)\n",
                id(2, 3), 13 / cols, 13 % cols);
    std::printf("vertices in the flattened graph: %d\n", rows * cols);
}
```

15 open cells, 17 undirected edges, confirmed by counting each adjacent pair
once.

Three habits from that code:

- **One `open_cell` function.** Bounds checking and the wall test belong
  together, in one place, called everywhere. Writing `r >= 0 && r < rows && ...`
  inline at three call sites is how a grid problem acquires an off-by-one that
  only fires on the boundary.
- **Parallel `dr`/`dc` arrays.** Four directions become one loop. For eight
  directions the arrays grow to `{-1,-1,-1,0,0,1,1,1}` and
  `{-1,0,1,-1,1,-1,0,1}`, and nothing else changes — which is the point of
  writing it this way rather than four `if`s.
- **`r * cols + c` flattens the grid** into a plain vertex id when an algorithm
  wants one, and `id / cols`, `id % cols` unflattens it. Note it is `cols`, not
  `rows`, in both — using the wrong dimension gives a program that works on
  square grids and fails on the first rectangular test.

The same idea covers state spaces that are not grids at all: "the graph whose
vertices are the 8! arrangements of a puzzle" is never built, only walked, with
the neighbours generated on demand. Chapter 10.17's BFS works unchanged on those.

:::quiz
{
  "question": "A problem gives n up to 200,000 vertices and m up to 200,000 edges, and asks whether two given vertices are adjacent, for q up to 200,000 queries. What should you store?",
  "options": [
    { "text": "An adjacency list, plus a hash set of the edges keyed on a packed (min, max) pair, so each query is O(1) without an n² matrix", "correct": true, "why": "The matrix would need 4·10^10 entries. Packing the endpoints into one 64-bit key (chapter 10.10) and hashing them answers adjacency in O(1) and costs O(m). Sorting the packed keys and binary searching is the hack-proof alternative." },
    { "text": "An adjacency matrix, since the queries ask about adjacency", "why": "n^2 is 4·10^10 bits, or 5 GB even as a bitset. The query pattern does not change what fits in memory." },
    { "text": "An adjacency list alone, scanning the neighbour list per query", "why": "A vertex can have degree up to 200,000, so a query is O(n) in the worst case and the total is 4·10^10 steps. It works only if the degrees are known to be small." },
    { "text": "An edge list, scanning it per query", "why": "That is O(m) per query and 4·10^10 steps in total — the same problem, without even the benefit of an adjacency structure for anything else." }
  ]
}
:::

## Practice

:::exercise graph-input-audit

:::exercise build-adjacency

:::exercise judge-degree-sequence

:::exercise judge-grid-neighbours

:::recap
- Adjacency list for sparse graphs, matrix only when `n ≤ 1000`, edge list when
  the algorithm sorts or relaxes edges. At n = m = 200,000 a bit matrix would be
  five gigabytes.
- `std::vector<std::vector<int>>` costs one allocation per vertex. Measured
  against a compressed (counts, prefix-sum, fill) layout: 745 ms against 80 ms
  to build and 70 ms against 16 ms to walk. `reserve` after a counting pass is
  the easy middle ground.
- Reading a graph involves four decisions — indexing, direction, self-loops,
  multi-edges — and each is a real choice. Convert 1-based input to 0-based once,
  at the read.
- The word "simple" in the constraints means no self-loops and no repeats. Its
  absence means both will appear.
- Grids and state spaces are graphs you never build. One `open_cell` predicate,
  parallel `dr`/`dc` arrays, and `r * cols + c` to flatten when an algorithm
  wants plain vertex ids.
:::
