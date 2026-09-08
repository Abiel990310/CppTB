# Roadmap

**Start each session here.** Take the top unwritten chapter from the current
wave, write it, verify it, commit it, and tick it off below.

The order is not the book's reading order. It is the order that makes the book
useful soonest: each wave completes a path a real reader is already on.

Progress is also visible, without reading this file, at `/progress/`.

---

## Wave 1 — the two entry paths ✅ complete

Finishes Part 1 (so a beginner can start) and the core of Part 2 (so a reader
coming from another language can start). Until this wave is done, the home
page's "Begin" and "Start with memory" links both run out of written material
within a chapter or two.

- [x] 1.1 Hello, machine
- [x] 1.2 Values, types, and names
- [x] 1.3 Making decisions
- [x] 1.4 Repetition
- [x] 1.5 Functions
- [x] 1.6 Your toolchain
- [x] 2.1 Objects and storage
- [x] 2.2 Pointers
- [x] 2.3 References
- [x] 2.4 Lifetime and scope
- [x] 2.5 The stack and the heap

## Wave 2 — ownership ✅ complete

The part of C++ that no other language teaches you. Chapter 3.2 (RAII) is the
single most important chapter in the book; give it room.

- [x] 2.6 Arrays, and why they decay
- [x] 2.7 const and constness
- [x] 3.1 Structs and classes
- [x] 3.2 Constructors, destructors, and RAII
- [x] 3.3 Copying
- [x] 3.4 Moving
- [x] 3.5 The rule of zero, three, and five

## Wave 3 — the library you actually use ← **you are here**

After this wave a reader can write useful programs without touching `new`.
Start with smart pointers: it finishes the sentence Wave 2 began, since the
ownership chapters keep pointing at `unique_ptr` as the answer.

- [x] 4.7 Smart pointers
- [x] 4.1 std::string and text
- [x] 4.2 Sequence containers
- [x] 4.3 Associative containers
- [x] 4.5 Algorithms
- [x] 4.4 Iterators
- [x] 4.8 optional, variant, and expected
- [x] 4.9 Input, output, and formatting
- [x] 4.6 Ranges and views

## Wave 4 — writing correct code

- [x] 6.3 Undefined behaviour
- [x] 3.6 Operator overloading
- [x] 3.7 Inheritance and virtual functions
- [x] 3.8 When not to use inheritance
- [x] 6.1 Exceptions
- [x] 6.2 Error handling without exceptions
- [x] 6.4 Testing
- [x] 6.5 Debugging
- [x] 6.6 Invariants and assertions

## Wave 5 — generic programming

- [x] 5.1 Function templates
- [x] 5.2 Class templates
- [x] 5.4 Concepts and constraints
- [x] 5.3 Deduction and forwarding
- [ ] 5.5 Compile-time computation
- [ ] 5.6 Variadic templates
- [ ] 5.7 Type traits and metaprogramming
- [ ] 5.8 Static polymorphism

## Wave 6 — performance

The assembly view earns its keep here; use it in every chapter of this part.

- [ ] 7.1 What the compiler does for you
- [ ] 7.2 Measuring, not guessing
- [ ] 7.3 Cache and data layout
- [ ] 7.5 Copies, moves, and elision
- [ ] 7.4 Zero-cost abstraction, examined
- [ ] 7.6 Inlining, linking, and layout

## Wave 7 — concurrency and shipping

- [ ] 9.1 Headers, translation units, and linking
- [ ] 8.1 Threads
- [ ] 8.2 Data races and mutexes
- [ ] 8.3 Atomics and the memory model
- [ ] 8.4 Futures, promises, and tasks
- [ ] 8.5 Coroutines
- [ ] 9.3 Build systems and CMake
- [ ] 9.2 Modules
- [ ] 9.4 Dependencies and packaging
- [ ] 9.5 Project: a small search index

---

## Standing work, not tied to a wave

- **Problems.** The bank is thin (9 problems). Every written chapter should end
  with 2–4. Adding problems to already-written chapters is always a good use of
  a short session.
- **Diagrams.** Chapters on pointers, references, lifetime, moving, smart
  pointers, and iterator invalidation each need a `:::memviz`. They are the
  clearest thing on the site; do not skip them where they apply.
- **Cross-references.** When a chapter refers forward, link it once the target
  is written.

## Deliberately out of scope

Decided, so nobody relitigates them mid-session:

- No C. This is a C++ book; C is referenced only where the history explains a
  C++ wart.
- No GUI, no graphics, no game engine chapters. The project in 9.5 is a text
  index precisely because it needs nothing but the standard library.
- No coverage of pre-C++11 idioms except in `:::history` callouts. Readers
  maintaining old code are better served by a chapter on migration, which is not
  in this book.
