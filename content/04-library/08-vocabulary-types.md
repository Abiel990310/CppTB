---
title: "optional, variant, and expected"
navTitle: "optional, variant, expected"
summary: >-
  Types that make absence and alternatives explicit.
objectives:
  - Return an optional instead of a sentinel value
  - Use variant with a visitor
  - Explain when expected is better than an exception
status: complete
standard: c++20
requires: [associative-containers, algorithms]
---

Three types that exist to make the type system say what comments used to.
`std::optional<T>` is a `T` that might not be there. `std::variant<A, B>` is
exactly one of several types. `std::expected<T, E>` is a `T` or an explanation
of why not.

They are called *vocabulary types* because their value is in being shared: when
a signature returns `std::optional<int>`, every C++ programmer knows what that
means without reading your documentation.

## optional: absence without a sentinel

The alternative is picking a value to mean "nothing" — `-1`, `0`, `nullptr`,
an empty string. That works until the sentinel is a legitimate result.

```cpp run title="A sentinel that collides with real data" std=c++20
#include <iostream>
#include <map>
#include <optional>
#include <string>

const std::map<std::string, int> temperatures{
    {"oslo", -5}, {"cairo", 35}, {"quito", 0}};

// Sentinel version: -1 means "not found"... and also means -1 degrees.
int lookup_sentinel(const std::string& city) {
    auto it = temperatures.find(city);
    return it == temperatures.end() ? -1 : it->second;
}

std::optional<int> lookup(const std::string& city) {
    auto it = temperatures.find(city);
    if (it == temperatures.end()) return std::nullopt;
    return it->second;
}

int main() {
    std::cout << "sentinel, oslo:    " << lookup_sentinel("oslo") << '\n';
    std::cout << "sentinel, atlantis:" << lookup_sentinel("atlantis") << "  <- same answer\n";

    std::cout << std::boolalpha;
    std::cout << "optional, oslo:     " << lookup("oslo").has_value()
              << " value " << lookup("oslo").value() << '\n';
    std::cout << "optional, atlantis: " << lookup("atlantis").has_value() << '\n';
}
```

Oslo at −5 degrees and a city that does not exist give the same answer from the
sentinel version. No amount of documentation fixes that; only the type can.

### Using one

```cpp run title="Reading an optional safely" std=c++20
#include <iostream>
#include <optional>
#include <string>

std::optional<int> parse_port(const std::string& text) {
    try {
        const int value = std::stoi(text);
        if (value < 1 || value > 65535) return std::nullopt;
        return value;
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

int main() {
    // 1. Test, then use — the if-with-initialiser keeps the scope tight.
    if (auto port = parse_port("8080")) {
        std::cout << "parsed " << *port << '\n';
    }

    // 2. A default for the absent case.
    std::cout << "bad input -> " << parse_port("not a number").value_or(80) << '\n';
    std::cout << "out of range -> " << parse_port("70000").value_or(80) << '\n';

    // 3. value() throws rather than being undefined.
    try {
        std::cout << parse_port("x").value() << '\n';
    } catch (const std::bad_optional_access& e) {
        std::cout << "value() threw: " << e.what() << '\n';
    }
}
```

`*opt` and `opt->` are the cheap accessors and are **undefined** when the
optional is empty — exactly like dereferencing a null pointer. `value()` checks
and throws. Use `*` after testing, `value()` when you want the check, and
`value_or` when a default will do.

```cpp run title="Dereferencing an empty optional" std=c++20
#include <iostream>
#include <optional>

int main() {
    std::optional<int> empty;
    std::cout << "reading it anyway: " << *empty << '\n';
}
```

Look at what that printed, and at what nothing said about it. No warning, no
sanitizer report — just `0`, which is a perfectly plausible port number, age, or
count. The optional's storage was never initialised, so `*empty` read whatever
was there, and on this run that happened to be zero.

This is the worst shape undefined behaviour takes: it looks like it worked. The
sanitizers cannot help, because nothing illegal happened at the level they watch
— every byte read was inside a live object. The only thing standing between you
and a silent wrong answer is checking before you dereference, which is why
`value()` and `value_or` exist.

:::pitfall
`std::optional<bool>` and `std::optional<T*>` are traps for the unwary, because
the optional itself converts to `bool`. `if (opt)` asks whether the optional
holds a value, not what that value is — so an optional holding `false` takes the
`if`. Write `if (opt.has_value())` when the contained type is itself testable.
:::

