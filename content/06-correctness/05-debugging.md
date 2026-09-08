---
title: "Debugging"
navTitle: "Debugging"
summary: >-
  Finding the defect rather than guessing at it.
objectives:
  - Reduce a failing case to a minimal reproduction
  - Use a debugger's watchpoints and backtraces
  - Read a stack trace from a crash
status: complete
standard: c++20
requires: [testing, your-toolchain]
---

Debugging is not a tool, it is a method. The tools are Chapter 1.6's; what this
chapter adds is the discipline that makes them pay — because the most expensive
debugging sessions are the ones spent guessing.

## The method

1. **Reproduce it reliably.** A bug you cannot trigger on demand cannot be
   confirmed fixed. This step is often most of the work and is never optional.
2. **Reduce it.** Cut away everything that is not needed to make it happen.
3. **Locate it.** Bisect — in the input, in the code, or in history — until you
   have the smallest region that contains the fault.
4. **Understand it.** Explain *why* the symptom follows from the cause before
   changing anything.
5. **Fix it, and prove it.** Write the test that fails before your change and
   passes after.

Step 4 is the one people skip. A change that makes the symptom disappear without
an explanation has probably moved the bug rather than removed it.

## Reduction

A minimal reproduction is the highest-value artefact in debugging. It makes the
bug obvious, makes the report actionable, and often finds the fault on its own.

```cpp run title="A bug buried in noise" std=c++20
#include <iostream>
#include <string>
#include <vector>

std::string summarise(const std::vector<std::string>& lines, std::size_t width) {
    std::string out;
    for (const auto& line : lines) {
        std::string trimmed = line;
        while (!trimmed.empty() && trimmed.back() == ' ') trimmed.pop_back();
        if (trimmed.size() > width) {
            trimmed = trimmed.substr(0, width - 3) + "...";
        }
        out += trimmed + "\n";
    }
    return out;
}

int main() {
    std::cout << summarise({"a much longer line than the limit", "short  "}, 10);
    std::cout << "now with a small width:\n";
    std::cout << summarise({"anything"}, 2);      // width - 3 underflows
}
```

Look at what the second call printed: the whole string, plus an ellipsis, from
a function asked for at most two characters.

The reduction is two lines — `summarise({"anything"}, 2)` — and with the noise
gone, `width - 3` on an unsigned type with `width == 2` is visible by
inspection. That is the wraparound from Chapter 1.2 again, inside a `substr`
length.

Note the failure mode, because it is the awkward kind. `substr` **clamps** a
too-large length to the end of the string, so nothing crashes and no sanitizer
fires — the function simply returns a wrong answer and the program carries on
with it. A crash would have been better news.

Reduce by **halving**: delete half the input, half the configuration, half the
code path. If the bug survives, keep going; if it disappears, put that half back
and cut the other. A dozen halvings takes minutes and turns a thousand-line case
into a two-line one.

## Bisecting history

When something used to work, `git bisect` finds the commit that broke it in
logarithmic time:

```bash title="Finding the offending commit"
git bisect start
git bisect bad                 # the current commit is broken
git bisect good v1.2.0         # this tag was fine
# git checks out a commit in the middle; test it, then:
git bisect good                # or: git bisect bad
# ... repeat until it names the commit
git bisect reset
```

With a script that exits non-zero on failure, `git bisect run ./test.sh` does the
whole search unattended. Over a thousand commits that is ten builds instead of a
thousand — which is why keeping the test suite fast and the history bisectable
pays for itself.

## Reading a crash

A crash gives you a stack trace, and the trace usually names the fault:

```cpp run expect-ub title="A crash with a readable trace" std=c++20
#include <iostream>
#include <vector>

int sum_first_n(const std::vector<int>& v, std::size_t n) {
    int total = 0;
    for (std::size_t i = 0; i < n; ++i) total += v[i];     // no bounds check
    return total;
}

int compute(const std::vector<int>& data) {
    return sum_first_n(data, data.size() + 2);             // asks for too many
}

int main() {
    const std::vector<int> data{1, 2, 3};
    std::cout << "computing\n";
    std::cout << compute(data) << '\n';
}
```

Read the sanitizer's output top to bottom:

- **The first line** names the error kind and address.
- **Frame `#0`** is where the bad access happened — `sum_first_n`.
- **Frames below it** are the callers, most recent first: `compute`, then `main`.
- **The allocation section** says where the memory came from and its size.

Frame `#0` is where it *broke*; the fault is often a frame or two below, where
the wrong argument was computed. Here `sum_first_n` is innocent — `compute`
passed it a length two past the end.

Without a sanitizer you get the same shape from a debugger:

```bash
g++ -std=c++20 -g -O0 -o program main.cpp
gdb ./program
(gdb) run
(gdb) bt          # the stack at the moment of the crash
(gdb) frame 1     # step up to the caller
(gdb) print n     # inspect its variables
```

## Watchpoints

When a value is wrong and you do not know who wrote it, a **watchpoint** stops
the program at the moment it changes:

