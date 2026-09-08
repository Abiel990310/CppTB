---
id: outline-the-template
title: "One template, one copy of the work"
difficulty: core
chapter: inlining-and-linking
topics: [templates, binary-size, compilation, refactoring]
check: unit
standard: c++20
---

`report<T>` builds a numbered listing. Almost none of what it does depends on
`T`: the header, the numbering, the indentation, the singular-or-plural footer
are all string work. Only one line — turning a `T` into text — is generic.

As written, every instantiation gets its own copy of all of it. Six element
types means six copies of the formatting in the binary, and six times the
template instantiation work at every build.

Split it. Move everything type-independent into a **non-template** function
called `format_report`, and leave `report<T>` as a thin adapter that converts
the values to strings and calls it.

The output must not change.

## Starter
```cpp
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

// --- given, do not change ---------------------------------------------
int shared_calls = 0;
// ----------------------------------------------------------------------

template <class T>
std::string report(std::string_view label, const std::vector<T>& values) {
    std::string out;
    out += "== ";
    out += label;
    out += " ==\n";
    for (std::size_t i = 0; i < values.size(); ++i) {
        out += "  ";
        out += std::to_string(i + 1);
        out += ". ";
        out += std::to_string(values[i]);
        out += '\n';
    }
    out += "(";
    out += std::to_string(values.size());
    out += values.size() == 1 ? " entry)" : " entries)";
    return out;
}
```

## Tests
```cpp
// The shared part must be an ordinary function with exactly this signature —
// not a template, and not a lambda.
static_assert(
    std::is_same_v<decltype(&format_report),
                   std::string (*)(std::string_view, const std::vector<std::string>&)>,
    "format_report should be a non-template function taking already-rendered strings");

// Output is unchanged.
CHECK_EQ(report<int>("Ints", {1, 2}),
         std::string("== Ints ==\n  1. 1\n  2. 2\n(2 entries)"));
CHECK_EQ(report<long>("One", {7}),
         std::string("== One ==\n  1. 7\n(1 entry)"));
CHECK_EQ(report<unsigned>("None", {}),
         std::string("== None ==\n(0 entries)"));

// Every instantiation must route through the one shared function.
shared_calls = 0;
(void)report<int>("a", {1});
(void)report<long>("b", {2});
(void)report<double>("c", {3.0});
(void)report<unsigned>("d", {4});
(void)report<long long>("e", {5});
CHECK_EQ(shared_calls, 5);

// The shared function is usable directly, which is the other half of the point.
shared_calls = 0;
std::vector<std::string> already{"alpha", "beta"};
CHECK_EQ(format_report("Direct", already),
         std::string("== Direct ==\n  1. alpha\n  2. beta\n(2 entries)"));
CHECK_EQ(shared_calls, 1);
```

## Hints
- Write `std::string format_report(std::string_view label, const std::vector<std::string>& rendered)` above the template, and move the whole body into it — replacing `std::to_string(values[i])` with `rendered[i]`.
- Increment `shared_calls` at the top of `format_report`. That is what the checks count.
- `report<T>` then has three lines of work: make a `std::vector<std::string>`, fill it with `std::to_string(v)` for each value, and return `format_report(label, rendered)`.
- `rendered.reserve(values.size())` before the loop, since you know the size.
- The `static_assert` takes the address of `format_report`, so it must be a real function. A lambda assigned to a variable will not satisfy it, and neither will a template.
- Do not change the output text. The footer really does say `entry` for exactly one and `entries` for everything else, including zero.

## Solution
```cpp
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

int shared_calls = 0;

// Type-independent: compiled once, no matter how many types use it.
std::string format_report(std::string_view label, const std::vector<std::string>& rendered) {
    ++shared_calls;

    std::string out;
    out += "== ";
    out += label;
    out += " ==\n";
    for (std::size_t i = 0; i < rendered.size(); ++i) {
        out += "  ";
        out += std::to_string(i + 1);
        out += ". ";
        out += rendered[i];
        out += '\n';
    }
    out += "(";
    out += std::to_string(rendered.size());
    out += rendered.size() == 1 ? " entry)" : " entries)";
    return out;
}

// Type-dependent: instantiated per T, and now three lines long.
template <class T>
std::string report(std::string_view label, const std::vector<T>& values) {
    std::vector<std::string> rendered;
    rendered.reserve(values.size());
    for (const T& value : values) rendered.push_back(std::to_string(value));
    return format_report(label, rendered);
}
```

## Notes
This is **outlining**, and it is the standard answer to template code bloat. The
question it asks of any template is: *which part of this body actually depends
on the template parameter?* Usually far less than the whole thing, and the rest
is being duplicated for no reason.

The measurable difference is in the object file. Before: six element types, six
full copies of the formatting logic, each emitted as a weak symbol for the
linker to deduplicate against other translation units — which it cannot do,
because they are genuinely different functions. After: one copy of the
formatting, plus six three-line adapters that the compiler will usually inline
into their callers anyway.

The standard library does this in places you would not guess. `std::vector<T*>`
for any pointer `T` is typically implemented in terms of `std::vector<void*>`
with casts at the boundary, so a program using twenty different pointer vectors
carries one implementation rather than twenty.

There is a cost, and the checks make you pay it: `report<T>` now builds a
`std::vector<std::string>` that the original did not, which is an allocation and
a set of string constructions per call. That is the trade — runtime work in
exchange for code size and build time. It is worth it when the type-independent
part is large and the conversion is cheap, and it is not worth it when the
reverse is true. As always, the profile decides; this problem is about
recognising that the choice exists.
