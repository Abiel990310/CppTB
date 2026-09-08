---
id: custom-key-hash
title: "A hash that does not collide"
difficulty: stretch
chapter: associative-containers
topics: [containers, hashing, unordered_map]
check: unit
standard: c++20
---

`Cell` is used as a key in an `unordered_map`, and its hash combines the two
members with XOR. That makes `(1, 2)` and `(2, 1)` hash identically, and every
`(n, n)` hash to zero — so a grid of cells piles into a handful of buckets.

Replace the hash with one that distinguishes those cases. Equality is already
correct; do not change it.

The checks confirm both that the map still works and that the hash actually
separates the symmetric cases.

## Starter
```cpp
#include <cstddef>
#include <functional>
#include <unordered_map>

struct Cell {
    int row;
    int col;
    bool operator==(const Cell&) const = default;
};

template <>
struct std::hash<Cell> {
    std::size_t operator()(const Cell& c) const noexcept {
        return std::hash<int>{}(c.row) ^ std::hash<int>{}(c.col);
    }
};
```

## Tests
```cpp
std::hash<Cell> h;

// Equal keys must hash equally — this must stay true.
CHECK_EQ(h(Cell{3, 7}), h(Cell{3, 7}));

// The symmetric pair must no longer collide.
CHECK(h(Cell{1, 2}) != h(Cell{2, 1}));
CHECK(h(Cell{5, 9}) != h(Cell{9, 5}));

// Equal-member cells must not all hash to the same value.
CHECK(h(Cell{3, 3}) != h(Cell{4, 4}));
CHECK(h(Cell{0, 0}) != h(Cell{7, 7}));

// And the container still has to work.
std::unordered_map<Cell, int> grid;
for (int r = 0; r < 20; ++r) {
    for (int c = 0; c < 20; ++c) grid[Cell{r, c}] = r * 100 + c;
}
CHECK_EQ(grid.size(), std::size_t{400});
CHECK_EQ(grid.at(Cell{3, 7}), 307);
CHECK_EQ(grid.at(Cell{19, 19}), 1919);
CHECK(grid.find(Cell{20, 0}) == grid.end());

// Spread check: 400 distinct keys should produce many distinct hash values.
std::unordered_map<std::size_t, int> buckets;
for (int r = 0; r < 20; ++r) {
    for (int c = 0; c < 20; ++c) ++buckets[h(Cell{r, c})];
}
CHECK(buckets.size() > std::size_t{350});
```

## Hints
- The problem is that XOR is symmetric: `a ^ b == b ^ a`, and `a ^ a == 0`.
- Mix one member into the other so position matters. The widely used form is
  `h ^= hash(next) + 0x9e3779b9 + (h << 6) + (h >> 2);`
- That constant is the golden ratio scaled to 32 bits; the shifts spread bits so
  nearby inputs do not produce nearby hashes.
- Keep `noexcept` — containers rely on a hash not throwing.

## Solution
```cpp
#include <cstddef>
#include <functional>
#include <unordered_map>

struct Cell {
    int row;
    int col;
    bool operator==(const Cell&) const = default;
};

template <>
struct std::hash<Cell> {
    std::size_t operator()(const Cell& c) const noexcept {
        std::size_t h = std::hash<int>{}(c.row);
        h ^= std::hash<int>{}(c.col) + 0x9e3779b9 + (h << 6) + (h >> 2);
        return h;
    }
};
```

## Notes
The last check is the one that matters most and is the hardest to satisfy by
accident. It hashes 400 distinct cells and counts how many distinct hash values
came out. The XOR version produces far fewer than 350, because the whole lower
triangle of the grid collides with the upper triangle and the diagonal collapses
to zero. A real combination keeps nearly all 400 apart.

This mixing function is `boost::hash_combine`, reimplemented in three lines. It
is worth memorising because the standard library still provides no way to
combine hashes — `std::hash` specialisations exist for the built-in types and
for standard library types, and composing them is left to you.

Note what was *not* changed: equality. A hash must agree with equality, and
since `operator==` compares both members, the hash must depend on both. Had you
"fixed" the collisions by hashing only `row`, the first check would still pass
and the container would still work — just slowly, with every column in one
bucket.
