---
title: "Inheritance and virtual functions"
navTitle: "Inheritance and virtual functions"
summary: >-
  Runtime polymorphism: how it works and what it costs.
objectives:
  - Explain what a vtable is and what a virtual call costs
  - Write a base class that is safe to delete through
  - Explain why a non-virtual destructor in a base class is a bug
status: complete
standard: c++20
requires: [operator-overloading, smart-pointers]
---

Sometimes you need to decide *at run time* which code to call — the shape is a
circle or a square, the sensor is a thermometer or a barometer, and the calling
code should not have to know. That is runtime polymorphism, and inheritance with
virtual functions is how C++ provides it.

It is also the feature most often reached for when something simpler would do,
which is the subject of the next chapter. This one is about how it works.

## A base class and its overrides

```cpp run title="One call site, several behaviours" std=c++20
#include <iostream>
#include <memory>
#include <vector>

class Shape {
public:
    virtual ~Shape() = default;            // essential — see below
    virtual double area() const = 0;       // pure virtual: no implementation here
    virtual const char* name() const = 0;
};

class Circle : public Shape {
public:
    explicit Circle(double radius) : radius_(radius) {}
    double area() const override { return 3.141592653589793 * radius_ * radius_; }
    const char* name() const override { return "circle"; }
private:
    double radius_;
};

class Square : public Shape {
public:
    explicit Square(double side) : side_(side) {}
    double area() const override { return side_ * side_; }
    const char* name() const override { return "square"; }
private:
    double side_;
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1.0));
    shapes.push_back(std::make_unique<Square>(2.0));

    for (const auto& shape : shapes) {
        std::cout << shape->name() << ": " << shape->area() << '\n';
    }
}
```

Four keywords carry the design:

- **`virtual`** on a base function means "the derived class may replace this, and
  a call through a base pointer must find the replacement".
- **`= 0`** makes it *pure virtual*: no implementation, and the class becomes
  **abstract** — it cannot be instantiated, only derived from.
- **`override`** on the derived function asks the compiler to check that it
  really is overriding something. Always write it.
- **`public`** inheritance means "a `Circle` is a `Shape`" and is what lets a
  `Circle*` convert to a `Shape*`.

:::tip
`override` is not decoration. Without it, a signature mismatch — a missing
`const`, a different parameter type — silently creates a *new* function rather
than an override, and calls through the base keep finding the base version. With
it, the compiler rejects the mismatch.
:::

```cpp run expect-error title="override catching a silent mistake"
struct Base {
    virtual ~Base() = default;
    virtual int value() const { return 1; }
};

struct Derived : Base {
    // Missing `const` — this does not override anything.
    int value() override { return 2; }
};

int main() { return 0; }
```

Delete the `override` from that and it compiles, and `Derived` quietly has two
unrelated `value` functions. Every call through a `Base&` gets 1.

## How a virtual call works

Each polymorphic class has a **vtable**: a static array of function pointers,
one per virtual function. Each object of that class carries a hidden pointer to
its class's vtable — the *vptr*. A virtual call loads the vptr, indexes the
table, and calls through the pointer it finds.

```cpp run title="The cost, in bytes and in time" std=c++20
#include <chrono>
#include <iostream>
#include <memory>
#include <vector>

struct Plain {
    int value = 1;
    int get() const { return value; }
};

struct Polymorphic {
    int value = 1;
    virtual ~Polymorphic() = default;
    virtual int get() const { return value; }
};

int main() {
    std::cout << "sizeof(Plain)        = " << sizeof(Plain) << '\n';
    std::cout << "sizeof(Polymorphic)  = " << sizeof(Polymorphic)
              << "   <- the extra bytes are the vptr\n\n";

    constexpr int rounds = 20'000'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    Plain plain;
    std::unique_ptr<Polymorphic> poly = std::make_unique<Polymorphic>();

    auto start = clock::now();
    long long a = 0;
    for (int i = 0; i < rounds; ++i) a += plain.get();
    auto mid = clock::now();

    long long b = 0;
    for (int i = 0; i < rounds; ++i) b += poly->get();
    auto finish = clock::now();

    std::cout << "direct call:  " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "virtual call: " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(sums " << a << ", " << b << ")\n";
}
```

Two costs, and it is worth being precise about their size.

**Space:** every object grows by one pointer. For a class with a dozen members
that is nothing; for a small value type in an array of millions, doubling the
size of each element is a real cost, and it is the reason `std::vector<int>` has
no virtual functions.

**Time:** an extra indirection, and — more importantly — the call cannot be
inlined when the compiler does not know the dynamic type. That second effect
usually dominates: not the load itself, but the optimisations it prevents.

:::note
The direct call above is likely to be *very* fast because the compiler inlines
it entirely and may hoist it out of the loop. That is the honest comparison:
the question is rarely "how long is one indirect jump" but "what did the
compiler stop being able to do".
:::

## The non-virtual destructor bug

This is the mistake that turns inheritance from a design choice into a memory
bug.

```cpp run expect-ub title="Deleting through a base with no virtual destructor" std=c++20
#include <iostream>
#include <memory>
#include <vector>

struct Base {
    ~Base() { std::cout << "  Base destroyed\n"; }   // NOT virtual
};

struct Derived : Base {
    std::vector<int> data = std::vector<int>(1000);
    ~Derived() { std::cout << "  Derived destroyed\n"; }
};

int main() {
    std::cout << "deleting a Derived through a Base pointer:\n";
    Base* p = new Derived;
    delete p;                       // undefined: ~Derived never runs
    std::cout << "note that ~Derived did not run — its vector leaked\n";
}
```

