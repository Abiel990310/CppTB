---
id: boolean-queries
title: "Not every query is an AND"
difficulty: stretch
chapter: project
topics: [algorithms, containers, search, design]
check: unit
standard: c++20
---

The index from this chapter supports one query shape: every term must be
present. Extend it to three, using a prefix on each term:

| Query | Means |
|---|---|
| `pointer null` | both terms present (unchanged) |
| `+pointer +null reference` | `pointer` and `null` required, `reference` optional |
| `pointer -null` | `pointer` present, `null` absent |

The rules, precisely:

- A term with **no prefix** is *optional* if any `+` term is present in the
  query, and *required* otherwise. So a query of plain terms behaves exactly as
  it does today.
- A term with **`+`** is required. A document lacking it does not match.
- A term with **`-`** is excluded. A document containing it does not match, even
  if it matched everything else.
- A document matches if it satisfies every required term, contains at least one
  optional term when there are any optional terms and no required ones, and
  contains no excluded term.
- The score is still the sum of occurrences of every matching term the document
  contains — excluded terms contribute nothing, since a match cannot contain one.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

struct Posting { int document; int occurrences; };
struct Hit { int document; int score; };

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

class Index {
public:
    int add(std::string_view body) {
        const int id = documents_++;
        std::unordered_map<std::string, int> counts;
        for (const std::string& token : tokenise(body)) ++counts[token];
        for (const auto& [term, n] : counts) postings_[term].push_back(Posting{id, n});
        return id;
    }

    int documents() const { return documents_; }

    // Currently AND-only, and ignores any + or - prefixes.
    std::vector<Hit> search(std::string_view query) const {
        const std::vector<std::string> terms = tokenise(query);
        if (terms.empty()) return {};

        std::vector<Hit> hits;
        bool first = true;
        for (const std::string& term : terms) {
            auto it = postings_.find(term);
            if (it == postings_.end()) return {};
            if (first) {
                for (const Posting& p : it->second) hits.push_back(Hit{p.document, p.occurrences});
                first = false;
            } else {
                std::vector<Hit> merged;
                std::size_t a = 0, b = 0;
                while (a < hits.size() && b < it->second.size()) {
                    if (hits[a].document < it->second[b].document) ++a;
                    else if (it->second[b].document < hits[a].document) ++b;
                    else { merged.push_back(Hit{hits[a].document,
                                                hits[a].score + it->second[b].occurrences});
                           ++a; ++b; }
                }
                hits = std::move(merged);
            }
        }
        sort_hits(hits);
        return hits;
    }

protected:
    static void sort_hits(std::vector<Hit>& hits) {
        std::sort(hits.begin(), hits.end(), [](const Hit& x, const Hit& y) {
            if (x.score != y.score) return x.score > y.score;
            return x.document < y.document;
        });
    }

    int documents_ = 0;
    std::unordered_map<std::string, std::vector<Posting>> postings_;
};
```

## Tests
```cpp
Index index;
index.add("a pointer holds an address pointer pointer");   // 0: pointer x3, address
index.add("a reference is an alias and cannot be null");   // 1: reference, alias, null
index.add("a pointer can be null");                        // 2: pointer, null
index.add("moving transfers ownership");                   // 3

// Plain terms are still AND.
{
    std::vector<Hit> r = index.search("pointer null");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 2);
}
{
    std::vector<Hit> r = index.search("pointer");
    CHECK_EQ(r.size(), std::size_t{2});
    CHECK_EQ(r[0].document, 0);        // three occurrences beats one
    CHECK_EQ(r[0].score, 3);
    CHECK_EQ(r[1].document, 2);
}
CHECK(index.search("banana").empty());
CHECK(index.search("").empty());
CHECK(index.search("pointer banana").empty());

// Exclusion.
{
    std::vector<Hit> r = index.search("pointer -null");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 0);
}
{
    std::vector<Hit> r = index.search("null -pointer");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 1);
}
// Excluding a term nobody has changes nothing.
CHECK_EQ(index.search("pointer -banana").size(), std::size_t{2});
// Excluding everything leaves nothing.
CHECK(index.search("pointer -pointer").empty());

