---
title: "Variadic templates"
navTitle: "Variadic templates"
summary: >-
  Functions and types that take any number of arguments.
objectives:
  - Write a variadic function template with a fold expression
  - Explain how a parameter pack is expanded
  - Implement a simple type-safe printf
status: complete
standard: c++20
requires: [deduction]
---

C's answer to "any number of arguments" is `printf`, and the price is that the
compiler cannot check it. Pass an `int` where the format string promised
`%s` and you get undefined behaviour, not a diagnostic.

C++ can do better because a variadic template knows every argument's type. The
count and the types are fixed at the call site, the same as for any other
template — there is just no fixed number of them.

```cpp run title="Every argument, every type, checked"
#include <iostream>
#include <string>

template <class... Args>
void print(const Args&... args) {
    ((std::cout << args << ' '), ...);
    std::cout << '\n';
}

int main() {
    print(1, 2.5, "three", std::string{"four"}, 'x', true);
    print("just one");
    print();
}
```

Six arguments of six different types, one function, no format string to get
wrong. Add a type with no `operator<<` and the error names that type at your
call.

## A pack is not a type

`class... Args` declares a **template parameter pack**; `const Args&... args`
declares a **function parameter pack**. Neither is a thing you can pass around
on its own. `args` is not a container, has no `begin()`, and cannot be indexed.
The only two things you can do with a pack are ask how big it is and **expand**
it.

```cpp run title="The two operations"
#include <iostream>

template <class... Args>
void describe(const Args&... args) {
    std::cout << sizeof...(Args) << " arguments: ";
    ((std::cout << '[' << args << ']'), ...);
    std::cout << '\n';
}

int main() {
    describe(1, 'b', 3.5);
    describe();
}
```

`sizeof...(Args)` and `sizeof...(args)` both give the count — a `std::size_t`,
known at compile time, usable in a `static_assert`.

Expansion is written as a pattern followed by `...`. The pattern is repeated
once per element, with the pack name replaced each time, and the copies are
separated by commas:

| You write | It becomes |
|---|---|
| `args...` | `a1, a2, a3` |
| `&args...` | `&a1, &a2, &a3` |
| `f(args)...` | `f(a1), f(a2), f(a3)` |
| `std::forward<Args>(args)...` | `std::forward<A1>(a1), …` |
| `static_cast<long>(args)...` | `static_cast<long>(a1), …` |

The `...` applies to the whole pattern, not to the nearest name — which is why
`f(args)...` calls `f` three times rather than calling it once with three
arguments.

## Fold expressions

A comma-separated list is only useful where a list is expected. To *combine*
the elements with an operator, you need a **fold expression** (C++17): a
parenthesised pack, an operator, and `...`.

```cpp run title="Four forms, and why the direction matters"
#include <iostream>

template <class... Args> auto right_fold(Args... a) { return (a - ...); }
template <class... Args> auto left_fold(Args... a)  { return (... - a); }
template <class... Args> auto right_init(Args... a) { return (a - ... - 100); }
template <class... Args> auto left_init(Args... a)  { return (100 - ... - a); }

int main() {
    std::cout << "(a - ...)      = " << right_fold(1, 2, 3) << "  // 1 - (2 - 3)\n";
    std::cout << "(... - a)      = " << left_fold(1, 2, 3)  << "  // (1 - 2) - 3\n";
    std::cout << "(a - ... - 100)= " << right_init(1, 2, 3) << "  // 1 - (2 - (3 - 100))\n";
    std::cout << "(100 - ... - a)= " << left_init(1, 2, 3)  << "  // ((100 - 1) - 2) - 3\n";
}
```

The mnemonic: **the `...` sits where the rest of the fold goes**. `(a - ...)`
puts the remainder on the right, so it nests to the right. For associative
operators like `+` the direction does not change the answer; for `-`, `/`, and
`<<` it does, and left folds are usually what you want because they match how
the operator reads.

Almost any binary operator works, including `,`, `&&`, `||`, `<<`, and `=`.

:::pitfall
A unary fold over an **empty** pack is only valid for three operators: `&&`
(yields `true`), `||` (yields `false`), and `,` (yields `void()`). Every other
operator is a hard error, because there is no agreed identity value.

```cpp run expect-error title="An empty pack has no zero"
template <class... Args>
int total(Args... args) { return (args + ...); }

int main() { return total(); }     // no arguments
```

