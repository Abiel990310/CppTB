---
title: "Copies, moves, and elision"
navTitle: "Copies and elision"
summary: >-
  Where copies actually happen, and how to stop paying for them.
objectives:
  - Explain guaranteed copy elision and NRVO
  - Find an unnecessary copy in a code review
  - Explain why returning std::move(x) can be worse than returning x
status: complete
standard: c++20
requires: [cache-and-layout]
---

"Returning by value is expensive" was true in 1998, has been false since 2017,
and is still repeated. Meanwhile the copies that actually cost you something are
in range-for loops and parameter lists, where nobody looks.

The only way to settle any of this is to count. Every sample in this chapter
uses a type that announces what happens to it — and prints the same thing at
`-O0` and `-O2`, because elision is a rule of the language rather than an
optimisation.

```cpp run title="What returning by value actually costs"
#include <cstdio>
#include <string>
#include <utility>

struct Loud {
    std::string name;
    explicit Loud(const char* n) : name(n) { std::printf("  construct\n"); }
    Loud(const Loud& other) : name(other.name) { std::printf("  COPY\n"); }
    Loud(Loud&& other) noexcept : name(std::move(other.name)) { std::printf("  move\n"); }
};

Loud make_temporary() {
    return Loud{"temporary"};          // a prvalue
}

Loud make_named() {
    Loud result{"named"};
    return result;                     // a named local
}

int main() {
    std::printf("returning a temporary:\n");
    Loud a = make_temporary();

    std::printf("returning a named local:\n");
    Loud b = make_named();

    std::printf("\n%s and %s\n", a.name.c_str(), b.name.c_str());
}
```

One construction each. No copy, no move, no temporary. The two cases get there
by different rules, and the difference matters.

## Guaranteed elision: the temporary never existed

Since C++17, `return Loud{"temporary"};` does not create an object and then
copy it. A prvalue is not an object at all — it is a *recipe for initialising
one*, and the recipe is not run until there is somewhere to put the result. That
somewhere is `a`, in `main`'s stack frame. `Loud{"temporary"}` constructs
directly into it.

This is not an optimisation the compiler is allowed to make. It is what the
language says the code means, so it happens at every optimisation level, and it
works even for a type whose copy and move constructors are **deleted**:

```cpp run title="Elision for a type that cannot be copied or moved"
#include <cstdio>
#include <string>

struct Immovable {
    std::string label;
    explicit Immovable(const char* l) : label(l) {}
    Immovable(const Immovable&) = delete;
    Immovable(Immovable&&) = delete;
};

Immovable make() {
    return Immovable{"cannot be copied, cannot be moved"};
}

int main() {
    Immovable value = make();          // still fine
    std::printf("%s\n", value.label.c_str());
}
```

Before C++17 this did not compile: the return required an accessible copy or
move constructor even when the compiler intended to elide the call. Now there is
no call to elide.

## NRVO: allowed, not guaranteed

`make_named` is a different rule. `result` is a real object with a name and an
address, so eliding it means the compiler decides to construct `result`
*directly in the caller's storage* rather than locally. That is the **named
return value optimisation**, and unlike the prvalue case it is **permitted, not
required**.

GCC and Clang do it, including at `-O0`. MSVC does it in optimised builds. But
the standard does not promise it, so:

- Never write code whose *correctness* depends on NRVO happening. A constructor
  or destructor side effect you are counting on may or may not run.
- Do rely on it for performance. It fires in the overwhelming majority of real
  functions: one local, returned on every path.

Two things stop it, and both are worth recognising.

```cpp run title="The two shapes NRVO cannot handle"
#include <cstdio>
#include <string>
#include <utility>

struct Loud {
    std::string name;
    explicit Loud(const char* n) : name(n) { std::printf("  construct %s\n", n); }
    Loud(const Loud& other) : name(other.name) { std::printf("  COPY\n"); }
    Loud(Loud&& other) noexcept : name(std::move(other.name)) { std::printf("  move\n"); }
};

Loud two_candidates(bool first) {
    Loud a{"a"};
    Loud b{"b"};
    return first ? a : b;              // not a name — an expression
}

Loud two_returns(bool first) {
    Loud a{"a"};
    Loud b{"b"};
    if (first) return a;               // each return names one local
    return b;
}

int main() {
    std::printf("return first ? a : b;\n");
    Loud x = two_candidates(true);

    std::printf("\nif (first) return a; return b;\n");
    Loud y = two_returns(true);

    std::printf("\n%s %s\n", x.name.c_str(), y.name.c_str());
}
```

