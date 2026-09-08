---
id: optional-lookup
title: "Absence without sentinels"
difficulty: core
chapter: vocabulary-types
topics: [optional, containers, api-design]
check: unit
standard: c++20
---

`find_score` looks up a name in a map. Rewrite it to return
`std::optional<int>` instead of `-1`, so that "not found" cannot be confused
with a real score.

## Starter
```cpp
#include <map>
#include <optional>
#include <string>

std::optional<int> find_score(const std::map<std::string, int>& scores,
                              const std::string& name) {
    return -1;
}
```

## Tests
```cpp
std::map<std::string, int> scores{{"ada", 100}, {"grace", -1}, {"alan", 0}};

CHECK(find_score(scores, "ada").has_value());
CHECK_EQ(find_score(scores, "ada").value(), 100);

CHECK(find_score(scores, "alan").has_value());
CHECK_EQ(find_score(scores, "alan").value(), 0);

CHECK(find_score(scores, "grace").has_value());
CHECK_EQ(find_score(scores, "grace").value(), -1);

CHECK(!find_score(scores, "nobody").has_value());
CHECK_EQ(find_score(scores, "nobody").value_or(999), 999);
```

## Hints
- `scores.find(name)` returns an iterator; it equals `scores.end()` when there is no such key.
- Returning `std::nullopt` gives an empty optional. Returning an `int` builds a filled one implicitly.
- Do not use `scores[name]` — `operator[]` on a map *inserts* a default entry when the key is missing, and it will not compile on a const map anyway.

## Solution
```cpp
#include <map>
#include <optional>
#include <string>

std::optional<int> find_score(const std::map<std::string, int>& scores,
                              const std::string& name) {
    auto it = scores.find(name);
    if (it == scores.end()) return std::nullopt;
    return it->second;
}
```

## Notes
The test for `"grace"` is the point of the exercise. With a `-1` sentinel, a
legitimate score of `-1` is indistinguishable from failure, and no amount of
documentation fixes that. `std::optional` moves the distinction into the type,
where the compiler can help.
