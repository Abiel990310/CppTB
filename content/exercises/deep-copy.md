---
id: deep-copy
title: "Make the copy independent"
difficulty: stretch
chapter: copying
topics: [copying, ownership, raii]
check: unit
standard: c++20
---

`IntList` owns a heap array and currently relies on the compiler's memberwise
copy — so copies share one allocation, writes through one are visible through
the other, and both destructors free the same pointer.

Give it a copy constructor and a copy assignment operator that produce genuinely
independent objects. Self-assignment must be safe, and nothing may leak or
double-free — the checks run under AddressSanitizer.

## Starter
```cpp
#include <cstddef>

class IntList {
public:
    explicit IntList(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~IntList() { delete[] data_; }

    // Add the copy operations here.

    int& operator[](std::size_t i) { return data_[i]; }
    int at(std::size_t i) const { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};
```

## Tests
```cpp
{
    IntList a(3);
    a[0] = 1; a[1] = 2; a[2] = 3;

    IntList b = a;              // copy construction
    b[0] = 99;

    CHECK_EQ(a.at(0), 1);       // a must be untouched
    CHECK_EQ(b.at(0), 99);
    CHECK_EQ(b.at(1), 2);
    CHECK_EQ(b.size(), std::size_t{3});
}
{
    IntList a(2);
    a[0] = 5;
    IntList c(10);
    c = a;                      // copy assignment, different sizes

    CHECK_EQ(c.size(), std::size_t{2});
    CHECK_EQ(c.at(0), 5);

    c[0] = 42;
    CHECK_EQ(a.at(0), 5);       // still independent
}
{
    IntList a(4);
    a[3] = 7;
    a = a;                      // self-assignment must survive
    CHECK_EQ(a.size(), std::size_t{4});
    CHECK_EQ(a.at(3), 7);
}
{
    IntList a(1000);
    for (int i = 0; i < 20; ++i) {
        IntList tmp = a;        // repeated copies must not leak
        tmp[0] = i;
    }
    CHECK_EQ(a.at(0), 0);
}
```

## Hints
- The copy constructor allocates its own array and copies each element. Its members start uninitialised, so it must *initialise*, never assign.
- Copy assignment has to release what the target already holds — but only after the new allocation has succeeded.
- `a = a` must not free the buffer it is about to read. Either check `this == &other` first, or use copy-and-swap.
- The sizes differ in the second block, so assignment cannot assume the target's array is already the right length.

## Solution
```cpp
#include <cstddef>
#include <utility>

class IntList {
public:
    explicit IntList(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~IntList() { delete[] data_; }

    IntList(const IntList& other) : data_(new int[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
    }

    IntList& operator=(const IntList& other) {
        if (this == &other) return *this;

        int* fresh = new int[other.size_];
        for (std::size_t i = 0; i < other.size_; ++i) fresh[i] = other.data_[i];

        delete[] data_;
        data_ = fresh;
        size_ = other.size_;
        return *this;
    }

    int& operator[](std::size_t i) { return data_[i]; }
    int at(std::size_t i) const { return data_[i]; }
    std::size_t size() const { return size_; }

private:
    int* data_;
    std::size_t size_;
};
```

## Notes
copy-and-swap passes too, and is shorter:

```cpp
IntList& operator=(IntList other) {
    std::swap(data_, other.data_);
    std::swap(size_, other.size_);
    return *this;
}
```

It handles self-assignment without a check, gives the strong exception guarantee
for free, and lets the parameter's destructor release the old buffer.

Either way, note what the class still lacks: move operations. Every one of those
twenty loop iterations does a full 4000-byte copy of a temporary that is
destroyed immediately afterwards. The next chapter fixes that.
