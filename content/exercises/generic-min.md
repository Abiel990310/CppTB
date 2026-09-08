---
id: generic-min
title: "One function, every type"
difficulty: intro
chapter: function-templates
topics: [templates, generics]
check: unit
standard: c++20
---

`smallest` currently works only on `int`. Make it a function template so it
works for any type that supports `<`, and add a three-argument overload.

Both must return by value and must not require the two arguments to be
identical types beyond what `<` needs.

## Starter
```cpp
int smallest(int a, int b) {
    return a < b ? a : b;
}
```

## Tests
```cpp
CHECK_EQ(smallest(3, 7), 3);
CHECK_EQ(smallest(-2, -9), -9);

CHECK_NEAR(smallest(2.5, 1.5), 1.5, 1e-9);
CHECK_EQ(smallest('z', 'a'), 'a');

CHECK_EQ(smallest(std::string("pear"), std::string("apple")), std::string("apple"));

// The three-argument form.
CHECK_EQ(smallest(5, 2, 8), 2);
CHECK_EQ(smallest(1, 2, 3), 1);
CHECK_EQ(smallest(3, 2, 1), 1);
CHECK_NEAR(smallest(2.5, 0.5, 1.5), 0.5, 1e-9);
CHECK_EQ(smallest(std::string("c"), std::string("a"), std::string("b")),
         std::string("a"));

// Equal values: either may be returned, but the value must be right.
CHECK_EQ(smallest(4, 4), 4);
CHECK_EQ(smallest(4, 4, 4), 4);
```

## Hints
- `template <class T> T smallest(T a, T b)` is the two-argument form.
- The three-argument version can call the two-argument one: `smallest(smallest(a, b), c)`.
- The tests use `std::string`, so include `<string>`.
- Do not name `T` at the call sites — deduction handles every case here, because both arguments always have the same type.

## Solution
```cpp
#include <string>

template <class T>
T smallest(T a, T b) {
    return a < b ? a : b;
}

template <class T>
T smallest(T a, T b, T c) {
    return smallest(smallest(a, b), c);
}
```

## Notes
Writing the three-argument version in terms of the two-argument one is worth
doing deliberately: there is one comparison rule, in one place, so the two
overloads cannot disagree about ties or ordering.

Note what the template does *not* require. There is no base class, no interface,
and no declaration that `T` must be comparable — it just has to work when the
compiler tries `a < b`. That is duck typing resolved at compile time, and it is
both the strength of templates and the reason their errors are so verbose:
passing a type with no `operator<` produces a failure deep inside the template
rather than at your call.

Chapter 5.4's concepts fix exactly that, letting you write
`template <std::totally_ordered T>` so the error arrives at the call site
saying what was required.

This is `std::min`, which also has an initializer-list overload —
`std::min({5, 2, 8})` — covering any number of arguments rather than just three.
