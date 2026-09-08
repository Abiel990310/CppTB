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
- [x] 5.5 Compile-time computation
- [x] 5.6 Variadic templates
- [x] 5.7 Type traits and metaprogramming
- [x] 5.8 Static polymorphism

## Wave 6 — performance

The assembly view earns its keep here; use it in every chapter of this part.

- [x] 7.1 What the compiler does for you
- [x] 7.2 Measuring, not guessing
- [x] 7.3 Cache and data layout
- [x] 7.5 Copies, moves, and elision
- [x] 7.4 Zero-cost abstraction, examined
- [x] 7.6 Inlining, linking, and layout

## Wave 7 — concurrency and shipping

- [x] 9.1 Headers, translation units, and linking
- [x] 8.1 Threads
- [x] 8.2 Data races and mutexes
- [x] 8.3 Atomics and the memory model
- [x] 8.4 Futures, promises, and tasks
- [x] 8.5 Coroutines
- [x] 9.3 Build systems and CMake
- [x] 9.2 Modules
- [x] 9.4 Dependencies and packaging
- [x] 9.5 Project: a small search index

---

## Part 10 — Problem solving and algorithms (after the 60)

Agreed with the author on 2026-09-08, when Part 5 and half of Part 7 were done.
Read this section before starting it; the two decisions below are settled and
are not to be relitigated.

**Decision 1 — every chapter carries two kinds of problem.**

- **2 function-style problems** (`check: unit`), which isolate the technique.
  You implement `int solve(const std::vector<int>&)` and the checks name exactly
  what broke. This is how the technique is taught.
- **2–3 judge-style problems** (`check: output`), which read stdin and write
  stdout against several fixed test cases, exactly like AtCoder or ZeroJudge.
  This is how the technique is drilled: constraints in the statement, edge cases
  in the data, no partial credit.

**Decision 2 — the scope is comprehensive: 40 chapters, in eight waves of five.**

### Engine work this needs first

The `output` check mode currently supports a **single** `stdin` string and one
expected stdout (`build/types.ts`, `CheckMode`). A judge problem needs several
independent cases. Before writing chapter 10.1:

- [ ] Extend `output` problems to carry a list of `(stdin, expected stdout)`
      cases, and report which case failed rather than just "wrong output".
- [ ] Give each case an optional time limit, so a quadratic solution to a linear
      problem fails the way it would on a real judge instead of timing out the
      whole page.
- [ ] Teach `scripts/verify-exercises.ts` the new shape: the solution must pass
      every case, the starter must fail at least one.
- [ ] Decide how a judge problem's statement renders — constraints block, sample
      input/output pair, and the hidden cases kept out of the page.

### Wave A — foundations of problem solving

- [ ] 10.1 How to read a problem and its limits
- [ ] 10.2 Complexity, read off the constraints
- [ ] 10.3 The contest template and fast I/O
- [ ] 10.4 Sorting, comparators, and coordinate compression
- [ ] 10.5 Binary search: on a range, and on the answer

### Wave B — sequences

- [ ] 10.6 Two pointers and sliding windows
- [ ] 10.7 Prefix sums and difference arrays
- [ ] 10.8 Monotonic stacks
- [ ] 10.9 Deques and sliding-window extrema
- [ ] 10.10 Hashing, frequency maps, and multisets

### Wave C — search and greedy

- [ ] 10.11 Recursion and backtracking
- [ ] 10.12 Subsets, permutations, and pruning
- [ ] 10.13 Greedy, and proving it with an exchange argument
- [ ] 10.14 Divide and conquer
- [ ] 10.15 Meet in the middle

### Wave D — graphs

- [ ] 10.16 Representing graphs
- [ ] 10.17 BFS, 0–1 BFS, and multi-source BFS
- [ ] 10.18 DFS: components, cycles, bridges
- [ ] 10.19 Topological order and DAG DP
- [ ] 10.20 Union-Find

### Wave E — shortest paths and trees

- [ ] 10.21 Dijkstra
- [ ] 10.22 Bellman–Ford and Floyd–Warshall
- [ ] 10.23 Minimum spanning trees
- [ ] 10.24 Tree DP and rerooting
- [ ] 10.25 LCA, binary lifting, and Euler tours

### Wave F — dynamic programming

- [ ] 10.26 DP: state, transition, order
- [ ] 10.27 Knapsack and coin change
- [ ] 10.28 LIS, LCS, and edit distance
- [ ] 10.29 Interval DP
- [ ] 10.30 Bitmask DP

### Wave G — data structures

- [ ] 10.31 Fenwick trees
- [ ] 10.32 Segment trees
- [ ] 10.33 Lazy propagation
- [ ] 10.34 Sparse tables and RMQ
- [ ] 10.35 Heavy-light and centroid decomposition

### Wave H — maths, strings, geometry, flows

- [ ] 10.36 Number theory: gcd, sieve, modular arithmetic
- [ ] 10.37 Combinatorics, inclusion–exclusion, matrix exponentiation
- [ ] 10.38 String matching: KMP, Z, and hashing
- [ ] 10.39 Computational geometry
- [ ] 10.40 Max flow, min cut, and matching

### The stretch shelf

Real techniques, genuinely rarer. Add them only once all forty are written, and
only if the author still wants them — each is a chapter that a small number of
readers will ever need:

suffix automata and suffix arrays · FFT and NTT · persistent segment trees ·
digit DP · convex hull trick and divide-and-conquer DP optimisation ·
Sprague–Grundy and impartial games · Mo's algorithm · link-cut trees.

### Rules specific to this part

- **A technique is not taught until a program demonstrates it failing without
  it.** Show the quadratic solution timing out before showing the prefix sum.
  The whole part is about recognising which tool a constraint is asking for.
- **Every judge problem states its constraints**, and the constraints must be
  the ones that make the intended solution necessary. A problem with n ≤ 100
  does not teach anything about complexity.
- **No filler.** No problem that is another problem with the numbers changed, no
  chapter that is a list of library calls. If a chapter cannot justify five
  problems that each teach something different, it should be merged with its
  neighbour.

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
