---
id: input-shapes
title: "Four ways an input can be shaped"
difficulty: core
chapter: contest-template
topics: [io, parsing, streams]
check: unit
standard: c++20
---

Four readers, each for a different input shape, each written against a
`std::istream` so the checks can feed them without a file. All four are wrong.

- `read_counted(in)` — a count `n`, then `n` integers. Returns the integers.
- `read_until_eof(in)` — integers until the input runs out. Returns them all.
- `read_cases(in)` — a case count `t`, then for each case a count `n` followed
  by `n` integers. Returns one vector per case.
- `read_labelled(in)` — a count `n`, then `n` lines, each an integer, a space,
  and a label that may itself contain spaces. Returns the labels in order.

## Starter
```cpp
#include <istream>
#include <limits>
#include <string>
#include <vector>

std::vector<int> read_counted(std::istream& in) {
    int n;
    in >> n;
    std::vector<int> values;
    for (int i = 0; i <= n; ++i) {          // reads one too many
        int x;
        in >> x;
        values.push_back(x);
    }
    return values;
}

std::vector<int> read_until_eof(std::istream& in) {
    std::vector<int> values;
    int x;
    while (!in.eof()) {                      // eof() is set too late
        in >> x;
        values.push_back(x);
    }
    return values;
}

std::vector<std::vector<int>> read_cases(std::istream& in) {
    int tests;
    in >> tests;
    std::vector<std::vector<int>> out;
    int n;
    in >> n;                                 // reads only the first case's n
    for (int t = 0; t < tests; ++t) {
        std::vector<int> one;
        for (int i = 0; i < n; ++i) { int x; in >> x; one.push_back(x); }
        out.push_back(one);
    }
    return out;
}

std::vector<std::string> read_labelled(std::istream& in) {
    int n;
    in >> n;
    std::vector<std::string> labels;
    for (int i = 0; i < n; ++i) {
        int id;
        in >> id;
        std::string label;
        std::getline(in, label);             // keeps the leading space
        labels.push_back(label);
    }
    return labels;
}
```

## Tests
```cpp
// read_counted: exactly n values, and nothing beyond them is consumed.
{
    std::istringstream in("3\n10 20 30\n99");
    std::vector<int> v = read_counted(in);
    CHECK_EQ(v.size(), std::size_t{3});
    CHECK_EQ(v[0], 10);
    CHECK_EQ(v[2], 30);
    int leftover = 0;
    in >> leftover;
    CHECK_EQ(leftover, 99);                 // the reader stopped in the right place
}
{
    std::istringstream in("0\n");
    CHECK(read_counted(in).empty());
}

// read_until_eof: no phantom trailing value.
{
    std::istringstream in("1 2 3\n4 5\n6\n");
    std::vector<int> v = read_until_eof(in);
    CHECK_EQ(v.size(), std::size_t{6});
    CHECK_EQ(v[0], 1);
    CHECK_EQ(v[5], 6);
}
{
    std::istringstream in("");
    CHECK(read_until_eof(in).empty());
}
{
    std::istringstream in("7");
    std::vector<int> v = read_until_eof(in);
    CHECK_EQ(v.size(), std::size_t{1});
    CHECK_EQ(v[0], 7);
}

// read_cases: each case has its own n.
{
    std::istringstream in("3\n2\n1 2\n3\n3 4 5\n1\n6\n");
    std::vector<std::vector<int>> cases = read_cases(in);
    CHECK_EQ(cases.size(), std::size_t{3});
    CHECK_EQ(cases[0].size(), std::size_t{2});
    CHECK_EQ(cases[1].size(), std::size_t{3});
    CHECK_EQ(cases[2].size(), std::size_t{1});
    CHECK_EQ(cases[1][2], 5);
    CHECK_EQ(cases[2][0], 6);
}
{
    std::istringstream in("0\n");
    CHECK(read_cases(in).empty());
}

// read_labelled: labels keep their internal spaces and lose the leading one.
{
    std::istringstream in("3\n1 hello world\n2 single\n3 a b c\n");
    std::vector<std::string> labels = read_labelled(in);
    CHECK_EQ(labels.size(), std::size_t{3});
    CHECK_EQ(labels[0], std::string("hello world"));
    CHECK_EQ(labels[1], std::string("single"));
    CHECK_EQ(labels[2], std::string("a b c"));
}
{
    std::istringstream in("1\n42 x\n");
    CHECK_EQ(read_labelled(in)[0], std::string("x"));
}
```

