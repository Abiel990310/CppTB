---
id: reduce-the-case
title: "Reduce it, then fix it"
difficulty: core
chapter: debugging
topics: [debugging, undefined-behaviour, strings]
check: unit
standard: c++20
---

`truncate` shortens a string to at most `width` characters, appending `"..."`
when it had to cut. It works for comfortable widths and breaks for small ones —
the reduced case is `truncate("anything", 2)`.

Fix it so it is correct for every width, including 0, 1, 2, and 3, where there
is not enough room for the ellipsis.

The required behaviour:

- if the string already fits in `width`, return it unchanged
- if `width` is 3 or less, return the first `width` characters with no ellipsis
- otherwise return the first `width - 3` characters followed by `"..."`, so the
  result is exactly `width` characters

## Starter
```cpp
#include <string>

std::string truncate(const std::string& text, std::size_t width) {
    if (text.size() <= width) return text;
    return text.substr(0, width - 3) + "...";
}
```

## Tests
```cpp
CHECK_EQ(truncate("short", 10), std::string("short"));
CHECK_EQ(truncate("exactly-10", 10), std::string("exactly-10"));
CHECK_EQ(truncate("a much longer line", 10), std::string("a much ..."));
CHECK_EQ(truncate("a much longer line", 10).size(), std::size_t{10});

// The reduced case, and its neighbours.
CHECK_EQ(truncate("anything", 0), std::string(""));
CHECK_EQ(truncate("anything", 1), std::string("a"));
CHECK_EQ(truncate("anything", 2), std::string("an"));
CHECK_EQ(truncate("anything", 3), std::string("any"));
CHECK_EQ(truncate("anything", 4), std::string("a..."));
CHECK_EQ(truncate("anything", 4).size(), std::size_t{4});

CHECK_EQ(truncate("", 0), std::string(""));
CHECK_EQ(truncate("", 5), std::string(""));
```

## Hints
- `width` is `std::size_t`, which is unsigned — so `width - 3` with `width == 2` is not `-1` but an enormous number.
- `substr` with a length larger than the string returns the whole string, so the bug shows up as "no truncation happened, plus an ellipsis" rather than a crash.
- Handle `width <= 3` before doing any arithmetic on `width`.
- Check the sizes: for width 4 and above the result must be exactly `width` characters.

## Solution
```cpp
#include <string>

std::string truncate(const std::string& text, std::size_t width) {
    if (text.size() <= width) return text;
    if (width <= 3) return text.substr(0, width);
    return text.substr(0, width - 3) + "...";
}
```

## Notes
This is the bug from the chapter, reduced. The full version was buried in a loop
over a vector of lines with trailing-space trimming — none of which mattered.
Once the case is two arguments, `width - 3` on an unsigned type is visible by
inspection.

Note the shape of the failure. It is not a crash: `substr` clamps a too-large
length to the end of the string, so the broken version returns the *entire*
string with `"..."` glued on. A function asked to produce at most 2 characters
returning 11 is a wrong answer that propagates quietly — worse than a fault,
because nothing stops it.

The `width <= 3` case is a genuine design decision, not just a guard. There is
no sensible way to indicate truncation in three characters when the marker
itself is three characters long, so the specification has to say what happens,
and the tests have to pin it. Leaving that case undefined is how the original
bug got in.
