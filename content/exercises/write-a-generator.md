---
id: write-a-generator
title: "Three lazy sequences"
difficulty: core
chapter: coroutines
topics: [coroutines, generators, laziness]
check: unit
standard: c++20
---

`Generator<T>` is given: a working promise type, a handle wrapper, and
`next()`/`value()`. Your job is the easy half — three coroutines that use it.

- `running_totals(values)` — yields the running sum after each element.
  `{3, 1, 4}` yields `3`, `4`, `8`.
- `powers_of_two()` — yields 1, 2, 4, 8, … and never ends. It must not compute
  anything the caller does not ask for.
- `evens(limit)` — yields the even numbers from 0 up to but not including
  `limit`.

Each is two or three lines. The point is what they do *not* need: no state
struct, no iterator class, no bounds bookkeeping.

## Starter
```cpp
#include <coroutine>
#include <cstddef>
#include <exception>
#include <utility>
#include <vector>

// --- given, do not change ---------------------------------------------
template <class T>
class Generator {
public:
    struct promise_type {
        T current{};
        Generator get_return_object() {
            return Generator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(T value) { current = std::move(value); return {}; }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Generator(std::coroutine_handle<promise_type> handle) : handle_(handle) {}
    ~Generator() { if (handle_) handle_.destroy(); }
    Generator(const Generator&) = delete;
    Generator& operator=(const Generator&) = delete;
    Generator(Generator&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}

    bool next() { handle_.resume(); return !handle_.done(); }
    const T& value() const { return handle_.promise().current; }

private:
    std::coroutine_handle<promise_type> handle_;
};
// ----------------------------------------------------------------------

Generator<int> running_totals(std::vector<int> values) {
    co_return;                       // yields nothing
}

Generator<long long> powers_of_two() {
    co_return;
}

Generator<int> evens(int limit) {
    co_return;
}
```

## Tests
```cpp
// running_totals
std::vector<int> totals;
{
    Generator<int> g = running_totals({3, 1, 4, 1, 5});
    while (g.next()) totals.push_back(g.value());
}
CHECK_EQ(totals.size(), std::size_t{5});
CHECK_EQ(totals[0], 3);
CHECK_EQ(totals[1], 4);
CHECK_EQ(totals[2], 8);
CHECK_EQ(totals[3], 9);
CHECK_EQ(totals[4], 14);

// An empty input yields nothing at all.
{
    Generator<int> g = running_totals({});
    CHECK(!g.next());
}

// Negative values must still accumulate correctly.
std::vector<int> mixed;
{
    Generator<int> g = running_totals({5, -3, -4});
    while (g.next()) mixed.push_back(g.value());
}
CHECK_EQ(mixed.size(), std::size_t{3});
CHECK_EQ(mixed[0], 5);
CHECK_EQ(mixed[1], 2);
CHECK_EQ(mixed[2], -2);

// powers_of_two is unbounded: taking eight must not compute a ninth,
// and must not overflow by running to completion.
std::vector<long long> powers;
{
    Generator<long long> g = powers_of_two();
    for (int i = 0; i < 8; ++i) { g.next(); powers.push_back(g.value()); }
}
CHECK_EQ(powers.size(), std::size_t{8});
CHECK_EQ(powers[0], 1LL);
CHECK_EQ(powers[7], 128LL);

// Taking sixty-two is still fine — a lazy sequence costs only what is drawn.
{
    Generator<long long> g = powers_of_two();
    long long last = 0;
    for (int i = 0; i < 62; ++i) { g.next(); last = g.value(); }
    CHECK_EQ(last, 1LL << 61);
}

// evens
std::vector<int> even_numbers;
{
    Generator<int> g = evens(10);
    while (g.next()) even_numbers.push_back(g.value());
}
CHECK_EQ(even_numbers.size(), std::size_t{5});
CHECK_EQ(even_numbers[0], 0);
CHECK_EQ(even_numbers[4], 8);

{
    Generator<int> g = evens(1);
    CHECK(g.next());
    CHECK_EQ(g.value(), 0);
    CHECK(!g.next());
}
{
    Generator<int> g = evens(0);
    CHECK(!g.next());
}
```

