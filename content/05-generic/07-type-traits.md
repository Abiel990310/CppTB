---
title: "Type traits and metaprogramming"
navTitle: "Type traits"
summary: >-
  Asking and answering questions about types at compile time.
objectives:
  - Use standard type traits to constrain or branch code
  - Write a trait with a partial specialization
  - Explain if constexpr and why it beats tag dispatch
status: complete
standard: c++20
requires: [variadics, constexpr]
---

A template body has to work for every type it is instantiated with, and
sometimes those types want different code. A `std::string` should be moved; an
`int` should be copied. A pointer should be dereferenced before printing; an
`int` should not.

A **type trait** is how you ask. It is an ordinary class template whose job is
to answer a question about a type at compile time — and since the answer is a
constant, the previous two chapters' machinery applies: `static_assert` it,
`if constexpr` on it, fold it into a constraint.

```cpp run title="Asking questions about types"
#include <iostream>
#include <string>
#include <type_traits>
#include <vector>

int main() {
    std::cout << std::boolalpha;
    std::cout << "int is integral:            " << std::is_integral_v<int> << '\n';
    std::cout << "double is integral:         " << std::is_integral_v<double> << '\n';
    std::cout << "std::string is trivial:     " << std::is_trivially_copyable_v<std::string> << '\n';
    std::cout << "int* is a pointer:          " << std::is_pointer_v<int*> << '\n';
    std::cout << "vector<int> is same as ...: " << std::is_same_v<std::vector<int>, std::vector<int>> << '\n';
    std::cout << "const int& stripped:        "
              << std::is_same_v<std::remove_cvref_t<const int&>, int> << '\n';
}
```

Nothing here runs at run time. Every one of those expressions is a `bool`
constant the compiler substituted before `main` was compiled.

## Two shapes: predicates and transformations

The standard traits in `<type_traits>` come in two kinds, and the naming tells
you which is which.

A **predicate** answers yes or no. It is a class template with a `static
constexpr bool value`, plus a `_v` variable template alias that saves you
writing `::value`.

A **transformation** produces a new type. It has a member typedef `type`, plus a
`_t` alias that saves you writing `typename …::type`.

| Predicate (`_v`) | Asks |
|---|---|
| `std::is_same_v<A, B>` | are these the same type? |
| `std::is_integral_v<T>`, `std::is_floating_point_v<T>` | which arithmetic family? |
| `std::is_pointer_v<T>`, `std::is_reference_v<T>` | indirection? |
| `std::is_base_of_v<B, D>` | is `D` derived from `B`? |
| `std::is_trivially_copyable_v<T>` | is `memcpy` a valid copy? |
| `std::is_constructible_v<T, Args...>` | would `T(args...)` compile? |

| Transformation (`_t`) | Gives |
|---|---|
| `std::remove_reference_t<T>` | `T` with `&` or `&&` stripped |
| `std::remove_cvref_t<T>` | `T` with references *and* `const`/`volatile` stripped |
| `std::decay_t<T>` | what by-value deduction would produce |
| `std::conditional_t<B, X, Y>` | `X` if `B`, else `Y` |
| `std::common_type_t<A, B>` | the type `a ? x : y` would have |
| `std::underlying_type_t<E>` | the integer type behind an `enum` |

:::tip
`std::remove_cvref_t` (C++20) is the one you want most often — it is what you
need to compare a forwarding-reference parameter's type against a concrete type,
as in the constrained constructor from Chapter 5.3. Before C++20 it was spelled
`std::remove_cv_t<std::remove_reference_t<T>>`.
:::

## `if constexpr`: branching on a type

Given a trait, you need a way to act on the answer. A plain `if` is not enough,
because **both branches of a plain `if` must compile**, for every instantiation.

```cpp run expect-error title="A plain if compiles both branches"
#include <type_traits>

template <class T>
long as_long(T value) {
    if (std::is_pointer_v<T>) return *value;   // compiled even when T is int
    return value;
}

int main() { return static_cast<int>(as_long(42)); }
```

> error: invalid type argument of unary '*' (have 'int')

`if constexpr` (C++17) discards the branch that is not taken, so it is never
compiled for that instantiation:

```cpp run title="if constexpr discards the branch it does not take"
#include <iostream>
#include <string>
#include <type_traits>

template <class T>
void describe(const T& value) {
    if constexpr (std::is_pointer_v<T>) {
        std::cout << "pointer to " << *value << '\n';
    } else if constexpr (std::is_floating_point_v<T>) {
        std::cout << "float-ish " << value << '\n';
    } else if constexpr (std::is_integral_v<T>) {
        std::cout << "integer " << value << " (" << sizeof(T) << " bytes)\n";
    } else {
        std::cout << "something else: " << value << '\n';
    }
}

int main() {
    int n = 7;
    describe(&n);
    describe(2.5);
    describe(n);
    describe(std::string{"text"});
}
```

