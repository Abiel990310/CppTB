---
title: "std::string and text"
navTitle: "std::string and text"
summary: >-
  Text handling, encodings, and the difference between a character and a byte.
objectives:
  - Use std::string and std::string_view appropriately
  - Explain why a string_view can dangle
  - Describe what a char actually holds in a UTF-8 world
status: complete
standard: c++20
requires: [smart-pointers, arrays-and-decay]
---

`std::string` is the first standard container most people meet, and it is a
good one to meet first: it owns its memory, grows on demand, copies deeply, and
moves cheaply. Everything Part 3 said about ownership, it does correctly and
invisibly.

What it does *not* do is understand text. It is a sequence of bytes, and the gap
between "byte" and "character" is where the interesting problems live.

## A container that happens to hold characters

```cpp run title="The operations you will use daily" std=c++20
#include <iostream>
#include <string>

int main() {
    std::string name = "Ada";

    name += " Lovelace";                    // append
    std::cout << name << '\n';
    std::cout << "size:      " << name.size() << '\n';
    std::cout << "first:     " << name.front() << '\n';
    std::cout << "substr:    " << name.substr(4, 8) << '\n';
    std::cout << "find:      " << name.find("Love") << '\n';
    std::cout << "starts:    " << std::boolalpha << name.starts_with("Ada") << '\n';

    for (char c : name.substr(0, 3)) std::cout << c << '.';
    std::cout << '\n';
}
```

`starts_with` and `ends_with` arrived in C++20. `contains` looks like it should
be their sibling but is **C++23** — a distinction worth knowing, because
reaching for it while compiling as C++20 produces `'std::string' has no member
named 'contains'`, which reads like a missing header rather than a missing
standard. Until you are on C++23, the idiom is
`find(...) != std::string::npos`.

`npos` is worth knowing because it is how `find` reports failure — a
`std::string::size_type` of all-ones, the largest representable value:

```cpp run title="npos, and the comparison to write" std=c++20
#include <iostream>
#include <string>

int main() {
    std::string text = "hello";

    std::cout << "find(\"ll\")  = " << text.find("ll") << '\n';
    std::cout << "find(\"zz\")  = " << text.find("zz") << '\n';
    std::cout << "npos        = " << std::string::npos << '\n';

    if (text.find("zz") == std::string::npos) {
        std::cout << "not found — compare against npos, never against -1\n";
    }
}
```

## It owns its bytes

Copying a `std::string` copies the characters. Moving it transfers the buffer.
Both were the subject of Part 3; here is the same story in the type you will
actually use:

```cpp run title="Copy duplicates, move transfers" std=c++20
#include <iostream>
#include <string>
#include <utility>

int main() {
    std::string source(1000, 'x');

    std::string copied = source;
    std::cout << "after copy: source has " << source.size()
              << ", copy has " << copied.size() << '\n';

    std::string moved = std::move(source);
    std::cout << "after move: source has " << source.size()
              << ", moved has " << moved.size() << '\n';
}
```

:::note
Most implementations use the **small string optimisation**: short strings live
inside the string object itself, with no heap allocation at all. The threshold
is typically 15 or 22 bytes. It means short strings are very cheap, and it means
`sizeof(std::string)` is 32 on libstdc++ rather than the 24 you might expect
from a pointer, a size, and a capacity.
:::

```cpp run title="Where a short string lives" std=c++20
#include <iostream>
#include <string>

int main() {
    std::string small = "short";
    std::string large(100, 'x');

    std::cout << "sizeof(std::string) = " << sizeof(std::string) << '\n';
    std::cout << "small capacity      = " << small.capacity() << '\n';
    std::cout << "large capacity      = " << large.capacity() << '\n';

    // A string's buffer is inside the object when it is small enough.
    const void* object_start = &small;
    const void* buffer_start = small.data();
    std::cout << "small buffer inside the object? " << std::boolalpha
              << (buffer_start >= object_start &&
                  buffer_start < static_cast<const char*>(object_start) + sizeof(std::string))
              << '\n';
}
```

## string_view: a non-owning window

A great deal of string code only *reads*. Taking a `const std::string&` handles
that, but it forces every caller to have an actual `std::string` — so passing a
literal or a `char` array constructs a temporary, allocating and copying to do
nothing but read.

