---
id: judge-nearest-source
title: "The farthest cell from any source"
difficulty: core
chapter: bfs
topics: [graphs, bfs, grids, io]
check: output
standard: c++20
timeLimitMs: 2000
---

A grid contains sources (`*`), open cells (`.`) and walls (`#`). Print the
largest number of steps from any open-or-source cell to its **nearest** source,
moving between side-adjacent non-wall cells. If some non-wall cell cannot reach
any source, print `-1`.

**Input.** The first line contains `rows` and `cols`. Each of the next `rows`
lines contains `cols` characters from `.*#`. There is at least one `*`.

**Output.** One line: the largest such distance, or `-1`.

**Constraints.** `1 ≤ rows, cols ≤ 1000`.

## Starter
```cpp
#include <array>
#include <iostream>
#include <queue>
#include <string>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int rows, cols;
    std::cin >> rows >> cols;
    std::vector<std::string> g(rows);
    for (std::string& row : g) std::cin >> row;

    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, -1));
    std::queue<std::pair<int, int>> q;

    // Start the search from a source.
    for (int r = 0; r < rows && q.empty(); ++r)
        for (int c = 0; c < cols && q.empty(); ++c)
            if (g[r][c] == '*') { dist[r][c] = 0; q.emplace(r, c); }

    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.emplace(nr, nc);
        }
    }

    int worst = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (g[r][c] == '#') continue;
            if (dist[r][c] == -1) { std::cout << -1 << '\n'; return 0; }
            if (dist[r][c] > worst) worst = dist[r][c];
        }

    std::cout << worst << '\n';
}
```

## Cases

### Sample
```in
3 3
*..
...
..*
```
```out
2
```

### two sources on one row
```in
1 5
*...*
```
```out
2
```

### a single source
```in
1 1
*
```
```out
0
```

### an isolated pocket
```in
2 2
*#
#*
```
```out
0
```

### around a wall
```in
3 3
*#.
.#.
...
```
```out
6
```

### one corner source
```in
3 4
....
....
...*
```
```out
5
```

### sources at both ends of a maze
```in
3 5
*.#.*
.....
#...#
```
```out
4
```

### a long corridor
```in
2 5
*....
.....
```
```out
5
```

## Hints
- Push **every** source into the queue before the loop starts, each at distance 0. Then the first time a cell is reached, it is reached from its nearest source.
- Searching from one source and then repeating for the others also works and costs a factor of the number of sources — chapter 10.17 measures 23 ms against 996 ms for forty of them.
- Seeding all the sources is the same as adding one virtual vertex joined to all of them by free edges, so the queue still holds a non-decreasing run of distances and the BFS invariant is untouched.
- Walls are skipped entirely: they are not vertices, so they never need a distance and never make the answer `-1`.
- A non-wall cell left at `-1` after the sweep is unreachable, which is the case the problem asks you to report.
- The answer is the maximum over the distances, so it is 0 when every non-wall cell is a source.

## Solution
```cpp
#include <array>
#include <iostream>
#include <queue>
#include <string>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int rows, cols;
    std::cin >> rows >> cols;
    std::vector<std::string> g(rows);
    for (std::string& row : g) std::cin >> row;

    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, -1));
    std::queue<std::pair<int, int>> q;

    for (int r = 0; r < rows; ++r)                      // every source, at distance 0
        for (int c = 0; c < cols; ++c)
            if (g[r][c] == '*') { dist[r][c] = 0; q.emplace(r, c); }

    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int d = 0; d < 4; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.emplace(nr, nc);
        }
    }

    int worst = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (g[r][c] == '#') continue;
            if (dist[r][c] == -1) { std::cout << -1 << '\n'; return 0; }
            if (dist[r][c] > worst) worst = dist[r][c];
        }

    std::cout << worst << '\n';
}
```

## Notes
One loop, and where it stops.

The starter's seeding loop breaks as soon as the queue is non-empty, so it
searches from the first source only. Every distance is then "how far from *that*
source", and the answers come out too large — 4 instead of 2 on the sample —
or `-1` where the truth is a small number, as in the isolated-pocket case where
each source serves its own cell.

Pushing every source at distance 0 is the whole of multi-source BFS. It is
correct for the same reason plain BFS is: the queue holds a non-decreasing run of
distances, and all the seeds share the value 0, so the invariant is untouched.
Equivalently, imagine one extra vertex joined to every source by a free edge and
run an ordinary search from it — the two are the same computation.

**Why not one search per source.** Also correct, and it costs a factor of the
number of sources: chapter 10.17 measures 23 ms for one multi-source sweep
against 996 ms for forty separate ones, on a 300 × 300 grid. With sources
possibly numbering in the hundreds of thousands here, that difference is the
whole problem.

Two details the cases pin down.

**Walls are not vertices.** A `#` never gets a distance and never triggers the
`-1`. Treating them as unreachable cells instead would make almost every input
answer `-1`, which is why the final sweep skips them explicitly.

**`-1` means a reachable-looking cell that is not.** The isolated-pocket case has
two sources, each alone in its own corner, and every non-wall cell is a source —
so the answer is 0, not `-1`. The starter, searching from one source, leaves the
other at `-1` and reports failure. It is worth noticing that the two conditions
"some cell is unreachable" and "the answer is large" look similar in code and are
completely different in meaning.

**The extension worth knowing.** Carrying a second grid `owner[][]`, set
alongside `dist[][]`, tells you *which* source is nearest to each cell at no
extra cost. That turns this into a Voronoi partition of the grid, and it is the
usual follow-up question.
