---
title: "Hello, machine"
navTitle: "Hello, machine"
summary: >-
  How source text becomes a running program, and what each stage can go wrong at.
objectives:
  - Explain what the preprocessor, compiler, assembler, and linker each do
  - Read a compiler error and locate the line it refers to
  - Compile and run a program from source
status: complete
standard: c++20
---

A C++ program starts life as text you can read and ends as instructions a
processor can execute. Nothing in between is magic, and every stage of the
journey has its own kind of failure. Learning which stage a message came from
is most of what it takes to stop being afraid of error output.

Here is the whole thing. Press **Run**.

```cpp run title="The smallest useful program"
#include <iostream>

int main() {
    std::cout << "Hello, machine\n";
}
```

That worked, so a lot of machinery worked. Let us take it apart.

## What each line is doing

`#include <iostream>` is not a C++ statement. It is a *preprocessor directive*,
and it runs before the compiler proper sees anything. It means: find the file
called `iostream` and paste its entire contents here. That file declares
`std::cout` and the `<<` operator, which is why the next line can use them.

`int main()` declares a function named `main`. It is not special because of its
name alone — it is special because the runtime that starts your program is
written to call a function with exactly that name. Every C++ program has exactly
one. The `int` says `main` hands back an integer when it finishes; the operating
system uses that number to decide whether your program succeeded. Zero means
success. You did not write a `return`, and `main` is the one function allowed to
omit it: leaving it out means `return 0`.

`std::cout << "Hello, machine\n";` sends characters to standard output.
`std::cout` is an object representing that output stream; `<<` is an operator
that has been given a meaning for streams. `std::` says both live in the
*namespace* `std`, which is where everything in the standard library lives.

:::note
The `\n` inside the string is a single character — a newline — written with two
characters because you cannot type a newline inside quotes. You will see
`std::endl` in older code; it writes a newline *and* flushes the stream, which
is usually a small waste. Prefer `\n`.
:::

## Four programs run before yours does

When you compile a single file, four separate programs handle it in sequence.
Each one produces input for the next, and each one has its own vocabulary of
complaints.

| Stage | Input | Output | A failure here says |
|---|---|---|---|
| Preprocessor | your `.cpp` | one long expanded file | `No such file or directory` |
| Compiler | expanded source | assembly | `error: expected ';'`, `no matching function` |
| Assembler | assembly | an object file `.o` | almost never fails |
| Linker | object files | an executable | `undefined reference to …` |

The distinction that matters most in practice is the last two rows. A
**compiler** error means one file, on its own, does not make sense. A **linker**
error means every file made sense individually, but something they promised
each other was never delivered.

Try producing one of each. This program compiles but does not link — it
*declares* that `mystery` exists somewhere and calls it, but nowhere in the
program is it ever defined:

```cpp run expect-error title="A linker error, not a compiler error"
int mystery(int x);   // a promise: this exists somewhere

int main() {
    return mystery(3);
}
```

Read the message. It does not talk about lines or syntax; it talks about a
*reference* it could not resolve. That is the shape of every linker error you
will ever see.

Now a compiler error, in the same spirit:

```cpp run expect-error title="A compiler error"
#include <iostream>

int main() {
    std::cout << "the semicolon is missing\n"
}
```

The message names a file, a line, and a column. Compilers report the point where
the text stopped making sense, which is often just *after* the mistake — here it
points at the closing brace, because that is where a `;` was expected. When a
message points at a line that looks fine, look at the line above it.

:::pitfall
The first error is the only one you should read. C++ compilers keep going after a
failure, and everything after the first message may be nonsense produced by a
confused parser. Fix the first, recompile, repeat.
:::

## What the machine actually gets

Nothing above the assembler survives into the final program. Names, comments,
types, the structure of your functions — all of it exists to constrain what the
compiler is allowed to produce, and then it is gone.

Press **Assembly** on this one to see what a two-line function becomes:

```cpp asm run title="Source, and what it compiles to" std=c++20
int add(int a, int b) {
    return a + b;
}

int main() { return add(2, 3); } // [hidden]
```

One instruction to add, one to return. Notice what is *not* there: no trace of
the names `add`, `a`, or `b`, and no check that you passed integers. The type
system did its work at compile time and then evaporated. This is the trade C++
makes everywhere — checking happens early, so nothing has to happen late.

Change `-O0` to `-O2` in the dropdown and run it again. At `-O2` the call to
`add` inside `main` disappears entirely: the compiler computed `2 + 3` itself.

## The build, on your own machine

You will not always have a Run button. The equivalent on a terminal:

```bash title="Compile, then run"
g++ -std=c++20 -Wall -Wextra -o hello hello.cpp
./hello
```

Read that as: *use the C++20 rules, turn on the useful warnings, put the
executable in a file called `hello`, and build it from `hello.cpp`.*

The two warning flags are not optional in practice. C++ will compile a great
deal of code that is technically legal and definitely wrong, and `-Wall
-Wextra` is how you get told. Chapter 1.6 covers the rest of the toolchain, but
adopt those two flags today.

:::tip
Getting `command not found: g++`? You have no compiler installed yet. On Debian
or Ubuntu, `sudo apt install g++`; on macOS, `xcode-select --install`; on
Windows, install the "Desktop development with C++" workload from the Visual
Studio Installer, or use WSL. The Run buttons here work regardless.
:::

## Check yourself

:::quiz
{
  "question": "You compile a program made of two files. It compiles without complaint, then fails with `undefined reference to greet()`. What went wrong?",
  "options": [
    { "text": "A syntax error in the file that declares `greet`",
      "why": "Syntax errors stop the compiler, and the compiler was happy. This message came from a later stage." },
    { "text": "`greet` was declared but never defined in any file that was linked",
      "correct": true,
      "why": "Exactly. The declaration promised the linker that a definition existed somewhere; no file delivered one. Either you forgot to write the body, or you forgot to pass that file to the compiler." },
    { "text": "`greet` was called with the wrong number of arguments",
      "why": "That is a compile-time error — the compiler checks calls against the declaration it can see." },
    { "text": "The `#include` for `greet`'s header is missing",
      "why": "A missing include usually means the compiler has never heard of `greet` at all, which fails earlier with `not declared in this scope`." }
  ]
}
:::

:::quiz
{
  "question": "What does `#include <iostream>` do?",
  "options": [
    { "text": "It links the iostream library into your program",
      "why": "Linking happens much later, and against a compiled library — not because of this line." },
    { "text": "It textually inserts the contents of a file before compilation",
      "correct": true,
      "why": "Right. The preprocessor is a text-substitution stage: after it runs, your file contains everything iostream declares, expanded in place." },
    { "text": "It imports a module named iostream",
      "why": "That is what `import std;` does in C++20 modules — a genuinely different mechanism, covered in Part 9." },
    { "text": "It tells the compiler that std::cout exists, without adding any code",
      "why": "Close in effect, but the mechanism matters: it does that by pasting in a file, which is why include order can change behaviour." }
  ]
}
:::

## Practice

:::exercise print-your-name

:::exercise fix-the-build

:::recap
- A C++ program passes through four stages: preprocessing, compiling,
  assembling, and linking. Errors sound different depending on which stage
  produced them.
- Compiler errors are about one file not making sense. Linker errors are about a
  promise that was never kept.
- Read only the first error message; the rest may be noise.
- Compile with `-Wall -Wextra` from your very first program.
- Types and names exist to constrain the compiler. They are gone by the time the
  processor runs your code.
:::
