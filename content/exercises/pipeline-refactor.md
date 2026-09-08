---
id: pipeline-refactor
title: "Collapse the temporaries"
difficulty: core
chapter: ranges
topics: [ranges, views, algorithms]
check: unit
standard: c++20
---

Write `long_words_upper` as a single ranges pipeline: the words longer than
three characters, uppercased, in their original order.

Do it without intermediate containers — one pipeline, materialised exactly once
at the end. The version with two `std::vector` temporaries also works, and the
notes show it; the point of this problem is the pipeline.

## Starter
```cpp
#include <string>
#include <vector>

std::vector<std::string> long_words_upper(const std::vector<std::string>& words) {
    return {};
}
```

## Tests
```cpp
{
    std::vector<std::string> words{"a", "tree", "of", "green", "sky"};
    auto result = long_words_upper(words);
    CHECK_EQ(result.size(), std::size_t{2});
    CHECK_EQ(result[0], std::string("TREE"));
    CHECK_EQ(result[1], std::string("GREEN"));
}
{
    std::vector<std::string> words{"no", "up", "at"};
    CHECK(long_words_upper(words).empty());
}
{
    std::vector<std::string> words;
    CHECK(long_words_upper(words).empty());
}
{
    // Exactly four characters counts as longer than three.
    std::vector<std::string> words{"abcd", "abc"};
    auto result = long_words_upper(words);
    CHECK_EQ(result.size(), std::size_t{1});
    CHECK_EQ(result[0], std::string("ABCD"));
}
{
    std::vector<std::string> words{"Mixed", "CASE", "here"};
    auto result = long_words_upper(words);
    CHECK_EQ(result.size(), std::size_t{3});
    CHECK_EQ(result[0], std::string("MIXED"));
    CHECK_EQ(result[2], std::string("HERE"));
}
```

## Hints
- `words | std::views::filter(pred) | std::views::transform(fn)` chains both steps with no temporaries.
- The transform must return a `std::string` by value, so take the parameter by value and modify the copy.
- The parameter is an lvalue reference, so the pipeline holds a reference to it — fine here, because it is materialised before returning.
- Materialise with `std::vector<std::string> result(pipeline.begin(), pipeline.end());` and return that, never the view.

## Solution
```cpp
#include <cctype>
#include <ranges>
#include <string>
#include <vector>

std::vector<std::string> long_words_upper(const std::vector<std::string>& words) {
    auto pipeline = words
                  | std::views::filter([](const std::string& w) { return w.size() > 3; })
                  | std::views::transform([](std::string w) {
                        for (char& c : w) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
                        return w;
                    });

    return std::vector<std::string>(pipeline.begin(), pipeline.end());
}
```

## Notes
Written with algorithms instead, it needs two temporaries and two passes:

```cpp
std::vector<std::string> longer;
std::copy_if(words.begin(), words.end(), std::back_inserter(longer),
             [](const std::string& w) { return w.size() > 3; });

std::vector<std::string> upper;
std::transform(longer.begin(), longer.end(), std::back_inserter(upper),
               [](std::string w) {
                   for (char& c : w) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
                   return w;
               });
return upper;
```

That is correct, and for five words the difference does not matter. It is the
shape that matters: each additional step adds another container and another
pass, while a pipeline adds neither.

The materialisation is not optional, and it is not merely about the return type.
The pipeline holds a *reference* to `words` — the parameter — so returning the
view itself would hand the caller something whose validity depends on a
reference the caller cannot see. Building the vector before returning cuts that
dependency.

Note the `static_cast<unsigned char>` inside `toupper`. It is the same trap as
in the word-counting problem: `std::toupper` has undefined behaviour for
negative values, and plain `char` is signed on most platforms, so a byte above
127 in UTF-8 input would be negative.

In C++23 the last line becomes
`return words | views::filter(...) | views::transform(...) | std::ranges::to<std::vector>();`
which says the same thing without naming the pipeline.
