---
title: "Values, types, and names"
navTitle: "Values, types, and names"
summary: >-
  Why C++ insists on knowing the type of everything, and what that buys you.
objectives:
  - Choose an appropriate built-in type for a quantity
  - Predict the result of integer versus floating-point division
  - Explain what auto deduces and when to avoid it
status: complete
standard: c++20
requires: [hello-machine]
---

Every value in a C++ program has a type, fixed when you compile and never
changing while the program runs. This is unlike Python or JavaScript, where a
name can hold a number now and a string later, and it is the reason C++ programs
can be fast: if the compiler knows a thing is a 32-bit integer, it can emit one
instruction to add it instead of a function call that inspects it first.

The cost is that you have to say what you mean. This chapter is about saying it
well.

## Declaring a variable

```cpp run title="Four declarations"
#include <iostream>

int main() {
    int    apples      = 5;
    double temperature = 21.5;
    bool   is_ready    = true;
    char   grade       = 'A';

    std::cout << apples << ' ' << temperature << ' '
              << is_ready << ' ' << grade << '\n';
}
```

Read each line as *type, then name, then initial value*. The type is not a hint
or an annotation the compiler might ignore; it decides how many bytes the object
occupies, what operations are legal on it, and what the machine instructions
will be.

Notice `is_ready` printed as `1`, not `true`. `std::cout` prints a `bool` as an
integer unless you ask otherwise with `std::boolalpha`. That is a small example
of a large idea: the type controls what happens, even at the point of printing.

:::pitfall
Write `int apples = 5;`, not `int apples;` followed by `apples = 5;` later. A
variable declared without an initialiser holds whatever bytes were already at
that address. Reading it before assigning is undefined behaviour, and the value
you get may look plausible — often zero, in a debug build, which is how the bug
survives to production.
:::

Prove it to yourself. This program is undefined, and what it does about that is
worth watching:

```cpp run title="Do not do this"
#include <iostream>

int main() {
    int uninitialised;                    // no value
    std::cout << uninitialised << '\n';   // reading it is undefined behaviour
}
```

Three things happened. It **compiled** — nothing here is illegal in the sense
the compiler must reject. It **warned**, because `-Wall` includes
`-Wuninitialized` and the compiler could see the mistake from the source alone.
And it **printed a number** that means nothing: whatever bytes happened to be at
that address. Run it again and you may get something different.

:::note
Notice which tool caught this. The warning did, because the read is in the same
function as the declaration. AddressSanitizer, which is on for every sample
here, did *not* — it tracks memory that is out of bounds or already freed, not
memory that was never written. Catching uninitialised reads at run time is
MemorySanitizer's job, and it is Clang-only and needs every library it touches
rebuilt with it, which is why it is far less commonly used. So: initialise at
the point of declaration, and let the warning be your safety net rather than
the sanitizer.
:::

## The built-in types worth knowing

| Type | Typical size | Use it for |
|---|---|---|
| `bool` | 1 byte | true or false |
| `char` | 1 byte | one byte of text |
| `int` | 4 bytes | general-purpose whole numbers |
| `long long` | 8 bytes | whole numbers beyond ±2 billion |
| `std::size_t` | 8 bytes | sizes and indices, never negative |
| `float` | 4 bytes | real numbers where 7 digits is enough |
| `double` | 8 bytes | real numbers, the default choice |

Three rules cover most decisions:

1. **Use `int` for counting things** unless you have a reason not to. It is the
   type the language and the hardware are tuned for.
2. **Use `double`, not `float`,** unless you have measured that you need the
   memory. `float` has about 7 significant digits, which runs out sooner than
   people expect.
3. **Use `std::size_t` for sizes and indices.** It is what the standard library
   uses, and mixing it with `int` produces the comparison warning in the next
   section.

## Integer division truncates

This is the single most common surprise in the language's arithmetic:

```cpp run title="Two divisions that look the same"
#include <iostream>

int main() {
    int    a = 7,   b = 2;
    double x = 7.0, y = 2.0;

    std::cout << "7 / 2     = " << a / b << '\n';
    std::cout << "7.0 / 2.0 = " << x / y << '\n';
    std::cout << "7 / 2.0   = " << a / y << '\n';
    std::cout << "7 % 2     = " << a % b << "   (the remainder)\n";
}
```

When both operands are integers, `/` is integer division: it discards the
fractional part rather than rounding. `7 / 2` is `3`, not `3.5` and not `4`. If
either operand is a floating-point type, the other is converted first and you
get real division.

This bites hardest when computing an average:

```cpp run title="An average that is wrong, and one that is right"
#include <iostream>

int main() {
    int total = 7;
    int count = 2;

    std::cout << "wrong: " << total / count << '\n';
    std::cout << "right: " << static_cast<double>(total) / count << '\n';
}
```

`static_cast<double>(total)` converts before the division, so the division is a
floating-point one. Casting the *result* — `static_cast<double>(total / count)`
— would be too late: the truncation has already happened.

:::warning
Signed integer overflow is undefined behaviour, not wraparound. `int` at its
maximum plus one is not "the minimum"; it is a program the compiler is entitled
to assume never happens, and it will optimise accordingly. Unsigned types *do*
wrap, defined by the standard — which is its own trap, because `0u - 1` is a
very large positive number rather than `-1`.
:::

## Signed, unsigned, and the comparison you should not write

```cpp run title="A loop that never ends"
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{10, 20, 30};

    // v.size() is unsigned. Subtracting 1 from an unsigned 0 does not give -1.
    std::cout << "v.size() - 1 = " << v.size() - 1 << '\n';

    std::vector<int> empty;
    std::cout << "empty.size() - 1 = " << empty.size() - 1 << '\n';
}
```

