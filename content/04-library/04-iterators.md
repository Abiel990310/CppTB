---
title: "Iterators"
navTitle: "Iterators"
summary: >-
  The abstraction that lets one algorithm work on every container.
objectives:
  - Name the iterator categories and what each supports
  - Write a function that takes a pair of iterators
  - Explain why end() points past the last element
status: complete
standard: c++20
requires: [algorithms, pointers]
---

You have been using iterators since Chapter 2.2 without the name. A pointer
walking an array is an iterator; `v.begin()` is an iterator; the range-based
`for` loop is iterators underneath.

The idea is a single interface for "position in a sequence", so that
`std::find` can be written once and work on a vector, a list, a map, a stream,
or a raw array. That is the whole of it. What is worth learning is the vocabulary
— because error messages use it, and because knowing which operations a
container's iterator supports tells you which algorithms are cheap on it.

## end() points past the last element

```cpp run title="The half-open range" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{10, 20, 30};

    for (auto it = v.begin(); it != v.end(); ++it) {
        std::cout << *it << ' ';
    }
    std::cout << '\n';

    std::cout << "distance: " << (v.end() - v.begin()) << '\n';
    std::cout << "last element: " << *(v.end() - 1) << '\n';
}
```

Ranges are **half-open**: `[begin, end)` includes the first and excludes the
last. Three things fall out of that, and they are why the convention is
universal:

- The number of elements is exactly `end - begin`. No off-by-one.
- An empty range is `begin == end`, with no special case.
- Ranges compose: `[a, b)` and `[b, c)` join to `[a, c)` with no gap or overlap.

Dereferencing `end()` is undefined — there is no element there. That is the same
rule as the one-past-the-end pointer in Chapter 2.2, and for the same reason:
you may form it and compare against it, never read through it.

## Writing a function over a range

Taking a pair of iterators rather than a container makes a function work on
anything — including part of a container:

```cpp run title="One function, many containers" std=c++20
#include <deque>
#include <iostream>
#include <list>
#include <vector>

// Works on any range whose elements can be added.
template <class Iterator>
auto sum(Iterator first, Iterator last) {
    typename std::iterator_traits<Iterator>::value_type total{};
    for (; first != last; ++first) total += *first;
    return total;
}

int main() {
    std::vector<int> v{1, 2, 3, 4};
    std::list<int> l{10, 20, 30};
    std::deque<double> d{0.5, 1.5};
    int raw[] = {100, 200};

    std::cout << sum(v.begin(), v.end()) << '\n';
    std::cout << sum(l.begin(), l.end()) << '\n';
    std::cout << sum(d.begin(), d.end()) << '\n';
    std::cout << sum(std::begin(raw), std::end(raw)) << '\n';

    // And on part of a container, which a container parameter could not express.
    std::cout << sum(v.begin() + 1, v.end() - 1) << '\n';
}
```

`std::iterator_traits<It>::value_type` asks what the iterator points at. In
C++20 you would more often write `std::iter_value_t<Iterator>`, which is the
same thing spelled shorter.

Note the loop condition: `first != last`, not `first < last`. Only some
iterators support `<`; all of them support `!=`. Writing `!=` is what makes the
function work on a `std::list`.

## The categories

Iterators are graded by what they support. Each category includes everything the
one before it does.

| Category | Adds | Example |
|---|---|---|
| **input** | read once, `++` | reading from a stream |
| **forward** | read repeatedly, multi-pass | `std::forward_list` |
| **bidirectional** | `--` | `std::list`, `std::map`, `std::set` |
| **random access** | `+ n`, `- n`, `<`, `[]` | `std::vector`, `std::deque`, `std::array` |
| **contiguous** | elements adjacent in memory | `std::vector`, `std::array`, raw arrays |

```cpp run title="What each container's iterator can do" std=c++20
#include <iostream>
#include <iterator>
#include <list>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5};
    std::list<int> l{1, 2, 3, 4, 5};

    // Random access: jump directly.
    std::cout << "vector, third element: " << *(v.begin() + 2) << '\n';

    // A list iterator cannot do that: std::next walks, one step at a time.
    std::cout << "list, third element:   " << *std::next(l.begin(), 2) << '\n';

    // Both are bidirectional, so both can step backwards.
    std::cout << "vector, last: " << *std::prev(v.end()) << '\n';
    std::cout << "list, last:   " << *std::prev(l.end()) << '\n';

    std::cout << std::boolalpha;
    std::cout << "vector iterator is random access: "
              << std::random_access_iterator<decltype(v.begin())> << '\n';
    std::cout << "list iterator is random access:   "
              << std::random_access_iterator<decltype(l.begin())> << '\n';
    std::cout << "list iterator is bidirectional:   "
              << std::bidirectional_iterator<decltype(l.begin())> << '\n';
}
```

Those `std::random_access_iterator` names are C++20 **concepts** — compile-time
questions about a type. Chapter 5.4 covers writing them; here they are a
convenient way to ask.

Categories are why some algorithms are cheap only on some containers.
`std::sort` requires random access, so it does not accept a `std::list` at all —
which is why `list` provides its own `sort` member function. `std::next(it, n)`
is O(1) on a vector and O(n) on a list, and the call looks identical.

:::pitfall
When a template error message is a page long, the sentence to search for is
usually the category. `no match for 'operator+'` on an iterator means you asked
for random access from something that only walks. In C++20 a constrained
algorithm says so directly — `constraints not satisfied` naming
`random_access_iterator` — which is a large part of what concepts bought.
:::

## Iterators that are not positions

The interface is the abstraction, so anything implementing it counts — including
things that write, and things that generate values rather than storing them.

