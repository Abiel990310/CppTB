---
id: avoid-the-copy
title: "Stop copying the argument"
difficulty: intro
chapter: references
topics: [references, functions, performance]
check: unit
standard: c++20
---

`longest` returns the length of the longest string in a vector. It takes its
parameter by value, so every call copies the entire vector and every string in
it — to do something that only reads.

Change the signatures so that nothing is copied, while keeping the behaviour
identical. The checks count copies, so a half-fix will show.

## Starter
```cpp
#include <string>
#include <vector>

inline int copies_made = 0;

struct Tracked {
    std::string text;
    Tracked(const char* s) : text(s) {}
    Tracked(const Tracked& other) : text(other.text) { ++copies_made; }
    Tracked& operator=(const Tracked&) = default;
};

std::size_t longest(std::vector<Tracked> items) {
    std::size_t best = 0;
    for (Tracked item : items) {
        if (item.text.size() > best) best = item.text.size();
    }
    return best;
}
```

## Tests
```cpp
std::vector<Tracked> items{"a", "abcd", "ab"};
copies_made = 0;

CHECK_EQ(longest(items), std::size_t{4});
CHECK_EQ(copies_made, 0);

std::vector<Tracked> one{"hello"};
copies_made = 0;
CHECK_EQ(longest(one), std::size_t{5});
CHECK_EQ(copies_made, 0);

std::vector<Tracked> empty;
CHECK_EQ(longest(empty), std::size_t{0});
```

## Hints
- There are two copies happening, not one: the parameter, and the loop variable.
- The function only reads, so `const&` is right for both.
- `for (const Tracked& item : items)` binds to each element instead of duplicating it.

## Solution
```cpp
#include <string>
#include <vector>

inline int copies_made = 0;

struct Tracked {
    std::string text;
    Tracked(const char* s) : text(s) {}
    Tracked(const Tracked& other) : text(other.text) { ++copies_made; }
    Tracked& operator=(const Tracked&) = default;
};

std::size_t longest(const std::vector<Tracked>& items) {
    std::size_t best = 0;
    for (const Tracked& item : items) {
        if (item.text.size() > best) best = item.text.size();
    }
    return best;
}
```

## Notes
Counting copies with an instrumented copy constructor is a genuinely useful
debugging technique, not just an exercise device. When you suspect a function is
copying more than it should, adding a counter to the copy constructor answers
the question in minutes.

The by-value loop variable is the more commonly missed of the two. It is easy to
fix the parameter, feel finished, and leave a copy per element in the loop.
