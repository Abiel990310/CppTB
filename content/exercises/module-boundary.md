---
id: module-boundary
title: "An interface the language enforces"
difficulty: core
chapter: modules
topics: [interfaces, encapsulation, concepts]
check: unit
standard: c++20
---

`Index` is a tiny search index. Everything about it is public: the storage, the
normalisation helper, the internal scoring function. Callers who only wanted
`add` and `find` can — and eventually will — reach for the rest, and then those
"internal" functions can never change.

That is the problem a module's `export` solves at file scope. Inside a class,
the tool is access control, and it is enforced just as firmly.

Restructure `Index` so that its interface is exactly four members —
`add`, `find`, `size`, `contains` — and everything else is private. Do not
change what any of them does.

The checks use `requires`-expressions to verify both halves: the four must be
callable, and the rest must not be.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <vector>

class Index {
public:
    std::vector<std::string> entries;             // storage: should be private

    static std::string normalise(std::string text) {   // helper: should be private
        for (char& c : text)
            if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
        return text;
    }

    std::size_t position_of(const std::string& key) const {   // helper: private
        std::string wanted = normalise(key);
        for (std::size_t i = 0; i < entries.size(); ++i)
            if (entries[i] == wanted) return i;
        return entries.size();
    }

    void add(std::string key) {
        std::string wanted = normalise(std::move(key));
        if (position_of(wanted) == entries.size()) entries.push_back(wanted);
    }

    // Returns the index of the key, or size() if it is absent.
    std::size_t find(const std::string& key) const { return position_of(key); }

    std::size_t size() const { return entries.size(); }

    bool contains(const std::string& key) const { return find(key) != entries.size(); }
};

// --- given, do not change: what the interface is, and what it is not -----
template <class T> concept HasAdd      = requires(T i) { i.add(std::string("x")); };
template <class T> concept HasFind     = requires(const T& c) { c.find(std::string("x")); };
template <class T> concept HasSize     = requires(const T& c) { c.size(); };
template <class T> concept HasContains = requires(const T& c) { c.contains(std::string("x")); };

template <class T> concept ExposesStorage   = requires(T i) { i.entries; };
template <class T> concept ExposesNormalise = requires { T::normalise(std::string("x")); };
template <class T> concept ExposesPosition  = requires(const T& c) { c.position_of(std::string("x")); };
// ------------------------------------------------------------------------
```

## Tests
```cpp
// The four public operations behave exactly as before.
Index index;
CHECK_EQ(index.size(), std::size_t{0});
CHECK(!index.contains("apple"));

index.add("Apple");
index.add("banana");
index.add("APPLE");                 // already present, case-insensitively
CHECK_EQ(index.size(), std::size_t{2});
CHECK(index.contains("apple"));
CHECK(index.contains("APPLE"));
CHECK(index.contains("BaNaNa"));
CHECK(!index.contains("cherry"));
CHECK_EQ(index.find("apple"), std::size_t{0});
CHECK_EQ(index.find("banana"), std::size_t{1});
CHECK_EQ(index.find("missing"), std::size_t{2});    // == size()

// The interface is exactly these four, and they are reachable. The concepts
// are written over a template parameter on purpose: a requires-expression only
// reports false instead of erroring when the type is dependent.
static_assert(HasAdd<Index>);
static_assert(HasFind<Index>);
static_assert(HasSize<Index>);
static_assert(HasContains<Index>);

// And the rest is not. These must all be false.
static_assert(!ExposesStorage<Index>, "the storage should not be part of the interface");
static_assert(!ExposesNormalise<Index>, "normalise is an implementation detail");
static_assert(!ExposesPosition<Index>, "position_of is an implementation detail");

