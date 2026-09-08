---
id: fix-the-link
title: "Four ways to fail at link time"
difficulty: core
chapter: translation-units
topics: [linking, odr, declarations, compilation]
check: unit
standard: c++20
---

This file does not build. There are four separate problems, and each is a
different kind of declaration-versus-definition mistake:

1. A function that is declared and called but never defined.
2. A function defined twice.
3. A member function defined outside its class, but missing the class name — so
   it defines an unrelated free function, and the member stays undefined.
4. A declaration whose signature does not quite match its definition, so the two
   mangled names never meet.

Fix all four without changing what any function computes or how the checks call
them.

## Starter
```cpp
#include <cstddef>
#include <string>
#include <vector>

// 1. Declared, used below, but no definition anywhere in this file.
int checksum(const std::vector<int>& values);

// 2. Two definitions of the same function.
int doubled(int n) { return n * 2; }
int doubled(int n) { return n + n; }

class Counter {
public:
    explicit Counter(int start) : value_(start) {}
    void bump();
    int value() const;

private:
    int value_;
};

// 3. Missing the `Counter::` prefix — this defines a free function instead.
void bump() { }

int Counter::value() const { return value_; }

// 4. Declared taking `const std::string&`, defined taking `std::string`.
std::string shout(const std::string& text);

std::string shout(std::string text) {
    for (char& c : text) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return text;
}
```

## Tests
```cpp
std::vector<int> values{1, 2, 3, 4};
CHECK_EQ(checksum(values), 10);
CHECK_EQ(checksum({}), 0);
CHECK_EQ(checksum({7}), 7);

CHECK_EQ(doubled(5), 10);
CHECK_EQ(doubled(-3), -6);
CHECK_EQ(doubled(0), 0);

Counter counter{10};
CHECK_EQ(counter.value(), 10);
counter.bump();
counter.bump();
CHECK_EQ(counter.value(), 12);

const std::string quiet = "hello there";
CHECK_EQ(shout(quiet), std::string("HELLO THERE"));
CHECK_EQ(quiet, std::string("hello there"));   // the caller's string is unchanged
CHECK_EQ(shout(""), std::string(""));
```

## Hints
- `checksum` should return the sum of the values, and `0` for an empty vector. It needs a body; the declaration alone is a promise the linker cannot keep.
- Two definitions of `doubled` is a *compiler* error — "redefinition" — because both are in one translation unit. Delete one. They compute the same thing.
- `void bump() { }` at namespace scope is a perfectly legal free function that has nothing to do with `Counter`. The member needs `void Counter::bump()`, and a body that increments `value_`.
- For `shout`, decide which signature you want and make both the declaration and the definition say it. `const std::string&` is the better choice here: the function does not need its own copy of the argument... except that it modifies it.
- Read that last check again. `shout` must not modify the caller's string, and it does modify what it iterates over. So the parameter has to be a copy — which makes `std::string` by value the right signature, and the *declaration* the thing to change.
- `std::toupper` needs `<cctype>`.

## Solution
```cpp
#include <cctype>
#include <cstddef>
#include <string>
#include <vector>

// 1. Now defined.
int checksum(const std::vector<int>& values) {
    int total = 0;
    for (int v : values) total += v;
    return total;
}

// 2. One definition.
int doubled(int n) { return n * 2; }

class Counter {
public:
    explicit Counter(int start) : value_(start) {}
    void bump();
    int value() const;

private:
    int value_;
};

// 3. Qualified, so it defines the member rather than a free function.
void Counter::bump() { ++value_; }

int Counter::value() const { return value_; }

// 4. Declaration and definition now agree: by value, because the body mutates
//    the parameter and the caller's string must survive.
std::string shout(std::string text);

std::string shout(std::string text) {
    for (char& c : text) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return text;
}
```

## Notes
Four mistakes, and the compiler's opinion of them differs sharply — which is
the thing to take away.

Problem 2 is a **compile** error, and an obvious one: both definitions are in
the same translation unit, so the compiler sees the collision and says
"redefinition of 'int doubled(int)'". You cannot miss it.

Problems 1, 3 and 4 all compile perfectly and fail at **link** time with the
same message shape: `undefined reference to …`. In each case the compiler had a
declaration, believed it, and emitted a call to a symbol it assumed somebody
else would provide.

They are worth telling apart, because the fix differs:

- **1** is the honest case: nothing defines it. Write the body, or add the
  missing `.cpp` to the build.
- **3** is the sneaky one. `void bump()` is *valid code* — a free function that
  happens to do nothing. Nothing warns you that you meant a member. In a real
  project this usually happens when a class is renamed and one definition is
  missed.
- **4** is the one that wastes the most time, because the declaration and the
  definition look the same at a glance. `shout(const std::string&)` mangles to
  `_Z5shoutRKNSt7__cxx1112basic_stringIcEE…` and `shout(std::string)` to
  something quite different, so the call site and the body never meet. A missing
  `const`, a lost `&`, an `int` where the other says `long` — all produce this,
  and the error message shows only the one the *caller* wanted.

When an undefined reference names a function you are certain you defined, run
`nm -C` on both object files and compare the two signatures character by
character. The difference is always there.

One design point hiding in problem 4: which signature *should* `shout` have?
Chapter 7.5's checklist says a parameter that is only read should be
`const std::string&`. But this one is not only read — the body uppercases it in
place. Taking a reference and then modifying it would corrupt the caller's
string, which the check for `quiet` catches. Taking it by value gives the
function its own copy to mutate, and lets a caller passing a temporary move into
it instead of copying. By value is right here, and the declaration was the half
that was wrong.
