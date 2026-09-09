---
id: judge-power-tower
title: "A tower of exponents"
difficulty: stretch
chapter: divide-and-conquer
topics: [divide-and-conquer, modular-arithmetic, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print `a^(b^c) mod m`, where `m` is prime.

**Input.** One line containing `a`, `b`, `c`, and `m`.

**Output.** One line: the value of `a^(b^c) mod m`.

**Constraints.** `1 ≤ a, b, c ≤ 10¹⁸`, and `m` is a prime with `2 ≤ m ≤ 10⁹+7`.
The exponent `b^c` is astronomically large and must never be computed.

## Starter
```cpp
#include <cstdint>
#include <iostream>

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = 1 % mod;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::uint64_t a, b, c, m;
    std::cin >> a >> b >> c >> m;

    if (a % m == 0) { std::cout << 0 << '\n'; return 0; }

    std::uint64_t exponent = power_mod(b, c, m);   // reduced modulo what, exactly?
    std::cout << power_mod(a, exponent, m) << '\n';
}
```

## Cases

### Sample
```in
2 3 2 1000000007
```
```out
512
```

### a small modulus
```in
3 2 3 7
```
```out
2
```

### the base is a multiple of the modulus
```in
7 5 5 7
```
```out
0
```

### both exponents at the limit
```in
2 1000000000000000000 1000000000000000000 1000000007
```
```out
964165130
```

### base 1
```in
1 999 999 1000000007
```
```out
1
```

### exponents of 1
```in
5 1 1 13
```
```out
5
```

### a tiny modulus
```in
2 4 2 5
```
```out
1
```

### a large base
```in
123456789 987654321 2 1000000007
```
```out
860081362
```

## Hints
- `b^c` cannot be computed — it has more digits than there are atoms in the universe. It must be reduced before it is used as an exponent.
- Reducing an *exponent* is not the same as reducing a *value*. The right modulus for an exponent comes from Fermat's little theorem: for a prime `m` and `a` not divisible by `m`, `a^(m-1) ≡ 1 (mod m)`.
- So `a^k ≡ a^(k mod (m-1)) (mod m)`. The inner power must be taken modulo `m - 1`, not modulo `m`.
- `3^(2^3) mod 7` is the smallest case that separates them: `2^3 = 8`, and `8 mod 6 = 2` gives `3^2 = 2 (mod 7)`, while `8 mod 7 = 1` gives 3.
- Handle `a % m == 0` first and print 0. Fermat says nothing about a base the modulus divides, and the reduction would be wrong there.
- Every multiplication is between two values below 10⁹, so the products reach 10¹⁸ and fit `std::uint64_t` — but only if you reduce after each one.

## Solution
```cpp
#include <cstdint>
#include <iostream>

std::uint64_t power_mod(std::uint64_t base, std::uint64_t exp, std::uint64_t mod) {
    std::uint64_t result = 1 % mod;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::uint64_t a, b, c, m;
    std::cin >> a >> b >> c >> m;

    if (a % m == 0) { std::cout << 0 << '\n'; return 0; }

    // Fermat: a^(m-1) = 1, so the exponent only matters modulo m - 1.
    std::uint64_t exponent = power_mod(b, c, m - 1);
    std::cout << power_mod(a, exponent, m) << '\n';
}
```

## Notes
Two `power_mod` calls, two different moduli, and getting them the same way round
is the whole problem.

**Values reduce mod `m`; exponents reduce mod `m − 1`.** They are different
moduli because they answer different questions. `a·b mod m` is about the ring of
residues; `a^k mod m` is about the *order* of `a` in the multiplicative group,
and Fermat's little theorem says that order divides `m − 1` for a prime `m`.
Hence `a^(m-1) ≡ 1`, and multiplying by that changes nothing, so only
`k mod (m-1)` matters.

`3^(2^3) mod 7` is the smallest case where the two disagree. The true exponent
is 8; `8 mod 6 = 2` and `3² = 9 ≡ 2 (mod 7)`, which is right, while `8 mod 7 = 1`
and `3¹ = 3`, which is not. On the largest case the two answers are 964165130 and
1544216 — no relationship at all, which is what a wrong modulus usually produces.

**The multiple-of-`m` case is genuinely separate.** Fermat requires `m ∤ a`. When
`a ≡ 0 (mod m)`, every positive power is 0 and the reduction would be actively
wrong: `b^c mod (m-1)` could come out 0, and `a^0 = 1` — an answer of 1 where the
truth is 0. Handling it before anything else is not defensiveness; it is the
theorem's precondition.

The general version, for a composite modulus, replaces `m − 1` with Euler's
totient `φ(m)` and needs a further correction when `gcd(a, m) ≠ 1`: `a^k ≡
a^(k mod φ(m) + φ(m))` for `k ≥ log₂ m`. That is the *generalised Euler theorem*,
and it is what a problem with a non-prime modulus is asking for. Chapter 10.36
computes `φ`.

**Why this is a divide-and-conquer problem at all.** Both reductions are
exponentiation by squaring: sixty squarings each, so about 120 multiplications
for an exponent tower that has no decimal representation. The recurrence is
`T(n) = T(n/2) + 1`, the same one that makes binary search logarithmic, applied
to an exponent rather than to a range.
