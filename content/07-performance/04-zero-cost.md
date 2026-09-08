---
title: "Zero-cost abstraction, examined"
navTitle: "Zero-cost, examined"
summary: >-
  Which abstractions really are free, and which are not.
objectives:
  - Show that a range pipeline compiles to the same code as a loop
  - Identify an abstraction that does cost something
  - Explain what zero-cost does and does not promise
status: complete
standard: c++20
requires: [copies-and-moves]
---

The slogan comes from Stroustrup, and it is two claims, not one:

> What you don't use, you don't pay for. And what you do use, you couldn't hand
> code any better.

The first half is about *absence*: a C++ program that never throws pays nothing
for exceptions existing. The second is about *presence*: an abstraction you do
use should compile to what you would have written by hand.

Both claims are testable, and the honest answer is that the first is nearly
always true and the second is usually true — with a set of well-known exceptions
that are worth knowing by name. This chapter checks, rather than repeating the
slogan.

```cpp run asm title="Four abstractions, measured against the loop they replace"
#include <array>
#include <iostream>
#include <numeric>
#include <ranges>
#include <vector>

int by_index(const std::vector<int>& v) {
    int total = 0;
    for (std::size_t i = 0; i < v.size(); ++i) total += v[i];
    return total;
}

int by_range_for(const std::vector<int>& v) {
    int total = 0;
    for (int x : v) total += x;
    return total;
}

int by_accumulate(const std::vector<int>& v) {
    return std::accumulate(v.begin(), v.end(), 0);
}

long long squares_by_loop(const std::vector<int>& v) {
    long long total = 0;
    for (int x : v) total += x * x;
    return total;
}

long long squares_by_view(const std::vector<int>& v) {
    long long total = 0;
    for (int x : v | std::views::transform([](int n) { return n * n; })) total += x;
    return total;
}

int main() {
    std::vector<int> values{1, 2, 3, 4, 5};
    std::cout << by_index(values) << ' ' << by_range_for(values) << ' '
              << by_accumulate(values) << ' '
              << squares_by_loop(values) << ' ' << squares_by_view(values) << '\n';
}
```

Open the Assembly view at `-O2` and compare `_Z16squares_by_loop…` with
`_Z16squares_by_view…`. They are **instruction for instruction identical** —
same registers, same order, same branches. A `transform_view`, an iterator
wrapping an iterator, a lambda called through a `std::invoke` chain, all of it
collapses to the same fifteen instructions the raw loop produces.

`by_range_for` and `by_accumulate` differ by two instructions swapped and one
comparison written the other way round — the same code, scheduled differently.

The interesting one is `by_index`, the version with no abstraction at all. It is
**nineteen** instructions to the range-for's twelve: it computes the size by
subtracting the pointers and shifting, then indexes with a scaled address on
every iteration. The range-for just walks a pointer. Here the abstraction is not
merely free; it is what stopped you writing the slower thing.

## Free, verified

Two more that hold up:

```cpp run asm title="std::array against a C array"
#include <array>
#include <iostream>

int sum_c_array(const int (&a)[8]) {
    int total = 0;
    for (int i = 0; i < 8; ++i) total += a[i];
    return total;
}

int sum_std_array(const std::array<int, 8>& a) {
    int total = 0;
    for (int x : a) total += x;
    return total;
}

int main() {
    int raw[8]{1, 2, 3, 4, 5, 6, 7, 8};
    std::array<int, 8> wrapped{1, 2, 3, 4, 5, 6, 7, 8};
    std::cout << sum_c_array(raw) << ' ' << sum_std_array(wrapped) << '\n';
}
```

Identical, twelve instructions each — and `std::array` knows its own size, can be
returned from a function, and does not decay to a pointer. That one is a
straight win.

The general pattern behind every case that works: **the compiler can see the
whole thing.** The lambda's body, the iterator's `operator++`, the view's
`begin()` — all of them are in the header, all of them get inlined, and after
inlining the optimiser is looking at the same code you would have written. The
abstraction existed only at the level of the source text.

## Not free: three you should recognise

