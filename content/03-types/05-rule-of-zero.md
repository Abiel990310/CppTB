---
title: "The rule of zero, three, and five"
navTitle: "Rule of zero, three, five"
summary: >-
  How many special member functions you actually need to write.
objectives:
  - Apply the rule of zero to a class that owns nothing
  - List the five special member functions and when each is generated
  - Explain why declaring a destructor suppresses move operations
status: complete
standard: c++20
requires: [copying, moving]
---

You now have all the pieces: constructors, destructors, copying, moving. This
chapter is the short set of rules that tells you which of them to write, and the
answer is usually *none*.

## The five special member functions

The compiler can generate five functions for you:

| | Signature |
|---|---|
| Destructor | `~T()` |
| Copy constructor | `T(const T&)` |
| Copy assignment | `T& operator=(const T&)` |
| Move constructor | `T(T&&)` |
| Move assignment | `T& operator=(T&&)` |

Whether each is generated depends on what else you have declared, and the rules
are not intuitive. They exist for backward compatibility: code written before
C++11 had no move operations, and adding them silently to every old class would
have changed behaviour.

## The rule of zero

**If your class does not directly own a resource, declare none of the five.**

```cpp run title="A class with no special members at all" std=c++20
#include <iostream>
#include <memory>
#include <string>
#include <vector>

struct Widget {
    int id = 0;
};

class Workspace {
public:
    Workspace(std::string name) : name_(std::move(name)) {}

    void add(int id) { widgets_.push_back(Widget{id}); }
    void set_active(int id) { active_ = std::make_unique<Widget>(Widget{id}); }

    std::size_t count() const { return widgets_.size(); }
    const std::string& name() const { return name_; }
    bool has_active() const { return active_ != nullptr; }

private:
    std::string name_;
    std::vector<Widget> widgets_;
    std::unique_ptr<Widget> active_;
};

int main() {
    Workspace a{"main"};
    a.add(1);
    a.add(2);
    a.set_active(1);

    Workspace moved = std::move(a);      // move: generated, and correct
    std::cout << moved.name() << " has " << moved.count()
              << " widgets, active: " << moved.has_active() << '\n';

    // Workspace copy = moved;           // would not compile: unique_ptr
                                         // is not copyable, so neither is this
}
```

`Workspace` manages a string, a vector, and a heap object — and declares none of
the five. Every member already knows how to destroy, copy, and move itself, so
the generated versions do exactly the right thing. The class is also
automatically non-copyable, because `unique_ptr` is, which is very likely what
you want for a type holding a unique resource.

This is the target. A class written this way cannot have a double-free bug, a
leak, a broken self-assignment, or a missing `noexcept`, because it has no code
in which to have one.

:::tip
When you catch yourself writing a destructor, ask what resource it releases and
whether a standard type already owns that kind of resource. Memory →
`unique_ptr` or `vector`. A file → `fstream`. A lock → `lock_guard`. Something
exotic → `unique_ptr` with a custom deleter. If the answer is yes, use it, and
delete the destructor you were about to write.
:::

## The rule of three, and then five

Sometimes you *are* the building block. Then:

**If you write any one of the destructor, copy constructor, or copy assignment,
you almost certainly need all three.** That is the rule of three, and the reason
is that all three exist for the same purpose — managing an owned resource — so
needing one implies the others.

C++11 added moves, extending it to the **rule of five**: if you write any of the
five, consider all five.

```cpp run title="All five, written out once" std=c++20
#include <cstddef>
#include <iostream>
#include <utility>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}

    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
    }

    Buffer& operator=(const Buffer& other) {
        if (this != &other) {
            int* fresh = new int[other.size_];
            for (std::size_t i = 0; i < other.size_; ++i) fresh[i] = other.data_[i];
            delete[] data_;
            data_ = fresh;
            size_ = other.size_;
        }
        return *this;
    }

    Buffer(Buffer&& other) noexcept : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
        other.size_ = 0;
    }

    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }

    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    Buffer b = a;               // copy ctor
    Buffer c = std::move(a);    // move ctor
    b = c;                      // copy assign
    b = std::move(c);           // move assign

    std::cout << "b.size() = " << b.size() << ", c.size() = " << c.size() << '\n';
}
```

Sixty lines to manage one pointer. Now compare:

```cpp run title="The same thing, following the rule of zero" std=c++20
#include <iostream>
#include <utility>
#include <vector>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(n) {}

    std::size_t size() const { return data_.size(); }

private:
    std::vector<int> data_;
};

int main() {
    Buffer a{4};
    Buffer b = a;
    Buffer c = std::move(a);
    b = c;
    b = std::move(c);

    std::cout << "b.size() = " << b.size() << ", c.size() = " << c.size() << '\n';
}
```

Identical behaviour, all five operations correct, and nothing to review. Unless
you are implementing `std::vector`, the second version is the one to write.

## The trap: a destructor suppresses moves

This is the rule that costs real programs real performance, silently.

Declaring a destructor **prevents the compiler from generating the move
constructor and move assignment operator.** Copy operations are still generated
(deprecated, but generated), so the class still compiles and still works — it
just copies everywhere you expected a move.

