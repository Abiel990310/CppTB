---
title: "Coroutines"
navTitle: "Coroutines"
summary: >-
  Functions that suspend and resume, and what the compiler generates.
objectives:
  - Explain what co_await transforms a function into
  - Write a simple generator coroutine
  - Describe where the coroutine frame is allocated
status: complete
standard: c++20
requires: [futures-and-tasks]
---

Every function so far has run to completion once called. A **coroutine** can
stop in the middle, hand control back, and be resumed later with all its local
variables intact.

A function becomes a coroutine by containing `co_await`, `co_yield` or
`co_return`. Nothing in its signature says so — the body decides, and the
compiler rewrites the whole function around it.

:::warning
C++20 shipped the *language* machinery for coroutines and almost none of the
library types that make them usable. `std::generator` arrived in C++23 and is
not in GCC 13, which is what runs the samples on this page, so the first thing
here is a generator written by hand. That is a fair reflection of what using
coroutines in C++20 is like: you write the plumbing, or you take a library
(cppcoro, libcoro, Asio) that already did.
:::

## A generator, by hand

```cpp run title="Yielding values one at a time"
#include <coroutine>
#include <cstdio>
#include <exception>
#include <utility>

template <class T>
class Generator {
public:
    // The compiler looks for this exact nested name.
    struct promise_type {
        T current;

        Generator get_return_object() {
            return Generator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }          // start suspended
        std::suspend_always final_suspend() noexcept { return {}; }   // stay alive at the end
        std::suspend_always yield_value(T value) {                    // what co_yield calls
            current = std::move(value);
            return {};
        }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Generator(std::coroutine_handle<promise_type> handle) : handle_(handle) {}
    ~Generator() { if (handle_) handle_.destroy(); }                  // frees the frame

    Generator(const Generator&) = delete;
    Generator& operator=(const Generator&) = delete;
    Generator(Generator&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}

    bool next() { handle_.resume(); return !handle_.done(); }
    T value() const { return handle_.promise().current; }

private:
    std::coroutine_handle<promise_type> handle_;
};

Generator<int> counted(int limit) {
    for (int i = 0; i < limit; ++i) co_yield i;
}

Generator<long long> fibonacci() {          // no end at all
    long long a = 0, b = 1;
    while (true) {
        co_yield a;
        long long next = a + b;
        a = b;
        b = next;
    }
}

int main() {
    Generator<int> counter = counted(4);
    std::printf("counted:");
    while (counter.next()) std::printf(" %d", counter.value());
    std::printf("\n");

    Generator<long long> fibs = fibonacci();
    std::printf("first ten fibonacci:");
    for (int i = 0; i < 10; ++i) { fibs.next(); std::printf(" %lld", fibs.value()); }
    std::printf("\n");
}
```

`fibonacci` contains `while (true)` and no exit. It is not an infinite loop
because it suspends at every `co_yield` and only continues when someone asks for
the next value. Laziness for free — the same property Chapter 7.4 measured for
range views, obtained from the language rather than from a library.

## What the compiler generated

`counted` looks like a function returning `Generator<int>`. It is not: no
`return` statement appears in it, and `co_yield` is not a keyword any ordinary
function may contain. What the compiler actually built is roughly this:

1. **Find the promise type.** Look at the declared return type `Generator<int>`
   for a nested `promise_type`. Everything else follows from it.
2. **Allocate a frame.** A block of storage holding the parameters, every local
   that lives across a suspension, the promise object, and an index recording
   where in the function to resume.
3. **Construct the promise** in the frame, and call `get_return_object()` — that
   is what the caller receives.
4. **`co_await promise.initial_suspend()`**, before running any of your code.
   `suspend_always` here is what makes the generator lazy.
5. **Run the body** until a suspension point. Each `co_yield v` becomes
   `co_await promise.yield_value(v)`.
6. **`co_await promise.final_suspend()`** at the end. Returning `suspend_always`
   keeps the frame alive so the caller can ask `done()`; it also means *you* are
   responsible for destroying it, which is what the `Generator` destructor does.

