---
title: "Input, output, and formatting"
navTitle: "Input, output, formatting"
summary: >-
  Streams, std::format, and reading input without surprises.
objectives:
  - Format values with std::format
  - Read input robustly and detect failure
  - Explain why iostreams are slow and when it matters
status: complete
standard: c++20
requires: [strings, vocabulary-types]
---

Every program in this book so far has printed with `std::cout`. That is the
right default, and it is also the part of the standard library with the most
accumulated history — some of it worth knowing, some of it worth avoiding.

## Formatting: use std::format

C++20 added `std::format`, and it replaces both the stream-manipulator dance and
`printf`'s type-unsafe placeholders.

```cpp run title="Formatting, three generations" std=c++20
#include <format>
#include <iomanip>
#include <iostream>
#include <string>

int main() {
    const std::string name = "ada";
    const double value = 3.14159;

    // printf: terse, and the format string is unchecked at compile time.
    std::printf("%-8s %6.2f\n", name.c_str(), value);

    // iostreams: type-safe, and the manipulators are sticky and verbose.
    std::cout << std::left << std::setw(8) << name
              << std::right << std::setw(6) << std::fixed << std::setprecision(2)
              << value << '\n';

    // std::format: type-safe, checked at compile time, and reads like the output.
    std::cout << std::format("{:<8} {:>6.2f}\n", name, value);
}
```

The format string is checked **at compile time**. A mismatched placeholder is an
error, not a crash:

```cpp run expect-error title="A format string the compiler rejects"
#include <format>
#include <string>

int main() {
    // `{:d}` demands an integer; a std::string is not one.
    return std::format("{:d}", std::string{"nope"}).size();
}
```

`printf("%d", some_string)` compiles and corrupts the stack. That difference is
the reason to switch.

### The syntax worth memorising

```cpp run title="The specifiers you will actually use" std=c++20
#include <format>
#include <iostream>

int main() {
    std::cout << std::format("plain:      {}\n", 42);
    std::cout << std::format("width:      [{:8}]\n", 42);
    std::cout << std::format("left:       [{:<8}]\n", 42);
    std::cout << std::format("centre:     [{:^8}]\n", 42);
    std::cout << std::format("fill:       [{:*>8}]\n", 42);
    std::cout << std::format("precision:  {:.3f}\n", 3.14159265);
    std::cout << std::format("hex/oct/bin:{:x} {:o} {:b}\n", 255, 255, 255);
    std::cout << std::format("with base:  {:#x} {:#b}\n", 255, 255);
    std::cout << std::format("sign:       {:+} {:+}\n", 42, -42);
    std::cout << std::format("index:      {0}-{1}-{0}\n", "a", "b");
    std::cout << std::format("escaped:    {{literal braces}}\n");
}
```

`std::print` (C++23) goes one step further and writes straight to the stream, so
`std::print("{}\n", x)` replaces `std::cout << std::format(...)`.

## Reading input, and detecting failure

Output is easy. Input is where programs go wrong, because input can be anything.

```cpp run title="A read that fails" std=c++20
#include <iostream>
#include <sstream>
#include <string>

int main() {
    std::istringstream input{"42 notanumber 7"};

    int a = 0, b = 0;
    input >> a;
    std::cout << "first read ok?  " << std::boolalpha << static_cast<bool>(input)
              << ", a = " << a << '\n';

    input >> b;
    std::cout << "second read ok? " << static_cast<bool>(input)
              << ", b = " << b << "  <- unchanged, and the stream is now failed\n";

    int c = 99;
    input >> c;
    std::cout << "third read ok?  " << static_cast<bool>(input)
              << ", c = " << c << "  <- reads do nothing while failed\n";
}
```

Three things to take from that. A failed extraction leaves the variable
**unchanged** (since C++11 it is set to 0, but the value is not what you asked
for). The stream enters a **failed state**. And every subsequent read is a no-op
until you clear it — which is why a loop reading numbers without checking spins
forever on bad input.

Always test the read:

