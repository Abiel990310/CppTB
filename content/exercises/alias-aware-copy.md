---
id: alias-aware-copy
title: "When the source is the destination"
difficulty: core
chapter: what-the-compiler-does
topics: [performance, pointers, aliasing]
check: unit
standard: c++20
---

`copy_forward` copies `n` elements from `src` to `dst` with a plain loop. It is
correct as long as the two ranges do not overlap. The moment they do — and
"shift everything left by one" is exactly that case — it starts reading
elements it has already overwritten.

Write `move_range(dst, src, n)`, which produces the same result as
`copy_forward` for disjoint ranges *and* the correct result when the ranges
overlap in either direction. This is what `std::memmove` does, and what
`std::copy_backward` exists for.

Do not use `std::memmove`, `std::copy`, or `std::copy_backward` — write the
logic.

## Starter
```cpp
#include <cstddef>

void copy_forward(int* dst, const int* src, std::size_t n) {
    for (std::size_t i = 0; i < n; ++i) dst[i] = src[i];
}

void move_range(int* dst, const int* src, std::size_t n) {
    for (std::size_t i = 0; i < n; ++i) dst[i] = src[i];
}
```

## Tests
```cpp
// Disjoint ranges: both functions agree.
{
    int source[5] = {1, 2, 3, 4, 5};
    int target[5] = {0, 0, 0, 0, 0};
    move_range(target, source, 5);
    CHECK_EQ(target[0], 1);
    CHECK_EQ(target[4], 5);
}

// Overlapping, shifting left: dst is before src.
{
    int data[6] = {1, 2, 3, 4, 5, 6};
    move_range(data, data + 1, 5);          // drop the first element
    CHECK_EQ(data[0], 2);
    CHECK_EQ(data[1], 3);
    CHECK_EQ(data[2], 4);
    CHECK_EQ(data[3], 5);
    CHECK_EQ(data[4], 6);
}

// Overlapping, shifting right: dst is after src. This is the case a forward
// loop gets wrong.
{
    int data[6] = {1, 2, 3, 4, 5, 0};
    move_range(data + 1, data, 5);          // make room at the front
    CHECK_EQ(data[1], 1);
    CHECK_EQ(data[2], 2);
    CHECK_EQ(data[3], 3);
    CHECK_EQ(data[4], 4);
    CHECK_EQ(data[5], 5);
    CHECK_EQ(data[0], 1);                   // untouched
}

// Exactly the same pointer: a no-op, not a crash.
{
    int data[3] = {7, 8, 9};
    move_range(data, data, 3);
    CHECK_EQ(data[0], 7);
    CHECK_EQ(data[2], 9);
}

// Zero elements: touch nothing.
{
    int data[2] = {4, 5};
    move_range(data, data + 1, 0);
    CHECK_EQ(data[0], 4);
    CHECK_EQ(data[1], 5);
}

// And the broken one really is broken, which is why this problem exists.
{
    int data[6] = {1, 2, 3, 4, 5, 0};
    copy_forward(data + 1, data, 5);
    CHECK_EQ(data[1], 1);
    CHECK_EQ(data[5], 1);                   // every element became the first
}
```

## Hints
- There are two safe directions. Copying front-to-back is safe when `dst < src`; copying back-to-front is safe when `dst > src`.
- So the whole fix is: compare the pointers, then pick a loop.
- Counting down with an unsigned index needs care. `for (std::size_t i = n; i > 0; --i)` and then indexing with `i - 1` avoids the wrap-around that `i >= 0` would cause.
- `dst == src` needs no work at all, and falls out of either branch if you handle it as "not greater than".
- Comparing pointers into the same array with `<` is well defined. Comparing pointers into *unrelated* objects is not — which is a hint about why the compiler cannot simply do this reasoning for you.

## Solution
```cpp
#include <cstddef>

void copy_forward(int* dst, const int* src, std::size_t n) {
    for (std::size_t i = 0; i < n; ++i) dst[i] = src[i];
}

void move_range(int* dst, const int* src, std::size_t n) {
    if (dst == src || n == 0) return;

    if (dst < src) {
        // Safe forwards: every element we read is ahead of every element
        // we have written.
        for (std::size_t i = 0; i < n; ++i) dst[i] = src[i];
    } else {
        // dst is after src, so write from the back.
        for (std::size_t i = n; i > 0; --i) dst[i - 1] = src[i - 1];
    }
}
```

## Notes
The last check is the interesting one. `copy_forward(data + 1, data, 5)` writes
`data[1] = data[0]`, then `data[2] = data[1]` — which is the value it just
wrote — and so on, smearing the first element across the array. Nothing
crashes, no sanitiser complains, and the answer is wrong. Overlap bugs are quiet.

The connection to the chapter: this ambiguity is exactly what the optimiser
faces on every loop that writes through one pointer and reads through another.
It cannot prove the ranges are disjoint, so it either emits a run-time check and
two versions of the loop, or gives up on vectorising. That cost is real and
visible in the assembly — compare the `-O3` output of a loop taking
`int* dst, const int* src` with the same loop taking `int* __restrict dst,
const int* __restrict src`.

Which is why the standard library gives you both tools. `std::memcpy` requires
disjoint ranges and is free to be as aggressive as it likes; `std::memmove`
handles overlap and pays for it. Choosing `memcpy` and being wrong about the
overlap is undefined behaviour, not a wrong answer — so when you are not sure,
`memmove` is the one that is merely slower.
