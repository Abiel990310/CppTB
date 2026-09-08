---
title: "Cache and data layout"
navTitle: "Cache and layout"
summary: >-
  Why the same algorithm can be ten times faster with different data layout.
objectives:
  - Explain what a cache line is and why locality matters
  - Compare array-of-structs with struct-of-arrays
  - Predict which of two loops is faster and verify it
status: complete
standard: c++20
requires: [measuring]
---

Two loops. Same array, same arithmetic, same number of additions, same
instruction count. One of them is seven times slower.

```cpp run title="The same 1,048,576 additions, two orders"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    constexpr int N = 1024;
    std::vector<int> matrix(N * N, 1);

    auto time = [](auto&& body) {
        auto start = std::chrono::steady_clock::now();
        long long result = body();
        auto end = std::chrono::steady_clock::now();
        keep(result);
        return std::chrono::duration<double, std::milli>(end - start).count();
    };

    double by_rows = time([&] {
        long long total = 0;
        for (int r = 0; r < N; ++r)
            for (int c = 0; c < N; ++c) total += matrix[r * N + c];
        return total;
    });

    double by_columns = time([&] {
        long long total = 0;
        for (int c = 0; c < N; ++c)
            for (int r = 0; r < N; ++r) total += matrix[r * N + c];
        return total;
    });

    std::printf("row-major order:    %7.2f ms\n", by_rows);
    std::printf("column-major order: %7.2f ms\n", by_columns);
    std::printf("ratio:              %7.1fx\n", by_columns / by_rows);
}
```

Press Run: the column order takes about three times as long. Compiled at `-O2`
without sanitizers, the gap widens to about **seven times**. Nothing in the C++
explains it — the compiler emits comparable code for both. The difference is
entirely in which order the addresses are touched.

## The cache line is the unit of transfer

Main memory is roughly two hundred times slower than a register. Between them
sit three or four levels of cache, and the important thing about them is not
that they are fast but that they deal in **fixed-size blocks**. On every current
x86-64 and ARM machine that block — a *cache line* — is 64 bytes.

Ask for one `int` and the hardware fetches all 64 bytes surrounding it. If the
next thing you read is the neighbouring `int`, it is already there and costs
almost nothing. If the next thing you read is 4 KB away, that whole line was
fetched for one useful value, and you pay again.

You can measure the line size without looking it up.

```cpp run title="Finding the cache line by walking with a stride"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    constexpr std::size_t N = 1u << 22;          // 16 MB of ints
    std::vector<int> data(N, 1);

    std::printf("  stride   reads      total       per read\n");
    for (std::size_t stride : {1u, 2u, 4u, 8u, 16u, 32u, 64u}) {
        auto start = std::chrono::steady_clock::now();
        long long total = 0;
        for (std::size_t i = 0; i < N; i += stride) total += data[i];
        auto end = std::chrono::steady_clock::now();
        keep(total);

        double ms = std::chrono::duration<double, std::milli>(end - start).count();
        std::size_t reads = N / stride;
        std::printf("  %6zu %8zu %8.2f ms %8.2f ns\n", stride, reads, ms, ms * 1e6 / double(reads));
    }
}
```

At `-O2` without sanitizers the per-read column reads:

```
  stride   reads      total       per read
       1  4194304     3.55 ms     0.85 ns
       2  2097152     2.64 ms     1.26 ns
       4  1048576     1.94 ms     1.85 ns
       8   524288     1.50 ms     2.86 ns
      16   262144     1.12 ms     4.29 ns
      32   131072     0.75 ms     5.70 ns
      64    65536     0.34 ms     5.11 ns
```

The cost per element roughly doubles each time the stride doubles — up to a
stride of **16 ints**. Sixteen `int`s is 64 bytes. Past that point the cost
stops growing, because every read was already paying for a full line and there
is nothing left to lose. The elbow in that column *is* the cache line, measured
rather than looked up.

Press Run and you will see something different: the first four rows are flat at
around 8 ns. That is the sanitizer's per-access bookkeeping, which costs more
than the memory access itself until the stride gets large — the real shape only
emerges from stride 16 onwards. It is the previous chapter's point arriving
uninvited.

Now the first sample explains itself. Row-major traversal reads `matrix[r*N+c]`
for consecutive `c`: sixteen useful values per line. Column-major reads
`matrix[r*N+c]` for consecutive `r`, which jumps 4,096 bytes each step — a new
line every time, and by the time the loop comes back round for column `c+1`,
the line has long since been evicted. Same additions, sixteen times the memory
traffic.

