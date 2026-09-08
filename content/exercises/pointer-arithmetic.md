---
id: sum-through-pointer
title: "Sum an array through a pointer"
difficulty: core
chapter: pointers
topics: [pointers, arrays]
check: unit
standard: c++20
---

Write `sum` so it adds up `count` integers starting at `first`. You are given a
pointer and a length — the array's size is not recoverable from the pointer
itself, which is exactly why the length is a separate parameter.

## Starter
```cpp
int sum(const int* first, int count) {
    return 0;
}
```

## Tests
```cpp
int data[] = {1, 2, 3, 4, 5};
CHECK_EQ(sum(data, 5), 15);
CHECK_EQ(sum(data, 0), 0);
CHECK_EQ(sum(data, 1), 1);
CHECK_EQ(sum(data + 2, 3), 12);
```

## Hints
- `first[i]` and `*(first + i)` mean exactly the same thing.
- Adding 1 to an `int*` advances by one `int`, not by one byte.
- `sum(data, 0)` must return 0 without reading anything. Check the loop condition, not the body.

## Solution
```cpp
int sum(const int* first, int count) {
    int total = 0;
    for (int i = 0; i < count; ++i) {
        total += first[i];
    }
    return total;
}
```

## Notes
The `const` on `const int*` says this function will not modify what it points
at. It costs nothing and lets callers pass arrays they want protected. Note also
that `sum(data + 2, 3)` works: a pointer into the middle of an array is a
perfectly good starting point, which is the whole idea behind iterators.
