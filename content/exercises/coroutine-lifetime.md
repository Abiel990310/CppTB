---
id: coroutine-lifetime
title: "The frame outlives the call"
difficulty: stretch
chapter: coroutines
topics: [coroutines, lifetime, undefined-behaviour, raii]
check: unit
standard: c++20
---

Three lifetime bugs, all of them a consequence of the same fact: a coroutine's
frame is created when you call it and destroyed when *you* destroy it, which is
long after the call expression has finished.

1. `Words` never destroys its frame. Every generator created leaks it.
2. `Words` has no move constructor, and the compiler-generated copy would
   destroy the same frame twice.
3. `split` takes its text by `const std::string&`. The reference is stored in
   the frame; the argument may be gone before the coroutine runs a single line.

Fix all three. The checks count allocations, so a leak fails rather than merely
being untidy, and they pass a temporary to `split`, which the sanitizers catch
if the reference still dangles.

## Starter
```cpp
#include <coroutine>
#include <cstddef>
#include <cstdlib>
#include <exception>
#include <new>
#include <string>
#include <utility>
#include <vector>

// --- given, do not change: counts frames allocated and freed ----------
int live_allocations = 0;

void* operator new(std::size_t bytes) {
    ++live_allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { if (p) --live_allocations; std::free(p); }
void operator delete(void* p, std::size_t) noexcept { if (p) --live_allocations; std::free(p); }
// ----------------------------------------------------------------------

class Words {
public:
    struct promise_type {
        std::string current;
        Words get_return_object() {
            return Words{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(std::string value) {
            current = std::move(value);
            return {};
        }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Words(std::coroutine_handle<promise_type> handle) : handle_(handle) {}

    // 1. No destructor: the frame is never freed.
    // 2. No move constructor, so copying is what happens — and both copies
    //    would eventually destroy the same frame.

    bool next() { handle_.resume(); return !handle_.done(); }
    const std::string& value() const { return handle_.promise().current; }

private:
    std::coroutine_handle<promise_type> handle_;
};

// 3. The reference is stored in the frame and outlives its argument.
Words split(const std::string& text) {
    std::string word;
    for (char c : text) {
        if (c == ' ') {
            if (!word.empty()) co_yield word;
            word.clear();
        } else {
            word += c;
        }
    }
    if (!word.empty()) co_yield word;
}
```

## Tests
```cpp
// A generator over a temporary. The argument is gone by the time the body runs.
std::vector<std::string> words;
{
    Words w = split(std::string("the quick brown fox"));
    while (w.next()) words.push_back(w.value());
}
CHECK_EQ(words.size(), std::size_t{4});
CHECK_EQ(words[0], std::string("the"));
CHECK_EQ(words[3], std::string("fox"));

// Repeated leading, trailing and doubled spaces produce no empty words.
{
    std::vector<std::string> messy;
    Words w = split(std::string("  a   bb  "));
    while (w.next()) messy.push_back(w.value());
    CHECK_EQ(messy.size(), std::size_t{2});
    CHECK_EQ(messy[0], std::string("a"));
    CHECK_EQ(messy[1], std::string("bb"));
}

// Empty input yields nothing.
{
    Words w = split(std::string(""));
    CHECK(!w.next());
}

// The generator must be movable, and moving must not double-free.
{
    Words first = split(std::string("alpha beta"));
    Words second = std::move(first);
    CHECK(second.next());
    CHECK_EQ(second.value(), std::string("alpha"));
}

// And nothing may be left allocated. Every frame created above is destroyed
// by the time its Words goes out of scope.
int before = live_allocations;
for (int i = 0; i < 50; ++i) {
    Words w = split(std::string("one two three"));
    while (w.next()) { }
}
CHECK_EQ(live_allocations, before);
```

