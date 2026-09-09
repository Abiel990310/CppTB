---
id: comparator-audit
title: "Four comparators, three of them broken"
difficulty: core
chapter: sorting-and-comparators
topics: [sorting, comparators, undefined-behaviour]
check: unit
standard: c++20
---

Four comparators for the same `Record`. Three violate strict weak ordering,
which means passing them to `std::sort` is undefined behaviour rather than a
wrong order.

Fix them so each produces the ordering its name and comment describe, using only
`<` on the fields.

- `by_score_desc` — highest score first. Uses `>=`.
- `by_name_then_score` — by name, then by score ascending. Chains `<=`.
- `by_length` — by name length, then by name. Compares lengths with `<=`.
- `by_score_then_index` — by score descending, then by original index
  ascending. Already correct; leave it alone and confirm that it is.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <tuple>
#include <vector>

struct Record {
    std::string name;
    int score;
    int index;
};

// Highest score first.
inline bool by_score_desc(const Record& a, const Record& b) {
    return a.score >= b.score;
}

// By name; ties broken by ascending score.
inline bool by_name_then_score(const Record& a, const Record& b) {
    return a.name <= b.name && a.score <= b.score;
}

// By name length; ties broken by the name itself.
inline bool by_length(const Record& a, const Record& b) {
    return a.name.size() <= b.name.size();
}

// Highest score first; ties broken by ascending original index.
inline bool by_score_then_index(const Record& a, const Record& b) {
    if (a.score != b.score) return a.score > b.score;
    return a.index < b.index;
}
```

## Tests
```cpp
// A comparator is a strict weak ordering only if comp(x, x) is false for
// every x. That is the property all three bugs break.
Record x{"ada", 50, 0};
CHECK(!by_score_desc(x, x));
CHECK(!by_name_then_score(x, x));
CHECK(!by_length(x, x));
CHECK(!by_score_then_index(x, x));

// And asymmetric: comp(a, b) and comp(b, a) must not both hold.
Record a{"ada", 50, 0};
Record b{"bob", 50, 1};
CHECK(!(by_score_desc(a, b) && by_score_desc(b, a)));
CHECK(!(by_name_then_score(a, b) && by_name_then_score(b, a)));
CHECK(!(by_length(a, b) && by_length(b, a)));

// by_score_desc
{
    std::vector<Record> v{{"a", 10, 0}, {"b", 30, 1}, {"c", 20, 2}, {"d", 30, 3}};
    std::sort(v.begin(), v.end(), by_score_desc);
    CHECK_EQ(v[0].score, 30);
    CHECK_EQ(v[1].score, 30);
    CHECK_EQ(v[2].score, 20);
    CHECK_EQ(v[3].score, 10);
}

// by_name_then_score
{
    std::vector<Record> v{{"bob", 10, 0}, {"ada", 90, 1}, {"ada", 20, 2}, {"cy", 5, 3}};
    std::sort(v.begin(), v.end(), by_name_then_score);
    CHECK_EQ(v[0].name, std::string("ada"));
    CHECK_EQ(v[0].score, 20);          // ada, lower score first
    CHECK_EQ(v[1].name, std::string("ada"));
    CHECK_EQ(v[1].score, 90);
    CHECK_EQ(v[2].name, std::string("bob"));
    CHECK_EQ(v[3].name, std::string("cy"));
}

// by_length
{
    std::vector<Record> v{{"ccc", 1, 0}, {"a", 1, 1}, {"bb", 1, 2}, {"aa", 1, 3}};
    std::sort(v.begin(), v.end(), by_length);
    CHECK_EQ(v[0].name, std::string("a"));
    CHECK_EQ(v[1].name, std::string("aa"));   // same length as bb, sorts first
    CHECK_EQ(v[2].name, std::string("bb"));
    CHECK_EQ(v[3].name, std::string("ccc"));
}

// by_score_then_index was already right.
{
    std::vector<Record> v{{"a", 5, 3}, {"b", 9, 1}, {"c", 5, 0}, {"d", 9, 2}};
    std::sort(v.begin(), v.end(), by_score_then_index);
    CHECK_EQ(v[0].index, 1);
    CHECK_EQ(v[1].index, 2);
    CHECK_EQ(v[2].index, 0);
    CHECK_EQ(v[3].index, 3);
}

