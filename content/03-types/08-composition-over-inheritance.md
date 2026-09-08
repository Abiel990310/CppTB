---
title: "When not to use inheritance"
navTitle: "When not to use inheritance"
summary: >-
  The design mistakes that inheritance makes easy.
objectives:
  - Recognise an is-a relationship that is really has-a
  - Replace an inheritance hierarchy with composition
  - Explain the Liskov substitution principle in concrete terms
status: complete
standard: c++20
requires: [inheritance]
---

Inheritance is the most over-used feature in object-oriented C++. It is the
right tool for one job — runtime polymorphism over a set of types that genuinely
share an interface — and the wrong tool for the several jobs it gets used for
instead.

This chapter is about telling them apart.

## Inheritance is for interfaces, not for reuse

The commonest misuse is inheriting to get access to an implementation:

```cpp run title="Inheriting to reuse code" std=c++20
#include <iostream>
#include <vector>

// Wrong: a Stack is not a vector. It just wants vector's implementation.
class BadStack : public std::vector<int> {
public:
    void push(int value) { push_back(value); }
    int pop() { int v = back(); pop_back(); return v; }
};

int main() {
    BadStack s;
    s.push(1);
    s.push(2);

    // Every vector operation leaked into the interface, including the ones
    // that make no sense for a stack.
    s.insert(s.begin(), 99);       // insert at the bottom?
    s[0] = 42;                     // reach past the top?
    s.clear();

    std::cout << "the 'stack' has " << s.size() << " elements, and an "
              << "interface with dozens of operations it never wanted\n";
}
```

`BadStack` gained everything `std::vector` offers, including `insert`, `erase`,
and `operator[]` — operations that contradict what a stack is. Its users can
reach into the middle, and the class cannot stop them.

Composition says what was actually meant:

```cpp run title="Holding one, rather than being one" std=c++20
#include <iostream>
#include <stdexcept>
#include <vector>

class Stack {
public:
    void push(int value) { items_.push_back(value); }

    int pop() {
        if (items_.empty()) throw std::out_of_range("pop from an empty stack");
        const int value = items_.back();
        items_.pop_back();
        return value;
    }

    bool empty() const { return items_.empty(); }
    std::size_t size() const { return items_.size(); }

private:
    std::vector<int> items_;        // has-a, not is-a
};

int main() {
    Stack s;
    s.push(1);
    s.push(2);

    std::cout << "popped " << s.pop() << ", " << s.size() << " left\n";

    try {
        Stack empty;
        empty.pop();
    } catch (const std::out_of_range& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
    // s.insert(...) does not exist. There is nothing to misuse.
}
```

The interface is now exactly the operations a stack has. Nothing leaked, the
invariant is enforceable, and `std::vector` can be swapped for `std::deque`
without any caller noticing.

:::tip
The test: **is every operation on the base also meaningful on the derived
type?** If the answer is no, you wanted composition. A `Stack` that supports
`insert(begin(), x)` is not a stack.
:::

## Liskov substitution, concretely

The rule states that anywhere a base is expected, a derived object must work
without the caller noticing. Stated that way it sounds abstract; the classic
violation makes it concrete.

```cpp run title="A square is not a rectangle" std=c++20
#include <iostream>

class Rectangle {
public:
    virtual ~Rectangle() = default;
    virtual void set_width(double w) { width_ = w; }
    virtual void set_height(double h) { height_ = h; }
    double area() const { return width_ * height_; }
protected:
    double width_ = 0;
    double height_ = 0;
};

// "A square IS a rectangle" — true in geometry, false as a subtype.
class Square : public Rectangle {
public:
    void set_width(double w) override  { width_ = w; height_ = w; }
    void set_height(double h) override { width_ = h; height_ = h; }
};

// Written against Rectangle, and perfectly reasonable.
void resize_and_check(Rectangle& r) {
    r.set_width(4);
    r.set_height(5);
    std::cout << "  expected 20, got " << r.area() << '\n';
}

int main() {
    Rectangle rect;
    std::cout << "with a Rectangle:\n";
    resize_and_check(rect);

    Square sq;
    std::cout << "with a Square:\n";
    resize_and_check(sq);
    std::cout << "\nthe function is correct; the hierarchy is not\n";
}
```

`resize_and_check` is not doing anything unreasonable. It sets two independent
properties and expects them to stay set — which is part of what `Rectangle`
promises. `Square` cannot keep that promise, so `Square` is not a subtype of
`Rectangle`, whatever geometry says.

The lesson generalises: **inheritance is about substitutability of behaviour,
not about categories in the real world.** "Is a" in English is not the test.

## Alternatives, in the order to consider them

### 1. Composition, and forwarding what you want

The default, as in `Stack` above. You expose exactly the operations that make
sense, and the held type is an implementation detail you can change.

### 2. A template, when the variation is known at compile time

If the set of behaviours is fixed when you compile, you do not need a vtable:

```cpp run title="Static variation, no inheritance" std=c++20
#include <iostream>
#include <vector>

struct SumPolicy {
    static int combine(int a, int b) { return a + b; }
    static int initial() { return 0; }
};

struct MaxPolicy {
    static int combine(int a, int b) { return a > b ? a : b; }
    static int initial() { return -2147483647; }
};

template <class Policy>
int reduce(const std::vector<int>& values) {
    int result = Policy::initial();
    for (int v : values) result = Policy::combine(result, v);
    return result;
}

int main() {
    const std::vector<int> v{3, 9, 4};
    std::cout << "sum: " << reduce<SumPolicy>(v) << '\n';
    std::cout << "max: " << reduce<MaxPolicy>(v) << '\n';
}
```

