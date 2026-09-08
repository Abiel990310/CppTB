---
id: dispatch-on-type
title: "One function, five behaviours"
difficulty: core
chapter: type-traits
topics: [traits, if-constexpr, templates]
check: unit
standard: c++20
---

`describe(value)` should produce a short tagged string, choosing what to do from
the *type* of its argument:

| Argument | Result |
|---|---|
| `bool` | `bool:true` or `bool:false` |
| any other integral type | `int:` followed by the value |
| any floating-point type | `float:` followed by the value |
| a pointer | `ptr->` followed by `describe` of the pointee, or `ptr:null` |
| anything else | `other:` followed by the streamed value |

The starter takes the last branch for everything. Rewrite it with `if constexpr`
and the traits from `<type_traits>`.

The order of your branches matters more than you might expect. Two of these
categories overlap.

## Starter
```cpp
#include <sstream>
#include <string>
#include <type_traits>

template <class T>
std::string describe(const T& value) {
    std::ostringstream out;
    out << "other:" << value;
    return out.str();
}
```

## Tests
```cpp
CHECK_EQ(describe(true), std::string("bool:true"));
CHECK_EQ(describe(false), std::string("bool:false"));

CHECK_EQ(describe(42), std::string("int:42"));
CHECK_EQ(describe(-7), std::string("int:-7"));
CHECK_EQ(describe(9UL), std::string("int:9"));

CHECK_EQ(describe(2.5), std::string("float:2.5"));
CHECK_EQ(describe(2.5f), std::string("float:2.5"));

int n = 42;
CHECK_EQ(describe(&n), std::string("ptr->int:42"));

double d = 1.5;
const double* pd = &d;
CHECK_EQ(describe(pd), std::string("ptr->float:1.5"));

bool flag = true;
CHECK_EQ(describe(&flag), std::string("ptr->bool:true"));

int* nothing = nullptr;
CHECK_EQ(describe(nothing), std::string("ptr:null"));

CHECK_EQ(describe(std::string("hello")), std::string("other:hello"));
```

## Hints
- `if constexpr (…) { … } else if constexpr (…) { … } else { … }` — a chain, with the trait's `_v` form as each condition.
- The overlap: `std::is_integral_v<bool>` is **true**. If the integral branch comes first, `describe(true)` prints `int:1`.
- `std::is_pointer_v<T>` tells you the type is a pointer; whether it is null is an ordinary run-time question, so that one is a plain `if` inside the branch.
- The pointer branch calls `describe` again on `*value`. A template may call itself; the recursion ends because the pointee is not a pointer.
- `T` is deduced from `const T&`, so for `describe(pd)` with `pd` of type `const double*`, `T` is `const double*` and `*value` has type `const double&` — which deduces `T = double` on the way in.
- Do not reach for overloads or tag dispatch. The point of the exercise is that all five cases live in one readable function.

## Solution
```cpp
#include <sstream>
#include <string>
#include <type_traits>

template <class T>
std::string describe(const T& value) {
    std::ostringstream out;

    if constexpr (std::is_same_v<T, bool>) {
        out << "bool:" << (value ? "true" : "false");
    } else if constexpr (std::is_pointer_v<T>) {
        if (value == nullptr) out << "ptr:null";
        else                  out << "ptr->" << describe(*value);
    } else if constexpr (std::is_floating_point_v<T>) {
        out << "float:" << value;
    } else if constexpr (std::is_integral_v<T>) {
        out << "int:" << value;
    } else {
        out << "other:" << value;
    }

    return out.str();
}

```

## Notes
`bool` first. `std::is_integral_v<bool>` is true — `bool` is an integral type in
C++, along with `char`, `wchar_t`, and every `int` family — so an integral
branch placed above it swallows the case and prints `int:1`. This is the
recurring hazard of a trait chain: the conditions are not mutually exclusive,
and `if constexpr` takes the first one that holds, exactly like a plain `if`.
When you write one, order from most specific to least.

The pointer branch shows the two kinds of question living side by side. *Is this
a pointer* is answered by the compiler and decides which code exists at all;
*is it null* is answered by the program and decides which code runs. `if
constexpr` for the first, plain `if` for the second, and mixing them up is
either a compile error or a branch that is never taken.

Try replacing every `if constexpr` with a plain `if` and compiling. The failure
is instructive: `*value` is checked for `T = int`, `T = bool`, and
`T = std::string`, none of which can be dereferenced. Both branches of a plain
`if` must compile for every instantiation, and that is the entire reason
`if constexpr` exists.