// Required plus optional.
{
    // pointer required; null and alias are optional and only add score.
    std::vector<Hit> r = index.search("+pointer null alias");
    CHECK_EQ(r.size(), std::size_t{2});
    CHECK_EQ(r[0].document, 0);        // pointer x3
    CHECK_EQ(r[0].score, 3);
    CHECK_EQ(r[1].document, 2);        // pointer + null
    CHECK_EQ(r[1].score, 2);
}
{
    std::vector<Hit> r = index.search("+pointer +null");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 2);
}
// Required and excluded together.
{
    std::vector<Hit> r = index.search("+pointer null -address");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 2);
}
// A required term nobody has means no results, whatever else matches.
CHECK(index.search("+banana pointer").empty());

// Optional-only with several terms behaves as AND, per the rules.
{
    std::vector<Hit> r = index.search("pointer address");
    CHECK_EQ(r.size(), std::size_t{1});
    CHECK_EQ(r[0].document, 0);
}
```

## Hints
- Do the prefix stripping *before* tokenising, because `tokenise` throws `+` and `-` away. Split the query on spaces yourself first, look at the first character, then tokenise the rest of that word.
- A term like `+pointer` should tokenise to `pointer` — pass the substring after the prefix to `tokenise` and take its first token.
- Collect three vectors of terms: required, optional, excluded. Then decide: if `required` is empty, the optional terms become required (that is the rule that keeps plain queries working as AND).
- Build the candidate set from the required terms exactly as the starter does — the same merge intersection. If any required term is missing from the index, return empty immediately.
- Then add scores from the optional terms: for each, walk its posting list and add `occurrences` to any hit whose document matches. Do not drop hits that lack an optional term.
- Then remove excluded documents: for each excluded term present in the index, remove every hit whose document appears in its posting list. An excluded term that is not in the index removes nothing.
- Both of those passes can be a merge over sorted lists, since hits stay sorted by document id until the final `sort_hits`.
- `sort_hits` is given; call it once at the end.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

struct Posting { int document; int occurrences; };
struct Hit { int document; int score; };

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

class Index {
public:
    int add(std::string_view body) {
        const int id = documents_++;
        std::unordered_map<std::string, int> counts;
        for (const std::string& token : tokenise(body)) ++counts[token];
        for (const auto& [term, n] : counts) postings_[term].push_back(Posting{id, n});
        return id;
    }

    int documents() const { return documents_; }

    std::vector<Hit> search(std::string_view query) const {
        std::vector<std::string> required, optional, excluded;
        parse_query(query, required, optional, excluded);

        // With no explicit + terms, the plain terms are all required — which is
        // what keeps an ordinary query an AND.
        if (required.empty()) {
            required = std::move(optional);
            optional.clear();
        }
        if (required.empty()) return {};

        std::vector<Hit> hits;
        bool first = true;
        for (const std::string& term : required) {
            auto it = postings_.find(term);
            if (it == postings_.end()) return {};
            if (first) {
                for (const Posting& p : it->second) hits.push_back(Hit{p.document, p.occurrences});
                first = false;
            } else {
                hits = intersect(hits, it->second);
            }
            if (hits.empty()) return {};
        }

        for (const std::string& term : optional) {
            auto it = postings_.find(term);
            if (it == postings_.end()) continue;
            add_scores(hits, it->second);
        }

        for (const std::string& term : excluded) {
            auto it = postings_.find(term);
            if (it == postings_.end()) continue;
            hits = remove_documents(hits, it->second);
        }

        sort_hits(hits);
        return hits;
    }

private:
    static void parse_query(std::string_view query,
                            std::vector<std::string>& required,
                            std::vector<std::string>& optional,
                            std::vector<std::string>& excluded) {
        std::size_t i = 0;
        while (i < query.size()) {
            while (i < query.size() && query[i] == ' ') ++i;
            std::size_t start = i;
            while (i < query.size() && query[i] != ' ') ++i;
            if (start == i) break;

            std::string_view word = query.substr(start, i - start);
            std::vector<std::string>* target = &optional;
            if (word.front() == '+') { target = &required; word.remove_prefix(1); }
            else if (word.front() == '-') { target = &excluded; word.remove_prefix(1); }

            for (std::string& token : tokenise(word)) target->push_back(std::move(token));
        }
    }

    static std::vector<Hit> intersect(const std::vector<Hit>& hits,
                                      const std::vector<Posting>& list) {
        std::vector<Hit> merged;
        std::size_t a = 0, b = 0;
        while (a < hits.size() && b < list.size()) {
            if (hits[a].document < list[b].document) ++a;
            else if (list[b].document < hits[a].document) ++b;
            else { merged.push_back(Hit{hits[a].document, hits[a].score + list[b].occurrences});
                   ++a; ++b; }
        }
        return merged;
    }

    static void add_scores(std::vector<Hit>& hits, const std::vector<Posting>& list) {
        std::size_t a = 0, b = 0;
        while (a < hits.size() && b < list.size()) {
            if (hits[a].document < list[b].document) ++a;
            else if (list[b].document < hits[a].document) ++b;
            else { hits[a].score += list[b].occurrences; ++a; ++b; }
        }
    }

    static std::vector<Hit> remove_documents(const std::vector<Hit>& hits,
                                             const std::vector<Posting>& list) {
        std::vector<Hit> kept;
        std::size_t a = 0, b = 0;
        while (a < hits.size()) {
            while (b < list.size() && list[b].document < hits[a].document) ++b;
            if (b == list.size() || list[b].document != hits[a].document) kept.push_back(hits[a]);
            ++a;
        }
        return kept;
    }

    static void sort_hits(std::vector<Hit>& hits) {
        std::sort(hits.begin(), hits.end(), [](const Hit& x, const Hit& y) {
            if (x.score != y.score) return x.score > y.score;
            return x.document < y.document;
        });
    }

    int documents_ = 0;
    std::unordered_map<std::string, std::vector<Posting>> postings_;
};
```

