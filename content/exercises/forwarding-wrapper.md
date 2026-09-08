---
id: forwarding-wrapper
title: "A factory that adds nothing"
difficulty: core
chapter: deduction
topics: [templates, deduction, moving, variadic]
check: unit
standard: c++20
---

`make<T>(args...)` is supposed to be a transparent factory: it constructs a `T`
from whatever it is handed, and costs exactly what calling `T`'s constructor
directly would have cost. The version below is not transparent — it takes every
argument by `const&`, so an argument that could have been moved gets copied
instead.

Rewrite `make` so that arguments arrive at `T`'s constructor with the value
category they had at the call site: temporaries move, named variables copy.

## Starter
```cpp
#include <string>
#include <utility>

inline int copies = 0;
inline int moves = 0;

struct Probe {
    std::string text;
    Probe() = default;
    Probe(const char* s) : text(s) {}
    Probe(const Probe& o) : text(o.text) { ++copies; }
    Probe(Probe&& o) noexcept : text(std::move(o.text)) { ++moves; }
};

struct Holder {
    Probe first;
    Probe second;
    Holder(Probe a, Probe b) : first(std::move(a)), second(std::move(b)) {}
};

template <class T, class... Args>
T make(const Args&... args) {
    return T(args...);
}
```

## Tests
```cpp
// Two temporaries: nothing may be copied.
copies = 0; moves = 0;
Holder from_temporaries = make<Holder>(Probe{"a"}, Probe{"b"});
CHECK_EQ(copies, 0);
CHECK_EQ(from_temporaries.first.text, std::string("a"));
CHECK_EQ(from_temporaries.second.text, std::string("b"));

// Two named variables: both must be copied, and both must survive intact.
Probe x{"x"};
Probe y{"y"};
copies = 0; moves = 0;
Holder from_lvalues = make<Holder>(x, y);
CHECK_EQ(copies, 2);
CHECK_EQ(x.text, std::string("x"));
CHECK_EQ(y.text, std::string("y"));
CHECK_EQ(from_lvalues.first.text, std::string("x"));

// Mixed: one copy for the named one, none for the temporary.
copies = 0; moves = 0;
Holder mixed = make<Holder>(x, Probe{"gone"});
CHECK_EQ(copies, 1);
CHECK_EQ(mixed.first.text, std::string("x"));
CHECK_EQ(mixed.second.text, std::string("gone"));

// A const named variable is still an lvalue: it must be copied, not moved.
const Probe frozen{"frozen"};
copies = 0; moves = 0;
Holder from_const = make<Holder>(frozen, frozen);
CHECK_EQ(copies, 2);
CHECK_EQ(moves, 2);
CHECK_EQ(from_const.first.text, std::string("frozen"));
```

## Hints
- The parameter pack needs to be a pack of **forwarding references**: `Args&&... args`, with `Args` deduced by this function template.
- `Args&&` is only a forwarding reference when `Args` is deduced right there. `const Args&&` is not one, and neither is `std::string&&`.
- Inside the body, `args` is a named variable, so it is an lvalue no matter what `Args` is. Restoring the original value category is exactly what `std::forward<Args>(args)...` does.
- The `...` goes after the whole pattern: `T(std::forward<Args>(args)...)` expands to `T(std::forward<A1>(a1), std::forward<A2>(a2))`.
- `std::move` would be wrong here — it would move out of the caller's named variables, which the checks catch by looking at `x.text` afterwards.

## Solution
```cpp
#include <string>
#include <utility>

inline int copies = 0;
inline int moves = 0;

struct Probe {
    std::string text;
    Probe() = default;
    Probe(const char* s) : text(s) {}
    Probe(const Probe& o) : text(o.text) { ++copies; }
    Probe(Probe&& o) noexcept : text(std::move(o.text)) { ++moves; }
};

struct Holder {
    Probe first;
    Probe second;
    Holder(Probe a, Probe b) : first(std::move(a)), second(std::move(b)) {}
};

template <class T, class... Args>
T make(Args&&... args) {
    return T(std::forward<Args>(args)...);
}
```

## Notes
Count the moves in the temporaries case and you get two, not zero. That is not
the wrapper's fault: `Holder`'s constructor takes its parameters by value and
moves them into the members, so one move per member is the floor. Calling
`Holder{Probe{"a"}, Probe{"b"}}` directly costs the same two. Transparent means
*adds nothing*, not *costs nothing*.

The `const` case is the one worth staring at. `frozen` is an lvalue of type
`const Probe`, so `Args` deduces to `const Probe&`, and `std::forward` hands the
constructor a `const Probe&`. Overload resolution picks the copy constructor,
because `Probe(Probe&&)` cannot bind a `const Probe&`. A moved-from `const`
object would be a contradiction, and the language quietly avoids it rather than
failing — which is why a stray `const` on a variable can silently turn a program
full of moves back into a program full of copies, with no diagnostic at all.
