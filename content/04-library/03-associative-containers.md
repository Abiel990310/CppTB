---
title: "Associative containers"
navTitle: "Associative containers"
summary: >-
  map, set, and their unordered counterparts.
objectives:
  - Choose between ordered and unordered containers
  - Explain what a hash collision costs
  - Use a custom comparator or hash correctly
status: complete
standard: c++20
requires: [sequence-containers]
---

Sequence containers answer "what is at position *i*". Associative containers
answer "is *x* in here, and what is it associated with" — without you writing
the search.

There are four, and they are two pairs: `map` and `set` keep their elements
sorted, `unordered_map` and `unordered_set` hash them. The choice between a pair
is about ordering; the choice between `map` and `set` is only whether each key
carries a value.

## map: keys with values, in order

```cpp run title="The operations you will use" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> scores{{"ada", 100}, {"alan", 92}};

    scores["grace"] = 88;                     // insert or overwrite
    scores["ada"] = 101;                      // overwrite

    std::cout << "size " << scores.size() << '\n';
    std::cout << "ada  " << scores.at("ada") << '\n';
    std::cout << "has alan? " << std::boolalpha << scores.contains("alan") << '\n';

    // Iteration is in sorted key order, always.
    for (const auto& [name, score] : scores) {
        std::cout << "  " << name << ": " << score << '\n';
    }
}
```

`contains` is C++20 here — unlike on `std::string`, where it is C++23. The
containers got it first.

### operator[] inserts

The single most common `map` surprise:

```cpp run title="Looking something up can create it" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<std::string, int> scores{{"ada", 100}};

    std::cout << "size before: " << scores.size() << '\n';

    if (scores["nobody"] == 0) {              // this INSERTS "nobody"
        std::cout << "  no entry for nobody\n";
    }

    std::cout << "size after:  " << scores.size() << '\n';
    std::cout << "nobody is now present with value " << scores.at("nobody") << '\n';
}
```

`operator[]` returns a reference to the mapped value, so it must have one to
refer to — a missing key is default-constructed and inserted. That is exactly
what you want for `++counts[word]`, and exactly what you do not want for a
lookup.

The alternatives, in order of preference:

```cpp run title="Reading without inserting" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<std::string, int> scores{{"ada", 100}};

    // 1. find: gives you the entry, or end()
    if (auto it = scores.find("ada"); it != scores.end()) {
        std::cout << "find:     " << it->first << " = " << it->second << '\n';
    }

    // 2. contains: when you only need the yes/no
    std::cout << "contains: " << std::boolalpha << scores.contains("nobody") << '\n';

    // 3. at: throws rather than inserting, and works on a const map
    try {
        std::cout << scores.at("nobody") << '\n';
    } catch (const std::out_of_range&) {
        std::cout << "at:       threw, as it should\n";
    }

    std::cout << "size unchanged: " << scores.size() << '\n';
}
```

:::tip
`operator[]` does not exist on a `const std::map`, precisely because it might
modify. If you find yourself unable to call it, the compiler is telling you that
you meant `find` or `at`.
:::

### The structured binding

`for (const auto& [key, value] : m)` decomposes each `std::pair` into two names.
Without it you are writing `it->first` and `it->second`, which say nothing about
what they hold:

```cpp run title="Counting words" std=c++20
#include <iostream>
#include <map>
#include <sstream>
#include <string>

int main() {
    const std::string text = "the quick brown fox jumps over the lazy dog the end";

    std::map<std::string, int> counts;
    std::istringstream words{text};
    for (std::string word; words >> word; ) {
        ++counts[word];                       // insert-if-missing is the point here
    }

    for (const auto& [word, count] : counts) {
        if (count > 1) std::cout << word << " appears " << count << " times\n";
    }
    std::cout << counts.size() << " distinct words, in sorted order\n";
}
```

## set: keys alone

A `set` is a `map` with nothing on the right-hand side — membership and
ordering, no associated value.

```cpp run title="Deduplicating and sorting in one step" std=c++20
#include <iostream>
#include <set>
#include <vector>

int main() {
    const std::vector<int> input{5, 3, 9, 3, 1, 5, 9};

    std::set<int> unique(input.begin(), input.end());

    for (int x : unique) std::cout << x << ' ';
    std::cout << "\n" << input.size() << " values in, " << unique.size() << " out\n";

    auto [it, inserted] = unique.insert(3);
    std::cout << "inserting 3 again: " << std::boolalpha << inserted << '\n';
}
```

`insert` returns a pair of the iterator and whether it actually inserted, which
is how you test-and-add in one lookup rather than two.

## Ordered or hashed?

`std::map` and `std::set` are balanced binary search trees. Every operation is
O(log n), and iteration visits keys in sorted order.

`std::unordered_map` and `std::unordered_set` are hash tables. Operations are
O(1) *average*, and iteration order is unspecified and may change when the table
grows.

