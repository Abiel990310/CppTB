---
title: "Static polymorphism"
navTitle: "Static polymorphism"
summary: >-
  Getting the shape of inheritance without the runtime cost.
objectives:
  - Implement CRTP and explain what it replaces
  - Compare the cost of virtual dispatch with a template
  - Decide when runtime polymorphism is the right answer anyway
status: complete
standard: c++20
requires: [type-traits]
---

Part 3 gave you one way to say "these types share an interface": a base class
with virtual functions. The call goes through a pointer stored in the object,
and which function runs is decided while the program is running.

Templates give you another way. The interface is checked at compile time, the
call goes straight to the function, and there is no base class in the object at
all. This chapter is about when each is right — and the answer is not "always
the fast one".

```cpp run asm title="Two ways to call the same thing"
#include <iostream>

struct Dynamic {
    virtual ~Dynamic() = default;
    virtual int scale(int x) const = 0;
};

struct DynamicDouble : Dynamic {
    int scale(int x) const override { return x * 2; }
};

struct StaticDouble {
    int scale(int x) const { return x * 2; }
};

template <class T>
int apply(const T& op, int x) { return op.scale(x); }

int main() {
    DynamicDouble d;
    const Dynamic& base = d;
    StaticDouble s;

    std::cout << apply(base, 21) << ' ' << apply(s, 21) << '\n';
}
```

Both print `42`, and — press **Assembly** — both compile to `movl $42`. Neither
call survives at all.

That is worth pausing on, because it contradicts the usual story. `base` refers
to a `DynamicDouble` that was constructed three lines earlier and never left
`main`, so the compiler knows its dynamic type exactly. Knowing that, it
replaces the virtual call with a direct one and inlines it, the same as for
`StaticDouble`. A vtable is not a cost the compiler is obliged to pay.

It becomes one as soon as the compiler loses sight of the dynamic type — which
happens the moment the reference crosses a function boundary the optimiser
cannot see through.

## The cost of a virtual call, examined

"Virtual calls are slow" is folklore worth pinning down. The direct cost is one
extra load and an indirect branch, which a modern branch predictor usually gets
right. The real cost is that the compiler cannot inline through it — and
everything the inliner would have done next does not happen either.

```cpp run asm title="The same loop, dispatched two ways"
#include <iostream>
#include <memory>

struct Op {
    virtual ~Op() = default;
    virtual int apply(int x) const = 0;
};
struct AddOne : Op {
    int apply(int x) const override { return x + 1; }
};

struct StaticAddOne {
    int apply(int x) const { return x + 1; }
};

template <class F>
long long sum_applied(const F& op, int rounds) {
    long long total = 0;
    for (int i = 0; i < rounds; ++i) total += op.apply(i);
    return total;
}

long long virtual_total(const Op& op)          { return sum_applied(op, 1000); }
long long direct_total(const StaticAddOne& op) { return sum_applied(op, 1000); }

int main() {
    std::unique_ptr<Op> dynamic_op = std::make_unique<AddOne>();
    StaticAddOne static_op;
    std::cout << virtual_total(*dynamic_op) << ' ' << direct_total(static_op) << '\n';
}
```

Both print `500500`. Press **Assembly** and find the two functions. On GCC at
`-O2`, `direct_total` is two instructions:

```
movl  $500500, %eax
ret
```

The loop is gone. `apply` was inlined, the body became `total += i + 1`, and a
thousand iterations of a known recurrence folded into one constant at compile
time.

`virtual_total` is thirty-odd instructions with a real loop in the middle. GCC
does something clever there — it loads the address of `AddOne::apply`, compares
the vtable entry against it, and runs an inlined fast path when they match. That
is **speculative devirtualization**, and it is the compiler guessing. It still
has to keep the loop, and it still has to keep the indirect call for the case
where the guess is wrong, because a `const Op&` could refer to anything.

:::warning
This is a demonstration of a mechanism, not a measurement of a program. The
function body here is a single addition, so the call overhead is the whole cost;
make `apply` do real work and the ratio collapses towards nothing. Whether any
of this matters for *your* program is a question only a profiler answers —
Chapter 7.2 is about asking it properly. What this sample establishes is the
reason a difference exists at all: inlining, not the indirect branch.
:::

## CRTP: a base class that knows its derived type

The interesting case is when you want what inheritance gives you — shared code
in a base, customised in a derived — without the indirection. The trick is to
tell the base which derived class it belongs to, as a template argument.

