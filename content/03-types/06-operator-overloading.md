---
title: "Operator overloading"
navTitle: "Operator overloading"
summary: >-
  Making your type read like a built-in one, without making it lie.
objectives:
  - Overload arithmetic and comparison operators idiomatically
  - Use the spaceship operator to generate comparisons
  - Explain when an operator should be a member and when a free function
status: complete
standard: c++20
requires: [rule-of-zero]
---

You have been using overloaded operators since chapter 1. `std::cout << x` is a
function call; so is `a + b` on two `std::string`s, and `v[i]` on a vector. C++
lets your types join in.

The power is real and so is the temptation. The guiding rule is one sentence:
**an overloaded operator should mean what the reader already thinks it means.**

## A type worth the effort

```cpp run title="Arithmetic that reads like arithmetic" std=c++20
#include <iostream>

class Money {
public:
    constexpr explicit Money(long long cents) : cents_(cents) {}

    constexpr long long cents() const { return cents_; }

    // Compound assignment first: the others are written in terms of it.
    constexpr Money& operator+=(Money other) {
        cents_ += other.cents_;
        return *this;
    }
    constexpr Money& operator-=(Money other) {
        cents_ -= other.cents_;
        return *this;
    }
    constexpr Money& operator*=(int factor) {
        cents_ *= factor;
        return *this;
    }

    constexpr Money operator-() const { return Money{-cents_}; }

private:
    long long cents_;
};

// Free functions, built on the members. Taking the left operand by value gives
// us the copy we need to modify.
constexpr Money operator+(Money a, Money b) { return a += b; }
constexpr Money operator-(Money a, Money b) { return a -= b; }
constexpr Money operator*(Money a, int f)   { return a *= f; }
constexpr Money operator*(int f, Money a)   { return a *= f; }

std::ostream& operator<<(std::ostream& out, Money m) {
    const long long cents = m.cents();
    return out << (cents < 0 ? "-" : "") << std::abs(cents) / 100
               << '.' << (std::abs(cents) % 100 < 10 ? "0" : "")
               << std::abs(cents) % 100;
}

int main() {
    const Money price{1999};
    const Money shipping{450};

    std::cout << "price:    " << price << '\n';
    std::cout << "total:    " << price + shipping << '\n';
    std::cout << "three:    " << 3 * price << '\n';
    std::cout << "refund:   " << -price << '\n';
}
```

Two structural decisions in there are worth naming.

**Compound assignment is the primitive.** `operator+=` does the work as a
member, and `operator+` is a free function that copies its left operand and
calls it. One implementation, no duplication, and the copy is the one you needed
anyway.

**Symmetric operators are free functions.** `3 * price` only works because
`operator*(int, Money)` exists as a free function. A member operator requires
the left operand to be your type, so `3 * price` could never find it — and an
operator that works one way round but not the other is worse than none.

## Member or free?

| Operator | Where |
|---|---|
| `=`, `[]`, `()`, `->` | **must** be members |
| `+=`, `-=`, and the other compound assignments | members, by convention |
| `+`, `-`, `*`, `/`, `%` | free functions |
| `==`, `<=>` | members (C++20 handles the symmetry for you) |
| `<<`, `>>` for streams | **must** be free — the left operand is the stream |

The rule behind the table: if the left operand must be able to convert, or is
not your type, it has to be free.

## Comparison, before and after C++20

Writing comparisons used to mean six functions that had to agree with each
other. `operator<=>` — the *three-way comparison* or "spaceship" operator —
generates them:

```cpp run title="Six operators from one line" std=c++20
#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

struct Version {
    int major;
    int minor;
    int patch;

    // Memberwise comparison in declaration order, and == with it.
    auto operator<=>(const Version&) const = default;
    bool operator==(const Version&) const = default;
};

int main() {
    Version a{1, 4, 0};
    Version b{1, 10, 0};

    std::cout << std::boolalpha;
    std::cout << "a <  b: " << (a < b) << '\n';
    std::cout << "a >= b: " << (a >= b) << '\n';
    std::cout << "a == b: " << (a == b) << '\n';
    std::cout << "a != b: " << (a != b) << '\n';

    std::vector<Version> versions{{2, 0, 0}, {1, 4, 0}, {1, 10, 0}};
    std::ranges::sort(versions);
    for (const auto& v : versions) {
        std::cout << v.major << '.' << v.minor << '.' << v.patch << ' ';
    }
    std::cout << '\n';
}
```

`= default` compares members in **declaration order**, which is exactly right
for a version number and exactly wrong if your members are not in priority
order. When the ordering is not memberwise, write it:

```cpp run title="A custom ordering" std=c++20
#include <compare>
#include <iostream>
#include <string>

struct Task {
    std::string name;
    int priority;

    // Higher priority sorts first; ties broken by name.
    std::strong_ordering operator<=>(const Task& other) const {
        if (auto c = other.priority <=> priority; c != 0) return c;
        return name <=> other.name;
    }
    bool operator==(const Task& other) const = default;
};

int main() {
    Task a{"write", 2};
    Task b{"review", 5};

    std::cout << std::boolalpha;
    std::cout << "review before write: " << (b < a) << '\n';
    std::cout << "equal to itself:     " << (a == a) << '\n';
}
```

Note `other.priority <=> priority` — reversed, to sort higher first. And note
that `operator==` still has to be declared: `<=>` generates the four *relational*
operators, but equality is separate, because for many types equality is cheaper
than ordering and the compiler will not assume they agree.