```cpp run title="The cost difference, measured" std=c++20
#include <chrono>
#include <iostream>
#include <map>
#include <string>
#include <unordered_map>

int main() {
    constexpr int n = 200'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    std::map<int, int> ordered;
    std::unordered_map<int, int> hashed;

    auto start = clock::now();
    for (int i = 0; i < n; ++i) ordered.emplace(i, i);
    auto a = clock::now();
    for (int i = 0; i < n; ++i) hashed.emplace(i, i);
    auto b = clock::now();

    long long sink = 0;
    for (int i = 0; i < n; ++i) sink += ordered.find(i)->second;
    auto c = clock::now();
    for (int i = 0; i < n; ++i) sink += hashed.find(i)->second;
    auto d = clock::now();

    std::cout << "map    insert: " << std::chrono::duration_cast<ms>(a - start).count() << " ms\n";
    std::cout << "hash   insert: " << std::chrono::duration_cast<ms>(b - a).count() << " ms\n";
    std::cout << "map    lookup: " << std::chrono::duration_cast<ms>(c - b).count() << " ms\n";
    std::cout << "hash   lookup: " << std::chrono::duration_cast<ms>(d - c).count() << " ms\n";
    std::cout << "(checksum " << sink << ")\n";
}
```

The hash table wins on both, which is the usual result. So why is `std::map` the
one people reach for first? Habit, mostly — but there are real reasons to
choose it:

- **You need sorted iteration.** A hash table cannot give it without sorting
  afterwards.
- **You need range queries.** `lower_bound` and `upper_bound` find "the first
  key not less than *k*", which a hash table cannot answer at all.
- **Your key has no good hash** and writing one is more trouble than the
  ordering costs.
- **Pointer stability matters.** More on this below.

```cpp run title="What only an ordered container can do" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<int, std::string> events{
        {100, "start"}, {250, "middle"}, {400, "end"}};

    // The first event at or after time 200:
    auto it = events.lower_bound(200);
    std::cout << "at or after 200: " << it->first << " " << it->second << '\n';

    // Everything strictly before 400:
    for (auto i = events.begin(); i != events.upper_bound(399); ++i) {
        std::cout << "  before 400: " << i->first << '\n';
    }
}
```

## What a collision costs

A hash table puts each key in a bucket chosen by its hash. Two keys landing in
the same bucket is a **collision**, and the table resolves it by searching within
the bucket — which means a table where everything collides degrades to a linear
scan.

```cpp run title="A deliberately terrible hash" std=c++20
#include <chrono>
#include <iostream>
#include <unordered_map>

struct Key {
    int value;
    bool operator==(const Key& other) const { return value == other.value; }
};

struct GoodHash {
    std::size_t operator()(const Key& k) const { return std::hash<int>{}(k.value); }
};

struct TerribleHash {
    std::size_t operator()(const Key&) const { return 0; }   // everything collides
};

template <class Hash>
long long time_lookups(const char* label) {
    constexpr int n = 20'000;
    std::unordered_map<Key, int, Hash> table;
    for (int i = 0; i < n; ++i) table.emplace(Key{i}, i);

    auto start = std::chrono::steady_clock::now();
    long long sink = 0;
    for (int i = 0; i < n; ++i) sink += table.find(Key{i})->second;
    auto finish = std::chrono::steady_clock::now();

    std::cout << label
              << std::chrono::duration_cast<std::chrono::milliseconds>(finish - start).count()
              << " ms (checksum " << sink << ")\n";
    return sink;
}

int main() {
    time_lookups<GoodHash>("good hash:     ");
    time_lookups<TerribleHash>("everything collides: ");
}
```

Every key in one bucket turns O(1) into O(n), and the same 20,000 lookups go
from instant to noticeably slow. A hash table's guarantee is *average* O(1), and
the average is over a hash that spreads keys out.

:::warning
This is a denial-of-service vector, not just a performance note. If an attacker
controls the keys and can predict your hash, they can force every insertion into
one bucket. Language runtimes that hash untrusted input — web frameworks parsing
query parameters, for instance — use randomly seeded hashes for exactly this
reason. The C++ standard library does not seed randomly, so do not feed
untrusted keys into an `unordered_map` and assume O(1).
:::

## Custom keys

To use your own type as a key you must supply what the container needs: a
comparison for the ordered containers, a hash and equality for the hashed ones.

```cpp run title="A custom key, both ways" std=c++20
#include <iostream>
#include <map>
#include <string>
#include <unordered_map>

struct Point {
    int x;
    int y;

    // For map/set: a strict weak ordering. The spaceship operator writes it.
    auto operator<=>(const Point&) const = default;
    bool operator==(const Point&) const = default;
};

// For unordered_map/set: a specialisation of std::hash.
template <>
struct std::hash<Point> {
    std::size_t operator()(const Point& p) const noexcept {
        // Combine the members; do not just add or XOR them, or (1,2) and (2,1)
        // collide. This is the shape boost::hash_combine uses.
        std::size_t h = std::hash<int>{}(p.x);
        h ^= std::hash<int>{}(p.y) + 0x9e3779b9 + (h << 6) + (h >> 2);
        return h;
    }
};

int main() {
    std::map<Point, std::string> ordered{
        {{1, 2}, "first"}, {{0, 5}, "second"}};

    std::unordered_map<Point, std::string> hashed{
        {{1, 2}, "first"}, {{0, 5}, "second"}};

    std::cout << "ordered iteration is sorted by x then y:\n";
    for (const auto& [point, name] : ordered) {
        std::cout << "  (" << point.x << ", " << point.y << ") " << name << '\n';
    }

    std::cout << "hashed lookup: " << hashed.at(Point{1, 2}) << '\n';
}
```

