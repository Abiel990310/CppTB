---
title: "Algorithms"
navTitle: "Algorithms"
summary: >-
  The functions in <algorithm> that replace most hand-written loops.
objectives:
  - Replace a hand-written loop with a standard algorithm
  - Use the erase-remove idiom correctly
  - Explain what a projection is in a ranges algorithm
status: complete
standard: c++20
requires: [sequence-containers, associative-containers]
---

Most loops you write have been written before. `<algorithm>` holds about a
hundred of them, already correct, already named. Using them is not about
cleverness — it is that `std::find_if` cannot have an off-by-one error, and a
reader knows what it does without reading the body.

## The shape of every algorithm

They take a range as two iterators — first, and one past the last — and often a
callable:

```cpp run title="Four you will use constantly" std=c++20
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

int main() {
    std::vector<int> v{4, 8, 15, 16, 23, 42};

    auto it = std::find(v.begin(), v.end(), 15);
    std::cout << "found 15 at index " << (it - v.begin()) << '\n';

    const bool any_odd = std::any_of(v.begin(), v.end(), [](int x) { return x % 2; });
    std::cout << "any odd? " << std::boolalpha << any_odd << '\n';

    const int total = std::accumulate(v.begin(), v.end(), 0);
    std::cout << "sum " << total << '\n';

    const auto biggest = std::max_element(v.begin(), v.end());
    std::cout << "max " << *biggest << '\n';
}
```

`std::accumulate` lives in `<numeric>`, not `<algorithm>` — a historical split
that catches everyone once.

An algorithm that searches returns `end()` when it finds nothing, exactly as
`std::find` on a container does. **Always check before dereferencing:**

```cpp run expect-ub title="Dereferencing a failed search" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3};

    auto it = std::find(v.begin(), v.end(), 99);   // not there
    std::cout << "the value is " << *it << '\n';   // dereferencing end()
}
```

## Ranges: the same algorithms, without the iterator pair

C++20 added a `std::ranges` version of nearly every algorithm that takes the
container directly:

```cpp run title="The same four, in ranges form" std=c++20
#include <algorithm>
#include <iostream>
#include <numeric>
#include <vector>

int main() {
    std::vector<int> v{4, 8, 15, 16, 23, 42};

    auto it = std::ranges::find(v, 15);
    std::cout << "found: " << *it << '\n';
    std::cout << "any odd? " << std::boolalpha
              << std::ranges::any_of(v, [](int x) { return x % 2; }) << '\n';
    std::cout << "max " << *std::ranges::max_element(v) << '\n';

    std::ranges::sort(v, std::greater{});
    for (int x : v) std::cout << x << ' ';
    std::cout << '\n';
}
```

Prefer the `std::ranges::` versions in new code. They are shorter, they cannot
be given mismatched iterators from two different containers, and they support
projections.

### Projections

A projection says *which part of each element to look at*. It removes the most
common reason people fall back to a hand-written loop:

```cpp run title="Sorting and searching by a member" std=c++20
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Person {
    std::string name;
    int age;
};

int main() {
    std::vector<Person> people{{"ada", 36}, {"alan", 41}, {"grace", 45}};

    // Sort by age: no comparator lambda needed, just say which member.
    std::ranges::sort(people, {}, &Person::age);
    for (const auto& p : people) std::cout << p.name << ' ';
    std::cout << '\n';

    // Find by name.
    auto it = std::ranges::find(people, "grace", &Person::name);
    std::cout << "grace is " << it->age << '\n';

    // Largest by age.
    std::cout << "oldest: " << std::ranges::max(people, {}, &Person::age).name << '\n';
}
```

The `{}` is the comparison — `std::ranges::less` by default. The third argument
is the projection, applied to each element before comparing. `&Person::age` is a
pointer-to-member, and the library knows how to invoke it.

## Erasing: the idiom, and its replacement

Removing elements is where the algorithm interface is least intuitive.
`std::remove` **does not remove anything.** It cannot — an algorithm sees
iterators, not the container, so it has no way to change the size.

What it does is shuffle the survivors to the front and return where the new end
should be:

```cpp run title="What remove actually does" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v{1, 2, 3, 2, 4, 2};

    auto new_end = std::remove(v.begin(), v.end(), 2);

    std::cout << "size is still " << v.size() << '\n';
    std::cout << "contents now: ";
    for (int x : v) std::cout << x << ' ';
    std::cout << "  <- tail is unspecified\n";
    std::cout << "survivors: " << (new_end - v.begin()) << '\n';
}
```

The classic fix is the **erase-remove idiom**, which hands that returned
iterator to the container's own `erase`:

```cpp run title="erase-remove, and the modern replacement" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> classic{1, 2, 3, 2, 4, 2};
    classic.erase(std::remove(classic.begin(), classic.end(), 2), classic.end());
    std::cout << "erase-remove: ";
    for (int x : classic) std::cout << x << ' ';
    std::cout << "(size " << classic.size() << ")\n";

    // C++20: one call, and no way to get it wrong.
    std::vector<int> modern{1, 2, 3, 2, 4, 2};
    std::erase(modern, 2);
    std::cout << "std::erase:   ";
    for (int x : modern) std::cout << x << ' ';
    std::cout << "(size " << modern.size() << ")\n";

    std::vector<int> conditional{1, 2, 3, 4, 5, 6};
    std::erase_if(conditional, [](int x) { return x % 2 == 0; });
    std::cout << "erase_if:     ";
    for (int x : conditional) std::cout << x << ' ';
    std::cout << '\n';
}
```

:::pitfall
Forgetting the second argument — writing `v.erase(std::remove(...))` — compiles
and does something quite different: it erases exactly one element, leaving the
stale tail in place. The vector then contains duplicated values and the wrong
size. This is the single most common `<algorithm>` bug, and it is why
`std::erase` and `std::erase_if` were added in C++20. Use them.
:::

## Sorting, and what it requires

```cpp run title="Sorting, stably and partially" std=c++20
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Entry {
    std::string name;
    int score;
};

int main() {
    std::vector<Entry> entries{
        {"ada", 90}, {"alan", 85}, {"grace", 90}, {"edsger", 85}};

    // stable_sort keeps the original relative order of equal elements.
    std::ranges::stable_sort(entries, std::greater{}, &Entry::score);
    for (const auto& e : entries) std::cout << e.name << '(' << e.score << ") ";
    std::cout << '\n';

    // When you only need the top few, do not sort everything.
    std::vector<int> numbers{9, 1, 8, 2, 7, 3, 6, 4, 5};
    std::ranges::partial_sort(numbers, numbers.begin() + 3);
    std::cout << "three smallest: " << numbers[0] << ' ' << numbers[1] << ' ' << numbers[2] << '\n';

    // nth_element is even cheaper when you want a rank, not an order.
    std::vector<int> more{9, 1, 8, 2, 7, 3, 6, 4, 5};
    std::ranges::nth_element(more, more.begin() + 4);
    std::cout << "median: " << more[4] << '\n';
}
```

`sort` requires a **strict weak ordering**: `comp(a, a)` must be false, and if
`comp(a, b)` then `!comp(b, a)`. A comparator using `<=` violates the first rule,
and the consequence is not a wrong order — it is undefined behaviour, often a
crash, because the implementation may run off the end of the range.

```cpp run expect-ub title="A comparator that is not a strict weak ordering" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> v(200, 7);           // all equal
    for (int i = 0; i < 200; ++i) v[i] = i % 5;

    // Using <= means comp(a, a) is true, which sort is entitled to assume never happens.
    std::sort(v.begin(), v.end(), [](int a, int b) { return a <= b; });

    std::cout << "if you are reading this, you got lucky\n";
}
```

Write `<`, never `<=`. For your own types, `operator<=>` with `= default`
generates a correct ordering for you.

## Composing without loops

```cpp run title="Transform, copy, and count" std=c++20
#include <algorithm>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

int main() {
    const std::vector<std::string> words{"alpha", "be", "gamma", "hi", "delta"};

    std::vector<std::size_t> lengths;
    std::ranges::transform(words, std::back_inserter(lengths),
                           [](const std::string& w) { return w.size(); });
    for (auto n : lengths) std::cout << n << ' ';
    std::cout << '\n';

    std::vector<std::string> longer;
    std::ranges::copy_if(words, std::back_inserter(longer),
                         [](const std::string& w) { return w.size() > 2; });
    std::cout << "longer than two: " << longer.size() << '\n';

    std::cout << "containing 'a': "
              << std::ranges::count_if(words, [](const std::string& w) {
                     return w.find('a') != std::string::npos;
                 })
              << '\n';
}
```

