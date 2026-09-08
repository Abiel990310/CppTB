---
title: "Constructors, destructors, and RAII"
navTitle: "RAII"
summary: >-
  The idea that makes C++ safe without a garbage collector.
objectives:
  - Explain RAII in terms of construction and destruction
  - Write a class that owns a resource and releases it exactly once
  - Identify a resource leak that RAII would have prevented
status: complete
standard: c++20
requires: [structs-and-classes, stack-and-heap, lifetime-and-scope]
---

This is the most important chapter in the book. Everything C++ does about
safety — smart pointers, containers, locks, files, sockets — is one idea applied
over and over, and this is the idea.

It has an unhelpful name: **Resource Acquisition Is Initialisation**, or RAII.
The name describes the mechanism rather than the benefit. A better summary is:

> Tie every resource to the lifetime of an object, so that releasing it becomes
> the compiler's job rather than yours.

## The problem it solves

You have seen the shape twice already. Here it is once more, as small as it
gets:

```cpp run title="Every exit path is a chance to leak" std=c++20
#include <cstdio>
#include <iostream>

void write_report(bool fail) {
    std::FILE* file = std::fopen("/tmp/cpptb-report.txt", "w");
    if (!file) return;

    std::fputs("line one\n", file);

    if (fail) {
        std::cout << "bailing out\n";
        return;                    // the file is never closed
    }

    std::fputs("line two\n", file);
    std::fclose(file);
}

int main() {
    for (int i = 0; i < 200; ++i) write_report(true);
    std::cout << "leaked 200 file handles, and nothing complained\n";
}
```

Look at what did *not* happen. This book compiles every sample with
AddressSanitizer and leak detection on, and it caught the leaked `new int[1000]`
back in Chapter 2.5 without hesitation. Here it says nothing at all: 200 file
handles were opened and abandoned, and the program exited cleanly.

That is not a flaw in the tool. LeakSanitizer reports memory that is
*unreachable* at exit; the C runtime keeps every open `FILE` on an internal
list, so the memory is still reachable and the handle is still, as far as the
allocator is concerned, in use. The operating system closes them when the
process dies, so a short program gets away with it.

A long-lived one does not. File descriptors are a per-process limit, commonly
1024. A server leaking one per request stops being able to open anything at all
after a few minutes, and the error surfaces somewhere entirely unrelated to the
code that caused it.

:::pitfall
Memory is the *easiest* resource to leak safely: the sanitizers catch it, and
the operating system reclaims it. File handles, sockets, locks, and database
connections have none of those safety nets. Do not treat "the leak checker is
quiet" as evidence that nothing leaked.
:::

The `fclose` is right there. It just is not on every path out. Add a third
early return next year, or an exception from something in the middle, and the
bug reappears — not because anyone was careless, but because *correctness
depends on remembering something at every exit*, and there is no mechanism
holding you to it.

You cannot fix this class of bug by being careful. You fix it by making it
impossible.

## The mechanism

Chapter 2.4 established the guarantee this rests on: **an automatic object's
destructor runs when its scope ends, on every exit path, including exceptions.**
There is no way out of a scope that skips it.

So: put the resource in an object. Acquire it in the constructor, release it in
the destructor. The destructor guarantee becomes the release guarantee.

```cpp run title="The same function, with nothing to remember" std=c++20
#include <cstdio>
#include <iostream>
#include <stdexcept>

class File {
public:
    File(const char* path, const char* mode) : handle_(std::fopen(path, mode)) {
        if (!handle_) throw std::runtime_error("could not open file");
    }

    ~File() {
        if (handle_) std::fclose(handle_);
    }

    void write(const char* text) { std::fputs(text, handle_); }

private:
    std::FILE* handle_;
};

void write_report(bool fail) {
    File file{"/tmp/cpptb-report.txt", "w"};   // acquired

    file.write("line one\n");

    if (fail) {
        std::cout << "bailing out\n";
        return;                                // released, automatically
    }

    file.write("line two\n");
}                                              // released here too

int main() {
    write_report(true);
    write_report(false);
    std::cout << "no leak on either path\n";
}
```

The `fclose` now appears exactly once, in the destructor, and runs on both
paths. Add a third early return and it will run there too, without anyone
touching it. Throw an exception from the middle and stack unwinding runs it.

That is the whole technique.

