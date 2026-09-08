---
id: pair-template
title: "A pair of your own"
difficulty: core
chapter: class-templates
topics: [templates, classes, deduction]
check: unit
standard: c++20
---

Write `Duo`, a class template holding two values of possibly different types.
It needs:

- a constructor taking both values
- `first()` and `second()` accessors returning `const` references
- `swapped()`, returning a `Duo` with the types and values exchanged
- deduction, so `Duo d{1, std::string("x")}` compiles without naming the types

## Starter
```cpp
#include <string>
#include <utility>

// Write the template here.
```

## Tests
```cpp
Duo<int, std::string> named{7, "seven"};
CHECK_EQ(named.first(), 7);
CHECK_EQ(named.second(), std::string("seven"));

// Deduction: no template arguments at the call site.
Duo deduced{2.5, 'x'};
CHECK_NEAR(deduced.first(), 2.5, 1e-9);
CHECK_EQ(deduced.second(), 'x');

// Same type on both sides.
Duo same{1, 2};
CHECK_EQ(same.first(), 1);
CHECK_EQ(same.second(), 2);

// swapped() exchanges both the values and the types.
auto flipped = named.swapped();
CHECK_EQ(flipped.first(), std::string("seven"));
CHECK_EQ(flipped.second(), 7);

// Swapping twice returns to the original.
auto round_trip = named.swapped().swapped();
CHECK_EQ(round_trip.first(), 7);
CHECK_EQ(round_trip.second(), std::string("seven"));

// It must work with a move-only type.
Duo<std::unique_ptr<int>, int> movable{std::make_unique<int>(5), 9};
CHECK_EQ(*movable.first(), 5);
CHECK_EQ(movable.second(), 9);
```

## Hints
- Two type parameters: `template <class A, class B> class Duo`.
- Take the constructor arguments by value and `std::move` them into the members, so a move-only type works.
- `swapped()` returns `Duo<B, A>` — the parameters in the other order.
- Deduction works automatically here, because the constructor's parameters are `A` and `B` directly. No guide is needed.
- The move-only check means `swapped()` must be `const` and copy, or you can leave `swapped()` out of that path — the checks only call it on a copyable `Duo`.

## Solution
```cpp
#include <memory>
#include <string>
#include <utility>

template <class A, class B>
class Duo {
public:
    Duo(A first, B second) : first_(std::move(first)), second_(std::move(second)) {}

    const A& first() const { return first_; }
    const B& second() const { return second_; }

    Duo<B, A> swapped() const { return Duo<B, A>{second_, first_}; }

private:
    A first_;
    B second_;
};
```

## Notes
`swapped()` returning `Duo<B, A>` is the part that makes this a template
exercise rather than a class exercise. The return type is a *different
instantiation* of the same template, computed from the current one — the
compiler generates both, and `swapped().swapped()` brings you back to the
original type, which the round-trip check confirms.

Taking the constructor parameters by value and moving them is the sink-parameter
idiom from Chapter 3.4, and it is what makes the `std::unique_ptr` case work. A
`const A&` parameter would force a copy and fail to compile for a move-only
type.

Note that no deduction guide is needed. `Duo(A, B)` mentions both parameters
directly, so C++17 deduces them from the arguments. A guide would only be
necessary if the constructor took something else — an iterator pair, say — from
which `A` and `B` had to be derived.

This is `std::pair`, whose `first` and `second` are public members rather than
accessors. The standard version also has `std::make_pair`, which existed because
C++11 had no CTAD; today `std::pair p{1, 2}` works directly and `make_pair` is
largely historical.
