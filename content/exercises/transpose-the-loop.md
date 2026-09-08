---
id: transpose-the-loop
title: "Same answer, sequential order"
difficulty: core
chapter: cache-and-layout
topics: [performance, layout, locality, loops]
check: unit
standard: c++20
---

`Matrix` stores its elements row by row, and it counts something for you: every
time `at()` reads an element that is *not* the one immediately after the
previous read, it records a **jump**. A traversal that walks memory in order has
zero jumps; one that hops around has one per element.

Two functions read the matrix in the worst possible order. Rewrite them so each
produces the same answer with a sequential traversal — under 200 jumps on a
120×120 matrix, where the starters make 14,399.

You may not change `Matrix`, and you may not change what the functions return.

## Starter
```cpp
#include <cstddef>
#include <vector>

// --- given, do not change ---------------------------------------------
class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(std::size_t(rows) * cols) {
        for (int r = 0; r < rows_; ++r)
            for (int c = 0; c < cols_; ++c) data_[index(r, c)] = r * 3 + c;
    }

    int rows() const { return rows_; }
    int cols() const { return cols_; }

    int at(int r, int c) const {
        std::size_t i = index(r, c);
        if (touched_ && i != last_ + 1) ++jumps_;
        last_ = i;
        touched_ = true;
        return data_[i];
    }

    static long long jumps() { return jumps_; }
    static void reset() { jumps_ = 0; touched_ = false; }

private:
    std::size_t index(int r, int c) const { return std::size_t(r) * cols_ + c; }

    int rows_, cols_;
    std::vector<int> data_;
    static inline long long jumps_ = 0;
    static inline std::size_t last_ = 0;
    static inline bool touched_ = false;
};
// ----------------------------------------------------------------------

// The sum of every element.
long long total(const Matrix& m) {
    long long sum = 0;
    for (int c = 0; c < m.cols(); ++c)
        for (int r = 0; r < m.rows(); ++r) sum += m.at(r, c);
    return sum;
}

// Element i of the result is the sum of column i.
std::vector<long long> column_sums(const Matrix& m) {
    std::vector<long long> sums(m.cols(), 0);
    for (int c = 0; c < m.cols(); ++c)
        for (int r = 0; r < m.rows(); ++r) sums[c] += m.at(r, c);
    return sums;
}
```

## Tests
```cpp
Matrix m(120, 120);

Matrix::reset();
long long sum = total(m);
long long total_jumps = Matrix::jumps();
CHECK_EQ(sum, 3427200LL);
CHECK(total_jumps < 200);

Matrix::reset();
std::vector<long long> sums = column_sums(m);
long long column_jumps = Matrix::jumps();
CHECK_EQ(sums.size(), std::size_t{120});
CHECK_EQ(sums[0], 21420LL);
CHECK_EQ(sums[1], 21540LL);
CHECK_EQ(sums[119], 35700LL);
CHECK(column_jumps < 200);

// The sums must still add up to the total, so neither was fudged.
long long recombined = 0;
for (long long s : sums) recombined += s;
CHECK_EQ(recombined, sum);

// A non-square matrix, to catch a rows/cols mix-up.
Matrix tall(200, 30);
Matrix::reset();
std::vector<long long> tall_sums = column_sums(tall);
CHECK_EQ(tall_sums.size(), std::size_t{30});
CHECK_EQ(tall_sums[0], 59700LL);
CHECK_EQ(tall_sums[29], 65500LL);
CHECK(Matrix::jumps() < 200);
```

## Hints
- `total` is easy: addition does not care what order it happens in, so swap the two loops and read row by row.
- `column_sums` looks harder because the *result* is indexed by column. It is not: the accumulator does not have to be filled in order.
- Walk the matrix row by row, and for each element add it into `sums[c]`. After the last row, every column sum is complete.
- That is the general move — when a computation wants one order and the memory wants another, keep an accumulator per output and let the *traversal* follow the memory.
- `sums` is 120 `long long`s, less than 1 KB. It stays in L1 for the whole loop, so the scattered writes into it cost nothing like the scattered reads you removed.
- 200 is a generous budget. Both functions can be written with zero jumps.

## Solution
```cpp
#include <cstddef>
#include <vector>

class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(std::size_t(rows) * cols) {
        for (int r = 0; r < rows_; ++r)
            for (int c = 0; c < cols_; ++c) data_[index(r, c)] = r * 3 + c;
    }

    int rows() const { return rows_; }
    int cols() const { return cols_; }

    int at(int r, int c) const {
        std::size_t i = index(r, c);
        if (touched_ && i != last_ + 1) ++jumps_;
        last_ = i;
        touched_ = true;
        return data_[i];
    }

    static long long jumps() { return jumps_; }
    static void reset() { jumps_ = 0; touched_ = false; }

private:
    std::size_t index(int r, int c) const { return std::size_t(r) * cols_ + c; }

    int rows_, cols_;
    std::vector<int> data_;
    static inline long long jumps_ = 0;
    static inline std::size_t last_ = 0;
    static inline bool touched_ = false;
};

long long total(const Matrix& m) {
    long long sum = 0;
    for (int r = 0; r < m.rows(); ++r)
        for (int c = 0; c < m.cols(); ++c) sum += m.at(r, c);
    return sum;
}

std::vector<long long> column_sums(const Matrix& m) {
    std::vector<long long> sums(m.cols(), 0);
    for (int r = 0; r < m.rows(); ++r)
        for (int c = 0; c < m.cols(); ++c) sums[c] += m.at(r, c);
    return sums;
}
```

## Notes
Both fixes are the same two lines swapped, and both go from 14,399 jumps to
zero.

`column_sums` is the one worth remembering, because the instinct it corrects is
a strong one. The output is a per-column array, so the natural code is "for each
column, sum it" — and that is a column-major walk of a row-major array, the
slowest possible order. Turning it inside out costs nothing: you keep an
accumulator for every column and update whichever one the current element
belongs to, so the *reads* stay sequential and the *writes* scatter instead.

That trade is nearly always worth taking, for a reason the chapter's cache-line
argument explains. The reads scatter across 57 KB of matrix, evicting lines
faster than they can be used. The writes scatter across 960 bytes of `sums` —
fifteen cache lines, which stay resident in L1 for the entire loop. Scattering
across something that fits in cache is free; scattering across something that
does not is the whole cost.

The jump counter is a stand-in for a cache simulator, and a fairly honest one:
it counts exactly the accesses that cannot have been prefetched. A real profiler
would report this as L1 misses — `perf stat -e L1-dcache-load-misses` — and give
you the same verdict with more noise.