A `std::coroutine_handle` is the address of that frame with a type attached. It
is a raw handle in the same sense a pointer is: `resume()` on a finished
coroutine, or on a destroyed one, is undefined behaviour, and forgetting
`destroy()` leaks the frame. Wrapping it in an RAII type — which is all
`Generator` is — is not optional.

## What `co_await` actually does

`co_await expr` is three function calls on the awaited object.

```cpp run title="The three hooks, traced"
#include <coroutine>
#include <cstdio>
#include <exception>
#include <utility>

struct Task {
    struct promise_type {
        Task get_return_object() { return Task{std::coroutine_handle<promise_type>::from_promise(*this)}; }
        std::suspend_never initial_suspend() { return {}; }      // start running immediately
        std::suspend_always final_suspend() noexcept { return {}; }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };

    explicit Task(std::coroutine_handle<promise_type> handle) : handle_(handle) {}
    ~Task() { if (handle_) handle_.destroy(); }
    Task(Task&& other) noexcept : handle_(std::exchange(other.handle_, {})) {}

    bool done() const { return handle_.done(); }
    void resume() { handle_.resume(); }

private:
    std::coroutine_handle<promise_type> handle_;
};

// An awaitable that has its answer already.
struct Ready {
    int value;
    bool await_ready() const noexcept { std::printf("  await_ready -> true\n"); return true; }
    void await_suspend(std::coroutine_handle<>) const noexcept {}
    int await_resume() const noexcept { std::printf("  await_resume -> %d\n", value); return value; }
};

// One that suspends, handing the handle to whoever will resume it later.
struct Pause {
    bool await_ready() const noexcept { std::printf("  await_ready -> false\n"); return false; }
    void await_suspend(std::coroutine_handle<>) const noexcept { std::printf("  await_suspend: parked\n"); }
    void await_resume() const noexcept { std::printf("  await_resume: carrying on\n"); }
};

Task demo() {
    std::printf("coroutine started\n");
    int a = co_await Ready{40};
    co_await Pause{};
    int b = co_await Ready{2};
    std::printf("coroutine finished with %d\n", a + b);
}

int main() {
    Task task = demo();
    std::printf("back in main, done = %d\n", int(task.done()));
    task.resume();
    std::printf("back in main, done = %d\n", int(task.done()));
}
```

The protocol:

- **`await_ready()`** — is the result already available? `true` means do not
  suspend at all, which is how an awaitable avoids paying for suspension when it
  does not need to.
- **`await_suspend(handle)`** — called only if `await_ready()` said no. The
  coroutine is now suspended and you have been handed its handle. Store it
  somewhere that will `resume()` it: an event loop, an I/O completion callback,
  another thread. Returning `void` means "stay suspended and return to the
  caller".
- **`await_resume()`** — called when execution continues, and its return value
  is what `co_await expr` evaluates to.

That is the whole of the asynchrony story. Every async framework built on
coroutines is `await_suspend` handing the handle to something that will call
`resume()` later.

Notice the ordering in the output: `main` regains control at the `Pause`, prints
its line, and only then does the second half of the coroutine run. One thread,
two interleaved call stacks.

## Where the frame lives

The frame is heap-allocated, and you can measure it.

