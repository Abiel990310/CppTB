---
title: "The stack and the heap"
navTitle: "The stack and the heap"
summary: >-
  Two ways to get memory, with very different costs and rules.
objectives:
  - Explain why stack allocation is nearly free and heap allocation is not
  - Use new and delete correctly, then explain why you should not
  - Predict when a stack overflow occurs
status: complete
standard: c++20
requires: [lifetime-and-scope]
---

Your program has two pools of memory available to it while it runs, and they
behave so differently that choosing between them is one of the recurring
decisions in C++.

The **stack** is a single contiguous region per thread, used in strict
last-in-first-out order. The **heap** (the standard calls it the *free store*)
is a general pool you can take arbitrary pieces from, in any order, and return
in any order.

## Why the stack is nearly free

A stack allocation is one arithmetic operation. The processor keeps a register
pointing at the top of the stack; making room for local variables means
subtracting from it, and releasing them means adding back.

```cpp asm run title="What a local variable costs" std=c++20
int sum_three(int a, int b, int c) {
    int local = a + b;
    return local + c;
}

int main() { return sum_three(1, 2, 3); } // [hidden]
```

Press **Assembly**, and switch to `-O0` to see it before optimisation. Even
unoptimised, there is no call to an allocator — the compiler decided at compile
time exactly how many bytes this function needs, and reserving them is part of
entering the function. At `-O2` the local disappears entirely into a register.

That is the stack's bargain: allocation is free, but the size must be known at
compile time and the lifetime must nest. You get memory in the order you asked
and give it back in exactly the reverse order.

## Why the heap is not

A heap allocation is a function call into an allocator that has to find a free
block of the right size, possibly ask the operating system for more memory,
update its bookkeeping, and stay correct while other threads do the same.

```cpp run title="Measuring the difference" std=c++20
#include <chrono>
#include <iostream>
#include <memory>

int main() {
    constexpr int rounds = 200'000;
    using clock = std::chrono::steady_clock;

    auto start = clock::now();
    long long sink = 0;
    for (int i = 0; i < rounds; ++i) {
        int on_stack = i;          // automatic storage
        sink += on_stack;
    }
    auto mid = clock::now();

    for (int i = 0; i < rounds; ++i) {
        auto on_heap = std::make_unique<int>(i);   // dynamic storage
        sink += *on_heap;
    }
    auto finish = clock::now();

    using us = std::chrono::microseconds;
    std::cout << "stack: " << std::chrono::duration_cast<us>(mid - start).count() << " us\n";
    std::cout << "heap:  " << std::chrono::duration_cast<us>(finish - mid).count() << " us\n";
    std::cout << "(checksum " << sink << ")\n";
}
```

The gap is large, and it is larger than it looks: this measurement runs with
sanitizers on and optimisation off, and it allocates the friendliest possible
size in the friendliest possible pattern. Real allocation patterns fragment the
heap and miss cache.

:::note
Do not read this as "the heap is bad". Read it as "the heap buys you something,
so know what you are buying". You need it whenever the size is not known until
run time, the object must outlive the scope that created it, or the object is
too large for the stack. Those are common requirements, and paying an allocation
to meet them is correct.
:::

## The stack has a hard limit

Typically 1–8 MB per thread, fixed when the thread starts. Exceed it and the
program dies immediately:

```cpp run expect-ub title="Too much stack"
#include <iostream>

int main() {
    std::cout << "about to ask for 64 MB of stack\n";
    int huge[16'000'000];        // ~64 MB — far beyond the limit
    huge[0] = 1;
    huge[15'999'999] = 2;
    std::cout << "never reached: " << huge[0] << '\n';
}
```

The same data on the heap is unremarkable:

```cpp run title="The same 64 MB, on the heap" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> huge(16'000'000);   // ~64 MB, heap-allocated
    huge[0] = 1;
    huge[15'999'999] = 2;
    std::cout << "fine: " << huge.size() << " elements, "
              << huge.size() * sizeof(int) / (1024 * 1024) << " MB\n";
}
```

