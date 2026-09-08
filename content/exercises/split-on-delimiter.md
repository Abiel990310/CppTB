---
id: split-on-delimiter
title: "Split a line into fields"
difficulty: core
chapter: strings
topics: [strings, string_view, containers]
check: unit
standard: c++20
---

Write `split`, which cuts a `std::string_view` at every occurrence of a
delimiter character and returns the pieces.

Empty fields count: `"a,,b"` has three fields, the middle one empty. A trailing
delimiter produces a final empty field, so `"a,"` has two. An empty input has
one field, which is empty.

## Starter
```cpp
#include <string_view>
#include <vector>

std::vector<std::string_view> split(std::string_view text, char delimiter) {
    return {};
}
```

## Tests
```cpp
auto one = split("a,b,c", ',');
CHECK_EQ(one.size(), std::size_t{3});
CHECK_EQ(one[0], std::string_view("a"));
CHECK_EQ(one[2], std::string_view("c"));

auto empties = split("a,,b", ',');
CHECK_EQ(empties.size(), std::size_t{3});
CHECK_EQ(empties[1], std::string_view(""));

auto trailing = split("a,", ',');
CHECK_EQ(trailing.size(), std::size_t{2});
CHECK_EQ(trailing[1], std::string_view(""));

auto leading = split(",a", ',');
CHECK_EQ(leading.size(), std::size_t{2});
CHECK_EQ(leading[0], std::string_view(""));

auto none = split("abc", ',');
CHECK_EQ(none.size(), std::size_t{1});
CHECK_EQ(none[0], std::string_view("abc"));

auto empty = split("", ',');
CHECK_EQ(empty.size(), std::size_t{1});
CHECK_EQ(empty[0], std::string_view(""));

auto tabs = split("x\ty\tz", '\t');
CHECK_EQ(tabs.size(), std::size_t{3});
CHECK_EQ(tabs[1], std::string_view("y"));

// Fields must be views into the caller's buffer.
std::string line = "one;two";
auto fields = split(line, ';');
CHECK(fields[0].data() == line.data());
CHECK(fields[1].data() == line.data() + 4);
```

## Hints
- Walk with `find(delimiter, from)`. When it returns `npos`, the rest of the input is the last field.
- Every loop iteration produces exactly one field, including empty ones — so do not skip a zero-length piece.
- The last field is always pushed, even for an empty input. That is why `split("", ',')` has size 1 rather than 0.
- `substr(from, count)` on a view is free; it is just arithmetic on the pointer and length.

## Solution
```cpp
#include <string_view>
#include <vector>

std::vector<std::string_view> split(std::string_view text, char delimiter) {
    std::vector<std::string_view> fields;
    std::size_t start = 0;

    while (true) {
        const std::size_t hit = text.find(delimiter, start);
        if (hit == std::string_view::npos) {
            fields.push_back(text.substr(start));
            return fields;
        }
        fields.push_back(text.substr(start, hit - start));
        start = hit + 1;
    }
}
```

## Notes
Splitting is the operation where `string_view` most obviously pays off. A
version returning `std::vector<std::string>` allocates once per field plus once
for the vector; this one allocates only for the vector, and each field is two
machine words pointing into text that already exists.

The price is the usual one: **every returned view borrows the caller's buffer.**
If `line` is destroyed, reassigned, or grown, every field dangles. That is fine
for the common case — parse a line, use the fields, move on — and wrong the
moment you want to store the fields somewhere longer-lived. There, convert to
`std::string` deliberately and pay for it once.

The empty-input case is the one most implementations get wrong, usually by
looping while `start < size()` and so returning nothing at all for `""`.
Deciding what `split("", ',')` means is part of designing the function, and the
answer here matches how CSV and most line formats treat a blank line: one empty
field, not zero fields.
