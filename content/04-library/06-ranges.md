---
title: "Ranges and views"
navTitle: "Ranges and views"
summary: >-
  Composable, lazy pipelines over sequences.
objectives:
  - Compose a pipeline of views
  - Explain what makes a view lazy and cheap to copy
  - Identify when a view dangles
status: complete
standard: c++20
requires: [algorithms, iterators]
---

Chapter 4.5 used `std::ranges::` algorithms because they take a container
instead of two iterators. That is the small half of what ranges added. The
larger half is **views**: sequences you can compose into a pipeline that does
the work lazily, as you read it.

## The problem views solve

Combining algorithms means allocating a container for each step:

```cpp run title="Three passes and two temporaries" std=c++20
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> input{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    std::vector<int> evens;
    std::ranges::copy_if(input, std::back_inserter(evens), [](int x) { return x % 2 == 0; });

    std::vector<int> squared;
    std::ranges::transform(evens, std::back_inserter(squared), [](int x) { return x * x; });

    std::vector<int> first_three(squared.begin(), squared.begin() + 3);

    for (int x : first_three) std::cout << x << ' ';
    std::cout << "\n(two temporary vectors, three passes)\n";
}
```

The same thing as a pipeline:

```cpp run title="One pass, no temporaries" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    const std::vector<int> input{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    auto pipeline = input
                  | std::views::filter([](int x) { return x % 2 == 0; })
                  | std::views::transform([](int x) { return x * x; })
                  | std::views::take(3);

    for (int x : pipeline) std::cout << x << ' ';
    std::cout << "\n(no temporaries, and only as much work as take(3) needed)\n";
}
```

`|` is the composition operator. It reads left to right in the order the data
flows, which is the order you think in.

## Lazy means nothing happens until you read

A view does no work when constructed. It stores what to do, and does it one
element at a time as you iterate — which is why the `take(3)` above stops the
whole pipeline after three results rather than filtering all ten:

```cpp run title="Watching the laziness" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    const std::vector<int> input{1, 2, 3, 4, 5, 6, 7, 8};

    auto pipeline = input
                  | std::views::filter([](int x) {
                        std::cout << "  testing " << x << '\n';
                        return x % 2 == 0;
                    })
                  | std::views::transform([](int x) {
                        std::cout << "    squaring " << x << '\n';
                        return x * x;
                    })
                  | std::views::take(2);

    std::cout << "pipeline built — nothing has run yet\n\n";

    for (int x : pipeline) std::cout << "got " << x << "\n";

    std::cout << "\nnote it stopped at 4, never touching 5 through 8\n";
}
```

Nothing printed until the loop started, and the pipeline stopped as soon as
`take(2)` was satisfied. That is the property you cannot get from chained
algorithms: **work you do not need is never done.**

It also makes infinite sequences usable:

```cpp run title="An infinite range, taken finitely" std=c++20
#include <iostream>
#include <ranges>

int main() {
    // iota with no upper bound is infinite. Laziness makes that harmless.
    auto squares = std::views::iota(1)
                 | std::views::transform([](int n) { return n * n; })
                 | std::views::filter([](int n) { return n % 3 == 1; })
                 | std::views::take(5);

    for (int x : squares) std::cout << x << ' ';
    std::cout << '\n';
}
```

## Views are cheap to copy

A view holds a reference to the underlying range plus whatever it needs to do
its job. It does not own elements, so copying one is copying a couple of
pointers:

```cpp run title="What a view actually contains" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    std::vector<int> big(1'000'000, 7);

    auto view = big | std::views::filter([](int x) { return x > 0; });

    std::cout << "vector holds " << big.size() * sizeof(int) / 1024 << " KB\n";
    std::cout << "sizeof(view) = " << sizeof(view) << " bytes\n";

    auto copy = view;                    // copies the view, not the million ints
    std::cout << "copying the view is free; first element " << *copy.begin() << '\n';
}
```

This is why views are passed by value. `std::span` follows the same rule, and
so does `std::string_view` — which is a view in exactly this sense.

## The views worth knowing

```cpp run title="A tour" std=c++20
#include <iostream>
#include <ranges>
#include <string>
#include <vector>

int main() {
    const std::vector<int> v{5, 3, 8, 1, 9, 2};

    auto show = [](const char* label, auto&& range) {
        std::cout << label;
        for (auto&& x : range) std::cout << x << ' ';
        std::cout << '\n';
    };

    show("filter:   ", v | std::views::filter([](int x) { return x > 3; }));
    show("transform:", v | std::views::transform([](int x) { return x * 10; }));
    show("take:     ", v | std::views::take(3));
    show("drop:     ", v | std::views::drop(3));
    show("reverse:  ", v | std::views::reverse);

    // take_while / drop_while stop at the first element failing the test.
    show("take_while<8:", v | std::views::take_while([](int x) { return x < 8; }));

    // iota generates a range of values.
    show("iota 1..5:", std::views::iota(1, 6));

    // enumerate pairs each element with its index (C++23).
    std::cout << "keys/values on a map, and split on a string, are the other two\n";
}
```