```cpp run title="The curiously recurring template pattern"
#include <iostream>
#include <sstream>
#include <string>

template <class Derived>
class Formattable {
public:
    // Written once, in terms of a `write` the derived class supplies.
    // The call is direct: no virtual, no vtable.
    std::string to_string() const {
        std::ostringstream out;
        self().write(out);
        return out.str();
    }

    std::string boxed() const {
        std::string body = to_string();
        return "[" + body + "]";
    }

private:
    const Derived& self() const { return static_cast<const Derived&>(*this); }
};

class Version : public Formattable<Version> {
public:
    Version(int major, int minor) : major_(major), minor_(minor) {}
    void write(std::ostream& os) const { os << major_ << '.' << minor_; }

private:
    int major_, minor_;
};

class Celsius : public Formattable<Celsius> {
public:
    explicit Celsius(double degrees) : degrees_(degrees) {}
    void write(std::ostream& os) const { os << degrees_ << " \u00b0C"; }

private:
    double degrees_;
};

int main() {
    Version v{1, 10};
    Celsius t{21.5};

    std::cout << v.boxed() << ' ' << t.boxed() << '\n';
    std::cout << "sizeof(Version): " << sizeof(Version) << " bytes\n";
}
```

`class Version : public Formattable<Version>` is the curious recurrence: the
base is parameterised on the class that derives from it. That is legal because
the base only needs `Version` to be *complete* when its members are instantiated
— which happens when they are called, long after the class is finished.

`boxed()` is the payoff. It is written once, calls `to_string()`, which calls
`self().write(out)`, which is `Version::write` — resolved at compile time and
inlinable all the way down. A virtual `write` would have stopped the inliner at
the first step.

Look at the size. `Version` is 8 bytes: two `int`s and nothing else. An empty
base class contributes no storage, and there is no vtable pointer because there
are no virtual functions. The same interface built with a virtual `compare`
would be 16 bytes on a 64-bit machine — a vtable pointer, two `int`s, and
padding.

:::pitfall
`static_cast<const Derived&>(*this)` is the load-bearing line, and it is unsafe
if the pattern is used wrongly:

```cpp
class Version : public Formattable<Version> { … };
class Patch   : public Formattable<Version> { … };   // wrong argument, compiles
```

`Patch`'s inherited `to_string` will cast a `Patch*` to a `Version&` and read
memory that is not there. The usual guard is to make the base's constructor
private and `friend Derived` — then only `Derived` can construct the base, and
`Patch` fails to compile.
:::

```cpp run title="Making the mistake impossible"
#include <iostream>

template <class Derived>
class Counted {
public:
    static int live() { return live_; }
    int id() const { return id_; }

private:
    friend Derived;                 // only Derived may construct the base
    Counted() : id_(++next_) { ++live_; }
    ~Counted() { --live_; }

    int id_;
    static inline int next_ = 0;
    static inline int live_ = 0;
};

class Session : public Counted<Session> {};
class Job     : public Counted<Job> {};

int main() {
    Session a, b;
    Job j;
    std::cout << "sessions live: " << Session::live() << '\n';
    std::cout << "jobs live:     " << Job::live() << '\n';
    std::cout << "second session id: " << b.id() << ", first job id: " << j.id() << '\n';
    (void)a;
}
```

The private constructor plus `friend Derived` is the standard belt-and-braces
CRTP guard. It also demonstrates the second thing CRTP is used for: each
instantiation of `Counted<T>` has its *own* statics, so `Session` and `Job` get
independent counters from one piece of code.

## Concepts do the interface checking

CRTP's weakness used to be error messages: pass the wrong type and you got a
failure deep inside the base. Concepts fix that, and they also let you write
static polymorphism with no base class at all.

```cpp run title="An interface with no inheritance"
#include <concepts>
#include <iostream>
#include <string>

template <class T>
concept Shape = requires(const T& s) {
    { s.area() } -> std::convertible_to<double>;
    { s.name() } -> std::convertible_to<std::string>;
};

struct Circle {
    double r;
    double area() const { return 3.14159265 * r * r; }
    std::string name() const { return "circle"; }
};

struct Square {
    double side;
    double area() const { return side * side; }
    std::string name() const { return "square"; }
};

void report(const Shape auto& s) {
    std::cout << s.name() << " has area " << s.area() << '\n';
}

int main() {
    report(Circle{1.0});
    report(Square{2.0});
}
```

`Circle` and `Square` share no base class, no header, and no knowledge of each
other. They satisfy `Shape` by *having the right members*, which is what people
mean by duck typing — except that it is checked, and the check happens before
the program runs.

