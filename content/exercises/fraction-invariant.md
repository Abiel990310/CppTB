---
id: fraction-invariant
title: "Protect the invariant"
difficulty: core
chapter: structs-and-classes
topics: [classes, invariants, constructors]
check: unit
standard: c++20
---

`Temperature` is meant to hold a reading in degrees Celsius that can never be
below absolute zero, −273.15 °C. As written it is a struct with a public member,
so anything can put it into an impossible state.

Turn it into a class that maintains its invariant:

- construction with a value below −273.15 throws `std::out_of_range`
- the value can be read but not written directly
- `warm_by` adds to the value, and throws if that would go below absolute zero
- reading works through a `const` reference

## Starter
```cpp
#include <stdexcept>

struct Temperature {
    double celsius;

    double value() const { return celsius; }
    void warm_by(double delta) { celsius += delta; }
};
```

## Tests
```cpp
Temperature t{20.0};
CHECK_NEAR(t.value(), 20.0, 1e-9);

t.warm_by(5.0);
CHECK_NEAR(t.value(), 25.0, 1e-9);

t.warm_by(-30.0);
CHECK_NEAR(t.value(), -5.0, 1e-9);

const Temperature& frozen = t;
CHECK_NEAR(frozen.value(), -5.0, 1e-9);

bool threw = false;
try { Temperature impossible{-300.0}; } catch (const std::out_of_range&) { threw = true; }
CHECK(threw);

bool threw_absolute_zero = false;
try { Temperature exact{-273.15}; } catch (const std::out_of_range&) { threw_absolute_zero = true; }
CHECK(!threw_absolute_zero);

bool warm_threw = false;
Temperature cold{0.0};
try { cold.warm_by(-500.0); } catch (const std::out_of_range&) { warm_threw = true; }
CHECK(warm_threw);
CHECK_NEAR(cold.value(), 0.0, 1e-9);
```

## Hints
- The checks construct with `Temperature t{20.0}`, so a one-argument constructor is what you need.
- Absolute zero itself is valid — the check confirms `-273.15` does *not* throw. Use `<`, not `<=`.
- The last two checks require that a rejected `warm_by` leaves the object unchanged. Validate before you modify.
- `value()` must be callable on a `const Temperature&`, so mark it `const`.

## Solution
```cpp
#include <stdexcept>

class Temperature {
public:
    explicit Temperature(double celsius) : celsius_(celsius) {
        if (celsius_ < kAbsoluteZero) {
            throw std::out_of_range("below absolute zero");
        }
    }

    double value() const { return celsius_; }

    void warm_by(double delta) {
        const double next = celsius_ + delta;
        if (next < kAbsoluteZero) {
            throw std::out_of_range("below absolute zero");
        }
        celsius_ = next;
    }

private:
    static constexpr double kAbsoluteZero = -273.15;
    double celsius_;
};
```

## Notes
The final pair of checks is the interesting one. Computing into a local and
validating *before* assigning means a rejected call leaves the object exactly as
it was — the invariant holds even on the failure path.

Writing `celsius_ += delta;` first and then checking would leave the object in
the impossible state it just threw about, which is a strictly worse outcome than
not offering the operation at all. This is the *strong exception guarantee* in
miniature, and Chapter 6.1 gives it its proper name.