```cpp run title="The optional<bool> trap" std=c++20
#include <iostream>
#include <optional>

int main() {
    std::optional<bool> holds_false = false;
    std::optional<bool> nothing;

    std::cout << std::boolalpha;
    std::cout << "if (holds_false):        " << static_cast<bool>(holds_false) << '\n';
    std::cout << "holds_false.value():     " << holds_false.value() << '\n';
    std::cout << "if (nothing):            " << static_cast<bool>(nothing) << '\n';
    std::cout << "\nthe first two disagree, which is the whole trap\n";
}
```

## variant: one of several types

A `std::variant<A, B, C>` holds exactly one of its alternatives, and knows which.
It is the type-safe replacement for a `union` plus a tag you maintained by hand.

```cpp run title="Holding one of several types" std=c++20
#include <iostream>
#include <string>
#include <variant>

int main() {
    std::variant<int, double, std::string> value = 42;

    std::cout << "index " << value.index() << '\n';
    std::cout << "holds int? " << std::boolalpha
              << std::holds_alternative<int>(value) << '\n';
    std::cout << "as int: " << std::get<int>(value) << '\n';

    value = std::string{"now a string"};
    std::cout << "index " << value.index() << ", value " << std::get<std::string>(value) << '\n';

    // Asking for the wrong alternative throws rather than reinterpreting bytes.
    try {
        std::cout << std::get<double>(value) << '\n';
    } catch (const std::bad_variant_access& e) {
        std::cout << "get<double> threw: " << e.what() << '\n';
    }
}
```

That last part is the difference from a `union`. A union will happily reinterpret
a `std::string`'s bytes as a `double` and hand you nonsense; a variant checks.

### Visiting

Testing alternatives one by one works but scales badly and silently rots when
you add a type. `std::visit` calls a function with whichever alternative is
active, and — with a generic lambda or an overload set — fails to compile if you
have not handled one:

```cpp run title="std::visit, two ways" std=c++20
#include <iostream>
#include <string>
#include <variant>

using Value = std::variant<int, double, std::string>;

// The overloaded idiom: a struct inheriting several lambdas' call operators.
template <class... Ts>
struct overloaded : Ts... { using Ts::operator()...; };

std::string describe(const Value& v) {
    return std::visit(overloaded{
        [](int i)                 { return "int " + std::to_string(i); },
        [](double d)              { return "double " + std::to_string(d); },
        [](const std::string& s)  { return "string \"" + s + "\""; },
    }, v);
}

int main() {
    for (const Value& v : {Value{7}, Value{2.5}, Value{std::string{"hi"}}}) {
        std::cout << describe(v) << '\n';
    }

    // A generic lambda handles every alternative uniformly.
    Value v = 3.5;
    std::visit([](const auto& x) { std::cout << "generic: " << x << '\n'; }, v);
}
```

`overloaded` is three lines of template machinery you copy once and reuse
forever; Chapter 5.6 explains the pack expansion. What matters here is the
property it buys: **add a fourth alternative to `Value` and `describe` stops
compiling** until you handle it. A chain of `if (holds_alternative<...>)` would
have compiled and silently fallen through.

Variants are how you model a value that is genuinely one of several shapes — a
JSON value, a parsed token, a state machine's current state — without
inheritance and without heap allocation.

## expected: a value, or a reason

`std::optional` says something is missing. It does not say *why*, and for
anything a user might need to act on, why is the important part.

```cpp run title="Failure with an explanation" std=c++23
#include <expected>
#include <iostream>
#include <string>

enum class ParseError { empty, not_a_number, out_of_range };

std::string to_string(ParseError e) {
    switch (e) {
        case ParseError::empty:        return "input was empty";
        case ParseError::not_a_number: return "not a number";
        case ParseError::out_of_range: return "outside 1-65535";
    }
    return "unknown";
}

std::expected<int, ParseError> parse_port(const std::string& text) {
    if (text.empty()) return std::unexpected{ParseError::empty};

    try {
        const int value = std::stoi(text);
        if (value < 1 || value > 65535) return std::unexpected{ParseError::out_of_range};
        return value;
    } catch (const std::exception&) {
        return std::unexpected{ParseError::not_a_number};
    }
}

int main() {
    for (const std::string& input : {"8080", "", "abc", "70000"}) {
        auto result = parse_port(input);
        if (result) {
            std::cout << "\"" << input << "\" -> port " << *result << '\n';
        } else {
            std::cout << "\"" << input << "\" -> failed: " << to_string(result.error()) << '\n';
        }
    }
}
```

