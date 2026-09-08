---
id: exception-safe-swap
title: "Commit with a swap"
difficulty: stretch
chapter: exceptions
topics: [exceptions, exception-safety, moving]
check: unit
standard: c++20
---

`Config::replace_all` clears the settings and then refills them from a new list.
If building the new list throws partway, the old settings are already gone and
the object is left empty — worse than either the old or the new state.

Rewrite it with the temporary-then-swap shape so it provides the **strong
guarantee**.

`validate` throws for any key that starts with `!`. Do not change it.

## Starter
```cpp
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

class Config {
public:
    void replace_all(const std::vector<std::pair<std::string, std::string>>& entries) {
        settings_.clear();
        for (const auto& [key, value] : entries) {
            validate(key);
            settings_[key] = value;
        }
    }

    std::size_t size() const { return settings_.size(); }

    std::string get(const std::string& key) const {
        auto it = settings_.find(key);
        return it == settings_.end() ? "" : it->second;
    }

private:
    static void validate(const std::string& key) {
        if (!key.empty() && key.front() == '!') {
            throw std::invalid_argument("bad key: " + key);
        }
    }

    std::map<std::string, std::string> settings_;
};
```

## Tests
```cpp
Config c;
c.replace_all({{"host", "localhost"}, {"port", "8080"}});
CHECK_EQ(c.size(), std::size_t{2});
CHECK_EQ(c.get("host"), std::string("localhost"));

// A failure partway through must leave the ORIGINAL settings intact.
bool threw = false;
try {
    c.replace_all({{"host", "example.com"}, {"!bad", "x"}, {"port", "99"}});
} catch (const std::invalid_argument&) {
    threw = true;
}
CHECK(threw);
CHECK_EQ(c.size(), std::size_t{2});
CHECK_EQ(c.get("host"), std::string("localhost"));
CHECK_EQ(c.get("port"), std::string("8080"));

// A failure on the very first entry, too.
try { c.replace_all({{"!first", "x"}}); } catch (const std::invalid_argument&) {}
CHECK_EQ(c.size(), std::size_t{2});
CHECK_EQ(c.get("host"), std::string("localhost"));

// A successful replacement still replaces everything.
c.replace_all({{"scheme", "https"}});
CHECK_EQ(c.size(), std::size_t{1});
CHECK_EQ(c.get("scheme"), std::string("https"));
CHECK_EQ(c.get("host"), std::string(""));
```

## Hints
- Build the whole new map in a **local** variable first, validating as you go.
- Only once the loop has completed without throwing may you touch `settings_`.
- `settings_.swap(fresh)` — or `settings_ = std::move(fresh)` — is the commit. `std::map::swap` is `noexcept`.
- The last block confirms it is a genuine replacement: keys not in the new list must be gone.

## Solution
```cpp
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

class Config {
public:
    void replace_all(const std::vector<std::pair<std::string, std::string>>& entries) {
        std::map<std::string, std::string> fresh;
        for (const auto& [key, value] : entries) {
            validate(key);
            fresh[key] = value;
        }
        settings_.swap(fresh);          // commit: swap on a map is noexcept
    }

    std::size_t size() const { return settings_.size(); }

    std::string get(const std::string& key) const {
        auto it = settings_.find(key);
        return it == settings_.end() ? "" : it->second;
    }

private:
    static void validate(const std::string& key) {
        if (!key.empty() && key.front() == '!') {
            throw std::invalid_argument("bad key: " + key);
        }
    }

    std::map<std::string, std::string> settings_;
};
```

## Notes
This is the general form that the previous problem's line-swap was a special
case of. There, the commit was an integer addition and ordering alone sufficed.
Here the commit is replacing a whole container, so you need somewhere to build
the new state that is not the old state — and then an exchange that cannot fail.

`std::map::swap` being `noexcept` is what makes the last step safe, and it is
why `swap` appears so often in exception-safe code. `settings_ = std::move(fresh)`
also works, because move-assigning a map does not allocate.

Note that the starter's `clear()` is the entire bug. It commits to the
destruction of the old state before knowing whether the new state can be built —
the one ordering that guarantees you can end up with neither.
