---
title: "Concepts and constraints"
navTitle: "Concepts and constraints"
summary: >-
  Saying what a template requires, and getting a readable error when it is not met.
objectives:
  - Write a concept that constrains a template parameter
  - Compare a concept error with an unconstrained template error
  - Use requires clauses to pick between overloads
status: complete
standard: c++20
requires: [class-templates]
---

Chapter 5.1 left a problem open. An unconstrained template accepts any type, and
when the type turns out not to work, the error appears deep inside the template
body — pages of it, blaming a line you did not write.

Concepts are the fix. They let you say what a template needs, so the error
arrives at the call site and says which requirement failed.

## The problem, first

```cpp run expect-error title="An unconstrained template, failing"
#include <vector>

template <class T>
T sum(const std::vector<T>& values) {
    T total{};
    for (const T& v : values) total += v;
    return total;
}

struct Widget { int id; };

int main() {
    std::vector<Widget> widgets{{1}, {2}};
    return sum(widgets).id;      // Widget has no operator+=
}
```

Read that error. It points inside `sum`, at `total += v`, and describes a
missing `operator+=` — technically true, and it tells you nothing about the fact
that `sum` requires an addable type and `Widget` is not one.

## A concept states the requirement

```cpp run expect-error title="The same mistake, with a concept"
#include <concepts>
#include <vector>

template <class T>
concept Addable = requires(T a, T b) {
    { a += b } -> std::same_as<T&>;
    T{};
};

template <Addable T>
T sum(const std::vector<T>& values) {
    T total{};
    for (const T& v : values) total += v;
    return total;
}

struct Widget { int id; };

int main() {
    std::vector<Widget> widgets{{1}, {2}};
    return sum(widgets).id;
}
```

Now the error names the call, names the concept, and says which requirement was
not satisfied. That is the whole feature: the same program is rejected, and the
message is about your code rather than about the library's internals.

## Writing a concept

A concept is a named compile-time predicate over types.

```cpp run title="Three ways to build one" std=c++20
#include <concepts>
#include <iostream>
#include <string>
#include <vector>

// 1. From an existing type trait.
template <class T>
concept Integral = std::is_integral_v<T>;

// 2. From a requires-expression: does this code compile?
template <class T>
concept Printable = requires(std::ostream& out, const T& value) {
    out << value;
};

// 3. By combining other concepts.
template <class T>
concept PrintableNumber = Integral<T> && Printable<T>;

struct Opaque {};

int main() {
    std::cout << std::boolalpha;
    std::cout << "Integral<int>:            " << Integral<int> << '\n';
    std::cout << "Integral<double>:         " << Integral<double> << '\n';
    std::cout << "Printable<std::string>:   " << Printable<std::string> << '\n';
    std::cout << "Printable<Opaque>:        " << Printable<Opaque> << '\n';
    std::cout << "PrintableNumber<int>:     " << PrintableNumber<int> << '\n';
    std::cout << "PrintableNumber<double>:  " << PrintableNumber<double> << '\n';
}
```

A concept evaluates to `true` or `false` at compile time, and you can print it,
which makes them easy to test — a genuinely useful debugging technique when a
constraint is not doing what you expect.

### requires-expressions

The `requires(...)  { ... }` form asks *does this compile?* Each line inside is
a requirement:

```cpp run title="The four kinds of requirement" std=c++20
#include <concepts>
#include <iostream>
#include <vector>

template <class T>
concept Container = requires(T c, const T cc) {
    typename T::value_type;              // a nested type must exist
    c.begin();                           // an expression must be valid
    { cc.size() } -> std::convertible_to<std::size_t>;   // ...and have this type
    requires !std::is_pointer_v<T>;      // a nested boolean requirement
};

int main() {
    std::cout << std::boolalpha;
    std::cout << "Container<std::vector<int>>: " << Container<std::vector<int>> << '\n';
    std::cout << "Container<int>:              " << Container<int> << '\n';
    std::cout << "Container<int*>:             " << Container<int*> << '\n';
}
```

