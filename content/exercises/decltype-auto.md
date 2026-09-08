---
id: decltype-auto
title: "Return exactly what you were given"
difficulty: core
chapter: deduction
topics: [templates, deduction, decltype, references]
check: unit
standard: c++20
---

`entry(table, i)` is a thin wrapper over `Table::at`. `Table::at` returns a
reference — a `Row&` for a modifiable table, a `const Row&` for a `const` one —
and callers expect the wrapper to hand that reference straight back so they can
write through it.

It does not. Fix `entry` so that the wrapper's return type is whatever `at`
returned, reference and `const` included.

## Starter
```cpp
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

struct Row {
    std::string name;
    int score = 0;
};

class Table {
public:
    void add(std::string name, int score) { rows_.push_back({std::move(name), score}); }

    Row& at(std::size_t i) { return rows_[i]; }
    const Row& at(std::size_t i) const { return rows_[i]; }

    std::size_t size() const { return rows_.size(); }

private:
    std::vector<Row> rows_;
};

template <class T>
auto entry(T& table, std::size_t i) {
    return table.at(i);
}
```

## Tests
```cpp
Table t;
t.add("ada", 10);
t.add("grace", 20);

// The reference must reach the caller, so a write through it lands in the table.
entry(t, 0).score = 99;
CHECK_EQ(t.at(0).score, 99);

// And it must genuinely be a reference, not a copy that happened to be enough.
CHECK(std::is_reference_v<decltype(entry(t, 1))>);
CHECK(std::is_same_v<decltype(entry(t, 1)), Row&>);

// A const table must yield a const reference — still a reference, still no copy.
const Table& frozen = t;
CHECK(std::is_same_v<decltype(entry(frozen, 0)), const Row&>);
CHECK_EQ(entry(frozen, 0).score, 99);
CHECK_EQ(entry(frozen, 1).name, std::string("grace"));

// Reading through the wrapper must not disturb the table.
CHECK_EQ(t.size(), std::size_t{2});
CHECK_EQ(&entry(t, 1), &t.at(1));
```

## Hints
- `auto` as a return type deduces the way a by-value template parameter does: it strips the reference and the `const`, so it can only ever return a copy.
- `decltype(auto)` deduces the way `decltype` on the returned expression does, which keeps both.
- The parameter can stay a plain `T&` — `const` is part of `T` when the argument is const, so both `at` overloads are still reachable.
- Watch the parentheses. `return (table.at(i));` and `return table.at(i);` mean different things under `decltype(auto)`; only one of them is what you want here.
- If you would rather write the type out: `auto entry(T& table, std::size_t i) -> decltype(table.at(i))` says the same thing the long way round.

## Solution
```cpp
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

struct Row {
    std::string name;
    int score = 0;
};

class Table {
public:
    void add(std::string name, int score) { rows_.push_back({std::move(name), score}); }

    Row& at(std::size_t i) { return rows_[i]; }
    const Row& at(std::size_t i) const { return rows_[i]; }

    std::size_t size() const { return rows_.size(); }

private:
    std::vector<Row> rows_;
};

template <class T>
decltype(auto) entry(T& table, std::size_t i) {
    return table.at(i);
}
```

## Notes
The starter compiles, runs, and quietly loses every write. `entry(t, 0).score = 99`
is a perfectly legal assignment — to a member of a temporary `Row` that is
destroyed at the end of the statement. No warning, no sanitiser report, just a
table that never changes.

About those parentheses: `decltype` of a plain *name* gives that name's declared
type, but `decltype` of a *parenthesised* lvalue expression gives an lvalue
reference. So for a local `Row r;`, `return r;` under `decltype(auto)` returns
`Row` by value, while `return (r);` returns `Row&` — a reference to a local that
is about to die. Here the returned expression is already a reference so the
parentheses would not change the type, but the habit of adding them is how that
particular dangling reference gets written.

`decltype(auto)` is the right tool exactly when you are passing a return value
through and do not know what it is. When you *do* know, name the type: a reader
should not have to run deduction in their head to find out whether a function
hands back a reference.
