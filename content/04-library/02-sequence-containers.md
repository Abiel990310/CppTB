---
title: "Sequence containers"
navTitle: "Sequence containers"
summary: >-
  vector, array, deque, and list, and how to pick between them.
objectives:
  - Predict the complexity of insertion for each sequence container
  - Explain vector's growth strategy and reallocation
  - Identify when an iterator is invalidated
status: complete
standard: c++20
requires: [strings, arrays-and-decay]
---

Four containers hold elements in an order you choose. Picking between them is
usually easy, because the answer is usually `std::vector` — but knowing *why*
it is usually the answer is what lets you recognise the cases where it is not.

## std::vector, and why it wins

A vector is a single contiguous block of elements, plus a size and a capacity.
That layout gives it two properties nothing else has: indexing is one
multiply-and-add, and iterating touches consecutive bytes, which is what
processors are built for.

```cpp run title="The operations, and their costs" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};

    v.push_back(4);                    // amortised O(1)
    v.insert(v.begin(), 0);            // O(n) — everything shifts up
    v.pop_back();                      // O(1)

    std::cout << "size " << v.size() << ", capacity " << v.capacity() << ": ";
    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';

    std::cout << "front " << v.front() << ", back " << v.back()
              << ", v[1] " << v[1] << '\n';
}
```

`size()` is how many elements there are. `capacity()` is how many there is room
for before the next reallocation. They are different numbers and the gap is
where vector's performance lives.

### Growth is geometric

When a `push_back` runs out of capacity, the vector allocates a bigger block,
moves every element across, and frees the old one. If it grew by one each time,
appending *n* elements would cost *n²* moves. It grows by a *factor* instead —
so the cost of appending *n* elements totals O(n), and any individual
`push_back` is O(1) *amortised*.

```cpp run title="Watching it grow" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v;
    std::size_t last = 0;

    for (int i = 0; i < 1000; ++i) {
        v.push_back(i);
        if (v.capacity() != last) {
            std::cout << "size " << v.size() << " -> capacity " << v.capacity() << '\n';
            last = v.capacity();
        }
    }
    std::cout << "reallocated " << "only at those points\n";
}
```

libstdc++ doubles. Microsoft's implementation grows by 1.5×. Neither is
guaranteed by the standard — only the amortised O(1) is.

If you know the final size, `reserve` skips the whole sequence:

```cpp run title="reserve, measured" std=c++20
#include <chrono>
#include <iostream>
#include <string>
#include <vector>

int main() {
    constexpr int n = 300'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    std::vector<std::string> grown;
    for (int i = 0; i < n; ++i) grown.emplace_back(32, 'x');
    auto mid = clock::now();

    std::vector<std::string> reserved;
    reserved.reserve(n);
    for (int i = 0; i < n; ++i) reserved.emplace_back(32, 'x');
    auto finish = clock::now();

    std::cout << "no reserve: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "reserve:    " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(sizes " << grown.size() << ", " << reserved.size() << ")\n";
}
```

:::tip
`reserve` changes capacity, not size. `resize` changes size, constructing or
destroying elements to match. Confusing them gives you a vector of *n*
value-initialised elements that you then append *n* more to — a bug that shows
up as a result twice as long as expected.
:::

`emplace_back` constructs the element in place from its arguments;
`push_back` takes an already-built object and copies or moves it. For a
`std::string` built from a literal, `emplace_back` saves a move.

## Reallocation invalidates everything

This is the rule that turns vector's speed into a hazard. When a vector
reallocates, every pointer, reference, and iterator into it becomes dangling —
the elements are somewhere else now.

```cpp run expect-ub title="A reference that outlived its element" std=c++20
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};
    v.reserve(3);                  // capacity exactly 3, so the next push grows it

    int& first = v[0];
    std::cout << "before: " << first << '\n';

    v.push_back(4);                // reallocates: the old block is freed

    std::cout << "after:  " << first << '\n';   // dangling
}
```

:::warning
The dangerous part is that it is *conditional*. If there had been spare
capacity, no reallocation would have happened and the reference would still be
valid. The same code is correct or catastrophic depending on a number you cannot
see, which is why this survives testing and fails in production with a larger
input.
:::

