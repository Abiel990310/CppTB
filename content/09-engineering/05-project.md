---
title: "Project: a small search index"
navTitle: "Project: search index"
summary: >-
  One program that uses most of this book: file I/O, containers, algorithms, ownership, tests, and a benchmark.
objectives:
  - Design a program from an informal specification
  - Choose data structures against measured requirements
  - Ship it with tests, a build file, and a README
status: complete
standard: c++20
requires: [dependencies]
---

Sixty chapters of parts. This is one whole thing.

The exercise is not the algorithm — an inverted index is a well-known idea and
the code is about a hundred lines. The exercise is everything around it: turning
a vague request into a specification, choosing between two data structures on
evidence rather than instinct, and shipping the result in a state somebody else
could pick up.

## The request

> We have a few thousand documents. I want to type some words and get back the
> documents that have all of them, best match first. It should be fast enough
> that it feels instant.

That is what a real request looks like. Before writing anything, notice what it
does not say.

**What is a word?** Is `Pointers` the same word as `pointers`? Is `unique_ptr`
one word or two? Does punctuation separate words?

**"All of them" — really?** If I type three words and one is a typo, do I get
nothing? (Yes, for now. AND is the simplest useful semantics and the one the
request describes. OR and negation are in this chapter's practice problems.)

**"Best match" by what?** Documents where a term appears ten times are probably
more relevant than ones where it appears once. That is enough to start with, and
it is not what a real search engine does.

**"A few thousand"** and **"instant"** together set the budget. A few thousand
documents is small: it fits in memory, so nothing needs to touch a disk after
start-up. "Instant" to a human is under about 100 ms.

The specification, written down:

> Build an in-memory index over a set of documents, each with a title and a
> body. A query is a sequence of words. Return every document containing *all*
> of them, ordered by the total number of occurrences of the query terms,
> breaking ties by insertion order. Matching is case-insensitive; anything that
> is not a letter or digit separates words. An empty query, or one containing a
> word that appears nowhere, returns nothing.

Every ambiguity above is now decided, and each decision is a line the tests can
check.

## The shape: an inverted index

The naive approach is to scan every document for every query. That is O(corpus)
per query and gets slower as the collection grows — the wrong shape regardless
of constant factors.

An **inverted index** turns it round. Instead of *document → words*, store
*word → the documents containing it*:

```
"pointer"  -> [ {doc 0, 2 times}, {doc 2, 1 time} ]
"null"     -> [ {doc 0, 1 time},  {doc 1, 1 time} ]
```

A query then intersects a few short lists rather than scanning everything, and
query time depends on how common the query terms are rather than on the size of
the corpus.

That settles the algorithm. The next two decisions are where the measuring
happens.

## Decision one: what maps a term to its postings

`std::map` or `std::unordered_map`? Chapter 4.3 gave the theory — ordered,
O(log n), node-based against unordered, O(1) average, bucketed. The theory does
not say which wins here, so: 20,000 documents of 40 words drawn from a
5,000-word vocabulary, built both ways.

| | `std::map` | `std::unordered_map` |
|---|---|---|
| Build the index | 155 ms | **54 ms** |
| 100,000 term lookups | 20 ms | **6 ms** |

Roughly three times faster on both, which is what you expect when the key is a
string: `map` pays a string comparison at every level of the tree, and
`unordered_map` pays one hash and usually one comparison.

**Decision: `unordered_map`.** The one thing `map` offers that would change this
is ordered iteration — which a prefix or range query would need. The
specification has neither, so it buys nothing here. Note it down; if
autocomplete is ever asked for, this is the decision to revisit.

## Decision two: how a posting list is stored, and intersected

Each term's postings could be a `std::vector` kept sorted by document id, or a
hash set. The query is an intersection, and how you intersect follows from the
representation:

- **Sorted vectors**: walk both lists in step, advancing whichever is behind.
  Linear in the sum of the lengths, and entirely sequential memory access —
  Chapter 7.3's argument.
- **Hash set**: build a set from the larger list, then probe it with the
  smaller. Also linear, but every probe is a random access into a hash table.

2,000 two-term queries against that same corpus:

| | Time |
|---|---|
| Sorted vectors, merge intersection | **4.6 ms** |
| Hash set built per query, probed | 40.0 ms |

Nearly nine times. Both are O(n); the difference is entirely constant factors —
cache behaviour and the cost of building a hash table per query.

**Decision: sorted vectors.** And a detail that makes it free: because documents
are added in increasing id order, appending to a posting list produces a sorted
list already. There is no sort step anywhere in the build.

One more, without a benchmark: **intersect the shortest list first.** The result
can only shrink, so starting with the rarest term makes every subsequent pass
work on a smaller set. This is the single most valuable line in the query path
and it costs one `std::sort` over a handful of pointers.

## The program

```cpp run title="The whole thing"
#include <algorithm>
#include <cstddef>
#include <cstdio>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace search {

// Lower-cased runs of letters and digits. Everything else separates.
std::vector<std::string> tokenise(std::string_view text) {
    std::vector<std::string> tokens;
    std::string current;
    for (char c : text) {
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) current += c;
        else if (c >= 'A' && c <= 'Z') current += static_cast<char>(c - 'A' + 'a');
        else if (!current.empty()) { tokens.push_back(std::move(current)); current.clear(); }
    }
    if (!current.empty()) tokens.push_back(std::move(current));
    return tokens;
}

struct Posting { int document; int occurrences; };
struct Hit { int document; int score; };

class Index {
public:
    int add(std::string title, std::string_view body) {
        const int id = static_cast<int>(titles_.size());
        titles_.push_back(std::move(title));

        // Count once per document, so each term appends a single posting —
        // which keeps every list sorted by document id with no sort step.
        std::unordered_map<std::string, int> counts;
        for (const std::string& token : tokenise(titles_.back())) ++counts[token];
        for (const std::string& token : tokenise(body)) ++counts[token];

        for (const auto& [term, n] : counts) postings_[term].push_back(Posting{id, n});
        return id;
    }

    std::vector<Hit> search(std::string_view query) const {
        const std::vector<std::string> terms = tokenise(query);
        if (terms.empty()) return {};

        std::vector<const std::vector<Posting>*> lists;
        lists.reserve(terms.size());
        for (const std::string& term : terms) {
            auto it = postings_.find(term);
            if (it == postings_.end()) return {};       // AND: one miss and we are done
            lists.push_back(&it->second);
        }
        // Rarest term first: the result can only shrink.
        std::sort(lists.begin(), lists.end(),
                  [](const auto* a, const auto* b) { return a->size() < b->size(); });

        std::vector<Hit> hits;
        for (const Posting& p : *lists.front()) hits.push_back(Hit{p.document, p.occurrences});

        for (std::size_t i = 1; i < lists.size() && !hits.empty(); ++i) {
            std::vector<Hit> merged;
            const std::vector<Posting>& other = *lists[i];
            std::size_t a = 0, b = 0;
            while (a < hits.size() && b < other.size()) {
                if (hits[a].document < other[b].document) ++a;
                else if (other[b].document < hits[a].document) ++b;
                else {
                    merged.push_back(Hit{hits[a].document, hits[a].score + other[b].occurrences});
                    ++a; ++b;
                }
            }
            hits = std::move(merged);
        }

        std::sort(hits.begin(), hits.end(), [](const Hit& x, const Hit& y) {
            if (x.score != y.score) return x.score > y.score;
            return x.document < y.document;
        });
        return hits;
    }

    const std::string& title(int id) const { return titles_[static_cast<std::size_t>(id)]; }
    std::size_t documents() const { return titles_.size(); }
    std::size_t terms() const { return postings_.size(); }

private:
    std::vector<std::string> titles_;
    std::unordered_map<std::string, std::vector<Posting>> postings_;
};

}  // namespace search

int main() {
    search::Index index;
    index.add("Pointers", "A pointer holds an address. Pointers can be null.");
    index.add("References", "A reference is an alias. A reference cannot be null.");
    index.add("Smart pointers", "unique_ptr owns. shared_ptr counts. Both are pointers.");
    index.add("Move semantics", "Moving transfers ownership rather than copying.");

    std::printf("%zu documents, %zu distinct terms\n\n", index.documents(), index.terms());

    for (const char* query : {"pointers", "pointer null", "reference alias", "banana", ""}) {
        std::printf("query \"%s\":\n", query);
        const std::vector<search::Hit> hits = index.search(query);
        if (hits.empty()) std::printf("  (no results)\n");
        for (const search::Hit& hit : hits)
            std::printf("  %-16s score %d\n", index.title(hit.document).c_str(), hit.score);
        std::printf("\n");
    }
}
```

Things from earlier chapters, doing real work rather than being demonstrated:

- **`std::string_view` for the query and body** — read, never stored, so no copy
  (Chapter 4.1). `title` is taken by value and moved, because the index *does*
  keep it (Chapter 7.5).
- **`std::move(current)` into the token vector**, then `clear()` — moving from a
  `std::string` leaves it valid but unspecified, so the explicit `clear()` is not
  optional (Chapter 3.4).
- **Structured bindings** over the counts map, and over each `Hit` (Chapter 3.1).
- **Pointers to the posting lists**, not copies, so sorting the lists by length
  moves eight bytes each rather than whole vectors.
- **No `new`, no `delete`, no raw owning pointers.** Every container owns its
  contents and the destructor is written by the compiler (Chapter 3.6).

## Shipping it

Code that only exists as one file on your machine is not finished. Three things
turn it into something someone else can use.

**The layout**, from Chapter 9.3:

```
search/
├── CMakeLists.txt
├── README.md
├── include/search/index.h
├── src/index.cpp
├── app/main.cpp
├── tests/test_index.cpp
└── bench/bench_index.cpp
```

**The build file:**

```cmake
cmake_minimum_required(VERSION 3.20)
project(search VERSION 0.1.0 LANGUAGES CXX)

add_library(search src/index.cpp)
target_include_directories(search PUBLIC include)
target_compile_features(search PUBLIC cxx_std_20)
target_compile_options(search PRIVATE -Wall -Wextra -Wpedantic)

add_executable(search-cli app/main.cpp)
target_link_libraries(search-cli PRIVATE search)

include(CTest)
add_executable(test_index tests/test_index.cpp)
target_link_libraries(test_index PRIVATE search)
add_test(NAME index COMMAND test_index)

add_executable(bench_index bench/bench_index.cpp)
target_link_libraries(bench_index PRIVATE search)
```

**The tests**, one per decision the specification made:

```cpp
check(index.search("").empty(),                 "an empty query returns nothing");
check(index.search("banana").empty(),           "an unknown term returns nothing");
check(index.search("POINTERS").size() == 2,     "matching is case-insensitive");
check(index.search("pointer null").size() == 1, "all terms must be present");
check(index.search("pointers")[0].score >= index.search("pointers")[1].score,
                                                "results are ordered by score");
```

Every one of those is a sentence from the specification. That is what a test
suite is for: not proving the code works, but pinning the decisions so the next
person cannot change one by accident. The harness returns the failure count, so
CTest sees it (Chapter 9.3).

**The README**, which is the part most projects skip:

```markdown
# search

An in-memory inverted index. Returns documents containing every query term,
ordered by how often those terms appear.

## Build

    cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
    cmake --build build
    cd build && ctest

## Use

    ./build/search-cli corpus/*.txt

## Design notes

- `unordered_map` rather than `map`: 3x faster to build and to look up, and no
  ordered iteration is needed. Revisit if prefix queries are ever wanted.
- Posting lists are `vector`s sorted by document id, intersected by merging:
  9x faster than building a hash set per query.
- Documents are added in id order, so posting lists are sorted by construction.

## Limits

- The index is rebuilt at start-up; there is no persistence.
- Queries are AND-only. No phrases, no negation, no prefix matching.
- Ranking is raw term frequency, so long documents win. tf-idf is the next step.
- Not thread-safe. Reads are safe once building is finished, if nothing writes.
```

Those last two sections are the ones that matter to whoever reads this in a
year. **Design notes** record *why*, so a decision is not silently undone.
**Limits** say what it does not do, so nobody discovers it the hard way — and
"not thread-safe" is worth an explicit line every time, because the default
assumption goes the other way.

## What to do next

In roughly the order the value appears:

1. **tf-idf ranking.** Term frequency alone means a long document beats a
   focused one. Weighting each term by how rare it is across the corpus is a
   dozen lines and changes the results out of recognition.
2. **Stop words.** `the` matches everything, contributes nothing, and has the
   longest posting list in the index. Dropping the most common terms shrinks the
   index and speeds up queries.
3. **Persistence.** Serialising the index means start-up stops being O(corpus).
4. **OR and negation**, then phrases — this chapter's practice problems.
5. **Parallel building.** Documents are independent: index shards on separate
   threads and merge (Chapter 8.4's fan-out, fan-in). Do this only after
   measuring that building is actually the bottleneck.

And the thing not to do: none of the above until someone needs it. The version
above answers the request that was made, in a hundred lines, with tests. That is
a finished program, and the discipline of stopping there is as much a part of
engineering as any of the chapters before it.

## Check yourself

:::quiz
{
  "question": "Both intersection strategies are O(n). Why is merging sorted vectors nine times faster than building a hash set per query?",
  "options": [
    { "text": "Constant factors: the merge walks two arrays sequentially, while the hash version allocates and fills a table per query and then does random access into it", "correct": true, "why": "Complexity classes are equal, and everything that differs is what Chapter 7.3 measured — sequential access, no allocation, and no hashing." },
    { "text": "The merge is actually O(log n)", "why": "It is linear in the sum of the two list lengths. Both are linear; the difference is per-element cost." },
    { "text": "Hash sets have worse asymptotic complexity for intersection", "why": "Probing is O(1) average, so the algorithm is linear too." },
    { "text": "`std::unordered_set` is unusually slow in libstdc++", "why": "It is not the container's quality; it is that building one per query is work the merge never does." }
  ]
}
:::

:::quiz
{
  "question": "The query path sorts the posting lists by length before intersecting. What does that buy?",
  "options": [
    { "text": "The intersection starts from the rarest term, so every subsequent pass works on a set that can only be smaller", "correct": true, "why": "The result of an intersection is at most as large as its smallest input. Starting there means later passes scan fewer candidates — for the cost of sorting a handful of pointers." },
    { "text": "It makes the results come out in score order", "why": "The final sort does that, and it runs regardless." },
    { "text": "It is required for the merge to be correct", "why": "The merge is correct in any order; this is purely about how much work it does." },
    { "text": "It lets the shortest list be cached", "why": "No caching is involved. The saving is in how many elements the later passes examine." }
  ]
}
:::

## Practice

:::exercise boolean-queries

:::exercise phrase-search

:::recap
- A vague request becomes a specification by finding the questions it does not
  answer and deciding them explicitly. Each decision then becomes a test.
- An inverted index makes query time depend on how common the terms are rather
  than on the size of the corpus. That is a shape decision, and it comes first.
- Measure the container choice rather than assuming it: `unordered_map` was
  three times faster than `map` here, for string keys and no need for order.
- Measure the algorithm's constant factors too: merging sorted vectors beat
  hash-set probing by nine times, both being O(n).
- Order the intersection so the rarest term goes first. Cheap to do, and it
  shrinks everything downstream.
- Shipping means a build file, tests that state the specification, and a README
  with a design-notes section saying *why* and a limits section saying what it
  does not do.
- Then stop. A finished hundred-line program that answers the request beats an
  unfinished one that anticipates six more.
:::
