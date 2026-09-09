---
title: "The contest template and fast I/O"
navTitle: "Template and fast I/O"
summary: >-
  The four lines every solution starts with, what they are worth, and the input shapes you will meet.
objectives:
  - Measure what C++ stream I/O costs and know when it matters
  - Read every input shape a contest uses, including one with no count
  - Write a template that does not get in your way
status: complete
standard: c++20
requires: [counting-the-work]
---

Every solution in this part starts the same way, and it is worth knowing what
those lines actually buy before you copy them for the next forty chapters.

```cpp
#include <bits/stdc++.h>          // everything, on GCC and Clang
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    …
}
```

Two of those four lines are performance, one is convenience, and one is a habit
this book has spent nine parts arguing against. All four deserve a reason.

## What `sync_with_stdio(false)` is worth

By default, C++ streams are kept synchronised with C's `stdio` — every
`cin >>` is coordinated with anything that might have used `scanf`, so that
mixing them works. Almost nobody mixes them, and the coordination is not free.

One million integers, read three ways, best of three runs at `-O2`:

| | Time |
|---|---|
| `cin >>`, default settings | 372 ms |
| `cin >>` after `sync_with_stdio(false)` and `cin.tie(nullptr)` | **96 ms** |
| `scanf("%d")` | 118 ms |

Nearly four times, for two lines. And note the third row: **unsynchronised
`cin` is faster than `scanf` here.** The folklore that `scanf` is the fast
option is out of date — it was true when the streams were slow, and what is
actually slow is the synchronisation.

`cin.tie(nullptr)` is the second half. By default `cin` is *tied* to `cout`,
meaning every read flushes pending output first — which is what makes an
interactive prompt appear before the program waits. A contest program has
nobody to prompt, and the flush per read is pure cost.

:::warning
Two conditions on `sync_with_stdio(false)`. After it, **do not mix** `cin`/`cout`
with `scanf`/`printf` in the same program — the buffers are now independent and
the interleaving is unspecified. And it must be called **before any I/O
happens**, which is why it is the first line of `main`.

For an *interactive* problem — where the judge responds to what you print — you
must not untie the streams, and you must flush deliberately after each output.
Those problems say so in the statement.
:::

## `'\n'` versus `std::endl`

`std::endl` writes a newline **and flushes the stream**. Flushing means a system
call. Doing that once per line of a large output is the other common way to
exceed a time limit.

300,000 lines of output:

| | To `/dev/null` | To a file |
|---|---|---|
| `std::endl` | 114 ms | 210 ms |
| `'\n'` | **18 ms** | **20 ms** |

Ten times, writing to a file. The stream flushes when it is destroyed at the end
of `main`, so nothing is lost by not flushing yourself.

Use `'\n'`. Reach for `std::endl` only when you genuinely need the output to
appear now — interactive problems, and debugging a program that crashes.

## The input shapes

Four cover almost everything.

**A count, then that many values.** The common case.

```cpp
int n;
cin >> n;
vector<int> a(n);
for (int& x : a) cin >> x;
```

**Several test cases in one file.** The first number is how many follow.

```cpp
int tests;
cin >> tests;
while (tests--) {
    // read and solve one case
}
```

**Values until the end of input, with no count given.**

```cpp run title="Reading until there is nothing left"
#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    long long value;
    long long total = 0;
    int count = 0;

    while (std::cin >> value) {      // false when extraction fails or EOF
        total += value;
        ++count;
    }

    std::cout << count << " values, sum " << total << '\n';
}
```

With no input at all — which is what this page gives it — that prints
`0 values, sum 0`, because the loop body never runs. That is the correct
behaviour for an empty file, and it costs nothing to get right.

**Lines, rather than whitespace-separated tokens.** This is the one with a trap.

```cpp run title="The getline trap"
#include <iostream>
#include <sstream>
#include <string>

int main() {
    // Standing in for an input file containing "3\nhello world\n".
    std::istringstream input("3\nhello world\n");

    int n;
    input >> n;                       // reads 3, leaves the newline behind

    std::string first;
    std::getline(input, first);       // reads the rest of the line: nothing
    std::cout << "n = " << n << ", first getline: [" << first
              << "] length " << first.size() << '\n';

    std::string second;
    std::getline(input, second);      // now the line you wanted
    std::cout << "second getline: [" << second << "]\n";
}
```

`cin >> n` stops at the newline and leaves it in the buffer. The next
`getline` reads from there to the end of that line, which is an empty string.
The fix is to consume the rest of the line first:

```cpp
cin >> n;
cin.ignore(numeric_limits<streamsize>::max(), '\n');   // discard to end of line
getline(cin, line);
```

or, more simply, use `>>` for everything when the input has no embedded spaces,
and `getline` for everything when it does. Mixing them is what causes this.

## `#include <bits/stdc++.h>`

A GCC and Clang implementation detail that includes the entire standard
library in one line. It is not standard C++ and does not exist on MSVC.

It is right for a contest and wrong for everything else. In a contest you are
optimising for the twenty seconds it takes to remember whether `std::accumulate`
is in `<numeric>` or `<algorithm>`, and nobody will ever compile your file
again. Chapter 7.6 measured what it costs — seven unused standard headers took
an empty program from 35 ms to over a second to compile, and `bits/stdc++.h` is
all of them — which matters enormously in a project and not at all for a file
compiled once.