Note the difference between `c.begin();` and `{ cc.size() } -> ...`. The first
only requires that the expression is valid; the second also constrains its type.
Use the braced form when the return type matters, which is more often than not.

## Four ways to write the same constraint

They are equivalent; pick by readability.

```cpp run title="The same constraint, four syntaxes" std=c++20
#include <concepts>
#include <iostream>

// 1. As the parameter's "type": shortest, and the usual choice.
template <std::integral T>
T doubled_a(T value) { return value * 2; }

// 2. A requires clause after the parameter list.
template <class T>
    requires std::integral<T>
T doubled_b(T value) { return value * 2; }

// 3. A requires clause after the function's declaration.
template <class T>
T doubled_c(T value) requires std::integral<T> { return value * 2; }

// 4. An abbreviated function template — no template<> at all.
std::integral auto doubled_d(std::integral auto value) { return value * 2; }

int main() {
    std::cout << doubled_a(21) << ' ' << doubled_b(21) << ' '
              << doubled_c(21) << ' ' << doubled_d(21) << '\n';
}
```

Form 4 is worth noticing: `auto` in a parameter list already makes a function a
template, and putting a concept in front constrains it. It is the most compact
way to write a constrained generic function.

## Overloading on constraints

This is where concepts earn their place beyond error messages. When several
overloads apply, the compiler picks the **most constrained** one:

```cpp run title="The most specific constraint wins" std=c++20
#include <concepts>
#include <iostream>
#include <string>
#include <vector>

template <class T>
concept HasSize = requires(const T& t) { t.size(); };

// Least constrained: anything at all.
template <class T>
std::string describe(const T&) { return "some value"; }

// More constrained: anything with .size().
template <HasSize T>
std::string describe(const T& value) {
    return "sized, holding " + std::to_string(value.size());
}

// Most constrained: an integer. Note it takes const T& like the others —
// see the note below on why that matters.
template <std::integral T>
std::string describe(const T& value) { return "integer " + std::to_string(value); }

int main() {
    std::cout << describe(42) << '\n';
    std::cout << describe(std::vector<int>{1, 2, 3}) << '\n';
    std::cout << describe(2.5) << '\n';
}
```

Before concepts this required SFINAE — `std::enable_if` with a trailing return
type — which worked and was close to unreadable. The concept version says what
it means.

:::note
"Most constrained" is decided by **subsumption**: concept A subsumes concept B
if A's requirements include B's. That works when concepts are built by combining
other concepts with `&&`, and it does *not* look inside a requires-expression.
Two unrelated concepts are simply ambiguous, and the fix is to make one build on
the other.
:::

:::pitfall
Constraints are only consulted to break a tie between overloads that are
**otherwise equally good**. All three overloads above take `const T&`
deliberately: change the last one to take `T` by value and the call becomes
ambiguous, because by-value and by-reference are equally good matches for an
`int` and the compiler never reaches the constraint comparison.

The error says `call of overloaded 'describe(int)' is ambiguous` and does not
mention concepts at all, which makes it a confusing half-hour if you are
expecting constraints to sort it out. Keep the parameter forms identical across
a constrained overload set.
:::

## The standard concepts

`<concepts>` ships the vocabulary, and you should reach for it before writing
your own:

| Concept | Means |
|---|---|
| `std::integral`, `std::floating_point` | an integer or floating-point type |
| `std::same_as<U>`, `std::convertible_to<U>`, `std::derived_from<U>` | type relationships |
| `std::equality_comparable`, `std::totally_ordered` | supports `==`, or the full ordering |
| `std::copyable`, `std::movable`, `std::default_initializable` | value semantics |
| `std::invocable<Args...>`, `std::predicate<Args...>` | callable, or callable returning `bool` |

`<iterator>` and `<ranges>` add the ones Chapter 4.4 used —
`std::random_access_iterator`, `std::ranges::range`, and their relatives.