:::memviz
{
  "title": "What reallocation does to your references",
  "code": "std::vector<int> v{1, 2, 3};\nv.reserve(3);\n\nint& first = v[0];\n\nv.push_back(4);",
  "steps": [
    {
      "caption": "The vector owns one heap block: three elements, capacity three.",
      "line": 2,
      "stack": [
        { "id": "v", "name": "v", "type": "vector<int>",
          "fields": [{ "k": "data", "v": "→", "anchor": "v.d" },
                     { "k": "size", "v": "3" }, { "k": "capacity", "v": "3" }] }
      ],
      "heap": [ { "id": "b1", "name": "int[3]", "value": "1, 2, 3", "state": "new" } ],
      "arrows": [{ "from": "v.d", "to": "b1" }]
    },
    {
      "caption": "`first` binds to element 0 — a name for a location inside that block.",
      "line": 4,
      "stack": [
        { "id": "v", "name": "v", "type": "vector<int>",
          "fields": [{ "k": "data", "v": "→", "anchor": "v.d" },
                     { "k": "size", "v": "3" }, { "k": "capacity", "v": "3" }] },
        { "id": "ref", "name": "first", "type": "int&", "state": "new",
          "fields": [{ "k": "names", "v": "v[0]", "anchor": "r.d" }] }
      ],
      "heap": [ { "id": "b1", "name": "int[3]", "value": "1, 2, 3" } ],
      "arrows": [{ "from": "v.d", "to": "b1" }, { "from": "r.d", "to": "b1" }]
    },
    {
      "caption": "push_back finds no spare capacity. It allocates a larger block and moves all three elements into it.",
      "line": 6,
      "stack": [
        { "id": "v", "name": "v", "type": "vector<int>",
          "fields": [{ "k": "data", "v": "→ new", "anchor": "v.d" },
                     { "k": "size", "v": "4" }, { "k": "capacity", "v": "6" }] },
        { "id": "ref", "name": "first", "type": "int&", "state": "danger",
          "fields": [{ "k": "names", "v": "old v[0]", "anchor": "r.d" }] }
      ],
      "heap": [
        { "id": "b1", "name": "int[3]", "value": "freed", "state": "freed" },
        { "id": "b2", "name": "int[6]", "value": "1, 2, 3, 4", "state": "new" }
      ],
      "arrows": [
        { "from": "v.d", "to": "b2" },
        { "from": "r.d", "to": "b1", "state": "dangling", "label": "undefined" }
      ]
    }
  ]
}
:::

The invalidation rules, which are worth knowing rather than guessing:

| Operation | Invalidates |
|---|---|
| `push_back`, `emplace_back` | everything, **if** it reallocates |
| `insert`, `emplace` | everything if it reallocates; otherwise from the insertion point on |
| `erase` | from the erased position on |
| `clear`, `resize` smaller | the removed elements |
| `reserve`, `shrink_to_fit` | everything, if capacity changes |
| `operator[]`, `at`, `front`, `back`, iteration | nothing |

The safe habit: **do not hold a pointer, reference, or iterator across an
operation that can modify the container's size.** Take an index instead — an
index survives reallocation.

## std::array: a fixed size that behaves

Covered in Chapter 2.6, and worth repeating here because it belongs in this
comparison. `std::array<T, N>` is a raw array with the sharp edges removed: the
size is part of the type, it does not decay, and it can be copied and returned.
The storage is wherever you declare it — no heap allocation at all.

```cpp run title="No allocation, no decay" std=c++20
#include <array>
#include <iostream>

std::array<int, 4> doubled(std::array<int, 4> values) {
    for (int& v : values) v *= 2;
    return values;                       // returning an array: fine
}

int main() {
    std::array<int, 4> data{1, 2, 3, 4};
    auto result = doubled(data);

    std::cout << "size known at compile time: " << result.size() << '\n';
    for (int v : result) std::cout << v << ' ';
    std::cout << '\n';
    std::cout << "original untouched: " << data[0] << '\n';
}
```

Use it whenever the count is a compile-time constant. It is strictly better than
a raw array and cheaper than a vector.

## std::deque: growth at both ends

A `deque` (double-ended queue) supports O(1) insertion and removal at *both*
ends. It manages a set of fixed-size blocks rather than one contiguous buffer,
which buys one useful guarantee vector cannot give:

```cpp run title="Pushing at the front, and what survives it" std=c++20
#include <deque>
#include <iostream>
#include <vector>

int main() {
    std::deque<int> d{2, 3};
    d.push_front(1);                  // O(1) — a vector would shift everything
    d.push_back(4);

    for (int x : d) std::cout << x << ' ';
    std::cout << '\n';

    // References to existing elements survive insertion at either end.
    int& middle = d[1];
    d.push_front(0);
    d.push_back(5);
    std::cout << "reference still valid: " << middle << '\n';

    std::cout << "contiguous? " << std::boolalpha
              << false << "  (that is the trade)\n";
}
```

Inserting at either *end* of a deque leaves references to existing elements
valid — though it does invalidate iterators. That is genuinely useful when you
are building a queue while holding onto elements.

What you give up: the elements are not contiguous, so there is no `.data()` to
hand to a C API, indexing costs an extra indirection, and iteration is slower
because it crosses block boundaries.

Reach for `deque` when you need to grow at the front. `std::queue` and
`std::stack` use it by default for exactly this reason.

## std::list: O(1) insertion anywhere, and why it rarely helps

A `std::list` is a doubly linked list: each element in its own allocation, with
pointers to its neighbours. Inserting or erasing anywhere is O(1) *given an
iterator to the position*, and no other element moves — every reference and
iterator except the erased one stays valid.

