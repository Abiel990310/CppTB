---
id: specialise-describe
title: "Match a family of types"
difficulty: stretch
chapter: class-templates
topics: [templates, specialisation]
check: unit
standard: c++20
---

`TypeName<T>::get()` returns a readable name for a type. The primary template
handles the unknown case; add specialisations so that it also handles:

- `int` and `double` exactly — `"int"` and `"double"`
- **any** pointer — `"pointer to X"`, where X is the pointee's name
- **any** `std::vector` — `"vector of X"`
- **any** `std::pair` — `"pair of X and Y"`

The pointer, vector, and pair cases must work for arbitrary nesting.

## Starter
```cpp
#include <string>
#include <utility>
#include <vector>

template <class T>
struct TypeName {
    static std::string get() { return "unknown"; }
};
```

## Tests
```cpp
CHECK_EQ(TypeName<int>::get(), std::string("int"));
CHECK_EQ(TypeName<double>::get(), std::string("double"));
CHECK_EQ(TypeName<char>::get(), std::string("unknown"));

CHECK_EQ(TypeName<int*>::get(), std::string("pointer to int"));
CHECK_EQ(TypeName<double*>::get(), std::string("pointer to double"));
CHECK_EQ(TypeName<int**>::get(), std::string("pointer to pointer to int"));

CHECK_EQ(TypeName<std::vector<int>>::get(), std::string("vector of int"));
CHECK_EQ(TypeName<std::vector<double*>>::get(),
         std::string("vector of pointer to double"));
CHECK_EQ(TypeName<std::vector<std::vector<int>>>::get(),
         std::string("vector of vector of int"));

CHECK_EQ((TypeName<std::pair<int, double>>::get()),
         std::string("pair of int and double"));
CHECK_EQ((TypeName<std::pair<int*, std::vector<double>>>::get()),
         std::string("pair of pointer to int and vector of double"));

CHECK_EQ((TypeName<std::vector<std::pair<int, int>>>::get()),
         std::string("vector of pair of int and int"));
```

## Hints
- `int` and `double` need **full** specialisations: `template <> struct TypeName<int> { ... };`
- The pointer case is a **partial** specialisation: `template <class T> struct TypeName<T*>`.
- Each specialisation builds its answer by asking for the inner one — `TypeName<T>::get()` — which is what makes nesting work.
- `std::pair` has two parameters, so its specialisation takes two: `template <class A, class B> struct TypeName<std::pair<A, B>>`.
- The extra parentheses in the `CHECK_EQ` lines for pair are because the comma inside `pair<int, double>` would otherwise split the macro argument.

## Solution
```cpp
#include <string>
#include <utility>
#include <vector>

template <class T>
struct TypeName {
    static std::string get() { return "unknown"; }
};

template <>
struct TypeName<int> {
    static std::string get() { return "int"; }
};

template <>
struct TypeName<double> {
    static std::string get() { return "double"; }
};

template <class T>
struct TypeName<T*> {
    static std::string get() { return "pointer to " + TypeName<T>::get(); }
};

template <class T>
struct TypeName<std::vector<T>> {
    static std::string get() { return "vector of " + TypeName<T>::get(); }
};

template <class A, class B>
struct TypeName<std::pair<A, B>> {
    static std::string get() {
        return "pair of " + TypeName<A>::get() + " and " + TypeName<B>::get();
    }
};
```

## Notes
Every nested case works without being written. `TypeName<std::vector<std::pair<int, int>>>`
matches the vector specialisation with `T = std::pair<int, int>`, which matches
the pair specialisation, which matches the `int` specialisation twice. That is
recursion over types, resolved entirely at compile time, and it is the mechanism
underneath every type trait in the standard library.

Note that `char` deliberately falls through to `"unknown"`. The primary template
is the fallback for everything no specialisation matches, which is what makes
this open-ended: adding a `char` specialisation later changes nothing else.

The parenthesised `CHECK_EQ` calls are the macro limitation from
`docs/AUTHORING.md`: `CHECK_EQ` takes a fixed number of arguments, so the comma
inside `std::pair<int, double>` splits it. `CHECK` is variadic and would not
need them.

Chapter 5.7 builds this into something useful — traits that answer questions
about types, which templates then branch on.
