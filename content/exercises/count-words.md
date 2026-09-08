---
id: count-words
title: "Count the words"
difficulty: core
chapter: strings
topics: [strings, algorithms]
check: unit
standard: c++20
---

Write `count_words`, which returns how many whitespace-separated words a string
contains. Leading, trailing, and repeated spaces must not create empty words.

## Starter
```cpp
#include <string>

int count_words(const std::string& text) {
    return 0;
}
```

## Tests
```cpp
CHECK_EQ(count_words("hello world"), 2);
CHECK_EQ(count_words(""), 0);
CHECK_EQ(count_words("   "), 0);
CHECK_EQ(count_words("  leading and trailing  "), 3);
CHECK_EQ(count_words("one"), 1);
CHECK_EQ(count_words("a  b   c"), 3);
```

## Hints
- Walk the string once, tracking whether you are currently inside a word.
- A word starts at a non-space character whose predecessor was a space (or which is first).
- `std::isspace` needs `<cctype>`; comparing against `' '` is enough for these tests but less general.

## Solution
```cpp
#include <string>
#include <cctype>

int count_words(const std::string& text) {
    int words = 0;
    bool in_word = false;
    for (unsigned char c : text) {
        if (std::isspace(c)) {
            in_word = false;
        } else if (!in_word) {
            in_word = true;
            ++words;
        }
    }
    return words;
}
```

## Notes
Counting transitions rather than separators is what makes the repeated-space
cases fall out for free. The `unsigned char` in the loop is not fussiness:
`std::isspace` has undefined behaviour for negative values, and plain `char` is
signed on most platforms, so a byte above 127 in a UTF-8 string would be
negative.