```cpp run title="One empty destructor, and the moves are gone" std=c++20
#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct Fine {
    std::vector<int> data;
    explicit Fine(std::size_t n) : data(n) {}
};

struct Spoiled {
    std::vector<int> data;
    explicit Spoiled(std::size_t n) : data(n) {}
    ~Spoiled() {}                       // does nothing at all
};

int main() {
    Fine a{5};
    Fine b = std::move(a);
    std::cout << "Fine:    source left with " << a.data.size()
              << " elements (moved)\n";

    Spoiled c{5};
    Spoiled d = std::move(c);
    std::cout << "Spoiled: source left with " << c.data.size()
              << " elements (copied!)\n";
}
```

`Spoiled`'s destructor does nothing. Its presence alone means `std::move` on a
`Spoiled` performs a copy — the source still has its five elements, because
nothing was taken from it. For a vector of five ints that is invisible; for a
class holding a large buffer, in a `std::vector` that reallocates, it is a
silent order-of-magnitude cost.

:::pitfall
The most common way this happens in practice is an empty virtual destructor
added to a base class — `virtual ~Base() = default;` — which you genuinely need
for safe polymorphic deletion. It is correct and necessary, and it costs you the
implicit moves for that type. The fix is to declare them explicitly, as below.
:::

## Saying what you mean with `= default` and `= delete`

You do not have to write a function body to declare one:

```cpp run title="Declaring all five without implementing any" std=c++20
#include <iostream>
#include <string>
#include <vector>

class Resource {
public:
    Resource() = default;
    virtual ~Resource() = default;             // needed for polymorphic deletion

    // Because the destructor is declared, these would not be generated.
    // Ask for them back explicitly:
    Resource(Resource&&) noexcept = default;
    Resource& operator=(Resource&&) noexcept = default;

    // And be explicit that copying is not wanted:
    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;

    std::vector<int> data;
};

int main() {
    Resource a;
    a.data = {1, 2, 3};

    Resource b = std::move(a);      // moves, because we asked for it back
    std::cout << "b has " << b.data.size() << ", a has " << a.data.size() << '\n';

    // Resource c = b;              // compile error, and deliberately so
}
```

`= default` asks for the compiler's version, which is both shorter and less
error-prone than writing it out. `= delete` states that an operation must not
exist, turning a run-time disaster into a compile error.

Declaring all five explicitly, even as `= default` or `= delete`, is worth doing
for any class that declares one of them. It makes the intent visible and removes
the need for the reader to remember the suppression rules.

## The generation rules, for reference

You do not need to memorise this table, but you should know it exists:

| If you declare… | Copy ctor | Copy assign | Move ctor | Move assign | Destructor |
|---|---|---|---|---|---|
| nothing | generated | generated | generated | generated | generated |
| a destructor | generated¹ | generated¹ | **suppressed** | **suppressed** | yours |
| a copy operation | generated¹ | generated¹ | **suppressed** | **suppressed** | generated |
| a move operation | **deleted** | **deleted** | — | — | generated |

¹ Generated, but deprecated: relying on it is a smell.

The row that matters most is the last: **declaring any move operation deletes
both copy operations.** That one is usually what you want — a type with a
hand-written move is usually an owner that should not be silently copied — but
it can surprise you.

## Check yourself

:::quiz
{
  "question": "A class has a `std::string`, a `std::vector<int>`, and an empty destructor `~C() {}`. What is the consequence?",
  "options": [
    { "text": "None — an empty destructor does nothing", "why": "Its body does nothing, but its *declaration* changes what the compiler generates. That is the trap." },
    { "text": "Move operations are not generated, so the class copies where it would have moved", "correct": true, "why": "Exactly. Copy operations are still generated, so everything compiles and works — just slower, silently. Deleting the destructor, or defaulting the moves explicitly, fixes it." },
    { "text": "Copy operations are deleted, so the class cannot be copied", "why": "That is what declaring a *move* operation does. A destructor suppresses moves and leaves copies in place." },
    { "text": "The class leaks, because the destructor does not free the members", "why": "Members are destroyed after the destructor body runs regardless of what the body contains. There is no leak." }
  ]
}
:::

:::quiz
{
  "question": "When should you write all five special member functions by hand?",
  "options": [
    { "text": "For every class, to be explicit", "why": "For a class whose members already manage themselves, five hand-written functions are five places for a bug that the generated versions cannot have." },
    { "text": "Only when the class directly owns a raw resource that no member type manages", "correct": true, "why": "The rule of zero. Hand-written resource management belongs in the small number of types that *are* the building blocks — and most of those already exist in the standard library." },
    { "text": "Whenever the class has a pointer member", "why": "Only if the class *owns* what the pointer refers to. A non-owning observer pointer needs none of the five — copying the address is exactly right." },
    { "text": "Whenever the class is used in a std::vector", "why": "vector requires only that the type be destructible and either movable or copyable, which the generated versions provide." }
  ]
}
:::

## Practice

:::exercise rule-of-zero-refactor

:::recap
- Five special members: destructor, copy constructor, copy assignment, move
  constructor, move assignment.
- **Rule of zero:** if no member is a raw owned resource, declare none of them.
  This should describe almost every class you write.
- **Rule of three/five:** if you write one, consider all five. Needing one
  implies you are managing a resource, which the others also have to handle.
- Declaring a destructor suppresses the implicit move operations, silently
  turning moves into copies. A `virtual ~Base() = default;` does this too.
- Use `= default` to ask for the generated version back and `= delete` to make
  an operation a compile error. Declaring all five explicitly, once you declare
  any, saves everyone from remembering the suppression rules.
:::