```cpp run title="One allocation, sized by the locals"
#include <coroutine>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <new>
#include <utility>

int allocations = 0;
std::size_t bytes = 0;

void* operator new(std::size_t n) {
    ++allocations;
    bytes += n;
    void* p = std::malloc(n ? n : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }

struct Counter {
    struct promise_type {
        int current = 0;
        Counter get_return_object() { return Counter{std::coroutine_handle<promise_type>::from_promise(*this)}; }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(int v) { current = v; return {}; }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };
    explicit Counter(std::coroutine_handle<promise_type> h) : handle_(h) {}
    ~Counter() { if (handle_) handle_.destroy(); }
    Counter(Counter&& o) noexcept : handle_(std::exchange(o.handle_, {})) {}
    bool next() { handle_.resume(); return !handle_.done(); }
private:
    std::coroutine_handle<promise_type> handle_;
};

Counter small() { co_yield 1; co_yield 2; }

Counter large() {
    char scratch[4096]{};          // a local that lives across a suspension
    scratch[0] = 1;
    for (int i = 0; i < 3; ++i) co_yield i + scratch[0];
}

int main() {
    allocations = 0; bytes = 0;
    { Counter c = small(); while (c.next()) {} }
    std::printf("small coroutine: %d allocation, %zu bytes\n", allocations, bytes);

    allocations = 0; bytes = 0;
    { Counter c = large(); while (c.next()) {} }
    std::printf("large coroutine: %d allocation, %zu bytes\n", allocations, bytes);
}
```

One allocation each: 40 bytes for the small one, 4,144 for the one with a 4 KB
local. The frame holds exactly what has to survive a suspension — parameters,
the promise, the resume index, and the locals whose lifetimes cross a
`co_yield`. A local used entirely between two suspension points can live on the
ordinary stack.

The allocation goes through `operator new` — the global one, or a member
`operator new` on the promise type if you provide one, which is the hook for a
pool allocator.

:::standards
The standard permits the compiler to elide the allocation entirely when it can
prove the frame does not outlive the caller — **HALO**, coroutine heap
allocation elision. It requires the coroutine to be inlined into its caller and
the handle never to escape. Neither generator above qualifies: both hand a
handle back to `main` inside a `Generator`. Elision does happen for the common
`co_await` of an immediately-consumed task, but it is an optimisation, not a
guarantee, and code whose performance depends on it is fragile.
:::

## The parameter trap

Coroutine parameters are **copied into the frame**. A reference parameter copies
the *reference*, not the referent — and the frame outlives the call expression.

```cpp run expect-ub title="A reference parameter that outlives its argument"
#include <coroutine>
#include <cstdio>
#include <exception>
#include <string>
#include <utility>

struct Letters {
    struct promise_type {
        char current = 0;
        Letters get_return_object() { return Letters{std::coroutine_handle<promise_type>::from_promise(*this)}; }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(char c) { current = c; return {}; }
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };
    explicit Letters(std::coroutine_handle<promise_type> h) : handle_(h) {}
    ~Letters() { if (handle_) handle_.destroy(); }
    Letters(Letters&& o) noexcept : handle_(std::exchange(o.handle_, {})) {}
    bool next() { handle_.resume(); return !handle_.done(); }
    char value() const { return handle_.promise().current; }
private:
    std::coroutine_handle<promise_type> handle_;
};

Letters letters(const std::string& text) {      // reference stored in the frame
    for (char c : text) co_yield c;
}

int main() {
    Letters l = letters(std::string("abc"));    // the temporary dies at this semicolon
    while (l.next()) std::printf("%c ", l.value());
    std::printf("\n");
}
```

> ERROR: AddressSanitizer: stack-use-after-scope

The temporary `std::string` is destroyed at the end of the statement that
created the coroutine — before a single character has been yielded, because the
generator starts suspended. The frame's reference then points at nothing.

The fix is to take the parameter **by value**, so the frame owns a copy:

```cpp
Letters letters(std::string text) { for (char c : text) co_yield c; }
```

This is the single most common coroutine bug, and it is worth being precise
about why it is *worse* than the equivalent bug with a lambda. Chapter 3.5's
rule — a reference parameter must outlive the call — is not enough here, because
the "call" is over almost immediately and the coroutine runs afterwards. Every
compiler's advice on this is the same: **coroutines take parameters by value**,
and pay the copy.

## Where this stands

Coroutines are the most powerful and least finished feature in C++20.

What they are genuinely good at:

- **Lazy sequences.** The `fibonacci` generator above is difficult to express as
  cleanly any other way — an equivalent iterator has to store the state machine
  by hand, which is exactly what the compiler did for you.