No base class, no vptr, and the calls inline. Chapter 5.8 develops this
properly; the point here is that "several behaviours" does not automatically
mean "a hierarchy".

### 3. A function object, when the variation is one behaviour

If the only thing that varies is a single operation, pass the operation:

```cpp run title="Passing behaviour instead of subclassing it" std=c++20
#include <functional>
#include <iostream>
#include <string>
#include <vector>

// Instead of a Formatter base class with three subclasses:
void report(const std::vector<int>& values,
            const std::function<std::string(int)>& format) {
    for (int v : values) std::cout << format(v) << ' ';
    std::cout << '\n';
}

int main() {
    const std::vector<int> v{1, 2, 3};

    report(v, [](int x) { return std::to_string(x); });
    report(v, [](int x) { return "#" + std::to_string(x * 10); });
}
```

A hierarchy whose classes each override exactly one function, and hold no state,
is usually a function in disguise.

### 4. `std::variant`, when the set of types is closed

Chapter 4.8 covered this. When you know every alternative at compile time and
they do not share an interface so much as a *slot*, a variant plus `std::visit`
gives you the dispatch without allocation, without a vtable, and with a compiler
error when you add a case and forget to handle it.

### 5. Inheritance — when the set of types is open and they share an interface

Which is a real situation: plugins, a rendering backend chosen at startup, a
sensor abstraction where the concrete types come from different libraries. When
callers must work with types the code does not know about, runtime polymorphism
is the answer. That is the job it is for.

## Prefer shallow hierarchies

Even where inheritance is right, depth is not. A three-level hierarchy means
that reading any concrete class requires reading three files, and that a change
to the top can break something four levels down that nobody remembered.

The shape that ages well is one abstract interface and a flat set of
implementations:

```cpp run title="A flat hierarchy" std=c++20
#include <iostream>
#include <memory>
#include <vector>

struct Sink {
    virtual ~Sink() = default;
    virtual void write(const std::string& line) = 0;
};

struct ConsoleSink : Sink {
    void write(const std::string& line) override { std::cout << "  console: " << line << '\n'; }
};

struct CountingSink : Sink {
    int count = 0;
    void write(const std::string&) override { ++count; }
};

int main() {
    std::vector<std::unique_ptr<Sink>> sinks;
    sinks.push_back(std::make_unique<ConsoleSink>());
    auto counter = std::make_unique<CountingSink>();
    CountingSink* observer = counter.get();
    sinks.push_back(std::move(counter));

    for (auto& sink : sinks) sink->write("hello");
    std::cout << "counting sink saw " << observer->count << " line(s)\n";
}
```

One `virtual` interface, implementations that do not know about each other, and
no inheritance beyond a single level.

:::pitfall
`protected` data members are inheritance's other trap. They are effectively
public to every derived class, present and future — so an invariant involving
them cannot be maintained, because any subclass can break it. Keep data
`private` and give derived classes a `protected` *function* if they genuinely
need controlled access.
:::

## Check yourself

:::quiz
{
  "question": "Why is `class Stack : public std::vector<int>` a poor design?",
  "options": [
    { "text": "std::vector has no virtual destructor, so deleting through it is undefined", "correct": true, "why": "True, and a real bug — but it is the smaller problem. The design fault is that every vector operation becomes part of Stack's interface." },
    { "text": "Every vector operation joins Stack's interface, including insert and operator[], which contradict what a stack is", "correct": true, "why": "The main point. Public inheritance means callers can use the base's whole interface, so the class cannot enforce stack semantics at all. Composition exposes only push and pop." },
    { "text": "It is slower than holding a vector as a member", "why": "The layout and generated code are essentially identical. This is a design problem, not a performance one." },
    { "text": "std::vector cannot be inherited from", "why": "It can — the language permits it, which is precisely why the mistake is easy to make." }
  ]
}
:::

:::quiz
{
  "question": "In the Square/Rectangle example, which part is actually wrong?",
  "options": [
    { "text": "`resize_and_check`, for assuming width and height are independent", "why": "That assumption comes from Rectangle's own interface — two independent setters. A caller is entitled to rely on what the base promises." },
    { "text": "The hierarchy: Square cannot honour Rectangle's promise that the two dimensions are independent, so it is not a subtype", "correct": true, "why": "Liskov substitution in one sentence. Being a square in geometry says nothing about being substitutable for a Rectangle in code — behaviour is the test, not category." },
    { "text": "Square's setters, which should set only one dimension", "why": "Then it would not be a square. The conflict is inherent: no implementation of Square can satisfy Rectangle's contract." },
    { "text": "Rectangle, for making the setters virtual", "why": "Non-virtual setters would only change how it breaks — Square would be sliced or its overrides ignored, giving a different wrong answer." }
  ]
}
:::

## Practice

:::exercise prefer-composition

:::recap
- Inheritance is for **substitutable behaviour**, not for reusing an
  implementation. Public inheritance publishes the base's entire interface.
- The test: is every base operation meaningful on the derived type? If not, hold
  the thing instead of being it.
- Liskov substitution: a derived object must satisfy every promise the base
  makes. "Is a" in English is not the criterion — a square is not a subtype of
  a rectangle with independent setters.
- Consider in order: composition; a template when the variation is known at
  compile time; a function object when one behaviour varies; `std::variant` when
  the set of types is closed; inheritance when the set is open.
- Keep hierarchies one level deep, and keep data `private` — `protected` data
  is public to every future subclass and makes invariants unenforceable.
:::
