---
id: judge-grid-neighbours
title: "Counting a grid's edges"
difficulty: core
chapter: representing-graphs
topics: [graphs, grids, io]
check: output
standard: c++20
timeLimitMs: 2000
---

A grid of open cells (`.`) and walls (`#`) is a graph: the vertices are the open
cells, and two open cells are joined when they share a side.

Print the number of open cells and the number of **undirected** edges between
them.

**Input.** The first line contains `rows` and `cols`. Each of the next `rows`
lines contains `cols` characters, each `.` or `#`.

**Output.** One line: the number of open cells, a space, and the number of
edges.

**Constraints.** `1 ≤ rows, cols ≤ 1000`.

## Starter
```cpp
#include <array>
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int rows, cols;
    std::cin >> rows >> cols;
    std::vector<std::string> grid(rows);
    for (std::string& row : grid) std::cin >> row;

    constexpr std::array<int, 4> dr = {-1, 1, 0, 0};
    constexpr std::array<int, 4> dc = {0, 0, -1, 1};

    auto open_cell = [&](int r, int c) {
        return r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] == '.';
    };

    long long open = 0, edges = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (!open_cell(r, c)) continue;
            ++open;
            for (int d = 0; d < 4; ++d)
                if (open_cell(r + dr[d], c + dc[d])) ++edges;   // seen from both ends
        }

    std::cout << open << ' ' << edges << '\n';
}
```

## Cases

### Sample
```in
4 5
....#
.##..
.....
#..#.
```
```out
15 17
```

### one open cell
```in
1 1
.
```
```out
1 0
```

### one wall
```in
1 1
#
```
```out
0 0
```

### a full square
```in
2 2
..
..
```
```out
4 4
```

### a ring around a wall
```in
3 3
...
.#.
...
```
```out
8 8
```

### a single row
```in
1 5
.....
```
```out
5 4
```

### a column split by a wall
```in
3 1
.
#
.
```
```out
2 0
```

### diagonals do not touch
```in
3 3
.#.
#.#
.#.
```
```out
5 0
```

## Hints
- Every edge is discovered twice: once from each of its two endpoints. Halve the total, or count each edge only once.
- Counting once is easy and needs no division: for each open cell, look only at its **right** and **below** neighbours.
- The last case is the one that pins the definition down. Diagonally touching cells do not share a side, so five open cells can have zero edges.
- Keep the bounds check and the wall test together in one `open_cell` function, called everywhere, rather than repeating the four comparisons inline.
- `dr`/`dc` parallel arrays turn four directions into one loop; for eight directions only the arrays change.
- Read each grid row with `std::cin >> row`, which skips the whitespace and stops at the end of the line. Reading characters one at a time works too, but then the newlines have to be handled.

## Solution
```cpp
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int rows, cols;
    std::cin >> rows >> cols;
    std::vector<std::string> grid(rows);
    for (std::string& row : grid) std::cin >> row;

    auto open_cell = [&](int r, int c) {
        return r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] == '.';
    };

    long long open = 0, edges = 0;
    for (int r = 0; r < rows; ++r)
        for (int c = 0; c < cols; ++c) {
            if (!open_cell(r, c)) continue;
            ++open;
            if (open_cell(r, c + 1)) ++edges;      // right neighbour only
            if (open_cell(r + 1, c)) ++edges;      // neighbour below only
        }

    std::cout << open << ' ' << edges << '\n';
}
```

## Notes
The starter walks all four directions from every open cell, so it finds each
edge from both of its endpoints and reports twice the answer: 34 instead of 17
on the sample.

Two fixes, and the second is better:

- **Divide by two.** Correct, and it makes the reader — and you, in six months —
  check that the count really was even.
- **Count each edge once.** Look only right and down. Every horizontal edge is
  found from its left cell and every vertical edge from its upper one, exactly
  once, and the bounds check that `open_cell` already does handles the last row
  and column with no extra thought.

The second version also drops the `dr`/`dc` arrays, which are the right tool for
*visiting* neighbours and unnecessary for *counting* them. That is worth
noticing: the four-direction idiom is not a ritual, it earns its place when the
loop body is the same for all four directions. Here it is not — two of the four
are deliberately skipped.

**One predicate, called everywhere.** `open_cell` bundles the two things that
have to be true — inside the grid, and not a wall — and it is the reason the
solution has no explicit bounds arithmetic at all. Writing
`r + 1 < rows && grid[r + 1][c] == '.'` inline at each site works and gives four
places for an off-by-one to hide. It also reverses the order of the checks: the
bounds test must come *first*, because `grid[r + 1][c]` on an out-of-range row is
undefined behaviour, and `&&` short-circuiting is what makes the single predicate
safe.

**On the shape of the answer.** Open cells and edges are the `n` and `m` of the
graph this grid represents, and knowing them tells you what the grid will cost
to traverse: at 1000 × 1000 that is up to a million vertices and two million
edges, which a BFS handles comfortably (chapter 10.17) and an adjacency matrix
never could. The counts are `long long` for the same reason — two million fits an
`int`, but the habit costs nothing and the next problem's grid may be larger.
