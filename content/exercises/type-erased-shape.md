---
id: type-erased-shape
title: "One container, unrelated types"
difficulty: stretch
chapter: static-polymorphism
topics: [static-polymorphism, type-erasure, templates, virtual]
check: unit
standard: c++20
---

`Circle`, `Square`, and `Triangle` share no base class and know nothing about
each other. They just happen to have `area()` and `name()`.

You need all three in one `std::vector`, chosen at run time. A template cannot
do it — a `std::vector<T>` holds one `T`. Making them inherit from a common base
would work, but it forces every future shape to opt in, and it would mean
touching types you may not own.

Write `AnyShape`: a wrapper that stores *any* type with `area()` and `name()`
and answers those two questions itself. The starter accepts everything and
answers nothing.

## Starter
```cpp
#include <memory>
#include <string>
#include <utility>
#include <vector>

struct Circle {
    double radius;
    double area() const { return 3.141592653589793 * radius * radius; }
    std::string name() const { return "circle"; }
};

struct Square {
    double side;
    double area() const { return side * side; }
    std::string name() const { return "square"; }
};

struct Triangle {
    double base, height;
    double area() const { return 0.5 * base * height; }
    std::string name() const { return "triangle"; }
};

class AnyShape {
public:
    template <class T>
    AnyShape(T value) { (void)value; }

    double area() const { return 0.0; }
    std::string name() const { return "unknown"; }
};
```

## Tests
```cpp
std::vector<AnyShape> shapes;
shapes.push_back(AnyShape{Circle{1.0}});
shapes.push_back(AnyShape{Square{2.0}});
shapes.push_back(AnyShape{Triangle{3.0, 4.0}});

CHECK_EQ(shapes.size(), std::size_t{3});
CHECK_EQ(shapes[0].name(), std::string("circle"));
CHECK_EQ(shapes[1].name(), std::string("square"));
CHECK_EQ(shapes[2].name(), std::string("triangle"));

CHECK_NEAR(shapes[0].area(), 3.141592653589793, 1e-12);
CHECK_NEAR(shapes[1].area(), 4.0, 1e-12);
CHECK_NEAR(shapes[2].area(), 6.0, 1e-12);

double total = 0.0;
for (const AnyShape& s : shapes) total += s.area();
CHECK_NEAR(total, 13.141592653589793, 1e-12);

// The wrapper owns its value: the original may go away.
AnyShape kept = [] {
    Square local{5.0};
    return AnyShape{local};
}();
CHECK_NEAR(kept.area(), 25.0, 1e-12);
CHECK_EQ(kept.name(), std::string("square"));

// And it is movable, which is what lets the vector grow.
AnyShape moved = std::move(kept);
CHECK_EQ(moved.name(), std::string("square"));
```

## Hints
- This is the **type erasure** pattern. The virtual function does not disappear; it moves *inside* the wrapper, where the user never sees it.
- Declare a private abstract interface — traditionally called `Concept` — with a virtual destructor and one pure virtual per operation: `area()` and `name()`.
- Declare a private `template <class T> struct Model : Concept` that holds a `T` by value and implements each virtual by calling the corresponding member on it.
- `AnyShape`'s constructor template is what connects them: `self_ = std::make_unique<Model<T>>(std::move(value))`. `T` is deduced at the call site, which is the last moment the concrete type is known.
- `AnyShape::area()` just forwards: `return self_->area();`.
- A `std::unique_ptr` member gives you a move constructor for free and no copy constructor — which is enough for the checks, and for a `std::vector`.
- Take the constructor's parameter by value and `std::move` it in, so a temporary shape costs one move rather than a copy.

## Solution
```cpp
#include <memory>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

struct Circle {
    double radius;
    double area() const { return 3.141592653589793 * radius * radius; }
    std::string name() const { return "circle"; }
};

struct Square {
    double side;
    double area() const { return side * side; }
    std::string name() const { return "square"; }
};

struct Triangle {
    double base, height;
    double area() const { return 0.5 * base * height; }
    std::string name() const { return "triangle"; }
};

class AnyShape {
public:
    template <class T>
        requires (!std::is_same_v<std::remove_cvref_t<T>, AnyShape>)
    AnyShape(T value) : self_(std::make_unique<Model<T>>(std::move(value))) {}

    double area() const { return self_->area(); }
    std::string name() const { return self_->name(); }

private:
    struct Concept {
        virtual ~Concept() = default;
        virtual double area() const = 0;
        virtual std::string name() const = 0;
    };

    template <class T>
    struct Model final : Concept {
        T value;
        explicit Model(T v) : value(std::move(v)) {}
        double area() const override { return value.area(); }
        std::string name() const override { return value.name(); }
    };

    std::unique_ptr<Concept> self_;
};
```

## Notes
Read the shape of it: an abstract `Concept`, a `Model<T>` that implements it by
delegating, and a public class that owns a `unique_ptr<Concept>` and forwards.
That is the whole of type erasure, and it is what `std::function`,
`std::any`, and `std::shared_ptr`'s deleter are all built from.

What it buys is the reason this chapter is not simply "templates are faster".
`Circle` did not have to inherit from anything, did not have to be recompiled,
and does not know `AnyShape` exists. The virtual call is still there — it has to
be, because the type is chosen at run time — but the *coupling* that normally
comes with inheritance is not. A shape written next year works with a wrapper
compiled today.

The constraint on the constructor is not decoration. Without it,
`AnyShape(T value)` is a better match than the copy constructor for a non-const
`AnyShape` lvalue, so the compiler would build a `Model<AnyShape>` wrapping a
wrapper — the greedy-forwarding-constructor trap from Chapter 5.3, in its
natural habitat. `std::remove_cvref_t` strips the reference and the `const` so
the comparison sees the type itself.

The cost is one heap allocation per shape and one indirect call per query.
If you knew the full set of shapes at compile time, `std::variant<Circle,
Square, Triangle>` would give you the same container with neither — at the price
of having to name every alternative up front, which is exactly the trade this
chapter is about.
