---
id: owning-buffer
title: "A buffer that cleans up after itself"
difficulty: core
chapter: raii
topics: [raii, ownership, destructors]
check: unit
standard: c++20
---

`Buffer` allocates memory in its constructor and never gives it back. Give it a
destructor so that every allocation is matched by exactly one deallocation.

The checks run under AddressSanitizer with leak detection on, so a leak fails
the problem even if every assertion passes.

## Starter
```cpp
#include <cstddef>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]), size_(n) {
        for (std::size_t i = 0; i < n; ++i) data_[i] = 0;
    }

    // Add what is missing here.

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};
```

## Tests
```cpp
{
    Buffer b(4);
    CHECK_EQ(b.size(), std::size_t{4});
    b[0] = 42;
    CHECK_EQ(b[0], 42);
    CHECK_EQ(b[3], 0);
}
{
    Buffer big(1000);
    big[999] = 7;
    CHECK_EQ(big[999], 7);
}
```

## Hints
- A destructor is named `~Buffer()` and takes no arguments.
- Memory from `new[]` must be released with `delete[]`, not `delete`.
- The braces around each test block exist so the objects are destroyed before the program ends — that is when your destructor has to do its job.

## Solution
```cpp
#include <cstddef>

class Buffer {
public:
    explicit Buffer(std::size_t n) : data_(new int[n]), size_(n) {
        for (std::size_t i = 0; i < n; ++i) data_[i] = 0;
    }

    ~Buffer() { delete[] data_; }

    int& operator[](std::size_t i) { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};
```

## Notes
This class is now leak-free but still dangerous: copy it and both copies will
`delete[]` the same pointer. That is the subject of the copying chapter, and the
reason the rule of three exists. In real code you would reach for
`std::vector<int>` and write no destructor at all — the rule of zero.
