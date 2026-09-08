---
title: "Objects and storage"
navTitle: "Objects and storage"
summary: >-
  What a variable actually is: a named region of bytes with a type stamped on it.
objectives:
  - Explain the difference between an object, a value, and a name
  - Predict sizeof for a struct given its members
  - Describe what padding is and why the compiler inserts it
status: complete
standard: c++20
requires: [values-and-types]
---

In Python, a variable is a label tied to an object that lives somewhere the
runtime manages. In C++, a variable *is* the storage. The name is yours, the
bytes are real, and the type decides how those bytes are read.

That single difference is the source of nearly everything that makes C++ fast
and nearly everything that makes it dangerous. This chapter makes the bytes
visible.

## Three words that are not synonyms

- An **object** is a region of storage. It has a size, an address, a type, and
  a lifetime. (Nothing to do with classes — an `int` is an object.)
- A **value** is what the bytes mean when read through that type.
- A **name** is an identifier your source code uses to refer to an object.

An object can have no name (`new int(7)`), several names (a reference), or a
name that outlives nothing at all. Keeping these apart is what lets you reason
about the next four chapters.

```cpp run title="One value, several ways to reach it"
#include <iostream>

int main() {
    int count = 7;        // an object named `count`, holding the value 7
    int& alias = count;   // another name for the same object
    int* address = &count; // a different object, holding count's address

    alias = 9;

    std::cout << "count   = " << count << '\n';
    std::cout << "alias   = " << alias << '\n';
    std::cout << "*address= " << *address << '\n';
    std::cout << "sizeof(count)   = " << sizeof(count) << " bytes\n";
    std::cout << "sizeof(address) = " << sizeof(address) << " bytes\n";
}
```

Assigning through `alias` changed `count`, because they are the same object.
`address` is a *different* object — its own bytes, holding a number that happens
to be where `count` lives.

:::memviz
{
  "title": "Three names, two objects",
  "code": "int  count   = 7;\nint& alias   = count;\nint* address = &count;\n\nalias = 9;",
  "steps": [
    {
      "caption": "`count` is created: four bytes of stack storage, read as an int.",
      "line": 1,
      "stack": [
        { "id": "count", "name": "count", "type": "int", "value": "7" }
      ]
    },
    {
      "caption": "`alias` introduces a second name for the same storage. No new object exists — nothing was allocated.",
      "line": 2,
      "stack": [
        { "id": "count", "name": "count · alias", "type": "int", "value": "7", "state": "new",
          "note": "one object, two names" }
      ]
    },
    {
      "caption": "`address` is a genuinely new object. Its bytes hold the address of `count`, which is why an arrow leaves it.",
      "line": 3,
      "stack": [
        { "id": "count", "name": "count · alias", "type": "int", "value": "7" },
        { "id": "address", "name": "address", "type": "int*",
          "fields": [{ "k": "points to", "v": "&count", "anchor": "address.ptr" }], "state": "new" }
      ],
      "arrows": [{ "from": "address.ptr", "to": "count" }]
    },
    {
      "caption": "Assigning through `alias` writes to the one object. Every name sees 9, because there was only ever one set of bytes.",
      "line": 5,
      "stack": [
        { "id": "count", "name": "count · alias", "type": "int", "value": "9", "state": "new" },
        { "id": "address", "name": "address", "type": "int*",
          "fields": [{ "k": "points to", "v": "&count", "anchor": "address.ptr" }] }
      ],
      "arrows": [{ "from": "address.ptr", "to": "count" }]
    }
  ]
}
:::

## sizeof tells you the truth

`sizeof` is a compile-time operator that yields the number of bytes an object of
a given type occupies. It is not a function call and it never evaluates its
argument.

```cpp run title="Sizes of the built-in types"
#include <iostream>

int main() {
    std::cout << "char        " << sizeof(char) << '\n';
    std::cout << "short       " << sizeof(short) << '\n';
    std::cout << "int         " << sizeof(int) << '\n';
    std::cout << "long        " << sizeof(long) << '\n';
    std::cout << "long long   " << sizeof(long long) << '\n';
    std::cout << "float       " << sizeof(float) << '\n';
    std::cout << "double      " << sizeof(double) << '\n';
    std::cout << "void*       " << sizeof(void*) << '\n';
}
```