## Hints
- `co_yield value;` is all it takes to produce one element and suspend. Control returns to whoever called `next()`.
- `running_totals` needs one local accumulator and a range-for over `values`. The accumulator lives across the suspensions, so it goes in the frame — you do not have to do anything for that to happen.
- Note that `running_totals` takes its vector **by value**. Leave it that way: a coroutine's parameters are copied into the frame, and a reference would dangle.
- `powers_of_two` is `while (true)` with a `co_yield` in it. That is not an infinite loop, because it suspends at every iteration and only continues when asked.
- Do not add a `co_return` at the end of a generator that already falls off the end of its body — `return_void()` handles it.
- `evens(limit)` should yield nothing when `limit` is 0 or negative, which a `for (int i = 0; i < limit; i += 2)` already does.

## Solution
```cpp
#include <coroutine>
#include <cstddef>
#include <exception>
#include <utility>
#include <vector>

template <class T>
class Generator {
public:
    struct promise_type {
        T current{};
        Generator get_return_object() {
            return Generator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(T value) { current = std::move(value); return {}; }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Generator(std::coroutine_handle<promise_type> handle) : handle_(handle) {}
    ~Generator() { if (handle_) handle_.destroy(); }
    Generator(const Generator&) = delete;
    Generator& operator=(const Generator&) = delete;
    Generator(Generator&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}

    bool next() { handle_.resume(); return !handle_.done(); }
    const T& value() const { return handle_.promise().current; }

private:
    std::coroutine_handle<promise_type> handle_;
};

Generator<int> running_totals(std::vector<int> values) {
    int total = 0;
    for (int value : values) {
        total += value;
        co_yield total;
    }
}

Generator<long long> powers_of_two() {
    long long value = 1;
    while (true) {
        co_yield value;
        value *= 2;
    }
}

Generator<int> evens(int limit) {
    for (int i = 0; i < limit; i += 2) co_yield i;
}
```

## Notes
Three functions, seven lines of logic, and none of them mentions state.

Compare `powers_of_two` with the equivalent iterator. To write that by hand you
would declare a class, give it a `long long` member, write `operator*`,
`operator++`, `operator==`, an end sentinel, and the five iterator typedefs — and
every one of those pieces exists only to remember *where you were*. The
coroutine remembers by suspending, and the state is just a local variable.

That is the whole value proposition: the compiler turns your straight-line code
into the state machine you would otherwise write out.

`powers_of_two` is worth staring at. `while (true)` with no exit is not a hang,
because `co_yield` suspends and returns control to the caller; the loop advances
only when someone calls `next()`. Drawing 62 values costs 62 iterations and
nothing more — laziness that falls out of the mechanism rather than being
designed in. The same sequence as a `std::vector` would need a length decided
up front, and as a range view would need a `views::iota` and a `transform`.

Two details that are easy to get wrong and that the checks catch:

**Where `co_yield` goes relative to the update.** `powers_of_two` yields `value`
and *then* multiplies, so the first value drawn is 1. Multiply first and the
sequence starts at 2 — off by one, in a function too short to hide it.

**Yielding nothing at all.** `evens(0)` and `running_totals({})` never reach a
`co_yield`, run to the end of the body, and finish. The first `next()` resumes
the coroutine from its initial suspension, the body runs to completion, and
`done()` is true — so `next()` returns `false` and the caller's `while` loop does
not execute. Nothing special is needed for the empty case, which is worth
noticing precisely because so many hand-written iterators get it wrong.

One thing this `Generator` deliberately lacks: `begin()` and `end()`, which
would let it work with a range-for. Adding them is about twenty lines of
iterator boilerplate — the boilerplate the coroutine saved you inside the
function, reappearing at its interface. C++23's `std::generator` has it, and is
the reason to use that instead as soon as your compiler has it.
