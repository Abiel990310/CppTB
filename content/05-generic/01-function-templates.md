---
title: "Function templates"
navTitle: "Function templates"
summary: >-
  One function, many types, resolved at compile time.
objectives:
  - Write a function template and explain how it is instantiated
  - Describe what template argument deduction does
  - Explain why template code usually lives in headers
status: complete
standard: c++20
requires: [functions, iterators]
---

You have been using templates since Chapter 4.2 — `std::vector<int>` is one.
This part is about writing them.

The idea: describe an algorithm once, in terms of a type you have not chosen
yet, and let the compiler generate a version for each type actually used. No
run-time cost, no shared base class, and full type checking.

## Writing one

```cpp run title="The same function, for every type it makes sense on" std=c++20
#include <iostream>
#include <string>

template <class T>
T larger(T a, T b) {
    return a > b ? a : b;
}

int main() {
    std::cout << larger(3, 7) << '\n';                            // T = int
    std::cout << larger(2.5, 1.5) << '\n';                        // T = double
    std::cout << larger(std::string{"apple"}, std::string{"pear"}) << '\n';  // T = std::string
    std::cout << larger('a', 'z') << '\n';                        // T = char
}
```

`template <class T>` introduces a **type parameter**. `typename` means exactly
the same thing there — `template <typename T>` is equally correct, and which you
write is a house-style choice.

The compiler does not compile `larger` once. It compiles it **once per type you
use it with**, substituting the type in. That is *instantiation*, and it is why
templates cost nothing at run time: `larger(3, 7)` compiles to the same
comparison you would have written by hand.

## Deduction

You rarely name the type. The compiler works it out from the arguments:

```cpp run title="Deduced, and explicit" std=c++20
#include <iostream>
#include <typeinfo>

template <class T>
T twice(T value) { return value + value; }

int main() {
    std::cout << twice(21) << '\n';           // deduced: T = int
    std::cout << twice(1.5) << '\n';          // deduced: T = double
    std::cout << twice<double>(21) << '\n';   // forced: T = double, 21 converts
}
```

Deduction has one property that surprises people: it does **not** consider
conversions between the arguments. If two parameters share a type parameter,
both arguments must deduce the same type:

```cpp run expect-error title="Two arguments, one T"
template <class T>
T larger(T a, T b) { return a > b ? a : b; }

int main() {
    return larger(3, 2.5);      // T deduced as int from one, double from the other
}
```

Three fixes, in increasing order of generality:

```cpp run title="Letting the two types differ" std=c++20
#include <iostream>

// 1. Force one type explicitly.
template <class T>
T larger_same(T a, T b) { return a > b ? a : b; }

// 2. Two parameters, and let the compiler work out the common type.
template <class A, class B>
auto larger_mixed(A a, B b) { return a > b ? a : b; }

int main() {
    std::cout << larger_same<double>(3, 2.5) << '\n';
    std::cout << larger_mixed(3, 2.5) << '\n';
    std::cout << larger_mixed(2.5, 3) << '\n';
}
```

The `auto` return type is deduced from the `return` statement — here the common
type of `A` and `B`, which is what `?:` produces.

:::pitfall
`larger_mixed` has a subtle flaw: the return type is deduced by value, so
returning `a > b ? a : b` where both are `std::string` copies the winner. For a
generic function that matters. Returning `decltype(auto)` and taking parameters
by reference preserves the value category — Chapter 5.3 covers that properly.
:::

## Templates over iterators

The most useful function templates in practice are not over "any type" but over
"any range", which is how the whole standard library is built:

```cpp run title="One implementation, every container" std=c++20
#include <iostream>
#include <list>
#include <vector>

template <class Iterator, class Predicate>
Iterator find_if_mine(Iterator first, Iterator last, Predicate pred) {
    for (; first != last; ++first) {
        if (pred(*first)) return first;
    }
    return last;
}

int main() {
    std::vector<int> v{1, 3, 8, 5};
    std::list<int> l{2, 4, 7};

    auto in_vector = find_if_mine(v.begin(), v.end(), [](int x) { return x % 2 == 0; });
    std::cout << "first even in vector: " << *in_vector << '\n';

    auto in_list = find_if_mine(l.begin(), l.end(), [](int x) { return x > 3; });
    std::cout << "first over three in list: " << *in_list << '\n';

    auto missing = find_if_mine(v.begin(), v.end(), [](int x) { return x > 100; });
    std::cout << "not found returns last: " << std::boolalpha << (missing == v.end()) << '\n';
}
```

`Predicate` is a type parameter too, so each lambda gets its own instantiation
and the call inlines completely. That is why `std::find_if` with a lambda is as
fast as a hand-written loop — Chapter 7.4 checks that claim against the
assembly.

## Templates are compiled twice

A template is checked in two passes, and this explains most confusing template
errors.

