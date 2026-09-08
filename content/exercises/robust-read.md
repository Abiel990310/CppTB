---
id: robust-read
title: "Read past the bad input"
difficulty: core
chapter: io-and-formatting
topics: [io, streams, error-handling]
check: unit
standard: c++20
---

`sum_numbers` reads integers from a stream and adds them up, skipping any token
that is not a number. It calls `clear()` when a read fails but never consumes
the offending characters — so the same bad token fails forever and the loop
never ends.

Fix it so it sums every number and skips every non-number.

## Starter
```cpp
#include <istream>
#include <string>

int sum_numbers(std::istream& in) {
    int total = 0;
    for (int n; ; ) {
        if (in >> n) {
            total += n;
        } else if (in.eof()) {
            break;
        } else {
            in.clear();          // the bad characters are still in the buffer
        }
    }
    return total;
}
```

## Tests
```cpp
{
    std::istringstream in{"1 2 3"};
    CHECK_EQ(sum_numbers(in), 6);
}
{
    std::istringstream in{"1 x 2"};
    CHECK_EQ(sum_numbers(in), 3);
}
{
    std::istringstream in{"skip these all 4"};
    CHECK_EQ(sum_numbers(in), 4);
}
{
    std::istringstream in{"nothing here at all"};
    CHECK_EQ(sum_numbers(in), 0);
}
{
    std::istringstream in{""};
    CHECK_EQ(sum_numbers(in), 0);
}
{
    std::istringstream in{"10 -3 x 5 y"};
    CHECK_EQ(sum_numbers(in), 12);
}
```

## Hints
- `clear()` leaves the failed state but does not remove the characters that caused it.
- Extracting into a `std::string` after clearing consumes exactly one whitespace-separated token.
- `in.ignore(std::numeric_limits<std::streamsize>::max(), ' ')` is the other way, and needs `<limits>`.
- Without the fix these tests hang rather than fail, which is the failure mode to recognise.

## Solution
```cpp
#include <istream>
#include <string>

int sum_numbers(std::istream& in) {
    int total = 0;
    for (int n; ; ) {
        if (in >> n) {
            total += n;
        } else if (in.eof()) {
            break;
        } else {
            in.clear();
            std::string junk;
            in >> junk;          // consume the token that would not parse
        }
    }
    return total;
}
```

## Notes
An infinite loop is a distinctive failure here, and the run times out rather
than reporting a wrong answer. When a stream loop hangs, this is almost always
why: something cleared the failure without consuming the input that caused it.

The `""` case is worth tracing. The first `>>` fails immediately and sets both
`failbit` and `eofbit`, so the `eof()` branch breaks and the function returns 0
without ever reaching the recovery path.

Note also the order of the checks: `eof()` is tested *before* the recovery
branch. Reversing them would try to consume a token at end of stream, which
fails, leaving the loop spinning again.
