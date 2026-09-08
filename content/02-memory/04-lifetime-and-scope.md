---
title: "Lifetime and scope"
navTitle: "Lifetime and scope"
summary: >-
  When an object starts existing, when it stops, and what touching it outside that window costs.
objectives:
  - State the lifetime of automatic, static, and dynamic objects
  - Spot a returned reference to a local
  - Explain why destruction order is the reverse of construction
status: complete
standard: c++20
requires: [pointers, references]
---

The last two chapters both ended at the same cliff: a pointer or reference that
outlived the thing it named. This chapter is the map of that cliff.

Two words that get used interchangeably are worth separating first.

- **Scope** is a region of *source text* where a name is usable. It is a
  compile-time idea; the compiler enforces it, and getting it wrong is an error.
- **Lifetime** is the span of *run time* during which an object exists. It is a
  run-time idea; nothing enforces it, and getting it wrong is undefined
  behaviour.

For ordinary local variables the two line up, which is why they get conflated.
Everywhere else they come apart, and that gap is where the bugs live.

## The three storage durations

Every object gets its storage in one of three ways, and that choice decides its
lifetime.

```cpp run title="Three lifetimes in one program"
#include <iostream>
#include <memory>

int counter() {
    static int calls = 0;   // static: created once, lives until the program ends
    return ++calls;
}

int main() {
    int automatic = 1;                              // automatic: lives until }

    std::unique_ptr<int> dynamic = std::make_unique<int>(2);  // dynamic: lives
                                                              // until released

    std::cout << "automatic " << automatic << ", dynamic " << *dynamic << '\n';
    std::cout << "counter: " << counter() << counter() << counter() << '\n';
}
```

**Automatic** objects — ordinary local variables — are created when control
reaches the declaration and destroyed when control leaves the enclosing block,
by any route. Their storage is the stack, which is why it costs essentially
nothing: entering a function moves one register.

**Static** objects live from first use (or program start) until after `main`
returns. `calls` above keeps its value across calls because it is not recreated
each time.

**Dynamic** objects are created by `new` (usually via a smart pointer) and live
until explicitly released. This is the only one where *you* choose the endpoint,
and therefore the only one you can get wrong in both directions — releasing too
early, or never.

:::note
A fourth duration, *thread storage*, exists via `thread_local`: one object per
thread, created when the thread starts. It matters in Part 8 and nowhere before.
:::

## A block is a lifetime

```cpp run title="Watching construction and destruction"
#include <iostream>
#include <string>

struct Noisy {
    std::string name;
    explicit Noisy(std::string n) : name(std::move(n)) {
        std::cout << "  + " << name << " constructed\n";
    }
    ~Noisy() {
        std::cout << "  - " << name << " destroyed\n";
    }
};

int main() {
    std::cout << "entering main\n";
    Noisy outer{"outer"};

    {
        std::cout << "entering block\n";
        Noisy inner{"inner"};
        std::cout << "leaving block\n";
    }

    std::cout << "back in main\n";
}
```

Three things to take from that output.

`inner` was destroyed at the closing brace, not at the end of `main`. A block —
any pair of braces — is a lifetime boundary.

Destruction ran in **reverse order of construction**. This is guaranteed, and it
is not arbitrary: a later object may have been built using an earlier one, so
the earlier one must still be alive while the later one is torn down.

And the destructor ran without you writing anything at the end of the block.
That automatic, guaranteed cleanup is the mechanism the whole language leans on
for resource management — Chapter 3.2 gives it a name and builds on it.

:::memviz
{
  "title": "The stack grows and unwinds",
  "code": "int main() {\n    Noisy outer{\"outer\"};\n\n    {\n        Noisy inner{\"inner\"};\n    }\n\n    // back in main\n}",
  "steps": [
    {
      "caption": "`main` starts. Its frame is on the stack; nothing is constructed yet.",
      "line": 1,
      "stack": [
        { "id": "frame", "name": "main()", "type": "frame", "value": "(empty)" }
      ]
    },
    {
      "caption": "`outer` is constructed. It lives for as long as `main`'s body runs.",
      "line": 2,
      "stack": [
        { "id": "outer", "name": "outer", "type": "Noisy", "value": "\"outer\"", "state": "new" }
      ]
    },
    {
      "caption": "Entering the inner block. `inner` is constructed above `outer` — later objects sit closer to the top of the stack.",
      "line": 5,
      "stack": [
        { "id": "inner", "name": "inner", "type": "Noisy", "value": "\"inner\"", "state": "new",
          "note": "inner block" },
        { "id": "outer", "name": "outer", "type": "Noisy", "value": "\"outer\"" }
      ]
    },
    {
      "caption": "The closing brace ends `inner`'s lifetime. Its destructor runs here, not at the end of main.",
      "line": 6,
      "stack": [
        { "id": "inner", "name": "inner", "type": "Noisy", "value": "destroyed", "state": "freed" },
        { "id": "outer", "name": "outer", "type": "Noisy", "value": "\"outer\"" }
      ]
    },
    {
      "caption": "`main` returns. `outer` is destroyed last — reverse order of construction, always.",
      "line": 9,
      "stack": [
        { "id": "outer", "name": "outer", "type": "Noisy", "value": "destroyed", "state": "freed" }
      ]
    }
  ]
}
:::

## Destruction happens on every exit path

Including the ones you did not write:

```cpp run title="Early return, and an exception"
#include <iostream>
#include <stdexcept>
#include <string>

struct Noisy {
    std::string name;
    explicit Noisy(std::string n) : name(std::move(n)) { std::cout << "  + " << name << '\n'; }
    ~Noisy() { std::cout << "  - " << name << '\n'; }
};

void early_return(bool bail) {
    Noisy guard{"guard"};
    if (bail) {
        std::cout << "returning early\n";
        return;              // guard is destroyed here
    }
    std::cout << "reaching the end\n";
}

void throws() {
    Noisy guard{"thrown-past"};
    throw std::runtime_error("something failed");
}

int main() {
    early_return(true);
    early_return(false);

    try {
        throws();
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
}
```