`~Derived` never ran, so the vector it owned was never freed. The standard calls
this undefined behaviour outright; in practice you get a leak, and with more
complex members you can get worse.

The fix is one word:

```cpp run title="With a virtual destructor" std=c++20
#include <iostream>
#include <vector>

struct Base {
    virtual ~Base() { std::cout << "  Base destroyed\n"; }
};

struct Derived : Base {
    std::vector<int> data = std::vector<int>(1000);
    ~Derived() override { std::cout << "  Derived destroyed\n"; }
};

int main() {
    Base* p = new Derived;
    delete p;                       // both destructors run, in the right order
    std::cout << "no leak\n";
}
```

**The rule:** if a class has any virtual function, or if anyone might delete a
derived object through a pointer to it, give it a virtual destructor.

:::warning
Declaring a destructor — virtual or not — **suppresses the implicit move
operations** (Chapter 3.5). `virtual ~Base() = default;` is necessary and costs
you the generated moves. Declare them explicitly alongside:

```cpp
virtual ~Base() = default;
Base(Base&&) noexcept = default;
Base& operator=(Base&&) noexcept = default;
Base(const Base&) = default;
Base& operator=(const Base&) = default;
```
:::

## Slicing

A base class object cannot hold a derived one. Assigning or copying *by value*
silently discards everything the derived class added:

```cpp run title="What slicing loses" std=c++20
#include <iostream>

struct Shape {
    virtual ~Shape() = default;
    virtual double area() const { return 0; }
};

struct Square : Shape {
    double side;
    explicit Square(double s) : side(s) {}
    double area() const override { return side * side; }
};

void by_value(Shape s)        { std::cout << "  by value:     " << s.area() << '\n'; }
void by_reference(const Shape& s) { std::cout << "  by reference: " << s.area() << '\n'; }

int main() {
    Square sq{3.0};
    std::cout << "a 3x3 square has area " << sq.area() << "\n\n";

    by_value(sq);        // sliced: only the Shape part is copied
    by_reference(sq);    // not sliced: the reference still names a Square
}
```

By value, the `Square` part is cut away and `Shape::area` runs — reporting 0 for
a square of area 9, with no warning. **Polymorphic types are used through
pointers or references, never by value.** That is why the container in the first
sample was `vector<unique_ptr<Shape>>` and not `vector<Shape>`.

A common defence is to make the base non-copyable, so slicing becomes a compile
error rather than a wrong answer.

## Calling the base version

An override may call the function it replaces:

```cpp run title="Extending rather than replacing" std=c++20
#include <iostream>
#include <string>

struct Logger {
    virtual ~Logger() = default;
    virtual std::string format(const std::string& message) const {
        return "[log] " + message;
    }
};

struct TimestampLogger : Logger {
    std::string format(const std::string& message) const override {
        return "[12:00] " + Logger::format(message);   // qualified: not virtual
    }
};

int main() {
    TimestampLogger logger;
    const Logger& base = logger;
    std::cout << base.format("started") << '\n';
}
```

`Logger::format(...)` with the class name is a *non-virtual* call to that
specific version. Without the qualification it would call itself and recurse
forever.

## Check yourself

:::quiz
{
  "question": "`Base* p = new Derived; delete p;` with a non-virtual `~Base()` — what happens?",
  "options": [
    { "text": "Both destructors run, base first", "why": "Neither ordering applies: without a virtual destructor the call is resolved statically to ~Base, and ~Derived is never reached at all." },
    { "text": "Undefined behaviour — only ~Base runs, so anything Derived owned leaks", "correct": true, "why": "The standard makes it undefined outright. In practice the derived destructor never runs, so its members are never destroyed — a leak that grows with every deletion." },
    { "text": "It fails to compile, since Derived is not deletable through Base*", "why": "It compiles without a word. That silence is exactly what makes this bug common." },
    { "text": "~Derived runs but ~Base does not", "why": "Backwards. The static type of the pointer decides, and that is Base." }
  ]
}
:::

:::quiz
{
  "question": "Why does `void draw(Shape s)` misbehave when passed a `Square`?",
  "options": [
    { "text": "It does not — virtual dispatch works regardless of how the parameter is passed", "why": "Virtual dispatch needs a pointer or reference to the original object. A by-value parameter is a new Shape, and there is nothing derived left to dispatch to." },
    { "text": "The Square is sliced: only its Shape sub-object is copied, so Shape's version runs", "correct": true, "why": "The derived part is simply not copied. area() reports the base answer with no warning, which is why polymorphic types are used through references or pointers." },
    { "text": "The Shape copy constructor is deleted, so it fails to compile", "why": "It compiles unless you deliberately delete the copy operations — which is a good defence, and precisely because the default behaviour is silent." },
    { "text": "It leaks, because the Square part is never destroyed", "why": "Nothing leaks: the Square was never copied in, so there is nothing extra to destroy. The problem is a wrong answer, not a leak." }
  ]
}
:::

## Practice

:::exercise virtual-destructor

:::exercise shape-hierarchy

:::recap
- `virtual` enables dispatch on the dynamic type; `= 0` makes a class abstract;
  `override` makes the compiler check you actually overrode something — always
  write it.
- A polymorphic object carries a vptr, so it grows by a pointer. The run-time
  cost is less the indirection than the inlining it prevents.
- A base class that anyone might delete through needs a **virtual destructor**.
  Without one, the derived destructor never runs.
- Declaring any destructor suppresses the implicit moves; declare them
  explicitly alongside `virtual ~Base() = default;`.
- Passing a polymorphic type **by value slices it** — the derived part is
  discarded and the base version runs, silently. Use references or pointers.
- `Base::f()` calls a specific version non-virtually; without the qualification
  an override calling itself recurses forever.
:::