The discarded branch is not compiled — but it is still *parsed*, and any name
that does not depend on a template parameter is still checked. `if constexpr
(false) { this_does_not_exist(); }` is an error even though the branch is
discarded.

:::history
Before C++17, choosing between two bodies meant **tag dispatch**: write two
overloads taking `std::true_type` and `std::false_type`, and call the right one
with `std::is_pointer<T>{}`. It worked, but it scattered one decision across
three functions, each of which had to repeat the parameter list. `if constexpr`
put the decision back where the reader is looking. The one thing tag dispatch
still does better is more than two cases with complicated overlap — but concepts
handle that better than either.
:::

## Writing your own trait

The mechanism has no magic in it: a primary template gives the default answer,
and a **partial specialization** gives a different answer for a family of types.

```cpp run title="is_vector, from scratch"
#include <iostream>
#include <string>
#include <type_traits>
#include <vector>

template <class T>
struct is_vector : std::false_type {};                 // the default: no

template <class E, class A>
struct is_vector<std::vector<E, A>> : std::true_type {};   // any vector: yes

template <class T>
inline constexpr bool is_vector_v = is_vector<T>::value;

int main() {
    std::cout << std::boolalpha
              << is_vector_v<int> << ' '
              << is_vector_v<std::vector<int>> << ' '
              << is_vector_v<std::vector<std::string>> << ' '
              << is_vector_v<std::string> << '\n';
}
```

`std::false_type` and `std::true_type` are just `std::integral_constant<bool,
false>` and `…, true>` — inheriting from them is how you get the `value` member
without writing it. The specialization matches *any* `std::vector`, whatever its
element and allocator, because `E` and `A` are deduced from the match.

A transformation trait works the same way, but names a `type` instead:

```cpp run title="A transformation trait, and recursion over types"
#include <iostream>
#include <type_traits>
#include <vector>

// The element type of a container, or the type itself if it is not one.
template <class T>
struct element_of { using type = T; };

template <class E, class A>
struct element_of<std::vector<E, A>> { using type = typename element_of<E>::type; };

template <class T>
using element_of_t = typename element_of<T>::type;

int main() {
    std::cout << std::boolalpha
              << std::is_same_v<element_of_t<int>, int> << ' '
              << std::is_same_v<element_of_t<std::vector<double>>, double> << ' '
              << std::is_same_v<element_of_t<std::vector<std::vector<char>>>, char> << '\n';
}
```

The nested case recurses: `element_of<vector<vector<char>>>` matches the
specialization with `E = vector<char>`, and asks `element_of` about that. This
is the whole of template metaprogramming — a partial specialization is a pattern
match, and a nested `::type` is a recursive call.

:::pitfall
`typename` is not optional in `typename element_of<E>::type`. Inside a template,
the compiler cannot tell whether a dependent name like `element_of<E>::type` is
a type or a static member until `E` is known, and it assumes "not a type"
unless you say otherwise. C++20 removed the requirement in the places where
only a type could appear — a return type, a base-class list — but it is still
needed in most of the others, and writing it always is harmless.
:::

## Detecting whether an expression compiles

The most useful traits are not about what a type *is* but about what you can
*do* with it. Since C++20 that is a requires-expression, and it is worth seeing
next to the trait spelling.

```cpp run title="Two ways to ask 'does this compile?'"
#include <concepts>
#include <iostream>
#include <string>
#include <type_traits>
#include <vector>

// As a concept — the modern spelling.
template <class T>
concept has_size = requires(const T& t) { { t.size() } -> std::convertible_to<std::size_t>; };

// As a trait, using the same machinery the library used before concepts.
template <class T, class = void>
struct sizeable : std::false_type {};

template <class T>
struct sizeable<T, std::void_t<decltype(std::declval<const T&>().size())>> : std::true_type {};

template <class T>
std::size_t length_of(const T& value) {
    if constexpr (has_size<T>) return value.size();
    else                       return sizeof(value);
}

int main() {
    std::cout << std::boolalpha
              << has_size<std::vector<int>> << ' ' << has_size<int> << ' '
              << sizeable<std::string>::value << ' ' << sizeable<double>::value << '\n';
    std::cout << length_of(std::string{"hello"}) << ' ' << length_of(3.0) << '\n';
}
```