Every sample in this part includes what it uses, because they are teaching
material and a reader should be able to see where a name comes from. Your
contest template should use `bits/stdc++.h`. Both statements are true.

## `using namespace std;`

Chapter 4.9 argued against this, and that argument stands for any code that
lives longer than a submission: it drags every standard name into the global
namespace, where it can collide with yours, and the collisions are found at the
worst moment.

In a contest file the tradeoff genuinely reverses. Nothing else is in the file,
nobody links against it, and `sort(all(a))` beats `std::sort(a.begin(), a.end())`
when you are typing against a clock.

The one thing to know is which names it captures, because these bite:

| Your name | Collides with |
|---|---|
| `count` | `std::count` |
| `size` | `std::size` |
| `data` | `std::data` |
| `begin`, `end` | `std::begin`, `std::end` |
| `next`, `prev` | `std::next`, `std::prev` |
| `swap`, `max`, `min` | the obvious ones |
| `y1`, `y0`, `j1` | POSIX Bessel functions in `<cmath>` |

That last row is the famous one: `int y1;` fails to compile on GCC with a
message about a conflicting declaration, because `<cmath>` puts a function
called `y1` in the global namespace. Chapter 5.5's authoring notes hit the same
thing with `gamma`. Name your variables `y_1`, or anything else.

## A template worth using

```cpp
#include <bits/stdc++.h>
using namespace std;

using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int tests = 1;
    // cin >> tests;              // uncomment when the input has a case count

    while (tests--) {
        int n;
        cin >> n;

        vector<ll> a(n);
        for (ll& x : a) cin >> x;

        // solve

        cout << "\n";
    }
}
```

Short on purpose. Templates that arrive with two hundred lines of macros, a
debug printer and a segment tree cost more than they save: you spend the first
minute scrolling past code you are not using, and the macros make the compiler's
error messages worse at the moment you most need them.

The two things worth having beyond the above are `using ll = long long;`,
because you will type it constantly, and the multi-test-case loop, because
switching a solution to it under time pressure is exactly when mistakes happen.

:::tip
Keep debugging output on `cerr`, never `cout`. A judge compares stdout only, so
`cerr << "here\n"` cannot cause a wrong answer and does not need removing before
submission. It is still worth deleting — it is unbuffered and slow — but
forgetting to costs nothing.
:::

## Check yourself

:::quiz
{
  "question": "A solution reads 10^6 integers with `cin >>` and times out. What is the first thing to try?",
  "options": [
    { "text": "`ios::sync_with_stdio(false); cin.tie(nullptr);` at the top of main — measured here at 372 ms against 96 ms for the same reads", "correct": true, "why": "Two lines, roughly four times faster, and no change to the rest of the program. Switching to scanf is not the answer; unsynchronised cin was faster than scanf in the same measurement." },
    { "text": "Rewrite the input with `scanf`", "why": "Measured at 118 ms here — better than synchronised `cin`, worse than unsynchronised. The synchronisation was the cost, not the streams." },
    { "text": "Read into a `std::string` and parse it by hand", "why": "That can help at the very top end, but it is a large change to make before trying the two-line one." },
    { "text": "Increase the buffer with `cin.rdbuf()->pubsetbuf`", "why": "Little effect compared to removing the per-operation synchronisation, and easy to get wrong." }
  ]
}
:::

:::quiz
{
  "question": "`cin >> n;` followed immediately by `getline(cin, line);` gives an empty `line`. Why?",
  "options": [
    { "text": "`>>` stops at the newline and leaves it in the buffer, so `getline` reads from there to the end of that same line — which is empty", "correct": true, "why": "Consume the rest of the line first with `cin.ignore(numeric_limits<streamsize>::max(), '\\n')`, or avoid mixing `>>` and `getline` in one program." },
    { "text": "`getline` needs the stream to be untied", "why": "Tying affects flushing of output before reads, not where the read position is." },
    { "text": "`n` consumed the whole first line", "why": "It consumed the digits and stopped. The newline is still there, which is precisely the problem." },
    { "text": "`getline` requires a `std::string` that has been sized in advance", "why": "It resizes the string itself." }
  ]
}
:::

## Practice

:::exercise input-shapes

:::exercise judge-multi-case

:::exercise judge-line-tokens

:::recap
- `ios::sync_with_stdio(false); cin.tie(nullptr);` measured 372 ms down to 96 ms
  for a million integers. Unsynchronised `cin` beat `scanf` (118 ms), so the old
  advice to switch to `scanf` is backwards.
- Do not mix C and C++ I/O after unsynchronising, call it before any I/O, and do
  not use it on interactive problems.
- `'\n'` rather than `std::endl`: 20 ms against 210 ms for 300,000 lines to a
  file, because `endl` flushes every time.
- `while (cin >> x)` reads until the input runs out, and does nothing sensible
  and nothing wrong on an empty file.
- `>>` leaves the newline behind, so a following `getline` returns an empty
  string. Ignore to the end of the line, or do not mix the two.
- `bits/stdc++.h` and `using namespace std;` are right for a contest file and
  wrong for a project, and knowing why is the point. Watch out for `y1`.
- Keep debugging on `cerr`; a judge only reads stdout.
:::