Two more that come up constantly with real data:

```cpp run title="split and join" std=c++20
#include <iostream>
#include <ranges>
#include <string>
#include <string_view>

int main() {
    const std::string csv = "alpha,beta,gamma";

    for (auto field : csv | std::views::split(',')) {
        // Each field is a subrange; construct a string_view over it.
        std::string_view text{field.begin(), field.end()};
        std::cout << "field: " << text << '\n';
    }
}
```

:::note
`views::split` yields subranges rather than strings, which is the lazy,
allocation-free choice and also the reason it feels awkward the first time. The
`std::string_view{r.begin(), r.end()}` construction is the idiom for turning one
back into something printable. In C++23, `views::split` on a `string_view`
composes more smoothly.
:::

## When a view dangles

A view usually borrows, so the obvious guess is that a view over a temporary
dangles. Check that guess:

```cpp run title="A view over a temporary container" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

std::vector<int> make_data() { return {1, 2, 3, 4, 5}; }

int main() {
    // The temporary is piped straight into the pipeline.
    auto view = make_data() | std::views::filter([](int x) { return x % 2; });

    for (int x : view) std::cout << x << ' ';
    std::cout << "\n";

    std::cout << "the pipe produced an owning_view: " << std::boolalpha
              << std::is_same_v<decltype(std::views::all(make_data())),
                                std::ranges::owning_view<std::vector<int>>>
              << "\n";
}
```

That is correct, and it is not luck. Piping an **rvalue container** into a view
produces a `std::ranges::owning_view`, which *moves the container in and owns
it*. The temporary is not destroyed at the end of the statement — it lives
inside the view, for as long as the view does.

So the widely repeated advice that "a view over a temporary dangles" is wrong
for the most common case. The real rule is narrower and less intuitive:

> A view over an **lvalue** holds a reference to it. A view over an **rvalue
> container** owns it.

Which means the dangerous case is the one that looks safest — a named local:

```cpp run expect-ub title="The case that actually dangles" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

auto make_view() {
    std::vector<int> local{1, 2, 3, 4, 5};

    // `local` is an lvalue, so this stores a reference to it — not the vector.
    return local | std::views::filter([](int x) { return x % 2; });
}

int main() {
    auto view = make_view();
    for (int x : view) std::cout << x << ' ';   // the vector is long gone
    std::cout << "\n";
}
```

AddressSanitizer reports `stack-use-after-return`, and no warning was issued at
compile time. Note how the two samples differ: the safe one pipes the function's
result directly, and the dangerous one names it first. Adding a variable made it
worse.

The library does help where it can. Algorithms that return an iterator into
their argument return `std::ranges::dangling` instead when handed a temporary,
turning a run-time disaster into a compile error:

```cpp run expect-error title="The library refusing to hand you a dangling iterator"
#include <ranges>
#include <vector>

std::vector<int> make_data() { return {1, 2, 3}; }

int main() {
    // find returns ranges::dangling here, because the range was a temporary.
    auto it = std::ranges::find(make_data(), 2);
    return *it;      // error: no operator* on std::ranges::dangling
}
```

:::pitfall
The practical rule is about **returning**, not about temporaries. Do not return
a pipeline built over a local container: the local is an lvalue, so the view
holds a reference to storage that is about to disappear, and nothing warns you.
Return an owning container instead — see the next section.
:::

## Getting a container back

A pipeline is not a container. When you need one — to return it, store it, or
sort it — you have to materialise:

```cpp run title="Materialising a pipeline" std=c++20
#include <iostream>
#include <ranges>
#include <vector>

int main() {
    const std::vector<int> input{1, 2, 3, 4, 5, 6};

    auto pipeline = input | std::views::filter([](int x) { return x % 2 == 0; })
                          | std::views::transform([](int x) { return x * x; });

    // Construct from the pipeline's iterators.
    std::vector<int> result(pipeline.begin(), pipeline.end());

    for (int x : result) std::cout << x << ' ';
    std::cout << "\n(now an owning container, safe to return)\n";
}
```

That two-iterator constructor works here, but it is not the general answer. It
requires a **common range** — one whose `begin()` and `end()` have the same
type. Many pipelines are not common, and `take` over an unbounded range is the
usual way to meet one:

```cpp run title="When the two-iterator constructor does not apply" std=c++20
#include <iostream>
#include <iterator>
#include <ranges>
#include <vector>

int main() {
    auto pipeline = std::views::iota(1)
                  | std::views::filter([](int x) { return x % 3 == 0; })
                  | std::views::take(4);

    // std::vector<int> bad(pipeline.begin(), pipeline.end());
    //   ^ does not compile: end() is a sentinel of a different type

    std::vector<int> result;
    std::ranges::copy(pipeline, std::back_inserter(result));

    for (int x : result) std::cout << x << ' ';
    std::cout << "\n(ranges::copy works for any range, common or not)\n";
}
```