`std::back_inserter` is the answer to "where does the output go". Algorithms
write through an output iterator and cannot grow a container themselves; a back
inserter turns each write into a `push_back`.

:::warning
Writing to `dest.begin()` when `dest` is empty is a buffer overflow — the
algorithm writes to memory the container does not own. Either `resize` the
destination first, or use `std::back_inserter`. AddressSanitizer catches it;
without sanitizers it silently corrupts the heap.
:::

## When not to use an algorithm

Reaching for `<algorithm>` is right when a named algorithm expresses the intent.
It is wrong when the call is longer and less clear than the loop:

```cpp run title="Two ways to write the same thing" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> v{1, 2, 3, 4, 5};

    // Clear.
    int sum_loop = 0;
    for (int x : v) {
        if (x % 2 == 0) sum_loop += x * x;
    }

    // Also correct, and harder to read.
    int sum_algo = 0;
    std::ranges::for_each(v, [&](int x) { if (x % 2 == 0) sum_algo += x * x; });

    std::cout << sum_loop << ' ' << sum_algo << '\n';
}
```

`for_each` with a mutating lambda is a loop wearing a costume. The range-based
`for` is clearer. The algorithms worth reaching for are the ones with a *name
for what they do* — `find_if`, `any_of`, `sort`, `unique`, `partition` — because
the name is the documentation.

## Check yourself

:::quiz
{
  "question": "`v.erase(std::remove(v.begin(), v.end(), 2));` — what is wrong?",
  "options": [
    { "text": "Nothing; this is the erase-remove idiom", "why": "The idiom needs a *second* argument. This is the single-iterator overload of erase, which removes exactly one element." },
    { "text": "`erase` is called with one iterator, so it erases one element and leaves the stale tail", "correct": true, "why": "Exactly. The vector keeps its old size minus one and contains leftover values past the real end. It compiles cleanly, which is why this is the most common <algorithm> bug — and why std::erase exists in C++20." },
    { "text": "`std::remove` invalidates the iterators, so erase is undefined", "why": "remove only shuffles elements within the range; the iterators stay valid. The bug is the missing argument." },
    { "text": "`std::remove` should be `std::ranges::remove`", "why": "Either works. The ranges version returns a subrange, which actually makes the mistake harder to write — but the plain version is not itself the error." }
  ]
}
:::

:::quiz
{
  "question": "What does a projection do in `std::ranges::sort(people, {}, &Person::age)`?",
  "options": [
    { "text": "It sorts a copy of the ages, leaving people untouched", "why": "It sorts `people` itself. The projection changes what is compared, not what is reordered." },
    { "text": "It applies `&Person::age` to each element before comparing, so the sort is by age", "correct": true, "why": "Right. The `{}` is the comparison (less, by default) and the projection selects what to feed it — replacing the comparator lambda that used to be needed." },
    { "text": "It filters the range to elements that have an age", "why": "That would be a view like `filter`. A projection transforms what is looked at, it does not drop elements." },
    { "text": "It makes the sort stable with respect to age", "why": "Stability is a separate choice: `sort` is not stable, `stable_sort` is, whether or not a projection is used." }
  ]
}
:::

## Practice

:::exercise remove-duplicates

:::exercise top-scorers

:::recap
- Algorithms take a range and often a callable; searching ones return `end()`
  for "not found", which must be checked before dereferencing.
- Prefer `std::ranges::` versions: they take the container directly, cannot mix
  iterators from two containers, and accept projections.
- A projection says which part of each element to compare — `&Person::age`
  instead of a comparator lambda.
- `std::remove` removes nothing; it shuffles survivors forward and returns the
  new end. Use C++20's `std::erase` and `std::erase_if` instead of the
  erase-remove idiom, which is easy to write wrongly.
- `sort` needs a strict weak ordering. `<=` is not one, and the result is
  undefined behaviour rather than a wrong order.
- Use `std::back_inserter` for output, never `begin()` on an empty container.
- Skip the algorithm when a plain loop is clearer. `for_each` with a mutating
  lambda is a loop in disguise.
:::
