---
id: strong-guarantee
title: "All or nothing"
difficulty: stretch
chapter: exceptions
topics: [exceptions, exception-safety, invariants]
check: unit
standard: c++20
---

`Inventory::restock` adds items and records the delivery. It modifies the count
first and appends to the log second — so when the log append throws, the count
has already changed and the object is left inconsistent.

Rewrite it to provide the **strong guarantee**: if it throws, nothing about the
object may have changed.

`record_delivery` throws whenever the note is the string `"fail"`. Do not change
it, and do not catch its exception — the caller is meant to see it.

## Starter
```cpp
#include <stdexcept>
#include <string>
#include <vector>

class Inventory {
public:
    void restock(int quantity, const std::string& note) {
        count_ += quantity;
        record_delivery(note);
    }

    int count() const { return count_; }
    std::size_t deliveries() const { return log_.size(); }

private:
    void record_delivery(const std::string& note) {
        if (note == "fail") throw std::runtime_error("could not record delivery");
        log_.push_back(note);
    }

    int count_ = 0;
    std::vector<std::string> log_;
};
```

## Tests
```cpp
Inventory inv;

inv.restock(10, "first");
CHECK_EQ(inv.count(), 10);
CHECK_EQ(inv.deliveries(), std::size_t{1});

// A failing restock must leave BOTH the count and the log untouched.
bool threw = false;
try { inv.restock(5, "fail"); } catch (const std::runtime_error&) { threw = true; }
CHECK(threw);
CHECK_EQ(inv.count(), 10);
CHECK_EQ(inv.deliveries(), std::size_t{1});

// And the object must still work afterwards.
inv.restock(7, "second");
CHECK_EQ(inv.count(), 17);
CHECK_EQ(inv.deliveries(), std::size_t{2});

// Repeated failures must not accumulate any change.
for (int i = 0; i < 50; ++i) {
    try { inv.restock(1, "fail"); } catch (const std::runtime_error&) {}
}
CHECK_EQ(inv.count(), 17);
CHECK_EQ(inv.deliveries(), std::size_t{2});
```

## Hints
- The rule is: do everything that can throw **first**, then commit with operations that cannot throw.
- `record_delivery` is the only thing that can fail, so it must run before `count_` changes.
- Simply swapping the two lines is enough here — and it is worth understanding why that is a complete fix.
- An `int` addition cannot throw, so once the recording has succeeded there is nothing left to fail.

## Solution
```cpp
#include <stdexcept>
#include <string>
#include <vector>

class Inventory {
public:
    void restock(int quantity, const std::string& note) {
        record_delivery(note);      // everything that can throw happens first
        count_ += quantity;         // commit: cannot throw
    }

    int count() const { return count_; }
    std::size_t deliveries() const { return log_.size(); }

private:
    void record_delivery(const std::string& note) {
        if (note == "fail") throw std::runtime_error("could not record delivery");
        log_.push_back(note);
    }

    int count_ = 0;
    std::vector<std::string> log_;
};
```

## Notes
Two lines swapped, and the guarantee changes from basic to strong. That is
usually how it goes: exception safety is far more often a matter of *ordering*
than of `try`/`catch`.

The reason this ordering is a complete fix is worth stating. After
`record_delivery` returns, the only remaining operation is `count_ += quantity`
— integer addition, which cannot throw. There is no window in which the object
is half-updated, because nothing after the fallible step can fail.

When the commit step *can* fail, ordering alone is not enough and you need the
temporary-then-swap shape: build the new state beside the old, then exchange
them with a `noexcept` swap. That is copy-and-swap from Chapter 3.3, and it is
the general form of what this problem does in miniature.

The fifty-iteration loop is there because a single leaked increment is easy to
miss in a one-shot test and obvious when it accumulates.
