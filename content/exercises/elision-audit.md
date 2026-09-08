---
id: elision-audit
title: "Four returns, zero unnecessary work"
difficulty: core
chapter: copies-and-moves
topics: [performance, moving, elision, returns]
check: unit
standard: c++20
---

Four functions that return a `Probe` by value. Every one of them does more work
than it needs to, and the checks count exactly how much.

Hit these targets, without changing any function's signature or what it returns:

| Function | copies | moves |
|---|---|---|
| `make_temporary()` | 0 | 0 |
| `make_local()` | 0 | 0 |
| `choose(first)` | 0 | 1 |
| `pass_through(p)` | 0 | 1 |

Two of them can be made completely free. The other two cannot, and knowing
which is which is the exercise.

## Starter
```cpp
#include <string>
#include <utility>

// --- given, do not change ---------------------------------------------
int copies = 0;
int moves = 0;

struct Probe {
    std::string label;
    explicit Probe(std::string l) : label(std::move(l)) {}
    Probe(const Probe& other) : label(other.label) { ++copies; }
    Probe(Probe&& other) noexcept : label(std::move(other.label)) { ++moves; }
};
// ----------------------------------------------------------------------

Probe make_temporary() {
    Probe temporary{"temporary"};
    return Probe{temporary};
}

Probe make_local() {
    Probe result{"local"};
    return std::move(result);
}

Probe choose(bool first) {
    Probe a{"a"};
    Probe b{"b"};
    return first ? a : b;
}

Probe pass_through(Probe p) {
    Probe copy = p;
    return copy;
}
```

## Tests
```cpp
copies = 0; moves = 0;
Probe t = make_temporary();
CHECK_EQ(t.label, std::string("temporary"));
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 0);

copies = 0; moves = 0;
Probe l = make_local();
CHECK_EQ(l.label, std::string("local"));
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 0);

copies = 0; moves = 0;
Probe c1 = choose(true);
CHECK_EQ(c1.label, std::string("a"));
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 1);

copies = 0; moves = 0;
Probe c2 = choose(false);
CHECK_EQ(c2.label, std::string("b"));
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 1);

copies = 0; moves = 0;
Probe p = pass_through(Probe{"passed"});
CHECK_EQ(p.label, std::string("passed"));
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 1);
```

## Hints
- `make_temporary` builds a local and then copy-constructs a second `Probe` from it. Return the temporary directly and guaranteed elision does the rest: `return Probe{"temporary"};`.
- `make_local` has the `std::move` habit. Remove it. NRVO applies to a returned *name* and not to the result of a cast, so the `std::move` is what is costing the move.
- `choose` returns a conditional expression, which is not the name of a local — so no NRVO and no implicit move, and you get a copy. This is the one place `std::move` on a return is a fix rather than a mistake.
- `choose` cannot reach zero. Two locals exist and only one can be constructed in the caller's storage, so a move is the floor.
- `pass_through` copies its parameter into a local for no reason. A parameter can never be elided — the caller built it — but returning it by name gets the implicit move, which is the floor here too.
- Compile with `-Wall` and read the warnings before you start. Two of these four are diagnosed by name.

## Solution
```cpp
#include <string>
#include <utility>

int copies = 0;
int moves = 0;

struct Probe {
    std::string label;
    explicit Probe(std::string l) : label(std::move(l)) {}
    Probe(const Probe& other) : label(other.label) { ++copies; }
    Probe(Probe&& other) noexcept : label(std::move(other.label)) { ++moves; }
};

Probe make_temporary() {
    return Probe{"temporary"};              // guaranteed elision: no object to copy
}

Probe make_local() {
    Probe result{"local"};
    return result;                          // NRVO: built in the caller's storage
}

Probe choose(bool first) {
    Probe a{"a"};
    Probe b{"b"};
    return first ? std::move(a) : std::move(b);   // not a name, so ask for the move
}

Probe pass_through(Probe p) {
    return p;                               // implicit move; a parameter cannot be elided
}
```

## Notes
The four cases are the whole rule set, and they do not all point the same way.

`make_temporary` is guaranteed by the language since C++17. `Probe{"temporary"}`
in a return statement is a prvalue — a recipe, not an object — and it is carried
out directly in the caller's storage. Nothing is constructed twice, so there is
nothing to elide. The starter defeated it by building a local first and then
copy-constructing a second `Probe` from it, which is a real copy of a real
object and no rule can remove it.

`make_local` is NRVO, which is *permitted* rather than required — GCC and Clang
do it, including at `-O0`, and the checks above rely on that. Adding
`std::move` disqualifies it, because the optimisation applies to a returned name
and `std::move(result)` is a function call. This is the case GCC diagnoses as
`-Wpessimizing-move`, with the note "remove 'std::move' call".

`choose` is the exception that makes the rule memorable. `first ? a : b` is an
expression, not the name of a local, so the compiler applies neither NRVO nor
the implicit move and falls back to a copy — silently, with no warning. Writing
`std::move` on each branch turns the copy into a move, and a move is the best
available: two objects exist and only one can occupy the caller's storage.

`pass_through` shows that "no elision" and "no move" are different claims. A
parameter is constructed by the caller before the function starts, so it can
never be built in the return slot. But the return operand names a local object,
so the implicit move applies and the string's buffer is transferred rather than
copied. Writing `return std::move(p);` here would produce the same count and a
`-Wredundant-move` warning — harmless, but noise.

One honest caveat, since this problem grades on exact counts: only the
`make_temporary` result is guaranteed by the standard. The other three depend on
NRVO and the implicit move, which every mainstream compiler implements. Rely on
that for speed; never for correctness.
