---
title: "const and constness"
navTitle: "const and constness"
summary: >-
  A promise to the compiler and to the reader, enforced at compile time.
objectives:
  - Read a const declaration right-to-left without guessing
  - Explain the difference between a const pointer and a pointer to const
  - Decide where const belongs in an interface
status: complete
standard: c++20
requires: [pointers, references]
---

`const` means *this will not be modified through this name*. That phrasing is
deliberate and every word earns its place: it is a promise attached to a name,
not a property of the underlying object, and the compiler enforces it at compile
time and then forgets about it.

It costs nothing at run time. What it buys is that a whole category of mistake
becomes a compile error, and that a reader can tell from a signature alone
whether a function will change their data.

## The basic promise

```cpp run expect-error title="What const forbids"
int main() {
    const int limit = 100;
    limit = 200;              // error: assignment of read-only variable
}
```

The error arrives at compile time, before the program has a chance to be wrong.

`const` variables must be initialised where they are declared, for the obvious
reason that there is no later opportunity.

## Reading declarations right to left

The rule that removes all guesswork: read from the variable's name, outwards,
right to left.

```cpp run title="Three declarations, three different promises" std=c++20
#include <iostream>

int main() {
    int a = 1, b = 2;

    // p is a pointer to a const int
    const int* p = &a;
    p = &b;              // fine: p itself is not const
    // *p = 5;           // error: cannot write through p

    // q is a const pointer to an int
    int* const q = &a;
    *q = 5;              // fine: what q points at is not const
    // q = &b;           // error: q itself is const

    // r is a const pointer to a const int
    const int* const r = &a;

    std::cout << "a = " << a << ", *p = " << *p << ", *r = " << *r << '\n';
}
```

- `const int* p` → *`p` is a pointer to an int that is const*. The **pointee**
  is protected.
- `int* const q` → *`q` is a const pointer to an int*. The **pointer** is
  protected.
- `const int* const r` → both.

`int const* p` is identical to `const int* p` — when `const` appears leftmost,
it binds to the type on its right. Some people write the `const` on the right
consistently (`int const*`) precisely so that right-to-left reading always works
without that exception. Either is fine; be consistent.

`const int* p` is the one you will write constantly, because it is how a
function says *I will read this and not change it*.

## const references, and why they are everywhere

```cpp run title="The default parameter for anything large" std=c++20
#include <iostream>
#include <string>
#include <vector>

// Reads only. No copy, and the compiler enforces the promise.
std::size_t total_length(const std::vector<std::string>& items) {
    std::size_t total = 0;
    for (const std::string& item : items) {
        total += item.size();
        // item += "!";    // error: item is a const reference
    }
    return total;
}

int main() {
    std::vector<std::string> words{"alpha", "beta", "gamma"};
    std::cout << total_length(words) << '\n';

    // A const reference also binds to a temporary, which a non-const one cannot.
    std::cout << total_length({"one", "two"}) << '\n';
}
```

That last line is a genuine practical advantage, not a curiosity. `const T&`
binds to temporaries; `T&` does not. A function taking `std::string&` cannot be
called with a literal, so making a read-only parameter non-const gratuitously
restricts your callers.

```cpp run expect-error title="A non-const reference will not take a temporary"
#include <string>

void shout(std::string& text) { text += "!"; }

int main() {
    shout("hello");    // error: cannot bind a non-const lvalue ref to a temporary
}
```

The error is the compiler protecting you: modifying a temporary that is about to
be destroyed is almost always a mistake, so the language will not let a
non-const reference bind to one.

## const member functions

On a class, `const` after the parameter list promises that calling this function
does not modify the object.

```cpp run title="What you may call on a const object" std=c++20
#include <iostream>
#include <string>

class Account {
public:
    explicit Account(int start) : balance_(start) {}

    int balance() const { return balance_; }     // promises not to modify
    void deposit(int amount) { balance_ += amount; }

private:
    int balance_;
};

void audit(const Account& account) {
    std::cout << "balance: " << account.balance() << '\n';
    // account.deposit(10);    // error: deposit is not const
}

int main() {
    Account a{100};
    a.deposit(50);
    audit(a);
}
```

This is what makes `const&` parameters useful rather than merely safe. Inside
`audit`, the object is const, so only the const member functions are callable —
and that is enforced, not documented.

:::tip
Mark every member function const that does not modify the object. It is not
politeness: a member function that *should* be const but is not makes the class
unusable through a `const&`, which is how most code will want to hold it. This
is easy to fix while writing the class and tedious to retrofit.
:::

## What const does not promise

Three limits worth knowing, because over-trusting `const` causes its own bugs.

**It is shallow.** A const object's members are const, but if a member is a
pointer, `const` applies to the pointer, not to what it points at:

```cpp run title="const stops at the pointer" std=c++20
#include <iostream>

struct Holder {
    int* data;
};

int main() {
    int value = 1;
    const Holder h{&value};

    // h.data = nullptr;     // error: the pointer is const
    *h.data = 99;            // fine: what it points at is not

    std::cout << "value = " << value << '\n';
}
```