```cpp run title="Constraining with standard concepts" std=c++20
#include <concepts>
#include <iostream>
#include <ranges>
#include <vector>

// Any range whose elements can be compared, plus any predicate over them.
template <std::ranges::input_range R, std::predicate<std::ranges::range_value_t<R>> P>
std::size_t count_matching(const R& range, P pred) {
    std::size_t found = 0;
    for (const auto& item : range) {
        if (pred(item)) ++found;
    }
    return found;
}

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6};
    std::cout << count_matching(v, [](int x) { return x % 2 == 0; }) << '\n';

    int raw[] = {1, 3, 5, 7};
    std::cout << count_matching(raw, [](int x) { return x > 3; }) << '\n';
}
```

That signature documents the function completely: it takes a range you can
iterate once and a predicate over its element type. A reader needs no comment,
and a caller passing something wrong gets told which half was wrong.

## static_assert with concepts

Concepts are ordinary compile-time booleans, so they work anywhere one does —
including as a check on your own types:

```cpp run title="Asserting that a type models a concept" std=c++20
#include <concepts>
#include <iostream>

struct Point {
    int x, y;
    auto operator<=>(const Point&) const = default;
    bool operator==(const Point&) const = default;
};

int main() {
    static_assert(std::equality_comparable<Point>);
    static_assert(std::totally_ordered<Point>);
    static_assert(std::copyable<Point>);

    std::cout << "Point satisfies the value-semantics concepts\n";
    std::cout << std::boolalpha << "Point{1,2} < Point{1,3}: "
              << (Point{1, 2} < Point{1, 3}) << '\n';
}
```

This is a genuinely good habit for a type you intend others to use: assert once
that it models the concepts it claims to, and the assertion fails the moment
someone removes an operator.

## Check yourself

:::quiz
{
  "question": "What is the main practical benefit of constraining a template with a concept?",
  "options": [
    { "text": "It makes the generated code faster", "why": "Constraints are checked at compile time and generate no code. The instantiated function is identical either way." },
    { "text": "The error moves to the call site and names the unsatisfied requirement, instead of appearing inside the template body", "correct": true, "why": "That is the day-to-day payoff. The same program is rejected either way; what changes is whether the message is about your call or about a line inside somebody else's template." },
    { "text": "It allows the template to accept more types", "why": "It accepts strictly fewer — that is what constraining means. The benefit is in how the rejections are reported, and in overload selection." },
    { "text": "It removes the need for the definition to be in a header", "why": "Unrelated: instantiation still needs the definition, so the header rule from Chapter 5.1 is unchanged." }
  ]
}
:::

:::quiz
{
  "question": "In `requires(const T& t) { t.size(); }` versus `{ t.size() } -> std::convertible_to<std::size_t>;` — what is the difference?",
  "options": [
    { "text": "None; the second is just more verbose", "why": "The braced form adds a real constraint that the first does not have." },
    { "text": "The first only requires the expression to be valid; the second also requires its type to be convertible to size_t", "correct": true, "why": "So a type whose size() returned, say, a std::string would satisfy the first and not the second. Use the braced form whenever the return type matters — which is more often than not." },
    { "text": "The first requires size() to be const, the second does not", "why": "Constness comes from how the parameter is declared — `const T& t` — and applies to both forms equally." },
    { "text": "The second evaluates t.size() at compile time", "why": "Neither evaluates anything. A requires-expression only asks whether the code would compile." }
  ]
}
:::

## Practice

:::exercise write-a-concept

:::exercise constrain-overloads

:::recap
- A concept is a named compile-time predicate over types. It changes *where* an
  error appears and *what it says*, not what compiles.
- Build them from traits, from `requires`-expressions, or by combining other
  concepts with `&&`.
- Inside a requires-expression: a nested type, a valid expression, a braced
  expression with a return-type constraint, or a nested `requires` boolean.
- Four equivalent syntaxes; `template <std::integral T>` and the abbreviated
  `std::integral auto` form are the compact ones.
- Overloads are ranked by **subsumption** — the most constrained wins — which
  replaces SFINAE and `enable_if`.
- Prefer the standard concepts in `<concepts>`, `<iterator>`, and `<ranges>`
  before writing your own, and `static_assert` that your types model the ones
  they claim to.
:::