```cpp run title="Reading a whole stream, safely" std=c++20
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int main() {
    std::istringstream input{"10 20 30"};

    // The idiom: the extraction is the loop condition.
    std::vector<int> numbers;
    for (int n; input >> n; ) numbers.push_back(n);
    std::cout << "read " << numbers.size() << " numbers\n";

    // Recovering from bad input requires clearing AND discarding.
    std::istringstream messy{"1 x 3"};
    int total = 0;
    for (int n; ; ) {
        if (messy >> n) {
            total += n;
        } else if (messy.eof()) {
            break;
        } else {
            messy.clear();                       // leave the failed state
            std::string junk;
            messy >> junk;                       // discard the offending token
            std::cout << "skipped \"" << junk << "\"\n";
        }
    }
    std::cout << "total " << total << '\n';
}
```

`clear()` alone is not enough: the bad characters are still in the buffer, so
the next read fails on the same input. You must consume them too — with a string
extraction as above, or `input.ignore(...)`.

### Lines, and the mixing trap

```cpp run title="Mixing >> and getline" std=c++20
#include <iostream>
#include <sstream>
#include <string>

int main() {
    std::istringstream input{"42\nthe rest of the line\n"};

    int n = 0;
    input >> n;                       // stops AT the newline, leaving it there

    std::string line;
    std::getline(input, line);        // reads the empty remainder of line 1
    std::cout << "surprise: \"" << line << "\"\n";

    std::getline(input, line);        // now the line you wanted
    std::cout << "wanted:   \"" << line << "\"\n";
}
```

`operator>>` skips leading whitespace and stops *before* the delimiter;
`getline` reads *through* the next newline. Mixing them leaves the newline in
the buffer, and the first `getline` returns empty. The fix is
`input.ignore(std::numeric_limits<std::streamsize>::max(), '\n');` after the
`>>`, or reading lines throughout and parsing each one.

## Parsing without exceptions

`std::stoi` throws and accepts trailing garbage. `std::from_chars` does neither:

```cpp run title="from_chars: strict, and it does not throw" std=c++20
#include <charconv>
#include <iostream>
#include <optional>
#include <string_view>

std::optional<int> parse(std::string_view text) {
    int value = 0;
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), value);

    if (error != std::errc{}) return std::nullopt;       // not a number, or out of range
    if (end != text.data() + text.size()) return std::nullopt;   // trailing junk
    return value;
}

int main() {
    for (std::string_view input : {"42", "  42", "42abc", "abc", "99999999999999999999", "-7"}) {
        auto result = parse(input);
        std::cout << "\"" << input << "\" -> "
                  << (result ? std::to_string(*result) : "rejected") << '\n';
    }
}
```

Note that `"  42"` is rejected — `from_chars` does not skip leading whitespace,
which is part of being strict. It is the fastest and most predictable way to
parse a number in the standard library, and it never allocates or throws.

## Why iostreams are slow

Streams carry formatting state, locale handling, and a virtual interface, and
by default `std::cout` is kept synchronised with C's `stdout` so the two can be
interleaved. That synchronisation is the expensive part, and you can turn it off:

```cpp run title="What synchronisation costs" std=c++20
#include <chrono>
#include <iostream>
#include <sstream>

int main() {
    constexpr int n = 200'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    // Write into a string stream so the measurement is not dominated by the terminal.
    auto start = clock::now();
    {
        std::ostringstream out;
        for (int i = 0; i < n; ++i) out << "line " << i << '\n';
    }
    auto mid = clock::now();

    {
        std::ostringstream out;
        for (int i = 0; i < n; ++i) out << std::format("line {}\n", i);
    }
    auto finish = clock::now();

    std::cout << "operator<<:   " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "std::format:  " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
}
```

:::tip
For a program doing heavy I/O, two lines at the top of `main` help more than any
micro-optimisation:

```cpp
std::ios::sync_with_stdio(false);   // stop synchronising with C stdio
std::cin.tie(nullptr);              // stop flushing cout before every cin read
```

Only do this if you are not mixing `printf` with `std::cout` in the same
program. It is standard advice in competitive programming for a reason — it is
often a several-fold speedup on input-heavy work.
:::

The other common waste is `std::endl`, which writes a newline **and flushes**.
A flush is a system call. In a loop, that is thousands of them for no benefit:

