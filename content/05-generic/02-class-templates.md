---
title: "Class templates"
navTitle: "Class templates"
summary: >-
  Containers and wrappers that work for any element type.
objectives:
  - Write a class template with a type parameter
  - Use a deduction guide
  - Explain what a partial specialization does
status: complete
standard: c++20
requires: [function-templates, rule-of-zero]
---

`std::vector<T>`, `std::optional<T>`, `std::unique_ptr<T>` — every one is a
class template. This chapter is about writing your own, and about the two
features that make them pleasant to use: deduction and specialisation.

## A container of your own

```cpp run title="A fixed-capacity stack, for any element type" std=c++20
#include <cstddef>
#include <iostream>
#include <stdexcept>
#include <string>

template <class T, std::size_t Capacity>
class FixedStack {
public:
    void push(const T& value) {
        if (size_ == Capacity) throw std::out_of_range("stack is full");
        items_[size_++] = value;
    }

    T pop() {
        if (size_ == 0) throw std::out_of_range("stack is empty");
        return items_[--size_];
    }

    bool empty() const { return size_ == 0; }
    std::size_t size() const { return size_; }
    static constexpr std::size_t capacity() { return Capacity; }

private:
    T items_[Capacity]{};
    std::size_t size_ = 0;
};

int main() {
    FixedStack<int, 4> numbers;
    numbers.push(1);
    numbers.push(2);
    std::cout << "popped " << numbers.pop() << ", " << numbers.size() << " left\n";

    FixedStack<std::string, 2> words;
    words.push("hello");
    std::cout << "capacity " << words.capacity() << ", top " << words.pop() << '\n';
}
```

Two kinds of parameter there. `class T` is a **type parameter**. `std::size_t
Capacity` is a **non-type parameter** — a compile-time value, which is what lets
the array be a fixed-size member rather than a heap allocation.

Non-type parameters must be compile-time constants, which is why
`FixedStack<int, n>` with a run-time `n` will not compile. Chapter 2.6's rule
again: a fixed size means a constant.

## Deduction guides

Class template arguments used to be mandatory. Since C++17 the compiler can
deduce them from the constructor arguments — **class template argument
deduction**, or CTAD:

```cpp run title="Deducing the element type" std=c++20
#include <iostream>
#include <string>
#include <vector>

template <class T>
class Box {
public:
    explicit Box(T value) : value_(std::move(value)) {}
    const T& get() const { return value_; }
private:
    T value_;
};

int main() {
    Box<int> explicit_type{42};        // always worked
    Box deduced{42};                   // C++17: T deduced as int
    Box text{std::string{"hello"}};    // T = std::string

    std::cout << explicit_type.get() << ' ' << deduced.get() << ' ' << text.get() << '\n';

    // The standard library relies on it heavily:
    std::vector v{1, 2, 3};            // std::vector<int>
    std::cout << "vector of " << v.size() << '\n';
}
```

Deduction works automatically when the constructor's parameters mention the type
parameter directly. When they do not — or when you want a different answer — you
write a **deduction guide**:

```cpp run title="A guide, and why one is needed" std=c++20
#include <iostream>
#include <string>
#include <vector>

template <class T>
class Collection {
public:
    template <class Iterator>
    Collection(Iterator first, Iterator last) : items_(first, last) {}

    std::size_t size() const { return items_.size(); }
    const T& front() const { return items_.front(); }

private:
    std::vector<T> items_;
};

// Without this, T cannot be deduced: the constructor's parameters are
// Iterators, and nothing mentions T.
template <class Iterator>
Collection(Iterator, Iterator) -> Collection<typename std::iterator_traits<Iterator>::value_type>;

int main() {
    std::vector<int> source{4, 8, 15};
    Collection c{source.begin(), source.end()};        // deduces Collection<int>

    std::cout << c.size() << " items, first is " << c.front() << '\n';

    std::vector<std::string> words{"alpha", "beta"};
    Collection w{words.begin(), words.end()};
    std::cout << w.size() << " words, first is " << w.front() << '\n';
}
```

The guide reads: *given a constructor call with two `Iterator`s, the class is
`Collection<the iterator's value type>`.* `std::vector` has exactly this guide,
which is what makes `std::vector v(first, last)` work.

:::note
A guide is only needed when deduction cannot work it out. If your constructor
takes a `T` directly, C++17 handles it and a guide would be noise.
:::

## Member functions are instantiated lazily

A class template's member functions are only compiled when *called*. That has a
useful consequence: a member that would not compile for some `T` is harmless as
long as nobody calls it for that `T`.

```cpp run title="Only what you use is compiled" std=c++20
#include <iostream>
#include <string>

template <class T>
class Wrapper {
public:
    explicit Wrapper(T value) : value_(std::move(value)) {}

    const T& get() const { return value_; }

    // Only valid for types supporting +. Never instantiated for others.
    T doubled() const { return value_ + value_; }

private:
    T value_;
};

struct NotAddable { int id; };

int main() {
    Wrapper<int> n{21};
    std::cout << n.doubled() << '\n';

    // Constructing this is fine; doubled() is simply never instantiated.
    Wrapper<NotAddable> odd{NotAddable{7}};
    std::cout << "id " << odd.get().id << '\n';
    // odd.doubled();   // this line would be the error
}
```

This is why `std::vector<T>` can offer `operator<` even for element types that
have none: the member exists in the template and is only checked if you use it.