The first prints **COPY**. The second prints **move**. The difference is one
sentence of the standard: an implicit move — treating the returned object as an
rvalue — applies when the return statement's operand is *the name of a local
object*. In `return first ? a : b;` the operand is a conditional expression, not
a name, so neither NRVO nor the implicit move applies and you get a copy.

`two_returns` cannot use NRVO either — the compiler would have to pick one local
to construct in the caller's storage, and there are two — but the operand *is* a
name, so the implicit move kicks in. A move instead of nothing, rather than a
copy instead of nothing.

:::tip
This is the one place where writing `std::move` on a return statement is
correct: `return first ? std::move(a) : std::move(b);` turns that copy into a
move. The rule is not "never `std::move` a return" — it is "never `std::move` a
return that is already just a name".
:::

## `return std::move(x)` is a pessimisation

Which brings us to the habit this chapter exists to break.

```cpp run title="The move that costs you the elision"
#include <cstdio>
#include <string>
#include <utility>

struct Loud {
    std::string name;
    explicit Loud(const char* n) : name(n) { std::printf("  construct\n"); }
    Loud(const Loud&) { std::printf("  COPY\n"); }
    Loud(Loud&&) noexcept { std::printf("  move\n"); }
};

Loud plain() {
    Loud result{"plain"};
    return result;                     // NRVO: constructed in the caller
}

Loud helpful() {
    Loud result{"helpful"};
    return std::move(result);          // "helping" the compiler
}

int main() {
    std::printf("return result;\n");
    Loud a = plain();
    std::printf("return std::move(result);\n");
    Loud b = helpful();
    (void)a; (void)b;
}
```

`plain` constructs once. `helpful` constructs and then moves. The `std::move`
made the code slower by one move, and the reason is mechanical: NRVO requires
the returned expression to name a local object, and `std::move(result)` is a
function call returning `Loud&&`, not a name. Naming the object was the
qualification; the cast disqualified it.

GCC and Clang both diagnose this without being asked:

```
warning: moving a local object in a return statement prevents copy elision
  [-Wpessimizing-move]
note: remove 'std::move' call
```

There is a milder sibling. `std::string f(std::string s) { return std::move(s); }`
does not lose an elision — a parameter can never be elided, because the caller
built it — so the `std::move` there is merely *redundant*, since the implicit
move already applies. GCC calls that one `-Wredundant-move`. Both warnings are
in `-Wall`; both mean "delete these nine characters".

## Finding the copies that are real

None of the above is where your program actually loses time. These are.

```cpp run title="Four copies nobody meant to write"
#include <cstdio>
#include <map>
#include <string>
#include <vector>

int copies = 0;

struct Payload {
    std::string data;
    Payload() = default;
    explicit Payload(std::string d) : data(std::move(d)) {}
    Payload(const Payload& o) : data(o.data) { ++copies; }
    Payload(Payload&&) noexcept = default;
    Payload& operator=(const Payload&) = default;
    Payload& operator=(Payload&&) noexcept = default;
};

std::size_t total_size_bad(std::vector<Payload> items) {      // 1: by value
    std::size_t n = 0;
    for (Payload item : items) n += item.data.size();         // 2: by value
    return n;
}

std::size_t total_size_good(const std::vector<Payload>& items) {
    std::size_t n = 0;
    for (const Payload& item : items) n += item.data.size();
    return n;
}

int main() {
    std::vector<Payload> items;
    for (int i = 0; i < 5; ++i) items.emplace_back(std::string(64, 'x'));

    // Note the two statements: reading `copies` in the same printf call that
    // makes the call would read it before the call ran. Chapter 5.6.
    copies = 0;
    std::size_t bad_total = total_size_bad(items);
    std::printf("by value:      %zu bytes, %d copies\n", bad_total, copies);

    copies = 0;
    std::size_t good_total = total_size_good(items);
    std::printf("by reference:  %zu bytes, %d copies\n", good_total, copies);

    // 3: operator[] on a map default-constructs; at() does not.
    std::map<std::string, Payload> index;
    index.emplace("key", Payload{std::string(64, 'y')});

    copies = 0;
    Payload fetched = index["key"];                            // copies out
    int by_value = copies;

    copies = 0;
    const Payload& viewed = index.at("key");                   // no copy
    int by_reference = copies;

    std::printf("map lookup by value:     %d copies\n", by_value);
    std::printf("map lookup by reference: %d copies\n", by_reference);
    (void)fetched; (void)viewed;
}
```