// find and contains must not modify the index, so both are callable on a const one.
const Index& frozen = index;
CHECK_EQ(frozen.size(), std::size_t{2});
CHECK(frozen.contains("apple"));
```

## Hints
- Move `entries`, `normalise` and `position_of` below a `private:` label. Nothing else changes — keep the member's name, since the checks test whether it is *reachable*, not whether it was renamed.
- Member functions can call private members of their own class, so `add`, `find` and `contains` keep working without modification.
- Order the class so the public interface comes first and the private details last. A reader looking for the interface should not have to scroll past the implementation.
- The checks phrase everything as concepts over a template parameter rather than as bare `requires`-expressions on `Index`. That is not decoration: naming an inaccessible member of a *concrete* type is a hard error, and only becomes a quiet `false` when the type is dependent.
- Do not make the members `protected`. Nothing derives from `Index`, and `protected` data has the same problem as public data with a smaller audience.
- Add `const` where it belongs, and check that `find`, `size` and `contains` are all callable on a `const Index&` — the last block of checks requires it.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <vector>

class Index {
public:
    void add(std::string key) {
        std::string wanted = normalise(std::move(key));
        if (position_of(wanted) == entries.size()) entries.push_back(wanted);
    }

    // Returns the index of the key, or size() if it is absent.
    std::size_t find(const std::string& key) const { return position_of(key); }

    std::size_t size() const { return entries.size(); }

    bool contains(const std::string& key) const { return find(key) != entries.size(); }

private:
    static std::string normalise(std::string text) {
        for (char& c : text)
            if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
        return text;
    }

    std::size_t position_of(const std::string& key) const {
        std::string wanted = normalise(key);
        for (std::size_t i = 0; i < entries.size(); ++i)
            if (entries[i] == wanted) return i;
        return entries.size();
    }

    std::vector<std::string> entries;
};

// --- given, do not change: what the interface is, and what it is not -----
template <class T> concept HasAdd      = requires(T i) { i.add(std::string("x")); };
template <class T> concept HasFind     = requires(const T& c) { c.find(std::string("x")); };
template <class T> concept HasSize     = requires(const T& c) { c.size(); };
template <class T> concept HasContains = requires(const T& c) { c.contains(std::string("x")); };

template <class T> concept ExposesStorage   = requires(T i) { i.entries; };
template <class T> concept ExposesNormalise = requires { T::normalise(std::string("x")); };
template <class T> concept ExposesPosition  = requires(const T& c) { c.position_of(std::string("x")); };
// ------------------------------------------------------------------------
```

## Notes
The code did not change. What changed is what the *rest of the program is
allowed to depend on*, and that is the only thing that determines whether you
can ever change the code again.

With `entries` public, some caller will eventually write
`index.entries.push_back("raw")` — bypassing the normalisation, so `contains`
starts returning false for entries that are visibly present. Or they will write
`for (const auto& e : index.entries)` and then you cannot switch the vector for
a hash map without breaking them. Neither is a hypothetical; both are what
public data members are *for*, from the caller's point of view.

The concepts in the checks are worth knowing as a technique. Access checking
happens during template substitution, so a concept naming a private member is
`false` rather than an error — which means you can assert that something is *not*
part of your interface, in a test, in the same file. Most codebases have no way
to state that at all and rely on a comment saying "internal".

The detail that makes it work is that the concepts take a template parameter.
Written directly against `Index` — `requires(Index i) { i.entries; }` — a
private member is a hard compile error, not a `false`, because there is no
substitution to fail. Making the type dependent is what turns "you may not touch
this" into an answerable question.

Which is exactly the parallel with modules. Inside a class, `private` is a hard
boundary the language enforces. At file scope, before modules, there was no such
thing: `namespace detail` is a convention, a `static` function is invisible to
other translation units but visible to everything in this one, and a header's
"internal" helpers are as reachable as its public ones. `export` gives file scope
what `private` has always given class scope — a boundary that is checked rather
than requested.

One thing deliberately left alone: `find` returning `size()` for "not found" is
a poor interface — it is `std::string::npos` by another name, and Chapter 4.8
argued for `std::optional` instead. It is left as it was because this exercise is
about the boundary, not the signatures, and changing both at once would obscure
which change did what. In real code you would fix it while you were in there.
