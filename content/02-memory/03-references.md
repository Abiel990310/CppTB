---
title: "References"
navTitle: "References"
summary: >-
  Another name for an existing object, and how that differs from a pointer.
objectives:
  - Choose between a reference and a pointer for a given interface
  - Explain why a reference cannot be reseated
  - Identify when a reference outlives what it refers to
status: complete
standard: c++20
requires: [pointers]
---

A reference is a second name for an object that already exists. Not a copy, not
a pointer to it — a name. Once bound, it refers to that object for the rest of
its life, and every operation on the reference is an operation on the original.

This is the tool you reach for far more often than pointers. Most C++ code that
needs to talk about an existing object uses a reference; pointers come out when
"no object" has to be representable, or when the thing being referred to has to
change.

## Binding a reference

```cpp run title="A reference is a name, not an object"
#include <iostream>

int main() {
    int  original = 10;
    int& alias    = original;   // alias IS original, under another name

    alias = 25;
    std::cout << "original = " << original << '\n';

    original = 7;
    std::cout << "alias    = " << alias << '\n';

    std::cout << "same address? "
              << (&original == &alias ? "yes" : "no") << '\n';
}
```

`&original == &alias` because there is one object. Taking the address of a
reference gives you the address of what it refers to — there is no separate
"reference object" to point at.

Compare that with the pointer version from the last chapter: a pointer is its
own object with its own address, holding a number. A reference adds no storage
you can observe.

## A reference must be initialised, and cannot be moved

Two rules follow from "a reference is a name":

```cpp run expect-error title="A reference with nothing to name"
int main() {
    int& dangling;   // a name for what?
}
```

There is no such thing as an unbound reference. The compiler rejects it outright
— compare that with a pointer, which is perfectly happy to be uninitialised and
then explode later.

The second rule is subtler:

```cpp run title="Assignment writes through, it does not rebind"
#include <iostream>

int main() {
    int a = 1, b = 2;
    int& ref = a;

    ref = b;        // NOT "make ref refer to b" — this writes b's value into a

    std::cout << "a = " << a << ", b = " << b << '\n';
    std::cout << "ref names a? " << (&ref == &a ? "yes" : "no") << '\n';
}
```

`ref = b` copied `b`'s value into `a`. It did not make `ref` name `b`. Once
bound, a reference cannot be *reseated*, and there is no syntax that would do
it: every use of the name means the object.

:::note
This is the practical difference from a pointer. `p = &b` repoints a pointer;
nothing repoints a reference. If your design needs the thing being referred to
to change over time, you need a pointer — or, more often, a rethink.
:::

## What references are actually for

### Passing without copying

```cpp run title="Three ways to take a parameter"
#include <iostream>
#include <string>

void by_value(std::string s)        { s += " (changed)"; }
void by_reference(std::string& s)   { s += " (changed)"; }
void by_const_ref(const std::string& s) { std::cout << "read: " << s << '\n'; }

int main() {
    std::string text = "hello";

    by_value(text);
    std::cout << "after by_value:     " << text << '\n';

    by_reference(text);
    std::cout << "after by_reference: " << text << '\n';

    by_const_ref(text);
}
```

`by_value` copied the whole string — allocation and all — modified the copy, and
threw it away. `by_reference` operated on the caller's object.

The default you want for anything bigger than a pointer is `const T&`: no copy,
and a compiler-enforced promise not to modify. It is so common that reading
`const std::string&` should feel like reading a single word.

:::tip
The rule of thumb: pass by value for small, cheap-to-copy types (`int`,
`double`, a pointer, `std::string_view`); pass by `const T&` for anything larger
that you only read; pass by `T&` when the caller expects you to modify their
object. Chapter 3.4 adds a fourth case, `T&&`, for when you are taking ownership.
:::

The cost is real and measurable:

```cpp run title="What a copy costs" std=c++20
#include <chrono>
#include <iostream>
#include <string>

std::size_t by_value(std::string s)          { return s.size(); }
std::size_t by_const_ref(const std::string& s) { return s.size(); }

int main() {
    const std::string big(100'000, 'x');
    constexpr int rounds = 2000;

    auto time = [&](auto&& fn) {
        auto start = std::chrono::steady_clock::now();
        std::size_t total = 0;
        for (int i = 0; i < rounds; ++i) total += fn(big);
        auto finish = std::chrono::steady_clock::now();
        std::cout << "  (checksum " << total << ") ";
        return std::chrono::duration_cast<std::chrono::microseconds>(finish - start).count();
    };

    std::cout << "by value:     " << time(by_value)     << " us\n";
    std::cout << "by const ref: " << time(by_const_ref) << " us\n";
}
```

Same answer, and the by-value version does a hundred thousand bytes of copying
two thousand times to get it.

### Returning something the caller can modify

```cpp run title="A reference as a return value"
#include <iostream>
#include <vector>

int& largest(std::vector<int>& v) {
    int* best = &v[0];
    for (int& x : v) {
        if (x > *best) best = &x;
    }
    return *best;
}

int main() {
    std::vector<int> data{3, 9, 4};

    largest(data) = 0;     // assign through the returned reference

    for (int x : data) std::cout << x << ' ';
    std::cout << '\n';
}
```

`largest(data) = 0` looks strange the first time. It works because `largest`
returns a name for an element that still exists, so assigning to that name
assigns to the element. This is exactly how `v[i]` and `m[key]` work.