```cpp run title="Output iterators" std=c++20
#include <algorithm>
#include <iostream>
#include <iterator>
#include <vector>

int main() {
    const std::vector<int> source{1, 2, 3, 4, 5};

    // back_inserter turns each write into a push_back.
    std::vector<int> collected;
    std::ranges::copy_if(source, std::back_inserter(collected),
                         [](int x) { return x % 2; });
    std::cout << "odd count: " << collected.size() << '\n';

    // ostream_iterator turns each write into a stream insertion.
    std::cout << "straight to output: ";
    std::ranges::copy(source, std::ostream_iterator<int>{std::cout, " "});
    std::cout << '\n';
}
```

And reading a stream is an input range, which is why the word-counting loop in
Chapter 4.3 could be written with `>>`:

```cpp run title="A stream as a range" std=c++20
#include <algorithm>
#include <iostream>
#include <iterator>
#include <sstream>
#include <vector>

int main() {
    std::istringstream input{"4 8 15 16 23 42"};

    std::vector<int> numbers{std::istream_iterator<int>{input},
                             std::istream_iterator<int>{}};

    std::cout << numbers.size() << " numbers, max "
              << *std::ranges::max_element(numbers) << '\n';
}
```

A default-constructed `istream_iterator` is the end-of-stream marker — the
"one past the last" of a sequence whose length nobody knows in advance. This is
an **input** iterator: single-pass, because reading consumes.

## Invalidation, once more

Chapter 4.2 gave vector's rules. The general principle is worth stating plainly:
**an iterator is a position in a container, and operations that restructure the
container can make that position meaningless.**

```cpp run expect-ub title="Erasing while iterating, done wrongly" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6};

    for (auto it = v.begin(); it != v.end(); ++it) {
        if (*it % 2 == 0) {
            v.erase(it);        // `it` is now invalid; ++it is undefined
        }
    }
    std::cout << "size " << v.size() << '\n';
}
```

`erase` returns an iterator to the element after the erased one, which is
exactly what you need:

```cpp run title="Erasing while iterating, done correctly" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6};

    for (auto it = v.begin(); it != v.end(); ) {
        if (*it % 2 == 0) {
            it = v.erase(it);        // advance by taking the returned iterator
        } else {
            ++it;                    // only advance when nothing was removed
        }
    }

    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';

    // Or skip the whole question:
    std::vector<int> other{1, 2, 3, 4, 5, 6};
    std::erase_if(other, [](int x) { return x % 2 == 0; });
    std::cout << "erase_if left " << other.size() << " elements\n";
}
```

Note the missing `++it` in the loop header. Advancing happens in exactly one of
the two branches, which is the part people get wrong when they write this from
memory.

## What range-based for actually is

```cpp run title="The loop, expanded" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};

    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';

    // Roughly what the compiler generates:
    {
        auto&& range = v;
        auto first = range.begin();
        auto last = range.end();
        for (; first != last; ++first) {
            int x = *first;
            std::cout << x << ' ';
        }
    }
    std::cout << '\n';
}
```

Two consequences worth knowing. `for (auto x : v)` **copies** each element,
because `x` is initialised from `*first` — which is why `const auto&` is the
reflex from Chapter 2.3. And modifying the container inside the loop invalidates
`first` and `last`, which the expansion makes obvious: they were taken once,
before the first iteration.

## Check yourself

:::quiz
{
  "question": "Why does `end()` point one past the last element rather than at it?",
  "options": [
    { "text": "So that the last element can be modified safely", "why": "Modifying the last element works either way; it is reached through `end() - 1` or `back()`." },
    { "text": "So element count is `end - begin`, an empty range is `begin == end`, and adjacent ranges join with no gap", "correct": true, "why": "All three fall out of the half-open convention, and all three would need special cases otherwise — which is why every range in the library works this way." },
    { "text": "Because the last element's address cannot be taken", "why": "It certainly can — `&v.back()` is valid. The convention is about arithmetic working out, not about addressability." },
    { "text": "To leave room for a terminating value, as with C strings", "why": "No terminator is stored. `end()` is a position, not an element, and reading through it is undefined." }
  ]
}
:::

:::quiz
{
  "question": "Why does `std::sort` not accept `std::list` iterators?",
  "options": [
    { "text": "Because a list's elements are const", "why": "They are freely modifiable. The obstacle is how you reach them, not whether you may change them." },
    { "text": "Because sort needs random access — `it + n` and `it - it` — and a list iterator only steps one at a time", "correct": true, "why": "Right, which is why std::list provides its own sort member that relinks nodes instead. The category tells you which algorithms a container can support." },
    { "text": "Because list iterators are invalidated by sorting", "why": "list::sort preserves iterators to elements — it relinks nodes rather than moving values. Invalidation is not the obstacle." },
    { "text": "Because a list has no operator[]", "why": "Sort never uses subscripting; it uses iterator arithmetic. The missing operation is `+ n`, not `[]`." }
  ]
}
:::

## Practice

:::exercise iterator-pair

:::exercise erase-while-iterating

:::recap
- An iterator is a position in a sequence. A pointer into an array is one.
- Ranges are half-open, `[begin, end)`: element count is `end - begin`, an empty
  range is `begin == end`, and `end()` must never be dereferenced.
- Prefer `first != last` over `first < last` — `<` needs random access, `!=`
  works everywhere.
- Categories are input, forward, bidirectional, random access, contiguous, each
  adding operations. They determine which algorithms a container supports, and
  they are what long template errors are usually complaining about.
- Anything meeting the interface is an iterator: `back_inserter` writes into a
  container, `istream_iterator` reads from a stream.
- `erase` returns the next valid iterator. Advance by assigning from it, and
  only in the branch that did not erase — or use `std::erase_if`.
- Range-based `for` takes `begin` and `end` once, up front. Modifying the
  container inside it invalidates them.
:::
