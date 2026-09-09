---
id: fast-power
title: "Exponentiation by squaring"
difficulty: core
chapter: divide-and-conquer
topics: [divide-and-conquer, modular-arithmetic, algorithms]
check: unit
standard: c++20
---

Two functions built on halving an exponent.

- `power_mod(base, exp, mod)` — `base^exp mod mod`, with `exp` up to 10¹⁸ and
  `mod` up to 10⁹. The squaring loop is right; it seeds the accumulator with
  `base` instead of the multiplicative identity, so every answer is one factor
  of `base` too large.
- `mod_inverse(a, prime)` — the multiplicative inverse of `a` modulo a prime
  `p`, that is the `x` in `[0, p)` with `a·x ≡ 1 (mod p)`. Uses the wrong
  exponent in Fermat's little theorem.

`a` is never a multiple of `prime`, so the inverse always exists.

## Starter
```cpp
#include <cstdint>

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = base % mod;             // should be the identity, 1
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}

std::uint64_t mod_inverse(std::uint64_t a, std::uint64_t prime) {
    return power_mod(a, prime - 1, prime);         // off by one in the exponent
}
```

## Tests
```cpp
const std::uint64_t P = 1000000007ULL;

// power_mod
CHECK_EQ(power_mod(3, 5, P), 243ULL);
CHECK_EQ(power_mod(2, 100, P), 976371285ULL);
CHECK_EQ(power_mod(5, 0, P), 1ULL);                    // anything to the zero
CHECK_EQ(power_mod(0, 0, P), 1ULL);                    // by convention here
CHECK_EQ(power_mod(0, 5, P), 0ULL);
CHECK_EQ(power_mod(123456789, 987654321, P), 652541198ULL);
CHECK_EQ(power_mod(2, 62, P), 145586002ULL);
CHECK_EQ(power_mod(999999999, 999999999, 1000000000ULL), 999999999ULL);
CHECK_EQ(power_mod(1, 1000000000000000000ULL, 999999999ULL), 1ULL);
CHECK_EQ(power_mod(123456789, 1000000000000000000ULL, P), 228100152ULL);

// mod_inverse
CHECK_EQ(mod_inverse(3, P), 333333336ULL);
CHECK_EQ(mod_inverse(2, P), 500000004ULL);
CHECK_EQ(mod_inverse(1, P), 1ULL);
CHECK_EQ(mod_inverse(1000000006ULL, P), 1000000006ULL);
CHECK_EQ(mod_inverse(3, P) * 3 % P, 1ULL);             // the defining property
CHECK_EQ(mod_inverse(123456789, P) * 123456789 % P, 1ULL);
CHECK_EQ(mod_inverse(5, 13), 8ULL);                    // 5 * 8 = 40 = 1 (mod 13)
```

## Hints
- `x^n = (x^(n/2))²` when `n` is even, and `x·(x^(n-1))` when it is odd. Iteratively: walk the bits of `exp`, squaring `base` each step and multiplying it into the result when the bit is set.
- A product accumulator starts at the multiplicative identity, 1 — the same reason a sum accumulator starts at 0. Seeding with `base` multiplies one extra copy in, so `3^5` comes out as `3^6`.
- Starting at 1 also makes `exp == 0` fall out with no special case, and the test with an exponent of 10¹⁸ finishes in about sixty steps.
- Reduce after every multiplication, including the squaring: `base = base * base % mod;`. Two reduced values below 10⁹ multiply to at most 10¹⁸, which is the most a `std::uint64_t` holds.
- Fermat's little theorem says `a^(p-1) ≡ 1 (mod p)` for a prime `p` not dividing `a`. So `a · a^(p-2) ≡ 1`, and the inverse is `a^(p-2)`, not `a^(p-1)`.
- The starter's `mod_inverse` returns 1 for everything, which is what `a^(p-1)` is — a good reminder that a wrong answer can be suspiciously tidy.
- Check any inverse you compute by multiplying: `inv * a % p` must be 1. The tests do exactly that.

## Solution
```cpp
#include <cstdint>

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = 1 % mod;                // 1, or 0 when mod is 1
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}

std::uint64_t mod_inverse(std::uint64_t a, std::uint64_t prime) {
    return power_mod(a, prime - 2, prime);         // Fermat: a^(p-2) = a^-1
}
```

## Notes
**Start at the identity.** A product accumulator seeds with 1 for the same
reason a sum accumulator seeds with 0: the seed must be a value that changes
nothing. The starter seeds with `base`, so the loop's own contribution of
`base^exp` is multiplied by one extra `base` and every answer is `base^(exp+1)`
— `3^5` comes out as 729 rather than 243.

Seeding with 1 also makes `exp == 0` correct without a branch, which is the
usual reward for choosing the seed rather than inventing one.

`1 % mod` rather than plain `1` covers `mod == 1`, where every residue is 0. It
costs nothing and removes the one input that would otherwise return 1 where 0 is
correct. The tests here do not include `mod == 1`, which is precisely why it is
worth writing: the inputs a problem does not test are the ones a later problem
will.

**The loop is the exponent's binary expansion.** Each iteration squares `base`,
so after `k` steps `base` holds `x^(2^k)`; the `if (exp & 1)` multiplies that
into the result exactly when bit `k` of the exponent is set. `x^n` is therefore
the product of `x^(2^k)` over the set bits of `n` — which is why the cost is the
number of bits, about 60 for an exponent of 10¹⁸, rather than `n`.

Written recursively it is the `T(n/2) + 1` recurrence from this chapter; written
iteratively there is no stack and no depth limit, and it reads as what it is.

**Fermat, and the off-by-one.** For a prime `p` and `a` not divisible by `p`,
`a^(p-1) ≡ 1 (mod p)`. Dividing both sides by `a` — legitimately, since `a` is
invertible — gives `a^(p-2) ≡ a⁻¹`. The starter computes `a^(p-1)`, which is 1
for every input, so `mod_inverse` returns 1 always. That is a *tidy* wrong
answer, and tidy wrong answers survive testing longest.

Three practical notes on inverses.

- **The primality matters.** `a^(p-2)` is the inverse only when the modulus is
  prime. For a composite modulus, use the extended Euclidean algorithm, which
  works whenever `gcd(a, m) == 1` — chapter 10.36 writes it.
- **Division under a modulus is multiplication by the inverse.** `a / b mod p`
  is `a * mod_inverse(b, p) % p`; there is no `/` that works, and reaching for
  one is the usual first mistake in modular arithmetic.
- **Precompute when you need many.** Inverting `n` numbers costs `n log p` this
  way. For the inverses of `1 … n` there is a linear recurrence, and for
  factorials one inverse plus a backward pass suffices. Chapter 10.37 needs
  both.
