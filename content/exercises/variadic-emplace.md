---
id: variadic-emplace
title: "One emplace, any constructor"
difficulty: stretch
chapter: variadics
topics: [variadics, forwarding, templates]
check: unit
standard: c++20
---

`SlotMap` stores objects in a fixed array of slots. Its only way to add one is
`insert`, which takes a finished `T` and copies it in — so every caller has to
build the object first, and every insertion costs a copy.

Give it an `emplace` that constructs the object **in place** from whatever
arguments `T`'s constructor takes: any number of them, with their value
categories preserved. It should return the index of the new slot.

Keep `insert` working; `emplace` is an addition, not a replacement.

## Starter
```cpp
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

inline int copies = 0;
inline int constructions = 0;

struct Record {
    std::string name;
    int score = 0;

    Record() { ++constructions; }
    Record(std::string n, int s) : name(std::move(n)), score(s) { ++constructions; }
    Record(const Record& o) : name(o.name), score(o.score) { ++copies; ++constructions; }
    Record(Record&& o) noexcept : name(std::move(o.name)), score(o.score) { ++constructions; }
    Record& operator=(const Record&) = default;
    Record& operator=(Record&&) = default;
};

template <class T>
class SlotMap {
public:
    std::size_t insert(const T& value) {
        slots_.push_back(value);
        return slots_.size() - 1;
    }

    // TODO: emplace

    const T& at(std::size_t i) const { return slots_[i]; }
    std::size_t size() const { return slots_.size(); }

private:
    std::vector<T> slots_;
};
```

## Tests
```cpp
SlotMap<Record> map;

// insert must keep working, and it still copies.
Record prepared{"prepared", 1};
copies = 0;
std::size_t a = map.insert(prepared);
CHECK_EQ(a, std::size_t{0});
CHECK_EQ(copies, 1);
CHECK_EQ(map.at(a).name, std::string("prepared"));

// emplace with two arguments: constructed in place, no copy of a Record.
copies = 0;
std::size_t b = map.emplace(std::string("built"), 7);
CHECK_EQ(b, std::size_t{1});
CHECK_EQ(copies, 0);
CHECK_EQ(map.at(b).name, std::string("built"));
CHECK_EQ(map.at(b).score, 7);

// emplace with no arguments: the default constructor.
copies = 0;
std::size_t c = map.emplace();
CHECK_EQ(c, std::size_t{2});
CHECK_EQ(copies, 0);
CHECK_EQ(map.at(c).score, 0);

// An lvalue argument must be copied into the member, not stolen from.
std::string keep = "keep me";
std::size_t d = map.emplace(keep, 3);
CHECK_EQ(keep, std::string("keep me"));
CHECK_EQ(map.at(d).name, std::string("keep me"));

// An rvalue argument must be moved: the source ends up empty.
std::string donate = "donate me";
std::size_t e = map.emplace(std::move(donate), 4);
CHECK_EQ(map.at(e).name, std::string("donate me"));
CHECK(donate.empty());

CHECK_EQ(map.size(), std::size_t{5});
```

## Hints
- `emplace` needs its own template parameter pack, declared on the member function: `template <class... Args>`. `T` is already fixed by the class.
- The parameters must be forwarding references — `Args&&... args` — so both lvalues and rvalues arrive unchanged.
- Expand with `std::forward<Args>(args)...`. The `...` goes after the whole pattern, so it repeats `std::forward<A1>(a1), std::forward<A2>(a2)`.
- `std::vector` already has an `emplace_back` that takes exactly this kind of pack. Your job is to pass yours through to it.
- The no-argument case works for free: an empty pack expands to an empty argument list, and `emplace_back()` default-constructs.

## Solution
```cpp
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

inline int copies = 0;
inline int constructions = 0;

struct Record {
    std::string name;
    int score = 0;

    Record() { ++constructions; }
    Record(std::string n, int s) : name(std::move(n)), score(s) { ++constructions; }
    Record(const Record& o) : name(o.name), score(o.score) { ++copies; ++constructions; }
    Record(Record&& o) noexcept : name(std::move(o.name)), score(o.score) { ++constructions; }
    Record& operator=(const Record&) = default;
    Record& operator=(Record&&) = default;
};

template <class T>
class SlotMap {
public:
    std::size_t insert(const T& value) {
        slots_.push_back(value);
        return slots_.size() - 1;
    }

    template <class... Args>
    std::size_t emplace(Args&&... args) {
        slots_.emplace_back(std::forward<Args>(args)...);
        return slots_.size() - 1;
    }

    const T& at(std::size_t i) const { return slots_[i]; }
    std::size_t size() const { return slots_.size(); }

private:
    std::vector<T> slots_;
};
```

## Notes
This is the shape of every `emplace` in the standard library, and it is worth
recognising: a member template with its own pack, forwarding references, and one
expansion. Three lines that work for any constructor `T` happens to have,
including ones that do not exist yet.

The last two checks are the reason `std::forward` and not `std::move`. `keep`
is an lvalue, so `Args` deduces to `std::string&`, `std::forward` hands
`Record`'s constructor an lvalue, and the `std::string` member is copy-
constructed — the caller's variable survives. `std::move(donate)` is an rvalue,
`Args` deduces to `std::string`, and the member is move-constructed, leaving the
source empty. Writing `std::move(args)...` instead would pass the first check
by accident and empty `keep` too.

Note also that the vector may reallocate as it grows, which moves the existing
`Record`s — so the `constructions` counter climbs faster than the number of
insertions. That is why the checks count *copies* and not constructions: moves
during reallocation are the container's business, not `emplace`'s.