Ten copies against zero, for one function called once with five elements. The
by-value parameter copies the whole vector, and the by-value range-for copies
every element again.

The review checklist, in rough order of how often it finds something:

| Look for | Ask |
|---|---|
| `for (T x : container)` | should it be `const T&`? |
| a parameter taken as `T` | is it stored, or only read? Only read → `const T&` |
| a parameter taken as `const std::string&` | is a `std::string_view` enough? |
| `auto x = expr;` | did `expr` return a reference you just copied? `const auto&` |
| `map[key]` used to read | `at` or `find` — `operator[]` inserts, and cannot be `const` |
| `push_back(T{...})` | `emplace_back(...)` builds in place |
| a lambda's `[=]` | which captures did you actually mean? |
| a `const T` return type | it blocks moves at every call site, for no benefit |

The last one deserves a word, because it was once recommended. `const Widget
make()` was advice for preventing `make() = x;`, back when returning by value
meant a copy. Today the `const` prevents the *move* instead: a `const Widget`
prvalue cannot initialise a `Widget` by moving, so every caller copies. Return
by plain value.

:::pitfall
`auto x = obj.items();` where `items()` returns `const std::vector<Item>&`.
`auto` deduces `std::vector<Item>` — the reference is stripped, exactly as
Chapter 5.3 said — and you have silently copied the whole vector. Write
`const auto&` when you mean to observe. This is the single most common
accidental copy in modern C++, precisely because `auto` looks like it is
avoiding a decision.
:::

## Check yourself

:::quiz
{
  "question": "Why does `return Widget{args...};` work for a type whose copy and move constructors are both deleted?",
  "options": [
    { "text": "Since C++17 a prvalue initialises the caller's object directly — there is no temporary, so there is no copy or move to elide", "correct": true, "why": "Guaranteed elision changed what the code *means*, not what the optimiser is allowed to do. That is why it works at -O0 and with deleted constructors." },
    { "text": "The compiler optimises the copy away at -O2", "why": "It happens at -O0 too, and an optimisation could not make a call to a deleted function legal." },
    { "text": "Deleted constructors are ignored for return statements", "why": "They are not ignored anywhere; there is simply no call to them here." },
    { "text": "The move constructor is implicitly regenerated", "why": "Deleting it deletes it. Nothing regenerates a deleted special member." }
  ]
}
:::

:::quiz
{
  "question": "`Widget f() { Widget w; return std::move(w); }` — what does the `std::move` do?",
  "options": [
    { "text": "It disqualifies the return from NRVO, so the function constructs and then moves instead of just constructing", "correct": true, "why": "NRVO requires the operand to name a local object. `std::move(w)` is a cast, not a name. GCC and Clang warn about this under -Wpessimizing-move." },
    { "text": "Nothing — it is redundant but harmless", "why": "That is the case for a *parameter*, where elision was impossible anyway. For a local it costs a move that would not have happened." },
    { "text": "It avoids a copy that would otherwise occur", "why": "Without it there is no copy: NRVO elides the construction entirely, and the implicit move is the fallback if NRVO does not apply." },
    { "text": "It is required for a move-only type", "why": "A move-only type returns fine by name — the implicit move applies, and NRVO usually removes even that." }
  ]
}
:::

## Practice

:::exercise elision-audit

:::exercise review-the-copies

:::recap
- A prvalue return has been copy-free since C++17 by *definition*, not by
  optimisation: it works at `-O0` and for types with deleted copy and move
  constructors.
- NRVO — eliding a *named* local — is permitted but not guaranteed. Rely on it
  for speed, never for correctness.
- The implicit move on return applies when the operand names a local object.
  `return cond ? a : b;` is not a name, so it copies; `std::move` there is a
  genuine fix.
- `return std::move(local);` disqualifies NRVO and costs a move.
  `-Wpessimizing-move` says so. On a parameter the same code is merely
  redundant: `-Wredundant-move`.
- A `const` return type blocks moves at every call site and buys nothing.
- The copies that cost real time are by-value parameters, by-value range-for
  loops, `auto` deducing away a reference, and `map[key]` used for reading.
:::