## So when is virtual still right?

Every time the set of types is not known when the code is compiled.

```cpp run title="What a template cannot do"
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct Widget {
    virtual ~Widget() = default;
    virtual std::string render() const = 0;
};

struct Button : Widget { std::string render() const override { return "[button]"; } };
struct Label  : Widget { std::string render() const override { return "label"; } };
struct Spacer : Widget { std::string render() const override { return "   "; } };

int main() {
    // One container, three different types, chosen at run time.
    std::vector<std::unique_ptr<Widget>> layout;
    layout.push_back(std::make_unique<Label>());
    layout.push_back(std::make_unique<Spacer>());
    layout.push_back(std::make_unique<Button>());

    for (const auto& w : layout) std::cout << w->render();
    std::cout << '\n';
}
```

A `std::vector<T>` holds one type. This vector holds three, and which three is
decided by code that runs — read from a config file, chosen by a user, loaded
from a plugin. No amount of `if constexpr` gets you there, because the decision
is not available to the compiler.

The dividing line, then:

| Use a template when | Use virtual when |
|---|---|
| the type is known at the call site | the type is chosen at run time |
| you want inlining and zero overhead | you need one container of mixed types |
| the interface is checked, not shared | you want a stable ABI across a library boundary |
| all code is available as source | implementations ship separately, as plugins |
| compile time is not the constraint | compile time and code size matter |

That last row is the cost nobody mentions. A template instantiates a fresh copy
of its code for every type it is used with. Ten types means ten copies in the
binary and ten times the compilation work. Virtual dispatch compiles once and
links once, and there is a size at which that stops being a fair trade.

:::tip
`std::variant` plus `std::visit` sits between the two: a closed set of types
known at compile time, stored in one object with no heap allocation, dispatched
by a jump table. When you know every alternative and just need them in the same
container, it is often the better answer than either — Chapter 4.6 covered it.
:::

## Check yourself

:::quiz
{
  "question": "In `class Version : public Formattable<Version>`, how does the base call `Version::write` without a virtual function?",
  "options": [
    { "text": "It `static_cast`s `*this` to `Derived&`, which is a plain downcast the compiler resolves at compile time", "correct": true, "why": "The base knows the derived type because it was told as a template argument, so the cast is valid and the call is direct — and inlinable." },
    { "text": "The compiler generates a hidden vtable for template base classes", "why": "There is no vtable: `sizeof(Version)` is 8, exactly its two ints." },
    { "text": "`write` is found by name lookup in the derived class", "why": "Name lookup does not search derived classes from a base. The cast is what makes `write` reachable." },
    { "text": "The base class is instantiated after the derived class, so it can see its members", "why": "Instantiation order is the reason it *compiles* — members are instantiated when called — but the mechanism of the call is the cast." }
  ]
}
:::

:::quiz
{
  "question": "You are writing a plugin system: third parties ship shared libraries containing new node types your renderer must call. Template or virtual?",
  "options": [
    { "text": "Virtual — the types do not exist when your renderer is compiled", "correct": true, "why": "A template needs the type at the call site. A plugin's type is not available then, or ever, in source form. This is the case runtime polymorphism exists for." },
    { "text": "Template, with a concept to check the interface", "why": "The concept can only check a type the compiler can see. The plugin's type is loaded at run time." },
    { "text": "CRTP, with the plugin type as the template argument", "why": "Same problem: the argument would have to be known when your renderer is compiled." },
    { "text": "`std::variant` over the node types", "why": "A variant's alternatives are fixed at compile time, so it cannot hold a type that ships later." }
  ]
}
:::

## Practice

:::exercise crtp-mixin

:::exercise type-erased-shape

:::recap
- Static polymorphism resolves the call at compile time: no vtable pointer in
  the object, and the call can be inlined, which is where most of the speed
  difference comes from.
- CRTP parameterises a base class on the class deriving from it, so shared code
  in the base can call into the derived type directly via `static_cast`.
- Guard CRTP with a private constructor and `friend Derived`, or a wrong
  template argument compiles into a bad cast.
- Each `Base<T>` instantiation gets its own statics, which is the other reason
  to reach for the pattern.
- Concepts give you the same interface checking with no base class at all, and
  better errors than either CRTP or an unconstrained template.
- Virtual dispatch is still right whenever the type is chosen at run time, when
  you need one container of mixed types, or when implementations ship
  separately — and it costs one copy of the code instead of one per type.
:::