The other way to exhaust the stack is recursion without a base case — each call
adds a frame, and a few hundred thousand frames is enough. That is what a
"stack overflow" almost always is in practice.

:::pitfall
There is no portable way to ask how much stack you have left, and no way to
recover from running out: on most platforms the program receives a signal and
dies. Any recursion whose depth depends on input data is a latent crash. Either
bound the depth explicitly or rewrite it as a loop with an explicit stack — a
`std::vector` used as a work list.
:::

## new and delete, once

You should almost never write these. But you need to recognise them, because
they are what smart pointers and containers are doing underneath, and because
you will meet them in existing code.

```cpp run title="Manual allocation, done correctly"
#include <iostream>

int main() {
    int* single = new int(42);          // one int
    int* array  = new int[5]{1, 2, 3, 4, 5};   // five ints

    std::cout << *single << ' ' << array[2] << '\n';

    delete   single;    // matches new
    delete[] array;     // matches new[]
}
```

Three rules, all of which are easy to break:

1. **Every `new` needs exactly one `delete`.** Zero is a leak; two is a
   double-free, which corrupts the allocator.
2. **`new[]` pairs with `delete[]`.** Mixing them is undefined behaviour, not a
   style issue — the array form has to run destructors for every element and
   often reads a stored count from before the block.
3. **The pointer must survive to reach the `delete`.** Which means every early
   return, every `break`, and every thrown exception between the two is a leak.

Rule 3 is the one that makes manual memory management genuinely hard:

```cpp run expect-ub title="A leak that no mistake is visible in" std=c++20
#include <iostream>
#include <stdexcept>

void process(bool fail) {
    int* buffer = new int[1000];

    if (fail) {
        throw std::runtime_error("failed");   // buffer is never deleted
    }

    delete[] buffer;
}

int main() {
    try {
        process(true);
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
    std::cout << "leaked 4000 bytes; LeakSanitizer reports it at exit\n";
}
```

Nothing in `process` looks wrong. The `delete[]` is right there. But the throw
jumps over it, and there is no arrangement of `delete` statements that fixes
this in general — you would need one before every exit path, including ones
added later by someone else.

LeakSanitizer catches it here and names the allocation. In production, this is a
process that grows until it is killed.

:::memviz
{
  "title": "Where the two pools live",
  "steps": [
    {
      "caption": "`int x = 1;` puts an object in the current stack frame. Its address is decided by the compiler; releasing it is automatic.",
      "stack": [
        { "id": "x", "name": "x", "type": "int", "value": "1", "state": "new" }
      ],
      "heap": []
    },
    {
      "caption": "`int* p = new int(2);` allocates on the heap and stores the address in a stack object. Two objects now exist, in two different pools.",
      "stack": [
        { "id": "x", "name": "x", "type": "int", "value": "1" },
        { "id": "p", "name": "p", "type": "int*", "state": "new",
          "fields": [{ "k": "holds", "v": "heap address", "anchor": "p.ptr" }] }
      ],
      "heap": [
        { "id": "h", "name": "allocation", "type": "int", "value": "2", "state": "new" }
      ],
      "arrows": [{ "from": "p.ptr", "to": "h" }]
    },
    {
      "caption": "Leaving the scope destroys `p` — the pointer. The heap object it named is untouched, and now unreachable. That is a leak.",
      "stack": [
        { "id": "x", "name": "x", "type": "int", "value": "destroyed", "state": "freed" },
        { "id": "p", "name": "p", "type": "int*", "value": "destroyed", "state": "freed" }
      ],
      "heap": [
        { "id": "h", "name": "allocation", "type": "int", "value": "2", "state": "danger",
          "note": "still allocated, nothing points at it" }
      ]
    },
    {
      "caption": "With `std::unique_ptr<int>` instead, the stack object's destructor deletes the heap object on the way out. Same two pools, no leak, and no delete written by hand.",
      "stack": [
        { "id": "x", "name": "x", "type": "int", "value": "destroyed", "state": "freed" },
        { "id": "p", "name": "owner", "type": "unique_ptr<int>", "value": "destroyed", "state": "freed",
          "note": "destructor ran delete" }
      ],
      "heap": [
        { "id": "h", "name": "allocation", "type": "int", "value": "freed", "state": "freed" }
      ]
    }
  ]
}
:::

