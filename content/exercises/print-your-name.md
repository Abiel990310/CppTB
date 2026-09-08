---
id: print-your-name
title: "Print two lines"
difficulty: intro
chapter: hello-machine
topics: [basics, io]
check: output
standard: c++20
---

Write a program that prints exactly two lines:

```text
Hello, machine
Goodbye, machine
```

Both lines end with a newline. The starter already prints the first line; add
the second.

## Starter
```cpp
#include <iostream>

int main() {
    std::cout << "Hello, machine\n";
}
```

## Tests
```text
Hello, machine
Goodbye, machine
```

## Hints
- A second `std::cout << ...;` statement runs after the first one.
- Every line needs its own `\n`. Without it both lines run together.

## Solution
```cpp
#include <iostream>

int main() {
    std::cout << "Hello, machine\n";
    std::cout << "Goodbye, machine\n";
}
```

## Notes
You could also write it as one statement — `std::cout << "Hello, machine\n" << "Goodbye, machine\n";`
— because `<<` returns the stream, so the calls chain. Both compile to the same thing.
