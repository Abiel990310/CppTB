---
id: scope-guard
title: "A guard for an unfriendly API"
difficulty: stretch
chapter: raii
topics: [raii, destructors, ownership]
check: unit
standard: c++20
---

You are stuck with a C-style API you cannot change: `acquire()` hands out a
resource id and `release(id)` gives it back. Every path that acquires must
release exactly once, and `use_resource` currently leaks on two of its three
paths.

Write a small RAII guard so that `use_resource` releases correctly whatever
happens, without adding a single `release` call to the function body.

## Starter
```cpp
#include <stdexcept>
#include <vector>

inline std::vector<int> live;          // ids currently held
inline int next_id = 1;

inline int acquire() {
    int id = next_id++;
    live.push_back(id);
    return id;
}

inline void release(int id) {
    for (std::size_t i = 0; i < live.size(); ++i) {
        if (live[i] == id) { live.erase(live.begin() + static_cast<long>(i)); return; }
    }
    throw std::logic_error("released an id that was not held");
}

// Write a guard class here.

int use_resource(int mode) {
    int id = acquire();

    if (mode == 0) return id;               // leaks
    if (mode == 1) throw std::runtime_error("failed");   // leaks

    release(id);
    return id * 10;
}
```

## Tests
```cpp
live.clear();
next_id = 1;

CHECK_EQ(use_resource(2), 10);
CHECK(live.empty());

int returned = use_resource(0);
CHECK_EQ(returned, 2);
CHECK(live.empty());

bool threw = false;
try { use_resource(1); } catch (const std::runtime_error&) { threw = true; }
CHECK(threw);
CHECK(live.empty());

for (int i = 0; i < 20; ++i) {
    try { use_resource(i % 3); } catch (const std::runtime_error&) {}
}
CHECK(live.empty());
```

## Hints
- The guard's constructor should call `acquire()` and remember the id; its destructor should call `release()`.
- `use_resource` still has to return the id, so give the guard a way to read it — an `id()` member.
- The guard must not be copyable: two guards holding the same id would release it twice, and `release` throws on a double release. `= delete` both copy operations.
- Nothing in `use_resource`'s body should call `release`. If you still need to, the guard is not doing its job.

## Solution
```cpp
#include <stdexcept>
#include <vector>

inline std::vector<int> live;
inline int next_id = 1;

inline int acquire() {
    int id = next_id++;
    live.push_back(id);
    return id;
}

inline void release(int id) {
    for (std::size_t i = 0; i < live.size(); ++i) {
        if (live[i] == id) { live.erase(live.begin() + static_cast<long>(i)); return; }
    }
    throw std::logic_error("released an id that was not held");
}

class Guard {
public:
    Guard() : id_(acquire()) {}
    ~Guard() { release(id_); }

    Guard(const Guard&) = delete;
    Guard& operator=(const Guard&) = delete;

    int id() const { return id_; }

private:
    int id_;
};

int use_resource(int mode) {
    Guard guard;

    if (mode == 0) return guard.id();
    if (mode == 1) throw std::runtime_error("failed");

    return guard.id() * 10;
}
```

## Notes
The twenty-iteration loop at the end is the real test. It exercises all three
paths repeatedly, and any path that leaks or double-releases shows up as a
non-empty `live` list or a `logic_error` escaping.

Deleting the copy operations is not defensive padding. Without it,
`Guard second = first;` would copy the id, and both destructors would release
it — the same double-free shape as the `Buffer` in the chapter, just with a
different resource. The compiler would generate that copy silently.

The standard library has a general version of this: `std::unique_ptr` with a
custom deleter can wrap any acquire/release pair, and C++ has no built-in
`scope_guard` yet — though `std::experimental::scope_exit` and Boost's version
have existed for years.