`sizeof(char)` is 1 by definition — a byte *is* whatever a `char` is. Everything
else is up to the implementation. The standard guarantees only relative
ordering: `char` ≤ `short` ≤ `int` ≤ `long` ≤ `long long`. If you need an exact
width, say so with `<cstdint>`: `std::int32_t`, `std::uint64_t`.

:::pitfall
`int` is 4 bytes on essentially every desktop and server platform today, which
tempts people to rely on it. Code that assumed `long` was 8 bytes broke when
moved to 64-bit Windows, where `long` is 4. Use the fixed-width types when the
width is part of the meaning — file formats, network protocols, hardware
registers.
:::

## Padding: the bytes you did not ask for

Processors read memory fastest when an object's address is a multiple of its
size. The compiler therefore inserts unused bytes — *padding* — to keep members
aligned. This means a struct can be larger than the sum of its parts, and
reordering members can change its size.

```cpp run title="The same three members, two layouts"
#include <iostream>
#include <cstddef>   // offsetof

struct Wasteful {
    char  a;   // 1 byte, then 3 bytes of padding
    int   b;   // 4 bytes
    char  c;   // 1 byte, then 3 bytes of tail padding
};

struct Tight {
    int   b;   // 4 bytes
    char  a;   // 1 byte
    char  c;   // 1 byte, then 2 bytes of tail padding
};

int main() {
    std::cout << "sizeof(Wasteful) = " << sizeof(Wasteful) << '\n';
    std::cout << "sizeof(Tight)    = " << sizeof(Tight) << '\n';
    std::cout << "alignof(int)     = " << alignof(int) << '\n';

    std::cout << "offset of b in Wasteful = " << offsetof(Wasteful, b) << '\n';
    std::cout << "offset of b in Tight    = " << offsetof(Tight, b) << '\n';
}
```

Twelve bytes versus eight, for identical data. The rule the compiler follows:

1. Each member is placed at the next offset that is a multiple of its alignment.
2. The struct's own alignment is the largest alignment among its members.
3. The total size is rounded up to a multiple of that alignment, so that arrays
   of the struct keep every element aligned.

Step 3 is why `Tight` is 8 and not 6: an array of `Tight` needs each element's
`int` on a 4-byte boundary.

:::memviz
{
  "title": "Where the padding goes",
  "code": "struct Wasteful {\n    char a;\n    int  b;\n    char c;\n};",
  "steps": [
    {
      "caption": "`a` goes at offset 0. A char needs no particular alignment.",
      "stack": [
        { "id": "w", "name": "Wasteful", "type": "12 bytes",
          "fields": [{ "k": "0", "v": "a  (char)" }] }
      ]
    },
    {
      "caption": "`b` is an int, so it must start at a multiple of 4. Offsets 1–3 are skipped and become padding.",
      "stack": [
        { "id": "w", "name": "Wasteful", "type": "12 bytes", "state": "new",
          "fields": [
            { "k": "0", "v": "a  (char)" },
            { "k": "1–3", "v": "padding" },
            { "k": "4–7", "v": "b  (int)" }
          ] }
      ]
    },
    {
      "caption": "`c` follows immediately at offset 8. Then the whole struct is rounded up to a multiple of 4 — its alignment — so offsets 9–11 are tail padding.",
      "stack": [
        { "id": "w", "name": "Wasteful", "type": "12 bytes",
          "fields": [
            { "k": "0", "v": "a  (char)" },
            { "k": "1–3", "v": "padding" },
            { "k": "4–7", "v": "b  (int)" },
            { "k": "8", "v": "c  (char)" },
            { "k": "9–11", "v": "tail padding" }
          ], "state": "danger",
          "note": "4 of 12 bytes carry data" }
      ]
    },
    {
      "caption": "Ordering members from largest to smallest removes the interior gap: `Tight` fits the same data in 8 bytes.",
      "stack": [
        { "id": "t", "name": "Tight", "type": "8 bytes", "state": "new",
          "fields": [
            { "k": "0–3", "v": "b  (int)" },
            { "k": "4", "v": "a  (char)" },
            { "k": "5", "v": "c  (char)" },
            { "k": "6–7", "v": "tail padding" }
          ] }
      ]
    }
  ]
}
:::

