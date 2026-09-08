---
title: "Smart pointers"
navTitle: "Smart pointers"
summary: >-
  Owning heap memory without ever writing delete.
objectives:
  - Choose between unique_ptr, shared_ptr, and a raw pointer
  - Explain the cost of a shared_ptr's control block
  - Break a reference cycle with weak_ptr
status: complete
standard: c++20
requires: [raii, moving, rule-of-zero]
---

Part 3 kept pointing at these and never delivered them. Every time a chapter
said "put ownership in an automatic object and cleanup becomes unskippable", the
tool it had in mind was a smart pointer.

A smart pointer is RAII applied to a heap allocation: an object that holds a
pointer and deletes it in its destructor. That is the whole idea. What takes a
chapter is knowing which one to reach for, and when the answer is neither.

## unique_ptr: one owner

`std::unique_ptr<T>` owns a heap object and deletes it when it goes out of
scope. It cannot be copied — that would mean two owners — but it can be moved,
which transfers ownership.

```cpp run title="Ownership with no delete in sight" std=c++20
#include <iostream>
#include <memory>
#include <string>

struct Widget {
    std::string name;
    explicit Widget(std::string n) : name(std::move(n)) {
        std::cout << "  + " << name << " constructed\n";
    }
    ~Widget() { std::cout << "  - " << name << " destroyed\n"; }
};

int main() {
    std::cout << "entering scope\n";
    {
        auto widget = std::make_unique<Widget>("alpha");
        std::cout << "  using " << widget->name << '\n';
    }                                  // deleted here, on every exit path
    std::cout << "left scope\n";
}
```

Use `std::make_unique<T>(args...)` rather than `std::unique_ptr<T>(new T(...))`.
It is shorter, it never leaves a raw `new` unowned for even an instant, and it
does not repeat the type.

The pointer behaves like a pointer — `*p`, `p->member`, and a `bool` conversion
for testing — and costs exactly what a raw pointer costs:

```cpp run title="A unique_ptr is the size of a pointer" std=c++20
#include <iostream>
#include <memory>

int main() {
    std::cout << "int*                  " << sizeof(int*) << " bytes\n";
    std::cout << "unique_ptr<int>       " << sizeof(std::unique_ptr<int>) << " bytes\n";
    std::cout << "shared_ptr<int>       " << sizeof(std::shared_ptr<int>) << " bytes\n";
    std::cout << "weak_ptr<int>         " << sizeof(std::weak_ptr<int>) << " bytes\n";
}
```

`unique_ptr` is genuinely free: same size as a raw pointer, and the delete
compiles to the same instruction you would have written. There is no reason to
manage a single-owner heap object by hand.

### Moving, not copying

```cpp run expect-error title="Two owners is not a thing"
#include <memory>

int main() {
    auto a = std::make_unique<int>(1);
    auto b = a;              // error: the copy constructor is deleted
    return *b;
}
```

The error is the design. To hand ownership on, move it:

```cpp run title="Transferring ownership" std=c++20
#include <iostream>
#include <memory>
#include <utility>
#include <vector>

void consume(std::unique_ptr<int> owned) {
    std::cout << "  consume() now owns " << *owned << '\n';
}                                        // deleted here

int main() {
    auto value = std::make_unique<int>(42);

    std::vector<std::unique_ptr<int>> owners;
    owners.push_back(std::move(value));   // the vector owns it now

    std::cout << "value is " << (value ? "still set" : "empty") << '\n';
    std::cout << "vector holds " << *owners[0] << '\n';

    consume(std::move(owners[0]));
    std::cout << "element is " << (owners[0] ? "still set" : "empty") << '\n';
}
```

A `unique_ptr` parameter taken by value says, in the signature, *this function
takes ownership*. A caller cannot pass one without writing `std::move`, so
transfer of ownership is visible at the call site. That is a documentation
property the language enforces.

