---
id: top-scorers
title: "The top three, without sorting everything"
difficulty: stretch
chapter: algorithms
topics: [algorithms, ranges, projections]
check: unit
standard: c++20
---

`top_three` should return the names of the three highest-scoring people, highest
first. Ties are broken by name, ascending.

Write it with standard algorithms and a projection rather than a hand-rolled
loop. The input may hold fewer than three people, in which case return all of
them in the same order.

## Starter
```cpp
#include <string>
#include <vector>

struct Person {
    std::string name;
    int score;
};

std::vector<std::string> top_three(std::vector<Person> people) {
    return {};
}
```

## Tests
```cpp
{
    std::vector<Person> people{
        {"ada", 90}, {"alan", 85}, {"grace", 95}, {"edsger", 70}, {"barbara", 88}};
    auto top = top_three(people);
    CHECK_EQ(top.size(), std::size_t{3});
    CHECK_EQ(top[0], std::string("grace"));
    CHECK_EQ(top[1], std::string("ada"));
    CHECK_EQ(top[2], std::string("barbara"));
}
{
    // Ties broken by name ascending.
    std::vector<Person> people{
        {"zoe", 90}, {"amy", 90}, {"mia", 90}, {"bob", 10}};
    auto top = top_three(people);
    CHECK_EQ(top.size(), std::size_t{3});
    CHECK_EQ(top[0], std::string("amy"));
    CHECK_EQ(top[1], std::string("mia"));
    CHECK_EQ(top[2], std::string("zoe"));
}
{
    std::vector<Person> people{{"solo", 5}};
    auto top = top_three(people);
    CHECK_EQ(top.size(), std::size_t{1});
    CHECK_EQ(top[0], std::string("solo"));
}
{
    std::vector<Person> people;
    CHECK(top_three(people).empty());
}
{
    std::vector<Person> people{{"a", 1}, {"b", 2}};
    auto top = top_three(people);
    CHECK_EQ(top.size(), std::size_t{2});
    CHECK_EQ(top[0], std::string("b"));
    CHECK_EQ(top[1], std::string("a"));
}
```

## Hints
- The parameter is by value, so you may sort it in place without affecting the caller.
- One comparator handles both rules: higher score first, and when scores are equal, smaller name first.
- `std::ranges::partial_sort(people, people.begin() + n, comp)` orders only the first `n` — cheaper than sorting everything.
- `n` must be `min(3, people.size())`, or `begin() + n` runs past the end.
- Then `std::ranges::transform` with `&Person::name` into a `std::back_inserter` collects the names.

## Solution
```cpp
#include <algorithm>
#include <iterator>
#include <string>
#include <vector>

struct Person {
    std::string name;
    int score;
};

std::vector<std::string> top_three(std::vector<Person> people) {
    const std::size_t n = std::min<std::size_t>(3, people.size());

    std::ranges::partial_sort(
        people, people.begin() + static_cast<std::ptrdiff_t>(n),
        [](const Person& a, const Person& b) {
            if (a.score != b.score) return a.score > b.score;
            return a.name < b.name;
        });

    std::vector<std::string> names;
    names.reserve(n);
    std::ranges::transform(people.begin(), people.begin() + static_cast<std::ptrdiff_t>(n),
                           std::back_inserter(names), &Person::name);
    return names;
}
```

## Notes
`partial_sort` is the point of the exercise. Sorting all *n* people to look at
three is O(n log n) when the job is O(n log 3) — irrelevant for five people,
very relevant for a million.

The tie-break comparator is written as two comparisons rather than one clever
expression because it must be a **strict weak ordering**. Note it uses `>` and
`<`, never `>=` or `<=`: a comparator where `comp(a, a)` is true is undefined
behaviour in `sort`, as the chapter shows.

A projection alone cannot express this comparator, since the rule involves two
different members. That is the boundary: projections handle "compare by *this*
member", and anything with a tie-break needs a real comparator. The projection
still earns its place in the `transform` at the end, where `&Person::name`
replaces a lambda entirely.
