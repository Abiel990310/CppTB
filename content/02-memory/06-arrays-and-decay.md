---
title: "Arrays, and why they decay"
navTitle: "Arrays, and why they decay"
summary: >-
  The oldest container in the language, and the surprising rule that makes it lose its size.
objectives:
  - Explain array-to-pointer decay and when it happens
  - Choose std::array or std::vector over a raw array
  - Pass an array to a function without losing its length
status: complete
standard: c++20
requires: [pointers]
---

A built-in array is a fixed number of objects laid out contiguously. It is the
most efficient container in the language and the most dangerous, because of one
rule inherited from C: in almost every context, an array silently becomes a
pointer to its first element, and its length is lost.

That rule is called **decay**, and understanding exactly when it fires is what
makes raw arrays predictable.

## An array knows its size — briefly

```cpp run title="sizeof knows; a function does not"
#include <iostream>

void takes_an_array(int values[5]) {
    // Despite appearances, `values` here is an int*, not an array of 5.
    std::cout << "  inside the function, sizeof = " << sizeof(values) << '\n';
}

int main() {
    int values[5] = {1, 2, 3, 4, 5};

    std::cout << "in main, sizeof(values) = " << sizeof(values) << " bytes\n";
    std::cout << "element count = " << sizeof(values) / sizeof(values[0]) << '\n';

    takes_an_array(values);
}
```

In `main`, `sizeof(values)` is 20: the array's real size. Inside the function it
is 8 — the size of a pointer. The `[5]` in the parameter list is not a
constraint the compiler checks; it is decoration. `void f(int v[5])`,
`void f(int v[])`, and `void f(int* v)` declare the same function, and you may
pass an array of any length to any of them.

:::pitfall
This is why the `sizeof(a) / sizeof(a[0])` idiom is so dangerous. It is correct
where the array is declared and silently wrong — 8 divided by 4, giving 2 —
anywhere the array has decayed. It compiles either way and produces a plausible
number.
:::

## When decay happens

An array converts to a pointer to its first element whenever it is used as a
value: passed to a function, assigned to a pointer, returned, or used in
arithmetic.

It does **not** decay in four places:

```cpp run title="The four places an array stays an array"
#include <iostream>
#include <typeinfo>

int main() {
    int values[5] = {1, 2, 3, 4, 5};

    // 1. sizeof
    std::cout << "sizeof:   " << sizeof(values) << '\n';

    // 2. Taking its address: &values is int(*)[5], not int**
    int (*array_ptr)[5] = &values;
    std::cout << "via &:    " << (*array_ptr)[2] << '\n';

    // 3. Binding to a reference to array
    int (&ref)[5] = values;
    std::cout << "via ref:  " << sizeof(ref) << " (still 20)\n";

    // 4. In a range-based for, which is why this one knows when to stop
    for (int v : values) std::cout << v << ' ';
    std::cout << '\n';
}
```

Point 4 is the practical one: `for (int v : values)` works on a raw array and
stops at the right place, because the array has not decayed. Change it to a
pointer and it will not compile — which is the language protecting you.

Point 3 is the escape hatch. A reference to an array preserves the length, and
combined with a template it gives you a function that knows how long its
argument is:

```cpp run title="A function that keeps the length" std=c++20
#include <cstddef>
#include <iostream>

// N is deduced from the argument's type.
template <std::size_t N>
int sum(const int (&values)[N]) {
    int total = 0;
    for (int v : values) total += v;
    return total;
}

int main() {
    int three[] = {1, 2, 3};
    int five[]  = {1, 2, 3, 4, 5};

    std::cout << sum(three) << ' ' << sum(five) << '\n';
    // sum(pointer) would not compile — there is no length to deduce.
}
```

That is essentially how `std::size`, `std::begin`, and `std::end` work on raw
arrays. Use them instead of the `sizeof` idiom:

```cpp run title="std::size, which cannot be fooled" std=c++20
#include <iostream>
#include <iterator>

int main() {
    int values[5] = {1, 2, 3, 4, 5};

    std::cout << "std::size:  " << std::size(values) << '\n';
    std::cout << "sizeof idiom: " << sizeof(values) / sizeof(values[0]) << '\n';

    int* decayed = values;
    // std::size(decayed) does not compile — the mistake is caught, not computed.
    std::cout << "sizeof idiom on a decayed pointer: "
              << sizeof(decayed) / sizeof(decayed[0]) << "  <- wrong, silently\n";
}
```

The last line prints 2. The `sizeof` idiom cannot tell you it has failed;
`std::size` refuses to compile, which is the outcome you want.

## No bounds checking, ever

```cpp run expect-ub title="Writing past the end"
#include <iostream>

int main() {
    int values[3] = {1, 2, 3};
    int canary = 999;

    std::cout << "canary before: " << canary << '\n';
    values[3] = 42;                 // one past the end — undefined behaviour
    std::cout << "canary after:  " << canary << '\n';
}
```

Nothing in the language checks the index — not at compile time, not at run time.
AddressSanitizer catches it here because this book compiles with it on, and it
names the exact allocation. Without it, the write lands on whatever happens to
be adjacent, and the program continues with corrupted state.

This is the single most common source of security vulnerabilities in C and C++
code, and it is the reason the rest of this book prefers containers.

## What to use instead

### std::array — a fixed size that behaves

