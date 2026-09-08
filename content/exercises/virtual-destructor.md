---
id: virtual-destructor
title: "Delete it safely"
difficulty: core
chapter: inheritance
topics: [inheritance, destructors, ownership]
check: unit
standard: c++20
---

`Handle` is a base class whose derived types own resources. Deleting a derived
object through a `Handle*` currently runs only `~Handle`, so everything the
derived class owned is leaked — and the compiler says nothing.

Fix it so that deleting through the base destroys the whole object. The checks
count live objects and run under LeakSanitizer.

## Starter
```cpp
#include <memory>
#include <vector>

inline int live_resources = 0;

struct Resource {
    Resource() { ++live_resources; }
    ~Resource() { --live_resources; }
};

class Handle {
public:
    ~Handle() {}
    virtual int id() const { return 0; }
};

class OwningHandle : public Handle {
public:
    explicit OwningHandle(int id) : id_(id), resource_(std::make_unique<Resource>()) {}
    int id() const override { return id_; }
private:
    int id_;
    std::unique_ptr<Resource> resource_;
};
```

## Tests
```cpp
live_resources = 0;

{
    Handle* h = new OwningHandle(7);
    CHECK_EQ(h->id(), 7);
    CHECK_EQ(live_resources, 1);
    delete h;
    CHECK_EQ(live_resources, 0);
}

// Through a smart pointer to the base, which is the normal way to hold these.
{
    std::unique_ptr<Handle> h = std::make_unique<OwningHandle>(3);
    CHECK_EQ(h->id(), 3);
    CHECK_EQ(live_resources, 1);
}
CHECK_EQ(live_resources, 0);

// Many at once: a leak per deletion adds up.
{
    std::vector<std::unique_ptr<Handle>> handles;
    for (int i = 0; i < 100; ++i) handles.push_back(std::make_unique<OwningHandle>(i));
    CHECK_EQ(live_resources, 100);
    CHECK_EQ(handles[42]->id(), 42);
}
CHECK_EQ(live_resources, 0);
```

## Hints
- `~Handle()` is not virtual, so `delete h` on a `Handle*` resolves statically to it and never reaches `~OwningHandle`.
- Making it `virtual ~Handle() = default;` is the whole fix.
- `std::unique_ptr<Handle>` has the same problem — its deleter calls `delete` on a `Handle*`.
- Declaring a destructor suppresses the implicit move operations; the checks do not need them here, but Chapter 3.5 explains why you would declare them too.

## Solution
```cpp
#include <memory>
#include <vector>

inline int live_resources = 0;

struct Resource {
    Resource() { ++live_resources; }
    ~Resource() { --live_resources; }
};

class Handle {
public:
    virtual ~Handle() = default;
    virtual int id() const { return 0; }
};

class OwningHandle : public Handle {
public:
    explicit OwningHandle(int id) : id_(id), resource_(std::make_unique<Resource>()) {}
    int id() const override { return id_; }
private:
    int id_;
    std::unique_ptr<Resource> resource_;
};
```

## Notes
The second block is the one worth noticing, because it looks like it should be
safe. `std::unique_ptr<Handle>` is RAII done properly, the object is never
manually deleted, and it still leaks — because the deleter ultimately calls
`delete` on a `Handle*`, and that is exactly the broken operation. A smart
pointer cannot rescue a base class that is not safe to delete through.

The 100-object case makes the shape of the failure clear. One leaked `Resource`
is easy to miss; a hundred per pass through the code path is a process that
grows until it is killed.

Note the asymmetry with `id()`: that function was already `virtual`, so calls
dispatched correctly and everything *looked* right. A class can have working
polymorphism and a broken destructor at the same time, which is why "if it has
any virtual function, give it a virtual destructor" is the rule rather than a
judgement call.
