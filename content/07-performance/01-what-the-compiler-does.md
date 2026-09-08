---
title: "What the compiler does for you"
navTitle: "What the compiler does"
summary: >-
  The optimizations you can rely on, seen in the generated assembly.
objectives:
  - Read simple optimized assembly
  - Explain constant folding, inlining, and dead-code elimination
  - Compare -O0 and -O2 output for the same function
status: complete
standard: c++20
requires: [static-polymorphism]
---

Most performance advice is folklore, and most of it is about work the compiler
already does. Before you can tell a real optimisation from a superstition, you
need to see what comes out the other end.

Every runnable sample in this book has an **Assembly** button, and next to it a
dropdown for the optimisation level. This chapter is about learning to read what
it shows you. You do not need to write assembly, and you will not be asked to.
You need enough to answer one question: *did the thing I care about survive?*

```cpp run asm title="Two functions, one instruction each"
#include <iostream>

int add(int a, int b) {
    return a + b;
}

int times_eight(int x) {
    return x * 8;
}

int main() {
    std::cout << add(20, 22) << ' ' << times_eight(5) << '\n';
}
```

Press **Assembly**. With the dropdown on `-O2`, find `_Z3addii` — that is `add`,
with its parameter types encoded into the name. The body is two lines:

```
leal  (%rdi,%rsi), %eax
ret
```

Now switch the dropdown to `-O0` and look again. The same function is eleven
instructions, and most of them write the arguments to the stack and read them
straight back.

## Enough assembly to read the output

You need five facts, and then most short functions become legible.

**Names are mangled.** `_Z3addii` is `add(int, int)`: `3add` is the name and its
length, `ii` the parameter types. `_Z11times_eighti` is `times_eight(int)`. A
name with no `_Z` prefix — `main` — is `extern "C"` or C-compatible.

**Arguments arrive in registers.** On x86-64 Linux the first six integer or
pointer arguments come in `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`, in that order,
and the return value goes back in `rax`. Floating-point arguments use `xmm0`
through `xmm7`.

**Register names encode the width.** `rax` is the 64-bit register, `eax` its low
32 bits, `ax` the low 16, `al` the low 8. Seeing `eax` where you expected `rax`
usually just means the value is an `int`.

**The operand order is destination-last.** This is AT&T syntax, GCC's default:
`movl %edi, %eax` copies `edi` *into* `eax`. Intel syntax, which you may have
seen elsewhere, is the other way round. The suffix on the mnemonic is the width:
`b` byte, `w` word (16), `l` long (32), `q` quad (64).

**Some instructions do more than their name suggests.** `lea` — "load effective
address" — computes an address expression without touching memory, so compilers
use it as a general-purpose arithmetic instruction. `leal (%rdi,%rsi), %eax`
means `eax = edi + esi`. That is why `add` contains no `add`.

| You see | It means |
|---|---|
| `mov src, dst` | copy |
| `lea (a,b,s), dst` | `dst = a + b*s`, no memory touched |
| `add`, `sub`, `imul` | arithmetic |
| `sal $n` / `shl $n` | shift left by n (multiply by 2ⁿ) |
| `sar $n` / `shr $n` | shift right, arithmetic / logical |
| `cmp` then `jle`, `jne`, … | compare and branch |
| `call` / `ret` | call and return |
| `endbr64` | a security landing pad; ignore it |
| `xorl %eax, %eax` | set `eax` to zero (shorter than `mov $0`) |
| anything with `xmm` | floating point, or SIMD |

## `-O0` is not "no optimisation"

`-O0` means *do not reorder or eliminate*, so that a debugger can stop on any
line and show you any variable. Every local lives in memory, and every statement
loads its operands and stores its result. That is why the `-O0` version of `add`
spends nine instructions moving values to and from the stack to perform one
addition.

But some choices are made regardless of level, because they are not
optimisations at all — they are instruction selection. `times_eight` compiles to
a shift, `sall $3`, even at `-O0`. The compiler never emits a multiply for
`x * 8` because it has no reason to.

The practical consequence: **never benchmark at `-O0`**, and never conclude
anything from `-O0` assembly except how the debugger sees your code.

## Constant folding and propagation

Anything the compiler can work out, it works out.

```cpp run asm title="Arithmetic that never happens"
#include <iostream>

int configured_limit() {
    int base = 64;
    int factor = 3;
    int adjustment = base / 8;
    return base * factor + adjustment;
}

int main() {
    std::cout << configured_limit() << '\n';
}
```

At `-O2`, `_Z16configured_limitv` is `movl $200, %eax; ret`. There is no
multiplication, no division, and no `base` — the values were *propagated*
forward through the assignments and the arithmetic *folded* into one constant.