That sounds unbeatable, and it is almost always slower anyway:

```cpp run title="The theory versus the machine" std=c++20
#include <chrono>
#include <iostream>
#include <list>
#include <vector>

int main() {
    constexpr int n = 200'000;
    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    std::vector<int> v;
    std::list<int> l;
    for (int i = 0; i < n; ++i) { v.push_back(i); l.push_back(i); }

    // Sum every element: the operation real code spends its time on.
    auto start = clock::now();
    long long vs = 0;
    for (int x : v) vs += x;
    auto mid = clock::now();

    long long ls = 0;
    for (int x : l) ls += x;
    auto finish = clock::now();

    std::cout << "vector traversal: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "list traversal:   " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(sums " << vs << ", " << ls << ")\n";
}
```

Same number of additions, very different times. The vector's elements are
adjacent, so each cache line fetch brings in sixteen of them; the list's are
scattered, so each step is a pointer chase to somewhere the processor could not
predict. Part 7 measures this properly.

There is a second cost the timing does not show: a `list` of 200,000 `int`s
makes 200,000 separate allocations, each carrying two pointers of overhead —
roughly 24 bytes to store 4 bytes of data.

:::pitfall
The classic argument for `list` is "I insert in the middle a lot, and that is
O(n) for a vector". It is usually wrong, because the O(n) shift in a vector is a
`memmove` of contiguous bytes — extremely fast — while getting *to* the middle
of a list is itself an O(n) pointer chase through scattered memory. Unless you
already hold an iterator to the position and the elements are large, vector
wins. Measure before believing otherwise.
:::

`std::list` earns its place when you need references to elements to stay valid
through arbitrary insertion and erasure — an intrusive registry, or an LRU cache
where entries move between lists via `splice`, which relinks nodes without
touching the elements at all.

## Choosing

1. **`std::vector`** unless you have a reason. Contiguous, cache-friendly, and
   the interface everything else is compared against.
2. **`std::array`** when the size is a compile-time constant.
3. **`std::deque`** when you need to grow at the front, or need references to
   survive appends at either end.
4. **`std::list`** when you need iterator and reference stability under
   arbitrary insertion, or `splice`.

## Check yourself

:::quiz
{
  "question": "`std::vector<int> v{1,2,3}; int& r = v[0]; v.push_back(4);` — is `r` still usable?",
  "options": [
    { "text": "Yes, push_back only adds at the end", "why": "It adds at the end, but if capacity is exhausted it first allocates a new block, moves every element, and frees the old one — taking `r`'s target with it." },
    { "text": "Only if the vector had spare capacity; otherwise it dangles", "correct": true, "why": "Exactly, and that conditionality is what makes it dangerous. The same line is fine or catastrophic depending on capacity, which is invisible at the call site — so it survives small-input testing." },
    { "text": "No, push_back always invalidates references", "why": "Not always: with capacity() > size() there is room already and nothing moves. 'Sometimes' is a worse failure mode than 'always'." },
    { "text": "Yes, because vector reallocation preserves addresses", "why": "Reallocation is precisely a change of address. The elements are moved to a new block." }
  ]
}
:::

:::quiz
{
  "question": "You need to append a million elements, then iterate them repeatedly. Which container, and why?",
  "options": [
    { "text": "`std::list`, because appending is O(1) with no reallocation", "why": "Its appends never reallocate, but it makes a million separate allocations and its traversal is a pointer chase — far slower than vector for exactly the workload described." },
    { "text": "`std::vector` with `reserve(1'000'000)`", "correct": true, "why": "Right. reserve removes the reallocations entirely, and contiguous storage makes the repeated iteration as fast as it can be. This is the default answer for a reason." },
    { "text": "`std::deque`, to avoid reallocation", "why": "It does avoid reallocating a single buffer, but iteration crosses block boundaries and indexing costs an extra indirection. Nothing here needs growth at the front." },
    { "text": "`std::array<int, 1'000'000>`", "why": "A million ints is 4 MB, and std::array puts them wherever it is declared — as a local, that overflows a typical 8 MB stack quickly and is inflexible besides." }
  ]
}
:::

## Practice

:::exercise stable-references

:::exercise reserve-and-fill

:::recap
- `std::vector` is contiguous: O(1) indexing, cache-friendly iteration,
  amortised O(1) append. It is the default.
- Capacity is not size. Growth is geometric, so appending *n* elements is O(n)
  total; `reserve` removes the reallocations when you know the size.
- Reallocation invalidates every pointer, reference, and iterator — but only
  when it happens, which is why the bug is intermittent. Hold an index instead.
- `std::array` for a compile-time size, with no allocation and no decay.
- `std::deque` for growth at the front; references to existing elements survive
  end insertions, at the cost of contiguity.
- `std::list` gives O(1) insertion anywhere and total reference stability, and
  is usually slower anyway — each element is its own allocation and traversal is
  a pointer chase. Choose it for stability or `splice`, not for speed.
:::
