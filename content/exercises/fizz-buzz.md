---
id: fizz-buzz
title: "Order the conditions"
difficulty: intro
chapter: repetition
topics: [loops, control-flow, strings]
check: unit
standard: c++20
---

`fizzbuzz` returns one string for the numbers 1 to `n`, separated by single
spaces:

- `"Fizz"` when the number is divisible by 3
- `"Buzz"` when divisible by 5
- `"FizzBuzz"` when divisible by both
- otherwise the number itself

The starter checks divisibility by 3 first, so 15 comes out as `"Fizz"` rather
than `"FizzBuzz"`.

## Starter
```cpp
#include <string>

std::string fizzbuzz(int n) {
    std::string result;
    for (int i = 1; i <= n; ++i) {
        if (i > 1) result += ' ';

        if (i % 3 == 0) {
            result += "Fizz";
        } else if (i % 5 == 0) {
            result += "Buzz";
        } else if (i % 3 == 0 && i % 5 == 0) {
            result += "FizzBuzz";
        } else {
            result += std::to_string(i);
        }
    }
    return result;
}
```

## Tests
```cpp
CHECK_EQ(fizzbuzz(1), std::string("1"));
CHECK_EQ(fizzbuzz(3), std::string("1 2 Fizz"));
CHECK_EQ(fizzbuzz(5), std::string("1 2 Fizz 4 Buzz"));
CHECK_EQ(fizzbuzz(15),
         std::string("1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz"));
CHECK_EQ(fizzbuzz(0), std::string(""));
CHECK_EQ(fizzbuzz(-1), std::string(""));
```

## Hints
- The `FizzBuzz` branch is unreachable: anything divisible by both is caught by the `% 3` test first.
- In an `if`/`else if` chain, the **most specific** condition must come first.
- Divisible by both 3 and 5 is the same as divisible by 15.
- The separator logic in the starter is already correct — do not change it.

## Solution
```cpp
#include <string>

std::string fizzbuzz(int n) {
    std::string result;
    for (int i = 1; i <= n; ++i) {
        if (i > 1) result += ' ';

        if (i % 15 == 0) {
            result += "FizzBuzz";
        } else if (i % 3 == 0) {
            result += "Fizz";
        } else if (i % 5 == 0) {
            result += "Buzz";
        } else {
            result += std::to_string(i);
        }
    }
    return result;
}
```

## Notes
An `if`/`else if` chain tests in order and stops at the first match, so a broader
condition placed earlier makes every narrower one below it dead code. Compilers
do not warn about this — the branch is syntactically reachable, just never taken
— which is why the bug survives review.

The other common shape builds the string instead of branching on all four cases:

```cpp
std::string word;
if (i % 3 == 0) word += "Fizz";
if (i % 5 == 0) word += "Buzz";
if (word.empty()) word = std::to_string(i);
```

That version has no ordering problem at all, because nothing is exclusive — each
rule contributes independently. When an if-chain's ordering starts feeling
delicate, look for a formulation where the cases do not compete.
