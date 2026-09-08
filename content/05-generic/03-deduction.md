---
title: "Deduction and forwarding"
navTitle: "Deduction and forwarding"
summary: >-
  How types are worked out, and how to pass them on unchanged.
objectives:
  - Explain the difference between auto and template deduction
  - Write a perfectly forwarding wrapper
  - Explain what a forwarding reference is and how to spot one
status: complete
standard: c++20
requires: [concepts, moving]
---

Chapter 5.1 said the compiler works out `T` from the arguments. This chapter is
about the rules it uses — because they are not quite what you would guess, and
the surprises account for a good share of template bugs.

## Deduction drops references and const

```cpp run title="What by-value deduction throws away" std=c++20
#include <iostream>
#include <string>
#include <type_traits>

template <class T>
void show_deduced(T) {
    std::cout << "  is reference: " << std::boolalpha << std::is_reference_v<T>
              << ", is const: " << std::is_const_v<std::remove_reference_t<T>> << '\n';
}

int main() {
    std::string value = "hello";
    const std::string& ref = value;

    std::cout << "passing a std::string:\n";        show_deduced(value);
    std::cout << "passing a const std::string&:\n"; show_deduced(ref);
}
```

Both deduce `T = std::string`. A by-value parameter always gets its own copy, so
the reference and the `const` are irrelevant to it and are stripped.

`auto` follows the same rules, which is the connection worth remembering:

```cpp run title="auto is template deduction" std=c++20
#include <iostream>
#include <string>
#include <type_traits>

int main() {
    const std::string original = "hello";

    auto copy = original;              // std::string — const dropped
    const auto& observer = original;   // const std::string& — as written
    auto& mutable_ref = const_cast<std::string&>(original);

    std::cout << std::boolalpha;
    std::cout << "copy is const:        " << std::is_const_v<decltype(copy)> << '\n';
    std::cout << "observer is const&:   "
              << std::is_reference_v<decltype(observer)> << '\n';

    copy += " world";                  // legal: it is a separate object
    std::cout << "copy: " << copy << ", original: " << original << '\n';
    (void)mutable_ref;
}
```

This is the Chapter 1.2 pitfall stated precisely: `auto x = container.front();`
copies even when `front()` returns a reference, because plain `auto` deduces by
value and drops the reference. Write `auto&` or `const auto&` when you meant to
bind.

## decltype, and decltype(auto)

`decltype(expr)` gives the *declared type* of an expression, keeping references
and `const`:

```cpp run title="decltype preserves what auto drops" std=c++20
#include <iostream>
#include <string>
#include <type_traits>
#include <vector>

int main() {
    std::vector<std::string> words{"alpha"};

    auto a = words.front();              // std::string — a copy
    decltype(words.front()) b = words.front();   // std::string& — a reference

    std::cout << std::boolalpha;
    std::cout << "auto:     reference? " << std::is_reference_v<decltype(a)> << '\n';
    std::cout << "decltype: reference? " << std::is_reference_v<decltype(b)> << '\n';

    b += "!";
    std::cout << "modifying b changed the container: " << words.front() << '\n';
}
```

`decltype(auto)` combines them: deduce like `decltype` — keeping references —
rather than like `auto`. That matters most for a function that forwards a return
value:

```cpp run title="Returning what the callee returned" std=c++20
#include <iostream>
#include <type_traits>
#include <vector>

std::vector<int> data{1, 2, 3};

int& element() { return data[0]; }

// auto strips the reference: the caller gets a copy.
auto by_auto() { return element(); }

// decltype(auto) keeps it: the caller gets the reference.
decltype(auto) by_decltype_auto() { return element(); }

int main() {
    std::cout << std::boolalpha;
    std::cout << "by_auto returns a reference:          "
              << std::is_reference_v<decltype(by_auto())> << '\n';
    std::cout << "by_decltype_auto returns a reference: "
              << std::is_reference_v<decltype(by_decltype_auto())> << '\n';

    by_decltype_auto() = 99;
    std::cout << "assigning through it changed data[0]: " << data[0] << '\n';
}
```

## Forwarding references

