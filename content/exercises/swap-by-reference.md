---
id: swap-by-reference
title: "Swap two values"
difficulty: intro
chapter: references
topics: [references, functions]
check: unit
standard: c++20
---

Write `swap_ints` so that it exchanges the values of its two arguments. The
caller must see the change, so the parameters cannot be plain copies.

## Starter
```cpp
void swap_ints(int a, int b) {
    // Make the caller's variables actually change.
}
```

## Tests
```cpp
int x = 1, y = 2;
swap_ints(x, y);
CHECK_EQ(x, 2);
CHECK_EQ(y, 1);

int same = 7;
swap_ints(same, same);
CHECK_EQ(same, 7);
```

## Hints
- A parameter declared `int a` is a copy. Changing it changes nothing outside the function.
- `int& a` makes the parameter another name for the caller's variable.
- You need somewhere to put the first value while you overwrite it.

## Solution
```cpp
void swap_ints(int& a, int& b) {
    int temp = a;
    a = b;
    b = temp;
}
```

## Notes
The last check matters more than it looks. When both references name the same
object, a careless implementation can zero it out. This one survives: `temp`
holds the value before anything is overwritten. The standard library's
`std::swap` does the same thing generically, using a move instead of a copy.