## Hints
- The destructor is `~Words() { if (handle_) handle_.destroy(); }`. The `if` matters: a moved-from `Words` holds a null handle.
- Add a move constructor that takes the handle and leaves the source null: `Words(Words&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}`. `std::exchange` is in `<utility>`.
- Delete the copy constructor and copy assignment. A `coroutine_handle` is a raw pointer to the frame; two `Words` holding the same one would destroy it twice.
- Declaring a destructor suppresses the implicit move operations, so the move constructor has to be written explicitly — the same rule of five from Chapter 3.5.
- For the parameter, change `const std::string&` to `std::string` by value. The frame then owns the characters and nothing can outlive them.
- `final_suspend` returning `suspend_always` is what keeps the frame alive after the body finishes, so `done()` can be asked. That is *why* you own the destruction.

## Solution
```cpp
#include <coroutine>
#include <cstddef>
#include <cstdlib>
#include <exception>
#include <new>
#include <string>
#include <utility>
#include <vector>

int live_allocations = 0;

void* operator new(std::size_t bytes) {
    ++live_allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { if (p) --live_allocations; std::free(p); }
void operator delete(void* p, std::size_t) noexcept { if (p) --live_allocations; std::free(p); }

class Words {
public:
    struct promise_type {
        std::string current;
        Words get_return_object() {
            return Words{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(std::string value) {
            current = std::move(value);
            return {};
        }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Words(std::coroutine_handle<promise_type> handle) : handle_(handle) {}

    ~Words() { if (handle_) handle_.destroy(); }

    Words(const Words&) = delete;
    Words& operator=(const Words&) = delete;

    Words(Words&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}
    Words& operator=(Words&& other) noexcept {
        if (this != &other) {
            if (handle_) handle_.destroy();
            handle_ = std::exchange(other.handle_, {});
        }
        return *this;
    }

    bool next() { handle_.resume(); return !handle_.done(); }
    const std::string& value() const { return handle_.promise().current; }

private:
    std::coroutine_handle<promise_type> handle_;
};

// By value: the frame owns the characters.
Words split(std::string text) {
    std::string word;
    for (char c : text) {
        if (c == ' ') {
            if (!word.empty()) co_yield word;
            word.clear();
        } else {
            word += c;
        }
    }
    if (!word.empty()) co_yield word;
}
```

## Notes
Every one of these is a lifetime bug, and none of them is new — they are
Chapter 3.2's RAII, Chapter 3.5's rule of five, and Chapter 2.4's dangling
reference, arriving at a type that did not exist when those chapters were
written.

**`std::coroutine_handle` is a raw pointer.** It has no destructor, no copy
semantics worth the name, and no ownership. Everything Part 3 says about owning a
raw resource applies to it exactly: wrap it, destroy it once, and make copying
either correct or impossible. The `Generator` types in this chapter are not
convenience wrappers; they are the only thing standing between you and a leak.

**A declared destructor suppresses the implicit moves.** That is why the starter
copies where it looks like it moves — and the copy is a shallow copy of a
pointer, so two `Words` objects end up owning the same frame and the second
destructor destroys it again. `std::exchange` in the move constructor is what
leaves the source holding a null handle, which is why the destructor's `if`
matters.

**The parameter bug is the one specific to coroutines**, and the one worth
memorising, because the usual intuition points the wrong way. `const
std::string&` is the right parameter type for an ordinary function that only
reads its argument — Chapter 7.5 spends a page arguing for it. For a coroutine it
is a trap, because the *call* returns almost immediately, the temporary is
destroyed at the end of that statement, and the body runs afterwards against a
reference to nothing. The starter's version is caught here by
AddressSanitizer as a `stack-use-after-scope`; in a build without sanitizers it
reads whatever now occupies that memory.

The rule is short: **coroutines take parameters by value.** Pay the copy. The
frame is a heap allocation anyway, and a dangling reference costs considerably
more than a `std::string` copy.

The allocation check is worth keeping in your own coroutine types. Fifty
generators created and destroyed must leave the counter exactly where it
started; a leak of one frame per call is invisible in a test that runs the
function once, and fatal in a server that runs it a million times.
