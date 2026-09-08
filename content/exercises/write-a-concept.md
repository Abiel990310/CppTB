---
id: write-a-concept
title: "Say what you require"
difficulty: core
chapter: concepts
topics: [concepts, templates, generics]
check: unit
standard: c++20
---

Write a concept `Summable` and use it to constrain `total`, which adds up the
elements of a vector.

`Summable<T>` should hold when `T` can be default-constructed and `a += b` is
valid and yields a `T&`.

## Starter
```cpp
#include <concepts>
#include <vector>

// Write the concept here.

template <class T>
T total(const std::vector<T>& values) {
    T sum{};
    for (const T& v : values) sum += v;
    return sum;
}
```

## Tests
```cpp
CHECK_EQ(total(std::vector<int>{1, 2, 3}), 6);
CHECK_NEAR(total(std::vector<double>{0.5, 1.5}), 2.0, 1e-9);
CHECK_EQ(total(std::vector<std::string>{"a", "b", "c"}), std::string("abc"));
CHECK_EQ(total(std::vector<int>{}), 0);

// The concept must be usable as a compile-time boolean.
static_assert(Summable<int>);
static_assert(Summable<double>);
static_assert(Summable<std::string>);

struct NotSummable { int id; };
static_assert(!Summable<NotSummable>);

// A type with += but no default constructor must not satisfy it.
struct NoDefault {
    int v;
    explicit NoDefault(int value) : v(value) {}
    NoDefault& operator+=(const NoDefault& o) { v += o.v; return *this; }
};
static_assert(!Summable<NoDefault>);

// A type with a default constructor but no += must not satisfy it either.
struct NoPlus { int v = 0; };
static_assert(!Summable<NoPlus>);
```

## Hints
- `template <class T> concept Summable = requires(T a, const T b) { ... };`
- Two requirements: `T{};` for default construction, and a braced one for `+=`.
- `{ a += b } -> std::same_as<T&>;` constrains both validity and the return type.
- Constrain the function with `template <Summable T>`.
- The tests need `<string>`; include it.

## Solution
```cpp
#include <concepts>
#include <string>
#include <vector>

template <class T>
concept Summable = requires(T a, const T b) {
    T{};
    { a += b } -> std::same_as<T&>;
};

template <Summable T>
T total(const std::vector<T>& values) {
    T sum{};
    for (const T& v : values) sum += v;
    return sum;
}
```

## Notes
The two negative `static_assert`s are what make the concept precise rather than
approximate. `NoDefault` has a perfectly good `+=` and still fails, because
`total` starts from a value-initialised `T` — a requirement that is invisible in
the function's signature and would otherwise only surface as an error inside the
body.

That is the discipline concepts impose: writing the constraint forces you to
enumerate what the implementation actually assumes. It is common to discover a
requirement you did not know you had.

`std::same_as<T&>` rather than `std::convertible_to<T&>` is deliberate. A `+=`
that returned a copy would technically be convertible and would break every
caller chaining assignments, so the stricter check is the right one — and it
matches what Chapter 3.6 said about compound assignment returning a reference.

Note the concept is usable as a plain boolean: `static_assert(Summable<int>)`
needs no ceremony, and printing it with `std::boolalpha` is a good way to debug
a constraint that is not behaving.
