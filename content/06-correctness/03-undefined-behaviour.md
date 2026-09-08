---
title: "Undefined behaviour"
navTitle: "Undefined behaviour"
summary: >-
  The contract you did not know you signed, and how the optimizer uses it.
objectives:
  - List the common sources of undefined behaviour
  - Explain how UB can make code disappear
  - Use sanitizers to catch UB before your users do
status: complete
standard: c++20
requires: [pointers, lifetime-and-scope, arrays-and-decay]
---

Every sample in this book compiles with AddressSanitizer and
UndefinedBehaviorSanitizer switched on. You have seen them fire a dozen times.
This chapter explains what they are catching, what they cannot catch, and why
the language has this category at all.

## What the words mean

The standard sorts bad situations into three kinds, and they are not
interchangeable.

- **Implementation-defined**: the implementation must choose and document a
  behaviour. `sizeof(int)` is 4 on your machine, and your compiler says so.
- **Unspecified**: the implementation chooses from a set of valid behaviours and
  need not tell you. The order in which function arguments are evaluated, for
  instance.
- **Undefined**: the standard imposes **no requirements at all**. Not "returns
  garbage", not "crashes" — no requirements.

That last one is stronger than it sounds. A program with undefined behaviour
anywhere in it has no defined meaning *as a whole*, and the compiler is entitled
to assume it never happens.

## The compiler assumes you did not do it

This is the part that surprises people. UB is not a run-time event the compiler
guards against; it is a *premise the optimizer reasons from*.

```cpp asm run title="An assumption you did not know you made" std=c++20
#include <climits>

// If x + 1 overflows, that is UB — so the compiler may assume it never does.
// And if it never does, then x + 1 > x is always true.
bool always_true(int x) {
    return x + 1 > x;
}

int main() { return always_true(INT_MAX) ? 0 : 1; } // [hidden]
```

Press **Assembly** and switch to `-O2`. The function does not add anything and
does not compare anything — it returns 1 unconditionally. The compiler reasoned:
signed overflow is undefined, therefore it cannot happen, therefore `x + 1` is
always greater than `x`.

For every input where you would want an answer, that reasoning is correct. For
`INT_MAX` it produces a function that disagrees with arithmetic. Both are
allowed, because you promised not to pass `INT_MAX`.

The same reasoning removes null checks:

```cpp asm run title="A check the compiler deletes" std=c++20
int deref_then_check(int* p) {
    const int value = *p;      // if p were null, this is already UB
    if (p == nullptr) {        // ...so p cannot be null, so this is dead code
        return -1;
    }
    return value;
}

int main() { int x = 5; return deref_then_check(&x); } // [hidden]
```

At `-O2` the comparison is gone. Dereferencing `p` promised it was not null, so
the check that follows can only ever be false. Writing the check *after* the
dereference is a common mistake in code that has been edited over time, and the
result is that the safety check silently stops existing.

:::warning
This is why "it worked in debug" is not evidence. `-O0` often evaluates your
code the way you expected; `-O2` uses the assumptions. A bug that only appears
in release builds is very often UB that the optimizer has finally exploited.
:::

## The common sources

The list is long, but a handful account for nearly everything you will hit.

### Out-of-bounds access

```cpp run expect-ub title="Past the end" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};
    std::cout << "v[5] = " << v[5] << '\n';    // no bounds check, ever
}
```

`operator[]` does not check. `at()` does, and throws. Chapter 2.6 covered the
array case; the sanitizer names the allocation and the offset.

### Use after free, and after return

```cpp run expect-ub title="Reading storage that is gone" std=c++20
#include <iostream>
#include <memory>

int main() {
    auto owner = std::make_unique<int>(42);
    int* observer = owner.get();

    owner.reset();                     // the int is destroyed here

    std::cout << "reading it anyway: " << *observer << '\n';
}
```

### Uninitialised reads

```cpp run title="A value that was never written" std=c++20
#include <iostream>

int main() {
    int values[4];
    int total = 0;
    for (int i = 0; i < 4; ++i) total += values[i];   // reading indeterminate values

    std::cout << "total: " << total << '\n';
    std::cout << "(no sanitizer complained — see below)\n";
}
```

That one is undefined, and **neither sanitizer said a word.** ASan tracks memory
that is out of bounds or freed; these bytes are neither. Catching uninitialised
reads at run time is MemorySanitizer's job, and MSan is Clang-only and requires
every library it touches to be rebuilt with it — which is why it is rarely used.
Your defence here is `-Wall`, which catches the cases visible within one
function, and initialising at the point of declaration.

### Signed overflow

```cpp run expect-ub title="One past the maximum" std=c++20
#include <climits>
#include <iostream>

int main() {
    int big = INT_MAX;
    std::cout << "INT_MAX     = " << big << '\n';
    std::cout << "INT_MAX + 1 = " << big + 1 << '\n';   // undefined
}
```

Unsigned overflow is *defined* — it wraps modulo 2ⁿ. Signed overflow is not, and
that asymmetry is deliberate: it lets the compiler assume loop counters do not
wrap, which enables a great deal of optimisation.

### Invalid shifts, and division by zero

```cpp run expect-ub title="Shifting too far" std=c++20
#include <iostream>

int main() {
    int value = 1;
    int shift = 32;                     // int is 32 bits: shifting by 32 is UB
    std::cout << "1 << 32 = " << (value << shift) << '\n';
}
```

Shifting by an amount greater than or equal to the width of the type is
undefined, as is shifting a negative value left. Integer division by zero is
undefined too — note that *floating-point* division by zero is not, and gives
you `inf`.

### Lifetime and aliasing

Dangling references (Chapter 2.4), reading an object through a pointer to an
unrelated type, and modifying an object twice in one expression without
sequencing all belong here.

