---
id: class-invariant
title: "Name the invariant"
difficulty: core
chapter: invariants
topics: [invariants, classes, assertions]
check: unit
standard: c++20
---

`Range` holds a low and a high bound and must always satisfy `low <= high`.
Right now nothing enforces that: the constructor accepts any pair, and
`set_low` and `set_high` can each break it.

Make the invariant hold:

- the constructor throws `std::invalid_argument` when `low > high`
- `set_low` throws when the new low would exceed the current high
- `set_high` throws when the new high would fall below the current low
- a rejected setter leaves the object **unchanged**
- add a private `invariant()` returning whether `low_ <= high_`, and assert it
  at the end of the constructor and of each setter

## Starter
```cpp
#include <stdexcept>

class Range {
public:
    Range(int low, int high) : low_(low), high_(high) {}

    void set_low(int low) { low_ = low; }
    void set_high(int high) { high_ = high; }

    int low() const { return low_; }
    int high() const { return high_; }
    int width() const { return high_ - low_; }

private:
    int low_;
    int high_;
};
```

## Tests
```cpp
Range r{0, 10};
CHECK_EQ(r.low(), 0);
CHECK_EQ(r.high(), 10);
CHECK_EQ(r.width(), 10);

r.set_low(3);
CHECK_EQ(r.low(), 3);
r.set_high(20);
CHECK_EQ(r.high(), 20);

// Equal bounds are allowed: low <= high, not low < high.
Range point{5, 5};
CHECK_EQ(point.width(), 0);

// The constructor rejects an inverted range.
bool ctor_threw = false;
try { Range bad{10, 0}; } catch (const std::invalid_argument&) { ctor_threw = true; }
CHECK(ctor_threw);

// A rejected setter must leave the object untouched.
bool low_threw = false;
try { r.set_low(50); } catch (const std::invalid_argument&) { low_threw = true; }
CHECK(low_threw);
CHECK_EQ(r.low(), 3);
CHECK_EQ(r.high(), 20);

bool high_threw = false;
try { r.set_high(-5); } catch (const std::invalid_argument&) { high_threw = true; }
CHECK(high_threw);
CHECK_EQ(r.high(), 20);
CHECK_EQ(r.low(), 3);

// Setting to exactly the boundary is allowed.
r.set_low(20);
CHECK_EQ(r.low(), 20);
CHECK_EQ(r.width(), 0);
```

## Hints
- Validate **before** assigning, so a rejected call leaves the members alone — the strong guarantee from Chapter 6.1.
- `set_low(low)` must reject when `low > high_`; `set_high(high)` when `high < low_`.
- The boundary cases use `<=`, so `set_low(20)` on a range ending at 20 is accepted.
- `bool invariant() const { return low_ <= high_; }`, then `assert(invariant());` at the end of the constructor and both setters.
- `assert` needs `<cassert>`.

## Solution
```cpp
#include <cassert>
#include <stdexcept>

class Range {
public:
    Range(int low, int high) : low_(low), high_(high) {
        if (low_ > high_) throw std::invalid_argument("low must not exceed high");
        assert(invariant());
    }

    void set_low(int low) {
        if (low > high_) throw std::invalid_argument("low must not exceed high");
        low_ = low;
        assert(invariant());
    }

    void set_high(int high) {
        if (high < low_) throw std::invalid_argument("high must not fall below low");
        high_ = high;
        assert(invariant());
    }

    int low() const { return low_; }
    int high() const { return high_; }
    int width() const { return high_ - low_; }

private:
    bool invariant() const { return low_ <= high_; }

    int low_;
    int high_;
};
```

## Notes
Two different mechanisms are doing two different jobs here, and the distinction
is the point of the exercise.

The **throws** handle arguments, which come from the caller and can legitimately
be wrong. They must survive into release builds, so they are real `if`
statements.

The **assert** checks that the class's own logic left the object consistent. If
it ever fires, the bug is inside `Range`, not in the caller — and it costs
nothing in release, because it is compiled out.

Note that the getters and `width()` have no assertion. A `const` member function
cannot break the invariant, so checking it there would be noise that runs on
every read.

The "unchanged after a rejected call" checks are what force validation before
assignment. Writing `low_ = low; if (low_ > high_) throw ...;` would pass the
throwing checks and fail these — leaving the object in the impossible state it
just complained about, which is strictly worse than not offering the operation.