:::note
`std::expected` is **C++23**, which is why that sample declares `std=c++23`. On
C++20 the equivalents are `tl::expected`, `Boost.Outcome`, or a
`std::variant<T, Error>` with a visitor. The shape of the idea is the same.
:::

### Which to use

| Situation | Type |
|---|---|
| A value may be absent, and why is obvious or irrelevant | `std::optional<T>` |
| A value may be absent, and the caller needs the reason | `std::expected<T, E>` |
| Exactly one of several unrelated types | `std::variant<A, B, C>` |
| Failure is exceptional and most callers cannot handle it | throw |

The line between `expected` and an exception is about **who handles it and how
often**. A parse failure on user input is expected — it happens constantly, the
caller has a plan, and forcing a `try`/`catch` around every call is noise.
Running out of memory is not: almost no caller can do anything useful, so
unwinding to someone who can is right.

The practical difference is that `expected` puts the failure in the signature.
A caller cannot ignore it without writing something that looks wrong, whereas an
exception is invisible at the call site.

```cpp run title="Chaining without a pile of ifs" std=c++23
#include <expected>
#include <iostream>
#include <string>

std::expected<int, std::string> to_int(const std::string& s) {
    try { return std::stoi(s); }
    catch (...) { return std::unexpected{"not a number: " + s}; }
}

std::expected<int, std::string> halve(int n) {
    if (n % 2 != 0) return std::unexpected{std::to_string(n) + " is odd"};
    return n / 2;
}

int main() {
    for (const std::string& input : {"8", "7", "x"}) {
        auto result = to_int(input)
                          .and_then(halve)
                          .transform([](int n) { return n * 10; });

        if (result) std::cout << input << " -> " << *result << '\n';
        else        std::cout << input << " -> " << result.error() << '\n';
    }
}
```

`and_then` runs the next step only on success and passes the error through;
`transform` maps the value and leaves errors alone. The failure path is written
once, at the end, rather than after every call. `std::optional` has the same two
operations in C++23.

## Check yourself

:::quiz
{
  "question": "`std::optional<bool> flag = false; if (flag) { … }` — does the branch run?",
  "options": [
    { "text": "No, because the contained value is false", "why": "The conversion to bool asks about the optional, not its contents. This is exactly the confusion the trap depends on." },
    { "text": "Yes, because the optional holds a value — the conversion tests presence, not the contained bool", "correct": true, "why": "Right, and it is why `has_value()` should be spelled out whenever the contained type is itself testable. `if (flag)` and `flag.value()` disagree here." },
    { "text": "It does not compile — optional<bool> is ill-formed", "why": "It is perfectly legal, which is what makes it dangerous. The compiler has no reason to object." },
    { "text": "Only if the optional was constructed with std::make_optional", "why": "How it was constructed makes no difference; it holds a value either way." }
  ]
}
:::

:::quiz
{
  "question": "When is `std::expected<T, E>` a better choice than throwing?",
  "options": [
    { "text": "Always — exceptions are slow", "why": "Exceptions cost nothing when nothing is thrown; the cost is on the throwing path. Speed is rarely the deciding factor." },
    { "text": "When failure is routine and the immediate caller has a plan for it", "correct": true, "why": "Parsing user input is the canonical case: it fails constantly, the caller knows what to do, and expected puts that in the signature where it cannot be ignored." },
    { "text": "When the error type is an enum rather than a class", "why": "Either works as `E`. What matters is who handles the failure and how often, not how the error is represented." },
    { "text": "When the function is called from a destructor", "why": "A real consideration — throwing from a destructor calls terminate — but a narrow special case, not the general rule." }
  ]
}
:::

## Practice

:::exercise optional-parse

:::exercise variant-shapes

:::recap
- `std::optional<T>` replaces sentinel values, which break as soon as the
  sentinel is a legitimate result.
- `*opt` is undefined when empty; `value()` throws; `value_or` supplies a
  default. Prefer `has_value()` over `if (opt)` when the contained type is
  itself testable — `optional<bool>` is the trap.
- `std::variant<A, B, C>` holds exactly one alternative and checks which. Visit
  it with the `overloaded` idiom, so adding an alternative breaks compilation
  instead of silently falling through.
- `std::expected<T, E>` (C++23) carries the reason for failure and puts it in
  the signature, where an exception is invisible.
- Use `expected` when failure is routine and the caller has a plan; throw when
  it is exceptional and most callers cannot help.
- `and_then` and `transform` chain steps so the failure path is written once.
:::