## Notes
Three query modes, and the implementation is three passes over the same sorted
lists: intersect the required terms, add score from the optional ones, subtract
the excluded ones. Every pass is a merge, because everything stays sorted by
document id from the moment it is built — which is the design decision the
chapter measured, paying off again in code that did not exist when it was made.

The rule worth arguing about is what a bare term means. Making it required when
there are no `+` terms and optional when there are looks inconsistent written
down, and it is what every search engine does, because it is what users expect:
typing three words means "all three", and adding a `+` signals that you are now
being explicit and the rest is a preference. The alternative — bare terms are
always optional — turns `pointer null` into a query matching almost everything,
which is not what anyone wanted. The lesson is that the *specification* is the
hard part; once it is written down, the code follows.

Note the asymmetry between a missing required term and a missing excluded one. A
required term that is in no document means the query cannot match anything, so
returning early is both correct and the fastest possible answer. An excluded term
that is in no document excludes nothing, so it is skipped. Getting this backwards
— returning empty for an unknown excluded term — is the most likely bug here, and
the `pointer -banana` check is what catches it.

`remove_documents` is written as a filtering walk rather than a merge that
advances both sides in step, because it must emit hits the other list does *not*
contain. That shape — advance the second list past everything smaller, then test
for equality — is the standard one for a set difference over sorted ranges, and
`std::set_difference` does exactly it if the two ranges have the same element
type. Here they do not, so it is written out.

What is still missing, in the order it would hurt: parenthesised grouping and
real `OR` between subexpressions, which needs an actual parser rather than three
vectors; phrases, which need positions and are the next problem; and any notion
that a rare term should count for more than a common one, which is tf-idf and is
where the results start looking like a search engine's.