- **Asynchronous I/O without callbacks.** `auto data = co_await socket.read();`
  reads like blocking code, suspends without occupying a thread, and composes.
  This is what Asio, libunifex and cppcoro exist for.
- **State machines**, where the suspension points are the states.

What to be aware of:

- The C++20 library support is essentially nothing. `std::generator` is C++23;
  a `task` type is not in the standard at all.
- Every coroutine is a heap allocation unless HALO applies.
- Debugging is harder: a stack trace shows the resume point, not the logical
  chain of awaits.
- The lifetime rules are new and the compiler checks few of them.

:::tip
Use a library. `cppcoro`, `libcoro`, and Asio's coroutine support are written by
people who have made all these mistakes already. Write the promise type once, as
you have here, so that you can read theirs — and then use theirs.
:::

## Check yourself

:::quiz
{
  "question": "`Generator<int> g = numbers(std::string(\"abc\"));` where `numbers` takes a `const std::string&`. What is wrong?",
  "options": [
    { "text": "The frame stores the reference, and the temporary string is destroyed at the end of that statement — before the coroutine has run at all", "correct": true, "why": "A coroutine's parameters are copied into the frame, and a reference parameter copies only the reference. The rule is to take coroutine parameters by value." },
    { "text": "Nothing; the temporary's lifetime is extended by binding to the parameter", "why": "Lifetime extension applies to a reference variable at block scope, not to a function parameter, and certainly not past the end of the statement." },
    { "text": "The generator must be a `std::generator` for this to work", "why": "The bug is identical with any generator type, including C++23's." },
    { "text": "`std::string` cannot be a coroutine parameter", "why": "It can, by value — which is precisely the fix." }
  ]
}
:::

:::quiz
{
  "question": "`co_await expr` — what does the compiler call, and in what order?",
  "options": [
    { "text": "`await_ready()`; if it returns false, `await_suspend(handle)` and control returns to the caller; on resumption, `await_resume()`, whose return value is the result of the expression", "correct": true, "why": "Those three functions are the entire awaitable protocol. Every coroutine-based async framework is an `await_suspend` that stores the handle somewhere that will resume it." },
    { "text": "It blocks the thread until `expr` is ready", "why": "The opposite: suspending frees the thread. If `co_await` blocked there would be no point to it." },
    { "text": "It starts a new thread to evaluate `expr`", "why": "Coroutines are a control-flow feature with no threading of their own. Whether resumption happens on another thread is up to `await_suspend`." },
    { "text": "`await_suspend()` then `await_ready()` then `await_resume()`", "why": "`await_ready` comes first and is the fast path — it exists so an already-available result costs no suspension." }
  ]
}
:::

## Practice

:::exercise write-a-generator

:::exercise coroutine-lifetime

:::recap
- A function is a coroutine if its body contains `co_await`, `co_yield` or
  `co_return`. The signature does not say so; the return type's nested
  `promise_type` supplies everything the compiler needs.
- `co_yield v` is `co_await promise.yield_value(v)`. `initial_suspend` returning
  `suspend_always` is what makes a generator lazy; `final_suspend` returning
  `suspend_always` is what leaves you owning the frame.
- `co_await expr` calls `await_ready`, then `await_suspend(handle)` if needed,
  then `await_resume` on continuation. Async frameworks live in `await_suspend`.
- The frame is one heap allocation holding the parameters, the promise, the
  resume index, and every local that lives across a suspension — 40 bytes for a
  trivial generator, 4 KB more for a 4 KB local. HALO may elide it; do not rely
  on that.
- `coroutine_handle` is a raw handle. Wrap it in an RAII type, or leak the frame.
- **Take coroutine parameters by value.** A reference parameter is copied as a
  reference into a frame that outlives the call expression.
- C++20 gave you the machinery and no library. Write a promise type once to
  understand it, then use cppcoro, libcoro, or Asio.
:::