**At definition**, the compiler checks what it can without knowing `T` — syntax,
and names that do not depend on the parameter. **At instantiation**, with `T`
known, it checks everything else.

```cpp run expect-error title="An error that waits for instantiation"
#include <string>

template <class T>
void print_size(T value) {
    // Fine at definition — .size() might exist for some T.
    auto n = value.size();
    (void)n;
}

int main() {
    print_size(std::string{"ok"});    // instantiates fine
    print_size(42);                   // error: int has no member 'size'
}
```

The error message names the instantiation, and this is why template errors point
at a line inside the template while blaming a call somewhere else. Chapter 5.4's
concepts exist largely to move that error back to the call site and say what was
actually required.

## Why templates live in headers

To instantiate `larger<int>`, the compiler needs the *definition*, not just a
declaration. If the definition is in another translation unit, it is not
available:

```cpp title="This does not link"
// larger.h
template <class T> T larger(T a, T b);      // declaration only

// larger.cpp
template <class T> T larger(T a, T b) { return a > b ? a : b; }

// main.cpp
#include "larger.h"
int main() { return larger(1, 2); }         // undefined reference to larger<int>
```

The linker error is the one from Chapter 1.1: the promise was never kept,
because `larger.cpp` never instantiated `larger<int>` and had no way to know it
should.

So **template definitions go in the header.** This is why the standard library
ships as headers, and it is the main practical cost of templates: every
translation unit that uses one compiles it again, which is why heavily templated
code builds slowly.

Two escape hatches exist. **Explicit instantiation** in one `.cpp` — `template
int larger<int>(int, int);` — lets you keep the definition out of the header when
you know every type in advance. And C++20 **modules** (Chapter 9.2) fix the
underlying problem rather than working around it.

## Overloading and specialisation

A template can be overloaded by ordinary functions, and a non-template exact
match wins:

```cpp run title="A specific version for one type" std=c++20
#include <iostream>
#include <string>

template <class T>
std::string describe(T value) {
    return "generic: " + std::to_string(value);
}

// A plain overload — preferred when the argument is exactly const char*.
std::string describe(const char* value) {
    return std::string{"string: "} + value;
}

int main() {
    std::cout << describe(42) << '\n';
    std::cout << describe(2.5) << '\n';
    std::cout << describe("hello") << '\n';
}
```

Prefer an overload to an explicit *specialisation* (`template <> std::string
describe<const char*>(const char*)`). Specialisations do not participate in
overload resolution the way you expect, and the interaction of the two is a
well-known source of surprise. An overload is simpler and does what you meant.

## Check yourself

:::quiz
{
  "question": "Why does `larger(3, 2.5)` fail for `template <class T> T larger(T, T)`?",
  "options": [
    { "text": "Because int and double cannot be compared", "why": "They compare perfectly well. The failure happens before any comparison, during deduction." },
    { "text": "Deduction gets int from the first argument and double from the second, and will not convert to reconcile them", "correct": true, "why": "One type parameter must deduce to one type. Deduction does not consider conversions, so the conflict is an error — fixed by naming T explicitly or using two parameters." },
    { "text": "The return type is ambiguous", "why": "The return type follows from T, and the error occurs before it is ever considered." },
    { "text": "2.5 is not a valid template argument", "why": "It is an ordinary function argument; template arguments here are types, and they are deduced from it." }
  ]
}
:::

:::quiz
{
  "question": "Why must a function template's definition normally be in a header?",
  "options": [
    { "text": "Because templates cannot be compiled separately at all", "why": "They can — explicit instantiation in one .cpp does exactly that, when every type is known in advance." },
    { "text": "The compiler needs the definition to instantiate it for each type used, and a definition in another translation unit is not visible", "correct": true, "why": "Exactly, and the failure is a linker error: undefined reference to larger<int>, because the other file never instantiated that version and had no way to know it should." },
    { "text": "Headers compile faster than source files", "why": "The opposite: header-only templates are recompiled in every translation unit that uses them, which is the main build-time cost of templates." },
    { "text": "Because template code must be inline", "why": "Instantiations do get vague linkage so duplicates across translation units are merged, but that is a consequence of the arrangement rather than its reason." }
  ]
}
:::

## Practice

:::exercise generic-min

:::exercise count-if-template

:::recap
- `template <class T>` declares a type parameter; `typename` is a synonym.
- The compiler instantiates one version per type used, so templates cost nothing
  at run time.
- Deduction works out `T` from the arguments and **does not apply conversions**
  — two parameters sharing one `T` must receive the same type.
- Templates are checked twice: syntax at definition, everything else at
  instantiation. That is why errors point inside the template and blame a call
  elsewhere.
- Definitions belong in headers, because instantiation needs the definition.
  Explicit instantiation and modules are the alternatives.
- Prefer a plain overload to an explicit specialisation.
:::
