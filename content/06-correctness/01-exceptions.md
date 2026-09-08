---
title: "Exceptions"
navTitle: "Exceptions"
summary: >-
  Reporting failure across call boundaries, and what unwinding costs.
objectives:
  - Throw and catch by the right types
  - Explain what the strong exception guarantee requires
  - Write a function that is exception-safe by construction
status: complete
standard: c++20
requires: [raii, undefined-behaviour]
---

A function that cannot do what it was asked has to tell someone. When the caller
can handle it, returning a value is usually right — Chapter 6.2 covers that.
When the caller cannot, and the code that *can* handle it is several frames up,
that is what exceptions are for.

## Throwing and catching

```cpp run title="Failure that travels" std=c++20
#include <iostream>
#include <stdexcept>
#include <string>

int parse_percentage(const std::string& text) {
    const int value = std::stoi(text);              // throws on bad input
    if (value < 0 || value > 100) {
        throw std::out_of_range("percentage must be 0-100, got " + std::to_string(value));
    }
    return value;
}

int main() {
    for (const std::string& input : {"50", "150", "abc"}) {
        try {
            std::cout << input << " -> " << parse_percentage(input) << '\n';
        } catch (const std::out_of_range& e) {
            std::cout << input << " -> out of range: " << e.what() << '\n';
        } catch (const std::exception& e) {
            std::cout << input << " -> " << e.what() << '\n';
        }
    }
}
```

Three rules that cover most of what you need:

- **Throw by value, catch by `const` reference.** Catching by value slices a
  derived exception to its base (Chapter 3.7), losing the type and the message.
- **Order handlers most-derived first.** They are tried in order, so a
  `catch (const std::exception&)` placed first would swallow everything below it.
- **Derive from `std::exception`.** The standard hierarchy gives every caller a
  `what()` and one type they can catch to mean "something went wrong".

The standard types worth knowing: `std::runtime_error` for failures detectable
only at run time, `std::logic_error` for programming mistakes,
`std::out_of_range` and `std::invalid_argument` for their obvious cases, and
`std::bad_alloc` when allocation fails.

## What unwinding does

When an exception is thrown, control leaves every frame between the throw and
the handler, destroying every automatic object on the way. That is **stack
unwinding**, and it is what makes RAII and exceptions work together:

```cpp run title="Destructors run on the way out" std=c++20
#include <iostream>
#include <stdexcept>
#include <string>

struct Noisy {
    std::string name;
    explicit Noisy(std::string n) : name(std::move(n)) { std::cout << "  + " << name << '\n'; }
    ~Noisy() { std::cout << "  - " << name << '\n'; }
};

void inner() {
    Noisy n{"inner"};
    throw std::runtime_error("failed deep down");
}

void middle() {
    Noisy n{"middle"};
    inner();
    std::cout << "  never reached\n";
}

int main() {
    Noisy n{"outer"};
    try {
        middle();
    } catch (const std::exception& e) {
        std::cout << "caught: " << e.what() << '\n';
    }
}
```

`inner` and `middle` were destroyed in reverse order before the handler ran, and
nothing leaked. This is the payoff of Chapter 3.2: put every resource in an
object, and the failure path takes care of itself.

## Exception safety guarantees

When a function throws, what state is the program left in? There are four
answers, and it is worth being able to name which one you are providing.

| Guarantee | Meaning |
|---|---|
| **Nothrow** | The function never throws. Destructors, swaps, and moves should be here. |
| **Strong** | If it throws, nothing changed. The operation either happens completely or not at all. |
| **Basic** | If it throws, everything is still valid and destructible, but values may have changed. |
| **None** | Anything may have happened. Avoid. |

The basic guarantee is the minimum; anything less means the program cannot
safely continue. The strong guarantee is what you want for operations a caller
might retry.

```cpp run title="Basic versus strong" std=c++20
#include <iostream>
#include <stdexcept>
#include <vector>

struct Account {
    int balance = 100;
    std::vector<std::string> history;

    // Basic: if the history push throws, the balance has already changed.
    void withdraw_basic(int amount) {
        if (amount > balance) throw std::out_of_range("insufficient funds");
        balance -= amount;
        history.push_back("withdrew");        // may throw (allocation)
    }

    // Strong: nothing is modified until every step that can throw has succeeded.
    void withdraw_strong(int amount) {
        if (amount > balance) throw std::out_of_range("insufficient funds");

        auto updated = history;               // may throw — but changes nothing
        updated.push_back("withdrew");

        balance -= amount;                    // now commit, with no throwing left
        history = std::move(updated);
    }
};

int main() {
    Account a;
    try { a.withdraw_strong(500); }
    catch (const std::exception& e) {
        std::cout << "rejected: " << e.what() << '\n';
        std::cout << "balance unchanged: " << a.balance << '\n';
    }

    a.withdraw_strong(30);
    std::cout << "after a successful withdrawal: " << a.balance
              << ", history has " << a.history.size() << " entry\n";
}
```

The pattern for the strong guarantee is always the same shape: **do all the work
that can fail into temporaries, then commit with operations that cannot throw.**
Chapter 3.3's copy-and-swap is this idea applied to assignment.

## Destructors must not throw

If a destructor throws while an exception is already unwinding the stack, the
program calls `std::terminate` — there is no way to handle two exceptions at
once.

```cpp run title="Destructors are implicitly noexcept" std=c++20
#include <iostream>
#include <utility>

struct Normal {
    ~Normal() {}                        // implicitly noexcept
};

struct Risky {
    ~Risky() noexcept(false) {}         // opting out, deliberately
};

int main() {
    std::cout << std::boolalpha;
    std::cout << "Normal destructor is noexcept: "
              << noexcept(std::declval<Normal&>().~Normal()) << '\n';
    std::cout << "Risky  destructor is noexcept: "
              << noexcept(std::declval<Risky&>().~Risky())
              << "   <- opted out with noexcept(false)\n";
}
```