## What the sanitizers catch

Run the samples above and a pattern emerges. Some UB is reported precisely, and
some passes in silence.

| Kind of UB | Caught by |
|---|---|
| Out-of-bounds read or write | AddressSanitizer |
| Use after free, use after return | AddressSanitizer |
| Memory leak | LeakSanitizer (part of ASan) |
| Signed overflow, bad shift, division by zero | UndefinedBehaviorSanitizer |
| Null dereference, misaligned access | UndefinedBehaviorSanitizer |
| Data race | ThreadSanitizer (separate, Part 8) |
| **Uninitialised read** | MemorySanitizer only — rarely available |
| **Reading the wrong union member** | nothing |
| **Most logic errors that happen to be UB-free** | nothing |

The two bolded rows are the reason sanitizers are a net, not a proof. This
session's own writing produced three examples where a genuine bug passed
silently: an uninitialised read printing a plausible `0`, a self-assignment that
quietly replaced data with garbage, and 200 leaked file handles that
LeakSanitizer ignored because the C runtime still held them on a list.

:::tip
Run them anyway, and run them in CI. Turning on
`-fsanitize=address,undefined -fno-omit-frame-pointer -g` costs roughly 2× run
time and finds bugs that would otherwise reach production. The cost of *not*
running them is measured in incident reports.
:::

```bash title="What this book compiles with"
g++ -std=c++20 -Wall -Wextra -fsanitize=address,undefined \
    -fno-omit-frame-pointer -g -o program main.cpp
```

## Reading a sanitizer report

```cpp run expect-ub title="A report worth reading closely" std=c++20
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> v(4, 7);
    std::printf("about to read past the end\n");
    std::printf("v[9] = %d\n", v[9]);
}
```

The important lines are the first and the last. The first names the **kind** of
error and the address — `heap-buffer-overflow` here. The last section says where
the memory came from: which allocation, how large it was, and how far past it
you went. Between them is the stack trace of the access.

When a trace shows only addresses rather than function names, the binary was
built without `-g`. Add it — the whole value of the report is in the names.

## Defending against it

In rough order of how much they buy you:

1. **Use the types that make it impossible.** `std::vector` over raw arrays,
   `std::unique_ptr` over `new`/`delete`, `std::string` over `char*`,
   `std::optional` over sentinels. Every one of them removes a class of UB by
   construction, and that is the real argument for Parts 3 and 4.
2. **Turn on warnings.** `-Wall -Wextra` catches uninitialised reads, unused
   results, and sign-comparison mistakes within a function.
3. **Run the sanitizers in CI**, not just locally.
4. **Prefer checked accessors at boundaries.** `at()` where the index came from
   outside; `operator[]` in a loop you control.
5. **Compile with `-fwrapv` if you genuinely need wrapping** signed arithmetic.
   It makes signed overflow defined at the cost of some optimisation, which is
   a fair trade when the alternative is being wrong.

:::note
`-fwrapv` and `-ftrapv` are worth knowing about but are not a substitute for
correctness. `-fwrapv` defines overflow as wrapping; `-ftrapv` traps on it. Both
change what your program means, so they belong in a considered decision, not
sprinkled on to silence a sanitizer.
:::

## Check yourself

:::quiz
{
  "question": "Why can the compiler delete `if (p == nullptr) return -1;` when it follows `int v = *p;`?",
  "options": [
    { "text": "Because the optimizer proves p is non-null from the caller", "why": "It usually cannot see the caller at all. The reasoning is local and needs no caller information." },
    { "text": "Because dereferencing p is undefined if p is null, so the compiler may assume p is not null — making the check always false", "correct": true, "why": "Exactly. UB is a premise, not a run-time event: the dereference promises non-null, so any later check for null is dead code. This is how safety checks silently disappear when code is reordered during editing." },
    { "text": "Because comparing a pointer to nullptr is undefined behaviour", "why": "That comparison is entirely well defined. The dereference before it is what licenses the assumption." },
    { "text": "It cannot — that would be a compiler bug", "why": "It is standard-conforming and widely done. The assembly at -O2 shows the comparison gone." }
  ]
}
:::

:::quiz
{
  "question": "Your program passes with `-fsanitize=address,undefined`. What has that established?",
  "options": [
    { "text": "The program is free of undefined behaviour", "why": "The sanitizers instrument specific categories. Uninitialised reads, wrong-union-member reads, and data races (without TSan) all pass silently." },
    { "text": "No UB of the kinds those two sanitizers instrument occurred on the inputs you ran", "correct": true, "why": "Both qualifiers matter. They are dynamic tools, so unexercised paths are unchecked, and their coverage has real gaps — an uninitialised read is the common one." },
    { "text": "The program has no memory leaks", "why": "LeakSanitizer catches unreachable allocations, but a leaked file handle or a still-reachable allocation is reported by nothing." },
    { "text": "The program will behave identically at -O2", "why": "Sanitizer builds typically run at low optimisation. UB that the optimizer exploits may only appear at -O2, which is why release-only bugs are so often UB." }
  ]
}
:::

## Practice

:::exercise find-the-ub

:::exercise checked-access

:::recap
- Undefined behaviour means the standard imposes **no requirements**. It is not
  "garbage in, garbage out" — the whole program loses its meaning.
- The optimizer treats UB as a premise. It will delete null checks and overflow
  tests because you promised they could never be true.
- "It worked in debug" is not evidence; release-only bugs are very often UB.
- The frequent sources: out-of-bounds access, use after free or return,
  uninitialised reads, signed overflow, bad shifts, dangling references.
- Sanitizers are a net, not a proof. ASan and UBSan miss uninitialised reads
  entirely, and they only see the paths you actually run.
- The strongest defence is using types that make the mistake unrepresentable —
  which is what most of this book has been about.
:::