Here is the rule that looks like a special case and is the whole basis of
generic wrappers. In a **deduced** context, `T&&` is not an rvalue reference —
it is a **forwarding reference**, and it binds to anything:

```cpp run title="One parameter, both value categories" std=c++20
#include <iostream>
#include <string>
#include <type_traits>

template <class T>
void inspect(T&& value) {
    std::cout << "  T is "
              << (std::is_lvalue_reference_v<T> ? "an lvalue reference" : "not a reference")
              << ", parameter binds to "
              << (std::is_lvalue_reference_v<T> ? "an lvalue" : "an rvalue") << '\n';
    (void)value;
}

int main() {
    std::string named = "hello";
    const std::string constant = "world";

    std::cout << "passing an lvalue:\n";        inspect(named);
    std::cout << "passing a const lvalue:\n";   inspect(constant);
    std::cout << "passing an rvalue:\n";        inspect(std::string{"temp"});
}
```

The mechanism is **reference collapsing**. When `T` is deduced as `std::string&`
(for an lvalue), the parameter `T&&` becomes `std::string& &&`, which collapses
to `std::string&`. When `T` is deduced as `std::string` (for an rvalue), it stays
`std::string&&`. One declaration, both categories.

:::pitfall
`T&&` is only a forwarding reference when `T` is being **deduced right there**.
These are *not* forwarding references, and each is a plain rvalue reference:

```cpp
void f(std::string&& s);              // concrete type, not deduced
template <class T> void g(std::vector<T>&& v);   // T is deduced, but the parameter is vector<T>&&
template <class T> struct Box { void h(T&& value); };  // T fixed by the class, not deduced by h
```

The last one catches people. `Box<int>::h` takes `int&&` and will not accept an
lvalue.
:::

## std::forward

A forwarding reference preserves the category on the way *in*. Passing it on
loses that, because a named parameter is an lvalue — however it was initialised:

```cpp run title="Why a named rvalue reference is an lvalue" std=c++20
#include <iostream>
#include <string>
#include <utility>

void consume(const std::string&) { std::cout << "  copy overload\n"; }
void consume(std::string&&)      { std::cout << "  move overload\n"; }

template <class T>
void naive(T&& value) {
    consume(value);                     // `value` is a name: always an lvalue
}

template <class T>
void forwarding(T&& value) {
    consume(std::forward<T>(value));    // restores the original category
}

int main() {
    std::string named = "x";

    std::cout << "naive, lvalue:      "; naive(named);
    std::cout << "naive, rvalue:      "; naive(std::string{"t"});
    std::cout << "forwarding, lvalue: "; forwarding(named);
    std::cout << "forwarding, rvalue: "; forwarding(std::string{"t"});
}
```

`naive` calls the copy overload every time, even when handed a temporary — the
move is silently lost. `std::forward<T>` casts back to the original category:
an lvalue reference stays an lvalue, an rvalue becomes an rvalue again.

**The rule:** `std::forward<T>(x)` on a forwarding reference, `std::move(x)` on a
concrete rvalue reference. `std::forward` without the template argument does not
compile, which is a useful guardrail.

## A perfectly forwarding wrapper

Put it together and you get the shape every factory and every `emplace` uses:

```cpp run title="Forwarding a whole argument pack" std=c++20
#include <iostream>
#include <memory>
#include <string>
#include <utility>

struct Widget {
    std::string name;
    int size;

    Widget(std::string n, int s) : name(std::move(n)), size(s) {
        std::cout << "  constructed " << name << " (" << size << ")\n";
    }
};

// Forwards any number of arguments, preserving each one's value category.
template <class T, class... Args>
std::unique_ptr<T> make(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

int main() {
    std::string name = "alpha";

    auto a = make<Widget>(name, 1);                    // name copied
    auto b = make<Widget>(std::string{"beta"}, 2);     // temporary moved
    auto c = make<Widget>(std::move(name), 3);         // name moved

    std::cout << "name after being moved from: \"" << name << "\"\n";
    std::cout << a->name << ' ' << b->name << ' ' << c->name << '\n';
}
```

`Args&&...` is a pack of forwarding references and
`std::forward<Args>(args)...` expands to one `std::forward` per argument.
Chapter 5.6 covers packs; this is `std::make_unique`, essentially in full.

