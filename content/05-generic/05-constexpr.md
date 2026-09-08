---
title: "Compile-time computation"
navTitle: "Compile-time computation"
summary: >-
  Work the compiler does so the program does not have to.
objectives:
  - Write a constexpr function and prove it runs at compile time
  - Explain the difference between constexpr, consteval, and constinit
  - Use static_assert to check an invariant at compile time
status: complete
standard: c++20
requires: [deduction]
---

Every C++ program has two execution environments. One is the machine your users
run. The other is the compiler, which has to evaluate array bounds, template
arguments, and enumerator values before it can emit a single instruction — so
it already contains an interpreter for a large subset of the language.

`constexpr` is how you get at that interpreter. Work you push into it costs
nothing at run time: no instructions, no cache misses, no failure mode. And it
gets checked at build time, which means a bad input is a compiler error rather
than a bug report.

```cpp run asm title="A table the program never builds"
#include <array>
#include <iostream>

constexpr std::array<int, 10> squares() {
    std::array<int, 10> table{};
    for (int i = 0; i < 10; ++i) table[i] = i * i;
    return table;
}

constexpr auto squares_table = squares();

static_assert(squares_table[7] == 49);

int main() {
    std::cout << "9 squared is " << squares_table[9] << '\n';
}
```

That loop never runs. Press **Assembly** and look for it: there is no loop and
no multiply, only ten integers sitting in the read-only data section. The
`static_assert` is not a runtime test either — it is a question the compiler
answered before the program existed.

## `constexpr` means *may*, not *will*

This is the single most misread keyword in modern C++. `constexpr` on a
function is a **permission**, not an instruction. It says the function *is
allowed* to run during constant evaluation, if a context demands a constant. In
any other context it is an ordinary function and runs at run time like all the
rest.

```cpp run title="The same function, evaluated both ways"
#include <iostream>
#include <type_traits>

constexpr int doubled(int n) {
    if (std::is_constant_evaluated()) {
        return n * 2;                    // the compiler took this path
    }
    std::cout << "  doubling " << n << " at run time\n";
    return n * 2;
}

int main() {
    constexpr int a = doubled(21);        // must be constant: compile time
    std::cout << "a = " << a << " (nothing was printed above)\n";

    int input = 21;
    int b = doubled(input);               // input is not a constant: run time
    std::cout << "b = " << b << '\n';
}
```

`std::is_constant_evaluated()` (C++20, in `<type_traits>`) is the only way to
ask which environment you are in. The rule it follows is not "did the optimiser
manage to fold it" — it is a language rule about the *context*. Initialising a
`constexpr int` requires a constant, so evaluation happens in the compiler.
Initialising a plain `int` does not, so it does not, regardless of what `-O2`
later decides to precompute.

:::pitfall
`if constexpr (std::is_constant_evaluated())` is always true, in both
environments, and it is a bug every time. `if constexpr` picks its branch while
compiling the function template — at which point the answer is trivially "yes,
we are in the compiler". Write plain `if`. GCC and Clang both warn about this
one, which is lucky, because it fails silently.
:::

So: if you want to *guarantee* compile-time evaluation, you have to demand a
constant. The three ways to demand one are `constexpr` on the variable,
`static_assert`, and using the value as a template argument or array bound.

## What a `constexpr` function may do

The C++11 rule was famously one `return` statement. Almost nothing is left of
that. Since C++20 a `constexpr` function may use loops, mutate local variables,
call virtual functions, and — the big one — allocate memory.

```cpp run title="Allocating during constant evaluation"
#include <array>
#include <iostream>
#include <vector>

// Sieve of Eratosthenes, run by the compiler.
constexpr std::array<int, 25> primes_below_100() {
    std::vector<bool> composite(100, false);      // heap allocation, at compile time
    std::array<int, 25> found{};
    int n = 0;
    for (int i = 2; i < 100; ++i) {
        if (composite[i]) continue;
        found[n++] = i;
        for (int j = i * i; j < 100; j += i) composite[j] = true;
    }
    return found;                                  // the vector dies here
}

constexpr auto primes = primes_below_100();

static_assert(primes[0] == 2);
static_assert(primes[24] == 97);

int main() {
    std::cout << "the 25th prime is " << primes[24] << '\n';
}
```

The `std::vector` really is allocated and freed by the compiler. What you cannot
do is let that allocation escape:

```cpp run expect-error title="Allocation may not survive the compiler"
#include <vector>

constexpr std::vector<int> data = {1, 2, 3};

int main() { return data[0]; }
```

> error: … is not a constant expression because it refers to a result of `operator new`

This is the rule of **transient allocation**: memory allocated during constant
evaluation must be freed before that evaluation ends. The compiler's heap does
not exist at run time, so a pointer into it cannot be baked into the program.
Allocate all you like inside the function; return something that owns nothing —
an `std::array`, an integer, a `struct` of scalars.

:::note
This is why the sieve above returns `std::array<int, 25>` and not
`std::vector<int>`, and why the size 25 is written out by hand. A compile-time
computation may *use* dynamic memory freely; it may not *hand you back* any.
:::

## `consteval`: no run-time option

Sometimes "may" is not enough. A function that validates a literal is worthless
if it can silently fall back to a run-time check — you wanted the error at build
time. `consteval` (C++20) declares an **immediate function**: every call must
produce a constant, or the program does not compile.

```cpp run title="A literal the compiler checks"
#include <cstdint>
#include <iostream>
#include <string_view>

consteval std::uint32_t colour(std::string_view hex) {
    if (hex.size() != 7 || hex[0] != '#') throw "colour literal must look like #rrggbb";
    std::uint32_t value = 0;
    for (char c : hex.substr(1)) {
        int digit = (c >= '0' && c <= '9') ? c - '0'
                  : (c >= 'a' && c <= 'f') ? c - 'a' + 10
                  : (c >= 'A' && c <= 'F') ? c - 'A' + 10
                  : -1;
        if (digit < 0) throw "colour literal contains a non-hex digit";
        value = value * 16 + static_cast<std::uint32_t>(digit);
    }
    return value;
}

int main() {
    constexpr std::uint32_t accent = colour("#3b82f6");
    std::cout << std::hex << "accent = 0x" << accent << '\n';
}
```

Change the literal to `"#3b82fg"` and the build fails. The `throw` is the
mechanism: throwing is not allowed during constant evaluation, so reaching a
`throw` turns "this is not a constant expression" into a hard error, and the
compiler quotes the line — including, on GCC and Clang, the string you threw.
The exception is never actually thrown, because the code never runs.

The other half of `consteval` is that a run-time argument is simply not
accepted:

```cpp run expect-error title="An immediate function cannot wait for run time"
consteval int square(int n) { return n * n; }

int main(int argc, char**) {
    return square(argc);      // argc is not known until the program starts
}
```

> error: 'argc' is not a constant expression

That diagnostic is the whole point of the keyword. With `constexpr` this
compiles and quietly does the work at run time; with `consteval` you are told.

:::standards
C++23 adds `if consteval { … } else { … }`, which is the corrected form of the
`is_constant_evaluated` test: inside the `if consteval` branch you may call
immediate functions, which a plain `if` does not allow. It also relaxes
`consteval` so that one immediate function may call another freely. If you are
on C++20, plain `if (std::is_constant_evaluated())` remains the tool.
:::

## `constinit`: about *when*, not *whether*

`constinit` is the odd one out. It says nothing about computing a value in the
compiler — it constrains **initialisation order**.

A namespace-scope variable is initialised either *statically* (the value is
baked into the binary before `main` starts) or *dynamically* (code runs at
startup). Dynamic initialisation across translation units happens in an
unspecified order, which is the "static initialisation order fiasco": a global
in one file reads a global in another that has not been initialised yet, and
gets zeroes.

`constinit` asserts that a variable is initialised statically, so it cannot be
caught by that. It does **not** make the variable `const`:

```cpp run title="Initialised by the compiler, mutable by the program"
#include <iostream>

constexpr int slots_for(int workers) { return workers * 4; }

constinit int budget = slots_for(16);   // computed before the program starts

int main() {
    std::cout << "start: " << budget << '\n';
    budget -= 10;                       // legal: constinit is not const
    std::cout << "after: " << budget << '\n';
}
```

Give it an initialiser the compiler cannot evaluate and it says so:

```cpp run expect-error title="constinit rejects a startup computation"
#include <cstdlib>

int roll() { return std::rand(); }

constinit int budget = roll();

int main() { return budget; }
```

> error: 'constinit' variable 'budget' does not have a constant initializer

Compare the three at a glance:

| Keyword | Applies to | Guarantees |
|---|---|---|
| `constexpr` | function | *may* be evaluated at compile time |
| `constexpr` | variable | *is* initialised at compile time, and is `const` |
| `consteval` | function | *must* be evaluated at compile time |
| `constinit` | variable | *is* initialised at compile time, and is **not** `const` |

The variable forms differ in one letter of intent: `constexpr` for a value
nobody may change, `constinit` for a mutable global you want initialised safely.

## `static_assert` is a comment the compiler checks

A comment saying "this struct must stay 8 bytes — we memcpy it onto the wire"
is true on the day it is written and unverified forever after. A
`static_assert` is the same sentence, enforced.

```cpp run title="Assumptions that cannot rot"
#include <cstdint>
#include <iostream>
#include <type_traits>

struct Packet {
    std::uint32_t id;
    std::uint16_t length;
    std::uint16_t flags;
};

static_assert(sizeof(Packet) == 8,
              "Packet is written to the wire byte-for-byte; changing its size breaks the protocol");
static_assert(std::is_trivially_copyable_v<Packet>,
              "Packet is memcpy'd into the send buffer");
static_assert(alignof(Packet) == 4);

int main() {
    std::cout << "Packet is " << sizeof(Packet) << " bytes, aligned to "
              << alignof(Packet) << '\n';
}
```

Add a `std::string` member to `Packet` and the build stops with your sentence,
at the line that broke it, rather than with a corrupted packet on a customer's
network six months later. `static_assert` costs nothing at run time and is not
affected by `NDEBUG` — unlike `assert`, it is not a check that can be turned
off, because there is nothing to turn off.

:::tip
The best `static_assert`s are the ones that encode a decision you would
otherwise write in a comment: a size, an alignment, a trait a template depends
on, a table's length matching an enum's count. If you catch yourself writing
"must" in a comment, try writing it as an assertion instead.
:::

## Check yourself

:::quiz
{
  "question": "A `constexpr` function is called with an argument that is a plain runtime `int`. What happens?",
  "options": [
    { "text": "A compile error — constexpr functions require constant arguments", "why": "That is `consteval`. A `constexpr` function is perfectly callable with runtime arguments." },
    { "text": "It runs at run time, like any ordinary function", "correct": true, "why": "`constexpr` grants permission to run at compile time; it does not require it. Only a context demanding a constant forces the issue." },
    { "text": "It runs at compile time and the result is baked in", "why": "It cannot: the argument's value does not exist until the program runs." },
    { "text": "It runs at compile time only when optimisations are enabled", "why": "Constant evaluation is a language rule, not an optimisation. `-O0` and `-O3` agree about what is a constant expression." }
  ]
}
:::

:::quiz
{
  "question": "Why does `constexpr std::vector<int> v = {1, 2, 3};` fail to compile in C++20, when a `std::vector` inside a constexpr function is fine?",
  "options": [
    { "text": "`std::vector` is not constexpr-enabled in C++20", "why": "It is — that is exactly why the sieve example can allocate one. `std::string` gained the same support in the same standard." },
    { "text": "The allocation would have to outlive constant evaluation, and the compiler's heap does not exist at run time", "correct": true, "why": "Transient allocation: memory allocated during constant evaluation must be freed before it ends. A constexpr variable would hold a pointer into a heap that no longer exists." },
    { "text": "Braced initialiser lists cannot be used in constant expressions", "why": "They can. The initialiser is not the problem; the surviving allocation is." },
    { "text": "`constexpr` variables may only have scalar types", "why": "Any literal type works — `std::array`, user-defined structs, and anything with a constexpr destructor." }
  ]
}
:::

## Practice

:::exercise constexpr-sieve

:::exercise compile-time-hex

:::recap
- `constexpr` on a function is permission to run in the compiler, not a promise;
  `constexpr` on a variable, `static_assert`, and template arguments are what
  actually force compile-time evaluation.
- `std::is_constant_evaluated()` reports which environment you are in — with a
  plain `if`, never `if constexpr`.
- Since C++20 a constant evaluation may loop, mutate, and allocate. What it may
  not do is let an allocation escape, so return an `std::array`, not a
  `std::vector`.
- `consteval` removes the run-time fallback: every call must be a constant, and
  a `throw` on a bad input becomes a compile error at the call site.
- `constinit` is about initialisation *order*, not constness — it rules out the
  static initialisation order fiasco for a mutable global.
- `static_assert` turns a comment about an assumption into a check that fails
  the build the day the assumption stops being true.
:::
