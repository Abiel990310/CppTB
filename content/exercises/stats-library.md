---
id: stats-library
title: "The library the build file builds"
difficulty: intro
chapter: build-systems
topics: [strings, testing, api-design]
check: unit
standard: c++20
---

The `textstats` library from this chapter, written properly. Four functions over
a `std::string_view`, with whitespace meaning a space, a tab, or a newline.

- `word_count(text)` — how many runs of non-whitespace characters there are.
- `longest_word(text)` — the length of the longest such run.
- `line_count(text)` — how many lines, counting a trailing newline as ending the
  last line rather than starting an empty one. Empty text has zero lines.
- `average_word_length(text)` — the mean run length as a `double`, and `0.0`
  when there are no words.

All four stubs currently return zero.

## Starter
```cpp
#include <cstddef>
#include <string_view>

namespace textstats {

bool is_space(char c) { return c == ' ' || c == '\t' || c == '\n'; }

std::size_t word_count(std::string_view text) {
    return 0;
}

std::size_t longest_word(std::string_view text) {
    return 0;
}

std::size_t line_count(std::string_view text) {
    return 0;
}

double average_word_length(std::string_view text) {
    return 0.0;
}

}  // namespace textstats
```

## Tests
```cpp
using namespace textstats;

// word_count
CHECK_EQ(word_count(""), std::size_t{0});
CHECK_EQ(word_count("one"), std::size_t{1});
CHECK_EQ(word_count("the quick brown fox"), std::size_t{4});
CHECK_EQ(word_count("  a  bb  "), std::size_t{2});
CHECK_EQ(word_count("\t\n  \t"), std::size_t{0});
CHECK_EQ(word_count("a\tb\nc d"), std::size_t{4});

// longest_word
CHECK_EQ(longest_word(""), std::size_t{0});
CHECK_EQ(longest_word("the quick brown fox"), std::size_t{5});
CHECK_EQ(longest_word("aaa"), std::size_t{3});
CHECK_EQ(longest_word("  short longestword  "), std::size_t{11});
CHECK_EQ(longest_word("   "), std::size_t{0});

// line_count
CHECK_EQ(line_count(""), std::size_t{0});
CHECK_EQ(line_count("one line"), std::size_t{1});
CHECK_EQ(line_count("one line\n"), std::size_t{1});      // trailing newline ends it
CHECK_EQ(line_count("a\nb"), std::size_t{2});
CHECK_EQ(line_count("a\nb\n"), std::size_t{2});
CHECK_EQ(line_count("\n"), std::size_t{1});              // one empty line
CHECK_EQ(line_count("\n\n"), std::size_t{2});

// average_word_length
CHECK_NEAR(average_word_length(""), 0.0, 1e-12);
CHECK_NEAR(average_word_length("   "), 0.0, 1e-12);
CHECK_NEAR(average_word_length("abc"), 3.0, 1e-12);
CHECK_NEAR(average_word_length("a bb ccc"), 2.0, 1e-12);
CHECK_NEAR(average_word_length("the quick brown fox"), 4.0, 1e-12);
```

## Hints
- One pass is enough for each. Walk the characters and track whether you are currently inside a word.
- For `word_count`, increment when you transition from whitespace (or the start) into a non-space character. That is why `"  a  bb  "` is 2 and not 4.
- For `longest_word`, keep a current run length that resets to zero on whitespace, and a best seen so far.
- `line_count` counts newline characters, plus one more if the text does not end in a newline and is not empty. Check the empty case first.
- `average_word_length` is the total number of non-whitespace characters divided by the word count. Guard against dividing by zero.
- Cast before dividing: `static_cast<double>(letters) / static_cast<double>(words)`. Two `std::size_t`s divide as integers and truncate.
- `std::string_view::back()` on an empty view is undefined behaviour, so test `text.empty()` before reaching for the last character.

## Solution
```cpp
#include <cstddef>
#include <string_view>

namespace textstats {

bool is_space(char c) { return c == ' ' || c == '\t' || c == '\n'; }

std::size_t word_count(std::string_view text) {
    std::size_t words = 0;
    bool inside = false;
    for (char c : text) {
        if (is_space(c)) inside = false;
        else if (!inside) { inside = true; ++words; }
    }
    return words;
}

std::size_t longest_word(std::string_view text) {
    std::size_t best = 0;
    std::size_t current = 0;
    for (char c : text) {
        if (is_space(c)) current = 0;
        else if (++current > best) best = current;
    }
    return best;
}

std::size_t line_count(std::string_view text) {
    if (text.empty()) return 0;
    std::size_t lines = 0;
    for (char c : text)
        if (c == '\n') ++lines;
    if (text.back() != '\n') ++lines;      // a final line with no newline
    return lines;
}

double average_word_length(std::string_view text) {
    std::size_t words = word_count(text);
    if (words == 0) return 0.0;

    std::size_t letters = 0;
    for (char c : text)
        if (!is_space(c)) ++letters;

    return static_cast<double>(letters) / static_cast<double>(words);
}

}  // namespace textstats
```

## Notes
Nothing here is difficult, and that is deliberate: this is the code the build
system chapter builds, and having it in front of you makes the `CMakeLists.txt`
concrete rather than abstract. The library is `src/stats.cpp`, its declarations
are `include/textstats/stats.h`, and the checks above are `tests/test_stats.cpp`.

The interesting decisions are all at the edges, which is usual for text
processing.

**`"  a  bb  "` is two words, not four.** Counting spaces and adding one is the
obvious implementation and it is wrong for leading, trailing, or doubled
separators. Tracking whether you are *inside* a word makes every one of those
cases fall out with no special handling.

**`"one line\n"` is one line, not two.** A trailing newline terminates the last
line; it does not begin an empty one. Every text tool agrees on this — `wc -l`
counts newlines, so it says 1 for that input too — and getting it wrong shows up
as an off-by-one on every file that ends the way files normally do. The
implementation earns it by asking whether the *last character* is a newline
rather than by trying to be clever in the loop.

**The average divides in floating point.** `letters / words` with two
`std::size_t`s is integer division: `"a bb ccc"` would give 2 by luck and
`"the quick brown fox"` would give 4 by luck, and something like `"a bb"` would
give 1 where the answer is 1.5. The `static_cast` is what makes the type of the
division match the type of the answer.

**`text.back()` needs a non-empty view.** `std::string_view` does not check, so
the empty guard at the top of `line_count` is doing real work — remove it and
the empty case is undefined behaviour that happens to return 0 most of the time.

Each of these is one line of code and one test. That ratio is what a test suite
is for: not proving the happy path works, but pinning down the decisions you
made at the edges so that the next person — including you — cannot quietly
change them.