:::memviz
{
  "title": "unique_ptr: the owner is on the stack, the object is not",
  "code": "{\n    auto p = std::make_unique<Widget>();\n\n    use(*p);\n\n}  // scope ends",
  "steps": [
    {
      "caption": "make_unique allocates the Widget and hands the address to a stack object that now owns it.",
      "line": 2,
      "stack": [
        { "id": "p", "name": "p", "type": "unique_ptr<Widget>", "state": "new",
          "fields": [{ "k": "ptr", "v": "→", "anchor": "p.ptr" }] }
      ],
      "heap": [ { "id": "w", "name": "Widget", "value": "alive", "state": "new" } ],
      "arrows": [{ "from": "p.ptr", "to": "w" }]
    },
    {
      "caption": "Using it goes through the owner. There is exactly one unique_ptr pointing here — the type makes a second one impossible.",
      "line": 4,
      "stack": [
        { "id": "p", "name": "p", "type": "unique_ptr<Widget>",
          "fields": [{ "k": "ptr", "v": "→", "anchor": "p.ptr" }] }
      ],
      "heap": [ { "id": "w", "name": "Widget", "value": "alive" } ],
      "arrows": [{ "from": "p.ptr", "to": "w" }]
    },
    {
      "caption": "The scope ends. `p` is an automatic object, so its destructor runs — and its destructor is the delete you did not write.",
      "line": 6,
      "stack": [
        { "id": "p", "name": "p", "value": "destroyed", "state": "freed" }
      ],
      "heap": [ { "id": "w", "name": "Widget", "value": "deleted", "state": "freed" } ]
    }
  ]
}
:::

### Where unique_ptr earns its keep

Not for every heap object — for objects whose *type* is not known at compile
time. Runtime polymorphism needs a pointer, and that pointer needs an owner:

```cpp run title="A polymorphic object with an owner" std=c++20
#include <iostream>
#include <memory>
#include <vector>

struct Shape {
    virtual ~Shape() = default;              // required: see below
    virtual double area() const = 0;
};

struct Circle : Shape {
    double r;
    explicit Circle(double radius) : r(radius) {}
    double area() const override { return 3.14159265 * r * r; }
};

struct Square : Shape {
    double side;
    explicit Square(double s) : side(s) {}
    double area() const override { return side * side; }
};

int main() {
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(1.0));
    shapes.push_back(std::make_unique<Square>(2.0));

    double total = 0;
    for (const auto& shape : shapes) total += shape->area();

    std::cout << "total area " << total << '\n';
}
```

:::warning
`virtual ~Shape() = default;` is not optional. Deleting a derived object through
a base pointer with a non-virtual destructor is undefined behaviour — the
derived destructor never runs, and members it owned leak. Any class you intend
to delete polymorphically needs a virtual destructor. Chapter 3.7 covers why.
:::

## shared_ptr: shared ownership, at a price

`std::shared_ptr<T>` lets several owners share one object; it is destroyed when
the last of them goes away. It does this by keeping a **control block** next to
the object holding a reference count.

```cpp run title="Watching the count" std=c++20
#include <iostream>
#include <memory>

struct Resource {
    Resource() { std::cout << "  + acquired\n"; }
    ~Resource() { std::cout << "  - released\n"; }
};

int main() {
    auto first = std::make_shared<Resource>();
    std::cout << "count " << first.use_count() << '\n';
    {
        auto second = first;                  // a copy: count goes up
        std::cout << "count " << first.use_count() << '\n';
    }                                         // second dies: count goes down
    std::cout << "count " << first.use_count() << '\n';
    std::cout << "leaving main\n";
}
```

The object is released exactly once, when the count reaches zero. That is what
you are buying. What you are paying:

- **Two allocations, or one bigger one.** `make_shared` puts the object and the
  control block in a single allocation, which is why it is preferred over
  `std::shared_ptr<T>(new T)`.
- **An atomic increment and decrement per copy.** The count must be thread-safe,
  so copying a `shared_ptr` is not free even when only one thread exists.
- **Twice the pointer size**, as the `sizeof` output above showed: one pointer
  to the object, one to the control block.

```cpp run title="What sharing costs" std=c++20
#include <chrono>
#include <iostream>
#include <memory>

int main() {
    constexpr int rounds = 2'000'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto shared = std::make_shared<int>(1);
    auto unique = std::make_unique<int>(1);

    auto start = clock::now();
    long long sink = 0;
    for (int i = 0; i < rounds; ++i) {
        auto copy = shared;                 // atomic ++ and --
        sink += *copy;
    }
    auto mid = clock::now();

    for (int i = 0; i < rounds; ++i) {
        const int* observer = unique.get();  // no ownership, no counting
        sink += *observer;
    }
    auto finish = clock::now();

    std::cout << "shared_ptr copies: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "raw observation:   " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(checksum " << sink << ")\n";
}
```

