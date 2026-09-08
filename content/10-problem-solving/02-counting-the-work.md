---
title: "Counting the work you actually do"
navTitle: "Counting the work"
summary: >-
  Deriving the complexity of the code in front of you, including the parts that do not look like loops.
objectives:
  - Derive the complexity of a loop nest and confirm it by doubling the input
  - Find the hidden cost in a standard-library call inside a loop
  - Recognise when the constant factor rather than the exponent is the problem
status: complete
standard: c++20
requires: [reading-a-problem]
---

The previous chapter turned a constraint into a budget. This one is the other
half: given code, how many operations does it actually perform?

That question is harder than it looks, because the expensive parts of a C++ loop
are frequently the parts that are not written as loops. `v.erase(v.begin())` is
one short line and O(n) work.

## The doubling test

You do not have to be able to analyse code to measure it. Double the input and
see what happens to the time.

```cpp run title="Four runs, one ratio"
#include <chrono>
#include <cstdio>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

int main() {
    for (int n : {500, 1000, 2000, 4000}) {
        auto start = std::chrono::steady_clock::now();
        long long count = 0;
        for (int i = 0; i < n; ++i)
            for (int j = 0; j < n; ++j) count += i ^ j;
        double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count();
        keep(count);
        std::printf("n = %5d   %8.2f ms\n", n, ms);
    }
}
```

Each doubling of `n` multiplies the time by about **four**. That is the
signature of O(n²), and you can read the exponent straight off the ratio:

| Time multiplies by | Complexity |
|---|---|
| ≈ 2 | O(n) |
| slightly more than 2 | O(n log n) |
| ≈ 4 | O(n²) |
| ≈ 8 | O(n³) |
| ≈ 2ⁿ⁺¹ / 2ⁿ = 2 per **+1** to n | O(2ⁿ) |

This is the most useful debugging tool in this part of the book. When a solution
times out and you are not sure why, run it on inputs of 1,000 and 2,000 and look
at the ratio. A 4× jump says you have a quadratic you did not intend.

## Counting loops

The rules are short.

**Sequential loops add; nested loops multiply.** Two loops one after another are
O(n + m); one inside the other is O(n · m).

**A dependent inner bound halves it, and halving does not change the class.**

```cpp
for (int i = 0; i < n; ++i)
    for (int j = i + 1; j < n; ++j)   // n(n-1)/2 iterations
```

That is n²/2, which is O(n²). The constant matters for whether you fit in the
limit; it does not change the complexity, and both facts are worth holding at
once.

**A loop whose index multiplies is logarithmic.**

```cpp
for (int i = 1; i <= n; i *= 2)       // log2(n) iterations
```

**Two pointers that only move forward are linear, however nested they look.**

```cpp
int j = 0;
for (int i = 0; i < n; ++i)
    while (j < n && condition(i, j)) ++j;    // O(n) total, not O(n^2)
```

`j` never decreases and never exceeds `n`, so the inner loop's body runs at most
`n` times **in total** across all iterations of the outer one. Counting the
total work rather than the worst case of a single iteration is what tells you
this, and it is the whole idea behind the two-pointer technique in Chapter 10.6.

## Amortised: `push_back` is O(1), sometimes

`std::vector::push_back` occasionally reallocates and copies everything. That
single call is O(n). Yet pushing n elements is O(n) in total, not O(n²).

```cpp run title="How often a vector actually reallocates"
#include <cstdio>
#include <vector>

int main() {
    std::vector<int> values;
    std::size_t previous = 0;
    int reallocations = 0;

    for (int i = 0; i < 1'000'000; ++i) {
        values.push_back(i);
        if (values.capacity() != previous) {
            previous = values.capacity();
            ++reallocations;
        }
    }

    std::printf("1,000,000 pushes caused %d reallocations\n", reallocations);
    std::printf("final capacity: %zu (2^20 is %d)\n", values.capacity(), 1 << 20);
}
```

