---
id: count-if-template
title: "Generic over the range and the test"
difficulty: core
chapter: function-templates
topics: [templates, iterators, generics]
check: unit
standard: c++20
---

Write `count_matching`, a function template taking a pair of iterators and a
predicate, returning how many elements satisfy it.

It must work on any range — vector, list, raw array, or part of one — and with
any predicate, including a lambda and a plain function.

## Starter
```cpp
#include <cstddef>

// Write the template here.
```

## Tests
```cpp
auto is_even = [](int x) { return x % 2 == 0; };

std::vector<int> v{1, 2, 3, 4, 5, 6};
CHECK_EQ(count_matching(v.begin(), v.end(), is_even), std::size_t{3});

// Part of a range.
CHECK_EQ(count_matching(v.begin() + 2, v.end(), is_even), std::size_t{2});

// An empty range.
CHECK_EQ(count_matching(v.begin(), v.begin(), is_even), std::size_t{0});

// A list: bidirectional iterators, so no `<` and no `+ n`.
std::list<int> l{2, 4, 5, 6};
CHECK_EQ(count_matching(l.begin(), l.end(), is_even), std::size_t{3});

// A raw array.
int raw[] = {1, 2, 3, 4};
CHECK_EQ(count_matching(std::begin(raw), std::end(raw), is_even), std::size_t{2});

// A different element type, and a different predicate shape.
std::vector<std::string> words{"a", "bb", "ccc", "dddd"};
CHECK_EQ(count_matching(words.begin(), words.end(),
                        [](const std::string& s) { return s.size() > 2; }),
         std::size_t{2});

// A plain function, not a lambda.
CHECK_EQ(count_matching(v.begin(), v.end(), +[](int x) { return x > 4; }),
         std::size_t{2});
```

## Hints
- Two type parameters: one for the iterator, one for the predicate.
- Return `std::size_t`, and loop with `for (; first != last; ++first)`.
- Use `!=`, never `<` — a `std::list` iterator has no ordering comparison.
- Do not name the element type anywhere; `*first` supplies it and the predicate accepts whatever it is.
- The tests need `<vector>`, `<list>`, `<string>`, and `<iterator>`; include them.

## Solution
```cpp
#include <cstddef>
#include <iterator>
#include <list>
#include <string>
#include <vector>

template <class Iterator, class Predicate>
std::size_t count_matching(Iterator first, Iterator last, Predicate pred) {
    std::size_t found = 0;
    for (; first != last; ++first) {
        if (pred(*first)) ++found;
    }
    return found;
}
```

## Notes
Two type parameters, and neither is ever written at a call site — both are
deduced. `Predicate` being a template parameter rather than a
`std::function<bool(int)>` is what keeps this fast: each lambda has its own
unique type, so each instantiation calls it directly and the compiler inlines
the body. A `std::function` parameter would compile too, and would add an
indirect call and possibly an allocation.

The `std::list` case is the one that punishes `<`. Bidirectional iterators
support `++`, `--`, and `!=`, but not ordering — so a loop written
`first < last` compiles for a vector and fails for a list, which is how a
function that looked generic turns out not to be.

The last check passes `+[](int x) { ... }`. The unary `+` forces the
captureless lambda to convert to a plain function pointer, which is a different
type from the closure — a small proof that `Predicate` really does accept
anything callable, not just lambdas.

This is `std::count_if`. Writing it once is worth it because every
iterator-based algorithm has this exact shape.