:::pitfall
`shared_ptr` is popular far beyond the cases that need it, usually because it
makes an ownership question go away. It does not answer the question; it defers
it. If you cannot say which owner is expected to outlive the others, sharing
will not save you — it will just make the object's lifetime depend on whichever
copy happens to die last.
:::

Reach for `shared_ptr` when ownership is genuinely shared *and* the last owner
is not knowable at compile time — a cache handing out entries, a node in a graph
with several parents, an object captured by several concurrent tasks. Otherwise
prefer one `unique_ptr` owner and non-owning observers.

## Observing without owning

A raw pointer or reference is the right way to say "I use this and do not own
it". Passing a `shared_ptr` where an observer is wanted forces a needless
atomic increment and, worse, silently extends the object's lifetime.

```cpp run title="Take what you need, and no more" std=c++20
#include <iostream>
#include <memory>
#include <string>

// Owns nothing. Cannot extend a lifetime. Works with any owner.
void print_name(const std::string& name) {
    std::cout << "  " << name << '\n';
}

int main() {
    auto owned = std::make_unique<std::string>("from a unique_ptr");
    auto shared = std::make_shared<std::string>("from a shared_ptr");
    std::string local = "from a local";

    print_name(*owned);
    print_name(*shared);
    print_name(local);

    std::cout << "shared count is still " << shared.use_count() << '\n';
}
```

The rule of thumb for parameters:

| The function… | Takes |
|---|---|
| only reads or mutates the object | `const T&` or `T&` |
| takes ownership | `std::unique_ptr<T>` by value |
| keeps a copy of the owner, sharing lifetime | `std::shared_ptr<T>` by value |
| may or may not receive an object | `const T*` (nullable, non-owning) |

Most functions are in the first row. A function signature full of smart pointers
is usually a sign that ownership has not been thought about.

## weak_ptr, and the cycle it breaks

Reference counting has one failure mode: two objects that own each other. Their
counts never reach zero, and neither is ever destroyed.

```cpp run expect-ub title="A cycle that leaks" std=c++20
#include <iostream>
#include <memory>

struct Node {
    std::shared_ptr<Node> partner;
    ~Node() { std::cout << "  - node destroyed\n"; }
};

int main() {
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();

    a->partner = b;      // a keeps b alive
    b->partner = a;      // and b keeps a alive

    std::cout << "a.use_count() = " << a.use_count() << '\n';
    std::cout << "leaving main — watch for the destructor messages\n";
}
```

No destructor ran. Each node's count was still 1 when its named `shared_ptr`
died, because the other node was still holding a reference. LeakSanitizer
reports both allocations — this is one leak the tools *do* catch.

`std::weak_ptr` is a non-owning reference to a `shared_ptr`-managed object. It
does not raise the count, so it does not keep the object alive; to use it you
must ask for a `shared_ptr` back, and that ask can fail:

```cpp run title="The same structure, one direction weak" std=c++20
#include <iostream>
#include <memory>

struct Node {
    std::shared_ptr<Node> owns;       // strong, one direction
    std::weak_ptr<Node> observes;     // weak, the other
    int id = 0;
    ~Node() { std::cout << "  - node " << id << " destroyed\n"; }
};

int main() {
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->id = 1;
    b->id = 2;

    a->owns = b;          // a keeps b alive
    b->observes = a;      // b only watches a

    // Using a weak_ptr means asking whether the object is still there.
    if (auto locked = b->observes.lock()) {
        std::cout << "b can still see node " << locked->id << '\n';
    }

    std::cout << "a.use_count() = " << a.use_count() << '\n';
    std::cout << "leaving main\n";
}
```

Both destructors ran. The rule for cycles: **make one direction strong and the
other weak.** Parent owns child, child observes parent. Cache owns entries,
entries observe the cache.

`lock()` returning empty is not an error to be avoided — it is the answer to
"is it still alive?", and it is why `weak_ptr` is safe where a raw pointer to a
possibly-dead object would be a use-after-free.

## What not to do