### Range-based for, without copies

```cpp run title="The loop variable is a reference too"
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> words{"alpha", "beta", "gamma"};

    for (std::string w : words) w += "!";          // modifies copies
    std::cout << "after by-value loop:  " << words[0] << '\n';

    for (std::string& w : words) w += "!";         // modifies the elements
    std::cout << "after by-reference:   " << words[0] << '\n';

    for (const std::string& w : words) std::cout << w << ' ';
    std::cout << '\n';
}
```

The first loop is a common bug and a common waste: it copies every element,
modifies the copy, and discards it. `for (const auto& x : container)` should be
your reflex.

## References can dangle too

A reference is safer than a pointer in that it is never null and never
uninitialised. It is *not* safer about lifetime:

```cpp run expect-ub title="Returning a reference to a local"
#include <string>

const std::string& make_greeting() {
    std::string greeting = "hello";
    return greeting;              // greeting dies at the closing brace
}

int main() {
    const std::string& r = make_greeting();
    return static_cast<int>(r.size());
}
```

The compiler warns — `-Wreturn-local-addr` again — and, exactly as with the
pointer version, hands back a null reference rather than one into dead stack, so
the program fails immediately with `reference binding to null pointer`. And
exactly as with pointers, that help stops the moment the mistake spans two
functions, where no warning is possible and only the sanitizer notices.

A reference is therefore *not* a lifetime guarantee. It guarantees that a valid
object existed when the reference was bound; keeping it valid afterwards is
still your job.

The reference-specific version of the trap involves temporaries:

```cpp run title="A temporary, and the reference that saves it"
#include <iostream>
#include <string>

std::string build() { return "a temporary string"; }

int main() {
    // Binding a temporary to a const reference extends its lifetime
    // to match the reference. This is safe, and deliberate.
    const std::string& kept = build();
    std::cout << kept << '\n';

    // But lifetime extension does NOT pass through a function return,
    // and it does not apply to a reference to a member of a temporary.
    std::cout << "still alive: " << kept.size() << " characters\n";
}
```

:::pitfall
Lifetime extension is narrow, and people over-trust it. It applies when a
temporary is bound *directly* to a local `const` reference (or an rvalue
reference). It does **not** apply when the temporary is bound to a reference
parameter and returned, nor when you bind a reference to a subobject of a
temporary returned by a function. `const std::string& s = get_object().name();`
leaves `s` dangling as soon as the statement ends — the temporary object is
destroyed and `s` refers into its corpse.
:::

## Reference or pointer?

| Use a reference when | Use a pointer when |
|---|---|
| The object definitely exists | "No object" is a valid state (use `nullptr`) |
| You will refer to the same object throughout | The target must change over time |
| You want the call site to look like a normal value | You want the call site to show that something may be modified, via `&x` |
| Passing a parameter you read or modify | Iterating raw memory, or interfacing with C |

When both would work, prefer the reference. It cannot be null, cannot be
uninitialised, and needs no `*` at every use.

:::history
References were in C++ from the very beginning, added largely so that
`operator=` and other operator overloads could take their operands naturally.
Without them, `a + b` on user-defined types would either copy everything or
require the pointer syntax `&a + &b`, which is both ugly and means something
else entirely.
:::

## Check yourself

:::quiz
{
  "question": "`int a = 1, b = 2; int& r = a; r = b;` — what is true afterwards?",
  "options": [
    { "text": "`r` now refers to `b`, and `a` is still 1", "why": "References cannot be reseated. There is no syntax that makes an existing reference refer to a different object." },
    { "text": "`a` is 2, and `r` still refers to `a`", "correct": true, "why": "Right. `r = b` is an assignment through the name `r`, so it writes b's value into a. The binding never changes." },
    { "text": "It does not compile — you cannot assign to a reference", "why": "You can, and it is the normal way to write through one. The assignment targets the referred-to object." },
    { "text": "Both `a` and `b` become 2 and stay linked", "why": "Assignment copies a value once. It does not create an ongoing relationship between two objects." }
  ]
}
:::

:::quiz
{
  "question": "Which parameter should `void log(??? message)` take, if it only prints the message and messages are often long?",
  "options": [
    { "text": "`std::string message`", "why": "That copies the whole string — allocation included — on every call, to do something that only reads it." },
    { "text": "`const std::string& message`", "correct": true, "why": "No copy, and the const documents and enforces that log does not modify the caller's string. This is the default choice for a large read-only parameter." },
    { "text": "`std::string& message`", "why": "It avoids the copy, but the missing const says log may modify the argument — and it stops callers passing a temporary or a literal." },
    { "text": "`std::string* message`", "why": "It works, but it forces every call site to write `&` and forces log to handle null. Nothing here needs the ability to say 'no message'." }
  ]
}
:::

## Practice

:::exercise swap-by-reference

:::exercise avoid-the-copy

:::recap
- A reference is another name for an existing object. It adds no storage and has
  no address of its own.
- It must be initialised, and it can never be reseated. `r = x` writes through
  the reference; it does not rebind it.
- `const T&` is the default way to pass anything larger than a pointer that you
  only read. `T&` when you will modify it.
- `for (const auto& x : c)` should be your reflex; the by-value form silently
  copies every element.
- References cannot be null or uninitialised, but they can dangle. Lifetime
  extension of a temporary is narrower than most people assume.
:::
