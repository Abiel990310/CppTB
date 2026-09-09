---
id: zero-one-bfs
title: "Deques, and the cost of an edge"
difficulty: stretch
chapter: bfs
topics: [graphs, bfs, deque, algorithms]
check: unit
standard: c++20
---

Two 0–1 breadth-first searches. Both use the deque correctly and get the
*relaxation* wrong, in the two ways it can be.

- `zero_one_distances(g, src)` — shortest distances where every edge costs 0 or
  1, with `-1` for unreachable. Tests whether a vertex has been seen instead of
  whether it can be improved, so a vertex first reached by a weight-1 edge is
  never corrected.
- `min_walls(grid)` — the fewest walls (`#`) you must pass through to walk from
  the top-left cell to the bottom-right, moving between side-adjacent cells. The
  starting cell itself is free. Charges for the cell you **leave** rather than
  the one you enter.

## Starter
```cpp
#include <array>
#include <climits>
#include <cstddef>
#include <deque>
#include <string>
#include <utility>
#include <vector>

std::vector<int> zero_one_distances(
        const std::vector<std::vector<std::pair<int, int>>>& g, int src) {
    std::vector<int> dist(g.size(), -1);
    std::deque<int> dq;
    dist[src] = 0;
    dq.push_back(src);
    while (!dq.empty()) {
        int v = dq.front();
        dq.pop_front();
        for (auto [to, w] : g[v]) {
            if (dist[to] != -1) continue;              // seen, so never improved
            dist[to] = dist[v] + w;
            if (w == 0) dq.push_front(to);
            else dq.push_back(to);
        }
    }
    return dist;
}

int min_walls(const std::vector<std::string>& grid) {
    int rows = static_cast<int>(grid.size());
    int cols = static_cast<int>(grid[0].size());
    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};
    const int INF = INT_MAX / 2;

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, INF));
    std::deque<std::pair<int, int>> dq;
    dist[0][0] = 0;
    dq.emplace_back(0, 0);

    while (!dq.empty()) {
        auto [r, c] = dq.front();
        dq.pop_front();
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            int w = grid[r][c] == '#' ? 1 : 0;         // the cell being left
            if (dist[r][c] + w >= dist[nr][nc]) continue;
            dist[nr][nc] = dist[r][c] + w;
            if (w == 0) dq.emplace_front(nr, nc);
            else dq.emplace_back(nr, nc);
        }
    }
    return dist[rows - 1][cols - 1];
}
```

## Tests
```cpp
using W = std::vector<std::vector<std::pair<int, int>>>;

// zero_one_distances
CHECK_EQ(zero_one_distances(W{{{1, 1}, {4, 0}}, {{2, 1}}, {{3, 1}}, {}, {{3, 1}}}, 0),
         (std::vector<int>{0, 1, 2, 1, 0}));
// Vertex 1 is reached by a weight-1 edge first, then improved via 0 -> 2 -> 1.
CHECK_EQ(zero_one_distances(W{{{1, 1}, {2, 0}}, {{2, 0}}, {{1, 0}}}, 0),
         (std::vector<int>{0, 0, 0}));
CHECK_EQ(zero_one_distances(W{{{1, 0}, {2, 1}}, {{3, 1}}, {{3, 0}}, {}}, 0),
         (std::vector<int>{0, 0, 1, 1}));
CHECK_EQ(zero_one_distances(W{{{1, 1}}, {{2, 1}}, {}}, 0), (std::vector<int>{0, 1, 2}));
CHECK_EQ(zero_one_distances(W{{}}, 0), (std::vector<int>{0}));
CHECK_EQ(zero_one_distances(W{{{1, 1}}, {{0, 1}}, {{3, 0}}, {{2, 0}}}, 0),
         (std::vector<int>{0, 1, -1, -1}));
CHECK_EQ(zero_one_distances(W{{{1, 0}}, {{2, 0}}, {{3, 0}}, {{4, 0}}, {}}, 0),
         (std::vector<int>{0, 0, 0, 0, 0}));

// min_walls
CHECK_EQ(min_walls({"..", "##"}), 1);
CHECK_EQ(min_walls({"#..", "..#", "..."}), 0);
CHECK_EQ(min_walls({"#...", "...."}), 0);
CHECK_EQ(min_walls({"###", "###", "###"}), 4);
CHECK_EQ(min_walls({".#.#.", "#.#.#", ".#.#."}), 3);
CHECK_EQ(min_walls({"."}), 0);
CHECK_EQ(min_walls({"#"}), 0);
CHECK_EQ(min_walls({"#####"}), 4);
CHECK_EQ(min_walls({"#.#", "...", "#.#"}), 1);
CHECK_EQ(min_walls({"##", "##"}), 2);
```