## Constraining a forwarding reference

A forwarding reference binds to *everything*, which makes it greedy — it will
beat your copy constructor for a non-const lvalue. Constrain it:

```cpp run title="Keeping a greedy template out of the way" std=c++20
#include <concepts>
#include <iostream>
#include <string>
#include <utility>

class Name {
public:
    // Without the constraint, this beats the copy constructor for a
    // non-const Name lvalue, because that needs no qualification conversion.
    template <class T>
        requires (!std::same_as<std::remove_cvref_t<T>, Name>)
    explicit Name(T&& value) : text_(std::forward<T>(value)) {
        std::cout << "  template constructor\n";
    }

    Name(const Name& other) : text_(other.text_) { std::cout << "  copy constructor\n"; }

    const std::string& text() const { return text_; }

private:
    std::string text_;
};

int main() {
    Name a{std::string{"alpha"}};
    Name b{a};                            // must use the copy constructor
    std::cout << b.text() << '\n';
}
```

`std::remove_cvref_t<T>` strips references and `const` so the check sees the
underlying type. Without the constraint, `Name b{a}` calls the *template* with
`T = Name&`, tries to initialise a `std::string` from a `Name`, and fails with
an error deep inside the constructor.

## Check yourself

:::quiz
{
  "question": "In `template <class T> void f(T&& x)`, what is `T&&`?",
  "options": [
    { "text": "An rvalue reference — it only binds to temporaries", "why": "That is what T&& means when T is a concrete type. In a deduced context the collapsing rules make it bind to both categories." },
    { "text": "A forwarding reference: T is deduced as an lvalue reference for lvalues, and reference collapsing makes the parameter bind to either category", "correct": true, "why": "For an lvalue, T deduces to std::string& and T&& collapses to std::string&. For an rvalue, T is std::string and the parameter stays std::string&&. One declaration covers both." },
    { "text": "A universal reference that also accepts arrays and functions specially", "why": "'Universal reference' is the older name for the same thing, but there is no special array or function handling implied." },
    { "text": "A const reference, because deduction adds const", "why": "Deduction adds nothing. Constness comes from the argument and is preserved through T." }
  ]
}
:::

:::quiz
{
  "question": "`template <class T> void wrap(T&& x) { use(x); }` — what is wrong?",
  "options": [
    { "text": "Nothing; x keeps its original value category", "why": "It does not. Value category belongs to expressions, and the expression `x` is a name — which is an lvalue whatever the parameter's type is." },
    { "text": "`x` is a named parameter, so it is an lvalue — the rvalue case silently calls the copy overload instead of the move", "correct": true, "why": "This is the whole reason std::forward exists. The category is preserved on the way in and lost the moment you use the name, so it must be cast back with std::forward<T>(x)." },
    { "text": "It should be `std::move(x)`", "why": "That would force a move even when the caller passed an lvalue it still wants — turning a silent copy into a silent steal, which is worse." },
    { "text": "T&& cannot bind to an lvalue, so the call fails", "why": "It binds to both categories, which is exactly what makes it a forwarding reference." }
  ]
}
:::

## Practice

:::exercise forwarding-wrapper

:::exercise decltype-auto

:::recap
- By-value template deduction and plain `auto` **drop references and `const`**.
  `auto x = c.front();` copies; write `auto&` or `const auto&` to bind.
- `decltype(expr)` keeps references and `const`; `decltype(auto)` deduces that
  way, which is what a forwarding return type needs.
- `T&&` in a **deduced** context is a forwarding reference and binds to both
  categories, by reference collapsing. It is not one when the type is concrete,
  when the parameter is `vector<T>&&`, or when `T` belongs to the enclosing
  class.
- A named parameter is an **lvalue** regardless of its type, so passing it on
  loses the category. Use `std::forward<T>(x)` for a forwarding reference and
  `std::move(x)` for a concrete rvalue reference.
- `Args&&...` plus `std::forward<Args>(args)...` is the shape of every factory
  and `emplace`.
- A forwarding reference is greedy and will beat your copy constructor;
  constrain it with `!std::same_as<std::remove_cvref_t<T>, Class>`.
:::
