---
title: "Pointers"
navTitle: "Pointers"
summary: >-
  An address in a variable, and every consequence that follows.
objectives:
  - Read and write pointer declarations without hesitating
  - Explain what dereferencing a null or dangling pointer does
  - Use pointer arithmetic correctly within an array
status: complete
standard: c++20
requires: [objects-and-storage]
---

A pointer is a variable whose value is an address. That is the entire idea.
Everything difficult about pointers comes from what you are allowed to do with
an address, and from the fact that the language will not stop you doing the rest.

The previous chapter showed that every object has an address. A pointer is how
you keep one.

## Two operators

`&x` yields the address of the object `x`. `*p` yields the object that `p`
points at — *dereferencing*. They are inverses: `*&x` is `x`.

```cpp run title="Taking an address, and following it"
#include <iostream>

int main() {
    int  value = 42;
    int* p     = &value;   // p holds the address of value

    std::cout << "value    = " << value  << '\n';
    std::cout << "p        = " << p      << "   (an address)\n";
    std::cout << "*p       = " << *p     << "   (what lives there)\n";

    *p = 99;               // write through the pointer

    std::cout << "value is now " << value << '\n';
}
```

Writing through `p` changed `value`, because `p` did not hold a copy of 42 — it
held directions to the object that holds 42.

:::memviz
{
  "title": "A pointer holds directions, not a copy",
  "code": "int  value = 42;\nint* p     = &value;\n\n*p = 99;",
  "steps": [
    {
      "caption": "`value` is an ordinary int, four bytes of stack storage holding 42.",
      "line": 1,
      "stack": [
        { "id": "value", "name": "value", "type": "int", "value": "42" }
      ]
    },
    {
      "caption": "`p` is its own object — eight bytes on a 64-bit machine — and what it stores is where `value` lives.",
      "line": 2,
      "stack": [
        { "id": "value", "name": "value", "type": "int", "value": "42" },
        { "id": "p", "name": "p", "type": "int*", "state": "new",
          "fields": [{ "k": "holds", "v": "&value", "anchor": "p.ptr" }] }
      ],
      "arrows": [{ "from": "p.ptr", "to": "value" }]
    },
    {
      "caption": "`*p = 99` follows the arrow and writes at the far end. `p` itself does not change — it still points at the same object.",
      "line": 4,
      "stack": [
        { "id": "value", "name": "value", "type": "int", "value": "99", "state": "new" },
        { "id": "p", "name": "p", "type": "int*",
          "fields": [{ "k": "holds", "v": "&value", "anchor": "p.ptr" }] }
      ],
      "arrows": [{ "from": "p.ptr", "to": "value", "label": "*p" }]
    }
  ]
}
:::

## Reading a declaration

`int* p` declares `p` as a pointer to `int`. Read declarations from the name
outwards: *`p` is a pointer to `int`*.

Where the `*` sits is a matter of style — `int* p`, `int *p`, and `int * p` are
the same declaration. But this is not:

```cpp run title="One asterisk, one pointer"
#include <iostream>

int main() {
    int a = 1, b = 2;

    int* p, q;      // p is a pointer to int. q is a plain int!
    p = &a;
    q = b;

    std::cout << "*p = " << *p << ", q = " << q << '\n';
    std::cout << "sizeof(p) = " << sizeof(p) << ", sizeof(q) = " << sizeof(q) << '\n';
}
```

The `*` binds to the declarator, not to the type. `int* p, q;` declares one
pointer and one `int` — which is why the convention in this book is one
declaration per line.

## The null pointer

A pointer that points at nothing should say so:

```cpp run title="nullptr, and checking for it"
#include <iostream>

int* find_first_even(int* first, int count) {
    for (int i = 0; i < count; ++i) {
        if (first[i] % 2 == 0) return &first[i];
    }
    return nullptr;             // nothing found
}

int main() {
    int odds[] = {1, 3, 5};
    int mixed[] = {1, 4, 5};

    if (int* found = find_first_even(mixed, 3)) {
        std::cout << "found " << *found << '\n';
    }
    if (find_first_even(odds, 3) == nullptr) {
        std::cout << "nothing even in odds\n";
    }
}
```

`nullptr` is a distinct null-pointer constant, introduced in C++11. Older code
uses `NULL` or plain `0`, both of which are integers in disguise and cause
overload-resolution surprises. Use `nullptr`.

Dereferencing a null pointer is undefined behaviour. In practice it usually
segfaults, because address zero is deliberately left unmapped — but "usually
crashes" is not a guarantee, and the optimizer is entitled to assume it never
happens:

```cpp run expect-ub title="A crash you can watch"
#include <iostream>

int main() {
    int* p = nullptr;
    std::cout << "about to dereference a null pointer\n";
    std::cout << *p << '\n';       // undefined behaviour
    std::cout << "this line is never reached\n";
}
```

The sanitizer names it precisely rather than leaving you with a bare
`Segmentation fault`. That is the whole reason this book compiles its samples
with sanitizers on.

