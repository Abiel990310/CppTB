---
id: lazy-primes
title: "Take from something infinite"
difficulty: stretch
chapter: ranges
topics: [ranges, views, laziness]
check: unit
standard: c++20
---

`first_primes` should return the first `n` prime numbers. The starter guesses an
upper bound, builds every prime below it, and truncates — so it does far too
much work for small `n`, and returns too few when the guess is short.

Rewrite it with a lazy pipeline over an unbounded range, so exactly as many
candidates are tested as are needed and no bound has to be guessed.

## Starter
```cpp
#include <vector>

inline bool is_prime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; ++d) {
        if (n % d == 0) return false;
    }
    return true;
}

std::vector<int> first_primes(int n) {
    std::vector<int> found;
    for (int candidate = 2; candidate < 100; ++candidate) {   // guessed bound
        if (is_prime(candidate)) found.push_back(candidate);
    }
    found.resize(static_cast<std::size_t>(n));
    return found;
}
```

## Tests
```cpp
{
    auto p = first_primes(5);
    CHECK_EQ(p.size(), std::size_t{5});
    CHECK_EQ(p[0], 2);
    CHECK_EQ(p[1], 3);
    CHECK_EQ(p[2], 5);
    CHECK_EQ(p[3], 7);
    CHECK_EQ(p[4], 11);
}
{
    auto p = first_primes(1);
    CHECK_EQ(p.size(), std::size_t{1});
    CHECK_EQ(p[0], 2);
}
{
    CHECK(first_primes(0).empty());
}
{
    // Well past the starter's guessed bound of 100.
    auto p = first_primes(50);
    CHECK_EQ(p.size(), std::size_t{50});
    CHECK_EQ(p[49], 229);
}
{
    auto p = first_primes(100);
    CHECK_EQ(p.size(), std::size_t{100});
    CHECK_EQ(p[99], 541);
}
```

## Hints
- `std::views::iota(2)` with one argument is an unbounded range starting at 2.
- Filter it with `is_prime`, then `std::views::take(n)`.
- Laziness is what makes an infinite range safe: `take(n)` stops the pipeline, so only the candidates needed are ever tested.
- `take` over an unbounded range is **not a common range** — `begin()` and `end()` have different types — so `std::vector<int>(p.begin(), p.end())` will not compile. Use `std::ranges::copy` into a `std::back_inserter`, or a plain loop.
- `take(0)` yields an empty range, so the `n == 0` case needs no special handling.

## Solution
```cpp
#include <algorithm>
#include <iterator>
#include <ranges>
#include <vector>

inline bool is_prime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; ++d) {
        if (n % d == 0) return false;
    }
    return true;
}

std::vector<int> first_primes(int n) {
    auto primes = std::views::iota(2)
                | std::views::filter(is_prime)
                | std::views::take(n);

    std::vector<int> result;
    std::ranges::copy(primes, std::back_inserter(result));
    return result;
}
```

## Notes
The 50th prime is 229 and the 100th is 541 — both well past the starter's
guessed bound of 100, which is the point. Guessing a bound is the thing
laziness removes: there is no number to pick, no way to pick it too small, and
no work done past what `take` asked for.

`std::views::iota(2)` really is unbounded, and iterating it without a `take`
would run until `int` overflowed. That is safe to *write* only because nothing
is evaluated until something reads it — the same property that let the chapter's
`take(2)` sample stop after testing four elements out of eight.

Note `filter(is_prime)` passes the function directly rather than wrapping it in
a lambda. A plain function name works wherever a predicate is expected, and it
is one fewer thing to read.

The materialisation is worth dwelling on. `std::vector<int>(primes.begin(),
primes.end())` — the idiom from the chapter's earlier example — does **not**
compile here, because `take` over an unbounded `iota` is not a *common range*:
its `end()` is a sentinel of a different type from its `begin()`, and the
two-iterator constructor needs both to match. `std::ranges::copy` into a
`back_inserter` has no such requirement, which is why it is the form to reach
for by default.
