---
title: "Moving"
navTitle: "Moving"
summary: >-
  Transferring ownership instead of duplicating, and what std::move really does.
objectives:
  - Explain what std::move does and does not do
  - Write a move constructor that leaves the source valid
  - Predict when the compiler moves instead of copies
status: complete
standard: c++20
requires: [copying]
---

The last chapter ended with a measurement: copying a two-million-element vector
took milliseconds, and moving it took no measurable time at all. This chapter is
about why, and how to give your own types the same property.

The idea is simple. When the source object is about to be destroyed anyway,
duplicating its contents is waste. Instead of copying the data, take it — and
leave the source in a state that is safe to destroy.

## Copy versus move, side by side

```cpp run title="The same class, both operations" std=c++20
#include <iostream>
#include <string>
#include <utility>

struct Tracked {
    std::string data;

    Tracked(std::string d) : data(std::move(d)) {}

    Tracked(const Tracked& other) : data(other.data) {
        std::cout << "  copy: duplicated " << data.size() << " bytes\n";
    }

    Tracked(Tracked&& other) noexcept : data(std::move(other.data)) {
        std::cout << "  move: took the buffer, source now has "
                  << other.data.size() << " bytes\n";
    }
};

int main() {
    Tracked original{std::string(1000, 'x')};

    std::cout << "copying:\n";
    Tracked copied = original;

    std::cout << "moving:\n";
    Tracked moved = std::move(original);

    std::cout << "original now holds " << original.data.size() << " bytes\n";
}
```

The copy allocated a thousand bytes and duplicated them. The move copied a
pointer, a size, and a capacity — three machine words — and left the source
empty.

Note the source is *empty*, not broken. That distinction is the whole contract
of a move.

## What std::move actually does

This is the most misunderstood name in the standard library. **`std::move` does
not move anything.** It performs a cast.

```cpp run title="std::move is a cast, and nothing else" std=c++20
#include <iostream>
#include <string>
#include <utility>

int main() {
    std::string source = "still here";

    // std::move only produces an rvalue reference. Nothing has happened yet.
    std::string&& reference = std::move(source);

    std::cout << "after std::move alone: \"" << source << "\"\n";
    std::cout << "(nothing was moved — no constructor ran)\n";

    // The move happens HERE, because this initialisation selects the
    // move constructor.
    std::string destination = std::move(source);

    std::cout << "after constructing from it: \"" << source << "\"\n";
    std::cout << "destination: \"" << destination << "\"\n";
}
```

`std::move(x)` casts `x` to an rvalue reference. That changes which overload
gets selected — a constructor or assignment operator taking `T&&` becomes
viable, and it is preferred over the one taking `const T&`. The actual transfer
is done by that constructor.

Read `std::move(x)` as **"I am done with x; you may take from it if you like."**
It is a permission, not an action. If nothing takes it, nothing happens.

:::pitfall
`std::move` on a `const` object silently does nothing useful. `const T&&` will
not bind to a `T&&` parameter, so overload resolution falls back to the copy
constructor, and you get a copy with no warning. If a move you expected is not
happening, check whether the source is const.
:::

## lvalues and rvalues

Two words for a distinction the language has always had. Loosely:

- An **lvalue** is an expression naming an object with an identity you can take
  the address of. Variables are lvalues.
- An **rvalue** is a temporary — the result of an expression that is about to
  vanish. Function return values and literals are rvalues.

The compiler uses this to decide, on its own, when moving is safe:

```cpp run title="The compiler moves from temporaries automatically" std=c++20
#include <iostream>
#include <string>
#include <vector>

struct Noisy {
    std::vector<int> data;
    Noisy(std::size_t n) : data(n) {}
    Noisy(const Noisy& o) : data(o.data) { std::cout << "  copy\n"; }
    Noisy(Noisy&& o) noexcept : data(std::move(o.data)) { std::cout << "  move\n"; }
};

Noisy make() { return Noisy{100}; }

int main() {
    std::cout << "from a named variable:\n";
    Noisy a{100};
    Noisy b = a;                 // a is an lvalue: copy

    std::cout << "from a temporary:\n";
    Noisy c = make();            // the result is an rvalue: move (or elided)

    std::cout << "from a named variable, with permission:\n";
    Noisy d = std::move(a);      // cast to rvalue: move

    std::cout << "sizes: " << b.data.size() << ' ' << c.data.size()
              << ' ' << d.data.size() << '\n';
}
```

You do not need `std::move` for temporaries — the compiler already knows they
are expendable. You need it when you want to give up a *named* object, because
the compiler must assume a name might be used again.

## Writing move operations

A move constructor takes `T&&`, steals the resources, and leaves the source in a
state that is valid to destroy and valid to assign to.