This is why "I hoisted that division out of the loop" is so often a change with
no effect: if the operands are constants, the division was never going to
execute. It is also, incidentally, most of what `constexpr` guarantees — the
difference being that `constexpr` makes it a rule rather than a hope, and gives
you an error when it fails.

## Inlining is the one that matters

Inlining replaces a call with the body of the callee. That saves the call
overhead, which is small. What makes it the most important optimisation in the
compiler is what it enables: once the body is in front of the caller's code,
constant folding, dead-code elimination, and everything else can see across what
used to be a boundary.

```cpp run asm title="Three layers that become one instruction"
#include <iostream>

int scale(int x, int factor)  { return x * factor; }
int offset(int x, int amount) { return x + amount; }

int transform(int x) {
    return offset(scale(x, 4), 10);
}

int main() {
    int value = 0;
    std::cin >> value;                 // so the compiler cannot fold it away
    std::cout << transform(value) << '\n';
}
```

`_Z9transformi` at `-O2` is `leal 10(,%rdi,4), %eax; ret`. Both calls are gone,
and the multiply-then-add became a single `lea`. At `-O0` you will find three
separate functions and two real `call` instructions.

Inlining is a heuristic, not a promise. The compiler weighs the size of the body
against the number of call sites, and it cannot inline through a call it cannot
see — a virtual call whose target is unknown, or a function in another
translation unit without link-time optimisation. Chapter 7.6 comes back to that.

## Dead-code elimination

If a computation cannot affect anything observable, it does not survive.

```cpp run asm title="Work that is thrown away"
#include <iostream>

int only_the_last_one(int x) {
    int a = x * 3;
    int b = a + 7;
    int unused = b * b * b;      // never read
    return x + 1;                // does not depend on any of it
}

int main() {
    int value = 0;
    std::cin >> value;
    std::cout << only_the_last_one(value) << '\n';
}
```

`_Z17only_the_last_onei` is `leal 1(%rdi), %eax; ret`. Everything else was
deleted, because nothing reads it. The compiler tells you as much before you
even open the assembly — the sample compiles with a `-Wunused-variable` warning
for `unused`, which is the same analysis pointed at you instead of at the code
generator.

:::pitfall
This is the single biggest cause of nonsense microbenchmarks. Time a loop that
computes a value nobody uses and you are timing an empty loop. Chapter 7.2 is
about how to stop the compiler doing this to your measurements — and the answer
is *not* to compile at `-O0`.
:::

## Strength reduction, and where it stops

The compiler replaces expensive operations with cheap ones. Division is the
expensive one, and how well it can do depends on a detail of your types.

```cpp run asm title="The same division, two different costs"
#include <iostream>

unsigned halve_unsigned(unsigned x) { return x / 2; }
int      halve_signed(int x)        { return x / 2; }

int main() {
    int value = 0;
    std::cin >> value;
    std::cout << halve_unsigned(static_cast<unsigned>(value)) << ' '
              << halve_signed(value) << '\n';
}
```

At `-O2` the unsigned version is one shift:

```
movl  %edi, %eax
shrl  %eax
```

The signed version is three instructions more:

```
movl  %edi, %eax
shrl  $31, %eax      ; extract the sign bit
addl  %edi, %eax     ; add it, to bias the rounding
sarl  %eax
```

The reason is a language rule. Integer division in C++ rounds **towards zero**,
so `-3 / 2` is `-1`. An arithmetic right shift rounds towards negative infinity,
giving `-2`. The extra instructions add one to negative values first so that the
shift produces the answer the standard requires. Neither is slow — but this is
the shape of a great many "why is my code not as fast as I expected" answers:
the compiler is not being timid, it is obeying a rule you forgot about.

:::note
This is a reason to use unsigned types for quantities that genuinely cannot be
negative *and* are divided or shifted in hot code. It is not a general argument
for unsigned — the wrap-around behaviour at zero causes far more bugs than the
missing instruction costs, and Chapter 2.2 covered why `size_t` in a
countdown loop is a trap.
:::

## Vectorisation

Given a loop with independent iterations, the compiler can do several at once
with SIMD instructions.

```cpp run asm title="Four additions per instruction"
#include <iostream>
#include <vector>

int sum_array(const int* data, int n) {
    int total = 0;
    for (int i = 0; i < n; ++i) total += data[i];
    return total;
}

int main() {
    std::vector<int> values(1000, 2);
    std::cout << sum_array(values.data(), static_cast<int>(values.size())) << '\n';
}
```

At `-O2`, `_Z9sum_arrayPKii` is a scalar loop — but a better one than you wrote.
The index arithmetic is gone: instead of computing `data + i*4` each time, it
walks a pointer and compares against a precomputed end. That is **strength
reduction** applied to the loop.