`const Holder` made `h.data` a `int* const`, not a `const int* const`. If you
want the deep promise, the member has to be declared `const int*`.

**It does not mean "stored in read-only memory".** A `const` local is an
ordinary object on the stack; `const` is a rule about names, checked by the
compiler. Only objects with static storage and constant initialisation are
likely to end up in a genuinely read-only page.

**It can be cast away.** `const_cast` removes it, and doing so is legal — but
*writing* through the result is undefined behaviour if the object was originally
declared `const`:

```cpp run title="const_cast, and when it is not a lie" std=c++20
#include <iostream>

void legacy_api(char* text) { std::cout << "legacy got: " << text << '\n'; }

int main() {
    char buffer[] = "modifiable";
    const char* view = buffer;          // we chose to view it as const

    // The underlying object is not const, so casting back is well defined.
    legacy_api(const_cast<char*>(view));
}
```

That is the one legitimate use: interfacing with an old API that takes a
non-const pointer but does not actually modify. If the object itself was
declared `const`, casting the constness away and writing is undefined behaviour,
and the optimizer will happily assume you did not.

:::warning
`const_cast` on an object that is genuinely const is undefined behaviour, and it
is the kind that produces baffling results rather than crashes: the compiler may
have folded the constant into the instructions, so your write succeeds and every
read still sees the old value.
:::

## constexpr, briefly

`const` says *not modified through this name*. `constexpr` says *computable at
compile time* — a stronger and different claim.

```cpp run title="const versus constexpr" std=c++20
#include <array>
#include <iostream>

int runtime_value() { return 5; }

int main() {
    const int a = runtime_value();     // const, but not known until run time
    constexpr int b = 5;               // known at compile time

    std::array<int, b> fixed{};        // fine: b is a constant expression
    // std::array<int, a> broken{};    // error: a is not

    std::cout << "a = " << a << ", array size = " << fixed.size() << '\n';
}
```

Every `constexpr` variable is implicitly `const`, but not every `const` variable
is `constexpr`. Chapter 5.5 covers compile-time computation properly; for now,
use `constexpr` for genuine compile-time constants and `const` for everything
else.

## Where to put const

A short set of defaults that will serve you for years:

- **Parameters you only read, and that are larger than a pointer:**
  `const T&`.
- **Parameters you only read, and that are small:** plain `T` by value — adding
  `const` to a by-value parameter in a declaration is noise, since the caller's
  object is untouched either way.
- **Member functions that do not modify the object:** `const`, always.
- **Local variables you will not reassign:** `const` is cheap and documents
  intent, though opinions differ on whether it earns its keep everywhere.
- **Return types:** do not return `const T` by value; it is pointless and it
  blocks moves, making your callers slower.

## Check yourself

:::quiz
{
  "question": "`const int* p = &x;` — what may you not do?",
  "options": [
    { "text": "Reassign `p` to point elsewhere", "why": "You may. The const applies to the pointee here, not to the pointer, so `p = &y;` is fine." },
    { "text": "Write through it, as in `*p = 5`", "correct": true, "why": "Right. Read it right-to-left: `p` is a pointer to a const int. The thing pointed at is protected from modification through this name." },
    { "text": "Read through it, as in `int a = *p`", "why": "Reading is exactly what a pointer-to-const is for. It is writing that is forbidden." },
    { "text": "Pass it to a function taking `const int*`", "why": "That is the natural thing to do with it — the types match exactly." }
  ]
}
:::

:::quiz
{
  "question": "Why can't `void f(std::string& s)` be called as `f(\"hello\")`?",
  "options": [
    { "text": "String literals are `const char[]`, and no conversion to `std::string` exists", "why": "The conversion does exist — that is why the const-reference version compiles. The problem is what the conversion produces." },
    { "text": "The conversion creates a temporary, and a non-const lvalue reference cannot bind to one", "correct": true, "why": "Exactly. The temporary is about to be destroyed, so letting `f` modify it would almost certainly be a mistake — and the language forbids the binding rather than allowing it silently." },
    { "text": "It would compile, but the modification would be lost", "why": "It does not compile at all. The language turns what would be a silent no-op into a diagnosable error." },
    { "text": "`std::string` has no constructor taking a literal", "why": "It has one, and it is what makes `std::string s = \"hello\";` work." }
  ]
}
:::

## Practice

:::exercise const-correct-api

:::recap
- `const` means *not modified through this name*. It is checked at compile time
  and costs nothing at run time.
- Read declarations right-to-left from the name. `const int*` protects the
  pointee; `int* const` protects the pointer.
- `const T&` is the default for read-only parameters larger than a pointer, and
  unlike `T&` it binds to temporaries.
- Mark every non-modifying member function `const`, or the class becomes
  unusable through a `const&`.
- `const` is shallow, is not the same as read-only memory, and can be cast away
  — but writing through a cast-away const on a genuinely const object is
  undefined behaviour.
- `constexpr` is a different, stronger claim: computable at compile time.
:::
