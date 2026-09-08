---
id: review-the-copies
title: "Thirty-one copies in three functions"
difficulty: core
chapter: copies-and-moves
topics: [performance, references, parameters, review]
check: unit
standard: c++20
---

This is a code review. Three functions produce correct answers and copy `Item`
thirty-one times between them, for six items. None of the copies is deliberate.

Get all three to zero. You may change parameter types and how the loops bind
their elements; you may not change what any function returns or how the results
are computed.

## Starter
```cpp
#include <map>
#include <string>
#include <utility>
#include <vector>

// --- given, do not change ---------------------------------------------
int copies = 0;

struct Item {
    std::string name;
    int weight = 0;

    Item() = default;
    Item(std::string n, int w) : name(std::move(n)), weight(w) {}
    Item(const Item& other) : name(other.name), weight(other.weight) { ++copies; }
    Item(Item&&) noexcept = default;
    Item& operator=(const Item& other) {
        name = other.name;
        weight = other.weight;
        ++copies;
        return *this;
    }
    Item& operator=(Item&&) noexcept = default;
};
// ----------------------------------------------------------------------

int total_weight(std::vector<Item> items) {
    int total = 0;
    for (Item item : items) total += item.weight;
    return total;
}

std::vector<std::string> heavy_names(std::vector<Item> items, int limit) {
    std::vector<std::string> out;
    for (Item item : items)
        if (item.weight > limit) out.push_back(item.name);
    return out;
}

int weight_of(std::map<std::string, Item> index, std::string key) {
    if (index.count(key) == 0) return -1;
    Item found = index[key];
    return found.weight;
}
```

## Tests
```cpp
std::vector<Item> items;
for (int i = 0; i < 6; ++i) items.emplace_back("item" + std::to_string(i), i * 10);

std::map<std::string, Item> index;
for (const Item& item : items) index.emplace(item.name, item);

copies = 0;
int total = total_weight(items);
int total_copies = copies;
CHECK_EQ(total, 150);
CHECK_EQ(total_copies, 0);

copies = 0;
std::vector<std::string> heavy = heavy_names(items, 20);
int heavy_copies = copies;
CHECK_EQ(heavy.size(), std::size_t{3});
CHECK_EQ(heavy[0], std::string("item3"));
CHECK_EQ(heavy[2], std::string("item5"));
CHECK_EQ(heavy_copies, 0);

copies = 0;
int found = weight_of(index, "item3");
int found_copies = copies;
CHECK_EQ(found, 30);
CHECK_EQ(found_copies, 0);

CHECK_EQ(weight_of(index, "missing"), -1);

// The caller's data must be untouched — this is an audit, not a rewrite.
CHECK_EQ(items.size(), std::size_t{6});
CHECK_EQ(items[0].name, std::string("item0"));
CHECK_EQ(index.size(), std::size_t{6});

// An empty input still works.
std::vector<Item> nothing;
CHECK_EQ(total_weight(nothing), 0);
CHECK(heavy_names(nothing, 0).empty());
```

## Hints
- Every one of these functions only *reads* its container. A parameter that is only read should be a `const&`.
- `for (Item item : items)` copies each element into `item`. `for (const Item& item : items)` binds to it.
- `index.count(key)` followed by `index[key]` searches the map twice, and `operator[]` cannot be called on a `const` map at all — it inserts when the key is missing. `find` does one search and returns an iterator.
- `Item found = index[key];` copies the mapped value out just to read one member. Read it through the iterator: `it->second.weight`.
- The `key` parameter is a `std::string` taken by value, so every call copies the caller's string. It is only compared, never stored.
- After the changes, `weight_of` should search the map once and copy nothing.

## Solution
```cpp
#include <map>
#include <string>
#include <utility>
#include <vector>

int copies = 0;

struct Item {
    std::string name;
    int weight = 0;

    Item() = default;
    Item(std::string n, int w) : name(std::move(n)), weight(w) {}
    Item(const Item& other) : name(other.name), weight(other.weight) { ++copies; }
    Item(Item&&) noexcept = default;
    Item& operator=(const Item& other) {
        name = other.name;
        weight = other.weight;
        ++copies;
        return *this;
    }
    Item& operator=(Item&&) noexcept = default;
};

int total_weight(const std::vector<Item>& items) {
    int total = 0;
    for (const Item& item : items) total += item.weight;
    return total;
}

std::vector<std::string> heavy_names(const std::vector<Item>& items, int limit) {
    std::vector<std::string> out;
    for (const Item& item : items)
        if (item.weight > limit) out.push_back(item.name);
    return out;
}

int weight_of(const std::map<std::string, Item>& index, const std::string& key) {
    auto it = index.find(key);
    if (it == index.end()) return -1;
    return it->second.weight;
}
```

## Notes
Thirty-one copies, and not one of them was written on purpose. That is what
makes this the most valuable habit in the chapter: none of these look like
copies at the call site, and none of them produce a wrong answer.

`total_weight` and `heavy_names` each cost twelve — six for the by-value
`std::vector<Item>` parameter, six more for the by-value loop variable. The two
mistakes compound, and the second is the easier to miss, because `for (Item
item : items)` reads like it is naming the element rather than duplicating it.

`weight_of` costs seven and does three separate wrong things. The by-value
`std::map` copies all six entries before the function body starts. `count`
followed by `operator[]` searches the tree twice — and `operator[]` is not a
lookup at all: it *inserts* a default-constructed value for a missing key, which
is why it cannot be called on a `const` map, and why passing the map by
reference forces you to fix the lookup too. Then `Item found = index[key];`
copies the whole item to read one `int` from it.

The fixed version searches once, returns an `int` read through an iterator, and
allocates nothing. Note the shape of the fix in each case: nothing about the
algorithm changed. The copies were in the *interfaces* — what the parameters
promised and what the loop variables bound to — which is exactly where a
reviewer can spot them without understanding the function at all.

One thing deliberately not changed: `out.push_back(item.name)` still copies a
`std::string`, because `out` genuinely needs its own. That copy is real work the
function was asked to do. Distinguishing it from the other thirty-one is the
skill.
