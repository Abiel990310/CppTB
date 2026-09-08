---
id: iterator-pair
title: "Write it for every container"
difficulty: core
chapter: iterators
topics: [iterators, templates, algorithms]
check: unit
standard: c++20
---

`count_matching` counts how many elements satisfy a predicate, but it takes a
`std::vector<int>`, so it works on exactly one container and one element type,
and cannot be given part of a range.

Rewrite it to take a pair of iterators, so it works on any range — vector, list,
a raw array, or a slice of any of them.

## Starter
```cpp
#include <vector>

template <class Predicate>
int count_matching(const std::vector<int>& values, Predicate pred) {
    int found = 0;
    for (int v : values) {
        if (pred(v)) ++found;
    }
    return found;
}
```

## Tests
```cpp
auto is_even = [](int x) { return x % 2 == 0; };

std::vector<int> v{1, 2, 3, 4, 5, 6};
CHECK_EQ(count_matching(v.begin(), v.end(), is_even), 3);

// Part of a range — impossible with a container parameter.
CHECK_EQ(count_matching(v.begin() + 2, v.end(), is_even), 2);
CHECK_EQ(count_matching(v.begin(), v.begin(), is_even), 0);

// A list: bidirectional iterators only, so no `<` and no `+ n`.
std::list<int> l{2, 4, 5};
CHECK_EQ(count_matching(l.begin(), l.end(), is_even), 2);

// A raw array.
int raw[] = {1, 2, 3, 4};
CHECK_EQ(count_matching(std::begin(raw), std::end(raw), is_even), 2);

// A different element type entirely.
std::vector<double> d{0.5, 2.0, 4.0};
CHECK_EQ(count_matching(d.begin(), d.end(), [](double x) { return x >= 2.0; }), 2);

// And strings.
std::vector<std::string> words{"a", "bb", "ccc"};
CHECK_EQ(count_matching(words.begin(), words.end(),
                        [](const std::string& s) { return s.size() > 1; }), 2);
```

## Hints
- Two template parameters now: one for the iterator type, one for the predicate.
- Loop with `for (; first != last; ++first)` and test `*first`. Use `!=`, not `<` — a list iterator has no `<`.
- Do not name the element type. `*first` gives it to you, and the predicate accepts whatever it is.
- The empty-range check (`v.begin(), v.begin()`) must return 0 without dereferencing anything.

## Solution
```cpp
#include <list>
#include <string>
#include <vector>

template <class Iterator, class Predicate>
int count_matching(Iterator first, Iterator last, Predicate pred) {
    int found = 0;
    for (; first != last; ++first) {
        if (pred(*first)) ++found;
    }
    return found;
}
```

## Notes
The function body barely changed; what changed is everything it can be called
with. That is the payoff of the iterator interface — one implementation covering
containers that share no code and no element type.

Two details carry the generality. Using `!=` rather than `<` is what admits the
`std::list` case, since a bidirectional iterator has no ordering comparison. And
never naming the element type is what admits `double` and `std::string`; had the
loop said `for (int v : ...)`, the string case would have failed to compile and
the `double` case would have silently truncated.

This is `std::count_if`, which you should use in real code. Writing it once by
hand is worth it because every algorithm in the library has this shape.
