---
id: cheaper-callback
title: "The callback that allocates"
difficulty: core
chapter: zero-cost
topics: [performance, templates, type-erasure, allocation]
check: unit
standard: c++20
---

Three functions take a callback. All three declare the parameter as
`std::function`, and none of them needs to: each calls the callback immediately
and never stores it.

The cost is not theoretical. A `std::function` holding a lambda whose captures
do not fit in its small-object storage allocates on the heap, and these are
taken **by value**, so every call allocates again. The checks count allocations.

Change the parameter types so that no call allocates. Do not change what the
functions compute, and do not change the callbacks at the call sites.

## Starter
```cpp
#include <array>
#include <cstdlib>
#include <functional>
#include <new>
#include <string>
#include <vector>

// --- given, do not change: counts every heap allocation ---------------
int allocations = 0;

void* operator new(std::size_t bytes) {
    ++allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
// ----------------------------------------------------------------------

int sum_mapped(const std::vector<int>& values, std::function<int(int)> f) {
    int total = 0;
    for (int x : values) total += f(x);
    return total;
}

int count_where(const std::vector<int>& values, std::function<bool(int)> pred) {
    int n = 0;
    for (int x : values)
        if (pred(x)) ++n;
    return n;
}

void for_each_index(int count, std::function<void(int)> body) {
    for (int i = 0; i < count; ++i) body(i);
}
```

## Tests
```cpp
std::vector<int> values{1, 2, 3, 4, 5};

// A callback with a big capture: 64 bytes of table, far too much to store
// inside a std::function.
std::array<long, 8> table{1, 2, 3, 4, 5, 6, 7, 8};

allocations = 0;
int mapped = sum_mapped(values, [table](int n) { return n * int(table[n % 8]); });
int mapped_allocations = allocations;
CHECK_EQ(mapped, 70);
CHECK_EQ(mapped_allocations, 0);

allocations = 0;
int counted = count_where(values, [table](int n) { return table[n % 8] > 2; });
int counted_allocations = allocations;
CHECK_EQ(counted, 4);
CHECK_EQ(counted_allocations, 0);

allocations = 0;
int accumulated = 0;
for_each_index(4, [table, &accumulated](int i) { accumulated += int(table[i]); });
int each_allocations = allocations;
CHECK_EQ(accumulated, 10);
CHECK_EQ(each_allocations, 0);

// Small callbacks must keep working too.
allocations = 0;
CHECK_EQ(sum_mapped(values, [](int n) { return n * 2; }), 30);
CHECK_EQ(count_where(values, [](int n) { return n % 2 == 0; }), 2);
CHECK_EQ(allocations, 0);

// And a plain function pointer, which is not a lambda at all.
CHECK_EQ(count_where(values, +[](int n) { return n > 3; }), 2);
```

## Hints
- The parameter does not need to hold *any* callable type — it needs to hold *the one* the caller passed. That is a template parameter, not a type-erased wrapper.
- `template <class F> int sum_mapped(const std::vector<int>& values, F f)` deduces `F` as the lambda's own closure type, so there is nothing to erase and nothing to allocate.
- Taking `F` by value is fine here: a lambda's closure is usually a few bytes, and copying it is copying its captures. `const F&` also works.
- Nothing else in the bodies changes. `f(x)`, `pred(x)`, and `body(i)` all still compile.
- If you want the parameter to document what it accepts, constrain it: `std::invocable<int>` from `<concepts>`, or `requires { { f(0) } -> std::convertible_to<int>; }`.
- The last check passes a function pointer. A template parameter accepts that as readily as a lambda; a `std::function` would too, so this check is there to make sure you did not narrow the interface.

## Solution
```cpp
#include <array>
#include <cstdlib>
#include <new>
#include <string>
#include <vector>

int allocations = 0;

void* operator new(std::size_t bytes) {
    ++allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }

template <class F>
int sum_mapped(const std::vector<int>& values, F f) {
    int total = 0;
    for (int x : values) total += f(x);
    return total;
}

template <class Pred>
int count_where(const std::vector<int>& values, Pred pred) {
    int n = 0;
    for (int x : values)
        if (pred(x)) ++n;
    return n;
}

template <class Body>
void for_each_index(int count, Body body) {
    for (int i = 0; i < count; ++i) body(i);
}
```

## Notes
One word per signature, and the allocations go away — but the allocation is the
smaller half of what changed.

`std::function` is *type erasure*: it stores any callable behind a uniform
interface, which means the concrete type is gone by the time the body calls it.
So the call is indirect, it cannot be inlined, and everything the inliner would
have done afterwards does not happen. A template parameter keeps the closure
type, so `f(x)` is a direct call to a function whose body the compiler can see,
and after inlining the loop is what you would have written by hand.

The allocation is a second, separate cost, and it depends on the capture. On
this implementation `std::function` is 32 bytes and stores small callables
inside itself; the stateless `[](int n) { return n * 2; }` fits and allocates
nothing, while `[table]` — 64 bytes of `std::array` — does not fit and goes to
the heap. That is why the checks use a big capture: with a small one, the
starter passes the allocation checks and is still doing an indirect call per
element.

None of this makes `std::function` a bad type. It is the right answer when you
must *store* a callable of a type not known at compile time — a vector of
handlers, a member holding a user-supplied callback, a queue of deferred work.
It is the wrong answer for a parameter you are about to call and then forget,
which is what these three functions do. The rule is the same one Chapter 5.8
gave for virtual functions: pay for erasure when the type is genuinely unknown,
not when you simply did not write the template parameter.
