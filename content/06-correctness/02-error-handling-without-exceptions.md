---
title: "Error handling without exceptions"
navTitle: "Error handling without exceptions"
summary: >-
  Return-based error handling, and when it fits better.
objectives:
  - Design an API around expected or an error code
  - Explain the trade-offs against exceptions
  - Handle errors without silently discarding them
status: complete
standard: c++20
requires: [exceptions, vocabulary-types]
---

The previous chapter ended with a rule: exceptions are for the exceptional. This
one is about the other case — failure that is routine, that the immediate caller
expects, and that should be visible in the signature.

## The problem with an invisible failure

An exception does not appear in a function's type. You cannot tell from
`int parse(const std::string&)` whether it throws, what it throws, or whether
you should be prepared:

```cpp run title="Two signatures, two amounts of information" std=c++23
#include <expected>
#include <iostream>
#include <string>

// What can go wrong here? The signature does not say.
int parse_throwing(const std::string& text) {
    return std::stoi(text);
}

enum class ParseError { empty, not_a_number };

// Every caller can see that this can fail, and how.
std::expected<int, ParseError> parse_returning(const std::string& text) {
    if (text.empty()) return std::unexpected{ParseError::empty};
    try { return std::stoi(text); }
    catch (...) { return std::unexpected{ParseError::not_a_number}; }
}

int main() {
    // Ignoring the failure is easy to do by accident:
    std::cout << "throwing version, valid input: " << parse_throwing("42") << '\n';

    // Here it is awkward to ignore, which is the point.
    if (auto result = parse_returning("abc")) {
        std::cout << *result << '\n';
    } else {
        std::cout << "returning version: rejected \"abc\"\n";
    }
}
```

That visibility is the central trade. An exception is invisible at the call site
and impossible to forget about *once thrown*; a returned error is visible in the
signature and easy to forget about *at the call site* unless the language helps.

:::note
`std::expected` is C++23. On C++20 the equivalents are `tl::expected`,
`Boost.Outcome`, or a `std::variant<T, Error>` with a visitor. Samples here that
use it declare `std=c++23`.
:::

## Making it hard to ignore

`[[nodiscard]]` is the language's help. A discarded return value becomes a
warning:

```cpp run title="[[nodiscard]] on a result type" std=c++23
#include <expected>
#include <iostream>
#include <string>

enum class WriteError { disk_full, permission_denied };

// Marking the *type* nodiscard covers every function that returns it.
struct [[nodiscard]] Status {
    bool ok = true;
    WriteError error{};
    explicit operator bool() const { return ok; }
};

Status write_config(const std::string& contents) {
    if (contents.size() > 100) return Status{false, WriteError::disk_full};
    return Status{};
}

int main() {
    write_config("small");            // warning: ignoring return value

    if (auto status = write_config(std::string(200, 'x')); !status) {
        std::cout << "write failed, and we noticed\n";
    }
}
```

Read the compiler warning on that first call. Marking the *type* `[[nodiscard]]`
is stronger than marking each function, because it covers every function that
returns it, including ones written later.

## Error codes, and why they leak

The oldest pattern is an integer return with the real result through a pointer:

```cpp run title="The C shape, and its problem" std=c++20
#include <iostream>
#include <string>

// 0 on success, non-zero on failure. The value comes back through a parameter.
int parse_c_style(const std::string& text, int* out) {
    if (text.empty()) return 1;
    try { *out = std::stoi(text); }
    catch (...) { return 2; }
    return 0;
}

int main() {
    int value = 0;

    if (parse_c_style("42", &value) == 0) {
        std::cout << "parsed " << value << '\n';
    }

    // The failure mode: nothing forces the check, and `value` keeps its old
    // contents when the call fails.
    parse_c_style("abc", &value);
    std::cout << "after a failed call, value is still " << value
              << "  <- stale, and nothing warned us\n";
}
```

Three problems. Nothing forces the check. The result travels through an out
parameter, so the variable must exist before the call and may hold a stale value
after it. And the return type carries no information about what the codes mean.

`std::expected` fixes all three: the value and the error occupy the same slot, so
there is no stale variable, and reading the value without checking is an error
rather than a silent read.

## expected, in practice

```cpp run title="A small pipeline" std=c++23
#include <expected>
#include <iostream>
#include <string>

enum class Error { empty, not_a_number, out_of_range, odd };

std::string describe(Error e) {
    switch (e) {
        case Error::empty:        return "empty input";
        case Error::not_a_number: return "not a number";
        case Error::out_of_range: return "out of range";
        case Error::odd:          return "not an even number";
    }
    return "unknown";
}

std::expected<int, Error> to_int(const std::string& text) {
    if (text.empty()) return std::unexpected{Error::empty};
    try {
        const long value = std::stol(text);
        if (value < -1000 || value > 1000) return std::unexpected{Error::out_of_range};
        return static_cast<int>(value);
    } catch (...) {
        return std::unexpected{Error::not_a_number};
    }
}

std::expected<int, Error> require_even(int value) {
    if (value % 2 != 0) return std::unexpected{Error::odd};
    return value;
}

int main() {
    for (const std::string& input : {"8", "7", "abc", "", "99999"}) {
        auto result = to_int(input)
                          .and_then(require_even)
                          .transform([](int n) { return n / 2; });

        std::cout << "\"" << input << "\" -> ";
        if (result) std::cout << "half is " << *result << '\n';
        else        std::cout << describe(result.error()) << '\n';
    }
}
```

