---
title: "Repetition"
navTitle: "Repetition"
summary: >-
  Loops, and the off-by-one errors that live in them.
objectives:
  - Write a range-based for loop over a container
  - Convert an index loop to a range loop and back
  - Identify the exit condition that makes a loop terminate
status: complete
standard: c++20
requires: [making-decisions]
---

C++ has four ways to repeat, and one of them should be your default. This
chapter is about which, and about the small number of ways loops go wrong.

## Range-based for: the default

If you are visiting every element of a container, this is the loop to write:

```cpp run title="The loop with nothing to get wrong" std=c++20
#include <iostream>
#include <string>
#include <vector>

int main() {
    const std::vector<std::string> words{"alpha", "beta", "gamma"};

    for (const std::string& word : words) {
        std::cout << word << ' ';
    }
    std::cout << '\n';

    // It works on anything with begin and end — including a raw array.
    int numbers[] = {1, 2, 3, 4};
    int total = 0;
    for (int n : numbers) total += n;
    std::cout << "total " << total << '\n';
}
```

There is no index, so there is no off-by-one. There is no bound, so it cannot
run past the end. It stops when the container stops.

**Choose the loop variable's form deliberately:**

```cpp run title="Three declarations, three meanings" std=c++20
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> words{"alpha", "beta"};

    for (std::string w : words) w += "!";              // a copy: modifies nothing
    std::cout << "after by-value:     " << words[0] << '\n';

    for (std::string& w : words) w += "!";             // binds: modifies the element
    std::cout << "after by-reference: " << words[0] << '\n';

    for (const std::string& w : words) {               // binds, promises not to modify
        std::cout << "reading: " << w << '\n';
    }
}
```

`const auto&` should be your reflex for reading, `auto&` for modifying, and
plain `auto` only for small types where a copy is genuinely free.

:::pitfall
`for (auto x : container)` copies every element. On a `vector<std::string>` that
is an allocation per iteration, silently, to do something that only reads. It is
the most common performance mistake in beginner C++, and the fix is one
character.
:::

## The index loop, and when you need it

```cpp run title="When the index itself matters" std=c++20
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> v{10, 20, 30};

    for (std::size_t i = 0; i < v.size(); ++i) {
        std::cout << i << ": " << v[i] << '\n';
    }
}
```

Reach for this when you need the position, when you are walking two containers
in step, or when you are not visiting every element.

Three details in that header carry weight:

- **`std::size_t`, not `int`.** `size()` returns an unsigned type, and comparing
  it against a signed `int` is a warning and a latent bug.
- **`< v.size()`, not `<= v.size()`.** The last valid index is `size() - 1`.
- **`++i`, not `i++`.** For an `int` they are identical; for an iterator or a
  heavy type, `i++` makes a copy to return the old value. The habit costs
  nothing and sometimes saves something.

:::warning
Never write `i <= v.size() - 1` on a container that might be empty. `size()` is
unsigned, so `0 - 1` is not `-1` — it is about 18 quintillion, and the loop runs
essentially forever, reading far out of bounds. Chapter 1.2 has the arithmetic;
this is where it bites.
:::

```cpp run expect-ub title="The unsigned wraparound, in a loop" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> empty;

    std::cout << "empty.size() - 1 = " << empty.size() - 1 << '\n';

    // Bounded so the sample terminates; the real bug has no bound.
    for (std::size_t i = 0; i <= empty.size() - 1 && i < 3; ++i) {
        std::cout << "reading index " << i << ": " << empty[i] << '\n';
    }
}
```

## while, and do-while

`while` repeats as long as a condition holds, and is right when the number of
iterations is not known up front:

```cpp run title="Looping until something happens" std=c++20
#include <iostream>

int main() {
    int value = 1000;
    int halvings = 0;

    while (value > 1) {
        value /= 2;
        ++halvings;
    }
    std::cout << "halved " << halvings << " times to reach " << value << '\n';
}
```

Every `while` needs an answer to one question: **what changes each iteration to
eventually make the condition false?** Here it is `value /= 2`. If you cannot
point at the line that makes progress, the loop does not terminate.

`do`/`while` runs the body once before testing, which is occasionally what you
want for "prompt, then validate":

```cpp run title="do-while runs at least once" std=c++20
#include <iostream>
#include <sstream>

int main() {
    std::istringstream input{"-3 -1 7"};
    int value = 0;

    do {
        input >> value;
        std::cout << "read " << value << '\n';
    } while (value < 0 && input);

    std::cout << "first non-negative: " << value << '\n';
}
```

It is rare. When in doubt, use `while` — a loop whose body might need to run zero
times is far more common than one that must always run once.

## break and continue

```cpp run title="Leaving early, and skipping ahead" std=c++20
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> v{3, 8, 2, 9, 4};

    // break: stop entirely
    for (int x : v) {
        if (x > 5) {
            std::cout << "first over five: " << x << '\n';
            break;
        }
    }

    // continue: skip the rest of this iteration
    std::cout << "odd values: ";
    for (int x : v) {
        if (x % 2 == 0) continue;
        std::cout << x << ' ';
    }
    std::cout << '\n';
}
```