## Array of structs, struct of arrays

The same principle decides how to lay out records, and this is where it starts
affecting design rather than just loop order.

```cpp run title="Summing one field out of seven"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

// Array of structs: everything about one particle is together.
struct Particle {
    float x, y, z;
    float vx, vy, vz;
    int id;
    char tag[36];
};

// Struct of arrays: everything about one field is together.
struct Particles {
    std::vector<float> x, y, z;
    std::vector<float> vx, vy, vz;
};

int main() {
    constexpr int N = 400'000;

    std::vector<Particle> aos(N);
    for (auto& p : aos) p.x = 1.0f;

    Particles soa;
    soa.x.assign(N, 1.0f);

    auto time = [](auto&& body) {
        auto start = std::chrono::steady_clock::now();
        double result = body();
        auto end = std::chrono::steady_clock::now();
        keep(result);
        return std::chrono::duration<double, std::milli>(end - start).count();
    };

    double aos_ms = time([&] { double t = 0; for (const auto& p : aos) t += p.x; return t; });
    double soa_ms = time([&] { double t = 0; for (float x : soa.x)     t += x;   return t; });

    std::printf("sizeof(Particle) = %zu bytes\n", sizeof(Particle));
    std::printf("array of structs: %7.3f ms\n", aos_ms);
    std::printf("struct of arrays: %7.3f ms\n", soa_ms);
    std::printf("ratio:            %7.1fx\n", aos_ms / soa_ms);
}
```

`sizeof(Particle)` is 64 — exactly one cache line. Summing the `x` field of the
array-of-structs therefore fetches one line per particle and uses four of its
sixty-four bytes: **94% of the memory traffic is wasted**. The struct-of-arrays
version packs sixteen `x` values into each line and uses all of them. At `-O2`
that is a five-fold difference; under the sanitizers you will still see close to
two.

The trade is real and goes both ways:

| | Array of structs | Struct of arrays |
|---|---|---|
| Read *all* fields of one record | one line, everything present | one line per field, six lines |
| Read *one* field of all records | one line per record, mostly waste | dense, and vectorisable |
| Add or remove a record | one `push_back` | six, kept in step by hand |
| Pass one record to a function | natural: `const Particle&` | there is no one record to pass |
| Code that reads it | obvious | bookkeeping, and easy to desynchronise |

So the rule is not "SoA is faster". It is: **lay the data out in the order the
hot loop walks it.** A physics step that reads every field of every particle
wants AoS. A render pass that reads only positions wants SoA. If both exist,
one of them is going to pay, and the profile tells you which.

## Padding is layout too

A struct is not the sum of its members. Alignment requirements insert padding,
and the order you declare members in decides how much.

```cpp run title="The same four members, two sizes"
#include <cstddef>
#include <cstdio>

struct Wasteful {
    char   flag;      // 1 byte, then 7 wasted
    double value;     // 8
    char   kind;      // 1
    int    count;     // 4, preceded by 3 wasted
};                    // then 4 more to round the whole thing to 8

struct Tight {
    double value;     // 8
    int    count;     // 4
    char   flag;      // 1
    char   kind;      // 1
};                    // 2 wasted at the end

int main() {
    std::printf("Wasteful: %zu bytes  (flag@%zu value@%zu kind@%zu count@%zu)\n",
                sizeof(Wasteful), offsetof(Wasteful, flag), offsetof(Wasteful, value),
                offsetof(Wasteful, kind), offsetof(Wasteful, count));
    std::printf("Tight:    %zu bytes  (value@%zu count@%zu flag@%zu kind@%zu)\n",
                sizeof(Tight), offsetof(Tight, value), offsetof(Tight, count),
                offsetof(Tight, flag), offsetof(Tight, kind));
    std::printf("\none million of each: %.0f MB vs %.0f MB\n",
                1e6 * sizeof(Wasteful) / 1e6, 1e6 * sizeof(Tight) / 1e6);
}
```

24 bytes against 16, for the same four values in a different order. A `double`
must sit at an address divisible by 8, so declaring a `char` before it wastes
seven bytes; the compiler is not permitted to reorder members to fix this,
because the standard guarantees that members appear in declaration order.

