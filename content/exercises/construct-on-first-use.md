---
id: construct-on-first-use
title: "The global that was not ready yet"
difficulty: stretch
chapter: translation-units
topics: [linking, initialisation, globals, lifetime]
check: unit
standard: c++20
---

`Registry` is a global that other globals register themselves with. It does not
work: `Registry`'s own constructor runs *after* some of the registrations, and
wipes them.

Fix it with the **construct on first use** idiom — replace the global object
with a function returning a reference to a function-local `static`, so the
object is guaranteed to exist before anyone can reach it.

Keep the same registrations happening; only how the registry is reached may
change.

## Starter
```cpp
#include <string>
#include <vector>

class Registry {
public:
    Registry() { names_.push_back("<builtin>"); }

    void add(std::string name) { names_.push_back(std::move(name)); }
    const std::vector<std::string>& names() const { return names_; }
    std::size_t size() const { return names_.size(); }

private:
    std::vector<std::string> names_;
};

// Reached through this function by everything below.
Registry& registry();

// A global whose constructor registers a name at program startup.
struct Registrar {
    explicit Registrar(const char* name) { registry().add(name); }
};

// The registry itself, defined after the first registrar that uses it.
Registrar reg_alpha{"alpha"};
Registry the_registry;
Registrar reg_beta{"beta"};
Registrar reg_gamma{"gamma"};

Registry& registry() { return the_registry; }
```

## Tests
```cpp
// Every registration must have survived, in order, after the builtin entry.
CHECK_EQ(registry().size(), std::size_t{4});
CHECK_EQ(registry().names()[0], std::string("<builtin>"));
CHECK_EQ(registry().names()[1], std::string("alpha"));
CHECK_EQ(registry().names()[2], std::string("beta"));
CHECK_EQ(registry().names()[3], std::string("gamma"));

// It is one registry, not a fresh one per call.
registry().add("runtime");
CHECK_EQ(registry().size(), std::size_t{5});
CHECK_EQ(registry().names().back(), std::string("runtime"));

// The same object every time.
CHECK(&registry() == &registry());

// Registering later still works.
Registrar reg_late{"late"};
CHECK_EQ(registry().size(), std::size_t{6});
CHECK_EQ(registry().names().back(), std::string("late"));
```

## Hints
- Delete the namespace-scope `Registry the_registry;` entirely.
- The registrar variables are named `reg_alpha` and so on rather than `alpha`: `<cmath>` puts a function called `gamma` in the global namespace, and a variable of that name collides with it.
- Put the object *inside* the function instead: `Registry& registry() { static Registry instance; return instance; }`.
- A function-local `static` is initialised the first time control passes through its declaration — not at program startup. So the first `Registrar` to call `registry()` is what creates it.
- The `static` must be a plain object, not a pointer or a copy. Returning `Registry` by value would give each caller a different one, which the `&registry() == &registry()` check catches.
- Nothing else needs to change: `registry()` is already how everything reaches it.
- You do not need a mutex or a flag. Since C++11 the initialisation of a function-local `static` is guaranteed thread-safe.

## Solution
```cpp
#include <string>
#include <vector>

class Registry {
public:
    Registry() { names_.push_back("<builtin>"); }

    void add(std::string name) { names_.push_back(std::move(name)); }
    const std::vector<std::string>& names() const { return names_; }
    std::size_t size() const { return names_.size(); }

private:
    std::vector<std::string> names_;
};

// Constructed the first time this is called, whenever that is.
Registry& registry() {
    static Registry instance;
    return instance;
}

struct Registrar {
    explicit Registrar(const char* name) { registry().add(name); }
};

Registrar reg_alpha{"alpha"};
Registrar reg_beta{"beta"};
Registrar reg_gamma{"gamma"};
```

## Notes
Run the starter and the registry contains `<builtin>`, `beta` and `gamma`.
`alpha` is missing, and nothing reported anything.

Here is the sequence. Namespace-scope objects with non-trivial constructors are
**dynamically initialised**, in declaration order within a translation unit,
before `main` runs. `reg_alpha` comes first, so its constructor calls `registry()`
and pushes `"alpha"` onto a `Registry` that has not been constructed yet — it is
still zero-filled, and a zero-filled `std::vector` happens to look exactly like
an empty one, so the push appears to work. Then `Registry the_registry;` is
constructed *over the top*, resetting the vector and adding `<builtin>`. The
`"alpha"` entry, and its allocation, are gone.

That is the **static initialisation order fiasco**, and the version across
translation units is worse: the standard specifies no order at all between
files, so the bug appears or disappears when you reorder the link line.

The fix moves the decision from "where is this declared" to "when is it first
needed". A function-local `static` is initialised the first time control reaches
its declaration, so by construction nothing can touch it before it exists. Since
C++11 that initialisation is also thread-safe: if two threads arrive at once,
one constructs and the other waits.

Two things the idiom does not fix, worth knowing before you reach for it:

**Destruction order is still a problem.** Function-local statics are destroyed
in reverse order of construction, at exit. If one global's destructor uses
another that has already been destroyed, you get use-after-free during shutdown
— the *static destruction* order fiasco. The usual escape is to never destroy:
`static Registry& instance = *new Registry;` deliberately leaks, which is
acceptable for something that lives until the process ends.

**It is still a global.** Everything Chapter 6.6 says about shared mutable state
applies. The idiom makes a global safe to *initialise*; it does not make it a
good design. Passing the registry in as a parameter is better whenever you can,
and it makes the thing testable — which a global never is.
