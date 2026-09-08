---
id: count-the-allocations
title: "Make the allocations go away"
difficulty: core
chapter: measuring
topics: [performance, strings, containers, allocation]
check: unit
standard: c++20
---

Three functions that each do far more heap allocation than the work requires.
The checks replace global `operator new` and count the calls, so this problem is
graded on cost, not just on output — the results must stay identical *and* the
allocation counts must come down.

- `join(parts)` — the parts joined with `", "`. Currently quadratic.
- `first_words(lines)` — the first space-delimited word of each line.
  Currently builds a whole vector of words per line and throws most away.
- `count_matching(haystack, needle)` — how many lines contain `needle`.
  Currently copies every line.

The results are already correct. Only the cost is wrong.

## Starter
```cpp
#include <string>
#include <string_view>
#include <vector>

// --- given, do not change: counts every heap allocation ---------------
#include <cstdlib>
#include <new>

int allocations = 0;

void* operator new(std::size_t bytes) {
    ++allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
// ----------------------------------------------------------------------

std::string join(const std::vector<std::string>& parts) {
    std::string out;
    for (std::size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) out = out + ", ";
        out = out + parts[i];
    }
    return out;
}

std::vector<std::string> first_words(const std::vector<std::string>& lines) {
    std::vector<std::string> out;
    for (const std::string& line : lines) {
        std::vector<std::string> words;
        std::string current;
        for (char c : line) {
            if (c == ' ') { words.push_back(current); current.clear(); }
            else current += c;
        }
        words.push_back(current);
        out.push_back(words.front());
    }
    return out;
}

int count_matching(const std::vector<std::string>& haystack, std::string needle) {
    int found = 0;
    for (std::string line : haystack)
        if (line.find(needle) != std::string::npos) ++found;
    return found;
}
```

## Tests
```cpp
std::vector<std::string> parts;
for (int i = 0; i < 400; ++i) parts.push_back("part" + std::to_string(i));

std::vector<std::string> lines;
for (int i = 0; i < 400; ++i)
    lines.push_back("word" + std::to_string(i) + " middle tail-" + std::to_string(i));

// --- join -------------------------------------------------------------
allocations = 0;
std::string joined = join(parts);
int join_allocations = allocations;

CHECK_EQ(joined.substr(0, 16), std::string("part0, part1, pa"));
CHECK_EQ(joined.size(), std::size_t{3488});
CHECK(join_allocations < 40);

// --- first_words ------------------------------------------------------
allocations = 0;
std::vector<std::string> heads = first_words(lines);
int words_allocations = allocations;

CHECK_EQ(heads.size(), std::size_t{400});
CHECK_EQ(heads[0], std::string("word0"));
CHECK_EQ(heads[399], std::string("word399"));
CHECK(words_allocations < 100);

// --- count_matching ---------------------------------------------------
allocations = 0;
int matches = count_matching(lines, "tail-3");
int match_allocations = allocations;

CHECK_EQ(matches, 111);
CHECK_EQ(count_matching(lines, "nothing-here"), 0);
CHECK(match_allocations < 10);
```

## Hints
- `out = out + x` builds a whole new string and assigns it. `out += x` appends in place, reusing the buffer. That one change takes `join` from quadratic to linear.
- `join` can also reserve: sum the part sizes first, add two bytes per separator, and `out.reserve(total)`. With a reserve, the whole function allocates once.
- `first_words` only ever uses `words.front()`, so it never needs the rest. Find the first space and stop.
- `std::string::find(' ')` returns `npos` when there is none, and `substr(0, npos)` gives the whole string — so `line.substr(0, line.find(' '))` handles both cases with no branch.
- `count_matching` takes `std::vector<std::string> haystack`'s elements **by value** in the range-for: `for (std::string line : ...)` copies every line. `const std::string&` does not.
- The `needle` parameter is also by value. `std::string_view` is the right type for a parameter that is only read and never stored.

## Solution
```cpp
#include <string>
#include <string_view>
#include <vector>

// --- given, do not change: counts every heap allocation ---------------
#include <cstdlib>
#include <new>

int allocations = 0;

void* operator new(std::size_t bytes) {
    ++allocations;
    void* p = std::malloc(bytes ? bytes : 1);
    if (!p) throw std::bad_alloc{};
    return p;
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
// ----------------------------------------------------------------------

std::string join(const std::vector<std::string>& parts) {
    std::size_t total = 0;
    for (const std::string& p : parts) total += p.size() + 2;

    std::string out;
    out.reserve(total);
    for (std::size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) out += ", ";
        out += parts[i];
    }
    return out;
}

std::vector<std::string> first_words(const std::vector<std::string>& lines) {
    std::vector<std::string> out;
    out.reserve(lines.size());
    for (const std::string& line : lines)
        out.push_back(line.substr(0, line.find(' ')));
    return out;
}

int count_matching(const std::vector<std::string>& haystack, std::string_view needle) {
    int found = 0;
    for (const std::string& line : haystack)
        if (line.find(needle) != std::string::npos) ++found;
    return found;
}
```

## Notes
Three different causes, and only one of them is an algorithm.

`join` was quadratic: `out = out + ", "` allocates a fresh buffer holding
everything accumulated so far, copies it, and throws the old one away — on every
iteration. `+=` appends into the existing buffer, growing geometrically, which
is linear. The `reserve` on top of that removes the growth reallocations too, so
the whole function allocates once.

`first_words` was doing correct work that nobody wanted. Splitting a line into
every word costs one allocation per word plus the vector; the function then
discards all but the first. This is the most common kind of waste in real code,
and no compiler will remove it, because every one of those allocations is
observable.

`count_matching` had no waste at all in its logic — the copies were in its
*signature and its loop*. `for (std::string line : haystack)` copies each
element into `line`; `const std::string&` binds to it. And a `std::string`
parameter for something that is only searched, never stored, copies the caller's
argument for nothing; `std::string_view` refers to it. The final version
allocates nothing whatsoever, which is why its budget is under ten and it comes
in at zero.

The numbers, for the record: `join` goes from 795 allocations to 1,
`first_words` from 1210 to 1 — every extracted word is short enough to live in
the string's small-buffer storage, so only the result vector allocates — and
`count_matching` from 400 to none at all.

The reason this problem counts allocations rather than milliseconds is that the
count is deterministic. Every figure above is identical at `-O0` with sanitizers
and at `-O2`. Time is not: it varies with the machine, the moment, and
the optimisation level, which is what the rest of this chapter is about. When
you can find a proxy for cost that does not move, measure that instead.