:::tip
Declaring members largest-first is a reliable habit that costs nothing. It
matters when you have millions of these objects — Part 7 shows a case where
shrinking a struct from 12 bytes to 8 made a loop measurably faster, purely
because more elements fit in each cache line.
:::

:::note
Do not reach for `#pragma pack` to remove padding. It produces misaligned
members, which is slower on x86 and undefined behaviour on some other
architectures. Reorder members instead; that is free and portable.
:::

## Every object has an address

The `&` operator yields the address of an object. Addresses are what make
pointers, references, containers, and polymorphism possible, and they are the
reason C++ can hand you a bare block of memory and let you interpret it.

```cpp run title="Objects laid out in memory"
#include <iostream>

int main() {
    int values[4] = {10, 20, 30, 40};

    for (int i = 0; i < 4; ++i) {
        std::cout << "values[" << i << "] at " << &values[i]
                  << "  value " << values[i] << '\n';
    }

    std::cout << "\ndistance between elements: "
              << reinterpret_cast<char*>(&values[1]) - reinterpret_cast<char*>(&values[0])
              << " bytes\n";
}
```

The addresses differ by exactly `sizeof(int)`. An array is not a list of
references to values living elsewhere — it is one contiguous block, and that
contiguity is why iterating an array is so fast.

:::warning
Reading an object through the wrong type is undefined behaviour, not a
reinterpretation. Writing an `int` and reading those bytes as a `float` does not
"convert" — the compiler is entitled to assume you never do it, and to optimise
on that assumption. When you genuinely need the bytes, use `std::bit_cast`
(C++20) or `std::memcpy`, both of which are well-defined.
:::

## Check yourself

:::quiz
{
  "question": "Given `struct S { char a; double b; char c; };` with `alignof(double) == 8`, what is `sizeof(S)`?",
  "options": [
    { "text": "10", "why": "That is the sum of the members with no padding, which alignment rules do not allow here." },
    { "text": "16", "why": "Close, but check the tail. `b` starts at offset 8 and ends at 15, then `c` occupies 16 — so the struct already exceeds 16." },
    { "text": "24", "correct": true, "why": "`a` at 0, padding through 7, `b` at 8–15, `c` at 16, then tail padding to 23 so the size is a multiple of 8." },
    { "text": "It depends on the compiler, so it cannot be determined", "why": "The exact layout is implementation-defined in general, but given alignof(double)==8 the rules pin it down. Run it and see." }
  ]
}
:::

:::quiz
{
  "question": "`int x = 5; int& r = x; int* p = &x;` — how many objects were created?",
  "options": [
    { "text": "Three: x, r, and p", "why": "A reference is not required to occupy storage of its own — it is another name for x, not a separate object." },
    { "text": "Two: x and p", "correct": true, "why": "Right. `r` binds a new name to the existing object, while `p` is a real object whose bytes hold an address." },
    { "text": "One: only x holds a value", "why": "`p` genuinely has its own storage — usually 8 bytes on a 64-bit machine — holding x's address." },
    { "text": "Two: x and r, since p is just an address", "why": "The other way round. An address is a value that has to be stored somewhere, and `p` is where." }
  ]
}
:::

## Practice

:::exercise sum-through-pointer

:::recap
- A variable in C++ *is* its storage. The type says how to read the bytes; the
  name is how your source refers to them.
- An object, a value, and a name are three different things. References add
  names, pointers add objects.
- `sizeof` is fixed at compile time. Only `sizeof(char) == 1` is guaranteed.
- Padding exists to keep members aligned. Order members largest-first to avoid
  it, and never use `#pragma pack` to force it away.
- Arrays are contiguous. That is the basis of both their speed and pointer
  arithmetic.
:::
