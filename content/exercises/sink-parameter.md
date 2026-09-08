---
id: sink-parameter
title: "Stop copying into the member"
difficulty: core
chapter: moving
topics: [moving, functions, performance]
check: unit
standard: c++20
---

`Message` stores a body string. Its constructor and `set_body` both take a
`const std::string&` and copy it into the member — even when the caller passes a
temporary that is about to be destroyed.

Change both so that a caller passing a temporary gets a move, while a caller
passing a named variable still gets a copy. The checks count copies and moves,
so both cases are tested.

## Starter
```cpp
#include <string>
#include <utility>

inline int copies = 0;
inline int moves = 0;

struct Counted {
    std::string text;
    Counted() = default;
    Counted(const char* s) : text(s) {}
    Counted(const Counted& o) : text(o.text) { ++copies; }
    Counted(Counted&& o) noexcept : text(std::move(o.text)) { ++moves; }
    Counted& operator=(const Counted& o) { text = o.text; ++copies; return *this; }
    Counted& operator=(Counted&& o) noexcept { text = std::move(o.text); ++moves; return *this; }
};

class Message {
public:
    explicit Message(const Counted& body) : body_(body) {}

    void set_body(const Counted& body) { body_ = body; }

    const Counted& body() const { return body_; }

private:
    Counted body_;
};
```

## Tests
```cpp
copies = 0; moves = 0;

// A named variable must still be copied — the caller keeps using it.
Counted named{"hello"};
Message a{named};
CHECK_EQ(copies, 1);
CHECK_EQ(moves, 1);
CHECK_EQ(a.body().text, std::string("hello"));
CHECK_EQ(named.text, std::string("hello"));

// A temporary must be moved, never copied.
copies = 0; moves = 0;
Message b{Counted{"temporary"}};
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 1);
CHECK_EQ(b.body().text, std::string("temporary"));

// The same for the setter.
copies = 0; moves = 0;
b.set_body(Counted{"replaced"});
CHECK_EQ(copies, 0);
CHECK_EQ(moves, 1);
CHECK_EQ(b.body().text, std::string("replaced"));

copies = 0; moves = 0;
b.set_body(named);
CHECK_EQ(copies, 1);
CHECK_EQ(moves, 1);
```

## Hints
- Take the parameter **by value**, then `std::move` it into the member. This is the "sink parameter" idiom.
- By value means the parameter is constructed from the argument: a copy for an lvalue, a move for an rvalue. Then one further move puts it into the member.
- A named argument therefore costs 1 copy (into the parameter) + 1 move (into the member).
- A temporary costs a single move. Since C++17 the temporary *is* the parameter — it is constructed directly in place, so there is no separate move into the parameter to pay for.
- Forgetting the `std::move` on the way into the member costs an extra copy, which the checks will catch.

## Solution
```cpp
#include <string>
#include <utility>

inline int copies = 0;
inline int moves = 0;

struct Counted {
    std::string text;
    Counted() = default;
    Counted(const char* s) : text(s) {}
    Counted(const Counted& o) : text(o.text) { ++copies; }
    Counted(Counted&& o) noexcept : text(std::move(o.text)) { ++moves; }
    Counted& operator=(const Counted& o) { text = o.text; ++copies; return *this; }
    Counted& operator=(Counted&& o) noexcept { text = std::move(o.text); ++moves; return *this; }
};

class Message {
public:
    explicit Message(Counted body) : body_(std::move(body)) {}

    void set_body(Counted body) { body_ = std::move(body); }

    const Counted& body() const { return body_; }

private:
    Counted body_;
};
```

## Notes
Look closely at the temporary case: one move, not two. C++17's guaranteed copy
elision means `Counted{"temporary"}` does not create an object that is then
moved into the parameter — the parameter *is* that object, constructed directly
where it needs to be. The only transfer left is the `std::move` into the member.

So a temporary costs one move, and a named argument costs one copy plus one
move. Against hand-writing two overloads — one `const T&`, one `T&&` — the sink
parameter costs exactly one extra move for the lvalue case. In exchange you
write one function instead of two, and where a move is cheap that trade is
almost always right.

It is *not* right when the move is expensive or does not exist. For a type with
no move constructor, taking by value means two copies where `const T&` would
have made one. `std::array<int, 10000>` is the classic example: it has no cheap
move, because there is no pointer to steal.