## Dangling pointers

A null pointer is honest about pointing nowhere. A **dangling** pointer is worse:
it holds an address that was valid and no longer is. Nothing about the pointer
changes when the object it points at dies.

```cpp run expect-ub title="Returning the address of a local"
#include <iostream>

int* leak_an_address() {
    int local = 7;
    return &local;          // local dies when this function returns
}

int main() {
    int* p = leak_an_address();
    std::cout << "reading through a dangling pointer: " << *p << '\n';
}
```

Two things saved you there. The compiler warned — `-Wreturn-local-addr` catches
this exact shape — and, having warned, GCC went further and made the function
return `nullptr` instead of the doomed address. The program crashes immediately
and loudly rather than reading stale memory.

That is the *easy* case. The compiler could see the whole story in one function.
Now take the same mistake and spread it across two:

```cpp run expect-ub title="The same bug, with no warning"
#include <iostream>

int* escaped = nullptr;

void stash() {
    int local = 7;
    escaped = &local;       // the address outlives `local`
}

void unrelated_work() {
    volatile int a = 1, b = 2, c = 3;   // reuses the same stack space
    (void)(a + b + c);
}

int main() {
    stash();
    unrelated_work();
    std::cout << "reading through a dangling pointer: " << *escaped << '\n';
}
```

No warning this time. The compiler cannot see, from `stash` alone, that the
address escapes into something outliving the function — that would take
whole-program analysis. Only AddressSanitizer catches it, at run time, naming it
`stack-use-after-return` and showing both where the memory was and where it was
freed.

:::warning
This is undefined behaviour of the dangerous kind: without the sanitizer it
often *appears* to work. The stack memory that held `local` still exists and may
still contain 7, right up until some other call reuses it — which is exactly
what `unrelated_work` does here. A program that reads dangling pointers can pass
every test and fail in production.
:::

:::memviz
{
  "title": "Why the pointer outlives what it points at",
  "code": "int* escaped = nullptr;\n\nvoid stash() {\n    int local = 7;\n    escaped = &local;\n}\n\nstash();\nunrelated_work();\nstd::cout << *escaped;",
  "steps": [
    {
      "caption": "Inside `stash`, `local` is a live object in that function's frame, with a real address.",
      "line": 4,
      "stack": [
        { "id": "local", "name": "local", "type": "int", "value": "7",
          "note": "frame of stash()" },
        { "id": "escaped", "name": "escaped", "type": "int*",
          "fields": [{ "k": "holds", "v": "nullptr", "anchor": "escaped.ptr" }] }
      ]
    },
    {
      "caption": "The address is copied into a global. An address is just a number, so nothing here is illegal yet.",
      "line": 5,
      "stack": [
        { "id": "local", "name": "local", "type": "int", "value": "7" },
        { "id": "escaped", "name": "escaped", "type": "int*", "state": "new",
          "fields": [{ "k": "holds", "v": "&local", "anchor": "escaped.ptr" }] }
      ],
      "arrows": [{ "from": "escaped.ptr", "to": "local" }]
    },
    {
      "caption": "`stash` returns. Its frame is gone and `local` no longer exists — but nothing updated `escaped`. It still holds the same number.",
      "line": 8,
      "stack": [
        { "id": "local", "name": "local", "type": "int", "value": "?", "state": "freed",
          "note": "frame popped; storage now unowned" },
        { "id": "escaped", "name": "escaped", "type": "int*", "state": "danger",
          "fields": [{ "k": "holds", "v": "&local", "anchor": "escaped.ptr" }] }
      ],
      "arrows": [{ "from": "escaped.ptr", "to": "local", "state": "dangling" }]
    },
    {
      "caption": "`unrelated_work` gets the same stack space and writes its own variables over it. The 7 is gone.",
      "line": 9,
      "stack": [
        { "id": "local", "name": "a, b, c", "type": "volatile int", "value": "1, 2, 3", "state": "new",
          "note": "same addresses, different objects" },
        { "id": "escaped", "name": "escaped", "type": "int*", "state": "danger",
          "fields": [{ "k": "holds", "v": "&local", "anchor": "escaped.ptr" }] }
      ],
      "arrows": [{ "from": "escaped.ptr", "to": "local", "state": "dangling" }]
    },
    {
      "caption": "`*escaped` reads storage that belongs to something else entirely. Had `unrelated_work` not run, it might still have said 7 — and the bug would have survived your tests.",
      "line": 10,
      "stack": [
        { "id": "local", "name": "a, b, c", "type": "volatile int", "value": "1, 2, 3" },
        { "id": "escaped", "name": "escaped", "type": "int*", "state": "danger",
          "fields": [{ "k": "holds", "v": "&local", "anchor": "escaped.ptr" }] }
      ],
      "arrows": [{ "from": "escaped.ptr", "to": "local", "state": "dangling", "label": "undefined" }]
    }
  ]
}
:::

