---
id: no-leak-on-throw
title: "The leak on the exception path"
difficulty: core
chapter: stack-and-heap
topics: [ownership, exceptions, raii]
check: unit
standard: c++20
---

`transform_all` allocates a working buffer, does some work, and deletes the
buffer at the end. When the work throws, the `delete[]` is jumped over and the
buffer leaks.

Fix it so nothing leaks on either path. The checks run under LeakSanitizer, so a
leak fails the problem even though every assertion passes.

Do not add a `try`/`catch` around the delete — fix it by choosing a type that
cleans up after itself.

## Starter
```cpp
#include <stdexcept>
#include <cstddef>

int transform_all(std::size_t n, bool should_throw) {
    int* buffer = new int[n];

    for (std::size_t i = 0; i < n; ++i) buffer[i] = static_cast<int>(i) * 2;

    if (should_throw) {
        throw std::runtime_error("work failed");
    }

    int total = 0;
    for (std::size_t i = 0; i < n; ++i) total += buffer[i];

    delete[] buffer;
    return total;
}
```

## Tests
```cpp
CHECK_EQ(transform_all(5, false), 20);
CHECK_EQ(transform_all(1, false), 0);
CHECK_EQ(transform_all(0, false), 0);

bool threw = false;
try {
    transform_all(1000, true);
} catch (const std::runtime_error&) {
    threw = true;
}
CHECK(threw);

for (int i = 0; i < 50; ++i) {
    try { transform_all(100, true); } catch (const std::runtime_error&) {}
}
CHECK(true);
```

## Hints
- The throw jumps straight past the `delete[]`. Adding a second `delete[]` before the throw would work here but not for the next exit path someone adds.
- `std::vector<int> buffer(n);` owns its memory and frees it in its destructor, which runs during stack unwinding.
- Once the vector owns the memory, the `delete[]` must go — deleting memory you do not own is worse than leaking it.

## Solution
```cpp
#include <stdexcept>
#include <cstddef>
#include <vector>

int transform_all(std::size_t n, bool should_throw) {
    std::vector<int> buffer(n);

    for (std::size_t i = 0; i < n; ++i) buffer[i] = static_cast<int>(i) * 2;

    if (should_throw) {
        throw std::runtime_error("work failed");
    }

    int total = 0;
    for (std::size_t i = 0; i < n; ++i) total += buffer[i];

    return total;
}
```

## Notes
The loop of fifty throwing calls at the end is there to make the leak
unmissable: one leaked buffer might be lost in the noise of a report, fifty
thousand leaked ints is not.

`std::unique_ptr<int[]> buffer(new int[n]);` also passes, and is the right tool
when you genuinely need a fixed-size array and nothing else. `std::vector` is
usually preferable anyway because it knows its own size.
