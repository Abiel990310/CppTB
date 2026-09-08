---
id: rule-of-zero-refactor
title: "Delete the boilerplate"
difficulty: core
chapter: rule-of-zero
topics: [raii, ownership, rule-of-zero]
check: unit
standard: c++20
---

`Record` manages a heap-allocated name and a heap-allocated array of scores with
hand-written copy operations. It works, but it is fifty lines of code that can
be wrong, and it has no move operations at all — so every copy is a full deep
copy.

Rewrite it following the rule of zero: keep the public interface exactly as it
is, replace the raw pointers with standard types, and delete every special
member function.

The checks verify the behaviour is unchanged **and** that moving is now cheap —
a moved-from `Record` must give up its scores rather than duplicating them.

## Starter
```cpp
#include <cstddef>
#include <cstring>
#include <string>

class Record {
public:
    Record(const char* name, std::size_t score_count)
        : name_(new char[std::strlen(name) + 1]),
          scores_(new int[score_count]{}),
          count_(score_count) {
        std::strcpy(name_, name);
    }

    ~Record() {
        delete[] name_;
        delete[] scores_;
    }

    Record(const Record& other)
        : name_(new char[std::strlen(other.name_) + 1]),
          scores_(new int[other.count_]),
          count_(other.count_) {
        std::strcpy(name_, other.name_);
        for (std::size_t i = 0; i < count_; ++i) scores_[i] = other.scores_[i];
    }

    Record& operator=(const Record& other) {
        if (this != &other) {
            char* new_name = new char[std::strlen(other.name_) + 1];
            int* new_scores = new int[other.count_];
            std::strcpy(new_name, other.name_);
            for (std::size_t i = 0; i < other.count_; ++i) new_scores[i] = other.scores_[i];
            delete[] name_;
            delete[] scores_;
            name_ = new_name;
            scores_ = new_scores;
            count_ = other.count_;
        }
        return *this;
    }

    std::string name() const { return name_; }
    std::size_t score_count() const { return count_; }
    int& score(std::size_t i) { return scores_[i]; }
    int score(std::size_t i) const { return scores_[i]; }

private:
    char* name_;
    int* scores_;
    std::size_t count_;
};
```

## Tests
```cpp
Record a{"ada", 3};
a.score(0) = 10;
a.score(2) = 30;

CHECK_EQ(a.name(), std::string("ada"));
CHECK_EQ(a.score_count(), std::size_t{3});
CHECK_EQ(a.score(2), 30);

Record b = a;
b.score(0) = 99;
CHECK_EQ(a.score(0), 10);
CHECK_EQ(b.score(0), 99);
CHECK_EQ(b.name(), std::string("ada"));

Record c{"grace", 1};
c = a;
CHECK_EQ(c.name(), std::string("ada"));
CHECK_EQ(c.score_count(), std::size_t{3});

a = a;
CHECK_EQ(a.name(), std::string("ada"));
CHECK_EQ(a.score(2), 30);

// Moving must transfer, not duplicate: the source gives up its scores.
Record d{"moved-from", 5};
Record e = std::move(d);
CHECK_EQ(e.name(), std::string("moved-from"));
CHECK_EQ(e.score_count(), std::size_t{5});
CHECK_EQ(d.score_count(), std::size_t{0});
```

## Hints
- `std::string` replaces the `char*` and its `strlen`/`strcpy` dance. `std::vector<int>` replaces the score array and the separate count.
- `score_count()` can return `scores_.size()`, so the `count_` member disappears entirely.
- Once both members manage themselves, delete the destructor, copy constructor, and copy assignment. All five generated versions are then correct.
- The last check is what proves the moves came back: a hand-written destructor would have suppressed them, leaving `d` with 5 elements after the move.

## Solution
```cpp
#include <cstddef>
#include <string>
#include <vector>

class Record {
public:
    Record(const char* name, std::size_t score_count)
        : name_(name), scores_(score_count) {}

    std::string name() const { return name_; }
    std::size_t score_count() const { return scores_.size(); }
    int& score(std::size_t i) { return scores_[i]; }
    int score(std::size_t i) const { return scores_[i]; }

private:
    std::string name_;
    std::vector<int> scores_;
};
```

## Notes
Fifty lines became eight, and the eight cannot have a double free, a leak, a
broken self-assignment, or a missing `noexcept` — there is no code in which to
have one. Self-assignment works because `std::string` and `std::vector` already
handle it.

The move check is the part worth dwelling on. The original class had a
hand-written destructor, which suppressed the implicit move operations, so
`Record e = std::move(d);` performed a deep copy and left `d` intact. Removing
the destructor did not just delete code — it restored moves that had been
silently unavailable.

`std::vector<int>` also leaves a moved-from vector empty, which is why
`d.score_count()` is 0. That is implementation behaviour rather than a
guarantee: for your own code, assign to a moved-from object before reading it.