:::note
The three comparison categories say how much your ordering promises.
`std::strong_ordering` means equivalent values are indistinguishable;
`std::weak_ordering` means they may differ in ways you consider irrelevant, like
case-insensitive strings; `std::partial_ordering` allows incomparable values,
which is what floating point needs because `NaN` compares false against
everything.
:::

## The operators worth overloading

**Stream output.** Almost always worth it, and always a free function:

```cpp run title="operator<< for your own type" std=c++20
#include <iostream>
#include <string>

struct Point {
    double x;
    double y;
};

std::ostream& operator<<(std::ostream& out, const Point& p) {
    return out << '(' << p.x << ", " << p.y << ')';
}

int main() {
    std::cout << "the origin is " << Point{0, 0} << '\n';
    std::cout << "and a point:   " << Point{1.5, -2.25} << '\n';
}
```

Return the stream by reference so calls chain, and take it by non-const
reference because writing modifies it.

**Subscript and call.** `operator[]` for anything indexable, `operator()` to
make a type callable — which is what a lambda is underneath:

```cpp run title="A callable object" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

struct DivisibleBy {
    int divisor;
    bool operator()(int value) const { return value % divisor == 0; }
};

int main() {
    std::vector<int> v{1, 2, 3, 4, 5, 6, 7, 8, 9};

    const auto count = std::ranges::count_if(v, DivisibleBy{3});
    std::cout << "divisible by three: " << count << '\n';

    // A lambda is exactly this, generated by the compiler.
    const auto count2 = std::ranges::count_if(v, [](int x) { return x % 3 == 0; });
    std::cout << "same with a lambda: " << count2 << '\n';
}
```

## Where it goes wrong

The failure mode is not technical — it is a reader who has to look up what your
operator means.

```cpp run title="Two overloads of the same operator" std=c++20
#include <iostream>
#include <string>
#include <vector>

struct Path {
    std::string value;
};

// Defensible: joining paths reads naturally as addition... or does it?
Path operator+(const Path& a, const Path& b) {
    return Path{a.value + "/" + b.value};
}

struct Matrix {
    std::vector<double> data;
};

// Indefensible: does * mean matrix product, or elementwise?
// The reader cannot tell, and both are plausible.
Matrix operator*(const Matrix& a, const Matrix&) { return a; }

int main() {
    Path root{"usr"};
    Path sub{"local"};
    std::cout << (root + sub).value << '\n';
    std::cout << "clearer as: root.join(sub)\n";
}
```

`std::filesystem::path` chose `operator/` for joining, which is better than `+`
because it looks like the separator it inserts. For a matrix, `multiply` and
`elementwise_multiply` are named functions for a reason.

:::pitfall
Three habits that reliably produce bad overloads:

- **Surprising semantics.** `+` that mutates, `==` that compares only some
  members, `<<` that does not write to a stream.
- **Asymmetry.** Providing `Money + int` but not `int + Money`, so half the
  call sites fail to compile for no reason the caller can see.
- **Overloading for cleverness.** `operator,`, `operator&&`, and `operator||`
  can all be overloaded, and doing so silently removes short-circuiting and
  sequencing guarantees the reader is relying on. Do not.
:::

## Check yourself

:::quiz
{
  "question": "Why must `operator<<` for a custom type be a free function?",
  "options": [
    { "text": "Because members cannot return references", "why": "They can. The obstacle is which operand comes first." },
    { "text": "Because the left operand is the stream, and you cannot add members to std::ostream", "correct": true, "why": "A member operator's left operand is always the class it belongs to, so a member on your type would only be found for `yourtype << stream` — backwards. The function has to be free." },
    { "text": "Because it needs access to private members", "why": "That would be an argument for making it a friend, not for making it free — and a public accessor removes the need entirely." },
    { "text": "Because streams are not copyable", "why": "True, and it is why the parameter is a reference, but it does not decide member versus free." }
  ]
}
:::

:::quiz
{
  "question": "You write `auto operator<=>(const T&) const = default;`. Which operators can callers now use?",
  "options": [
    { "text": "All six: <, <=, >, >=, ==, !=", "why": "Close, but equality is not generated by <=>. You must declare `operator==` separately — usually also `= default`." },
    { "text": "The four relational ones — <, <=, >, >= — but not == or !=", "correct": true, "why": "Right. Equality is deliberately separate, because for many types it is cheaper than ordering and the compiler will not assume they agree. Declaring `operator==` as defaulted alongside gives you all six." },
    { "text": "Only <=> itself; the rest need writing by hand", "why": "The rewriting rules synthesise the relational operators from <=> automatically — that is the feature's main purpose." },
    { "text": "All six, but only if the type is an aggregate", "why": "Defaulted comparison works for any class whose members are themselves comparable; aggregate-ness is not the criterion." }
  ]
}
:::

## Practice

:::exercise money-operators

:::exercise spaceship-ordering

:::recap
- An overloaded operator should mean what the reader already assumes. When in
  doubt, use a named function.
- Implement compound assignment (`+=`) as a member, then write `+` as a free
  function taking its left operand by value.
- Symmetric arithmetic must be free, or `3 * price` will not compile while
  `price * 3` does.
- `<<` and `>>` must be free: the left operand is the stream.
- `operator<=>` with `= default` generates the four relational operators from
  memberwise comparison in declaration order. `operator==` is separate and must
  be declared too.
- Never overload `,`, `&&`, or `||` — you silently remove short-circuiting.
:::