```cpp run title="std::array knows itself everywhere" std=c++20
#include <array>
#include <iostream>

void takes_array(const std::array<int, 5>& values) {
    // The size is part of the type, so it survives the call.
    std::cout << "  inside: size " << values.size() << ", first " << values.front() << '\n';
}

int main() {
    std::array<int, 5> values{1, 2, 3, 4, 5};

    std::cout << "size():   " << values.size() << '\n';
    takes_array(values);

    std::cout << "at(2):    " << values.at(2) << '\n';

    for (int v : values) std::cout << v << ' ';
    std::cout << '\n';
}
```

`std::array` is a raw array with the sharp edges removed: same layout, same
zero overhead, no decay, and it can be copied, returned, and compared. There is
no reason to prefer a raw array over it in new code.

`at()` is bounds-checked and throws `std::out_of_range`; `operator[]` is not
checked, exactly like a raw array. Use `at()` when the index comes from
somewhere you do not control.

```cpp run title="at() turns a silent corruption into an exception" std=c++20
#include <array>
#include <iostream>
#include <stdexcept>

int main() {
    std::array<int, 3> values{1, 2, 3};

    try {
        std::cout << values.at(7) << '\n';
    } catch (const std::out_of_range& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
}
```

### std::vector — when the size is not known until run time

```cpp run title="A size decided at run time" std=c++20
#include <iostream>
#include <vector>

int main() {
    int n = 4;                       // imagine this came from input
    std::vector<int> values(n, 7);   // n elements, each 7

    values.push_back(8);             // and it can grow

    std::cout << "size " << values.size() << ": ";
    for (int v : values) std::cout << v << ' ';
    std::cout << '\n';
}
```

:::note
A raw array's length must be a compile-time constant. Some compilers accept
`int a[n]` with a run-time `n` as an extension — *variable-length arrays*, a C99
feature — but it is not C++, it is not portable, and it puts an unbounded amount
of data on a bounded stack. Use `std::vector`.
:::

### The comparison

| | raw array | `std::array<T, N>` | `std::vector<T>` |
|---|---|---|---|
| Size fixed at | compile time | compile time | run time |
| Knows its own size | only before decay | always | always |
| Decays to a pointer | yes | no | no |
| Copyable, returnable | no | yes | yes |
| Bounds-checked option | no | `at()` | `at()` |
| Storage | wherever declared | wherever declared | heap |
| Overhead vs raw array | — | none | one allocation |

## Where raw arrays still appear

Two places, both worth recognising.

**String literals.** `"hello"` is a `const char[6]` — five characters and a
terminating `'\0'` — which decays to `const char*` almost immediately.

```cpp run title="A literal is an array"
#include <iostream>

int main() {
    const char literal[] = "hello";

    std::cout << "sizeof literal: " << sizeof(literal) << " (5 chars + '\\0')\n";

    const char* decayed = literal;
    std::cout << "sizeof decayed: " << sizeof(decayed) << " (a pointer)\n";
    std::cout << "text: " << decayed << '\n';
}
```

**C interfaces.** Any C library you call takes pointer-and-length pairs, because
that is all C has. `std::vector::data()` and `std::array::data()` hand you the
pointer when you need to cross that boundary.

## Check yourself

:::quiz
{
  "question": "`void f(int a[10]);` — what does `sizeof(a)` give inside `f` on a 64-bit machine?",
  "options": [
    { "text": "40 — ten ints", "why": "That is what it gives at the declaration site. The parameter is not an array; the `[10]` is ignored." },
    { "text": "8 — a pointer", "correct": true, "why": "Array parameters decay: `int a[10]`, `int a[]`, and `int* a` all declare the same parameter, and you may pass an array of any length." },
    { "text": "10", "why": "`sizeof` is measured in bytes, never elements. The element count would be sizeof(a)/sizeof(a[0]), which is also wrong here." },
    { "text": "It does not compile", "why": "It compiles and gives a plausible wrong answer, which is exactly why this rule causes so much trouble." }
  ]
}
:::

:::quiz
{
  "question": "You need a collection whose size comes from a configuration file read at startup. What should you use?",
  "options": [
    { "text": "A raw array, sized with the value from the file", "why": "A raw array's length must be a compile-time constant. `int a[n]` with a run-time `n` is a non-standard extension, and it puts unbounded data on a bounded stack." },
    { "text": "`std::array<int, N>` with N a large upper bound", "why": "It compiles, but it wastes memory when the real size is small and breaks when the configuration exceeds your guess. The size is genuinely dynamic." },
    { "text": "`std::vector<int>`", "correct": true, "why": "Right. Its size is a run-time value, it owns its heap storage, and it frees it in its destructor. One allocation is the entire cost." },
    { "text": "`new int[n]` with a matching `delete[]`", "why": "It works, but you have re-implemented vector's constructor and destructor by hand, and every exception between them is now a leak." }
  ]
}
:::

## Practice

:::exercise array-length

:::recap
- A raw array decays to a pointer to its first element in almost every context,
  and its length is lost when it does.
- It does not decay under `sizeof`, `&`, a reference-to-array binding, or a
  range-based for. That last one is why range-for works on arrays.
- `sizeof(a)/sizeof(a[0])` is silently wrong on a decayed pointer. `std::size`
  refuses to compile instead.
- Nothing bounds-checks a raw array. Out-of-bounds access is undefined behaviour
  and the classic security bug.
- Use `std::array` when the size is a compile-time constant and `std::vector`
  when it is not. Neither decays; both cost nothing extra over a raw array
  beyond vector's single allocation.
:::
