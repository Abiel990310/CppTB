---
id: bounds-audit
title: "Which bound did you want?"
difficulty: core
chapter: binary-search
topics: [binary-search, algorithms, off-by-one]
check: unit
standard: c++20
---

Five queries about a sorted vector, each one line of standard library. Four are
wrong: the wrong bound, a missing `end()` check, or an off-by-one.

- `count_less(v, x)` — how many elements are strictly less than `x`.
- `count_at_most(v, x)` — how many are less than or equal to `x`.
- `count_equal(v, x)` — how many equal `x`.
- `contains(v, x)` — whether `x` is present.
- `smallest_at_least(v, x)` — the smallest element `>= x`, or `std::nullopt`
  when there is none.

`v` is always sorted ascending and may contain duplicates.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <optional>
#include <vector>

std::size_t count_less(const std::vector<int>& v, int x) {
    return static_cast<std::size_t>(
        std::upper_bound(v.begin(), v.end(), x) - v.begin());
}

std::size_t count_at_most(const std::vector<int>& v, int x) {
    return static_cast<std::size_t>(
        std::lower_bound(v.begin(), v.end(), x) - v.begin());
}

std::size_t count_equal(const std::vector<int>& v, int x) {
    auto low = std::lower_bound(v.begin(), v.end(), x);
    return static_cast<std::size_t>(v.end() - low);
}

bool contains(const std::vector<int>& v, int x) {
    return std::lower_bound(v.begin(), v.end(), x) != v.end();
}

std::optional<int> smallest_at_least(const std::vector<int>& v, int x) {
    return *std::lower_bound(v.begin(), v.end(), x);
}
```

## Tests
```cpp
std::vector<int> v{1, 3, 3, 3, 5, 8};

// count_less
CHECK_EQ(count_less(v, 0), std::size_t{0});
CHECK_EQ(count_less(v, 1), std::size_t{0});
CHECK_EQ(count_less(v, 3), std::size_t{1});
CHECK_EQ(count_less(v, 4), std::size_t{4});
CHECK_EQ(count_less(v, 8), std::size_t{5});
CHECK_EQ(count_less(v, 9), std::size_t{6});

// count_at_most
CHECK_EQ(count_at_most(v, 0), std::size_t{0});
CHECK_EQ(count_at_most(v, 1), std::size_t{1});
CHECK_EQ(count_at_most(v, 3), std::size_t{4});
CHECK_EQ(count_at_most(v, 4), std::size_t{4});
CHECK_EQ(count_at_most(v, 8), std::size_t{6});
CHECK_EQ(count_at_most(v, 9), std::size_t{6});

// count_equal
CHECK_EQ(count_equal(v, 3), std::size_t{3});
CHECK_EQ(count_equal(v, 1), std::size_t{1});
CHECK_EQ(count_equal(v, 4), std::size_t{0});
CHECK_EQ(count_equal(v, 0), std::size_t{0});
CHECK_EQ(count_equal(v, 9), std::size_t{0});
CHECK_EQ(count_equal(v, 8), std::size_t{1});

// contains
CHECK(contains(v, 1));
CHECK(contains(v, 3));
CHECK(contains(v, 8));
CHECK(!contains(v, 0));
CHECK(!contains(v, 4));
CHECK(!contains(v, 9));          // larger than everything

// smallest_at_least
CHECK_EQ(smallest_at_least(v, 0).value(), 1);
CHECK_EQ(smallest_at_least(v, 3).value(), 3);
CHECK_EQ(smallest_at_least(v, 4).value(), 5);
CHECK_EQ(smallest_at_least(v, 8).value(), 8);
CHECK(!smallest_at_least(v, 9).has_value());     // nothing is large enough

// An empty vector must not crash any of them.
std::vector<int> none;
CHECK_EQ(count_less(none, 5), std::size_t{0});
CHECK_EQ(count_at_most(none, 5), std::size_t{0});
CHECK_EQ(count_equal(none, 5), std::size_t{0});
CHECK(!contains(none, 5));
CHECK(!smallest_at_least(none, 5).has_value());
```

## Hints
- `lower_bound(x)` is the first element `>= x`, so its index is the count of elements strictly **less** than `x`. `upper_bound(x)` is the first `> x`, so its index is the count `<= x`. The starter has these two the wrong way round.
- `count_equal` should be `upper_bound - lower_bound`, or equivalently the size of `equal_range`. Measuring to `end()` counts everything at or above `x`.
- `contains` is not "the iterator is not `end()`" — `lower_bound` returns a valid iterator to a *larger* element when `x` is absent. You also have to check `*it == x`. Or just use `std::binary_search`, which is exactly this question.
- `smallest_at_least` dereferences without checking. When `x` is greater than every element, `lower_bound` returns `end()`, and reading through it is undefined behaviour.
- Check `it != v.end()` first, and return `std::nullopt` when it is.
- All five must work on an empty vector, where `begin() == end()`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <optional>
#include <vector>

std::size_t count_less(const std::vector<int>& v, int x) {
    return static_cast<std::size_t>(
        std::lower_bound(v.begin(), v.end(), x) - v.begin());
}

std::size_t count_at_most(const std::vector<int>& v, int x) {
    return static_cast<std::size_t>(
        std::upper_bound(v.begin(), v.end(), x) - v.begin());
}

std::size_t count_equal(const std::vector<int>& v, int x) {
    auto [first, last] = std::equal_range(v.begin(), v.end(), x);
    return static_cast<std::size_t>(last - first);
}

bool contains(const std::vector<int>& v, int x) {
    return std::binary_search(v.begin(), v.end(), x);
}

std::optional<int> smallest_at_least(const std::vector<int>& v, int x) {
    auto it = std::lower_bound(v.begin(), v.end(), x);
    if (it == v.end()) return std::nullopt;
    return *it;
}
```

## Notes
All five bugs come from the same misreading: treating `lower_bound` as "find
`x`" rather than as "find the position where `x` belongs".

It is a *position*, and that is why its index is the count of smaller elements
and why it is valid even when `x` is absent — it points at where `x` would go.
Once you read it that way, the pair falls out: `lower_bound` is the start of the
run of `x`s, `upper_bound` is the end, and the gap between them is how many
there are. Swapping the two, as the starter does for the first two functions,
produces answers that are correct whenever `x` is absent and wrong whenever it is
present, which is a good way to pass a hand-written test and fail a real one.

`contains` is the trap worth the most. `lower_bound(v, 4)` on `{1,3,3,3,5,8}`
returns an iterator to `5` — a perfectly valid, non-`end()` iterator to an
element that is not `4`. The starter therefore reports that every value below
the maximum is present. `std::binary_search` asks the question directly, and
when you need both the answer and the position, `it != end() && *it == x` is the
idiom.

`smallest_at_least` is the memory-safety one. `lower_bound` returns `end()` when
every element is smaller, and `*end()` is undefined behaviour — one past the
last element of the allocation. The sanitizers here may or may not report it,
because for a `std::vector` that address is frequently still inside the
allocated capacity, which makes this exactly the kind of bug that behaves
perfectly in testing.

The empty-vector checks at the end are cheap and catch a whole class of variant
mistakes: on an empty range `begin() == end()`, every bound returns `end()`,
every count is 0, and any unguarded dereference is a crash.