```cpp run title="A buffer that can be moved" std=c++20
#include <cstddef>
#include <iostream>
#include <utility>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
        std::cout << "  copied " << size_ << " ints\n";
    }

    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {     // take
        other.data_ = nullptr;                         // and leave it empty
        other.size_ = 0;
        std::cout << "  moved (no allocation)\n";
    }

    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;                            // release ours
            data_ = other.data_;                       // take theirs
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
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

    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{1000};
    Buffer b = a;                  // copy
    Buffer c = std::move(a);       // move

    std::cout << "a.size() = " << a.size() << " (moved from)\n";
    std::cout << "c.size() = " << c.size() << '\n';

    Buffer d{5};
    d = std::move(c);              // move assignment
    std::cout << "d.size() = " << d.size() << ", c.size() = " << c.size() << '\n';
}
```

Three details in that code carry weight.

**Null the source pointer.** Not because it is tidy, but because the source's
destructor will still run, and `delete[]` on the stolen pointer would free the
buffer the destination now owns. `delete[] nullptr` is defined to do nothing,
which is why nulling is sufficient.

**Set the source's size to zero.** The moved-from object must be *consistent*,
not merely destructible. Leaving `size_` at 1000 with a null `data_` makes any
later `size()` call a lie and any indexing a crash.

**Mark them `noexcept`.** This is not decoration — see below.

:::memviz
{
  "title": "A move transfers ownership; a copy duplicates it",
  "code": "Buffer a{1000};\n\nBuffer b = a;            // copy\n\nBuffer c = std::move(a); // move",
  "steps": [
    {
      "caption": "`a` owns a heap array of 1000 ints.",
      "line": 1,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer", "state": "new",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "1000" }] }
      ],
      "heap": [ { "id": "buf1", "name": "int[1000]", "value": "4000 bytes", "state": "new" } ],
      "arrows": [{ "from": "a.d", "to": "buf1" }]
    },
    {
      "caption": "Copying allocates a second array and duplicates all 4000 bytes. Cost scales with the size of the data.",
      "line": 3,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "1000" }] },
        { "id": "b", "name": "b", "type": "Buffer", "state": "new",
          "fields": [{ "k": "data_", "v": "→", "anchor": "b.d" }, { "k": "size_", "v": "1000" }] }
      ],
      "heap": [
        { "id": "buf1", "name": "int[1000]", "value": "4000 bytes" },
        { "id": "buf2", "name": "int[1000]", "value": "a duplicate", "state": "new" }
      ],
      "arrows": [{ "from": "a.d", "to": "buf1" }, { "from": "b.d", "to": "buf2" }]
    },
    {
      "caption": "The move copies two members into `c` — the pointer and the size. No allocation, and briefly both name the same array.",
      "line": 5,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer", "state": "danger",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "1000" }] },
        { "id": "c", "name": "c", "type": "Buffer", "state": "new",
          "fields": [{ "k": "data_", "v": "→", "anchor": "c.d" }, { "k": "size_", "v": "1000" }] }
      ],
      "heap": [ { "id": "buf1", "name": "int[1000]", "value": "4000 bytes", "state": "danger",
                  "note": "two owners — for two lines only" } ],
      "arrows": [{ "from": "a.d", "to": "buf1" }, { "from": "c.d", "to": "buf1" }]
    },
    {
      "caption": "The move constructor nulls the source. Now there is exactly one owner again — and `a`'s destructor has nothing to free.",
      "line": 5,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer", "state": "moved",
          "fields": [{ "k": "data_", "v": "nullptr" }, { "k": "size_", "v": "0" }],
          "note": "valid, empty, safe to destroy" },
        { "id": "c", "name": "c", "type": "Buffer",
          "fields": [{ "k": "data_", "v": "→", "anchor": "c.d" }, { "k": "size_", "v": "1000" }] }
      ],
      "heap": [ { "id": "buf1", "name": "int[1000]", "value": "4000 bytes" } ],
      "arrows": [{ "from": "c.d", "to": "buf1" }]
    }
  ]
}
:::

## What a moved-from object may be

The standard requires that a moved-from standard-library object be in a *valid
but unspecified* state. Valid means you may safely destroy it, assign to it, and
call any operation with no precondition. Unspecified means you may not assume
*what* it contains.

```cpp run title="What you may still do with a moved-from object" std=c++20
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<int> source{1, 2, 3};
    std::vector<int> taken = std::move(source);

    // Legal: assigning gives it a definite value again.
    source = {7, 8};
    std::cout << "reassigned: " << source.size() << " elements\n";

    std::string text = "hello";
    std::string stolen = std::move(text);

    // Legal but unwise: clear() has no precondition, so this is defined —
    // but relying on what text held first would not be.
    text.clear();
    text = "reused";
    std::cout << "text is usable again: " << text << '\n';
}
```

In practice, implementations leave a moved-from `vector` or `string` empty, and
it is tempting to rely on that. Do not: it is not guaranteed, and for your own
types you should promise only what you actually enforce. The safe rule is
**assign to a moved-from object before reading it**.

## noexcept is not optional