Two rules that are easy to get wrong:

**A hash must agree with equality.** If `a == b`, then `hash(a)` must equal
`hash(b)`. Break this and lookups fail intermittently — the container looks in
one bucket while the element sits in another.

**Do not combine members by adding or XOR-ing them.** `hash(x) ^ hash(y)` maps
`(1, 2)` and `(2, 1)` to the same value, and `(3, 3)` and `(4, 4)` both to zero.
The shift-and-mix above is the standard fix.

:::note
`operator<=>` with `= default` generates all six comparison operators from
memberwise comparison, in declaration order. It is C++20 and it replaces the
half-page of boilerplate that a comparator used to need. Chapter 3.6 covers it
properly.
:::

## Reference stability

One thing the ordered and hashed containers both give you, and vector does not:
**references to elements stay valid across insertion and erasure of other
elements.**

```cpp run title="Node-based containers do not move their elements" std=c++20
#include <iostream>
#include <map>
#include <string>

int main() {
    std::map<int, std::string> m{{1, "one"}};

    std::string& first = m[1];

    for (int i = 2; i < 1000; ++i) m[i] = "filler";   // lots of insertion

    std::cout << "reference still valid: " << first << '\n';
    std::cout << "map now holds " << m.size() << " entries\n";
}
```

Both are node-based: each element lives in its own allocation that nothing moves.
`unordered_map` invalidates *iterators* when it rehashes, but not references or
pointers to elements. That makes them the right choice when something else needs
to hold onto an element — a cache handing out references, say — even where a
vector would be faster to iterate.

## Choosing

1. **Need sorted iteration, or range queries like `lower_bound`?** `std::map` or
   `std::set`.
2. **Otherwise, and the key hashes well?** `std::unordered_map` or
   `std::unordered_set` — usually faster.
3. **Small collection, say under 50 elements, iterated more than searched?** A
   sorted `std::vector` of pairs often beats both, because contiguity wins at
   that size. Measure.
4. **Keys are untrusted input?** Do not rely on `unordered_*` being O(1).

## Check yourself

:::quiz
{
  "question": "`std::map<std::string,int> m; if (m[\"missing\"] == 0) { … }` — what does this do?",
  "options": [
    { "text": "Reads the value, finding nothing, and leaves the map unchanged", "why": "`operator[]` returns a reference to the mapped value, so it must produce one — a missing key is default-constructed and inserted." },
    { "text": "Inserts \"missing\" with a value-initialised 0, then compares", "correct": true, "why": "Exactly. The map grows by one entry as a side effect of what looks like a read. Use find, contains, or at when you mean to look something up." },
    { "text": "Throws std::out_of_range", "why": "That is `at`. `operator[]` never throws for a missing key; it creates one." },
    { "text": "Fails to compile on a non-const map", "why": "It compiles on a non-const map. It fails to compile on a *const* one, precisely because it might modify." }
  ]
}
:::

:::quiz
{
  "question": "Why is combining hashes with `hash(x) ^ hash(y)` a bad idea?",
  "options": [
    { "text": "XOR is slower than addition", "why": "Both are a single instruction. Speed is not the issue." },
    { "text": "It is symmetric, so (1,2) and (2,1) collide — and any pair of equal members hashes to zero", "correct": true, "why": "Right, and both patterns are common in real data: coordinates, ranges, and pairs of ids. The shift-and-mix combination breaks the symmetry." },
    { "text": "XOR can produce a value larger than the bucket count", "why": "Every hash does; the container reduces it modulo the bucket count. That is expected and harmless." },
    { "text": "It violates the requirement that equal keys hash equally", "why": "It actually satisfies that one. The problem is the reverse direction — far too many *unequal* keys hashing the same." }
  ]
}
:::

## Practice

:::exercise word-frequency

:::exercise custom-key-hash

:::recap
- `map`/`set` are sorted trees: O(log n), sorted iteration, and range queries
  via `lower_bound`. `unordered_map`/`unordered_set` are hash tables: O(1)
  average, unspecified order.
- Prefer the hashed versions unless you need ordering — they are usually faster.
- `operator[]` on a map **inserts** a missing key. Use `find`, `contains`, or
  `at` to look something up without changing the map.
- A hash table's O(1) is an average over a hash that spreads keys. Everything in
  one bucket is O(n), and with untrusted keys that is an attack, not an accident.
- A custom hash must agree with equality, and must not combine members with a
  symmetric operation like XOR.
- Both families are node-based, so references to elements survive insertion and
  erasure of others — unlike vector.
:::