### `std::views::filter`

Change `transform` to `filter` in the first sample and the equivalence breaks.

```cpp run asm title="The pipeline that does not collapse"
#include <iostream>
#include <ranges>
#include <vector>

long long evens_by_loop(const std::vector<int>& v) {
    long long total = 0;
    for (int x : v)
        if (x % 2 == 0) total += x;
    return total;
}

long long evens_by_view(const std::vector<int>& v) {
    long long total = 0;
    for (int x : v | std::views::filter([](int n) { return n % 2 == 0; })) total += x;
    return total;
}

int main() {
    std::vector<int> values{1, 2, 3, 4, 5, 6};
    std::cout << evens_by_loop(values) << ' ' << evens_by_view(values) << '\n';
}
```

Sixteen instructions against **thirty-four**. Both are `O(n)` with one modulo
per element, and for most programs the difference is invisible — but "the same
code as the loop" is not what happened.

The reason is structural rather than a missed optimisation. `filter_view` must
present an iterator, and an iterator's `begin()` has to point at the first
element that *satisfies* the predicate — so `begin()` runs a search, and the
standard requires it to be amortised constant time, which means `filter_view`
caches the result. Advancing has to skip to the next satisfying element and stop
at the end, so the loop body carries two exit conditions where the hand-written
version carries one. There is genuinely more to do.

### `std::function`

`std::function` is 32 bytes on this implementation, against 8 for a raw
function pointer, and calling through one is an indirect call the compiler
cannot see past.

```cpp run asm title="The call the compiler cannot inline"
#include <functional>
#include <iostream>

// The compiler knows exactly which function this is.
template <class F>
int apply_template(F f, int x) { return f(x); }

// It does not know what is inside this one.
int apply_function(const std::function<int(int)>& f, int x) { return f(x); }

int main() {
    std::cout << "sizeof(std::function<int(int)>) = " << sizeof(std::function<int(int)>)
              << ", sizeof(int(*)(int)) = " << sizeof(int (*)(int)) << '\n';
    std::function<int(int)> triple = [](int n) { return n * 3; };
    std::cout << apply_template([](int n) { return n * 3; }, 14) << ' '
              << apply_function(triple, 14) << '\n';
}
```

Look at `_Z14apply_function…` in the assembly. Twenty instructions, and every
one of them is doing something the template version does not: spilling the
argument to the stack so its address can be passed, testing whether the
`std::function` is empty, an indirect `call *24(%rdi)` through the stored target
pointer, and a branch to `__throw_bad_function_call` for the empty case.

Now look at `main`. Neither call survives: there is no indirect `call` anywhere
in it, and the two results collapse into a single `movl $42`. In `main` the
compiler can see which lambda went into the `std::function`, so it devirtualises
the call, inlines the body, folds the arithmetic, and — since both expressions
come to the same value — emits the constant once. That is the rule stated exactly: **the abstraction is free
where the compiler can see through it, and costs where it cannot.** The same
rule that decided whether a virtual call survived in Chapter 5.8.

Use `std::function` when you need to store a callable of unknown type — that is
what it is for. Do not use it as a parameter type for a callback you are about
to call immediately; a template parameter costs nothing there.

### `std::shared_ptr`

16 bytes rather than 8, and the reference count is atomic. Copying one compiles
to roughly sixty instructions including two `lock`-prefixed read-modify-writes,
which are the expensive kind — they synchronise across cores whether or not your
program has more than one thread.

`std::unique_ptr` is the opposite: 8 bytes, exactly a raw pointer, and moving
one is a register copy. Chapter 4.7 argued for `unique_ptr` by default on
ownership grounds; this is the same advice arriving from the other direction.

## What zero-cost does not promise

Four things, none of which the slogan covers:

**Compile time.** Templates are instantiated per type, and the instantiation
happens in every translation unit that uses them. A heavily generic header can
cost seconds per file. This is a real cost, paid by every developer on every
build, and it does not show up in any runtime measurement.

**Binary size.** The same per-type instantiation puts one copy of the code in
the binary for each type used. Ten instantiations of a large template is ten
copies. Virtual dispatch compiles once.

