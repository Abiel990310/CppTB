---
id: shape-hierarchy
title: "Dispatch, and do not slice"
difficulty: core
chapter: inheritance
topics: [inheritance, polymorphism, slicing]
check: unit
standard: c++20
---

`total_area` sums the areas of a collection of shapes. It takes its elements by
value, so every shape is sliced to its base type and reports the base area of
zero.

Fix the hierarchy and the function so that dispatch works:

- `Shape` needs a virtual destructor and a pure virtual `area()`
- `describe` must report the derived name
- `total_area` must not slice

## Starter
```cpp
#include <memory>
#include <string>
#include <vector>

struct Shape {
    double area() const { return 0.0; }
    std::string name() const { return "shape"; }
};

struct Circle : Shape {
    double radius;
    explicit Circle(double r) : radius(r) {}
    double area() const { return 3.141592653589793 * radius * radius; }
    std::string name() const { return "circle"; }
};

struct Rectangle : Shape {
    double width;
    double height;
    Rectangle(double w, double h) : width(w), height(h) {}
    double area() const { return width * height; }
    std::string name() const { return "rectangle"; }
};

double total_area(const std::vector<std::unique_ptr<Shape>>& shapes) {
    double total = 0;
    for (const auto& s : shapes) total += s->area();
    return total;
}

std::string describe(Shape shape) {
    return shape.name();
}
```

## Tests
```cpp
std::vector<std::unique_ptr<Shape>> shapes;
shapes.push_back(std::make_unique<Circle>(1.0));
shapes.push_back(std::make_unique<Rectangle>(2.0, 3.0));

CHECK_NEAR(total_area(shapes), 3.141592653589793 + 6.0, 1e-9);

CHECK_EQ(shapes[0]->name(), std::string("circle"));
CHECK_EQ(shapes[1]->name(), std::string("rectangle"));
CHECK_NEAR(shapes[1]->area(), 6.0, 1e-9);

Circle c{2.0};
Rectangle r{4.0, 5.0};
CHECK_EQ(describe(c), std::string("circle"));
CHECK_EQ(describe(r), std::string("rectangle"));

std::vector<std::unique_ptr<Shape>> empty;
CHECK_NEAR(total_area(empty), 0.0, 1e-9);
```

## Hints
- `area()` and `name()` must be `virtual` in `Shape`, and marked `override` in the derived classes.
- Make `area()` pure virtual (`= 0`) — a generic shape has no area, and that makes `Shape` abstract.
- `Shape` needs `virtual ~Shape() = default;` or deleting through the base leaks.
- `describe(Shape shape)` slices its argument. Take `const Shape&` instead.
- Once `Shape` is abstract, a by-value parameter will not even compile — which is the language catching the slice for you.

## Solution
```cpp
#include <memory>
#include <string>
#include <vector>

struct Shape {
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual std::string name() const = 0;
};

struct Circle : Shape {
    double radius;
    explicit Circle(double r) : radius(r) {}
    double area() const override { return 3.141592653589793 * radius * radius; }
    std::string name() const override { return "circle"; }
};

struct Rectangle : Shape {
    double width;
    double height;
    Rectangle(double w, double h) : width(w), height(h) {}
    double area() const override { return width * height; }
    std::string name() const override { return "rectangle"; }
};

double total_area(const std::vector<std::unique_ptr<Shape>>& shapes) {
    double total = 0;
    for (const auto& s : shapes) total += s->area();
    return total;
}

std::string describe(const Shape& shape) {
    return shape.name();
}
```

## Notes
Making `area()` and `name()` pure virtual does more than express intent — it
makes `Shape` abstract, and an abstract type cannot be passed by value at all.
`describe(Shape shape)` stops compiling, so the slicing bug becomes a compile
error rather than a silent zero. That is the general technique: when a mistake
is possible, look for a formulation in which it is not representable.

Note that `total_area` was already correct. It holds `unique_ptr<Shape>` and
calls through `->`, so it dispatches properly the moment the functions become
virtual. The starter's zero result came entirely from the missing `virtual`, not
from anything wrong at the call site — which is the failure mode to recognise:
correct-looking calling code producing base-class answers.