`std::string_view` is a pointer and a length. It owns nothing, copies in two
machine words, and binds to anything contiguous:

```cpp run title="One function, every kind of caller" std=c++20
#include <iostream>
#include <string>
#include <string_view>

// No allocation, whatever the caller holds.
std::size_t count_vowels(std::string_view text) {
    std::size_t n = 0;
    for (char c : text) {
        if (std::string_view{"aeiouAEIOU"}.find(c) != std::string_view::npos) ++n;
    }
    return n;
}

int main() {
    std::string owned = "the quick brown fox";
    const char* c_style = "hello world";
    char buffer[] = "raw array";

    std::cout << count_vowels(owned)    << '\n';
    std::cout << count_vowels(c_style)  << '\n';
    std::cout << count_vowels(buffer)   << '\n';
    std::cout << count_vowels("literal") << '\n';
    std::cout << count_vowels(owned.substr(4, 5)) << "  (a temporary, still fine here)\n";
}
```

Substrings are where it pays best. `s.substr(...)` allocates and copies;
`std::string_view{s}.substr(...)` just moves two numbers:

```cpp run title="Slicing without copying" std=c++20
#include <chrono>
#include <iostream>
#include <string>
#include <string_view>

int main() {
    const std::string text(100'000, 'x');
    constexpr int rounds = 100'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    std::size_t sink = 0;
    for (int i = 0; i < rounds; ++i) sink += text.substr(10, 5000).size();
    auto mid = clock::now();

    std::string_view view{text};
    for (int i = 0; i < rounds; ++i) sink += view.substr(10, 5000).size();
    auto finish = clock::now();

    std::cout << "string::substr:      " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "string_view::substr: " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(checksum " << sink << ")\n";
}
```

### The dangling problem

A `string_view` does not keep its bytes alive. That is the entire cost of it
being free, and it is the same lifetime rule from Chapter 2.4 in a new costume:

```cpp run expect-ub title="A view of something that is gone" std=c++20
#include <iostream>
#include <string>
#include <string_view>

std::string build() { return "a temporary string"; }

int main() {
    // The temporary dies at the end of this statement. The view outlives it.
    std::string_view view = build();

    std::cout << "reading through the view: " << view << '\n';
}
```

AddressSanitizer catches that one. The version that catches *people* is subtler
— a function returning a view of its own parameter:

```cpp run expect-ub title="A view of a parameter that has gone home" std=c++20
#include <iostream>
#include <string>
#include <string_view>

std::string_view first_word(const std::string& text) {
    return std::string_view{text}.substr(0, text.find(' '));
}

int main() {
    // The argument is a temporary: it dies at the end of the full expression,
    // taking the returned view's bytes with it.
    std::string_view word = first_word(std::string{"hello world"});

    std::cout << "first word: " << word << '\n';
}
```

:::warning
The rule: **a `string_view` must not outlive the bytes it points at.** Safe as a
function parameter, since the argument outlives the call. Dangerous as a return
value, a class member, or anything stored — because whatever owned the bytes may
not be there later. When in doubt, store a `std::string` and take the
allocation.
:::

