---
id: variant-shapes
title: "One of several shapes"
difficulty: stretch
chapter: vocabulary-types
topics: [variant, visit, polymorphism]
check: unit
standard: c++20
---

`area` computes the area of a shape held in a `std::variant`. It tests each
alternative with `holds_alternative`, which compiles happily when an alternative
is forgotten — and `Triangle` has been forgotten, so triangles silently return 0.

Rewrite it with `std::visit` and the `overloaded` idiom, so that every
alternative must be handled or the code does not compile.

## Starter
```cpp
#include <variant>

struct Circle   { double radius; };
struct Square   { double side; };
struct Triangle { double base; double height; };

using Shape = std::variant<Circle, Square, Triangle>;

double area(const Shape& shape) {
    if (std::holds_alternative<Circle>(shape)) {
        return 3.141592653589793 * std::get<Circle>(shape).radius
                                 * std::get<Circle>(shape).radius;
    }
    if (std::holds_alternative<Square>(shape)) {
        const double s = std::get<Square>(shape).side;
        return s * s;
    }
    return 0.0;   // Triangle silently falls through to here
}
```

## Tests
```cpp
CHECK_NEAR(area(Circle{1.0}), 3.14159265, 1e-6);
CHECK_NEAR(area(Circle{2.0}), 12.56637061, 1e-6);
CHECK_NEAR(area(Square{3.0}), 9.0, 1e-9);
CHECK_NEAR(area(Square{0.0}), 0.0, 1e-9);

// The alternative the starter forgets.
CHECK_NEAR(area(Triangle{4.0, 5.0}), 10.0, 1e-9);
CHECK_NEAR(area(Triangle{1.0, 1.0}), 0.5, 1e-9);

// Works through a variant variable too, not just a temporary.
Shape s = Triangle{6.0, 2.0};
CHECK_NEAR(area(s), 6.0, 1e-9);

s = Circle{3.0};
CHECK_NEAR(area(s), 28.27433388, 1e-6);
```

## Hints
- The `overloaded` helper is three lines:
  `template <class... Ts> struct overloaded : Ts... { using Ts::operator()...; };`
- `std::visit(overloaded{ [](const Circle& c) { ... }, ... }, shape)` calls whichever lambda matches the active alternative.
- Every lambda must return the same type, so return `double` from all three.
- A triangle's area is half base times height.

## Solution
```cpp
#include <variant>

struct Circle   { double radius; };
struct Square   { double side; };
struct Triangle { double base; double height; };

using Shape = std::variant<Circle, Square, Triangle>;

template <class... Ts>
struct overloaded : Ts... { using Ts::operator()...; };

double area(const Shape& shape) {
    return std::visit(overloaded{
        [](const Circle& c)   { return 3.141592653589793 * c.radius * c.radius; },
        [](const Square& s)   { return s.side * s.side; },
        [](const Triangle& t) { return 0.5 * t.base * t.height; },
    }, shape);
}
```

## Notes
The value of this rewrite is not that it is shorter — it is that the failure
mode changed. Delete the `Triangle` lambda and the code stops compiling, because
`std::visit` must be able to call the visitor with every alternative. Delete the
`holds_alternative<Triangle>` branch from the original and it compiles fine and
returns 0.

That difference matters most when someone adds a fourth shape a year from now.
With `visit`, the compiler lists every place that needs updating. With the
if-chain, the program keeps building and quietly reports zero areas.

`overloaded` works by inheriting from each lambda's closure type and pulling all
their `operator()`s into one overload set with a pack expansion — three lines
that Chapter 5.6 unpacks. In C++17 it also needed a deduction guide; since
C++20, class template argument deduction handles aggregates and the guide is no
longer required.
