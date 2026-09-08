---
title: "Copying"
navTitle: "Copying"
summary: >-
  What it means to duplicate an object, and what the compiler writes for you.
objectives:
  - Distinguish a shallow copy from a deep copy
  - Write a correct copy constructor and copy assignment operator
  - Explain the self-assignment problem
status: complete
standard: c++20
requires: [raii]
---

Copying happens more often than it looks. Passing by value copies. Returning by
value may copy. Putting an object in a container copies. Assigning copies. For
types made of other well-behaved types, all of that is correct and you never
think about it — that is the rule of zero working.

This chapter is about the case where it is not automatic: a type that owns a raw
resource, where the compiler's guess is wrong.

## What the compiler writes for you

If you do not declare them, the compiler generates a **copy constructor** and a
**copy assignment operator** that copy each member in turn.

```cpp run title="Two different operations" std=c++20
#include <iostream>
#include <string>

struct Pair {
    std::string name;
    int count;
};

int main() {
    Pair a{"alpha", 1};

    Pair b = a;        // copy CONSTRUCTOR: b is being created
    Pair c{"gamma", 3};
    c = a;             // copy ASSIGNMENT: c already exists

    b.count = 99;

    std::cout << "a: " << a.name << ' ' << a.count << '\n';
    std::cout << "b: " << b.name << ' ' << b.count << '\n';
    std::cout << "c: " << c.name << ' ' << c.count << '\n';
}
```

The distinction matters because their jobs differ. A copy constructor builds a
new object from nothing; a copy assignment operator has to deal with an object
that already holds something, which it must release first.

For `Pair` both are correct as generated, because `std::string` knows how to
copy itself. Memberwise copying is right whenever every member's copy is right.

## Shallow versus deep

It stops being right when a member is a raw pointer, because copying a pointer
duplicates the *address*, not the thing at the far end.

```cpp run expect-ub title="A shallow copy of an owner" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 10;

    Buffer b = a;      // memberwise: b.data_ == a.data_
    b[0] = 20;

    std::cout << "a[0] = " << a[0] << " (we only wrote to b)\n";
}                      // both destructors delete the same pointer
```

Two problems, and only the second one crashes. Writing through `b` changed `a`,
because there is one array with two owners. Then both destructors ran
`delete[]` on it.

:::memviz
{
  "title": "Shallow copy: one buffer, two owners",
  "code": "Buffer a{4};\na[0] = 10;\n\nBuffer b = a;\nb[0] = 20;\n\n// both destructors run",
  "steps": [
    {
      "caption": "`a` owns a heap allocation. One owner, one buffer — everything is fine.",
      "line": 1,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer", "state": "new",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "4" }] }
      ],
      "heap": [ { "id": "buf", "name": "int[4]", "value": "10, 0, 0, 0", "state": "new" } ],
      "arrows": [{ "from": "a.d", "to": "buf" }]
    },
    {
      "caption": "The compiler-generated copy copies each member — including the pointer. Nothing new was allocated.",
      "line": 4,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "4" }] },
        { "id": "b", "name": "b", "type": "Buffer", "state": "danger",
          "fields": [{ "k": "data_", "v": "→ (same!)", "anchor": "b.d" }, { "k": "size_", "v": "4" }] }
      ],
      "heap": [ { "id": "buf", "name": "int[4]", "value": "10, 0, 0, 0", "state": "danger",
                  "note": "two owners" } ],
      "arrows": [{ "from": "a.d", "to": "buf" }, { "from": "b.d", "to": "buf" }]
    },
    {
      "caption": "Writing through `b` changes what `a` sees. The two objects were never independent.",
      "line": 5,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer",
          "fields": [{ "k": "data_", "v": "→", "anchor": "a.d" }, { "k": "size_", "v": "4" }] },
        { "id": "b", "name": "b", "type": "Buffer",
          "fields": [{ "k": "data_", "v": "→ (same!)", "anchor": "b.d" }, { "k": "size_", "v": "4" }] }
      ],
      "heap": [ { "id": "buf", "name": "int[4]", "value": "20, 0, 0, 0", "state": "danger" } ],
      "arrows": [{ "from": "a.d", "to": "buf" }, { "from": "b.d", "to": "buf" }]
    },
    {
      "caption": "`b` is destroyed and frees the buffer. `a` is now a dangling owner — and its destructor is next.",
      "line": 7,
      "stack": [
        { "id": "a", "name": "a", "type": "Buffer", "state": "danger",
          "fields": [{ "k": "data_", "v": "→ freed", "anchor": "a.d" }, { "k": "size_", "v": "4" }] },
        { "id": "b", "name": "b", "value": "destroyed", "state": "freed" }
      ],
      "heap": [ { "id": "buf", "name": "int[4]", "value": "freed", "state": "freed" } ],
      "arrows": [{ "from": "a.d", "to": "buf", "state": "dangling" }]
    },
    {
      "caption": "`a`'s destructor frees the same block a second time. That is a double free — the allocator's bookkeeping is now corrupt.",
      "line": 7,
      "stack": [
        { "id": "a", "name": "a", "value": "destroyed", "state": "freed" },
        { "id": "b", "name": "b", "value": "destroyed", "state": "freed" }
      ],
      "heap": [ { "id": "buf", "name": "int[4]", "value": "freed TWICE", "state": "danger" } ]
    }
  ]
}
:::