:::memviz
{
  "title": "The resource is tied to the object",
  "code": "void write_report(bool fail) {\n    File file{path, \"w\"};\n\n    file.write(\"line one\\n\");\n\n    if (fail) return;\n\n    file.write(\"line two\\n\");\n}",
  "steps": [
    {
      "caption": "The constructor runs. It acquires the OS file handle and stores it — acquisition *is* initialisation.",
      "line": 2,
      "stack": [
        { "id": "file", "name": "file", "type": "File", "state": "new",
          "fields": [{ "k": "handle_", "v": "→ open handle", "anchor": "file.h" }] }
      ],
      "heap": [
        { "id": "os", "name": "OS file handle", "type": "resource", "value": "open", "state": "new" }
      ],
      "arrows": [{ "from": "file.h", "to": "os" }]
    },
    {
      "caption": "Work happens through the object. The raw handle is private, so nothing outside can close it or lose it.",
      "line": 4,
      "stack": [
        { "id": "file", "name": "file", "type": "File",
          "fields": [{ "k": "handle_", "v": "→ open handle", "anchor": "file.h" }] }
      ],
      "heap": [
        { "id": "os", "name": "OS file handle", "type": "resource", "value": "open" }
      ],
      "arrows": [{ "from": "file.h", "to": "os" }]
    },
    {
      "caption": "An early return. Control is leaving the scope — which means `file` is about to be destroyed, whatever the reason for leaving.",
      "line": 6,
      "stack": [
        { "id": "file", "name": "file", "type": "File", "state": "danger",
          "fields": [{ "k": "handle_", "v": "→ open handle", "anchor": "file.h" }],
          "note": "scope ending" }
      ],
      "heap": [
        { "id": "os", "name": "OS file handle", "type": "resource", "value": "open" }
      ],
      "arrows": [{ "from": "file.h", "to": "os" }]
    },
    {
      "caption": "The destructor runs and closes the handle. Nobody wrote a call to it, and no exit path can avoid it.",
      "line": 9,
      "stack": [
        { "id": "file", "name": "file", "type": "File", "value": "destroyed", "state": "freed" }
      ],
      "heap": [
        { "id": "os", "name": "OS file handle", "type": "resource", "value": "closed", "state": "freed" }
      ]
    }
  ]
}
:::

## It is not only about memory

Memory is the most discussed resource, but the pattern applies to anything that
must be given back. The standard library ships RAII types for most of them:

| Resource | RAII type |
|---|---|
| Heap memory, one owner | `std::unique_ptr<T>` |
| Heap memory, shared | `std::shared_ptr<T>` |
| A growable array | `std::vector<T>` |
| Text | `std::string` |
| A mutex lock | `std::lock_guard`, `std::unique_lock` |
| A file | `std::fstream` |
| A thread | `std::jthread` (C++20) |

A lock is the clearest case after memory, because the failure is not a leak but
a deadlock:

```cpp run title="A lock that cannot be left held" std=c++20
#include <iostream>
#include <mutex>
#include <stdexcept>

std::mutex data_mutex;
int shared_value = 0;

void update(int amount, bool fail) {
    std::lock_guard<std::mutex> lock{data_mutex};   // locked here

    shared_value += amount;
    if (fail) throw std::runtime_error("update failed");

    shared_value += amount;
}                                                   // unlocked here, always

int main() {
    update(1, false);
    try {
        update(10, true);
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << '\n';
    }

    // If the throw had left the mutex locked, this would deadlock forever.
    update(100, false);
    std::cout << "shared_value = " << shared_value << '\n';
}
```

Had `update` locked and unlocked by hand, the throw would have jumped over the
unlock and the next call would have blocked forever — a hang with no stack trace
pointing at the cause. `lock_guard` makes that impossible.

## Writing one correctly

A resource-owning class has to answer one more question than an ordinary one:
what happens when it is copied? Consider the naive version:

```cpp run expect-ub title="What copying does to a naive owner" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]), size_(n) {}
    ~Buffer() { delete[] data_; }

    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    Buffer b = a;          // compiler-generated copy: copies the POINTER
    std::cout << "both claim " << a.size() << " elements\n";
}                          // both destructors run delete[] on the same pointer
```

The compiler generated a copy constructor that copied both members — including
the pointer. Now two objects believe they own the same allocation, and both free
it. That is a **double free**, which corrupts the allocator's bookkeeping.
AddressSanitizer catches it here; in production it is a crash somewhere
unrelated, or a security vulnerability.

There are two honest fixes.

**Say the type cannot be copied**, when copying makes no sense — you cannot
meaningfully duplicate a mutex or a file handle:

```cpp run title="An owner that refuses to be copied" std=c++20
#include <cstddef>
#include <iostream>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]), size_(n) {}
    ~Buffer() { delete[] data_; }

    Buffer(const Buffer&) = delete;             // no copying
    Buffer& operator=(const Buffer&) = delete;

    std::size_t size() const { return size_; }
    int& operator[](std::size_t i) { return data_[i]; }

private:
    int* data_;
    std::size_t size_;
};

int main() {
    Buffer a{4};
    a[0] = 7;
    std::cout << "a[0] = " << a[0] << ", size " << a.size() << '\n';
    // Buffer b = a;   // now a compile error rather than a run-time disaster
}
```

