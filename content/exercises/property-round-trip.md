---
id: property-round-trip
title: "State a property"
difficulty: stretch
chapter: testing
topics: [testing, property-based]
check: unit
standard: c++20
---

`encode` replaces every run of a repeated character with the character followed
by its count (`"aaab"` becomes `"a3b1"`), and `decode` reverses that. `decode`
has a bug that only shows up for counts of ten or more.

Write `round_trips`, which checks the property that `decode(encode(s)) == s` for
a given string — then fix `decode` so the property holds for every input the
checks try, including generated ones.

## Starter
```cpp
#include <string>

std::string encode(const std::string& input) {
    std::string out;
    for (std::size_t i = 0; i < input.size(); ) {
        std::size_t j = i;
        while (j < input.size() && input[j] == input[i]) ++j;
        out += input[i];
        out += std::to_string(j - i);
        i = j;
    }
    return out;
}

std::string decode(const std::string& input) {
    std::string out;
    for (std::size_t i = 0; i + 1 < input.size(); i += 2) {
        const char c = input[i];
        const int count = input[i + 1] - '0';      // only reads ONE digit
        out.append(static_cast<std::size_t>(count), c);
    }
    return out;
}

bool round_trips(const std::string& s) {
    return false;
}
```

## Tests
```cpp
// The property holds for short runs even with the bug.
CHECK(round_trips("aaab"));
CHECK(round_trips("abc"));
CHECK(round_trips(""));
CHECK(round_trips("a"));

// Ten or more of the same character is where the bug lives.
CHECK(round_trips(std::string(10, 'x')));
CHECK(round_trips(std::string(15, 'y')));
CHECK(round_trips(std::string(123, 'z')));

// Mixed, with a long run in the middle.
CHECK(round_trips("ab" + std::string(12, 'c') + "de"));

// Generated inputs, with a fixed seed so failures are reproducible.
{
    std::mt19937 rng{20260908};
    std::uniform_int_distribution<int> run_length{1, 30};
    std::uniform_int_distribution<int> letter{'a', 'c'};

    int failures = 0;
    for (int trial = 0; trial < 300; ++trial) {
        std::string input;
        for (int part = 0; part < 4; ++part) {
            input.append(static_cast<std::size_t>(run_length(rng)),
                         static_cast<char>(letter(rng)));
        }
        if (!round_trips(input)) ++failures;
    }
    CHECK_EQ(failures, 0);
}
```

## Hints
- `round_trips` is one line: `return decode(encode(s)) == s;`
- `decode` reads exactly one character as the count, so `"x10"` decodes as one `x` followed by a stray `0`.
- Read digits in a loop: advance while `std::isdigit(input[j])`, building the number.
- The loop's step is no longer a fixed `i += 2` once counts can be several digits.
- The tests need `<random>` and `<cctype>`; add them to your code.

## Solution
```cpp
#include <cctype>
#include <random>
#include <string>

std::string encode(const std::string& input) {
    std::string out;
    for (std::size_t i = 0; i < input.size(); ) {
        std::size_t j = i;
        while (j < input.size() && input[j] == input[i]) ++j;
        out += input[i];
        out += std::to_string(j - i);
        i = j;
    }
    return out;
}

std::string decode(const std::string& input) {
    std::string out;
    std::size_t i = 0;
    while (i < input.size()) {
        const char c = input[i];
        ++i;

        std::size_t count = 0;
        while (i < input.size() &&
               std::isdigit(static_cast<unsigned char>(input[i]))) {
            count = count * 10 + static_cast<std::size_t>(input[i] - '0');
            ++i;
        }
        out.append(count, c);
    }
    return out;
}

bool round_trips(const std::string& s) {
    return decode(encode(s)) == s;
}
```

## Notes
The property is one line and finds a bug that four hand-written examples missed.
That is the case for property-based testing in miniature: you do not have to
think of the ten-character run, because the generator produces it.

The fixed seed is not decoration. With a random seed this suite would fail on
some runs and pass on others, and the failing input would be gone by the time
anyone looked — the worst kind of flaky test. Seeded, a failure is reproducible
by anyone who runs it.

Note that `encode` was correct all along. A round-trip property tests both
directions at once, which is its strength and its one weakness: when it fails,
it tells you the pair is inconsistent without saying which half is wrong. Adding
one concrete assertion — `encode("aaab") == "a3b1"` — pins the direction and is
worth having alongside the property.

`std::isdigit` gets the `unsigned char` cast for the same reason as in the
word-counting problem: it has undefined behaviour for negative values, and plain
`char` is signed on most platforms.