`std::vector` grows by allocating a bigger block and transferring the elements.
If it moves them and a move throws halfway through, the old block is already
half-destroyed and there is no way back. So `vector` only moves your elements if
their move constructor promises not to throw. Otherwise it copies.

```cpp run title="The cost of a missing noexcept" std=c++20
#include <chrono>
#include <iostream>
#include <string>
#include <vector>

struct WithNoexcept {
    std::string data;
    WithNoexcept(std::size_t n) : data(n, 'x') {}
    WithNoexcept(const WithNoexcept&) = default;
    WithNoexcept(WithNoexcept&& o) noexcept : data(std::move(o.data)) {}
    WithNoexcept& operator=(WithNoexcept&&) noexcept = default;
};

struct WithoutNoexcept {
    std::string data;
    WithoutNoexcept(std::size_t n) : data(n, 'x') {}
    WithoutNoexcept(const WithoutNoexcept&) = default;
    WithoutNoexcept(WithoutNoexcept&& o) : data(std::move(o.data)) {}   // no noexcept
    WithoutNoexcept& operator=(WithoutNoexcept&&) = default;
};

template <class T>
long long time_growth() {
    using clock = std::chrono::steady_clock;
    auto start = clock::now();
    std::vector<T> v;
    for (int i = 0; i < 20000; ++i) v.emplace_back(200);   // forces reallocations
    auto finish = clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(finish - start).count();
}

int main() {
    std::cout << "move is noexcept:  " << time_growth<WithNoexcept>()    << " ms\n";
    std::cout << "move may throw:    " << time_growth<WithoutNoexcept>() << " ms\n";
}
```

Same code, same data, and the only difference is one keyword. Every move
operation you write should be `noexcept`, and a correct one always can be — it
transfers pointers and never allocates.

## Where moves happen without you asking

```cpp run title="Moves the compiler inserts for you" std=c++20
#include <iostream>
#include <string>
#include <vector>

std::vector<std::string> collect() {
    std::vector<std::string> result;
    result.push_back("alpha");
    result.push_back(std::string(1000, 'b'));   // temporary: moved in

    return result;    // no copy: elided, or moved
}

int main() {
    std::vector<std::string> values = collect();
    std::cout << values.size() << " items, second is "
              << values[1].size() << " bytes\n";

    std::vector<std::string> destination;
    destination.push_back(std::move(values[0]));   // explicit: we are done with it

    std::cout << "moved-from element is now " << values[0].size() << " bytes\n";
}
```

Returning a local by value does not copy. Since C++17 the compiler is *required*
to elide the copy in many cases, and where it cannot elide, it moves. `return
result;` is the right way to return a large object, and writing
`return std::move(result);` is actively worse — it prevents the elision that
would otherwise remove the operation entirely. Chapter 7.5 covers exactly when.

## Check yourself

:::quiz
{
  "question": "What does `std::move(x)` do?",
  "options": [
    { "text": "It moves x's contents into a temporary", "why": "It performs no transfer at all. Run the sample above: after `std::move(source)` alone, source is unchanged." },
    { "text": "It casts x to an rvalue reference, changing which overload is selected", "correct": true, "why": "Exactly. It is a cast and nothing more. If no move constructor or move assignment is selected as a result, nothing happens." },
    { "text": "It marks x for destruction at the end of the scope", "why": "x is destroyed at the end of its scope regardless — that is ordinary lifetime, unaffected by std::move." },
    { "text": "It frees x's memory immediately", "why": "Nothing is freed. If a move constructor then takes the buffer, the memory is transferred rather than released." }
  ]
}
:::

:::quiz
{
  "question": "Why must a move constructor be marked `noexcept`?",
  "options": [
    { "text": "It is required by the standard for all move constructors", "why": "It is not required. It compiles fine without, and quietly costs you performance — which is a worse failure mode than an error." },
    { "text": "So containers like vector will move elements when reallocating instead of copying them", "correct": true, "why": "Reallocation must be able to leave the vector intact if something throws partway. A throwing move makes that impossible, so vector falls back to copying — as the timing above shows." },
    { "text": "Because move operations cannot throw anyway", "why": "The compiler cannot know that. A move that constructs a member or allocates could throw; noexcept is you promising yours does not." },
    { "text": "To allow the compiler to elide the move entirely", "why": "Elision is governed by the rules on temporaries and return values, and applies regardless of noexcept." }
  ]
}
:::

## Practice

:::exercise move-not-copy

:::exercise sink-parameter

:::recap
- Moving transfers ownership instead of duplicating. Its cost does not scale
  with the amount of data.
- `std::move` moves nothing: it casts to an rvalue reference so that a `T&&`
  overload is chosen. It is permission, not action.
- Temporaries are moved from automatically. `std::move` is for giving up a
  *named* object.
- A move must leave the source valid and consistent — null the pointer, zero the
  size — because its destructor still runs.
- Mark move operations `noexcept`, or `std::vector` will copy your elements when
  it grows.
- `return local;` already avoids the copy. `return std::move(local);` is worse:
  it blocks elision.
:::