Since C++11 destructors are implicitly `noexcept`, so a throw from one calls
`terminate` immediately rather than propagating. If your destructor does
something that can fail — closing a file, flushing a buffer — **catch and
handle it inside**, and offer a separate `close()` for callers who need to know.

:::warning
The same applies to move operations. A throwing move breaks `std::vector`'s
reallocation, which is why Chapter 3.4 insisted on `noexcept`: without it,
vector copies your elements instead of moving them.
:::

## noexcept

`noexcept` is a promise that a function will not throw. Break it and the program
terminates — there is no catching a `noexcept` violation.

```cpp run title="What noexcept is for" std=c++20
#include <iostream>
#include <utility>
#include <vector>

struct Movable {
    std::vector<int> data;
    Movable() : data(100) {}
    Movable(const Movable& o) : data(o.data) { std::cout << "  copy\n"; }
    Movable(Movable&& o) noexcept : data(std::move(o.data)) { std::cout << "  move\n"; }
};

int main() {
    std::vector<Movable> v;
    v.reserve(1);
    v.emplace_back();

    std::cout << "growing the vector:\n";
    v.emplace_back();          // reallocation: moves, because the move is noexcept
}
```

Mark as `noexcept`: destructors (implicit), move constructors and move
assignment, `swap`, and simple accessors. Do **not** mark something `noexcept`
just because it does not throw today — if it might later, you have promised
something you will have to break.

## When not to use exceptions

Exceptions cost nothing when nothing is thrown — the modern implementation puts
all the cost on the throwing path, via tables consulted only during unwinding.
Throwing, however, is genuinely slow: hundreds of nanoseconds to microseconds,
because unwinding walks the stack and consults those tables.

That gives a clear rule: **exceptions are for the exceptional.** If a failure is
routine — a parse failing on user input, a lookup missing — throwing on every
call turns a fast path into a slow one, and forces callers to write `try` around
ordinary control flow. Return `std::optional` or `std::expected` instead;
Chapter 6.2 covers that trade properly.

```cpp run title="What throwing costs" std=c++20
#include <chrono>
#include <iostream>
#include <optional>
#include <stdexcept>

int by_exception(int x) {
    if (x < 0) throw std::runtime_error("negative");
    return x * 2;
}

std::optional<int> by_optional(int x) {
    if (x < 0) return std::nullopt;
    return x * 2;
}

int main() {
    constexpr int rounds = 100'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    long long a = 0;
    for (int i = 0; i < rounds; ++i) {
        try { a += by_exception(-1); } catch (const std::exception&) { ++a; }
    }
    auto mid = clock::now();

    long long b = 0;
    for (int i = 0; i < rounds; ++i) {
        b += by_optional(-1).value_or(1);
    }
    auto finish = clock::now();

    std::cout << "throwing:  " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "optional:  " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(sums " << a << ", " << b << ")\n";
}
```

Note what is *not* being measured: the success path. Run the same comparison with
positive inputs and the difference disappears, because a `try` block that does
not throw costs nothing.

## Check yourself

:::quiz
{
  "question": "Why catch by `const std::exception&` rather than by value?",
  "options": [
    { "text": "Catching by value is a compile error for polymorphic types", "why": "It compiles. That is the problem — it silently does the wrong thing." },
    { "text": "Catching by value slices the exception to the handler's type, losing the derived type and its message", "correct": true, "why": "Exactly the slicing from Chapter 3.7. A std::out_of_range caught by value as std::exception becomes a plain std::exception, and what() no longer reports what happened." },
    { "text": "Exceptions cannot be copied", "why": "They must be copyable to be thrown at all. Copying is possible; it is just lossy for derived types." },
    { "text": "By-reference catching is faster", "why": "It avoids a copy, which is a real if minor benefit — but correctness, not speed, is the reason." }
  ]
}
:::

:::quiz
{
  "question": "What does the strong exception guarantee require?",
  "options": [
    { "text": "That the function never throws", "why": "That is the nothrow guarantee, which is stronger still and is what destructors and moves must provide." },
    { "text": "That if it throws, the program state is exactly as it was before the call", "correct": true, "why": "All-or-nothing. The usual technique is to do everything that can fail into temporaries first, then commit with operations that cannot throw — copy-and-swap being the canonical example." },
    { "text": "That the object is left valid and destructible", "why": "That is the basic guarantee — the minimum any function should offer. Strong additionally requires that nothing observable changed." },
    { "text": "That every exception is caught before returning", "why": "Swallowing exceptions is unrelated, and usually a bug. The guarantee is about state, not about who handles the failure." }
  ]
}
:::

## Practice

:::exercise strong-guarantee

:::exercise exception-safe-swap

:::recap
- Throw by value, catch by `const` reference, order handlers most-derived first,
  and derive from `std::exception`.
- Unwinding destroys every automatic object between the throw and the handler,
  which is what makes RAII the mechanism that keeps failure paths correct.
- Four guarantees: nothrow, strong, basic, none. Basic is the minimum; strong
  means all-or-nothing and is built by doing fallible work in temporaries and
  committing with operations that cannot throw.
- Destructors are implicitly `noexcept`; a throw from one during unwinding calls
  `terminate`. Handle failure inside, and offer a separate `close()`.
- Mark moves, swaps, and destructors `noexcept` — `std::vector` checks.
- Exceptions cost nothing when not thrown and a great deal when thrown. Use them
  for the exceptional, not for routine failure.
:::