Now switch the dropdown to `-O3`. The loop body becomes:

```
movdqu (%rax), %xmm2
addq   $16, %rax
paddd  %xmm2, %xmm0
```

`movdqu` loads sixteen bytes — four `int`s — and `paddd` adds four pairs at
once. Below the loop you will find code to combine the four partial sums and to
handle the leftover elements when `n` is not a multiple of four. GCC enables
this at `-O3`; at `-O2` it uses a cost model that declines to pay the code-size
price.

## What the compiler will not do

This is the half that matters, because it is where your effort is not wasted.

**It will not reorder floating-point arithmetic.** Change `sum_array` to sum
`double`s and the `-O3` output stays scalar — `addsd`, one at a time. Vectorising
a sum means adding the elements in a different order, and floating-point
addition is not associative: `(a + b) + c` and `a + (b + c)` can give different
answers. The compiler will not change your results to make them faster unless
you say it may, with `-ffast-math` and its relatives, which is a decision with
correctness consequences and not one to take casually.

**It will not assume pointers do not overlap.** In

```cpp
void scale_into(int* dst, const int* src, int n) {
    for (int i = 0; i < n; ++i) dst[i] = src[i] * 2;
}
```

`dst` and `src` might be the same array, one element apart. The compiler emits a
run-time check comparing the two ranges and branches into a vectorised loop or a
scalar one — so you pay for the check, and for two copies of the loop. Telling
it otherwise (`int* __restrict dst`, a compiler extension) removes both. This is
the real reason `std::vector<T>` code sometimes underperforms a hand-written
loop over locals: the compiler cannot prove the vector's buffer is not aliased by
something else in scope.

**It will not remove anything observable.** I/O, `volatile` accesses, and calls
to functions it cannot see all stay, in order.

**It will not fix your algorithm.** Nothing in this chapter turns a quadratic
loop into a linear one. Constant factors are the compiler's department;
complexity is yours.

## Check yourself

:::quiz
{
  "question": "You time a loop at `-O0` and again at `-O2`, and the `-O2` version is a hundred times faster. What have you learned?",
  "options": [
    { "text": "Very little — `-O0` deliberately stores every local to memory, and the `-O2` version may have deleted the loop entirely", "correct": true, "why": "Both ends of the comparison are untrustworthy. `-O0` measures the debugger-friendly code nobody ships, and `-O2` may have eliminated the work because nothing observable depends on it." },
    { "text": "That the optimiser gives a 100× speedup on this kind of code", "why": "Only if the `-O2` loop still exists. Check the assembly before believing a ratio like this." },
    { "text": "That the code is memory-bound", "why": "Nothing here measures memory behaviour; the `-O0` stack traffic is an artefact of the mode, not of the algorithm." },
    { "text": "That you should ship at `-O0` for predictable timing", "why": "Predictably slow. `-O0` exists for debugging." }
  ]
}
:::

:::quiz
{
  "question": "Summing an array of `int` vectorises at `-O3`; summing an array of `double` does not. Why?",
  "options": [
    { "text": "Vectorising a sum changes the order of the additions, and floating-point addition is not associative — so the result could differ", "correct": true, "why": "The compiler will not silently change your answers. `-ffast-math` grants permission, and is a correctness decision, not a tuning knob." },
    { "text": "SIMD registers cannot hold doubles", "why": "They can — `addpd` adds two doubles at once, and appears as soon as reassociation is permitted." },
    { "text": "Floating-point addition is too slow to be worth vectorising", "why": "It is not; the cost model is not what stops it." },
    { "text": "`double` is 8 bytes, so only one fits in a register", "why": "A 128-bit SSE register holds two, and AVX holds four." }
  ]
}
:::

## Practice

:::exercise shift-arithmetic

:::exercise alias-aware-copy

:::recap
- Read assembly by looking for the mangled name, then the argument registers
  (`rdi`, `rsi`, …) and the return register (`rax`). AT&T syntax puts the
  destination last.
- `-O0` stores every local to memory so the debugger works. It is useless for
  measuring and misleading for reading.
- Constant folding, inlining, and dead-code elimination between them delete most
  of the work people try to hand-optimise. Inlining is the important one,
  because it is what lets the others see across function boundaries.
- Signed division by a power of two costs more instructions than unsigned,
  because C++ rounds towards zero and a shift does not.
- `-O3` adds vectorisation; `-O2` declines it on a cost model.
- The compiler will not reorder floating-point arithmetic, will not assume
  pointers do not alias, will not delete anything observable, and will not
  improve your algorithm. That is where your work goes.
:::
