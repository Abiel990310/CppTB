---
id: spaceship-ordering
title: "Sort by two keys"
difficulty: core
chapter: operator-overloading
topics: [operators, comparison, sorting]
check: unit
standard: c++20
---

`Entry` needs an ordering: **higher score first**, and entries with equal scores
ordered by name ascending. A defaulted `operator<=>` would compare members in
declaration order, which is not that — so write the comparison.

Equality should be true when both members match.

## Starter
```cpp
#include <algorithm>
#include <compare>
#include <string>
#include <vector>

struct Entry {
    std::string name;
    int score;

    // Write operator<=> and operator== here.
};
```

## Tests
```cpp
Entry high{"zoe", 90};
Entry low{"amy", 10};

CHECK(high < low);          // higher score sorts first
CHECK(!(low < high));
CHECK(low > high);

// Equal scores: name ascending.
Entry amy{"amy", 50};
Entry bob{"bob", 50};
CHECK(amy < bob);
CHECK(!(bob < amy));

// Equality needs both members.
CHECK(Entry{"amy", 50} == Entry{"amy", 50});
CHECK(!(Entry{"amy", 50} == Entry{"amy", 51}));
CHECK(!(Entry{"amy", 50} == Entry{"bob", 50}));
CHECK(Entry{"amy", 50} != Entry{"bob", 50});

// The derived operators must all agree.
CHECK(high <= high);
CHECK(high >= high);
CHECK(!(high < high));

// And it must actually sort.
std::vector<Entry> entries{{"bob", 50}, {"zoe", 90}, {"amy", 50}, {"cat", 10}};
std::ranges::sort(entries);
CHECK_EQ(entries[0].name, std::string("zoe"));
CHECK_EQ(entries[1].name, std::string("amy"));
CHECK_EQ(entries[2].name, std::string("bob"));
CHECK_EQ(entries[3].name, std::string("cat"));
```

## Hints
- Return `std::strong_ordering` — both members compare with strong orderings, so the whole comparison does.
- To sort scores descending, reverse the operands: `other.score <=> score`.
- Compare the first key, and only fall through to the second when it is equivalent:
  `if (auto c = other.score <=> score; c != 0) return c;`
- `operator==` can be `= default`, which compares both members — exactly what the checks want.
- `<=>` generates `<`, `<=`, `>`, `>=`, but not `==`. Declare both.

## Solution
```cpp
#include <algorithm>
#include <compare>
#include <string>
#include <vector>

struct Entry {
    std::string name;
    int score;

    std::strong_ordering operator<=>(const Entry& other) const {
        if (auto c = other.score <=> score; c != 0) return c;   // higher score first
        return name <=> other.name;                             // then name ascending
    }

    bool operator==(const Entry&) const = default;
};
```

## Notes
The reversed operands in the first comparison are the whole trick for descending
order. Writing `score <=> other.score` and then trying to negate the result does
not work cleanly — `std::strong_ordering` has no unary minus — so reverse the
operands instead.

The `if (auto c = ...; c != 0)` form is worth adopting as a habit. It scopes the
comparison result to the `if`, and it reads as "if this key decides it, we are
done" — which is exactly the structure of every multi-key comparison.

`operator==` is defaulted rather than written, and that is deliberate: equality
should mean "the same entry", which is memberwise, even though *ordering* is
not. Those two being different is precisely why C++20 kept them separate rather
than deriving `==` from `<=>`.

One thing to notice: this ordering is **not** consistent with `==` in the
mathematical sense you might expect from a defaulted comparison — but it is
consistent here, because the tie-break on name makes two entries equivalent
under `<=>` only when both members match. Had the comparison stopped at score,
`amy` and `bob` would be equivalent-but-not-equal, which is a `weak_ordering`
and would need saying so in the return type.
