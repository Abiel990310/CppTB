---
title: "Functions"
navTitle: "Functions"
summary: >-
  Parameters, returns, overloads, and the cost of each calling convention.
objectives:
  - Choose between passing by value, by reference, and by const reference
  - Explain what overload resolution picks and why
  - Write a function with a default argument without creating ambiguity
status: complete
standard: c++20
requires: [repetition]
---

A function is a named piece of work with a stated interface. In C++ that
interface says more than in most languages: it says what the caller gives up,
what it gets back, and whether its own objects can be modified.

## Declaration and definition

```cpp run title="A function, and the pieces of its interface" std=c++20
#include <iostream>

// Declaration: the promise. Enough for callers to type-check against.
int add(int a, int b);

int main() {
    std::cout << add(2, 3) << '\n';
}

// Definition: the body. May live in another file, which is why the
// declaration is enough for main to compile.
int add(int a, int b) {
    return a + b;
}
```

A **declaration** introduces the name and signature; a **definition** supplies
the body. Chapter 1.1 showed what happens when you declare and never define: it
compiles and the linker complains, because the promise was never kept.

Every function must state its return type. `void` means it returns nothing.

## How parameters are passed

This is the decision C++ asks you to make that most languages do not.

```cpp run title="Three ways to take an argument" std=c++20
#include <iostream>
#include <string>

void by_value(std::string s)            { s += " (changed)"; }
void by_reference(std::string& s)       { s += " (changed)"; }
void by_const_ref(const std::string& s) { std::cout << "  read: " << s << '\n'; }

int main() {
    std::string text = "hello";

    by_value(text);
    std::cout << "after by_value:     " << text << '\n';

    by_reference(text);
    std::cout << "after by_reference: " << text << '\n';

    by_const_ref(text);
}
```

- **By value** (`std::string s`) copies. The function gets its own object;
  changes do not escape.
- **By reference** (`std::string& s`) binds to the caller's object. Changes are
  visible to the caller — that is the point.
- **By const reference** (`const std::string& s`) binds without copying, and the
  compiler enforces that the function does not modify it.

The default you want:

| Parameter is | Take it |
|---|---|
| Small and cheap to copy (`int`, `double`, a pointer, `std::string_view`) | by value |
| Larger, and you only read it | `const T&` |
| Something the caller expects you to modify | `T&` |
| Something you are taking ownership of | by value, then `std::move` |

The cost of getting it wrong is real:

```cpp run title="What a needless copy costs" std=c++20
#include <chrono>
#include <iostream>
#include <string>

std::size_t by_value(std::string s)            { return s.size(); }
std::size_t by_const_ref(const std::string& s) { return s.size(); }

int main() {
    const std::string big(200'000, 'x');
    constexpr int rounds = 2000;
    using clock = std::chrono::steady_clock;
    using us = std::chrono::microseconds;

    auto start = clock::now();
    std::size_t sink = 0;
    for (int i = 0; i < rounds; ++i) sink += by_value(big);
    auto mid = clock::now();
    for (int i = 0; i < rounds; ++i) sink += by_const_ref(big);
    auto finish = clock::now();

    std::cout << "by value:     " << std::chrono::duration_cast<us>(mid - start).count() << " us\n";
    std::cout << "by const ref: " << std::chrono::duration_cast<us>(finish - mid).count() << " us\n";
    std::cout << "(checksum " << sink << ")\n";
}
```

Same answer; one of them copied 200,000 bytes two thousand times to get it.

:::pitfall
`const T&` cannot be your default for *everything*. For types the size of a
pointer or smaller — `int`, `char`, `double`, `std::string_view` — passing by
value is at least as fast and often faster, because a reference is itself a
pointer the callee must follow. Reference-to-int is not an optimisation.
:::

## Returning

Return by value. The copy you might fear usually does not happen:

```cpp run title="Returning a large object" std=c++20
#include <iostream>
#include <string>
#include <vector>

std::vector<std::string> build() {
    std::vector<std::string> result;
    result.push_back("alpha");
    result.push_back("beta");
    return result;                // no copy: elided, or moved
}

int main() {
    const auto values = build();
    std::cout << values.size() << " items, first is " << values[0] << '\n';
}
```

Since C++17 the compiler is required to elide the copy in many cases, and where
it cannot elide, it moves. `return result;` is correct and fast; writing
`return std::move(result);` is worse, because it prevents the elision. Chapter
7.5 covers exactly when.

:::warning
Never return a reference or pointer to a local. The object dies when the
function returns, and the caller is left holding an address to storage that no
longer belongs to anyone. Chapters 2.2 and 2.3 show what the compiler does and
does not catch.
:::

## Overloading

Several functions may share a name if their parameters differ:

```cpp run title="One name, several functions" std=c++20
#include <iostream>
#include <string>

void print(int value)                { std::cout << "int: " << value << '\n'; }
void print(double value)             { std::cout << "double: " << value << '\n'; }
void print(const std::string& value) { std::cout << "string: " << value << '\n'; }

int main() {
    print(42);
    print(3.14);
    print(std::string{"hello"});
    print('a');        // char converts to int — the int overload wins
    print(2.0f);       // float converts to double
}
```

