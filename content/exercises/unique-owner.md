---
id: unique-owner
title: "Give it a single owner"
difficulty: core
chapter: smart-pointers
topics: [smart-pointers, ownership, raii]
check: unit
standard: c++20
---

`Registry` stores polymorphic `Sensor` objects as raw pointers and deletes them
in its destructor. It leaks on any path that throws, it cannot be moved, and its
compiler-generated copy would double-free.

Replace the raw pointers with `std::unique_ptr<Sensor>` so the class owns its
sensors correctly and needs no destructor at all. Keep the public interface
exactly as it is.

The checks run under AddressSanitizer with leak detection on.

## Starter
```cpp
#include <string>
#include <vector>

struct Sensor {
    virtual ~Sensor() = default;
    virtual int read() const = 0;
};

struct Constant : Sensor {
    int value;
    explicit Constant(int v) : value(v) {}
    int read() const override { return value; }
};

struct Doubler : Sensor {
    int value;
    explicit Doubler(int v) : value(v) {}
    int read() const override { return value * 2; }
};

class Registry {
public:
    ~Registry() {
        for (Sensor* s : sensors_) delete s;
    }

    void add(Sensor* sensor) { sensors_.push_back(sensor); }

    std::size_t size() const { return sensors_.size(); }

    int total() const {
        int sum = 0;
        for (const Sensor* s : sensors_) sum += s->read();
        return sum;
    }

private:
    std::vector<Sensor*> sensors_;
};
```

## Tests
```cpp
{
    Registry r;
    r.add(std::make_unique<Constant>(5));
    r.add(std::make_unique<Doubler>(10));

    CHECK_EQ(r.size(), std::size_t{2});
    CHECK_EQ(r.total(), 25);
}
{
    // Moving the registry must transfer ownership, not copy or leak.
    Registry source;
    source.add(std::make_unique<Constant>(7));

    Registry moved = std::move(source);
    CHECK_EQ(moved.size(), std::size_t{1});
    CHECK_EQ(moved.total(), 7);
}
{
    Registry r;
    for (int i = 0; i < 100; ++i) r.add(std::make_unique<Constant>(1));
    CHECK_EQ(r.total(), 100);
}
```

## Hints
- `add` must take `std::unique_ptr<Sensor>` by value — the checks call it with `std::make_unique`, and a by-value smart pointer is how a signature says "I take ownership".
- Inside `add`, `std::move` the parameter into the vector. Without the move it will not compile, because a unique_ptr cannot be copied.
- Once the vector holds `std::unique_ptr<Sensor>`, the destructor has nothing to do. Delete it — that is the point of the exercise.
- `total()` is `const`, so iterate with `const auto&`. Calling `->read()` through a const unique_ptr is fine; the constness applies to the pointer, not the pointee.

## Solution
```cpp
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct Sensor {
    virtual ~Sensor() = default;
    virtual int read() const = 0;
};

struct Constant : Sensor {
    int value;
    explicit Constant(int v) : value(v) {}
    int read() const override { return value; }
};

struct Doubler : Sensor {
    int value;
    explicit Doubler(int v) : value(v) {}
    int read() const override { return value * 2; }
};

class Registry {
public:
    void add(std::unique_ptr<Sensor> sensor) { sensors_.push_back(std::move(sensor)); }

    std::size_t size() const { return sensors_.size(); }

    int total() const {
        int sum = 0;
        for (const auto& s : sensors_) sum += s->read();
        return sum;
    }

private:
    std::vector<std::unique_ptr<Sensor>> sensors_;
};
```

## Notes
The destructor disappearing is the headline, but the move check is the one that
proves the refactor was worth it. The original class had a hand-written
destructor, which suppressed the implicit move operations — so `Registry moved =
std::move(source);` would have deep-copied a vector of raw pointers, leaving two
registries that both delete the same sensors. Removing the destructor restored
the move, and the move of a `vector<unique_ptr<Sensor>>` transfers ownership
correctly for free.

Note also that `Registry` is now automatically non-copyable, because
`unique_ptr` is. For a type that exclusively owns its contents, that is the
right default, and you got it without writing `= delete`.