The `sizeable` trait is the `void_t` idiom, and it is worth being able to read
because the standard library is full of it. The second template parameter
defaults to `void`; the specialization is only a valid match if
`decltype(…size())` is a valid type, and `std::void_t` maps whatever that is
back to `void` so the specialization's argument list matches the default. If
the expression is ill-formed the specialization silently drops out — this is
SFINAE — and the primary template's `false_type` stands.

Write the concept. Read the `void_t`.

:::note
`std::declval<T>()` produces a value of type `T` in an unevaluated context —
useful because `T` may have no default constructor. It has no definition and
cannot be called; using it anywhere the expression is actually evaluated is a
link error, which is the point.
:::

## Traits are how a library adapts to your type

The pattern turns up whenever a library needs a fact about a type that the type
itself does not provide. `std::iterator_traits` is the canonical example; here
is the shape, reduced.

```cpp run title="A library point a user can specialize"
#include <iostream>
#include <string>

// The library defines the question and a default answer.
template <class T>
struct printer {
    static void print(const T& value) { std::cout << value; }
};

// A user specializes it for their own type, without touching the library.
struct Money { long cents; };

template <>
struct printer<Money> {
    static void print(const Money& m) {
        std::cout << '$' << m.cents / 100 << '.' << (m.cents % 100 < 10 ? "0" : "")
                  << m.cents % 100;
    }
};

template <class... Args>
void print_all(const Args&... args) {
    ((printer<Args>::print(args), std::cout << ' '), ...);
    std::cout << '\n';
}

int main() {
    print_all(1, std::string{"text"}, Money{12345}, 2.5);
}
```

This is an **extension point**. The library never sees `Money`, and `Money`
never mentions the library; the specialization is the whole of the coupling.
It is how `std::hash`, `std::formatter`, and `std::numeric_limits` are extended
for user types, and it is the reason those are class templates rather than
functions — you cannot partially specialize a function template.

## Check yourself

:::quiz
{
  "question": "Why does `if constexpr` compile where a plain `if` does not, when the condition is a type trait?",
  "options": [
    { "text": "`if constexpr` discards the untaken branch, so it is never compiled for that instantiation", "correct": true, "why": "Both branches of a plain `if` must be valid for every instantiation, even the branch that can never run. `if constexpr` removes the discarded branch from the instantiated function." },
    { "text": "`if constexpr` evaluates the condition at compile time and a plain `if` does not", "why": "A trait's `_v` is a compile-time constant either way, and the optimiser folds the plain `if` too. The difference is what gets *compiled*, not what gets evaluated." },
    { "text": "`if constexpr` suppresses errors in both branches", "why": "It suppresses nothing in the taken branch, and the discarded branch is still parsed — non-dependent names in it are still checked." },
    { "text": "A plain `if` cannot take a `constexpr bool` as a condition", "why": "It can; that compiles fine. What fails is the body of the branch that was never going to run." }
  ]
}
:::

:::quiz
{
  "question": "What makes `template <class E, class A> struct is_vector<std::vector<E, A>> : std::true_type {};` match `std::vector<std::string>`?",
  "options": [
    { "text": "It is a partial specialization: the compiler pattern-matches the argument against `std::vector<E, A>` and deduces E and A", "correct": true, "why": "Partial specialization is pattern matching over types. Any `std::vector` matches, whatever its element and allocator, which is why one specialization covers the whole family." },
    { "text": "`std::string` is implicitly convertible to `E`", "why": "No conversions are involved. Specialization matching is exact structural matching on the type, not on values." },
    { "text": "It inherits from `std::true_type`, which overrides the primary template", "why": "The inheritance supplies `value`; it has nothing to do with which template is chosen." },
    { "text": "The primary template is never instantiated once a specialization exists", "why": "The primary template still answers for every type that does not match — `is_vector_v<int>` is exactly that case." }
  ]
}
:::

## Practice

:::exercise write-a-trait

:::exercise dispatch-on-type

:::recap
- A trait is a class template that answers a compile-time question: `_v` for a
  `bool` predicate, `_t` for a produced type.
- `if constexpr` discards the untaken branch instead of compiling it, which is
  what makes per-type branching possible inside one function.
- You write a trait with a primary template for the default answer and partial
  specializations for the families that differ — pattern matching over types.
- `typename` is required in front of a dependent `::type` in most contexts.
- Detection is a `requires`-expression in modern code; `std::void_t` plus SFINAE
  is the older spelling you still need to be able to read.
- Specializing a library's class template for your own type is the standard
  extension point — `std::hash` and `std::formatter` work exactly this way.
:::
