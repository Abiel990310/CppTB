---
id: break-the-cycle
title: "Break the reference cycle"
difficulty: stretch
chapter: smart-pointers
topics: [smart-pointers, ownership, lifetime]
check: unit
standard: c++20
---

Each `Employee` holds a `shared_ptr` to their manager, and each `Manager` holds
`shared_ptr`s to their reports. The two keep each other alive: when the last
named pointer goes out of scope, neither reference count reaches zero and
nothing is destroyed.

Break the cycle by making one direction non-owning, keeping the ability to reach
a manager from an employee. `Employee::manager_name()` must return the manager's
name while the manager is alive, and `"none"` once it is gone.

## Starter
```cpp
#include <memory>
#include <string>
#include <vector>

inline int live_objects = 0;

struct Manager;

struct Employee {
    std::string name;
    std::shared_ptr<Manager> manager;      // this direction causes the cycle

    explicit Employee(std::string n) : name(std::move(n)) { ++live_objects; }
    ~Employee() { --live_objects; }

    std::string manager_name() const;
};

struct Manager {
    std::string name;
    std::vector<std::shared_ptr<Employee>> reports;

    explicit Manager(std::string n) : name(std::move(n)) { ++live_objects; }
    ~Manager() { --live_objects; }
};

inline std::string Employee::manager_name() const {
    if (manager) return manager->name;
    return "none";
}
```

## Tests
```cpp
live_objects = 0;
{
    auto boss = std::make_shared<Manager>("ada");
    auto worker = std::make_shared<Employee>("grace");

    boss->reports.push_back(worker);
    worker->manager = boss;

    CHECK_EQ(live_objects, 2);
    CHECK_EQ(worker->manager_name(), std::string("ada"));
    CHECK_EQ(boss->reports[0]->name, std::string("grace"));
}
// Both must be destroyed once the named pointers are gone.
CHECK_EQ(live_objects, 0);

// An employee outliving its manager must report "none", not crash.
live_objects = 0;
{
    auto worker = std::make_shared<Employee>("alan");
    {
        auto boss = std::make_shared<Manager>("edsger");
        boss->reports.push_back(worker);
        worker->manager = boss;
        CHECK_EQ(worker->manager_name(), std::string("edsger"));
    }
    CHECK_EQ(worker->manager_name(), std::string("none"));
    CHECK_EQ(live_objects, 1);
}
CHECK_EQ(live_objects, 0);
```

## Hints
- The manager owns the reports; the employee should only observe the manager. Make `Employee::manager` a `std::weak_ptr<Manager>`.
- A `weak_ptr` cannot be dereferenced directly. Call `.lock()`, which returns a `shared_ptr` that is empty if the object is gone.
- `worker->manager = boss;` still compiles unchanged — a `weak_ptr` is assignable from a `shared_ptr`.
- In `manager_name()`, hold the result of `lock()` in a named variable while you read through it. That keeps the object alive for the duration of the call.

## Solution
```cpp
#include <memory>
#include <string>
#include <vector>

inline int live_objects = 0;

struct Manager;

struct Employee {
    std::string name;
    std::weak_ptr<Manager> manager;        // observes, does not own

    explicit Employee(std::string n) : name(std::move(n)) { ++live_objects; }
    ~Employee() { --live_objects; }

    std::string manager_name() const;
};

struct Manager {
    std::string name;
    std::vector<std::shared_ptr<Employee>> reports;

    explicit Manager(std::string n) : name(std::move(n)) { ++live_objects; }
    ~Manager() { --live_objects; }
};

inline std::string Employee::manager_name() const {
    if (auto locked = manager.lock()) return locked->name;
    return "none";
}
```

## Notes
The second block is the part a `raw Manager*` would fail. A raw pointer would
still hold the manager's old address after it was destroyed, and reading
`->name` through it would be a use-after-free — which AddressSanitizer would
catch here, and which would silently corrupt data in a build without it.
`weak_ptr::lock()` answers the question honestly instead: empty means gone.

Note the shape of the fix. Ownership went one way (manager owns reports) and
observation the other. That is the general answer to a `shared_ptr` cycle, and
it usually maps onto a real asymmetry in the domain — a parent outlives its
children, a cache outlives its entries.

Holding `lock()`'s result in a variable matters. Writing
`return manager.lock()->name;` also works, because the temporary lives to the
end of the full expression, but the named form makes the guarantee obvious and
extends to functions that do more than one thing with the object.
