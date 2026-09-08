---
id: find-in-range
title: "Find a value in a range"
difficulty: core
chapter: pointers
topics: [pointers, arrays, iterators]
check: unit
standard: c++20
---

Write `find_value`, which searches the range `[first, last)` for `target` and
returns a pointer to the first match, or `last` if there is none.

The half-open convention — `first` points at the first element, `last` one past
the final one — is how every standard-library algorithm works. Returning `last`
for "not found" is why `std::find` returns `end()`.

## Starter
```cpp
const int* find_value(const int* first, const int* last, int target) {
    return last;
}
```

## Tests
```cpp
int data[] = {4, 8, 15, 16, 23, 42};
const int* begin = data;
const int* end = data + 6;

CHECK(find_value(begin, end, 15) == data + 2);
CHECK_EQ(*find_value(begin, end, 15), 15);
CHECK(find_value(begin, end, 4) == data);
CHECK(find_value(begin, end, 42) == data + 5);
CHECK(find_value(begin, end, 99) == end);
CHECK(find_value(begin, begin, 4) == begin);

int repeated[] = {7, 7, 7};
CHECK(find_value(repeated, repeated + 3, 7) == repeated);
```

## Hints
- Walk a pointer from `first` while it is not equal to `last`, incrementing it each step.
- Compare with `!=` rather than `<`. That is the convention every iterator supports.
- An empty range has `first == last`, and the loop body must never run. Check the loop condition, not the body.
- Return as soon as you find a match, so the *first* one wins.

## Solution
```cpp
const int* find_value(const int* first, const int* last, int target) {
    for (const int* it = first; it != last; ++it) {
        if (*it == target) return it;
    }
    return last;
}
```

## Notes
This is `std::find`, minus the templates. Writing it once by hand is worth it:
every iterator-based algorithm in the standard library has this shape, and the
"return the end iterator for not found" convention only looks arbitrary until
you have implemented it.

Note that the loop never dereferences `last`. It compares against it and stops —
which is exactly what the one-past-the-end rule permits.
