---
title: "Making decisions"
navTitle: "Making decisions"
summary: >-
  if, else, switch, and the boolean logic underneath them.
objectives:
  - Write conditions that short-circuit correctly
  - Use switch without falling through by accident
  - Explain why comparing floating-point numbers with == is a trap
status: complete
standard: c++20
requires: [values-and-types]
---

A program that always does the same thing is a calculation. A program that
chooses is where the work starts.

## if, and the shape of a condition

```cpp run title="Choosing between two paths" std=c++20
#include <iostream>

int main() {
    const int temperature = 12;

    if (temperature < 0) {
        std::cout << "freezing\n";
    } else if (temperature < 15) {
        std::cout << "cold\n";
    } else {
        std::cout << "warm\n";
    }
}
```

The condition must be something convertible to `bool`. Comparisons produce one
directly: `<`, `<=`, `>`, `>=`, `==`, `!=`.

:::pitfall
`=` assigns; `==` compares. Writing `if (x = 5)` assigns 5 to `x` and then tests
5, which is true — so the branch always runs and `x` is quietly destroyed.
`-Wall` warns about it (`suggest parentheses around assignment used as truth
value`), which is one more reason to compile with warnings on.
:::

Braces are optional for a single statement and you should use them anyway:

```cpp run title="Why the braces are not optional in practice" std=c++20
#include <iostream>

int main() {
    const bool ready = false;

    // Only the first line is conditional. The second always runs.
    if (ready)
        std::cout << "starting\n";
        std::cout << "  this looks conditional and is not\n";

    std::cout << "\nwith braces, the grouping is what it looks like\n";
    if (ready) {
        std::cout << "starting\n";
        std::cout << "this really is conditional\n";
    }
}
```

The indentation lies in the first case. Braces cost two characters and remove a
whole category of edit-time mistake.

## Declaring inside the condition

C++17 lets you declare a variable in the `if` itself, scoping it to the branches:

```cpp run title="if with an initialiser" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<std::string, int> ages{{"ada", 36}, {"alan", 41}};

    if (auto it = ages.find("ada"); it != ages.end()) {
        std::cout << it->first << " is " << it->second << '\n';
    }
    // `it` does not exist here, which is exactly right.

    if (auto it = ages.find("nobody"); it != ages.end()) {
        std::cout << "found\n";
    } else {
        std::cout << "no entry for nobody\n";
    }
}
```

Use it whenever the variable is only meaningful inside the branch. A name that
cannot leak cannot be misused later.

## Boolean logic, and short-circuiting

`&&` is and, `||` is or, `!` is not. The important property is that `&&` and
`||` **short-circuit**: they evaluate the right side only if they must.

```cpp run title="The right side may never run" std=c++20
#include <iostream>
#include <vector>

bool noisy(const char* label, bool value) {
    std::cout << "  evaluating " << label << '\n';
    return value;
}

int main() {
    std::cout << "false && ...\n";
    if (noisy("left", false) && noisy("right", true)) {}

    std::cout << "true || ...\n";
    if (noisy("left", true) || noisy("right", true)) {}

    std::cout << "\nshort-circuiting is what makes this safe:\n";
    std::vector<int> v;
    if (!v.empty() && v[0] > 0) {          // v[0] never runs on an empty vector
        std::cout << "first is positive\n";
    } else {
        std::cout << "empty, and we never touched v[0]\n";
    }
}
```

That last pattern — check that something exists, *then* look at it — depends
entirely on short-circuiting. Reverse the operands and the program reads out of
bounds before discovering there was nothing there.

:::warning
Never overload `&&` or `||` for your own types. An overloaded version is an
ordinary function call, so **both** operands are evaluated, and every
guard-then-use pattern written against it silently breaks. Chapter 3.6 lists
this among the operators to leave alone.
:::

## Comparing floating-point numbers

Chapter 1.2 showed that `0.1 + 0.2 != 0.3`. That has a direct consequence for
conditions:

```cpp run title="A condition that is never true" std=c++20
#include <cmath>
#include <iostream>

int main() {
    const double sum = 0.1 + 0.2;

    if (sum == 0.3) {
        std::cout << "equal\n";
    } else {
        std::cout << "not equal — and this is the branch that runs\n";
    }

    // Compare with a tolerance appropriate to the problem.
    if (std::fabs(sum - 0.3) < 1e-9) {
        std::cout << "close enough, which is the question you meant to ask\n";
    }
}
```

`<` and `>` on doubles are fine. It is `==` and `!=` that are almost always the
wrong question — and `!=` is worse, because a loop written
`while (x != target)` may never terminate.

## switch

When you are comparing one value against many constants, `switch` says so more
clearly than a chain of `else if`:

```cpp run title="switch over an enum" std=c++20
#include <iostream>
#include <string_view>

enum class Direction { north, east, south, west };

std::string_view describe(Direction d) {
    switch (d) {
        case Direction::north: return "up";
        case Direction::east:  return "right";
        case Direction::south: return "down";
        case Direction::west:  return "left";
    }
    return "unknown";
}

int main() {
    for (Direction d : {Direction::north, Direction::east,
                        Direction::south, Direction::west}) {
        std::cout << describe(d) << ' ';
    }
    std::cout << '\n';
}
```