`and_then` runs the next step only on success and passes any error through
untouched; `transform` maps a successful value and leaves errors alone. The
failure path is written once, at the end, instead of after every call — which is
the ergonomic complaint about error returns, answered.

## Choosing between the two

| Use a return | Use an exception |
|---|---|
| Failure is routine and expected | Failure is genuinely exceptional |
| The immediate caller can handle it | Only a distant caller can handle it |
| The failure path is as common as the success path | Failure is rare enough that its cost does not matter |
| You want it visible in the signature | Threading a result through many layers would obscure the code |
| Constructors are not involved | A constructor must fail (it has no return value) |

Two hard constraints worth naming:

**A constructor cannot return an error.** If construction can fail, you either
throw, or you make the constructor private and provide a static factory
returning `std::expected`.

```cpp run title="A factory for a fallible construction" std=c++23
#include <expected>
#include <iostream>
#include <string>

class Port {
public:
    static std::expected<Port, std::string> create(int number) {
        if (number < 1 || number > 65535) return std::unexpected{"port out of range"};
        return Port{number};
    }
    int number() const { return number_; }

private:
    explicit Port(int number) : number_(number) {}
    int number_;
};

int main() {
    if (auto port = Port::create(8080)) {
        std::cout << "created port " << port->number() << '\n';
    }
    if (auto bad = Port::create(70000); !bad) {
        std::cout << "rejected: " << bad.error() << '\n';
    }
}
```

**Some environments forbid exceptions entirely.** Embedded targets, some game
engines, and codebases built with `-fno-exceptions` have no choice — every
failure must be a return value. It is worth knowing which world your code lives
in before designing its interfaces.

## What not to do

```cpp run title="Three ways to lose an error" std=c++20
#include <iostream>
#include <optional>
#include <string>

std::optional<int> parse(const std::string& text) {
    try { return std::stoi(text); } catch (...) { return std::nullopt; }
}

int main() {
    // 1. Discarding the result entirely.
    parse("abc");

    // 2. value_or hiding a failure as a legitimate value.
    const int port = parse("abc").value_or(0);
    std::cout << "port " << port << "  <- is that a failure, or port zero?\n";

    // 3. Catching and continuing as if nothing happened.
    try {
        (void)std::stoi("abc");
    } catch (...) {
        // silence
    }
    std::cout << "the parse failed and nothing recorded it\n";
}
```

The second is the subtle one. `value_or` is excellent when the default is
genuinely correct — `value_or(80)` for a port that defaults to 80 is fine. It is
wrong when it converts "we do not know" into a value indistinguishable from a
real answer, which is the sentinel problem from Chapter 4.8 reintroduced by
hand.

:::pitfall
`catch (...) { }` with an empty body is almost always a bug. If you genuinely
cannot handle an error here, let it propagate. If you can, do something —
log it, return a failure, use a default *and record that you did*. An empty
handler turns a diagnosable failure into a mystery later.
:::

## Check yourself

:::quiz
{
  "question": "Why mark a result type `[[nodiscard]]` rather than marking each function that returns one?",
  "options": [
    { "text": "Marking functions has no effect; only types can be nodiscard", "why": "Both work. The attribute is valid on functions and on types." },
    { "text": "It covers every function returning that type, including ones written later", "correct": true, "why": "That is the maintenance argument: a new function returning Status is protected automatically, whereas per-function attributes have to be remembered each time." },
    { "text": "It turns the warning into an error", "why": "Neither form does; -Werror is what promotes warnings to errors, independently of where the attribute sits." },
    { "text": "It prevents the value from being copied", "why": "It has nothing to do with copying — only with the value being discarded at a call site." }
  ]
}
:::

:::quiz
{
  "question": "A constructor needs to reject invalid arguments. What are the options?",
  "options": [
    { "text": "Return an error code from the constructor", "why": "Constructors have no return type, so there is nowhere for a code to go. That constraint is what makes this question interesting." },
    { "text": "Throw, or make the constructor private and expose a static factory returning std::expected", "correct": true, "why": "Both are legitimate. The factory keeps failure in the signature and works under -fno-exceptions; throwing is simpler when exceptions are available and the failure really is exceptional." },
    { "text": "Leave the object in a partly-built state and add an is_valid() check", "why": "This is the two-phase construction anti-pattern: every user must remember the check, and until they do the object's invariants do not hold." },
    { "text": "Use a default constructor and an init() method", "why": "Same problem — it creates a window in which the object exists but is not usable, which is exactly what constructors exist to prevent." }
  ]
}
:::

## Practice

:::exercise expected-pipeline

:::exercise nodiscard-status

:::recap
- An exception is invisible in the signature; a returned error is part of the
  type. That visibility is the main reason to prefer returns for routine
  failure.
- Mark result types `[[nodiscard]]` so ignoring them warns — on the type, so
  future functions are covered too.
- C-style error codes leak: nothing forces the check, and the out parameter
  holds a stale value on failure. `std::expected` puts the value and the error
  in one slot.
- `and_then` and `transform` chain fallible steps so the failure path is written
  once.
- A constructor cannot return an error: throw, or use a private constructor with
  a static factory. Never leave a half-built object behind an `is_valid()`.
- `value_or` is right when the default is genuinely correct and wrong when it
  disguises a failure as an answer. `catch (...) {}` with an empty body is
  almost always a bug.
:::