:::memviz
{
  "title": "string owns; string_view borrows",
  "code": "std::string owner = \"hello world\";\n\nstd::string_view view = owner;\n\nowner = std::string(200, 'x');",
  "steps": [
    {
      "caption": "A std::string owns its bytes. For a longer string those bytes are a heap allocation it will free.",
      "line": 1,
      "stack": [
        { "id": "owner", "name": "owner", "type": "std::string", "state": "new",
          "fields": [{ "k": "data", "v": "→", "anchor": "o.d" }, { "k": "size", "v": "11" }] }
      ],
      "heap": [ { "id": "buf", "name": "char[]", "value": "\"hello world\"", "state": "new" } ],
      "arrows": [{ "from": "o.d", "to": "buf" }]
    },
    {
      "caption": "The view copies a pointer and a length. Nothing is allocated, and nothing is told that the view exists.",
      "line": 3,
      "stack": [
        { "id": "owner", "name": "owner", "type": "std::string",
          "fields": [{ "k": "data", "v": "→", "anchor": "o.d" }, { "k": "size", "v": "11" }] },
        { "id": "view", "name": "view", "type": "string_view", "state": "new",
          "fields": [{ "k": "data", "v": "→", "anchor": "v.d" }, { "k": "size", "v": "11" }] }
      ],
      "heap": [ { "id": "buf", "name": "char[]", "value": "\"hello world\"" } ],
      "arrows": [{ "from": "o.d", "to": "buf" }, { "from": "v.d", "to": "buf" }]
    },
    {
      "caption": "Assigning a longer string makes the owner allocate a new buffer and free the old one. The view is not updated — nobody knows it is there.",
      "line": 5,
      "stack": [
        { "id": "owner", "name": "owner", "type": "std::string",
          "fields": [{ "k": "data", "v": "→ new", "anchor": "o.d" }, { "k": "size", "v": "200" }] },
        { "id": "view", "name": "view", "type": "string_view", "state": "danger",
          "fields": [{ "k": "data", "v": "→ freed", "anchor": "v.d" }, { "k": "size", "v": "11" }] }
      ],
      "heap": [
        { "id": "buf", "name": "char[]", "value": "freed", "state": "freed" },
        { "id": "buf2", "name": "char[200]", "value": "\"xxx…\"", "state": "new" }
      ],
      "arrows": [
        { "from": "o.d", "to": "buf2" },
        { "from": "v.d", "to": "buf", "state": "dangling", "label": "undefined" }
      ]
    }
  ]
}
:::

### It is not null-terminated

A `string_view` may point into the middle of a buffer, so there is no guarantee
of a `'\0'` after its last character. C APIs need one:

```cpp run title="Crossing into C" std=c++20
#include <cstdio>
#include <iostream>
#include <string>
#include <string_view>

void legacy_print(const char* text) { std::printf("  C says: %s\n", text); }

int main() {
    std::string owner = "hello world";
    std::string_view view = std::string_view{owner}.substr(0, 5);

    std::cout << "the view prints correctly: " << view << '\n';

    // legacy_print(view.data());     // WRONG: prints "hello world", not "hello"
    legacy_print(std::string{view}.c_str());   // allocate, and be correct
}
```

`std::string::c_str()` is guaranteed null-terminated. `string_view::data()` is
not, and passing it to a C function reads until it happens to find a zero byte.

## A char is a byte, not a character

This is the part that surprises people, and it is not a C++ quirk — it is how
text works.

```cpp run title="Counting what, exactly?" std=c++20
#include <iostream>
#include <string>

int main() {
    std::string ascii = "hello";
    std::string accented = "café";
    std::string emoji = "hi 👋";

    std::cout << "\"hello\" size " << ascii.size() << '\n';
    std::cout << "\"café\"  size " << accented.size() << "   <- 4 characters\n";
    std::cout << "\"hi 👋\"  size " << emoji.size() << "   <- 4 characters\n";
}
```

`café` is four characters and five bytes: `é` is encoded in UTF-8 as two bytes.
The waving hand is four bytes. `size()` counts bytes, `operator[]` indexes
bytes, and `substr` slices bytes — so slicing in the middle of a multi-byte
character produces invalid text:

```cpp run title="Slicing through a character" std=c++20
#include <iostream>
#include <string>

int main() {
    std::string text = "café";

    std::cout << "whole:            " << text << '\n';
    std::cout << "substr(0, 4):     " << text.substr(0, 4) << "  <- cut mid-character\n";
    std::cout << "substr(0, 5):     " << text.substr(0, 5) << "  <- whole thing\n";

    std::cout << "bytes: ";
    for (unsigned char c : text) std::cout << static_cast<int>(c) << ' ';
    std::cout << '\n';
}
```

:::pitfall
There is no `size()` in the standard library that gives you the number of
user-perceived characters, and there cannot be a simple one: "character" is
ambiguous between a code point, a grapheme cluster, and what a reader would call
a letter. `é` can be one code point or two (`e` plus a combining accent), and
both look identical.

Practical guidance: treat `std::string` as UTF-8 bytes, do not index into text
you did not construct, and reach for a library — ICU, or `utfcpp` for something
small — the moment you need to iterate characters, uppercase non-ASCII, or
measure display width.
:::