Switching over an `enum class` and handling every enumerator has a real benefit:
**add a fifth direction and the compiler warns** that the switch no longer covers
every case. A chain of `else if` with a final `else` would silently take the
fallback instead.

### Fallthrough

A `case` without `break` continues into the next one. Sometimes that is what you
want; usually it is a bug:

```cpp run title="Fallthrough, accidental and deliberate" std=c++20
#include <iostream>

void classify(int score) {
    std::cout << score << ": ";
    switch (score) {
        case 0:
            std::cout << "none ";
            [[fallthrough]];          // deliberate, and says so
        case 1:
        case 2:
            std::cout << "low\n";
            break;
        case 3:
            std::cout << "medium\n";
            break;
        default:
            std::cout << "high\n";
            break;
    }
}

int main() {
    for (int score : {0, 1, 2, 3, 9}) classify(score);
}
```

Two things there. Stacked labels (`case 1: case 2:`) share a body and are not
fallthrough — that is the normal way to group values. And `[[fallthrough]];`
marks a deliberate fall from one body into the next; without it, compilers with
`-Wimplicit-fallthrough` warn, which is exactly the warning you want.

:::pitfall
Declaring a variable inside a `case` without braces is a compile error —
`jump to case label crosses initialization`. The whole switch body is one scope,
so a later `case` could jump past the initialisation. Wrap the case body in
braces when it needs its own variables.
:::

```cpp run expect-error title="A declaration the switch cannot allow"
int main() {
    int value = 1;
    switch (value) {
        case 1:
            int result = 10;      // error: jump to case label crosses this
            return result;
        case 2:
            return 0;
    }
}
```

## The conditional operator

For choosing between two *values* rather than two *actions*, `?:` is compact and
clear:

```cpp run title="Choosing a value" std=c++20
#include <iostream>
#include <string>

int main() {
    const int count = 1;

    // The conditional operator is an expression, so it can initialise a const.
    const std::string word = count == 1 ? "item" : "items";
    std::cout << count << ' ' << word << '\n';

    const int a = 7, b = 3;
    std::cout << "larger: " << (a > b ? a : b) << '\n';
}
```

It earns its place when both branches produce a value of the same type and the
whole thing fits on one line. Nested conditionals — `a ? b : c ? d : e` — are
where it stops being clearer than an `if`.

## Check yourself

:::quiz
{
  "question": "`std::vector<int> v; if (v[0] > 0 && !v.empty()) { … }` — what is wrong?",
  "options": [
    { "text": "Nothing; && short-circuits so v[0] is safe", "why": "Short-circuiting evaluates left to right. `v[0]` is the *left* operand here, so it runs first — on an empty vector, before anything has checked that it exists." },
    { "text": "The operands are the wrong way round: v[0] is read before the emptiness check", "correct": true, "why": "Exactly. Short-circuiting only protects the operand on the right. Written as `!v.empty() && v[0] > 0`, the read never happens on an empty vector." },
    { "text": "`&&` should be `&`", "why": "`&` is bitwise and, evaluates both sides, and would make this worse. `&&` is correct — the order of its operands is not." },
    { "text": "`v.empty()` should be `v.size() == 0`", "why": "They mean the same thing; `empty()` is preferred for clarity. Neither ordering issue is affected." }
  ]
}
:::

:::quiz
{
  "question": "Why prefer `switch` over `else if` chains when matching an enum?",
  "options": [
    { "text": "switch is faster", "why": "Sometimes it compiles to a jump table, but for a handful of cases the difference is nil. Speed is not the reason to choose it." },
    { "text": "The compiler warns when a new enumerator is not handled", "correct": true, "why": "That warning is the real benefit: add a case to the enum and every switch that must change tells you. An else-if chain with a final else silently takes the fallback instead." },
    { "text": "switch can compare strings, which else if cannot", "why": "The other way round — switch requires an integral or enumeration type, so std::string comparison needs if/else or a map." },
    { "text": "switch does not need break statements", "why": "It very much does. Omitting break falls through to the next case, which is the classic switch bug." }
  ]
}
:::

## Practice

:::exercise classify-number

:::exercise safe-guard

:::recap
- `=` assigns, `==` compares. Always use braces around branch bodies.
- `if (auto x = …; cond)` scopes the variable to the branches, so it cannot be
  misused afterwards.
- `&&` and `||` short-circuit left to right — which is what makes
  "check it exists, then read it" safe. Order the operands accordingly, and
  never overload these operators.
- Never compare floating-point values with `==` or `!=`; compare against a
  tolerance.
- `switch` over an `enum class` gets you a compiler warning when a new
  enumerator is added. Use `break`, mark deliberate fallthrough with
  `[[fallthrough]]`, and brace a case body that declares variables.
:::