```cpp run expect-ub title="Two control blocks, one object" std=c++20
#include <iostream>
#include <memory>

int main() {
    int* raw = new int(7);

    std::shared_ptr<int> first(raw);      // control block A, count 1
    std::shared_ptr<int> second(raw);     // control block B, count 1 — separate!

    std::cout << "first  count " << first.use_count() << '\n';
    std::cout << "second count " << second.use_count() << '\n';
    std::cout << "both believe they are the only owner\n";
}                                          // both delete: double free
```

Constructing two `shared_ptr`s from the same raw pointer creates two independent
counts, and both reach zero. This is the main reason to prefer `make_shared` and
`make_unique`: with no raw pointer in your code, there is nothing to hand to two
owners by mistake.

The same applies to `get()`. It returns a non-owning raw pointer for passing to
code that does not own — never for constructing another smart pointer, and never
for `delete`.

## Choosing

1. **Does it need to be on the heap at all?** A member, a local, or a
   `std::vector` element is simpler, faster, and cannot leak. Most objects do
   not need dynamic allocation. Reach for the heap when the size is a run-time
   value, the object must outlive the scope that made it, or the type is
   polymorphic.
2. **One owner?** `unique_ptr`. This is the default answer, and it costs nothing.
3. **Genuinely several owners, none obviously last?** `shared_ptr`.
4. **Using it but not owning it?** `const T&`, `T&`, or a raw `T*` if it may be
   absent. Never a smart pointer.
5. **Breaking a cycle, or observing something that may die?** `weak_ptr`.

## Check yourself

:::quiz
{
  "question": "A function needs to read a `Widget` that the caller owns via `std::shared_ptr<Widget>`. What should the parameter be?",
  "options": [
    { "text": "`std::shared_ptr<Widget>` by value", "why": "That copies the shared_ptr — an atomic increment and decrement — and silently extends the widget's lifetime for the duration of the call, to do something that only reads." },
    { "text": "`const std::shared_ptr<Widget>&`", "why": "It avoids the count change, but still ties the signature to one ownership model. A caller holding a unique_ptr, or a plain local Widget, cannot call it at all." },
    { "text": "`const Widget&`", "correct": true, "why": "Right. The function reads a widget; it does not care how the caller owns it. This works for shared_ptr, unique_ptr, a member, or a stack local, and costs nothing." },
    { "text": "`Widget*`", "why": "Workable, but it says the argument may be null and forces every call site to write `.get()` or `&`. Use a raw pointer only when absence is a real possibility." }
  ]
}
:::

:::quiz
{
  "question": "Why does `std::shared_ptr<int> a(raw); std::shared_ptr<int> b(raw);` cause a double free?",
  "options": [
    { "text": "Because raw pointers cannot be shared", "why": "They can be observed by many places safely. The problem is specifically about ownership being claimed twice." },
    { "text": "Each constructor makes its own control block, so there are two counts of 1 rather than one count of 2", "correct": true, "why": "Exactly. The count lives in the control block, not in the object, so two independently-constructed shared_ptrs never learn about each other, and both delete when their own count hits zero." },
    { "text": "The count is not thread-safe", "why": "It is atomic and thread-safe. This bug happens just as reliably in a single-threaded program." },
    { "text": "`raw` is leaked, not double-freed", "why": "The opposite: it is freed twice. Both shared_ptrs believe they hold the last reference." }
  ]
}
:::

## Practice

:::exercise unique-owner

:::exercise break-the-cycle

:::recap
- A smart pointer is RAII for a heap allocation: the destructor is the `delete`
  you never write.
- `unique_ptr` is one owner, costs the same as a raw pointer, and is the default
  choice. It moves rather than copies, so ownership transfer is visible in the
  signature.
- `shared_ptr` buys shared ownership with a control block: two allocations
  unless you use `make_shared`, atomic counting on every copy, and double the
  size. Use it when ownership is genuinely shared, not to avoid deciding.
- Observers should take `const T&`, `T&`, or a raw `T*` — never a smart pointer.
- Reference cycles never reach zero. Make one direction `weak_ptr` and `lock()`
  it to use it.
- Prefer `make_unique` and `make_shared`: with no raw pointer in your code,
  nothing can be handed to two owners.
- A class you delete through a base pointer needs a `virtual` destructor.
:::
