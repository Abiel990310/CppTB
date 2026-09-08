---
id: reverse-destruction
title: "Predict the order"
difficulty: core
chapter: lifetime-and-scope
topics: [lifetime, destructors, scope]
check: unit
standard: c++20
---

`Tracker` appends its name to a shared log when it is constructed and again when
it is destroyed. Write `run_scenario` so the log ends up exactly as the checks
expect — you are being asked to *arrange lifetimes*, not to write destructors.

The required log is:

```text
+a +b -b +c -c -a
```

So: `a` is constructed first and destroyed last, while `b` and `c` each live and
die inside `a`'s lifetime, one after the other.

## Starter
```cpp
#include <string>

inline std::string event_log;

struct Tracker {
    std::string name;
    explicit Tracker(std::string n) : name(std::move(n)) { event_log += "+" + name + " "; }
    ~Tracker() { event_log += "-" + name + " "; }
};

void run_scenario() {
    Tracker a("a");
    Tracker b("b");
    Tracker c("c");
}
```

## Tests
```cpp
event_log.clear();
run_scenario();
CHECK_EQ(event_log, std::string("+a +b -b +c -c -a "));

event_log.clear();
run_scenario();
CHECK_EQ(event_log, std::string("+a +b -b +c -c -a "));
```

## Hints
- The starter produces `+a +b +c -c -b -a`: all three live to the end of the function, then unwind in reverse.
- You cannot destroy an object early by hand. You end its lifetime by ending the block it lives in.
- An inner `{ ... }` block is a lifetime boundary. You need two of them.

## Solution
```cpp
#include <string>

inline std::string event_log;

struct Tracker {
    std::string name;
    explicit Tracker(std::string n) : name(std::move(n)) { event_log += "+" + name + " "; }
    ~Tracker() { event_log += "-" + name + " "; }
};

void run_scenario() {
    Tracker a("a");
    {
        Tracker b("b");
    }
    {
        Tracker c("c");
    }
}
```

## Notes
The second call to `run_scenario` in the checks is not padding. It confirms the
objects are genuinely recreated each call — if you had reached for `static`
to control the ordering, the second run would log nothing and the check would
catch it.

Introducing a scope purely to bound a lifetime is a real technique, not a trick
for exercises. It is how you release a lock, close a file, or free a large
buffer at a precise point without waiting for the end of the function.
