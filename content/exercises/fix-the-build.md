---
id: fix-the-build
title: "Make it compile"
difficulty: intro
chapter: hello-machine
topics: [basics, compiler-errors]
check: unit
standard: c++20
---

This code has three separate mistakes: a missing semicolon, a misspelled name,
and a function that is declared but never defined. Fix all three so the checks
below pass.

Read the compiler's first message, fix that one thing, and check again. Do not
try to fix everything at once — that is how you end up chasing errors you
introduced yourself.

## Starter
```cpp
int triple(int x);

int square(int x) {
    return x * x
}

int apply_both(int x) {
    return squre(x) + triple(x);
}
```

## Tests
```cpp
CHECK_EQ(square(4), 16);
CHECK_EQ(triple(4), 12);
CHECK_EQ(apply_both(3), 18);
```

## Hints
- Errors are reported in the order the compiler meets them. The missing `;` is first.
- `squre` is not `square`. The compiler will tell you it was not declared in this scope.
- `int triple(int x);` promises a definition exists. Nothing defines it — so write the body.

## Solution
```cpp
int triple(int x) {
    return x * 3;
}

int square(int x) {
    return x * x;
}

int apply_both(int x) {
    return square(x) + triple(x);
}
```

## Notes
The third mistake is the interesting one. The first two stop the *compiler*; the
third gets all the way through compilation and is only caught by the *linker*,
because a declaration is a promise that some other file might have kept.
