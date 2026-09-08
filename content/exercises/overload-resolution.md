---
id: overload-resolution
title: "Resolve the ambiguity"
difficulty: core
chapter: functions
topics: [functions, overloading]
check: unit
standard: c++20
---

`render` is overloaded three ways, and two of the calls in the tests do not
compile: one is ambiguous, and one silently picks the wrong overload.

Add exactly one overload so that every call resolves to the intended function.
Do not change or remove the existing three, and do not change the tests.

The intended behaviour:

- an `int` renders as `"int:<value>"`
- a `double` renders as `"double:<value>"`
- a `std::string` renders as `"string:<value>"`
- a **`bool`** renders as `"bool:true"` or `"bool:false"`

## Starter
```cpp
#include <string>

std::string render(int value)   { return "int:" + std::to_string(value); }
std::string render(double value) {
    std::string s = std::to_string(value);
    s.erase(s.find_last_not_of('0') + 1);
    if (!s.empty() && s.back() == '.') s.pop_back();
    return "double:" + s;
}
std::string render(const std::string& value) { return "string:" + value; }
```

## Tests
```cpp
CHECK_EQ(render(42), std::string("int:42"));
CHECK_EQ(render(2.5), std::string("double:2.5"));
CHECK_EQ(render(std::string("hi")), std::string("string:hi"));

// Without a bool overload this picks render(int) and reports "int:1".
CHECK_EQ(render(true), std::string("bool:true"));
CHECK_EQ(render(false), std::string("bool:false"));
```

## Hints
- `bool` converts to `int` by an integral promotion, so `render(true)` currently matches `render(int)` and prints `int:1`.
- An **exact match** always beats a promotion, so an overload taking `bool` wins for `true` and `false`.
- Add `std::string render(bool value)` returning `"bool:true"` or `"bool:false"`.
- Adding it does not disturb `render(42)`: `int` still matches `render(int)` exactly.

## Solution
```cpp
#include <string>

std::string render(int value)   { return "int:" + std::to_string(value); }
std::string render(double value) {
    std::string s = std::to_string(value);
    s.erase(s.find_last_not_of('0') + 1);
    if (!s.empty() && s.back() == '.') s.pop_back();
    return "double:" + s;
}
std::string render(const std::string& value) { return "string:" + value; }
std::string render(bool value) { return value ? "bool:true" : "bool:false"; }
```

## Notes
`bool` silently matching `int` is one of the sharper edges in overload
resolution, because nothing warns you. A function taking `int` will happily
accept `true`, and one taking `double` will accept `true` as well — via `bool`
→ `int` → `double`. That is how `report(true)` ends up meaning `report(1.0)` in
real code.

The rule that saves you is that an exact match outranks any conversion. Adding
the `bool` overload does not perturb the others, because `42` is still an exact
match for `int` and `2.5` for `double`.

This is also the argument for `explicit` on single-argument constructors from
Chapter 3.1: the same promotion chain that makes `render(true)` compile is what
lets a `Meters` constructor silently accept a `bool`.
