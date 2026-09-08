---
id: pass-correctly
title: "Fix the signatures"
difficulty: intro
chapter: functions
topics: [functions, references, performance]
check: unit
standard: c++20
---

Three functions have the wrong parameter conventions. `describe` copies a large
vector to read it, `scale` takes a copy so the caller never sees the change, and
`total` copies a vector it only sums.

Fix all three signatures so that:

- `describe` and `total` do not copy, and cannot modify their argument
- `scale` modifies the caller's vector in place

Do not change any function body except where the change of convention requires
it.

## Starter
```cpp
#include <string>
#include <vector>

inline int copies_made = 0;

struct Counted {
    std::vector<int> data;
    Counted() = default;
    explicit Counted(std::vector<int> d) : data(std::move(d)) {}
    Counted(const Counted& other) : data(other.data) { ++copies_made; }
    Counted& operator=(const Counted& other) { data = other.data; ++copies_made; return *this; }
};

std::string describe(Counted c) {
    return "size " + std::to_string(c.data.size());
}

void scale(Counted c, int factor) {
    for (int& x : c.data) x *= factor;
}

int total(Counted c) {
    int sum = 0;
    for (int x : c.data) sum += x;
    return sum;
}
```

## Tests
```cpp
Counted c{std::vector<int>{1, 2, 3}};
copies_made = 0;

CHECK_EQ(describe(c), std::string("size 3"));
CHECK_EQ(copies_made, 0);

CHECK_EQ(total(c), 6);
CHECK_EQ(copies_made, 0);

scale(c, 10);
CHECK_EQ(c.data[0], 10);
CHECK_EQ(c.data[2], 30);
CHECK_EQ(total(c), 60);
CHECK_EQ(copies_made, 0);

// Reading must work through a const reference.
const Counted& frozen = c;
CHECK_EQ(describe(frozen), std::string("size 3"));
CHECK_EQ(total(frozen), 60);
CHECK_EQ(copies_made, 0);
```

## Hints
- `describe` and `total` only read, so they want `const Counted&`.
- `scale` must change the caller's object, so it wants `Counted&` — no const.
- The last block passes a `const Counted&`, so anything that reads must accept const.
- The copy counter starts at 0 and must stay there; any by-value parameter will show up.

## Solution
```cpp
#include <string>
#include <vector>

inline int copies_made = 0;

struct Counted {
    std::vector<int> data;
    Counted() = default;
    explicit Counted(std::vector<int> d) : data(std::move(d)) {}
    Counted(const Counted& other) : data(other.data) { ++copies_made; }
    Counted& operator=(const Counted& other) { data = other.data; ++copies_made; return *this; }
};

std::string describe(const Counted& c) {
    return "size " + std::to_string(c.data.size());
}

void scale(Counted& c, int factor) {
    for (int& x : c.data) x *= factor;
}

int total(const Counted& c) {
    int sum = 0;
    for (int x : c.data) sum += x;
    return sum;
}
```

## Notes
`scale` is the interesting one, because the starter *compiles and runs* and
simply does nothing observable. It scales its own copy and throws it away — no
warning, no error, and a caller who tests only "does it crash" will not notice.
The `c.data[0] == 10` check is what catches it.

The last block is what forces `const` rather than merely a reference. Taking
`Counted&` in `describe` would avoid the copy and still fail to compile against
a `const Counted&`, which is how a missing const spreads: one function without
it makes every caller holding a const reference unable to use it.

Counting copies through an instrumented copy constructor is a real debugging
technique, not just an exercise device — when you suspect a function copies more
than it should, a counter answers it in minutes.
