---
id: word-frequency
title: "Count without inserting"
difficulty: core
chapter: associative-containers
topics: [containers, map, api-design]
check: unit
standard: c++20
---

`count_of` is meant to report how many times a word was seen, returning 0 for a
word that is absent. It uses `operator[]`, so every query for a missing word
*inserts* it — the map grows every time you ask about something it does not
have.

Fix `count_of` so it never modifies the map. `record` should keep using
`operator[]`, because insert-if-missing is exactly right there.

## Starter
```cpp
#include <map>
#include <string>

class Counter {
public:
    void record(const std::string& word) { ++counts_[word]; }

    int count_of(const std::string& word) { return counts_[word]; }

    std::size_t distinct() const { return counts_.size(); }

private:
    std::map<std::string, int> counts_;
};
```

## Tests
```cpp
Counter c;
c.record("the");
c.record("cat");
c.record("the");

CHECK_EQ(c.distinct(), std::size_t{2});
CHECK_EQ(c.count_of("the"), 2);
CHECK_EQ(c.count_of("cat"), 1);

// Asking about absent words must not change the map.
CHECK_EQ(c.count_of("dog"), 0);
CHECK_EQ(c.count_of("fish"), 0);
CHECK_EQ(c.count_of("dog"), 0);
CHECK_EQ(c.distinct(), std::size_t{2});

// And it must work through a const reference.
const Counter& frozen = c;
CHECK_EQ(frozen.count_of("the"), 2);
CHECK_EQ(frozen.count_of("absent"), 0);
CHECK_EQ(frozen.distinct(), std::size_t{2});
```

## Hints
- `counts_[word]` returns a reference to the mapped value, so it has to create one when the key is missing.
- `counts_.find(word)` returns an iterator, equal to `counts_.end()` when the key is absent, and modifies nothing.
- The last block requires `count_of` to be callable on a `const Counter&`, so mark it `const` — which also makes `operator[]` stop compiling, telling you about the bug.

## Solution
```cpp
#include <map>
#include <string>

class Counter {
public:
    void record(const std::string& word) { ++counts_[word]; }

    int count_of(const std::string& word) const {
        const auto it = counts_.find(word);
        return it == counts_.end() ? 0 : it->second;
    }

    std::size_t distinct() const { return counts_.size(); }

private:
    std::map<std::string, int> counts_;
};
```

## Notes
Marking `count_of` as `const` is not a side quest — it is the fix that makes the
bug impossible. `std::map::operator[]` is not declared `const`, precisely
because it may insert, so a const-correct query function cannot use it by
accident. Const-correctness is doing real work here rather than just
documenting intent.

Note the asymmetry that makes this a good design: `record` *wants*
insert-if-missing, and `operator[]` is the clearest way to say `++counts_[word]`.
The same operator is right in one function and wrong in the other, so the rule
is not "avoid `operator[]`" but "use it when you mean to insert".
