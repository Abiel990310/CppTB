---
title: "Invariants and assertions"
navTitle: "Invariants and assertions"
summary: >-
  Stating what must always be true, and checking it.
objectives:
  - Identify a class invariant and where it can break
  - Use assert appropriately in debug builds
  - Explain the difference between a precondition and an invariant
status: complete
standard: c++20
requires: [debugging, structs-and-classes]
---

Chapter 3.1 introduced invariants as the reason `private` exists. This chapter
is about making them explicit — writing them down, checking them, and knowing
which kind of check belongs where.

## Three kinds of condition

They are easy to confuse and they belong in different places.

- A **precondition** is what a function requires of its caller. `pop()` requires
  a non-empty stack. Violating it is the *caller's* bug.
- A **postcondition** is what a function promises in return. `push()` promises
  the size grew by one. Violating it is the *function's* bug.
- An **invariant** is what is always true of an object between operations. A
  `Fraction` always has a non-zero denominator. Violating it means some
  operation left the object broken.

```cpp run title="All three, made explicit" std=c++20
#include <cassert>
#include <iostream>
#include <vector>

class Stack {
public:
    void push(int value) {
        const std::size_t before = items_.size();

        items_.push_back(value);

        assert(items_.size() == before + 1 && "postcondition: size grew by one");
        assert(invariant());
    }

    int pop() {
        assert(!items_.empty() && "precondition: pop on a non-empty stack");

        const int value = items_.back();
        items_.pop_back();

        assert(invariant());
        return value;
    }

    std::size_t size() const { return items_.size(); }

private:
    // The invariant: capacity is always at least size, and size is consistent.
    bool invariant() const { return items_.capacity() >= items_.size(); }

    std::vector<int> items_;
};

int main() {
    Stack s;
    s.push(1);
    s.push(2);
    std::cout << "popped " << s.pop() << ", size now " << s.size() << '\n';
}
```

Writing `assert(condition && "message")` is a small trick worth knowing: the
string is always true, so it does not change the test, and it appears in the
failure output — turning `assertion 'items_.size() == before + 1' failed` into
something that says what was meant.

## assert, and what it is for

`assert` from `<cassert>` aborts when its condition is false. It is compiled out
entirely when `NDEBUG` is defined:

```cpp run title="What NDEBUG does" std=c++20
#include <cassert>
#include <iostream>

int main() {
#ifdef NDEBUG
    std::cout << "NDEBUG is defined: assertions are compiled out\n";
#else
    std::cout << "NDEBUG is not defined: assertions are active\n";
#endif

    int value = 5;
    assert(value > 0 && "value must be positive");
    std::cout << "value is " << value << '\n';
}
```

That behaviour decides what `assert` is for. It checks things that **should be
impossible** — programming errors, broken invariants, violated preconditions
inside your own code. It must never check something that can legitimately
happen at run time.

:::warning
Never put a side effect inside an `assert`. It disappears in release builds, and
the program silently changes behaviour:

```cpp
assert(items_.erase(key) == 1);   // in release, the erase never happens
```

Write the operation first and assert on its result.
:::

:::pitfall
`assert` is also the wrong tool for anything derived from input, files, the
network, or a user. Those failures are not impossible — they are expected, and
they need a real check that survives into release. Chapter 6.2's return-based
errors are for that. The test: *could this condition be false in a correct
program given hostile input?* If yes, it is not an assertion.
:::

## static_assert: checking at compile time

When the condition is knowable at compile time, check it there — the cost is
zero and the failure arrives before the program exists:

```cpp run title="Compile-time checks" std=c++20
#include <cstdint>
#include <iostream>
#include <type_traits>

template <class T>
struct Buffer {
    static_assert(std::is_trivially_copyable_v<T>,
                  "Buffer requires a trivially copyable element type");
    T data[16];
};

int main() {
    // The layout assumptions this code depends on, stated and enforced.
    static_assert(sizeof(int) == 4, "this code assumes 32-bit int");
    static_assert(sizeof(std::int64_t) == 8);

    Buffer<int> ok;
    ok.data[0] = 1;
    std::cout << "Buffer<int> is fine: " << ok.data[0] << '\n';

    // Buffer<std::string> would fail to compile with the message above.
    std::cout << "is_trivially_copyable<std::string>: " << std::boolalpha
              << std::is_trivially_copyable_v<std::string> << '\n';
}
```

`static_assert` never reaches run time, never costs anything, and cannot be
disabled by `NDEBUG`. Prefer it whenever the condition is a compile-time one —
Chapter 5.4's concepts are the more expressive version of the same idea.

```cpp run expect-error title="A static_assert doing its job"
#include <type_traits>
#include <string>

template <class T>
struct Buffer {
    static_assert(std::is_trivially_copyable_v<T>,
                  "Buffer requires a trivially copyable element type");
    T data[16];
};

int main() {
    Buffer<std::string> bad;      // fails here, with that message
    (void)bad;
}
```

## Checking an invariant in one place

An invariant that is checked in five places will eventually be checked in four.
Give it a name:

```cpp run title="One function, called from every mutator" std=c++20
#include <cassert>
#include <iostream>
#include <numeric>
#include <stdexcept>

class Fraction {
public:
    Fraction(int numerator, int denominator)
        : numerator_(numerator), denominator_(denominator) {
        if (denominator_ == 0) throw std::invalid_argument("zero denominator");
        normalise();
        assert(invariant());
    }

    Fraction& operator*=(const Fraction& other) {
        numerator_ *= other.numerator_;
        denominator_ *= other.denominator_;
        normalise();
        assert(invariant());          // every mutator ends the same way
        return *this;
    }

    int numerator() const { return numerator_; }
    int denominator() const { return denominator_; }

private:
    // Written once, in the language of the class.
    bool invariant() const {
        return denominator_ > 0 && std::gcd(numerator_, denominator_) == 1;
    }

    void normalise() {
        if (denominator_ < 0) { numerator_ = -numerator_; denominator_ = -denominator_; }
        const int divisor = std::gcd(numerator_, denominator_);
        if (divisor > 1) { numerator_ /= divisor; denominator_ /= divisor; }
    }

    int numerator_;
    int denominator_;
};

int main() {
    Fraction half{2, 4};
    std::cout << half.numerator() << '/' << half.denominator() << '\n';

    Fraction third{1, 3};
    half *= third;
    std::cout << half.numerator() << '/' << half.denominator() << '\n';
}
```

Note where the invariant is checked: at the **end of every operation that
modifies**, and at the end of construction. Those are the only points where it
can newly be violated. Const member functions cannot break it, so they need no
check.

Note also what is *not* an assertion: the zero denominator throws, because it
comes from the caller's argument and is a legitimate run-time failure. The
`assert(invariant())` afterwards checks that *the class's own logic* restored
consistency — a different question, and the one `assert` is for.

## Invariants you cannot check cheaply

Some invariants are expensive — "this vector is sorted" is O(n) to verify. The
usual compromise is to check them only in a dedicated debug mode:

```cpp run title="An expensive check, behind a switch" std=c++20
#include <algorithm>
#include <cassert>
#include <iostream>
#include <vector>

// Define CPPTB_EXPENSIVE_CHECKS to enable O(n) invariant verification.
#ifdef CPPTB_EXPENSIVE_CHECKS
  #define EXPENSIVE_ASSERT(x) assert(x)
#else
  #define EXPENSIVE_ASSERT(x) ((void)0)
#endif

class SortedList {
public:
    void insert(int value) {
        items_.insert(std::ranges::upper_bound(items_, value), value);
        EXPENSIVE_ASSERT(std::ranges::is_sorted(items_));
    }

    std::size_t size() const { return items_.size(); }
    int at(std::size_t i) const { return items_[i]; }

private:
    std::vector<int> items_;
};

int main() {
    SortedList list;
    for (int v : {5, 1, 9, 3}) list.insert(v);

    for (std::size_t i = 0; i < list.size(); ++i) std::cout << list.at(i) << ' ';
    std::cout << '\n';
}
```

The `(void)0` in the disabled branch keeps the macro usable as a statement and
avoids a warning about an empty expression.

## Writing them down even when you cannot check

Not every invariant is machine-checkable. "The `parent_` pointer of every child
points back at this node" may be too expensive or too awkward to verify, and it
is still worth stating in a comment next to the members:

```cpp
private:
    // Invariant: children_ is sorted by id, and every child's parent_ == this.
    std::vector<Node*> children_;
```

A stated invariant is a contract a future reader can check by inspection, and
the first thing to re-read when something is behaving impossibly. An unstated
one exists only in the head of whoever wrote the class.

## Check yourself

:::quiz
{
  "question": "Which of these belongs in an `assert` rather than a real run-time check?",
  "options": [
    { "text": "That a filename supplied by the user names an existing file", "why": "That can be false in a correct program with ordinary input. It needs a check that survives into release, and an error the caller can act on." },
    { "text": "That a private helper was called with an index its caller already validated", "correct": true, "why": "It should be impossible if the class's own logic is right, and if it is wrong you want to know during development. That is exactly assert's job." },
    { "text": "That a network response parsed successfully", "why": "Hostile or truncated input is expected, not impossible. Asserting on it means a release build proceeds with garbage." },
    { "text": "That an allocation succeeded", "why": "Allocation failure is a real run-time condition; new throws bad_alloc for it. Asserting would remove the check in exactly the build that runs out of memory." }
  ]
}
:::

:::quiz
{
  "question": "Why is `assert(list.erase(item) == 1);` a bug?",
  "options": [
    { "text": "erase returns void, so it does not compile", "why": "The count-returning overload exists on associative containers. It compiles, which is what makes the bug reachable." },
    { "text": "The whole expression is compiled out under NDEBUG, so the erase never happens in release builds", "correct": true, "why": "assert removes its argument entirely. A side effect placed inside it silently disappears in exactly the build you ship. Do the work first, then assert on the result." },
    { "text": "assert cannot take an expression returning a value", "why": "It takes any expression convertible to bool. The problem is not the type, it is the disappearance." },
    { "text": "erase might throw, and assert cannot handle exceptions", "why": "That is unrelated to how assert works, and erase on these containers does not throw for a missing key." }
  ]
}
:::

## Practice

:::exercise class-invariant

:::recap
- A **precondition** is the caller's obligation, a **postcondition** the
  function's promise, an **invariant** what holds between operations.
- `assert` checks the impossible — programming errors — and is compiled out
  under `NDEBUG`. Never assert on input, files, the network, or anything a
  correct program could see fail.
- Never put a side effect inside an `assert`; it vanishes in release.
- `assert(cond && "message")` puts an explanation in the failure output.
- Use `static_assert` whenever the condition is a compile-time one: free, and it
  cannot be disabled.
- Write the invariant as one named function and call it at the end of every
  mutator and constructor. Const functions cannot break it.
- Put expensive checks behind their own macro, and write down the invariants you
  cannot check at all.
:::