The rule that prevents both versions: **never let a pointer outlive what it
points at**. Returning the address of a local is the case a compiler can catch;
storing one somewhere longer-lived is the case only you can. Chapter 2.4 makes
"outlive" precise.

## Pointer arithmetic

Adding an integer to a pointer moves it by that many *elements*, not bytes. The
type is what makes this work.

```cpp run title="Walking an array with a pointer"
#include <iostream>

int main() {
    int values[5] = {10, 20, 30, 40, 50};

    int* p = values;             // an array decays to a pointer to its first element
    std::cout << "*p       = " << *p       << '\n';
    std::cout << "*(p + 2) = " << *(p + 2) << '\n';
    std::cout << "p[2]     = " << p[2]     << "   (identical to the line above)\n";

    // Walking to the end. `values + 5` is the one-past-the-end pointer:
    // legal to form and compare, but never to dereference.
    for (int* it = values; it != values + 5; ++it) {
        std::cout << *it << ' ';
    }
    std::cout << '\n';
}
```

`p[i]` is *defined* as `*(p + i)`. Subscripting is pointer arithmetic wearing a
friendlier syntax, which is why it works on pointers as well as arrays, and why
it does no bounds checking on either.

The loop above is the shape every standard-library algorithm takes: a pointer to
the first element and a pointer one past the last. Forming that one-past-the-end
pointer is explicitly legal; dereferencing it is not.

```cpp run expect-ub title="Reading one element too far"
#include <iostream>

int main() {
    int values[5] = {10, 20, 30, 40, 50};
    std::cout << "the last element: " << values[4] << '\n';
    std::cout << "one past the end: " << values[5] << '\n';   // out of bounds
}
```

AddressSanitizer reports the read as `stack-buffer-overflow` and tells you the
allocation it belongs to. Without it, this reads whatever is next in memory and
carries on, which is how buffer overruns become security vulnerabilities.

## const and pointers

Two things can be const — the pointer, or what it points at — and the position
of `const` decides which:

```cpp run title="Three kinds of const" std=c++20
#include <iostream>

int main() {
    int a = 1, b = 2;

    const int* to_const   = &a;   // cannot write *to_const; can repoint
    int* const const_ptr  = &a;   // can write *const_ptr; cannot repoint
    const int* const both = &a;   // neither

    to_const = &b;                // fine: the pointer itself is not const
    *const_ptr = 10;              // fine: what it points at is not const

    std::cout << "a = " << a << ", *to_const = " << *to_const
              << ", *both = " << *both << '\n';
}
```

Read right-to-left from the name: `const int* p` is "`p` is a pointer to an
`int` that is const"; `int* const p` is "`p` is a const pointer to an `int`".
Chapter 2.7 comes back to this; for now, `const int*` is the one you will write
almost every time, because it is how a function says *I will look at this and
not change it*.

## Check yourself

:::quiz
{
  "question": "After `int a = 5; int* p = &a; *p = 7;`, what is `a`?",
  "options": [
    { "text": "5 — `p` holds a copy", "why": "A pointer holds an address, not a copy. Writing through it reaches the original object." },
    { "text": "7", "correct": true, "why": "`*p` names the object `p` points at, which is `a`. Assigning to it assigns to `a`." },
    { "text": "The address of `a`", "why": "That is the value of `p`, not of `a`. `*p = 7` writes 7 to the pointed-at object; it does not touch `p`." },
    { "text": "Undefined — you cannot write through a pointer to a local", "why": "You certainly can, and it is the normal use of a pointer. It becomes undefined only once the pointed-at object's lifetime has ended." }
  ]
}
:::

:::quiz
{
  "question": "`int v[3]; int* p = v;` — which of these is undefined behaviour?",
  "options": [
    { "text": "`p + 3`", "why": "Forming a one-past-the-end pointer is explicitly allowed, precisely so loops can use it as a stopping point." },
    { "text": "`*(p + 3)`", "correct": true, "why": "Forming the pointer is legal; dereferencing it is not. `v[3]` reads past the array, which AddressSanitizer reports as a buffer overflow." },
    { "text": "`p + 2`", "why": "That points at `v[2]`, the last element, which is perfectly valid to form and to dereference." },
    { "text": "Comparing `p != v + 3`", "why": "Comparing against the one-past-the-end pointer is exactly what the standard permits it for." }
  ]
}
:::

## Practice

:::exercise sum-through-pointer

:::exercise find-in-range

:::recap
- A pointer is an object whose value is an address. `&` takes an address, `*`
  follows one.
- `int* p, q;` declares a pointer and an `int`. Declare one variable per line.
- `nullptr` means "points at nothing" and is safe to test. Dereferencing it is
  undefined, though it usually crashes.
- A dangling pointer holds an address whose object is gone. It often appears to
  work, which is what makes it dangerous. Never return the address of a local.
- Pointer arithmetic moves by elements, and `p[i]` is defined as `*(p + i)`.
  One-past-the-end is legal to form, never to dereference.
- `const int*` is a promise not to write through the pointer; `int* const` is a
  promise not to repoint it.
:::
