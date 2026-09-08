---
title: "Structs and classes"
navTitle: "Structs and classes"
summary: >-
  Grouping data, and deciding what the outside world may touch.
objectives:
  - Define a class with a clear public interface
  - Explain the only difference between struct and class
  - Choose what belongs in the interface and what does not
status: complete
standard: c++20
requires: [const, lifetime-and-scope]
---

Everything so far has used types the language gave you. This part is about
making your own — types that behave as well as `int` does: they can be copied,
compared, passed around, and cleaned up, and they cannot easily be misused.

The starting point is grouping related data under one name.

## An aggregate

```cpp run title="A struct is a group of members" std=c++20
#include <iostream>
#include <string>

struct Point {
    double x;
    double y;
};

int main() {
    Point origin{};              // both members zero-initialised
    Point p{3.0, 4.0};           // aggregate initialisation, in declaration order
    Point named{.x = 1.0, .y = 2.0};   // designated initialisers (C++20)

    std::cout << "p = (" << p.x << ", " << p.y << ")\n";
    std::cout << "origin = (" << origin.x << ", " << origin.y << ")\n";
    std::cout << "named.x = " << named.x << '\n';

    p.x = 10.0;                  // members are public: anyone may write them
    std::cout << "after p.x = 10: " << p.x << '\n';
}
```

`Point` is an *aggregate*: no private members, no user-declared constructors, so
you can initialise it with braces in declaration order. Designated initialisers
(`.x = 1.0`) arrived in C++20 and are worth using — they survive someone
reordering the members, and they document what each value means at the call
site.

:::pitfall
`Point p;` without braces leaves both members *uninitialised* for an aggregate
with no default member initialisers — the same trap as an uninitialised `int`.
`Point p{};` zero-initialises them. The two extra characters are worth typing
every time.
:::

You can give members default values, which fixes that trap at the source:

```cpp run title="Default member initialisers" std=c++20
#include <iostream>

struct Settings {
    int  retries = 3;
    bool verbose = false;
    double timeout = 1.5;
};

int main() {
    Settings a;                       // uses every default
    Settings b{5};                    // retries = 5, the rest defaulted
    Settings c{.verbose = true};      // only verbose overridden

    std::cout << a.retries << ' ' << b.retries << ' ' << c.verbose << '\n';
    std::cout << "c.timeout still " << c.timeout << '\n';
}
```

## The only difference between struct and class

`struct` members are public by default. `class` members are private by default.
That is the entire difference — everything else is identical.

```cpp run expect-error title="class defaults to private"
class Hidden {
    int value = 1;       // private, because this is a class
};

int main() {
    Hidden h;
    return h.value;      // error: 'int Hidden::value' is private
}
```

The convention almost everyone follows: use `struct` when the type is a plain
bundle of data with no invariant to maintain, and `class` when it has an
interface to protect. The compiler does not care; readers do.

## Why hide anything?

Because some combinations of member values are nonsense, and a type that can be
put into a nonsensical state will eventually be put into one.

```cpp run title="An invariant that nothing enforces" std=c++20
#include <iostream>

struct Fraction {
    int numerator;
    int denominator;

    double value() const { return static_cast<double>(numerator) / denominator; }
};

int main() {
    Fraction half{1, 2};
    std::cout << "1/2 = " << half.value() << '\n';

    half.denominator = 0;                    // nothing stops this
    std::cout << "1/0 = " << half.value() << '\n';
}
```

Dividing by zero in floating point gives `inf` rather than crashing, so the
program carries on with a nonsense value and fails somewhere far from the cause.

Make the invariant the type's responsibility:

```cpp run title="An invariant the type maintains" std=c++20
#include <iostream>
#include <numeric>
#include <stdexcept>

class Fraction {
public:
    Fraction(int numerator, int denominator)
        : numerator_(numerator), denominator_(denominator) {
        if (denominator_ == 0) {
            throw std::invalid_argument("a fraction cannot have a zero denominator");
        }
        normalise();
    }

    int numerator() const { return numerator_; }
    int denominator() const { return denominator_; }
    double value() const { return static_cast<double>(numerator_) / denominator_; }

private:
    void normalise() {
        if (denominator_ < 0) {          // keep the sign on the numerator
            numerator_ = -numerator_;
            denominator_ = -denominator_;
        }
        const int divisor = std::gcd(numerator_, denominator_);
        if (divisor > 1) {
            numerator_ /= divisor;
            denominator_ /= divisor;
        }
    }

    int numerator_;
    int denominator_;
};

int main() {
    Fraction half{2, 4};
    std::cout << half.numerator() << '/' << half.denominator()
              << " = " << half.value() << '\n';

    Fraction negative{1, -2};
    std::cout << negative.numerator() << '/' << negative.denominator() << '\n';

    try {
        Fraction bad{1, 0};
    } catch (const std::invalid_argument& e) {
        std::cout << "rejected: " << e.what() << '\n';
    }
}
```

Now there is no way to obtain a `Fraction` with a zero denominator, and every
`Fraction` is in lowest terms with the sign on the numerator. Those are the
class's **invariants**: statements true of every instance, from construction
until destruction.

That is what `private` is for. Not secrecy — there is nothing secret about
`denominator_` — but the guarantee that the only code able to break the
invariant is the small, reviewable amount inside the class.

:::note
Notice `normalise` is private too. Private members are not only data: helper
functions that are part of *how* the class works rather than *what it offers*
belong there as well, so that changing them cannot break any caller.
:::

## Constructors

A constructor establishes the invariant. The member initialiser list — the part
after the colon — initialises members directly, rather than default-constructing
them and then assigning:

```cpp run title="Initialise, do not assign" std=c++20
#include <iostream>
#include <string>

struct Loud {
    Loud() { std::cout << "  default-constructed\n"; }
    Loud(const std::string&) { std::cout << "  constructed from a string\n"; }
    Loud& operator=(const std::string&) { std::cout << "  assigned\n"; return *this; }
};

class Bad {
public:
    Bad(const std::string& text) { member_ = text; }   // constructs, then assigns
private:
    Loud member_;
};

class Good {
public:
    Good(const std::string& text) : member_(text) {}   // constructs once
private:
    Loud member_;
};

int main() {
    std::cout << "Bad:\n";  Bad  b{"x"};
    std::cout << "Good:\n"; Good g{"x"};
}
```

`Bad` does twice the work. For a `Loud` that is a wasted line of output; for a
`std::string` or a `std::vector` it is a wasted allocation. And some members —
references, `const` members, and types with no default constructor — *cannot* be
assigned after the fact, so the initialiser list is the only option.

:::pitfall
Members are initialised in the order they are **declared in the class**, not the
order they appear in the initialiser list. If one member's initialiser reads
another, and you get the declaration order wrong, you read an uninitialised
member. Compilers warn about this with `-Wreorder`, which `-Wall` includes.
:::

### explicit

A single-argument constructor defines an implicit conversion unless you say
otherwise:

```cpp run title="An implicit conversion you did not intend" std=c++20
#include <iostream>

class Meters {
public:
    Meters(double value) : value_(value) {}     // not explicit
    double value() const { return value_; }
private:
    double value_;
};

void report(Meters distance) {
    std::cout << "distance: " << distance.value() << " m\n";
}

int main() {
    report(Meters{5.0});
    report(5.0);              // compiles — 5.0 is silently converted
    report(true);             // compiles — bool to double to Meters!
}
```

`report(true)` is almost certainly a bug, and the language accepted it without a
word. Adding `explicit` requires callers to name the type:

```cpp run expect-error title="explicit closes the hole"
class Meters {
public:
    explicit Meters(double value) : value_(value) {}
    double value() const { return value_; }
private:
    double value_;
};

void report(Meters) {}

int main() {
    report(Meters{5.0});      // fine
    report(5.0);              // error: no implicit conversion
}
```

Make single-argument constructors `explicit` by default. Leave it off only when
the conversion is genuinely something you want at every call site — as with
`std::string` from a string literal.

## What belongs in the interface

A useful test: **would a caller notice if this changed?** If not, it should be
private.

- Data members are almost always private, because their names, types, and
  representation are implementation choices you will want to change.
- A getter is not automatically good design. `balance()` on an account is
  meaningful; a getter and setter for every member is a struct with extra
  typing, and it gives you the maintenance cost of a class with none of the
  protection.
- Prefer members that *do* something over members that expose state.
  `account.deposit(50)` maintains the invariant; `account.set_balance(x)` hands
  it to the caller.

:::tip
Start with `struct` and public members. Move to `class` and private members the
moment there is an invariant to protect — a value that must be in a range, two
members that must agree, a resource that must be released. If there is no
invariant, a struct is the honest design and the extra ceremony buys nothing.
:::

## Check yourself

:::quiz
{
  "question": "What is the difference between `struct` and `class` in C++?",
  "options": [
    { "text": "structs cannot have member functions; classes can", "why": "Both can have member functions, constructors, destructors, inheritance — everything." },
    { "text": "The default access: public for struct, private for class", "correct": true, "why": "That, and the default inheritance access, is the entire language-level difference. Everything else is convention." },
    { "text": "structs are copied by value; classes by reference", "why": "C++ has no such distinction — that is C# and Java. Both are value types here, copied unless you say otherwise." },
    { "text": "structs go on the stack; classes on the heap", "why": "Where an object lives is decided by how you declare it, not by which keyword defined its type." }
  ]
}
:::

:::quiz
{
  "question": "Given `class C { std::string a_; int b_; public: C(int n) : b_(n), a_(std::to_string(n)) {} };` — what is wrong?",
  "options": [
    { "text": "Nothing; the initialiser list order does not matter", "why": "It does not matter to correctness *here*, but the mismatch is a warning and a trap waiting for the next edit." },
    { "text": "Members initialise in declaration order, so the list order is misleading — a_ runs first, before b_", "correct": true, "why": "Right. `a_` is declared first, so it initialises first, despite appearing second in the list. Harmless here, but if `a_`'s initialiser read `b_` it would read an uninitialised member. -Wall warns via -Wreorder." },
    { "text": "You cannot initialise a std::string in a member initialiser list", "why": "You can, and you should — it constructs once, rather than default-constructing and then assigning." },
    { "text": "The constructor should be explicit, which is a compile error", "why": "It should be explicit, and that is a real design point — but it is a design flaw, not a compile error." }
  ]
}
:::

## Practice

:::exercise fraction-invariant

:::recap
- A `struct` defaults to public access, a `class` to private. That is the only
  language difference; the choice signals whether the type has an invariant.
- Aggregate initialisation with braces works when there are no private members
  and no user-declared constructors. `T x{};` initialises, `T x;` may not.
- Privacy exists to protect invariants — statements true of every instance —
  by limiting the code that can break them to the class itself.
- Use the member initialiser list, not assignment in the constructor body.
  Members initialise in declaration order regardless of the list order.
- Make single-argument constructors `explicit` unless you want the conversion.
- If there is no invariant, a struct with public members is the honest design.
:::