```bash title="Catching the writer"
(gdb) break main
(gdb) run
(gdb) watch config.retries      # stop whenever this changes
(gdb) continue
# gdb reports the old and new values and the line responsible
```

This is the tool for "who is corrupting this field?", and it is the one people
most often do not know exists. `rwatch` breaks on reads and `awatch` on either.

Hardware watchpoints are fast; software ones single-step the program and are
very slow, so watch a narrow scope where you can.

## Printf debugging is not shameful

Adding output is a real technique, especially for bugs that a debugger disturbs —
timing-dependent code, or anything under heavy optimisation. It has rules:

```cpp run title="Diagnostics with enough context to be useful" std=c++20
#include <iostream>
#include <string>
#include <vector>

int find_index(const std::vector<int>& v, int target) {
    for (std::size_t i = 0; i < v.size(); ++i) {
        // Include the variables AND their names — "3" alone tells you nothing
        // when you are reading a hundred lines of output.
        std::cerr << "[find_index] i=" << i << " v[i]=" << v[i]
                  << " target=" << target << '\n';
        if (v[i] == target) return static_cast<int>(i);
    }
    return -1;
}

int main() {
    const std::vector<int> v{4, 8, 15};
    std::cout << "index: " << find_index(v, 8) << '\n';
}
```

Write to `std::cerr`, not `std::cout`: it is unbuffered, so the last line before
a crash actually appears, and it does not corrupt the program's real output.
Label each line with its origin, and print variable *names* alongside values.

:::pitfall
A debug print that changes the behaviour is telling you something. If adding
output makes the bug disappear, you probably have undefined behaviour — most
often an uninitialised read or a data race — and the print changed the timing or
the stack layout. That is a clue, not an annoyance.
:::

## Rubber-ducking, and the assumption audit

When you are stuck, the fault is nearly always an assumption you have not
examined. Say the code's behaviour out loud, line by line, to someone — or to
nobody. The step where you say "and here it obviously does X" and then check, is
where the bug usually is.

The written form of this is a list:

- What do I *believe* is true at this point? (Now assert it.)
- What did I last change?
- Does the input look like I think it does? (Print it.)
- Is the code I am reading the code that is running? (Check the build.)

That last one is not a joke. A surprising share of long debugging sessions end
with the discovery that the binary was stale, the wrong configuration was
loaded, or the fix was made in a file that is not compiled.

## Check yourself

:::quiz
{
  "question": "A sanitizer trace shows frame `#0` in `sum_first_n`. Where is the bug?",
  "options": [
    { "text": "In `sum_first_n` — frame #0 is always the faulting function", "why": "Frame #0 is where the program *broke*, which is not the same as where the mistake is. A function that faithfully reads n elements is not at fault if it was handed the wrong n." },
    { "text": "Possibly in a caller — #0 is where it broke, but the wrong value may have been computed further down the stack", "correct": true, "why": "Read the frames below #0 to see where the arguments came from. Here the caller computed size() + 2, and the function it called was blameless." },
    { "text": "In main, since that is where the data was created", "why": "The data was fine. Creating valid input is not the fault; asking for more of it than exists is." },
    { "text": "It cannot be determined without a debugger", "why": "The trace already names the whole call chain. That is what makes -g worth passing." }
  ]
}
:::

:::quiz
{
  "question": "Adding a `std::cerr` line makes the bug disappear. What does that suggest?",
  "options": [
    { "text": "The bug is fixed; the output must have flushed something", "why": "Nothing was fixed. A bug that hides when you look at it is still there, and now harder to catch." },
    { "text": "Undefined behaviour — most likely an uninitialised read or a data race, whose behaviour changed with timing or stack layout", "correct": true, "why": "Both are sensitive to exactly what a print disturbs. This is a strong signal to reach for the sanitizers rather than to keep adding prints." },
    { "text": "The compiler optimised the buggy code away", "why": "Adding a print does inhibit some optimisation, but the conclusion still stands: code whose correctness depends on not being observed is undefined." },
    { "text": "std::cerr is unbuffered, so it changed the flush order", "why": "True of cerr, and irrelevant — flushing does not alter program logic unless something is already undefined." }
  ]
}
:::

## Practice

:::exercise reduce-the-case

:::recap
- The method: reproduce, reduce, locate, **understand**, fix and prove. Skipping
  the understanding step moves bugs rather than removing them.
- Reduce by halving — input, configuration, code. A minimal reproduction often
  reveals the fault on its own.
- `git bisect run ./test.sh` finds the breaking commit in logarithmic time.
- Frame `#0` is where it broke; the fault is often in a caller that computed the
  wrong argument. The allocation section says what the memory was.
- Watchpoints (`watch expr`) catch whoever writes a value — the answer to "what
  is corrupting this field?".
- Print to `std::cerr`, label the origin, and include variable names. A bug that
  disappears when you add a print is a sign of undefined behaviour.
- Audit assumptions, and check that the code you are reading is the code that is
  running.
:::