## Specialisation

Sometimes one type needs a different implementation. **Full specialisation**
replaces the template entirely for one set of arguments:

```cpp run title="A special case for bool" std=c++20
#include <iostream>
#include <string>

template <class T>
struct Describe {
    static std::string text(const T&) { return "some value"; }
};

// Full specialisation: this version is used when T is exactly bool.
template <>
struct Describe<bool> {
    static std::string text(bool value) { return value ? "true" : "false"; }
};

int main() {
    std::cout << Describe<int>::text(42) << '\n';
    std::cout << Describe<bool>::text(true) << '\n';
    std::cout << Describe<bool>::text(false) << '\n';
}
```

**Partial specialisation** applies to a *family* of arguments rather than one —
all pointers, all `std::vector`s, anything with two parameters where they match:

```cpp run title="Partial specialisation over a family" std=c++20
#include <iostream>
#include <string>
#include <vector>

template <class T>
struct Describe {
    static std::string text() { return "a value"; }
};

// Any pointer type.
template <class T>
struct Describe<T*> {
    static std::string text() { return "a pointer to " + Describe<T>::text(); }
};

// Any vector.
template <class T>
struct Describe<std::vector<T>> {
    static std::string text() { return "a vector of " + Describe<T>::text(); }
};

int main() {
    std::cout << Describe<int>::text() << '\n';
    std::cout << Describe<int*>::text() << '\n';
    std::cout << Describe<int**>::text() << '\n';
    std::cout << Describe<std::vector<int>>::text() << '\n';
    std::cout << Describe<std::vector<double*>>::text() << '\n';
}
```

Note that `Describe<int**>` matched the pointer specialisation with `T = int*`,
which then matched it again — recursion over types, resolved entirely at compile
time. That mechanism is what Chapter 5.7 builds type traits from.

:::pitfall
**Function templates cannot be partially specialised.** Only class templates
can. For a function, use overloading instead — which is the advice from Chapter
5.1, and this is the reason behind it. If you need something like partial
specialisation for a function, put the logic in a class template and have the
function forward to it.
:::

## The rule of zero applies here too

A class template that holds standard types needs no special member functions,
exactly as in Chapter 3.5:

```cpp run title="Nothing to write" std=c++20
#include <iostream>
#include <string>
#include <utility>
#include <vector>

template <class T>
class Registry {
public:
    void add(T value) { items_.push_back(std::move(value)); }
    std::size_t size() const { return items_.size(); }
    const T& at(std::size_t i) const { return items_[i]; }

    // No destructor, no copy, no move — the vector handles all of it.

private:
    std::vector<T> items_;
};

int main() {
    Registry<std::string> r;
    r.add("alpha");
    r.add("beta");

    Registry<std::string> copy = r;        // correct deep copy, generated
    Registry<std::string> moved = std::move(r);

    std::cout << copy.size() << ' ' << moved.at(0) << '\n';
}
```

## Check yourself

:::quiz
{
  "question": "When do you need to write a deduction guide?",
  "options": [
    { "text": "Always, for any class template you want deduced", "why": "C++17 generates implicit guides from the constructors. Most class templates need none." },
    { "text": "When the constructor's parameter types do not mention the class's type parameter, so it cannot be deduced from them", "correct": true, "why": "The iterator-pair constructor is the classic case: its parameters are Iterators, and nothing tells the compiler that T is the iterator's value type. std::vector ships exactly this guide." },
    { "text": "When the class has more than one type parameter", "why": "Number of parameters is irrelevant; what matters is whether the constructor arguments determine them." },
    { "text": "When the class template has a partial specialisation", "why": "Specialisation and deduction are unrelated mechanisms — one picks an implementation, the other works out the arguments." }
  ]
}
:::

:::quiz
{
  "question": "Why can `std::vector<T>` provide `operator<` even for element types that have no `operator<`?",
  "options": [
    { "text": "It falls back to comparing addresses", "why": "It compares elements; there is no address fallback. Using it with an incomparable element type is an error — just a deferred one." },
    { "text": "Member functions of a class template are only instantiated when called, so an unusable member is never checked", "correct": true, "why": "Lazy instantiation. The member exists in the template and is compiled only if some code calls it, which is why a vector of an incomparable type is perfectly usable for everything else." },
    { "text": "The standard library specialises it away for such types", "why": "No specialisation is involved; the general mechanism covers it for every class template, not just library ones." },
    { "text": "It is a compile error to declare a vector of an incomparable type", "why": "It is not — declaring and using such a vector is fine. Only calling the comparison is an error." }
  ]
}
:::

## Practice

:::exercise pair-template

:::exercise specialise-describe

:::recap
- Class templates take type parameters and **non-type** parameters
  (compile-time values), which is how a fixed-size member array is possible.
- Since C++17 arguments are deduced from the constructor. Write a **deduction
  guide** only when the constructor's parameters do not determine them — the
  iterator-pair constructor being the standard case.
- Member functions are instantiated **lazily**, so a member that would not
  compile for some `T` is harmless unless called.
- **Full specialisation** replaces the template for one set of arguments;
  **partial specialisation** matches a family, such as all pointers.
- Function templates cannot be partially specialised — overload instead, or
  forward to a class template.
- The rule of zero applies: a template holding standard types needs no special
  members.
:::