// Sorting a run of equal elements must not fall over. With a non-strict
// comparator this reads past the end of the vector.
{
    std::vector<Record> many;
    for (int i = 0; i < 300; ++i) many.push_back(Record{"same", 7, i});
    std::sort(many.begin(), many.end(), by_score_desc);
    std::sort(many.begin(), many.end(), by_name_then_score);
    std::sort(many.begin(), many.end(), by_length);
    CHECK_EQ(many.size(), std::size_t{300});
}
```

## Hints
- `>=` is never a valid comparator. For descending order write `a.score > b.score` — strict, and still descending.
- `by_name_then_score`'s `&&` is not a tie-break; it is a completely different relation, and it is false for two records with equal names, which breaks transitivity too. A tie-break is sequential: compare the first key, and only look at the second if the first is equal.
- `std::tie(a.name, a.score) < std::tie(b.name, b.score)` does both keys in one strict comparison.
- `by_length` ignores the tie-break entirely and uses `<=` on the lengths. Compare lengths strictly, and fall through to comparing the names when they are equal.
- `std::tie` does not work here: it takes *references*, and `a.name.size()` is a temporary. `std::make_tuple` would copy the strings. The hand-written two-step form is the right tool for this one.
- `by_score_then_index` shows the hand-written form done properly: compare, and only fall through to the next key when the current one is *equal*. Use it as the template if you prefer that style to `tie`.
- The last check sorts 300 identical records three times. That is the case a non-strict comparator turns into a buffer overflow.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <tuple>
#include <vector>

struct Record {
    std::string name;
    int score;
    int index;
};

// Descending, and still strict: swap the operands rather than the operator.
inline bool by_score_desc(const Record& a, const Record& b) {
    return b.score < a.score;
}

inline bool by_name_then_score(const Record& a, const Record& b) {
    return std::tie(a.name, a.score) < std::tie(b.name, b.score);
}

inline bool by_length(const Record& a, const Record& b) {
    if (a.name.size() != b.name.size()) return a.name.size() < b.name.size();
    return a.name < b.name;
}

inline bool by_score_then_index(const Record& a, const Record& b) {
    if (a.score != b.score) return a.score > b.score;
    return a.index < b.index;
}
```

## Notes
The three bugs are three different ways to stop being strict, and only one of
them looks like a mistake.

**`>=` for descending** is the common one, and the fix is not to add a special
case but to keep the operator and swap the operands: `b.score < a.score`. That
is descending, irreflexive, and asymmetric by construction. Any time you find
yourself reaching for `>=` or `<=` in a comparator, the answer is `<` with the
arguments the other way round.

**`a.name <= b.name && a.score <= b.score`** is not a tie-break at all, and it
is worth understanding why it is so badly wrong. It is false for `x` against
itself only if one of the two `<=`s is false, which it never is — so
`comp(x, x)` is *true*, the most basic rule broken. It is also intransitive:
`{"a", 9}` versus `{"b", 1}` is false in both directions, so they are
"equivalent", and so are `{"b", 1}` and `{"c", 5}` — but `{"a", 9}` and
`{"c", 5}` are not, which means equivalence is not transitive and the algorithm's
assumptions collapse. A tie-break is sequential, never a conjunction.

**`by_length` ignoring the second key** is only a bug because the specification
says there is one; `<=` on the lengths alone is the strictness violation.

It is also the case where `std::tie` does not help, and the reason is worth
knowing: `std::tie` builds a tuple of *references*, and `a.name.size()` is a
prvalue with no address to refer to — so it does not compile. `std::make_tuple`
would compile and copy both strings on every comparison, which is a real cost
inside a sort. When a key is computed rather than stored, write the two-step
comparison out.

The last check is the one that would crash rather than merely misorder. Chapter
10.4's sample shows that `<=` on a run of equal elements makes `std::sort` walk
off the end of the buffer, and 300 identical records is exactly that run. It is
worth remembering that a broken comparator is not a wrong-answer bug — it is a
memory-safety bug that happens to live in a lambda.