`std::ranges::copy` into a `back_inserter` is the form that always works, and a
plain `for` loop pushing each element is just as good. C++23 adds
`std::ranges::to<std::vector>()`, which appends to the pipeline directly —
`input | views::filter(...) | std::ranges::to<std::vector>()` — and handles both
cases.

:::pitfall
**Do not return a view built over a local container.** As shown above, a local
is an lvalue, so the view stores a reference to it and the compiler says
nothing. Return an owning container instead.
:::

## Is it faster?

Sometimes, and the reason is the temporaries, not magic:

```cpp run title="Pipeline versus intermediate containers" std=c++20
#include <algorithm>
#include <chrono>
#include <iostream>
#include <iterator>
#include <ranges>
#include <vector>

int main() {
    std::vector<int> input(1'000'000);
    for (std::size_t i = 0; i < input.size(); ++i) input[i] = static_cast<int>(i);

    using clock = std::chrono::steady_clock;
    using ms = std::chrono::milliseconds;

    auto start = clock::now();
    long long a = 0;
    {
        std::vector<int> evens;
        std::ranges::copy_if(input, std::back_inserter(evens), [](int x) { return x % 2 == 0; });
        std::vector<int> scaled;
        std::ranges::transform(evens, std::back_inserter(scaled), [](int x) { return x * 3; });
        for (int x : scaled) a += x;
    }
    auto mid = clock::now();

    long long b = 0;
    for (int x : input | std::views::filter([](int x) { return x % 2 == 0; })
                       | std::views::transform([](int x) { return x * 3; })) {
        b += x;
    }
    auto finish = clock::now();

    std::cout << "with temporaries: " << std::chrono::duration_cast<ms>(mid - start).count() << " ms\n";
    std::cout << "pipeline:         " << std::chrono::duration_cast<ms>(finish - mid).count() << " ms\n";
    std::cout << "(same answer: " << std::boolalpha << (a == b) << ")\n";
}
```

The pipeline avoids two allocations and two passes over a million elements. Where
a hand-written loop would be just as fast, the pipeline is not *faster* than the
loop — it is clearer, and no slower. Chapter 7.4 checks that claim against the
generated assembly.

## Check yourself

:::quiz
{
  "question": "When does `auto v = data | std::views::filter(pred);` run `pred`?",
  "options": [
    { "text": "Once per element, immediately, when the view is constructed", "why": "Nothing runs at construction. The sample that prints from inside the predicate shows the pipeline being built in silence." },
    { "text": "Once per element, but only as the view is iterated — and only for elements actually reached", "correct": true, "why": "That laziness is the point: a `take(2)` after the filter stops the whole pipeline early, so later elements are never tested at all." },
    { "text": "Once, when the view is copied", "why": "Copying a view copies its stored callable and range reference — a couple of pointers. It evaluates nothing." },
    { "text": "Never, unless you call .evaluate()", "why": "There is no such call. Iterating is what drives a pipeline." }
  ]
}
:::

:::quiz
{
  "question": "Why is returning a view from a function usually wrong?",
  "options": [
    { "text": "Views cannot be returned — they are not copyable", "why": "They are cheaply copyable, which is exactly why they are passed and returned by value. Copyability is not the problem." },
    { "text": "A view borrows its elements, so one over a local container dangles as soon as the function returns", "correct": true, "why": "The same rule as returning a reference to a local. Ranges catches some cases — algorithms return std::ranges::dangling for temporaries — but not a stored pipeline. Return an owning container." },
    { "text": "Views are slower than containers, so returning one loses performance", "why": "The opposite: a view avoids the allocation a container would need. The problem is lifetime, not speed." },
    { "text": "The pipeline would be re-evaluated on every read", "why": "It is re-evaluated on each traversal, which is worth knowing, but that is a correctness concern only if the predicate has side effects — not the reason to avoid returning one." }
  ]
}
:::

## Practice

:::exercise pipeline-refactor

:::exercise lazy-primes

:::recap
- Views compose with `|` into a pipeline that reads left to right in the order
  data flows.
- Views are **lazy**: nothing runs until iteration, and work past what you asked
  for is never done — which is what makes `take` on an infinite range sensible.
- A view is a couple of pointers. Copy and pass them by value.
- A view over an **lvalue** holds a reference; a view over an **rvalue
  container** owns it. So piping a temporary in is safe, and returning a
  pipeline built over a *named local* is the bug — the opposite of the usual
  advice.
- Ranges algorithms return `std::ranges::dangling` rather than an iterator into
  a temporary, which turns that mistake into a compile error.
- A pipeline is not a container. Materialise before returning: the two-iterator
  constructor works only for *common* ranges, so `std::ranges::copy` into a
  `back_inserter` — or `std::ranges::to` in C++23 — is the general form.
- The speedup over chained algorithms comes from skipping temporaries and extra
  passes, not from magic.
:::
