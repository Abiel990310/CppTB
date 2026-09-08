---
id: struct-diet
title: "Fifty-six bytes of thirty-three"
difficulty: core
chapter: cache-and-layout
topics: [performance, layout, alignment, structs]
check: unit
standard: c++20
---

`Record` holds 33 bytes of actual data and occupies 56. The waste is padding,
and the padding is a consequence of the order the members are declared in.

Reorder the members so that `sizeof(Record)` is 40 — the smallest it can be for
these members on a machine where `double` and `long long` align to 8. Keep every
member's name and type exactly as they are; only the order may change.

`Pixel` is already as small as it can get. Leave it alone: the checks fail if it
grows.

## Starter
```cpp
#include <cstdint>

struct Record {
    bool      active;
    double    score;
    char      grade;
    int       id;
    short     flags;
    double    weight;
    char      initial;
    long long timestamp;
};

struct Pixel {
    std::uint8_t r, g, b, a;
};
```

## Tests
```cpp
static_assert(sizeof(Record) == 40, "Record should be 40 bytes after reordering");
static_assert(alignof(Record) == 8, "the alignment is set by its widest member");
static_assert(sizeof(Pixel) == 4, "Pixel was already tight; do not pad it");

// Every member must still be there, with the same name and type.
Record r{};
r.active = true;
r.score = 91.5;
r.grade = 'A';
r.id = 7;
r.flags = -3;
r.weight = 0.25;
r.initial = 'z';
r.timestamp = 1'700'000'000'000LL;

CHECK(r.active);
CHECK_NEAR(r.score, 91.5, 1e-12);
CHECK_EQ(r.grade, 'A');
CHECK_EQ(r.id, 7);
CHECK_EQ(r.flags, short{-3});
CHECK_NEAR(r.weight, 0.25, 1e-12);
CHECK_EQ(r.initial, 'z');
CHECK_EQ(r.timestamp, 1'700'000'000'000LL);

static_assert(std::is_same_v<decltype(Record::score), double>);
static_assert(std::is_same_v<decltype(Record::flags), short>);
static_assert(std::is_same_v<decltype(Record::active), bool>);

// The point of the exercise, stated as arithmetic: how many records fit in a
// 64-byte cache line.
CHECK_EQ(64 / sizeof(Record), std::size_t{1});
CHECK(sizeof(Record) * 1000 <= 40000);

Pixel p{1, 2, 3, 4};
CHECK_EQ(p.r, std::uint8_t{1});
CHECK_EQ(p.a, std::uint8_t{4});
```

## Hints
- Add up the member sizes: 8 + 8 + 8 + 4 + 2 + 1 + 1 + 1 = 33. Rounded up to the struct's alignment of 8, that is 40 — so 40 is the floor, and the starter is 16 bytes above it.
- Padding is inserted *before* a member whose alignment requirement the current offset does not satisfy, and *after* the last member to round the total up to the struct's alignment.
- `bool active;` followed by `double score;` costs seven bytes of padding, because a `double` must start at a multiple of 8 and `active` left the offset at 1.
- Declare members in decreasing order of alignment: the 8-byte ones first, then the `int`, then the `short`, then the three single-byte members.
- The compiler may not reorder members for you — the standard guarantees declaration order — so this is genuinely your decision to make.
- Use `offsetof` in a scratch program if you want to see exactly where the holes are.

## Solution
```cpp
#include <cstdint>

struct Record {
    double    score;      // 0
    double    weight;     // 8
    long long timestamp;  // 16
    int       id;         // 24
    short     flags;      // 28
    bool      active;     // 30
    char      grade;      // 31
    char      initial;    // 32, then 7 bytes to round 33 up to 40
};

struct Pixel {
    std::uint8_t r, g, b, a;
};
```

## Notes
Same eight members, same types, same 33 bytes of information — 16 bytes less
memory, for a change that costs nothing and reads no worse.

The mechanism is worth being precise about. A member with alignment *a* must sit
at an offset that is a multiple of *a*, so the compiler inserts padding before
any member whose natural position does not qualify. In the starter, `active`
occupies offset 0, `score` must start at 8, and bytes 1–7 are wasted; `grade` at
16 forces three more before `id` at 20; and so on. Sorting by decreasing
alignment means each member lands on a boundary the previous one already
reached, so the only padding left is the tail — here 7 bytes, to round 33 up to
the struct's own alignment of 8.

Whether this matters depends entirely on how many you have. One `Record` on the
stack: irrelevant. A million of them in a vector that a loop walks: 56 MB
against 40 MB, and — because 64 is not divisible by either — the fetches that
straddle cache-line boundaries change too. That is the version of this change
that shows up in a profile.

`Pixel` is in the problem to make the opposite point. Four `uint8_t` need no
padding at any order, and there is nothing to win. Reordering structs is not a
habit to apply everywhere; it is a thing to do to the handful of types that
appear in your program by the million. Everywhere else, declare members in the
order that makes the type readable.