`guard` is destroyed on the early return and on the way out through the throw.
Stack unwinding destroys every automatic object between the throw and the
handler, in reverse order. There is no path out of a scope that skips
destructors.

:::pitfall
There is one way to skip them: `std::exit`, `std::abort`, or a `longjmp` past
them. `std::exit` runs destructors for static objects but *not* for automatic
ones in frames still on the stack, and `std::abort` runs neither. This is why
`exit()` deep inside a library is antisocial — it silently discards other
people's cleanup.
:::

## Static objects, and the trap in their order

Static objects inside a function are created on first use, which is well
defined. Static objects at namespace scope, across different source files, are
not:

```cpp run title="Function-local statics are initialised on first use"
#include <iostream>

struct Config {
    Config() { std::cout << "  Config built\n"; }
    int retries = 3;
};

const Config& config() {
    static Config instance;   // built the first time this runs, never again
    return instance;
}

int main() {
    std::cout << "before first call\n";
    std::cout << "retries: " << config().retries << '\n';
    std::cout << "retries: " << config().retries << '\n';
}
```

`Config` was built once, at the first call, not at program start. That pattern —
a function-local static returned by reference — is the standard fix for the
**static initialisation order fiasco**: two namespace-scope statics in different
translation units have no defined initialisation order relative to each other,
so if one's constructor uses the other, it may run first and read a
not-yet-constructed object. Wrapping each in a function makes "first use" the
ordering, which is always correct.

Function-local static initialisation is also thread-safe since C++11: if two
threads reach it at once, one initialises and the other waits.

## Dangling, precisely

Now the rule can be stated exactly. **A pointer or reference is valid only
within the lifetime of the object it names.** Every dangling bug is a violation
of that one sentence, and they come in a small number of shapes:

```cpp run expect-ub title="Four shapes of the same mistake"
#include <iostream>
#include <string>
#include <vector>

int main() {
    // 1. Referring into a container that reallocates.
    std::vector<int> v{1, 2, 3};
    int* first = &v[0];
    v.push_back(4);              // may reallocate, moving every element
    std::cout << "stale element: " << *first << '\n';   // undefined
}
```

The other three, which you now have the vocabulary for:

2. **A reference to a local, returned.** Covered in the last chapter; the
   compiler catches the single-function case.
3. **A pointer into a temporary that has been destroyed.**
   `const char* p = std::string("hi").c_str();` — the string dies at the end of
   the full expression, and `p` points into freed memory on the next line.
4. **A pointer to a dynamic object after `delete`.** The classic use-after-free;
   the pointer is unchanged, the memory is not yours.

Container invalidation, shape 1, is the one that surprises people most, because
nothing was deleted and no scope was left. `push_back` needed more room,
allocated a bigger block, moved the elements, and freed the old one — and every
pointer, reference, and iterator into the old block became stale. Chapter 4.2
gives the exact rules for which operations invalidate what.

:::tip
When you find yourself storing a pointer or reference as a class member, stop
and ask who guarantees the target outlives the object holding it. If the answer
is not obvious in one sentence, hold a value or a `std::shared_ptr` instead.
Most lifetime bugs enter a codebase as a member that seemed fine at the time.
:::

## Check yourself

:::quiz
{
  "question": "In what order are `a`, `b`, and `c` destroyed, given `A a; B b; C c;` in one block?",
  "options": [
    { "text": "a, b, c — the order they were declared", "why": "Destruction is the reverse of construction. Declaration order determines construction order, not destruction." },
    { "text": "c, b, a", "correct": true, "why": "Reverse order of construction, guaranteed. It has to be: `c` may have been built using `b`, so `b` must still be alive while `c` is destroyed." },
    { "text": "Unspecified — the compiler may choose", "why": "This one is firmly specified. Unspecified order applies to namespace-scope statics across translation units, which is a different problem." },
    { "text": "It depends on which was allocated on the heap", "why": "All three are automatic objects here. Heap objects have dynamic lifetime, ended by delete or a smart pointer's destructor." }
  ]
}
:::

:::quiz
{
  "question": "`std::vector<int> v{1,2,3}; int& r = v[0]; v.push_back(4);` — is `r` still usable?",
  "options": [
    { "text": "Yes — push_back only adds at the end", "why": "It adds at the end, but it may first allocate a larger block and move every element into it, leaving the old block freed." },
    { "text": "No — push_back may reallocate, and then `r` refers into freed memory", "correct": true, "why": "Exactly. Whether it actually reallocates depends on the capacity, which is precisely what makes this bug intermittent and hard to find." },
    { "text": "No — push_back always invalidates all references", "why": "Not always: if capacity() > size() there is room already and nothing moves. 'Sometimes' is worse than 'always' here, because it survives testing." },
    { "text": "Yes, provided you do not modify v afterwards", "why": "The damage is already done by push_back itself, not by later modification." }
  ]
}
:::

## Practice

:::exercise reverse-destruction

:::recap
- Scope is where a name is visible (compile time); lifetime is when an object
  exists (run time). Only the first is enforced.
- Automatic objects live until the enclosing block ends, on every exit path
  including exceptions. Static objects live until after `main`. Dynamic objects
  live until you release them.
- Destruction is always the reverse of construction.
- A function-local static is built on first use and is thread-safe, which is the
  cure for the static initialisation order fiasco.
- A pointer or reference is valid only within the lifetime of what it names.
  Container reallocation ends lifetimes without any scope being left.
:::
