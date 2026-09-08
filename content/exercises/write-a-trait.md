---
id: write-a-trait
title: "A trait of your own"
difficulty: core
chapter: type-traits
topics: [traits, templates, specialization, metaprogramming]
check: unit
standard: c++20
---

Three traits to write, each a primary template plus one or more partial
specializations. None needs more than four lines.

- `is_pair_v<T>` — true for any `std::pair`, false for everything else.
- `rank_of_v<T>` — how many array dimensions `T` has: `0` for `int`, `1` for
  `int[3]`, `2` for `int[3][4]`. (`std::rank` already does this; write your own.)
- `size_of_container_t<T>` — the type a container's `size()` returns, or
  `std::size_t` if `T` has no `size()` at all.

The starter has the primary templates only, so every answer is currently the
default.

## Starter
```cpp
#include <cstddef>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

template <class T>
struct is_pair : std::false_type {};

template <class T>
inline constexpr bool is_pair_v = is_pair<T>::value;

template <class T>
struct rank_of : std::integral_constant<std::size_t, 0> {};

template <class T>
inline constexpr std::size_t rank_of_v = rank_of<T>::value;

template <class T, class = void>
struct size_of_container { using type = std::size_t; };

template <class T>
using size_of_container_t = typename size_of_container<T>::type;
```

## Tests
```cpp
// is_pair
static_assert(!is_pair_v<int>);
static_assert(is_pair_v<std::pair<int, int>>);
static_assert(is_pair_v<std::pair<std::string, std::vector<double>>>);
static_assert(!is_pair_v<std::vector<int>>);
CHECK(is_pair_v<std::pair<char, char>>);
CHECK(!is_pair_v<std::string>);

// rank_of
static_assert(rank_of_v<int> == 0);
static_assert(rank_of_v<std::string> == 0);
static_assert(rank_of_v<int[3]> == 1);
static_assert(rank_of_v<double[3][4]> == 2);
static_assert(rank_of_v<char[2][2][2]> == 3);
static_assert(rank_of_v<int[]> == 1);
CHECK_EQ(rank_of_v<float[7][7]>, std::size_t{2});

// size_of_container
static_assert(std::is_same_v<size_of_container_t<std::vector<int>>,
                             std::vector<int>::size_type>);
static_assert(std::is_same_v<size_of_container_t<std::string>, std::string::size_type>);
static_assert(std::is_same_v<size_of_container_t<int>, std::size_t>);
static_assert(std::is_same_v<size_of_container_t<double>, std::size_t>);
CHECK(std::is_same_v<size_of_container_t<std::vector<char>>, std::size_t>);
```

## Hints
- `is_pair` needs one partial specialization, `struct is_pair<std::pair<A, B>>`, with `A` and `B` deduced from the match.
- `rank_of` needs **two** specializations: one for `T[N]` (a template parameter of type `std::size_t` alongside the type) and one for `T[]`, the unknown-bound case. Both recurse into `rank_of<T>::value + 1`.
- A non-type template parameter is declared like a function parameter: `template <class T, std::size_t N> struct rank_of<T[N]> : …`.
- `size_of_container` is the `void_t` idiom. The specialization's second argument is `std::void_t<decltype(std::declval<const T&>().size())>`, which is only a valid type when the expression compiles.
- Inside that specialization, the answer is `decltype(std::declval<const T&>().size())` — the same expression, this time used for its type.
- `std::declval` lives in `<utility>` and only works in unevaluated contexts like `decltype`. That is exactly where you need it.

## Solution
```cpp
#include <cstddef>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

template <class T>
struct is_pair : std::false_type {};

template <class A, class B>
struct is_pair<std::pair<A, B>> : std::true_type {};

template <class T>
inline constexpr bool is_pair_v = is_pair<T>::value;

template <class T>
struct rank_of : std::integral_constant<std::size_t, 0> {};

template <class T, std::size_t N>
struct rank_of<T[N]> : std::integral_constant<std::size_t, rank_of<T>::value + 1> {};

template <class T>
struct rank_of<T[]> : std::integral_constant<std::size_t, rank_of<T>::value + 1> {};

template <class T>
inline constexpr std::size_t rank_of_v = rank_of<T>::value;

template <class T, class = void>
struct size_of_container { using type = std::size_t; };

template <class T>
struct size_of_container<T, std::void_t<decltype(std::declval<const T&>().size())>> {
    using type = decltype(std::declval<const T&>().size());
};

template <class T>
using size_of_container_t = typename size_of_container<T>::type;
```

## Notes
Three specializations, three different things being matched.

`is_pair` matches a **class template's arguments**. `rank_of` matches an
**array's shape**, including a non-type parameter for the bound, and recurses —
`double[3][4]` is an array of 3 things of type `double[4]`, so peeling one
dimension leaves a smaller array, and the primary template catches the base
case. `size_of_container` matches on **whether an expression is well-formed**,
which is a different question entirely and needs the `void_t` machinery to
express.

The last check is worth reading twice: `size_of_container_t<std::vector<char>>`
is the same type as `std::size_t` on this implementation, and the assertion
passes for that reason — not because the default was used. Both branches
happen to agree here, which is a good reminder that a trait test that only
compares against the default proves nothing. The `static_assert`s above it
compare against `std::vector<int>::size_type` instead, which is what actually
distinguishes the two answers.

In modern code you would write the third one as a concept and a
`std::conditional_t`, and you would be right to. The `void_t` version is here
because you will read it long before you get to delete it.