`break` leaves only the innermost loop. For nested loops, the usual answers are
to extract the inner loop into a function and `return`, or to use a flag — C++
has no labelled break.

```cpp run title="Escaping nested loops" std=c++20
#include <iostream>
#include <optional>
#include <vector>

// Extracting to a function makes `return` the escape.
std::optional<std::pair<int, int>> find_pair(const std::vector<int>& v, int target) {
    for (std::size_t i = 0; i < v.size(); ++i) {
        for (std::size_t j = i + 1; j < v.size(); ++j) {
            if (v[i] + v[j] == target) {
                return std::pair{static_cast<int>(i), static_cast<int>(j)};
            }
        }
    }
    return std::nullopt;
}

int main() {
    const std::vector<int> v{2, 7, 11, 15};

    if (auto found = find_pair(v, 9)) {
        std::cout << "indices " << found->first << " and " << found->second << '\n';
    }
    if (!find_pair(v, 100)) {
        std::cout << "no pair sums to 100\n";
    }
}
```

## Modifying while looping

Do not change a container's size while a range-based `for` is walking it.
Chapter 4.4 explains why in terms of iterators; the short version is that the
loop took its start and end points once, before the first iteration.

```cpp run expect-ub title="Growing a container mid-loop" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};

    for (int x : v) {
        if (x == 2) v.push_back(99);   // may reallocate: the loop's bounds are stale
        std::cout << x << ' ';
    }
    std::cout << '\n';
}
```

When you need to remove elements, say so directly:

```cpp run title="Removing safely" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6};

    std::erase_if(v, [](int x) { return x % 2 == 0; });

    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';
}
```

## Prefer an algorithm when one fits

Many loops have a name. Chapter 4.5 covers them properly, but the habit starts
here:

```cpp run title="The same three loops, named" std=c++20
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

int main() {
    const std::vector<int> v{4, 8, 15, 16, 23, 42};

    std::cout << "sum:      " << std::accumulate(v.begin(), v.end(), 0) << '\n';
    std::cout << "largest:  " << *std::ranges::max_element(v) << '\n';
    std::cout << "any odd:  " << std::boolalpha
              << std::ranges::any_of(v, [](int x) { return x % 2; }) << '\n';
}
```

A loop you write can be wrong. `std::ranges::max_element` cannot.

## Check yourself

:::quiz
{
  "question": "`for (std::size_t i = 0; i <= v.size() - 1; ++i)` on an empty vector — what happens?",
  "options": [
    { "text": "The loop body never runs, because size() is 0", "why": "That would be true with `<` and `size()`. With `<= size() - 1` the bound is computed first, and on an empty vector that computation is the problem." },
    { "text": "`size() - 1` wraps to a huge unsigned value, so the loop runs essentially forever and reads out of bounds", "correct": true, "why": "size() returns an unsigned type, so 0 - 1 is about 18 quintillion rather than -1. Writing `i < v.size()` avoids the subtraction entirely." },
    { "text": "It is a compile error, because size() is unsigned", "why": "It compiles without complaint. The arithmetic is well defined for unsigned types — it just does not mean what the author intended." },
    { "text": "It runs once, then stops", "why": "Nothing stops it: `i` never reaches a bound that large, and the reads are out of bounds from the first iteration." }
  ]
}
:::

:::quiz
{
  "question": "`for (auto w : words)` where `words` is a `std::vector<std::string>` — what is the cost?",
  "options": [
    { "text": "None; auto deduces a reference for container elements", "why": "`auto` deduces by value and strips references. You get a copy unless you write `auto&` or `const auto&`." },
    { "text": "One full copy of each string per iteration, allocation included", "correct": true, "why": "Each iteration constructs a std::string from the element and destroys it at the end of the body. For a read-only loop that is pure waste, and `const auto&` removes it." },
    { "text": "It fails to compile for non-copyable element types", "why": "True as far as it goes — a vector of unique_ptr would indeed fail — but for copyable types the cost is silent, which is the real problem." },
    { "text": "The copies are elided by the optimizer", "why": "Elision applies to temporaries in initialisation and returns, not to constructing a loop variable from an existing element each iteration." }
  ]
}
:::

## Practice

:::exercise sum-to-n

:::exercise fizz-buzz

:::recap
- Range-based `for` is the default: no index, no bound, no off-by-one. Use
  `const auto&` to read, `auto&` to modify, plain `auto` only for small types.
- Use an index loop when the position matters. `std::size_t`, `< size()`, `++i`.
- Never write `<= size() - 1` — unsigned wraparound makes it a runaway loop on
  an empty container.
- Every `while` needs a line that makes progress toward the condition becoming
  false; if you cannot point at it, the loop does not terminate.
- `break` leaves the innermost loop only. Extract nested loops into a function
  and `return`.
- Do not change a container's size while looping over it; use `std::erase_if`.
- If the loop has a name in `<algorithm>`, use the name.
:::