`empty.size()` is `0` as a `std::size_t`. Subtracting 1 wraps to the largest
representable value — about 18 quintillion. A loop written
`for (std::size_t i = 0; i <= v.size() - 1; ++i)` over an empty vector will
therefore run essentially forever, reading far past the end.

Prefer a range-based loop, which cannot get this wrong:

```cpp run title="The loop that cannot go wrong"
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{10, 20, 30};
    for (int value : v) {
        std::cout << value << ' ';
    }
    std::cout << '\n';

    std::vector<int> empty;
    for (int value : empty) {
        std::cout << "this never runs " << value;
    }
    std::cout << "(nothing above)\n";
}
```

## Floating point is not the reals

```cpp run title="A third is not a third"
#include <iostream>
#include <iomanip>

int main() {
    double a = 0.1, b = 0.2;

    std::cout << std::setprecision(20);
    std::cout << "0.1 + 0.2 = " << a + b << '\n';
    std::cout << "equal to 0.3? " << ((a + b) == 0.3 ? "yes" : "no") << '\n';
}
```

`double` stores values in binary, and one tenth has no exact binary
representation, exactly as one third has no exact decimal one. The stored value
is very slightly off, the errors accumulate, and `==` reports the truth: these
are different numbers.

The fix is to compare with a tolerance appropriate to your problem, not to use
`==`:

```cpp run title="Comparing with a tolerance"
#include <iostream>
#include <cmath>

bool close_enough(double a, double b, double tolerance = 1e-9) {
    return std::fabs(a - b) <= tolerance;
}

int main() {
    std::cout << std::boolalpha;
    std::cout << "0.1 + 0.2 == 0.3          : " << (0.1 + 0.2 == 0.3) << '\n';
    std::cout << "close_enough(0.1+0.2, 0.3): " << close_enough(0.1 + 0.2, 0.3) << '\n';
}
```

:::tip
Never use floating point for money. Represent amounts as an integer number of
the smallest unit — cents, or hundredths of a cent — and the arithmetic becomes
exact. The rounding error above is tiny; multiplied across a million
transactions it becomes an audit.
:::

## auto, and when it helps

`auto` asks the compiler to deduce the type from the initialiser. The variable
is still statically typed — you have just declined to write the type out.

```cpp run title="auto in its element"
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> scores{{"ada", 100}, {"alan", 92}};

    // Without auto: std::map<std::string, int>::const_iterator it = scores.find("ada");
    auto it = scores.find("ada");
    if (it != scores.end()) {
        std::cout << it->first << " scored " << it->second << '\n';
    }

    for (const auto& [name, score] : scores) {
        std::cout << name << ": " << score << '\n';
    }
}
```

Use `auto` when the type is long, obvious from the right-hand side, or genuinely
unspeakable (a lambda's type has no name you can write). Avoid it when the type
is the point — `auto x = 0;` tells a reader nothing that `int x = 0;` does not,
and `auto count = v.size();` hides that the type is unsigned, which is the
detail that matters.

:::pitfall
`auto` drops references and `const` by default. `auto item = container.front();`
makes a *copy* even when `front()` returns a reference. Write `auto&` or
`const auto&` when you meant to bind rather than copy — the structured binding
above uses `const auto&` for exactly this reason.
:::

## Check yourself

:::quiz
{
  "question": "What does `std::cout << 7 / 2 << ' ' << 7 % 2;` print?",
  "options": [
    { "text": "3.5 1", "why": "`7 / 2` with two int operands is integer division; no fractional part is produced at any point." },
    { "text": "3 1", "correct": true, "why": "Integer division truncates toward zero, giving 3, and `%` gives the remainder, 1." },
    { "text": "4 1", "why": "Integer division truncates rather than rounding, so 3.5 becomes 3, not 4." },
    { "text": "3 0", "why": "`7 % 2` is the remainder after dividing 7 by 2, which is 1. It would be 0 only if 2 divided 7 exactly." }
  ]
}
:::

:::quiz
{
  "question": "`std::vector<int> v; auto n = v.size();` — what is the type of `n`, and why does it matter?",
  "options": [
    { "text": "`int`, and it does not matter", "why": "`size()` returns `std::vector<int>::size_type`, which is an unsigned type — not `int`." },
    { "text": "`std::size_t`, and `n - 1` on an empty vector is a huge number, not -1", "correct": true, "why": "Exactly the trap. Unsigned arithmetic wraps, so `0 - 1` becomes the largest representable value, and a loop bounded by it reads far past the end." },
    { "text": "`std::size_t`, but the compiler converts to `int` when you subtract", "why": "The other way round: in a mixed comparison or subtraction the signed operand is usually converted to unsigned, not the reverse." },
    { "text": "It depends on the vector's element type", "why": "`size_type` is about the container's size, not its elements; it is `std::size_t` for every standard container on a normal platform." }
  ]
}
:::

## Practice

:::exercise average-of-three

:::exercise safe-loop-bounds

:::recap
- Every value has a type fixed at compile time. That is what lets the compiler
  emit fast code, and what obliges you to be explicit.
- `int` for counting, `double` for real numbers, `std::size_t` for sizes.
- Integer division truncates. Cast an operand, not the result, to get real
  division.
- Unsigned arithmetic wraps; signed overflow is undefined. Both are reasons to
  prefer range-based loops over index arithmetic.
- Floating point is binary, so `0.1 + 0.2 != 0.3`. Compare with a tolerance, and
  never store money in a `double`.
- `auto` is for types that are long or unwriteable, not for hiding types that
  the reader needs to see. It drops `const` and references unless you ask.
:::