**Debug builds.** Everything in this chapter was measured at `-O2`. At `-O0`,
none of it holds: every layer of an abstraction is a real function call with a
real stack frame, and a range pipeline can be an order of magnitude slower than
the loop. If your tests run in a debug build, the abstraction is not free
*there* — which matters if a test suite's runtime is what people complain about.

**Exceptions, exactly.** The "zero-cost" exception model means no instructions
execute on the non-throwing path — the unwinding information lives in tables
consulted only when a throw happens. What it costs instead is binary size (those
tables are typically 10–15% of the text section) and some optimisation freedom,
because the compiler must be able to unwind from anywhere a call might throw.
Throwing itself is very slow, hundreds of times the cost of a return. That is
fine, because exceptions are for exceptional cases, and stops being fine the
moment one appears in a loop.

:::tip
The practical version of all this: reach for the abstraction first. It is
usually free, it is often faster than the loop you would have written, and
Chapter 7.2 tells you how to find out when it is not. The cases in this chapter
are worth knowing not so you avoid them, but so that when the profiler points at
one you recognise it instead of concluding that C++ is slow.
:::

## Check yourself

:::quiz
{
  "question": "A `views::transform` pipeline compiles to exactly the loop's assembly, but a `views::filter` pipeline does not. What is the difference?",
  "options": [
    { "text": "`filter_view` has to search for the first satisfying element in `begin()` and cache it, and its iterator carries two exit conditions — there is genuinely more work, not a missed optimisation", "correct": true, "why": "`transform_view` applies a function per element and nothing else, so after inlining there is nothing left of it. `filter` has to do real bookkeeping to present an iterator interface." },
    { "text": "Lambdas passed to `filter` cannot be inlined", "why": "They are inlined — the predicate's body appears in the loop. The extra instructions are the view's own iteration logic." },
    { "text": "`filter` allocates", "why": "It does not; views own nothing beyond the range they adapt." },
    { "text": "The optimiser gives up on pipelines longer than one stage", "why": "It does not — `filter | transform` inlines completely too. It is still more instructions than the loop, for the same structural reason." }
  ]
}
:::

:::quiz
{
  "question": "In one function `std::function` costs twenty instructions and an indirect call; in `main` the same call folds to a single `mov`. Why?",
  "options": [
    { "text": "In `main` the compiler can see which lambda was stored, so it devirtualises and inlines; across a function boundary taking `const std::function&` it cannot", "correct": true, "why": "Exactly the rule from Chapter 5.8's devirtualization: type erasure costs where the concrete type is hidden, and costs nothing where it is visible." },
    { "text": "`main` is special-cased by the optimiser", "why": "It is an ordinary function. What is special is that the `std::function`'s construction and its call are both visible in it." },
    { "text": "`std::function` is only expensive at `-O0`", "why": "The twenty-instruction version *is* the `-O2` output. The cost is structural where the target is unknown." },
    { "text": "The lambda was stateless, so it was stored inline", "why": "Small-object storage avoids an allocation; it does not remove the indirect call when the target type is erased." }
  ]
}
:::

## Practice

:::exercise cheaper-callback

:::exercise pipeline-or-loop

:::recap
- "Zero-cost" is two claims: you do not pay for what you do not use, and what
  you use should compile to what you would have hand-written.
- Verified free on GCC at `-O2`: `std::array` against a C array, range-for
  against an index loop (the abstraction is *shorter*), `std::accumulate`, and a
  `views::transform` pipeline — instruction for instruction.
- Not free: `views::filter` (16 instructions become 34, for structural reasons),
  `std::function` as a parameter type (32 bytes, an emptiness check, an indirect
  call), and `std::shared_ptr` (16 bytes and two atomic operations per copy).
- The rule behind all of it: an abstraction is free exactly where the compiler
  can see through it. The same `std::function` call is free in one scope and
  twenty instructions in another.
- The slogan says nothing about compile time, binary size, debug-build speed, or
  the table size that "zero-cost" exceptions actually cost.
:::