> error: fold of empty expansion over operator+

The fix is the binary form, which supplies the identity yourself:
`(0 + ... + args)`. Prefer it by default — `(args + ...)` is a function that
works until someone calls it with nothing.
:::

```cpp run title="The binary form handles the empty case"
#include <iostream>

template <class... Args> auto total(const Args&... args) { return (0 + ... + args); }
template <class... Args> bool all_positive(const Args&... args) { return (... && (args > 0)); }

int main() {
    std::cout << total(1, 2, 3) << ' ' << total() << '\n';
    std::cout << std::boolalpha << all_positive(1, 2, 3) << ' '
              << all_positive(1, -2) << ' ' << all_positive() << '\n';
}
```

Note `(args > 0)` in parentheses. The pattern of a fold must be a single
operand, and `args > 0 && ...` would parse as the wrong thing. Parenthesise
anything that is not a bare name.

## Evaluation order: the comma fold earns its keep

Fold expressions over `&&`, `||`, and `,` guarantee left-to-right evaluation.
Function arguments do not — the order in which a call's arguments are evaluated
is unspecified, and compilers differ.

```cpp run title="The same three calls, two different orders"
#include <iostream>

int next_id() { static int n = 0; return ++n; }

template <class... Args>
void as_call(Args... args) { ((std::cout << args << ' '), ...); std::cout << '\n'; }

int main() {
    std::cout << "expanded as call arguments: ";
    as_call(next_id(), next_id(), next_id());

    std::cout << "expanded as a comma fold:   ";
    ((std::cout << next_id() << ' '), (std::cout << next_id() << ' '),
     (std::cout << next_id() << ' '));
    std::cout << '\n';
}
```

On GCC the first line prints `3 2 1` — the arguments were evaluated
right-to-left before `as_call` ever ran. The second line prints `4 5 6`,
because a comma fold *is* ordered. Another compiler may print `1 2 3` for the
first line and still be conforming.

So: when the elements have side effects and the order matters, put the side
effect **inside** a comma fold, not in the argument list of a call.

## A type-safe `printf`

That is enough machinery to replace the thing we started with.

```cpp run title="format, in sixteen lines"
#include <iostream>
#include <sstream>
#include <string>
#include <string_view>

template <class... Args>
std::string format(std::string_view pattern, const Args&... args) {
    std::ostringstream out;
    std::size_t pos = 0;

    [[maybe_unused]] auto emit = [&](const auto& value) {   // unused when Args is empty
        std::size_t brace = pattern.find("{}", pos);
        if (brace == std::string_view::npos) return;     // more args than slots
        out << pattern.substr(pos, brace - pos) << value;
        pos = brace + 2;
    };

    (emit(args), ...);                                    // ordered, left to right
    out << pattern.substr(pos);
    return out.str();
}

int main() {
    std::cout << format("{} scored {} out of {}\n", "ada", 91.5, 100);
    std::cout << format("no placeholders here\n");
    std::cout << format("{} and {}\n", 1, 2, 3);          // extra argument: ignored
}
```

Three things this gets for free that `printf` cannot. Every argument is printed
by the `operator<<` chosen for *its* type, so there is no format specifier to
mismatch. A `std::string` works without `.c_str()`. And the whole thing is
ordinary code — the `emit` lambda is called once per argument, in order,
because the comma fold says so.

:::standards
This is a teaching implementation. Real code should use `std::format`
(C++20, `<format>`), which does the same job with a compile-time-checked format
string, locale-aware formatting, and no `ostringstream`. GCC ships it from
version 13. `std::print` (C++23) goes one step further and writes straight to
the stream.
:::

## Packs expand in more places than you think

Pack expansion is not limited to function arguments. It works in template
argument lists, in base-class lists, in `using`-declarations, and in braced
initialiser lists. The classic demonstration is the `overloaded` idiom: build
one callable out of several lambdas by inheriting from all of them.

```cpp run title="Inheriting from a pack"
#include <iostream>
#include <string>
#include <variant>

template <class... Ts>
struct overloaded : Ts... {
    using Ts::operator()...;      // pull every base's operator() into scope
};

int main() {
    std::variant<int, double, std::string> values[] = {42, 2.5, std::string{"text"}};

    auto describe = overloaded{
        [](int i)                { std::cout << "int " << i << '\n'; },
        [](double d)             { std::cout << "double " << d << '\n'; },
        [](const std::string& s) { std::cout << "string \"" << s << "\"\n"; },
    };

    for (const auto& v : values) std::visit(describe, v);
}
```