Twenty-one reallocations for a million pushes. Capacity doubles, so the copies
cost 1 + 2 + 4 + … + n < 2n in total — linear across the whole sequence, which
is what **amortised O(1)** means: not "each call is cheap" but "n calls cost
O(n)".

:::pitfall
Amortised guarantees are per *sequence*, and they evaporate if you reset. A loop
that builds a vector, clears it, and rebuilds it is fine — `clear()` keeps the
capacity. A loop that constructs a *fresh* vector each time pays the growth
every time. And `reserve` in front of a known-size fill removes even the 21.
:::

## The costs that do not look like loops

This is where solutions time out.

```cpp run title="Four one-liners, priced"
#include <chrono>
#include <cstdio>
#include <set>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

template <class Body>
double time_it(Body body) {
    auto start = std::chrono::steady_clock::now();
    auto result = body();
    keep(result);
    return std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count();
}

int main() {
    constexpr int n = 8'000;

    double front = time_it([] {
        std::vector<int> v(n, 1);
        while (!v.empty()) v.erase(v.begin());      // O(n) per call
        return v.size();
    });
    double back = time_it([] {
        std::vector<int> v(n, 1);
        while (!v.empty()) v.pop_back();            // O(1) per call
        return v.size();
    });

    std::vector<int> data(n);
    for (int i = 0; i < n; ++i) data[i] = i;
    std::set<int> lookup(data.begin(), data.end());

    double scan = time_it([&] {
        int hits = 0;
        for (int q = 0; q < n; ++q)
            for (int x : data) if (x == q) { ++hits; break; }   // O(n) per query
        return hits;
    });
    double tree = time_it([&] {
        int hits = 0;
        for (int q = 0; q < n; ++q) hits += static_cast<int>(lookup.count(q));
        return hits;
    });

    std::printf("erase(begin()) x%d : %8.1f ms\n", n, front);
    std::printf("pop_back()     x%d : %8.1f ms\n", n, back);
    std::printf("linear scan    x%d : %8.1f ms\n", n, scan);
    std::printf("set::count     x%d : %8.1f ms\n", n, tree);
}
```

Erasing from the front is O(n) because everything after it shifts down, so
emptying a vector that way is O(n²). Searching a vector for each of n queries is
O(n²). Neither loop *looks* quadratic; the quadratic part is inside a call.

The table to keep in your head:

| Operation | Cost |
|---|---|
| `vector` index, `push_back`, `pop_back` | O(1), the last amortised |
| `vector::insert` / `erase` at position i | O(n − i) — O(n) at the front |
| `sort` | O(n log n) |
| `set` / `map` insert, find, erase | O(log n), with a large constant |
| `unordered_set` / `unordered_map` | O(1) average, O(n) worst case |
| `set`/`map` iteration in order | O(n), already sorted |
| `string` concatenation `a + b` | O(len a + len b), and it allocates |
| `string::substr` | O(length), and it allocates |
| `std::find` on any range | O(n) |
| `count`, `accumulate`, `max_element` | O(n) |
| `binary_search`, `lower_bound` on a sorted **random-access** range | O(log n) |
| `lower_bound` on a `std::list` or `std::set` iterator pair | **O(n)** — no random access |

The last row is a genuine trap: `std::lower_bound(s.begin(), s.end(), x)` on a
`std::set` compiles, gives the right answer, and is linear. Use `s.lower_bound(x)`,
the member function, which is logarithmic.

:::warning
`std::map::operator[]` **inserts** when the key is absent. `if (counts[key] > 0)`
adds an entry with value 0 as a side effect, which grows the map, changes what
iterating it produces, and cannot be called on a `const` map at all. Use `find`
or `contains` to ask, and `operator[]` only when you intend to create.
:::

## When the exponent is not the problem

Complexity is about how cost grows, not how large it is. Two consequences that
matter in a contest.