A **deep copy** allocates its own storage and duplicates the contents, so the two
objects are genuinely independent:

```cpp run title="A copy constructor that allocates" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    // Deep copy: new storage, contents duplicated.
    Buffer(const Buffer& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
    }

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 10;

    Buffer b = a;
    b[0] = 20;

    std::cout << "a[0] = " << a[0] << ", b[0] = " << b[0] << " — independent\n";
}
```

## Copy assignment, and the two traps

Assignment is harder than construction, because the target already owns
something. The obvious version has two bugs:

```cpp run title="A copy assignment with both classic bugs" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
    }

    Buffer& operator=(const Buffer& other) {
        delete[] data_;                        // release what we hold
        data_ = new int[other.size_];          // ... but if other IS us,
        size_ = other.size_;                   //     we just freed the source
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
        return *this;
    }

    int& operator[](std::size_t i) { return data_[i]; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 7;
    a = a;                                     // self-assignment
    std::cout << "a[0] = " << a[0] << '\n';
}
```

**Self-assignment.** `a = a` looks absurd written out, but it arrives through
references and aliases — `values[i] = values[j]` where the indices happen to
match, or `*p = *q` where both point at the same object.

Follow what happens when `other` *is* `*this`. `delete[] data_` frees the array
holding the 7. `data_ = new int[...]` installs a fresh, uninitialised array —
and because `other` is the same object, `other.data_` now names that same fresh
array. The loop then copies the new array onto itself, element by element. The
original contents were freed two lines earlier and are simply gone.

Look at what the program printed: not 7. And look at what the sanitizers said:
nothing. At the level of memory this program is impeccable — every allocation is
freed exactly once, and every read is inside a live allocation. The bug is purely
one of *meaning*, so no tool catches it. A silent, correct-looking object with
the wrong contents is a considerably worse outcome than a crash.

**Forgetting to return `*this`.** Assignment returns a reference to the target
so that `a = b = c` chains. Omitting it is a compile error for a declared return
type, which is one bug the compiler does catch.

The direct fix is a self-check:

```cpp run title="Guarding against self-assignment" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
    }

    Buffer& operator=(const Buffer& other) {
        if (this == &other) return *this;      // the guard

        int* fresh = new int[other.size_];     // allocate BEFORE destroying
        for (std::size_t i = 0; i < other.size_; ++i) fresh[i] = other.data_[i];

        delete[] data_;
        data_ = fresh;
        size_ = other.size_;
        return *this;
    }

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 7;
    a = a;
    std::cout << "self-assignment survived: a[0] = " << a[0] << '\n';

    Buffer b{2};
    b = a;
    std::cout << "b now has " << b.size() << " elements, b[0] = " << b[0] << '\n';
}
```

Note the ordering: allocate the new buffer *first*, and only free the old one
once the allocation has succeeded. If `new` throws, the object is still exactly
as it was — the **strong exception guarantee**. The naive version, which frees
first, leaves a destroyed object behind if the allocation fails.

## copy-and-swap

There is a well-known idiom that gets self-assignment safety and the strong
guarantee without writing either explicitly:

```cpp run title="copy-and-swap" std=c++20
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

    // Take the parameter BY VALUE: the copy is made by the copy constructor,
    // then swapped in. Self-assignment is harmless; a throw happens before
    // anything is modified.
    Buffer& operator=(Buffer other) {
        swap(*this, other);
        return *this;
    }                          // `other` destructs here, taking the old buffer

    friend void swap(Buffer& first, Buffer& second) noexcept {
        std::swap(first.data_, second.data_);
        std::swap(first.size_, second.size_);
    }

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 7;
    a = a;
    Buffer b{2};
    b = a;

    std::cout << "a[0] = " << a[0] << ", b.size() = " << b.size() << '\n';
}
```

One function instead of two branches, no self-check needed, and the old
resources are released by the parameter's destructor. The cost is that it always
copies, even when assigning from something about to be destroyed — which is what
the next chapter is about.

:::pitfall
The copy constructor must not be written in terms of copy assignment
(construct-then-assign): the members are uninitialised when the constructor
body starts, so assigning would `delete[]` a garbage pointer. Constructors
initialise; assignment operators replace. They are genuinely different jobs.
:::

## The cost of copying

Deep copies are correct, and they are not free:

```cpp run title="What a container copy costs" std=c++20
#include <chrono>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> source(2'000'000, 1);
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    std::vector<int> copy = source;                // deep copy: 8 MB duplicated
    auto mid = clock::now();

    std::vector<int> moved = std::move(source);    // ownership transfer
    auto finish = clock::now();

    std::cout << "copy: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "move: " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(copy has " << copy.size() << ", moved has " << moved.size()
              << ", source now has " << source.size() << ")\n";
}
```

The copy duplicated eight megabytes. The move copied three pointers. When the
source is about to be destroyed anyway, paying for the copy is pure waste —
which is exactly the problem move semantics exists to solve.

## Check yourself

:::quiz
{
  "question": "Why must copy assignment guard against self-assignment?",
  "options": [
    { "text": "Because `a = a` is a compile error otherwise", "why": "It compiles fine. The trouble is entirely at run time, and it does not happen every time — only for owners of raw resources." },
    { "text": "Because releasing the target's resource first destroys the source, which is the same object", "correct": true, "why": "Exactly. `delete[] data_` frees the very buffer the function is about to read from. It rarely appears as literal `a = a`; it arrives as `v[i] = v[j]` where the indices happen to match." },
    { "text": "Because the reference count would be wrong", "why": "There is no reference count here — that is shared_ptr's mechanism. This class owns its buffer outright." },
    { "text": "It is not necessary if you use copy-and-swap", "correct": true, "why": "Also true. Copy-and-swap makes the copy before touching anything, so a self-assignment is a harmless copy followed by a swap with itself. That is a large part of the idiom's appeal." }
  ]
}
:::

:::quiz
{
  "question": "In a copy assignment operator, why allocate the new buffer before deleting the old one?",
  "options": [
    { "text": "It is faster", "why": "It is not faster; both orderings do one allocation and one deallocation." },
    { "text": "So that a failed allocation leaves the object unchanged", "correct": true, "why": "The strong exception guarantee. If `new` throws after you have already deleted, the object is left owning a dangling pointer and its destructor will double-free. Allocating first means a throw changes nothing." },
    { "text": "Because delete invalidates the source object", "why": "Only when the source *is* the target — that is the self-assignment problem, which the `this == &other` check handles separately." },
    { "text": "To avoid memory fragmentation", "why": "Fragmentation is an allocator concern and not affected by the order of two operations within one function." }
  ]
}
:::

## Practice

:::exercise deep-copy

:::recap
- The compiler generates memberwise copy construction and copy assignment. That
  is correct whenever every member copies correctly — which is the rule of zero.
- A raw pointer member makes memberwise copying a *shallow* copy: two owners,
  one resource, ending in a double free.
- A copy constructor builds from nothing; copy assignment must release what the
  target already holds. They are different jobs and one cannot be written in
  terms of the other.
- Copy assignment must survive self-assignment, and should allocate before
  releasing so a failed allocation leaves the object untouched.
- copy-and-swap gets both properties from a by-value parameter and a `swap`.
- Deep copies cost time proportional to the data. When the source is about to
  die, that cost is avoidable — see the next chapter.
:::
