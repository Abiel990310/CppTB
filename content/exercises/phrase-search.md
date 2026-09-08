---
id: phrase-search
title: "Words in the right order"
difficulty: stretch
chapter: project
topics: [algorithms, containers, search, indexing]
check: unit
standard: c++20
---

`"quick brown"` in quotes should mean those two words, adjacent, in that order —
not "documents containing both somewhere". The index cannot answer that,
because a posting records *how many times* a term appears and not *where*.

Change what the index stores, and add the query.

- Postings become `Entry{document, position}`, one per occurrence, where
  `position` is the 0-based index of the token within the document. A term
  appearing three times in a document produces three entries.
- `documents_with(term)` returns the distinct document ids containing a term,
  ascending.
- `phrase(text)` returns the distinct document ids where the tokens of `text`
  appear consecutively and in order, ascending. A single word behaves like
  `documents_with`. An empty phrase, or one containing an unknown word, returns
  nothing.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

// --- given, do not change --------------------------------------------
inline std::vector<std::string> tokenise(std::string_view text) {
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
// ----------------------------------------------------------------------

struct Entry { int document; int position; };

class Index {
public:
    // Should record one Entry per occurrence, with its token position.
    int add(std::string_view body) {
        const int id = documents_++;
        (void)body;
        return id;
    }

    int documents() const { return documents_; }

    std::vector<int> documents_with(const std::string& term) const {
        return {};
    }

    std::vector<int> phrase(std::string_view text) const {
        return {};
    }

private:
    int documents_ = 0;
    std::unordered_map<std::string, std::vector<Entry>> postings_;
};
```

## Tests
```cpp
Index index;
index.add("the quick brown fox jumps");        // 0
index.add("a quick fox and a brown dog");      // 1
index.add("brown fox brown fox");              // 2
index.add("the fox");                          // 3
CHECK_EQ(index.documents(), 4);

// documents_with: distinct ids, ascending, even for repeated terms.
{
    std::vector<int> r = index.documents_with("fox");
    CHECK_EQ(r.size(), std::size_t{4});
    CHECK_EQ(r[0], 0);
    CHECK_EQ(r[3], 3);
}
{
    std::vector<int> r = index.documents_with("brown");
    CHECK_EQ(r.size(), std::size_t{3});     // 0, 1, 2 — doc 2 counted once
    CHECK_EQ(r[0], 0);
    CHECK_EQ(r[1], 1);
    CHECK_EQ(r[2], 2);
}
CHECK(index.documents_with("banana").empty());

// phrase: adjacency and order both matter.
{
    std::vector<int> r = index.phrase("quick brown");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0], 0);                      // doc 1 has both, not adjacent
}
{
    std::vector<int> r = index.phrase("brown fox");
    CHECK_EQ(r.size(), std::size_t{2});
    CHECK_EQ(r[0], 0);
    CHECK_EQ(r[1], 2);                      // twice in doc 2, reported once
}
{
    std::vector<int> r = index.phrase("fox brown");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0], 2);                      // only doc 2 has them in this order
}
{
    std::vector<int> r = index.phrase("quick fox");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0], 1);                      // "a quick fox and a brown dog"
}
CHECK(index.phrase("dog brown").empty());   // adjacent, but the other way round

// A three-word phrase.
{
    std::vector<int> r = index.phrase("quick brown fox");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0], 0);
}
CHECK(index.phrase("the quick brown fox jumps").size() == std::size_t{1});
CHECK(index.phrase("the quick brown fox leaps").empty());

// A one-word phrase is just the term.
{
    std::vector<int> r = index.phrase("brown");
    CHECK_EQ(r.size(), std::size_t{3});
}

// Case and punctuation are handled by the tokeniser, as everywhere else.
{
    std::vector<int> r = index.phrase("QUICK, brown!");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0], 0);
}