The compiler picks by looking at the argument types and ranking the conversions
each candidate would need. An **exact match** beats a **promotion** (`char` →
`int`, `float` → `double`), which beats any other **standard conversion**
(`int` → `double`, `int` → `long`), which beats a **user-defined conversion**.

Note where `float` sits: `print(2.0f)` above chose `print(double)` not because
the two were tied, but because `float` → `double` is a promotion while `float` →
`int` is a mere conversion. Ranking, not coin-flipping.

A genuine tie is an **ambiguity error** rather than an arbitrary choice:

```cpp run expect-error title="No best match"
void handle(long) {}
void handle(double) {}

int main() {
    // int → long and int → double are both plain conversions, ranked equally.
    handle(1);
}
```

The fix is to be explicit at the call site (`handle(static_cast<double>(1.0f))`)
or to add an overload that matches exactly.

**Return type is not part of the signature.** Two functions differing only in
what they return is an error, not an overload:

```cpp run expect-error title="Return type does not overload"
int  value() { return 1; }
double value() { return 1.0; }

int main() { return 0; }
```

## Default arguments

```cpp run title="Defaults, and where they belong" std=c++20
#include <iostream>
#include <string>

std::string join(const std::string& a, const std::string& b,
                 const std::string& separator = ", ") {
    return a + separator + b;
}

int main() {
    std::cout << join("alpha", "beta") << '\n';
    std::cout << join("alpha", "beta", " | ") << '\n';
}
```

Defaults must come last — everything after a defaulted parameter must also be
defaulted, because arguments are matched positionally.

:::pitfall
A default argument and an overload can make a call ambiguous, and the error
appears at the *call site* rather than at the definitions:

```cpp
void log(const std::string& message, int level = 0);
void log(const std::string& message);          // now log("x") matches both
```

Pick one mechanism. If you find yourself adding an overload to a function that
already has defaults, that is the moment to reconsider.
:::

```cpp run expect-error title="An ambiguity created by a default"
#include <string>

void log(const std::string& message, int level = 0) { (void)message; (void)level; }
void log(const std::string& message) { (void)message; }

int main() {
    log("hello");        // both candidates match exactly
}
```

## Small functions and inline

A function call is not free — arguments are placed, control jumps, a frame is
set up — but the compiler removes most of that for small functions by inlining
them. You do not have to ask:

```cpp asm run title="What a small function costs at -O2" std=c++20
int square(int x) { return x * x; }

int caller(int a) {
    return square(a) + square(a + 1);
}

int main() { return caller(3); } // [hidden]
```

Press **Assembly** at `-O2`: there is no `call` to `square` at all. The
multiplications are inlined directly into `caller`.

The `inline` keyword is *not* primarily a performance hint — modern compilers
decide for themselves. Its real meaning is a linker rule: an `inline` function
may be defined in several translation units without violating the one-definition
rule, which is why functions defined in headers are marked `inline`. Chapter 9.1
covers that properly.

Write small, well-named functions. Chapter 7.2 makes the case with measurements;
the short version is that the compiler is better at this than you are, and the
readability is worth more than the call.

## Check yourself

:::quiz
{
  "question": "A function reads a `std::vector<int>` and does not modify it. What should the parameter be?",
  "options": [
    { "text": "`std::vector<int>`", "why": "That copies the whole vector — an allocation and a full element copy — on every call, to do something that only reads." },
    { "text": "`const std::vector<int>&`", "correct": true, "why": "No copy, and the const is enforced by the compiler rather than merely documented. This is the default for any read-only parameter larger than a pointer." },
    { "text": "`std::vector<int>&`", "why": "It avoids the copy, but the missing const says the function may modify the caller's vector, and it stops callers passing a temporary." },
    { "text": "`std::vector<int>*`", "why": "It works, but forces `&` at every call site and forces the function to handle null. Nothing here needs to represent 'no vector'." }
  ]
}
:::

:::quiz
{
  "question": "Why is `int f(); double f();` an error rather than an overload?",
  "options": [
    { "text": "Because the return types are convertible to each other", "why": "Convertibility is not the issue — the rule applies to any two return types, even unrelated ones." },
    { "text": "Because the return type is not part of the signature, so both declare the same function", "correct": true, "why": "Overload resolution works from the arguments at the call site. In `f()` there is nothing to distinguish the candidates, so the language does not let them coexist." },
    { "text": "Because a function can only be declared once", "why": "It can be declared many times; it can be *defined* once. These two are not redeclarations of one function — they are a conflict." },
    { "text": "Because `double` and `int` have different sizes", "why": "Sizes are irrelevant to overload resolution, which considers parameter types only." }
  ]
}
:::

## Practice

:::exercise pass-correctly

:::exercise overload-resolution

:::recap
- A declaration is a promise; a definition keeps it. An unkept promise is a
  linker error.
- Pass small types by value, larger read-only ones by `const T&`, and use `T&`
  only when the caller expects modification.
- `const T&` is not a universal default — for `int`-sized types, by value is as
  fast or faster.
- Return by value. `return local;` does not copy, and `return std::move(local);`
  is worse because it blocks elision. Never return a reference to a local.
- Overloads are chosen by argument types; equally good candidates are an error,
  not a coin flip. Return type does not participate.
- Default arguments must come last, and mixing them with overloads creates
  ambiguities that surface at the call site.
- Let the compiler decide about inlining. `inline` is a linkage rule, not a
  speed hint.
:::