## Hints
- In a 0–1 BFS a vertex can be *improved* after it is first reached, through a chain of zero-weight edges. So the test is `dist[v] + w < dist[to]`, not `dist[to] == -1`.
- That means `dist` cannot start at `-1` as a marker either: use a large sentinel like `INT_MAX / 2`, relax against it, and convert the untouched entries to `-1` at the end.
- The second test is the smallest case: vertex 1 is reached from 0 by a weight-1 edge and then again by 0 → 2 → 1, both free. The answer is 0, and a visited test freezes it at 1.
- A vertex may enter the deque more than once. That is fine — its distance only ever falls, so the total work stays O(n + m).
- `min_walls` charges for the wall you walk **into**, so the weight is decided by `grid[nr][nc]`, not `grid[r][c]`. The starting cell is free precisely because you never enter it.
- `{"..", "##"}` distinguishes them: entering the bottom row costs one wall, while charging for the cell you leave makes the whole walk free.

## Solution
```cpp
#include <array>
#include <climits>
#include <cstddef>
#include <deque>
#include <string>
#include <utility>
#include <vector>

std::vector<int> zero_one_distances(
        const std::vector<std::vector<std::pair<int, int>>>& g, int src) {
    const int INF = INT_MAX / 2;
    std::vector<int> dist(g.size(), INF);
    std::deque<int> dq;
    dist[src] = 0;
    dq.push_back(src);
    while (!dq.empty()) {
        int v = dq.front();
        dq.pop_front();
        for (auto [to, w] : g[v]) {
            if (dist[v] + w >= dist[to]) continue;     // relax, do not merely visit
            dist[to] = dist[v] + w;
            if (w == 0) dq.push_front(to);
            else dq.push_back(to);
        }
    }
    for (int& d : dist) if (d >= INF) d = -1;
    return dist;
}

int min_walls(const std::vector<std::string>& grid) {
    int rows = static_cast<int>(grid.size());
    int cols = static_cast<int>(grid[0].size());
    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};
    const int INF = INT_MAX / 2;

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, INF));
    std::deque<std::pair<int, int>> dq;
    dist[0][0] = 0;
    dq.emplace_back(0, 0);

    while (!dq.empty()) {
        auto [r, c] = dq.front();
        dq.pop_front();
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            int w = grid[nr][nc] == '#' ? 1 : 0;       // the cell being entered
            if (dist[r][c] + w >= dist[nr][nc]) continue;
            dist[nr][nc] = dist[r][c] + w;
            if (w == 0) dq.emplace_front(nr, nc);
            else dq.emplace_back(nr, nc);
        }
    }
    return dist[rows - 1][cols - 1];
}
```

## Notes
**A 0–1 BFS relaxes; a plain BFS marks.** That single difference is what the
first bug is about, and it follows from the weights. In an unweighted BFS the
first time a vertex is reached is via a shortest path, full stop — so a visited
flag is enough. With zero-weight edges present, a vertex reached at distance 1
can later be reached at distance 0 through a chain of free edges, and the search
must be allowed to notice.

The consequence is that `dist` can no longer double as the visited flag. It
starts at a large sentinel, every candidate is compared against it, and the
untouched entries are converted to `-1` at the end. `INT_MAX / 2` rather than
`INT_MAX` so that `dist[v] + w` cannot overflow — a habit worth keeping for
every shortest-path algorithm.

A vertex may therefore enter the deque several times. That is not a leak: its
recorded distance strictly decreases each time, and there are only two possible
values in play at any moment, so the total work is still O(n + m).

**The weight belongs to the edge, and the edge enters a cell.** `min_walls`
charges for walking *into* a wall, so the cost is a property of the destination.
Charging for the cell you leave is a different problem — one where the start is
expensive and the destination free — and on `{"..", "##"}` it answers 0 where the
answer is 1.

The general rule for grid problems: **decide whether a cell's cost is paid on
entry or on exit, write it in a comment, and make the start consistent with it.**
Here the start is free because you never enter it, which is exactly why
`min_walls({"#"})` is 0 rather than 1.

**Why the deque is not a heap.** Pushing zero-weight edges to the front and
weight-one edges to the back keeps the deque holding at most two adjacent
distances, `d` then `d + 1` — the BFS invariant with one extra case. That is why
no priority queue and no log factor is needed. Chapter 10.17 measures 176 ms
against Dijkstra's 2,443 ms on 200,000 vertices.

Worth knowing what happens if you push everything to the back: the algorithm
stays *correct*, because the relaxation condition still guards every update — it
just degrades into a queue-based relaxation that can process a vertex many
times. Correct and slow is the usual failure mode here, and it is one that only
a large test exposes.