At a million records that is 8 MB of nothing — but the real cost is that the
wasteful version fits 2.7 records per cache line and the tight one fits 4. A
third fewer records per fetch, for a declaration order.

:::tip
The rule of thumb: **declare members in decreasing order of alignment** —
`double` and pointers first, then `int`, then `short`, then `char` and `bool`.
It is not always optimal, and it is not worth contorting a struct whose fields
have a natural grouping, but it is free and it is right often enough to be a
default. `-Wpadded` will tell you where the holes are, though it is far too
noisy to leave on.
:::

## Why `std::list` lost

Chapter 4.4 said to reach for `std::vector` by default. This is the reason.

A `std::vector<int>` is one allocation, and walking it reads consecutive
addresses — the hardware prefetcher notices the pattern within a few elements
and starts fetching lines before you ask. A `std::list<int>` is one allocation
per element, each holding two pointers and an `int` (24 bytes plus allocator
overhead), scattered across the heap in whatever order they were allocated.
Every `++it` is a dependent load: the address of the next node is not known
until the current one arrives, so the prefetcher has nothing to predict and the
latencies cannot overlap.

Summing 400,000 elements at `-O2`: 0.25 ms for the vector, 1.60 ms for the list
— **six times**, for a traversal that is `O(n)` either way. Under this page's
sanitized `-O0` build the gap almost vanishes, because the instrumentation costs
more than the memory does; that is a good demonstration of why you cannot
measure layout effects in a debug build.

The list still wins where its promise is the one you need: `O(1)` insertion in
the middle given an iterator, and references that survive it. But "I insert a
lot, so I need a list" is usually wrong, because moving elements in a vector is
a `memmove` at gigabytes per second, and finding the position to insert at
requires walking the list anyway.

## Check yourself

:::quiz
{
  "question": "A struct is 64 bytes and you loop over a million of them summing one 4-byte field. What fraction of the memory you fetch is used?",
  "options": [
    { "text": "About 6% — one cache line arrives per struct and four of its sixty-four bytes are read", "correct": true, "why": "The hardware has no way to fetch less than a line. Splitting that field into its own array is what turns 6% into 100%." },
    { "text": "100% — the CPU only reads the bytes you asked for", "why": "The cache line is the unit of transfer. Asking for one int fetches the 64 bytes around it." },
    { "text": "50%, because of the prefetcher", "why": "The prefetcher decides *when* lines are fetched, not how much of each one you use." },
    { "text": "It depends on the optimisation level", "why": "It is a property of the layout and the access pattern. The optimiser cannot change how much of a line you read." }
  ]
}
:::

:::quiz
{
  "question": "You reorder a struct's members from `{char, double, char, int}` to `{double, int, char, char}` and it shrinks from 24 bytes to 16. Why can the compiler not do this for you?",
  "options": [
    { "text": "The standard guarantees members are laid out in declaration order, so reordering would break code that relies on the layout", "correct": true, "why": "Offsets are observable — through `offsetof`, through `memcpy` to a wire format, through interop with C. The compiler may insert padding but may not reorder." },
    { "text": "It does not know the alignment requirements until link time", "why": "It knows them exactly; that is what produced the padding in the first place." },
    { "text": "It would change the class's constructors", "why": "Member initialisation order follows declaration order regardless of layout, and is unaffected by padding." },
    { "text": "Reordering is only unsafe for types with virtual functions", "why": "The guarantee applies to all class types with the same access control, virtual or not." }
  ]
}
:::

## Practice

:::exercise struct-diet

:::exercise transpose-the-loop

:::recap
- Memory moves in 64-byte cache lines. Reading one byte costs a whole line, so
  the value of a fetch is however much of that line you go on to use.
- Row-major traversal of a matrix uses sixteen `int`s per line; column-major uses
  one. Same additions, seven times the wall clock.
- The cache line size is measurable: walk an array with increasing strides and
  watch the cost per element stop growing at 64 bytes.
- Array-of-structs is right when the loop reads whole records; struct-of-arrays
  is right when it reads one field of many. Lay data out the way the hot loop
  walks it.
- Declaration order changes `sizeof` because padding follows alignment. Declaring
  members largest-first is free and usually right.
- `std::list` loses to `std::vector` on traversal by roughly six times, because
  each `++it` is a dependent load the prefetcher cannot anticipate.
- None of these effects are visible in a sanitized debug build. Measure layout
  at `-O2`.
:::
