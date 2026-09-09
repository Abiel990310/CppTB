---
id: judge-line-tokens
title: "Words per line"
difficulty: core
chapter: contest-template
topics: [io, strings, getline]
check: output
standard: c++20
timeLimitMs: 2000
---

Read `n`, then `n` lines of text. For each line, print how many
whitespace-separated words it contains.

**Input.** The first line contains `n`. The next `n` lines each contain a line of
text, which may be empty, may have leading or trailing spaces, and may have
several spaces between words.

**Output.** `n` lines, each the word count of the corresponding input line.

**Constraints.** `1 ≤ n ≤ 1000`, and each line is at most 200 characters.

The values on a line are separated by whitespace, but the *lines* matter — so
this is the one input shape where `>>` alone will not do.

## Starter
```cpp
#include <iostream>
#include <string>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    for (int i = 0; i < n; ++i) {
        std::string line;
        std::getline(std::cin, line);      // the first of these gets nothing

        int words = 0;
        for (char c : line)
            if (c != ' ') ++words;         // counts characters, not words

        std::cout << words << '\n';
    }
}
```

## Cases

### Sample
```in
4
hello world
   spaced   out   words 

single
```
```out
2
3
0
1
```

### one line
```in
1
just one line here
```
```out
4
```

### every line empty
```in
3



```
```out
0
0
0
```

### leading and trailing spaces only
```in
2
   
  a  
```
```out
0
1
```

### punctuation is part of a word
```in
3
a,b c
hello, world!
one-two three
```
```out
2
2
2
```

## Hints
- `std::cin >> n` stops at the newline and leaves it in the stream, so the first `getline` reads the empty remainder of that line. Consume it first: `std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');` — `<limits>` provides `numeric_limits`.
- Then `std::getline` once per line, `n` times.
- Counting non-space characters is not counting words. A word is a *run* of non-space characters, so `"a,b c"` is two words and not four characters' worth.
- The simplest correct counter: put the line in a `std::istringstream` and read words out of it with `>>`, which skips runs of whitespace for you. `while (stream >> word) ++count;`
- Doing it by hand works too — count each transition from whitespace into a non-whitespace character — and is the same logic as `word_count` in Chapter 9.3's `stats-library`.
- An empty line has zero words, and a line of only spaces also has zero. Both cases are in the hidden tests.
- Do not `>> std::ws` before each `getline` here: that would skip *empty lines entirely*, and empty lines are meant to produce a `0`.

## Solution
```cpp
#include <iostream>
#include <limits>
#include <sstream>
#include <string>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) return 0;

    // Discard the rest of the line holding n, so the first getline sees the
    // first real line rather than an empty remainder.
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

    for (int i = 0; i < n; ++i) {
        std::string line;
        std::getline(std::cin, line);

        std::istringstream stream(line);
        std::string word;
        int words = 0;
        while (stream >> word) ++words;    // >> skips runs of whitespace

        std::cout << words << '\n';
    }
}
```

## Notes
Two bugs, and the second one only looks like a detail.

**The `getline` after `>>`** is the chapter's trap arriving as a wrong answer.
`std::cin >> n` reads the digits and stops; the newline is still there; the first
`getline` reads from there to the end of that line and returns an empty string.
Every subsequent line is then off by one, so the last line of input is never
read at all and the final answer is the count of an empty string. The `ignore`
call is what puts the stream at the start of the first real line.

**Counting non-space characters instead of runs of them** is the sort of thing
that passes a sample and nothing else. `"hello world"` has 10 non-space
characters and 2 words; the sample happens to be one of the few inputs where the
two numbers are not obviously different if you are not looking. Reading words
out of an `istringstream` with `>>` gets it right without any special handling,
because `>>` already skips whatever run of whitespace precedes the next token —
including none, and including a hundred.

Two edges worth stating because both are in the hidden cases. A line of only
spaces has zero words: `stream >> word` fails immediately and the loop body never
runs. And an **empty** line has zero words for the same reason — but only if you
did not try to skip whitespace before reading it. `std::getline(std::cin >> std::ws, line)`
is a common way to write this, and it is wrong here: `>> std::ws` consumes
newlines too, so an empty input line is silently skipped and the next real line
takes its place. The "every line empty" case exists to catch exactly that.

Punctuation is deliberately not special. `"a,b c"` is two words because the
statement says whitespace-separated, and the checks hold you to what the
statement says rather than to what a human would call a word. Reading a
specification exactly is Chapter 10.1's first skill, and this is a small
instance of it.