What the standard does give you is enough to pass text through safely.
Concatenating, comparing for equality, searching for a substring, and writing to
a stream are all byte operations that work correctly on UTF-8 without knowing
anything about it.

## Building strings efficiently

Appending in a loop reallocates as it grows. If you know roughly how big the
result will be, say so:

```cpp run title="reserve, and what it saves" std=c++20
#include <chrono>
#include <iostream>
#include <string>

int main() {
    constexpr int n = 400'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    std::string grown;
    for (int i = 0; i < n; ++i) grown += 'x';
    auto mid = clock::now();

    std::string reserved;
    reserved.reserve(n);
    for (int i = 0; i < n; ++i) reserved += 'x';
    auto finish = clock::now();

    std::cout << "no reserve: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "reserve:    " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(sizes " << grown.size() << ", " << reserved.size() << ")\n";
}
```

The difference is smaller than people expect, because `std::string` grows
geometrically — doubling, so the total copying is bounded. `reserve` still helps,
and matters more for large strings, but "concatenation in a loop is quadratic"
is a myth inherited from languages with immutable strings.

For assembling values of mixed types, `std::format` (C++20) is clearer than a
chain of `+`:

```cpp run title="std::format" std=c++20
#include <format>
#include <iostream>
#include <string>

int main() {
    std::string name = "Ada";
    int year = 1843;
    double share = 0.6666;

    std::cout << std::format("{} published in {}\n", name, year);
    std::cout << std::format("{:>10} | {:<8} | {:.1f}%\n", name, year, share * 100);
    std::cout << std::format("{0} and {0} again\n", name);
}
```

## Check yourself

:::quiz
{
  "question": "A function reads a string and never stores it. What should the parameter be?",
  "options": [
    { "text": "`std::string`", "why": "That copies on every call — allocating and duplicating bytes to do nothing but read them." },
    { "text": "`const std::string&`", "why": "No copy when the caller has a std::string, but a caller passing a literal or a char array constructs a temporary, which allocates. Better than by value, still not best." },
    { "text": "`std::string_view`", "correct": true, "why": "Two machine words, no allocation, and it binds to a std::string, a literal, a char array, or a slice of any of them. This is the default for a read-only string parameter." },
    { "text": "`const char*`", "why": "It works for C strings but loses the length, cannot represent a slice, and forces .c_str() on every std::string caller." }
  ]
}
:::

:::quiz
{
  "question": "`std::string_view v = std::string{\"hello\"};` — what is wrong with this?",
  "options": [
    { "text": "Nothing; the temporary's lifetime is extended to match the view", "why": "Lifetime extension applies to a temporary bound to a *reference*. A string_view is an object holding a pointer, not a reference, so nothing is extended." },
    { "text": "The temporary is destroyed at the end of the statement, leaving the view pointing at freed memory", "correct": true, "why": "Exactly. The view copied a pointer and a length; nothing told the string it was being watched. Every read afterwards is a use-after-free." },
    { "text": "It does not compile — string_view has no constructor from std::string", "why": "It has a conversion operator, which is what makes the mistake so easy: the code compiles cleanly and fails at run time." },
    { "text": "It copies the characters, which is wasteful", "why": "It copies no characters at all. That is the whole point of a view, and also the whole problem here." }
  ]
}
:::

## Practice

:::exercise trim-whitespace

:::exercise split-on-delimiter

:::recap
- `std::string` owns its bytes: deep copy, cheap move, small strings often held
  inside the object with no allocation at all.
- `find` reports failure with `npos`. Compare against `npos`, never `-1`.
- `std::string_view` is a pointer and a length: free to pass and to slice, and
  the right default for a read-only string parameter.
- A view must not outlive its bytes. Safe as a parameter, risky as a return
  value or a member, and not null-terminated — build a `std::string` before
  calling a C API.
- `size()` counts bytes, not characters. UTF-8 makes `é` two bytes and an emoji
  four. Do not index into text you did not construct; use a library when you
  need real character handling.
- Strings grow geometrically, so appending in a loop is not quadratic.
  `reserve` still helps when you know the size, and `std::format` beats `+`
  chains for mixed types.
:::
