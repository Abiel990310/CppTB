---
id: const-correct-api
title: "Make the class usable"
difficulty: core
chapter: const
topics: [const, classes, api-design]
check: unit
standard: c++20
---

`Inventory` works fine until someone tries to hold it by `const&` — then none of
its read-only operations can be called, because none of them are marked `const`.

Add `const` everywhere it belongs, so that `describe` compiles. Do not change
any function body, and do not change `describe`.

## Starter
```cpp
#include <string>
#include <vector>

class Inventory {
public:
    void add(std::string item) { items_.push_back(std::move(item)); }

    std::size_t size() { return items_.size(); }
    bool empty() { return items_.empty(); }
    const std::string& at(std::size_t i) { return items_[i]; }
    bool contains(const std::string& name) {
        for (const std::string& item : items_) {
            if (item == name) return true;
        }
        return false;
    }

private:
    std::vector<std::string> items_;
};

std::string describe(const Inventory& inv) {
    if (inv.empty()) return "empty";
    return std::to_string(inv.size()) + ":" + inv.at(0);
}
```

## Tests
```cpp
Inventory inv;
CHECK(inv.empty());
CHECK_EQ(describe(inv), std::string("empty"));

inv.add("rope");
inv.add("lamp");

CHECK_EQ(inv.size(), std::size_t{2});
CHECK(inv.contains("lamp"));
CHECK(!inv.contains("sword"));
CHECK_EQ(describe(inv), std::string("2:rope"));

const Inventory& frozen = inv;
CHECK_EQ(frozen.size(), std::size_t{2});
CHECK(frozen.contains("rope"));
CHECK_EQ(frozen.at(1), std::string("lamp"));
```

## Hints
- The `const` goes after the parameter list: `std::size_t size() const { ... }`.
- Four member functions only read. One of them modifies and must stay non-const.
- `at` already returns `const std::string&` — that is a separate promise about the return value, and it does not make the function const.

## Solution
```cpp
#include <string>
#include <vector>

class Inventory {
public:
    void add(std::string item) { items_.push_back(std::move(item)); }

    std::size_t size() const { return items_.size(); }
    bool empty() const { return items_.empty(); }
    const std::string& at(std::size_t i) const { return items_[i]; }
    bool contains(const std::string& name) const {
        for (const std::string& item : items_) {
            if (item == name) return true;
        }
        return false;
    }

private:
    std::vector<std::string> items_;
};

std::string describe(const Inventory& inv) {
    if (inv.empty()) return "empty";
    return std::to_string(inv.size()) + ":" + inv.at(0);
}
```

## Notes
Nothing about the *implementations* changed — only the promises. That is the
point: const-correctness is a property of the interface, and adding it later is
a mechanical but pervasive edit, which is why it is worth doing as you write.

`add` stays non-const because it genuinely modifies. If you tried to mark it
const the compiler would reject the body, which is the check working.