// Edges.
CHECK(index.phrase("").empty());
CHECK(index.phrase("   ").empty());
CHECK(index.phrase("banana split").empty());
CHECK(index.phrase("brown banana").empty());
```

## Hints
- In `add`, iterate the tokens with an index and push `Entry{id, position}` for each. Because documents are added in id order and positions ascend within a document, every posting list ends up sorted by `(document, position)` with no sort step.
- `documents_with` walks a posting list and collects ids, skipping a repeat of the previous one. The list is already sorted, so consecutive duplicates are the only kind.
- For `phrase`, tokenise the text. Zero tokens means no results; one token means `documents_with`.
- The algorithm: for every entry of the *first* term, check whether the second term has an entry at `{same document, position + 1}`, the third at `position + 2`, and so on. If all of them do, that document matches.
- Each of those checks is a `std::binary_search` over the corresponding posting list, ordered by `(document, position)` — which is why keeping the lists sorted matters.
- Write the comparator once: `document` first, then `position`.
- Collect matches, then sort and remove duplicates — a document can contain the same phrase more than once, and the checks require it to be reported once.
- Starting from the *rarest* term rather than the first would be faster, and is a genuine optimisation; it makes the offset arithmetic harder and is not required here.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

inline std::vector<std::string> tokenise(std::string_view text) {
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

struct Entry { int document; int position; };

class Index {
public:
    int add(std::string_view body) {
        const int id = documents_++;
        const std::vector<std::string> tokens = tokenise(body);
        for (std::size_t i = 0; i < tokens.size(); ++i)
            postings_[tokens[i]].push_back(Entry{id, static_cast<int>(i)});
        return id;
    }

    int documents() const { return documents_; }

    std::vector<int> documents_with(const std::string& term) const {
        std::vector<int> found;
        auto it = postings_.find(term);
        if (it == postings_.end()) return found;
        for (const Entry& e : it->second)
            if (found.empty() || found.back() != e.document) found.push_back(e.document);
        return found;
    }

    std::vector<int> phrase(std::string_view text) const {
        const std::vector<std::string> terms = tokenise(text);
        if (terms.empty()) return {};
        if (terms.size() == 1) return documents_with(terms.front());

        std::vector<const std::vector<Entry>*> lists;
        lists.reserve(terms.size());
        for (const std::string& term : terms) {
            auto it = postings_.find(term);
            if (it == postings_.end()) return {};
            lists.push_back(&it->second);
        }

        std::vector<int> found;
        for (const Entry& start : *lists.front()) {
            bool complete = true;
            for (std::size_t k = 1; k < lists.size() && complete; ++k) {
                const Entry wanted{start.document, start.position + static_cast<int>(k)};
                complete = std::binary_search(lists[k]->begin(), lists[k]->end(), wanted, before);
            }
            if (complete && (found.empty() || found.back() != start.document))
                found.push_back(start.document);
        }
        return found;
    }

private:
    static bool before(const Entry& a, const Entry& b) {
        if (a.document != b.document) return a.document < b.document;
        return a.position < b.position;
    }

    int documents_ = 0;
    std::unordered_map<std::string, std::vector<Entry>> postings_;
};
```

## Notes
The whole feature is a change to what a posting *is*. Once an entry records a
position, "adjacent" becomes arithmetic — the second term must be at
`position + 1` — and the query is a handful of binary searches. That is the
general shape of index design: the hard decision is what to store, and the
algorithm follows from it.

It is not free. The index is now one entry per *occurrence* rather than one per
`(document, term)` pair, so a corpus where terms repeat grows the index
proportionally to its total word count instead of its vocabulary. For the
chapter's benchmark corpus that is 800,000 entries instead of 797,000 — barely
anything, because the vocabulary is large and repetition is rare — but for
natural English, where `the` appears in every sentence, it is a real multiplier.
Every search engine pays it, because phrase search is not optional to users, and
every one of them then spends effort compressing the result.

Three details the checks are built around:

**A document matching twice is reported once.** Doc 2 is `brown fox brown fox`,
so the phrase `brown fox` starts at positions 0 and 2. The `found.back() !=`
guard handles it, and it works because the outer loop walks a list already
sorted by document — so repeats are always consecutive. Without that ordering,
the deduplication would need a sort or a set.

**Order matters and adjacency matters, separately.** `quick fox` fails because
they are never adjacent; `fox brown` succeeds only in doc 2, where `brown`
follows `fox`. Two different checks, and an implementation that only tested
"same document, positions differ by one" in absolute value would pass the first
and fail the second.

**The query goes through the same tokeniser as the documents.** `"QUICK,
brown!"` matches, and that is not a special case — it is what you get by
refusing to have two different notions of what a word is. Any text-processing
system that tokenises queries differently from documents will fail on exactly
the inputs its author did not think of.

The optimisation left on the table is worth naming. Iterating the *first* term's
entries costs one pass over its whole list, so a phrase beginning with a common
word — `the quick brown fox` — scans every occurrence of `the`. Starting from
the rarest term and searching outwards in both directions is what a real index
does, and it turns the cost from "how common is the first word" into "how common
is the rarest word". The code is fiddlier; the win is enormous on natural text.