Two expansions, both unusual. `struct overloaded : Ts...` expands the pack into
the base-class list, so the struct derives from all three lambda types.
`using Ts::operator()...` expands into three `using`-declarations, which is what
makes overload resolution see all three call operators as one overload set —
without it, the inherited names would hide each other and the call would be
ambiguous.

:::note
In C++17 this idiom needed a deduction guide
(`template <class... Ts> overloaded(Ts...) -> overloaded<Ts...>;`). C++20's
aggregate class template argument deduction supplies it, so the guide is no
longer needed — you will still see it in older code.
:::

## When a fold is not enough

Folds handle "do the same thing to every element". When each element needs to
know its position, or the elements must be handled pairwise, you fall back to
recursion — a base case and a step that peels one argument off the front.

```cpp run title="Recursion, for when position matters"
#include <iostream>
#include <string_view>

void print_numbered(int, std::string_view) {}          // end of the pack

template <class First, class... Rest>
void print_numbered(int index, std::string_view label, const First& first, const Rest&... rest) {
    std::cout << label << ' ' << index << ": " << first << '\n';
    if constexpr (sizeof...(rest) > 0)
        print_numbered(index + 1, label, rest...);
}

int main() {
    print_numbered(1, "row", "alpha", 2, 3.5, 'z');
}
```

`if constexpr` is doing real work here: without it, the compiler would still
have to compile the recursive call for the empty case, and the overload that
takes no pack would have to exist for a reason other than never being called.
With it, the branch disappears when the pack is empty.

Before C++17 this was the *only* way to write any of this, which is why older
generic code is full of head/tail recursion. If a fold expresses what you mean,
use the fold: it compiles faster and reads better.

## Check yourself

:::quiz
{
  "question": "`(args + ...)` and `(0 + ... + args)` differ in what way?",
  "options": [
    { "text": "The first is a right fold and the second a left fold, so they can give different answers for non-associative operators — and only the second accepts an empty pack", "correct": true, "why": "Both differences matter. For `+` on ints the answers agree, but the empty case is an error for the first and `0` for the second." },
    { "text": "Nothing; the `0` is decoration", "why": "Call each with no arguments. The first is a compile error." },
    { "text": "The second is evaluated at compile time", "why": "Neither is, unless the context demands a constant — see the previous chapter." },
    { "text": "The first only works for arithmetic types", "why": "Both work for anything with a `+`. The distinction is direction and the empty-pack case." }
  ]
}
:::

:::quiz
{
  "question": "In `f(g(args)...)`, how many times is `g` called and in what order?",
  "options": [
    { "text": "Once per pack element, in an unspecified order", "correct": true, "why": "The `...` applies to the whole pattern `g(args)`, so there is one call per element — but they are the arguments of `f`, whose evaluation order is unspecified. GCC commonly evaluates right-to-left." },
    { "text": "Once, with all the arguments", "why": "That would be `g(args...)`. The position of the `...` decides which." },
    { "text": "Once per element, guaranteed left to right", "why": "Only a fold over `,`, `&&`, or `||` guarantees the order. A function call's arguments do not." },
    { "text": "It depends on `sizeof...(args)` being known at compile time", "why": "It is always known at compile time; that is not what varies." }
  ]
}
:::

## Practice

:::exercise fold-statistics

:::exercise variadic-emplace

:::recap
- A parameter pack is not a value: the only operations are `sizeof...` and
  expansion, and the `...` applies to the whole pattern before it.
- A fold expression combines a pack with a binary operator. Four forms; the
  `...` sits where the rest of the fold goes.
- A unary fold over an empty pack is only valid for `&&`, `||`, and `,`. Use the
  binary form and supply the identity.
- Folds over `,`, `&&`, and `||` are evaluated left to right; a call's arguments
  are not, so put ordered side effects inside a comma fold.
- Packs also expand into base-class lists, `using`-declarations, and template
  argument lists — that is what makes the `overloaded` idiom work.
- Reach for recursion plus `if constexpr` only when position or pairing matters;
  otherwise the fold is shorter and compiles faster.
:::