```cpp run title="endl versus a newline" std=c++20
#include <chrono>
#include <iostream>
#include <sstream>

int main() {
    constexpr int n = 50'000;
    using clock = std::chrono::steady_clock;
    using us = std::chrono::microseconds;

    std::ostringstream a, b;

    auto start = clock::now();
    for (int i = 0; i < n; ++i) a << i << std::endl;
    auto mid = clock::now();
    for (int i = 0; i < n; ++i) b << i << '\n';
    auto finish = clock::now();

    std::cout << "std::endl: " << std::chrono::duration_cast<us>(mid - start).count() << " us\n";
    std::cout << "'\\n':      " << std::chrono::duration_cast<us>(finish - mid).count() << " us\n";
    std::cout << "(equal output: " << std::boolalpha << (a.str() == b.str()) << ")\n";
}
```

Use `'\n'`. Flush deliberately with `std::flush` when you actually need the
output to appear — before a prompt, or before a long computation.

## Files

`std::ifstream` and `std::ofstream` are RAII types: the destructor closes the
file, so Chapter 3.2's rules apply and there is nothing to remember.

```cpp run title="Writing and reading a file" std=c++20
#include <format>
#include <fstream>
#include <iostream>
#include <string>

int main() {
    const char* path = "/tmp/cpptb-io-demo.txt";

    {
        std::ofstream out{path};
        if (!out) { std::cout << "could not open for writing\n"; return 1; }
        for (int i = 1; i <= 3; ++i) out << std::format("line {}\n", i);
    }   // closed here, by the destructor

    std::ifstream in{path};
    if (!in) { std::cout << "could not open for reading\n"; return 1; }

    for (std::string line; std::getline(in, line); ) {
        std::cout << "read: " << line << '\n';
    }
    std::cout << "reached end of file: " << std::boolalpha << in.eof() << '\n';
}
```

**Always check the stream after opening.** A missing file does not throw by
default; it leaves the stream in a failed state, and every read from it silently
does nothing.

## Check yourself

:::quiz
{
  "question": "`int n; std::cin >> n;` receives the input `abc`. What happens?",
  "options": [
    { "text": "The program throws an exception", "why": "Streams do not throw by default. They set a failure bit, which you have to check — which is exactly why this is easy to miss." },
    { "text": "`n` is left unchanged (set to 0), the stream enters a failed state, and every later read does nothing until it is cleared", "correct": true, "why": "All three, and the third is what turns a missed check into an infinite loop: a `while (true) { cin >> n; ... }` spins forever because the bad characters are never consumed." },
    { "text": "`n` receives a garbage value from the parse attempt", "why": "Since C++11 a failed extraction writes 0, not garbage. The problem is that 0 is a plausible number, not that it is random." },
    { "text": "The stream skips the bad token and reads the next one", "why": "It does not skip anything. The offending characters stay in the buffer, which is why clear() alone does not recover — you must consume them too." }
  ]
}
:::

:::quiz
{
  "question": "Why prefer `'\\n'` over `std::endl`?",
  "options": [
    { "text": "`std::endl` writes a different character on Windows", "why": "Both produce the same newline; text-mode translation is handled by the stream, not by endl." },
    { "text": "`std::endl` also flushes, which is a system call, and in a loop that is thousands of them for no benefit", "correct": true, "why": "Right. The output is identical — as the sample checks — and the only difference is the flush. Flush deliberately when you need it, not on every line." },
    { "text": "`std::endl` is deprecated", "why": "It is not deprecated and works correctly. It is simply doing more than you usually want." },
    { "text": "`'\\n'` is type-safe and `std::endl` is not", "why": "Both are entirely type-safe. The difference is behaviour, not safety." }
  ]
}
:::

## Practice

:::exercise robust-read

:::exercise format-table

:::recap
- Use `std::format`: type-safe, checked at compile time, and it reads like the
  output. `printf`'s format string is unchecked; iostream manipulators are
  verbose and sticky.
- A failed extraction leaves the variable unchanged, sets the stream's failure
  state, and makes every later read a no-op. Test the read — `while (in >> x)`.
- Recovering needs `clear()` **and** consuming the bad characters.
- `>>` leaves the newline behind, so a following `getline` returns empty. Ignore
  to the newline, or read lines throughout.
- `std::from_chars` is the strict, non-throwing, non-allocating way to parse a
  number.
- `std::endl` flushes; `'\n'` does not. For I/O-heavy programs,
  `sync_with_stdio(false)` and `cin.tie(nullptr)` are the two lines that matter.
- File streams are RAII. Always check the stream after opening: a missing file
  fails silently.
:::
