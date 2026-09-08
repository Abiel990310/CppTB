---
id: move-not-copy
title: "Move instead of copying"
difficulty: stretch
chapter: moving
topics: [moving, ownership, performance]
check: unit
standard: c++20
---

`Bytes` owns a heap allocation and copies it correctly. Add a move constructor
and move assignment operator so that transferring ownership costs nothing.

A moved-from object must remain destructible and safe to assign to — the usual
choice is to leave it empty.

## Starter
```cpp
#include <cstddef>
#include <utility>

class Bytes {
public:
    explicit Bytes(std::size_t n) : data_(new char[n]{}), size_(n) {}

    Bytes(const Bytes& other) : data_(new char[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
        ++copies;
    }

    Bytes& operator=(const Bytes& other) {
        if (this != &other) {
            char* fresh = new char[other.size_];
            for (std::size_t i = 0; i < other.size_; ++i) fresh[i] = other.data_[i];
            delete[] data_;
            data_ = fresh;
            size_ = other.size_;
            ++copies;
        }
        return *this;
    }

    // Add the two move operations here. Increment `moves` in each.

    ~Bytes() { delete[] data_; }

    std::size_t size() const { return size_; }
    char* data() { return data_; }

    static inline int copies = 0;
    static inline int moves = 0;

private:
    char* data_;
    std::size_t size_;
};
```

## Tests
```cpp
Bytes::copies = 0;
Bytes::moves = 0;

Bytes a(64);
a.data()[0] = 'x';

Bytes moved = std::move(a);
CHECK_EQ(Bytes::moves, 1);
CHECK_EQ(Bytes::copies, 0);
CHECK_EQ(moved.size(), std::size_t{64});
CHECK_EQ(moved.data()[0], 'x');
CHECK_EQ(a.size(), std::size_t{0});

Bytes target(8);
target = std::move(moved);
CHECK_EQ(Bytes::moves, 2);
CHECK_EQ(Bytes::copies, 0);
CHECK_EQ(target.size(), std::size_t{64});
CHECK_EQ(moved.size(), std::size_t{0});

Bytes copied = target;
CHECK_EQ(Bytes::copies, 1);
CHECK_EQ(copied.size(), std::size_t{64});
```

## Hints
- A move constructor takes `Bytes&&`. Steal the pointer, then null the source's pointer and zero its size.
- Mark both `noexcept`. `std::vector` will refuse to move your type when it grows unless the move is `noexcept`.
- Move assignment must release what it already owns before taking the new pointer, and must survive self-assignment.
- `delete[] nullptr` is legal and does nothing, which is why nulling the source pointer is enough.

## Solution
```cpp
#include <cstddef>
#include <utility>

class Bytes {
public:
    explicit Bytes(std::size_t n) : data_(new char[n]{}), size_(n) {}

    Bytes(const Bytes& other) : data_(new char[other.size_]), size_(other.size_) {
        for (std::size_t i = 0; i < size_; ++i) data_[i] = other.data_[i];
        ++copies;
    }

    Bytes& operator=(const Bytes& other) {
        if (this != &other) {
            char* fresh = new char[other.size_];
            for (std::size_t i = 0; i < other.size_; ++i) fresh[i] = other.data_[i];
            delete[] data_;
            data_ = fresh;
            size_ = other.size_;
            ++copies;
        }
        return *this;
    }

    Bytes(Bytes&& other) noexcept : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
        other.size_ = 0;
        ++moves;
    }

    Bytes& operator=(Bytes&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
            ++moves;
        }
        return *this;
    }

    ~Bytes() { delete[] data_; }

    std::size_t size() const { return size_; }
    char* data() { return data_; }

    static inline int copies = 0;
    static inline int moves = 0;

private:
    char* data_;
    std::size_t size_;
};
```

## Notes
Notice how little a move does: read two members, write two members. No
allocation, no loop, no dependence on how large the buffer is. That is the whole
value of move semantics — the cost stops scaling with the size of the data.

`std::move(a)` did not move anything by itself. It only produced an rvalue
reference, which changed which constructor overload was selected. The move
constructor is what did the work.