**Below some size, the worse class wins.** Linear search beats a `std::set` for
a few dozen elements: the set allocates a node per element, scatters them across
memory, and pays a pointer chase per comparison, while the vector scan is
sequential and predictable — Chapter 7.3's argument. `std::sort` itself switches
to insertion sort for small ranges for exactly this reason.

**The constant can be the whole difference.** `std::map` and
`std::unordered_map` are O(log n) and O(1), and in Chapter 9.5's benchmark the
hash map was three times faster on 5,000 string keys — not because log 5000 is
13, but because tree traversal is thirteen dependent pointer chases and a hash
is one pass over the string. Meanwhile an `unordered_map` of *integers* is
frequently beaten by a plain sorted `vector` with `lower_bound`, because the
vector never allocates and the binary search stays in cache.

The practical rule: **use complexity to rule things out, and measurement to
choose between what remains.** The constraint tells you O(n²) will not fit. It
does not tell you which of two linear solutions is faster, and no amount of
staring will.

## Check yourself

:::quiz
{
  "question": "You time a solution at n = 1000 and n = 2000 and get 30 ms and 480 ms. What is its complexity?",
  "options": [
    { "text": "About O(n⁴) — doubling n multiplied the time by 16", "correct": true, "why": "2⁴ = 16. The doubling test reads the exponent straight off the ratio: 2 is linear, 4 is quadratic, 8 is cubic, 16 is quartic." },
    { "text": "O(n²), because the time went up by a lot", "why": "Quadratic would give roughly 4×, so about 120 ms. Sixteen is two doublings further." },
    { "text": "O(2ⁿ)", "why": "Exponential doubles for every *increment* of n, not every doubling of it. From 1000 to 2000 it would be unmeasurably worse." },
    { "text": "Not determinable without profiling", "why": "Two points and a ratio determine the exponent well enough to act on, which is what makes this test worth doing." }
  ]
}
:::

:::quiz
{
  "question": "`for (int i = 0; i < n; ++i) if (std::find(v.begin(), v.end(), i) != v.end()) ++hits;` — what is the complexity?",
  "options": [
    { "text": "O(n²): the loop is linear and `std::find` is linear, and nothing about the call site says so", "correct": true, "why": "This is the shape that times out most often, because the quadratic part is inside a call rather than in a visible nested loop." },
    { "text": "O(n log n), because `find` is a binary search", "why": "`std::find` is a linear scan. `std::binary_search` is the logarithmic one, and it requires a sorted range." },
    { "text": "O(n), because `find` stops early", "why": "It stops early when it hits, and scans everything when it misses. The worst case is what the complexity describes." },
    { "text": "O(n) amortised", "why": "Amortisation applies to a sequence of operations whose costs offset each other, such as vector growth. Nothing here gets cheaper because of an earlier call." }
  ]
}
:::

## Practice

:::exercise complexity-audit

:::exercise remove-the-quadratic

:::exercise judge-count-in-range

:::exercise judge-fib

:::recap
- Double the input and read the exponent off the ratio: 2× is linear, 4× is
  quadratic, 8× is cubic. Measured here, a nested loop multiplied by four per
  doubling.
- Sequential loops add, nested loops multiply, a dependent inner bound halves
  without changing the class, and a multiplying index is logarithmic.
- Two indices that only move forward are linear in total however nested they
  look — count the total work, not one iteration's worst case.
- Amortised O(1) is a guarantee about a *sequence*: a million `push_back`s
  caused 21 reallocations, and the copies sum to less than 2n.
- The expensive parts are often not loops. `erase(begin())` in a loop and
  `std::find` per query are both O(n²) written as one line each.
- `map::operator[]` inserts. `std::lower_bound` on a `set`'s iterators is linear.
- Complexity rules things out; measurement chooses between what is left. Below
  some size the worse complexity class wins, and constant factors decide the
  rest.
:::
