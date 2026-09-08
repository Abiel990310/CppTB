---
id: money-operators
title: "Make it add up"
difficulty: core
chapter: operator-overloading
topics: [operators, classes, api-design]
check: unit
standard: c++20
---

`Money` stores an amount in whole cents. Give it the arithmetic its callers
expect: addition, subtraction, negation, and scaling by an integer — with
scaling working from **both** sides, so `3 * price` compiles as readily as
`price * 3`.

Implement the compound assignments as members and build the binary operators on
top of them.

## Starter
```cpp
#include <cstdint>

class Money {
public:
    constexpr explicit Money(long long cents) : cents_(cents) {}
    constexpr long long cents() const { return cents_; }

    // Add the operators here.

private:
    long long cents_;
};
```

## Tests
```cpp
constexpr Money a{1999};
constexpr Money b{450};

CHECK_EQ((a + b).cents(), 2449LL);
CHECK_EQ((a - b).cents(), 1549LL);
CHECK_EQ((-a).cents(), -1999LL);

// Scaling must work from both sides.
CHECK_EQ((a * 3).cents(), 5997LL);
CHECK_EQ((3 * a).cents(), 5997LL);

// Compound assignment modifies in place and returns a reference for chaining.
Money running{100};
running += b;
CHECK_EQ(running.cents(), 550LL);
running -= Money{50};
CHECK_EQ(running.cents(), 500LL);
running *= 2;
CHECK_EQ(running.cents(), 1000LL);

Money chained{10};
(chained += Money{5}) += Money{5};
CHECK_EQ(chained.cents(), 20LL);

// Negative amounts behave normally.
CHECK_EQ((Money{-100} + Money{250}).cents(), 150LL);
CHECK_EQ((Money{0} - Money{75}).cents(), -75LL);
```

## Hints
- `Money& operator+=(Money other)` modifies `cents_` and returns `*this`. Returning a reference is what lets `(x += y) += z` chain.
- Write `operator+` as a **free** function taking its left operand by value: `Money operator+(Money a, Money b) { return a += b; }` — the by-value parameter is the copy you need.
- `3 * a` needs `operator*(int, Money)` as a free function. A member could never match it, because a member's left operand is always `Money`.
- `operator-()` with no parameters is unary negation; with one it is subtraction.
- The checks use `constexpr Money`, so mark the members `constexpr` too.

## Solution
```cpp
#include <cstdint>

class Money {
public:
    constexpr explicit Money(long long cents) : cents_(cents) {}
    constexpr long long cents() const { return cents_; }

    constexpr Money& operator+=(Money other) { cents_ += other.cents_; return *this; }
    constexpr Money& operator-=(Money other) { cents_ -= other.cents_; return *this; }
    constexpr Money& operator*=(int factor)  { cents_ *= factor; return *this; }

    constexpr Money operator-() const { return Money{-cents_}; }

private:
    long long cents_;
};

constexpr Money operator+(Money a, Money b) { return a += b; }
constexpr Money operator-(Money a, Money b) { return a -= b; }
constexpr Money operator*(Money a, int f)   { return a *= f; }
constexpr Money operator*(int f, Money a)   { return a *= f; }
```

## Notes
The `3 * a` check is the one that forces the design. If you make `operator*` a
member, `a * 3` compiles and `3 * a` does not — the compiler looks for
`int::operator*(Money)`, which cannot exist. An operator that works one way
round and not the other is worse than no operator, because the failure appears
at some unrelated call site much later.

Taking the left operand **by value** in the free functions is not laziness. You
need a copy to modify and return, and a by-value parameter is that copy — so
`return a += b;` does the work with no extra object.

Note that the class stores whole cents rather than a `double`. That is the
advice from Chapter 1.2 taken seriously: money in floating point accumulates
rounding error, and `0.1 + 0.2 != 0.3` becomes an audit finding.