**Or define what a copy means** — allocate new storage and duplicate the
contents. That is the subject of Chapter 3.3, and moving it instead of copying
is Chapter 3.4. Either way, the compiler-generated version was wrong, and
`= delete` makes the wrongness a compile error while you decide.

:::warning
A class that owns a resource and does not say what copying means is a bug
waiting for its first copy. That copy may be far away — passing the object to a
function by value, or putting it in a `std::vector`, both copy. Chapter 3.5
turns this into a checklist: the rule of zero, three, and five.
:::

## The rule of zero

Here is the part that surprises people: **most classes should own nothing
directly.** If every member is already an RAII type, the compiler-generated
destructor, copy, and move operations are all correct, and you write none of
them:

```cpp run title="A class that owns things without owning anything" std=c++20
#include <iostream>
#include <string>
#include <vector>

class Document {
public:
    Document(std::string title) : title_(std::move(title)) {}

    void add_line(std::string line) { lines_.push_back(std::move(line)); }

    std::size_t line_count() const { return lines_.size(); }
    const std::string& title() const { return title_; }

    // No destructor. No copy constructor. No assignment operator.
    // Every member cleans up after itself, so the defaults are correct.

private:
    std::string title_;
    std::vector<std::string> lines_;
};

int main() {
    Document doc{"notes"};
    doc.add_line("first");
    doc.add_line("second");

    Document copy = doc;                 // correct deep copy, for free
    copy.add_line("third");

    std::cout << doc.title()  << ": " << doc.line_count()  << " lines\n";
    std::cout << copy.title() << ": " << copy.line_count() << " lines\n";
}
```

`Document` manages a string and a vector of strings — heap allocations
throughout — and contains no `new`, no `delete`, and no destructor. Copying it
does the right thing because copying a `std::string` does the right thing.

This is the goal. Write raw resource management only when you are building one
of these building blocks; the other 99% of the time, compose types that already
manage themselves and write nothing.

:::tip
When you find yourself writing a destructor, pause and ask whether a
`std::unique_ptr`, `std::vector`, or `std::string` member would do the job. If
it would, use it: the version with no destructor has no way to be wrong about
copying, moving, or exceptions.
:::

## Check yourself

:::quiz
{
  "question": "What guarantees that a destructor runs when an exception is thrown?",
  "options": [
    { "text": "Nothing — destructors are skipped during exception handling", "why": "The opposite: stack unwinding exists precisely to run them. If it did not, exceptions and RAII together would be unusable." },
    { "text": "Stack unwinding destroys every automatic object between the throw and the handler", "correct": true, "why": "Exactly, and in reverse order of construction. That guarantee is what makes RAII work on the failure path, which is the path that matters." },
    { "text": "The `try` block runs destructors when it exits", "why": "You need no try block at all for this. Unwinding destroys automatic objects in every frame it passes through, whether or not anyone catches." },
    { "text": "The garbage collector reclaims them", "why": "C++ has no garbage collector. Deterministic destruction at end of scope is what it has instead — and it handles files and locks, which a collector would not." }
  ]
}
:::

:::quiz
{
  "question": "A class holds a `std::string`, a `std::vector<int>`, and a `std::unique_ptr<Widget>`. How many special member functions should you write?",
  "options": [
    { "text": "All five, to be safe", "why": "Writing them by hand here is more code, more to get wrong, and no safer — each member already knows how to copy, move, and destroy itself." },
    { "text": "None — every member manages itself, so the defaults are correct", "correct": true, "why": "The rule of zero. The generated destructor destroys each member, the generated move moves each member, and the generated copy is suppressed because unique_ptr is not copyable — which is the right answer for a type holding one." },
    { "text": "Just the destructor", "why": "There is nothing for it to do, and declaring one actually suppresses the implicit move operations — making the class quietly slower." },
    { "text": "The copy constructor and copy assignment only", "why": "You would have to decide what copying a unique_ptr member means, and the honest answer is usually that the type is not copyable — which is what you already get for free." }
  ]
}
:::

## Practice

:::exercise owning-buffer

:::exercise scope-guard

:::recap
- RAII ties a resource to an object's lifetime: acquire in the constructor,
  release in the destructor.
- It works because destructors of automatic objects run on every exit path,
  including exceptions. Correctness stops depending on anyone remembering.
- It applies to every resource, not just memory — locks, files, threads,
  sockets. A leaked lock is a deadlock, which is worse than a leaked byte.
- A class that owns a raw resource must say what copying means, or say it is not
  copyable with `= delete`. The compiler-generated copy will copy the handle and
  cause a double free.
- The rule of zero: if every member is already an RAII type, write no
  destructor, no copy, and no move. That is the target for almost all code.
:::
