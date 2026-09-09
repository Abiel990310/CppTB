---
id: judge-maze
title: "Fewest steps through a maze"
difficulty: core
chapter: bfs
topics: [graphs, bfs, grids, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the fewest steps needed to walk from `S` to `T` in a grid, or `-1` if `T`
cannot be reached. A step moves to a cell sharing a **side** — up, down, left or
right. `#` cells cannot be entered; `.`, `S` and `T` can.

**Input.** The first line contains `rows` and `cols`. Each of the next `rows`
lines contains `cols` characters from `.#ST`. There is exactly one `S` and
exactly one `T`.

**Output.** One line: the fewest steps, or `-1`.

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

    int sr = 0, sc = 0, tr = 0, tc = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (g[r][c] == 'S') { sr = r; sc = c; }
            if (g[r][c] == 'T') { tr = r; tc = c; }
        }

    // Eight directions -- but what does the statement allow?
    constexpr std::array<int, 8> dr = {-1, 1, 0, 0, -1, -1, 1, 1};
    constexpr std::array<int, 8> dc = {0, 0, -1, 1, -1, 1, -1, 1};

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, -1));
    std::queue<std::pair<int, int>> q;
    dist[sr][sc] = 0;
    q.emplace(sr, sc);

    while (!q.empty()) {
        auto [r, c] = q.front();
        q.pop();
        for (int d = 0; d < 8; ++d) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (g[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[r][c] + 1;
            q.emplace(nr, nc);
        }
    }

    std::cout << dist[tr][tc] << '\n';
}
```

## Cases

### Sample
```in
3 4
S..#
.#..
...T
```
```out
5
```

### diagonals are not steps
```in
2 2
S.
.T
```
```out
2
```

### walled off
```in
2 2
S#
#T
```
```out
-1
```

### adjacent
```in
1 2
ST
```
```out
1
```

### a long corridor
```in
1 10
S........T
```
```out
9
```

### around a wall
```in
3 5
S....
####.
T....
```
```out
10
```

### a narrow diagonal squeeze
```in
3 3
S.#
..#
#.T
```
```out
4
```

### a wall directly between them
```in
1 3
S#T
```
```out
-1
```

## Hints
- Four directions, not eight. The statement says a step moves to a cell sharing a *side*, and two cells touching only at a corner do not share one.
- `S.` / `.T` is the case that says so: the corner-to-corner move is not allowed, so the answer is 2 rather than 1.
- BFS with a plain `std::queue` gives shortest paths because it pops in non-decreasing distance order.
- Mark a cell the moment you push it: `dist[nr][nc] = dist[r][c] + 1` right before `q.emplace(...)`. Marking on pop is still correct and makes the queue up to `m` entries instead of `n`.
- `dist` initialised to `-1` doubles as the visited flag, and `-1` is also the answer for an unreachable `T` — so nothing needs converting at the end.
- The bounds test must come before the grid access: `nr < 0 || nr >= rows || ...` first, then `g[nr][nc]`. `||` short-circuits, which is what makes that safe.

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

    int sr = 0, sc = 0, tr = 0, tc = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (g[r][c] == 'S') { sr = r; sc = c; }
            if (g[r][c] == 'T') { tr = r; tc = c; }
        }

    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};   // side-adjacent only
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    std::vector<std::vector<int>> dist(rows, std::vector<int>(cols, -1));
    std::queue<std::pair<int, int>> q;
    dist[sr][sc] = 0;
    q.emplace(sr, sc);

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

    std::cout << dist[tr][tc] << '\n';
}
```

## Notes
The search is right; the graph is wrong.

Eight directions is a different graph — one in which `S.` / `.T` are adjacent and
`S#` / `#T` are connected by squeezing through a corner. Both appear in the
cases, and both are answers a reader would accept without noticing, which is
exactly why they are here. The sample drops from 5 to 3 and the walled-off case
from `-1` to 1.

**Read the movement rule before writing the direction arrays.** Statements say it
in several ways — "shares a side", "orthogonally adjacent", "up, down, left or
right", "king moves", "including diagonals" — and the arrays are the first thing
you write, so they are the first thing to get wrong. When a problem *does* allow
diagonals, the only change is `dr`/`dc` growing to eight entries and the loop
bound; that the change is so small is what makes the mistake so easy.

Two other things this problem is checking.

**`dist` as the visited flag.** Initialising to `-1`, setting it at the push, and
reading `dist[tr][tc]` at the end means "unreached" and "unreachable" are the
same value, and it is the value the problem wants printed. Three uses of one
array, and no way for a separate `visited` to fall out of step with it.

**The order of the two guards.** `nr < 0 || nr >= rows || nc < 0 || nc >= cols`
must be evaluated before `g[nr][nc]`, because indexing outside the grid is
undefined behaviour rather than a false result. Written as one `if` with `||`,
short-circuiting guarantees the order — which is worth knowing rather than
relying on by accident, since swapping the two clauses compiles just as happily.

**On the size.** A 1000 × 1000 grid is a million cells and up to four million
directed edges, which BFS handles in well under the limit. What would not fit is
an explicit adjacency list for it: the grid is a graph you never build, as
chapter 10.16 puts it.