## What to write instead

The last diagram step is the answer, and it is the answer for essentially all
new code:

```cpp run title="The same program, with nothing to leak" std=c++20
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>

void process(bool fail) {
    std::vector<int> buffer(1000);        // owns its memory

    if (fail) {
        throw std::runtime_error("failed");   // buffer's destructor still runs
    }
}

int main() {
    try {
        process(true);
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
    std::cout << "no leak: the sanitizer has nothing to report\n";

    auto single = std::make_unique<int>(42);
    std::cout << "and a single object: " << *single << '\n';
}
```

Identical structure, no `delete`, no leak — on any exit path, including ones
nobody has written yet. The destructor of an automatic object runs no matter
how the scope is left, so putting ownership in an automatic object makes cleanup
unskippable.

That idea has a name, and it is the subject of Chapter 3.2.

- **`std::vector<T>`** for a run-time number of elements.
- **`std::unique_ptr<T>`** for one heap object with a single owner.
- **`std::shared_ptr<T>`** when ownership is genuinely shared — rarer than its
  popularity suggests.
- **`std::string`** for text.

Reach for `new` only when implementing one of these yourself.

## Check yourself

:::quiz
{
  "question": "Why is stack allocation so much cheaper than heap allocation?",
  "options": [
    { "text": "The stack is in faster memory than the heap", "why": "Both are ordinary RAM. The stack is usually warmer in cache because it is reused constantly, but that is an effect, not the cause." },
    { "text": "Stack allocation is arithmetic on a register; heap allocation is a search for a free block", "correct": true, "why": "Exactly. The compiler knows the frame size at compile time, so making room is one subtraction. The allocator has to find, split, and record a block, and stay thread-safe doing it." },
    { "text": "The stack does not need to be freed", "why": "It does get freed — by restoring the stack pointer. That is also nearly free, but the memory is definitely reclaimed." },
    { "text": "Heap allocations are always larger", "why": "Size is unrelated. A one-byte heap allocation still costs a call into the allocator." }
  ]
}
:::

:::quiz
{
  "question": "`int* p = new int[10];` — which release is correct?",
  "options": [
    { "text": "`delete p;`", "why": "Mixing the forms is undefined behaviour. The array form has to handle the element count and run destructors for each element." },
    { "text": "`delete[] p;`", "correct": true, "why": "`new[]` pairs with `delete[]`, always. This is the reason `std::vector` exists — so you never have to remember." },
    { "text": "`free(p);`", "why": "`free` pairs with `malloc`. Crossing the C and C++ allocation families is undefined behaviour even when they happen to share an allocator." },
    { "text": "Nothing — it is released when the scope ends", "why": "That is true of the pointer, not of what it points at. Heap objects live until explicitly released, which is exactly the leak in this chapter." }
  ]
}
:::

## Practice

:::exercise owning-buffer

:::exercise no-leak-on-throw

:::recap
- Stack allocation is arithmetic on a register; the size must be known at compile
  time and lifetimes must nest. Heap allocation is a call into an allocator, and
  buys you run-time size and lifetimes you control.
- The stack is small — 1–8 MB — and exceeding it kills the program with no
  chance to recover. Unbounded recursion is the usual cause.
- `new`/`delete` and `new[]`/`delete[]` must be matched exactly, and every exit
  path between them must reach the delete. Exceptions make that unachievable by
  hand.
- Put ownership in an automatic object — `vector`, `unique_ptr`, `string` — and
  cleanup becomes unskippable, because destructors run on every exit path.
:::
