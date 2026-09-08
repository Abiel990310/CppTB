---
id: crtp-mixin
title: "Algorithms for free, from two members"
difficulty: core
chapter: static-polymorphism
topics: [crtp, templates, static-polymorphism]
check: unit
standard: c++20
---

`Indexed<Derived>` is a mixin: any class that supplies `size()` and `at(i)`
should inherit from it and get four algorithms without writing them. The four
are stubbed out.

Implement them so that they call the derived class's `size()` and `at()`
directly — no virtual functions, and nothing added to the object's size.

- `total()` — the sum of all elements, `0` when empty.
- `largest()` — the biggest element; the callers guarantee a non-empty sequence.
- `contains(value)` — whether any element equals `value`.
- `to_vector()` — every element, in order.

## Starter
```cpp
#include <cstddef>
#include <utility>
#include <vector>

template <class Derived>
class Indexed {
public:
    int total() const { return 0; }

    int largest() const { return 0; }

    bool contains(int value) const { (void)value; return false; }

    std::vector<int> to_vector() const { return {}; }

private:
    const Derived& self() const { return static_cast<const Derived&>(*this); }
};

// A sequence with no storage at all: element i is i * i.
struct Squares : Indexed<Squares> {
    int count;
    explicit Squares(int n) : count(n) {}
    std::size_t size() const { return static_cast<std::size_t>(count); }
    int at(std::size_t i) const { return static_cast<int>(i * i); }
};

// A sequence backed by a vector.
struct Listed : Indexed<Listed> {
    std::vector<int> data;
    explicit Listed(std::vector<int> values) : data(std::move(values)) {}
    std::size_t size() const { return data.size(); }
    int at(std::size_t i) const { return data[i]; }
};
```

## Tests
```cpp
Squares squares{5};                      // 0, 1, 4, 9, 16
CHECK_EQ(squares.total(), 30);
CHECK_EQ(squares.largest(), 16);
CHECK(squares.contains(9));
CHECK(!squares.contains(10));
CHECK_EQ(squares.to_vector().size(), std::size_t{5});
CHECK_EQ(squares.to_vector()[3], 9);

Listed listed{{7, -2, 40, 40, 3}};
CHECK_EQ(listed.total(), 88);
CHECK_EQ(listed.largest(), 40);
CHECK(listed.contains(-2));
CHECK(!listed.contains(0));
CHECK_EQ(listed.to_vector()[0], 7);
CHECK_EQ(listed.to_vector().size(), std::size_t{5});

Squares empty{0};
CHECK_EQ(empty.total(), 0);
CHECK(!empty.contains(0));
CHECK(empty.to_vector().empty());

// The mixin must not make the object bigger: no vtable pointer, and an empty
// base class takes no storage of its own.
CHECK_EQ(sizeof(Squares), sizeof(int));
CHECK_EQ(sizeof(Listed), sizeof(std::vector<int>));
```

## Hints
- `self()` is already written. It is the whole mechanism: `static_cast<const Derived&>(*this)` turns the base into the derived object it is part of.
- Every algorithm is a loop from `0` to `self().size()`, reading `self().at(i)`.
- `size()` returns `std::size_t`, so loop with a `std::size_t` — comparing a signed `int` against it produces a warning and, for a big enough sequence, a wrong answer.
- Do not add any data members and do not make anything `virtual`. The last two checks fail if you do: a virtual function adds a vtable pointer, and a base class with data stops being empty.
- `largest()` may assume at least one element, so start from `self().at(0)` rather than from a sentinel like `INT_MIN`.

## Solution
```cpp
#include <cstddef>
#include <utility>
#include <vector>

template <class Derived>
class Indexed {
public:
    int total() const {
        int sum = 0;
        for (std::size_t i = 0; i < self().size(); ++i) sum += self().at(i);
        return sum;
    }

    int largest() const {
        int best = self().at(0);
        for (std::size_t i = 1; i < self().size(); ++i)
            if (self().at(i) > best) best = self().at(i);
        return best;
    }

    bool contains(int value) const {
        for (std::size_t i = 0; i < self().size(); ++i)
            if (self().at(i) == value) return true;
        return false;
    }

    std::vector<int> to_vector() const {
        std::vector<int> out;
        out.reserve(self().size());
        for (std::size_t i = 0; i < self().size(); ++i) out.push_back(self().at(i));
        return out;
    }

private:
    const Derived& self() const { return static_cast<const Derived&>(*this); }
};

struct Squares : Indexed<Squares> {
    int count;
    explicit Squares(int n) : count(n) {}
    std::size_t size() const { return static_cast<std::size_t>(count); }
    int at(std::size_t i) const { return static_cast<int>(i * i); }
};

struct Listed : Indexed<Listed> {
    std::vector<int> data;
    explicit Listed(std::vector<int> values) : data(std::move(values)) {}
    std::size_t size() const { return data.size(); }
    int at(std::size_t i) const { return data[i]; }
};
```

## Notes
Two members in, four algorithms out, and the two sequences have nothing in
common at run time — `Squares` stores four bytes and computes its elements on
demand; `Listed` owns a vector. Neither knows about the other, and the mixin
never allocates, never dispatches, and never appears in either object's layout.

The `sizeof` checks are the ones worth keeping. `sizeof(Squares) == sizeof(int)`
says two things at once: there is no vtable pointer, because nothing is virtual;
and `Indexed<Squares>` contributed no bytes, because an empty base class is
allowed to overlap with the derived object. That second rule — the *empty base
optimisation* — is what makes CRTP free. A base class with even one `int` member
would push `Squares` to eight bytes.

The same mixin written with virtual functions would need `size()` and `at()`
declared pure virtual in the base, which adds a vtable pointer to every object,
prevents inlining of the element access inside the loops, and forces every
derived class to be heap-allocated to be stored polymorphically. Here the loops
inline down to `i * i`.