## Hints
- `read_counted`'s loop condition is `i <= n`. That reads `n + 1` values, which is one too many — and worse, it swallows the next thing in the stream, so whatever comes after is gone.
- `read_until_eof` tests `eof()` *before* reading. The flag is only set once a read has failed, so the final iteration reads nothing, leaves `x` at its previous value, and pushes a duplicate. Test the read itself: `while (in >> x)`.
- `read_cases` reads `n` once, outside the loop. Every case has its own count, so the read belongs inside.
- `read_labelled` calls `getline` straight after `>>`, which stops at the newline and leaves it. The first `getline` therefore returns the rest of *that* line — here, a space and the label — so the label arrives with a leading space.
- Two ways to fix it: `in >> std::ws` before the `getline` to skip leading whitespace, or `in.ignore(std::numeric_limits<std::streamsize>::max(), '\n')` and then read the whole next line. The first is shorter and is what you want when the label is the rest of the current line.
- `std::ws` is in `<istream>`, which is already included.

## Solution
```cpp
#include <istream>
#include <limits>
#include <string>
#include <vector>

std::vector<int> read_counted(std::istream& in) {
    int n;
    in >> n;
    std::vector<int> values;
    values.reserve(static_cast<std::size_t>(n));
    for (int i = 0; i < n; ++i) {           // exactly n
        int x;
        in >> x;
        values.push_back(x);
    }
    return values;
}

std::vector<int> read_until_eof(std::istream& in) {
    std::vector<int> values;
    int x;
    while (in >> x) values.push_back(x);    // the read is the condition
    return values;
}

std::vector<std::vector<int>> read_cases(std::istream& in) {
    int tests;
    in >> tests;
    std::vector<std::vector<int>> out;
    for (int t = 0; t < tests; ++t) {
        int n;
        in >> n;                             // each case has its own count
        std::vector<int> one;
        one.reserve(static_cast<std::size_t>(n));
        for (int i = 0; i < n; ++i) { int x; in >> x; one.push_back(x); }
        out.push_back(std::move(one));
    }
    return out;
}

std::vector<std::string> read_labelled(std::istream& in) {
    int n;
    in >> n;
    std::vector<std::string> labels;
    for (int i = 0; i < n; ++i) {
        int id;
        in >> id;
        std::string label;
        std::getline(in >> std::ws, label);  // skip the space, then take the line
        labels.push_back(label);
        (void)id;
    }
    return labels;
}
```

## Notes
Four bugs, and three of them are about *where the stream is left*.

**Reading one too many** is not just a wrong count. `read_counted` with `i <= n`
consumes the value after the block as well, so anything that reads next gets the
wrong thing — which is why the check reads a leftover `99` afterwards and
asserts it is still there. In a real solution this manifests as the second test
case being garbage while the first was fine, which is a confusing symptom for a
one-character cause.

**`while (!in.eof())` is wrong in every language that has it**, and C++ is no
exception. The end-of-file flag is set when a read *fails*, not when the stream
is positioned at the end. So the loop runs one more time than it should, the
final `in >> x` fails, `x` keeps its previous value — since C++11 a failed
extraction writes 0, but the value pushed here is the *old* `x` in the
starter's structure — and a phantom element appears. `while (in >> x)` tests the
result of the read, which is the only reliable thing to test. The stream's
`operator bool` is what makes that read naturally.

**Reading the case count once** is the shape error rather than a stream error.
It happens to work when every case is the same size, which is exactly what a
sample input usually looks like.

**`getline` straight after `>>`** is the trap from the chapter. `>>` stops at
the newline; `getline` reads from there. Between the two there is at least a
newline, and here also the space after the id, so the label arrives with a
leading space and the check comparing against `"hello world"` fails on
`" hello world"`. `in >> std::ws` consumes any run of whitespace including the
newline, which is exactly what is wanted when the label is the remainder of the
line — and it is one token rather than the `ignore` incantation, which is worth
knowing precisely because the `ignore` version is what everyone writes first.
