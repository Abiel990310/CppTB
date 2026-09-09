---
title: "Recursion and backtracking"
navTitle: "Recursion"
summary: >-
  Choose, explore, un-choose — and the two things that turn an exponential
  search into a feasible one.
objectives:
  - Write a search as choose / explore / un-choose and keep the state consistent
  - Prune a search at the moment a partial solution becomes invalid
  - Measure the cost of a recursive frame and know your depth budget
  - Recognise when overlapping subproblems make memoisation apply
status: complete
standard: c++20
requires: [hashing-and-frequency]
---

Everything so far in this part has been about avoiding exhaustive search. This
chapter is about doing it properly when there is no way around it — and about
the two techniques, pruning and memoisation, that decide whether "exhaustive"
means milliseconds or years.

## Choose, explore, un-choose

Every backtracking search has the same three lines around the recursive call.

```cpp run title="Subsets and permutations, with the call counts"
#include <cstdio>
#include <string>
#include <vector>

int calls = 0;

// choose - explore - un-choose, on the smallest possible problem.
void subsets(const std::vector<int>& a, std::size_t i,
             std::vector<int>& chosen, std::vector<std::string>& out) {
    ++calls;
    if (i == a.size()) {
        std::string s = "{";
        for (std::size_t j = 0; j < chosen.size(); ++j) {
            if (j) s += ",";
            s += std::to_string(chosen[j]);
        }
        out.push_back(s + "}");
        return;
    }
    subsets(a, i + 1, chosen, out);              // do not take a[i]
    chosen.push_back(a[i]);                      // choose
    subsets(a, i + 1, chosen, out);              // explore
    chosen.pop_back();                           // un-choose
}

int perm_calls = 0;

void permutations(std::vector<int>& a, std::size_t k,
                  std::vector<std::string>& out) {
    ++perm_calls;
    if (k == a.size()) {
        std::string s;
        for (int v : a) s += std::to_string(v);
        out.push_back(s);
        return;
    }
    for (std::size_t i = k; i < a.size(); ++i) {
        std::swap(a[k], a[i]);                   // choose
        permutations(a, k + 1, out);             // explore
        std::swap(a[k], a[i]);                   // un-choose
    }
}

int main() {
    std::vector<int> a{1, 2, 3};
    std::vector<int> chosen;
    std::vector<std::string> subs;
    subsets(a, 0, chosen, subs);
    std::printf("subsets of {1,2,3}: %zu, from %d calls\n", subs.size(), calls);
    for (const std::string& s : subs) std::printf("  %s\n", s.c_str());

    std::vector<std::string> perms;
    std::vector<int> b{1, 2, 3};
    permutations(b, 0, perms);
    std::printf("permutations: %zu, from %d calls -> ", perms.size(), perm_calls);
    for (const std::string& s : perms) std::printf("%s ", s.c_str());
    std::printf("\n");
    std::printf("array restored: %d %d %d\n", b[0], b[1], b[2]);
}
```

Eight subsets from fifteen calls, six permutations from sixteen, and the array
comes back exactly as it went in.

That last line is the point. **The un-choose is what makes the shared state a
lie you can tell safely.** Both functions mutate a container that every branch
of the search sees, and both restore it before returning, so each branch
observes exactly the choices its own ancestors made. Forget the `pop_back` or
the second `swap` and the bug is not a crash — it is answers that are wrong in a
way that depends on the order the branches ran.

The alternative is to pass a copy down: `subsets(a, i + 1, chosen_plus_ai, out)`.
That is correct by construction and costs a copy of the state at every node,
which at 2ⁿ nodes is exactly where the time goes. Mutate and restore.

Two conventions worth adopting from these two:

- **The recursion parameter is "how much is decided", not "what to do next".**
  `i` in `subsets` is the index being decided; everything before it is fixed.
  Making that explicit in your head is what makes the base case obvious.
- **Permutations by swapping** put the chosen element at position `k` and recurse
  on the rest. The output order is not lexicographic — `1 2 3` gives
  `123 132 213 231 321 312` — and if the problem wants sorted output, either
  sort at the end or use `std::next_permutation` instead.

## Pruning is not an optimisation

Eight queens on a chessboard, two ways: place a queen on every row and check the
board at the end, or reject a placement the instant it conflicts.

```cpp run title="19 million nodes, or 2,057"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

long long generate_nodes = 0, prune_nodes = 0;

bool safe(const std::vector<int>& col, int row, int c) {
    for (int r = 0; r < row; ++r)
        if (col[r] == c || row - r == c - col[r] || row - r == col[r] - c) return false;
    return true;
}

// Place a queen anywhere on each row, check only when the board is full.
long long generate_then_test(std::vector<int>& col, int row, int n) {
    ++generate_nodes;
    if (row == n) {
        for (int r = 0; r < n; ++r)
            if (!safe(col, r, col[r])) return 0;
        return 1;
    }
    long long total = 0;
    for (int c = 0; c < n; ++c) { col[row] = c; total += generate_then_test(col, row + 1, n); }
    return total;
}

// Reject a placement the moment it conflicts.
long long prune_as_you_go(std::vector<int>& col, int row, int n) {
    ++prune_nodes;
    if (row == n) return 1;
    long long total = 0;
    for (int c = 0; c < n; ++c)
        if (safe(col, row, c)) { col[row] = c; total += prune_as_you_go(col, row + 1, n); }
    return total;
}

int main() {
    const int n = 8;
    std::vector<int> col(n, 0);

    auto t0 = std::chrono::steady_clock::now();
    long long a = generate_then_test(col, 0, n);
    auto t1 = std::chrono::steady_clock::now();
    long long b = prune_as_you_go(col, 0, n);
    auto t2 = std::chrono::steady_clock::now();

    keep(a); keep(b);
    std::printf("generate and test  %8.1f ms  %lld nodes -> %lld solutions\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(),
                generate_nodes, a);
    std::printf("prune as you go    %8.1f ms  %lld nodes -> %lld solutions\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count(),
                prune_nodes, b);
}
```

The same 92 solutions. 19,173,961 nodes and about 2 seconds, against 2,057 nodes
and 1.3 milliseconds — nine thousand times fewer nodes.

The two programs differ by where the `safe` call sits: inside the loop, or after
the recursion bottoms out. That is the entire change, and it is worth being
precise about why it matters so much. Rejecting at row `r` removes the whole
subtree below it — `n^(n-r)` boards — and it does so at the *shallowest* point
where the conflict is detectable. A prune near the root is worth exponentially
more than a prune near a leaf, which is why "check as early as you can" is the
rule rather than "check efficiently".

The general shape of a pruned search:

```cpp
void search(State& s, int depth) {
    if (complete(s)) { record(s); return; }
    for (Move m : moves(s)) {
        if (!feasible(s, m)) continue;   // prune: the earlier the better
        apply(s, m);                     // choose
        search(s, depth + 1);            // explore
        undo(s, m);                      // un-choose
    }
}
```

Three kinds of prune, in increasing order of cleverness:

1. **Feasibility.** The move breaks a constraint. This is `safe` above, and it
   is almost always the one that matters.
2. **Bound.** The best completion from here cannot beat the best answer already
   found. This turns search into branch-and-bound, and it needs an *optimistic*
   estimate — one that never underestimates what is still achievable.
3. **Symmetry.** Two branches are equivalent under some transformation, so
   explore one. For n-queens, fixing the first queen to the left half and
   doubling roughly halves the work.

## The depth budget

Recursion costs stack, and the stack is a fixed allocation you cannot grow
mid-program. It is worth knowing the actual numbers rather than a rule of thumb.

```cpp run title="How much stack does a frame cost?"
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <sys/resource.h>
#include <vector>

// Deliberately holds a little local state, as a real DFS frame would.
std::uintptr_t deepest = 0;

void descend(int depth, int limit) {
    volatile int scratch[4] = {depth, 0, 0, 0};
    std::uintptr_t here = reinterpret_cast<std::uintptr_t>(&scratch);
    if (depth == 0 || depth == limit) deepest = here;
    if (depth < limit) descend(depth + 1, limit);
    (void)scratch;
}

int main() {
    volatile int top_marker = 0;
    std::uintptr_t top = reinterpret_cast<std::uintptr_t>(&top_marker);

    const int limit = 1000;
    descend(0, limit);

    std::size_t span = top > deepest ? top - deepest : deepest - top;
    double per_frame = static_cast<double>(span) / limit;
    std::printf("%d frames spanned %zu bytes: about %.0f bytes each\n",
                limit, span, per_frame);

    rlimit rl{};
    getrlimit(RLIMIT_STACK, &rl);
    if (rl.rlim_cur == RLIM_INFINITY) {
        std::printf("stack limit: unlimited\n");
    } else {
        double mb = static_cast<double>(rl.rlim_cur) / (1024 * 1024);
        std::printf("stack limit: %.1f MB -> roughly %.0f frames of this size\n",
                    mb, static_cast<double>(rl.rlim_cur) / per_frame);
    }
}
```

**Read that output carefully, because the page is lying to you — usefully.**
The samples on this site are compiled with AddressSanitizer, which puts a
redzone around every stack object, so a frame that would cost 80 bytes measures
about 985 and the depth budget comes out around 8,500. Compile the same program
with plain `-O0` and it reports about 80 bytes per frame and roughly 100,000
frames in the same 8 MB.

Both numbers are true; they are measurements of different builds. The lesson is
the one from chapter 7.2: a measurement without its build flags is not a fact.

What to take away:

- **8 MB is the usual limit** and a plain DFS frame is tens of bytes, so depth
  in the low hundreds of thousands is survivable and depth of 10⁶ is not.
- **A recursive DFS over a graph with 2 × 10⁵ nodes is fine** when the frame is
  small; it stops being fine when you put a `std::vector` or a `std::string` in
  the frame by value, which is a hundred bytes or a heap allocation per level.
- **Stack overflow does not throw.** It is a segfault, reported by a judge as
  "runtime error" with no line number. If a recursive solution fails that way on
  the largest test only, depth is the first suspect.
- **The fix is an explicit stack**, which moves the frames to the heap where
  there are gigabytes. Chapter 10.18 writes DFS both ways.

## When the same subproblem keeps coming back

Pruning removes branches that cannot lead to a solution. Memoisation removes
branches that lead to a solution you have already computed.

```cpp run title="6.2 million calls, or 164 states"
#include <chrono>
#include <cstdio>
#include <vector>

template <class T>
inline void keep(const T& value) { asm volatile("" : : "r,m"(value) : "memory"); }

const int N = 13;
std::vector<std::vector<bool>> blocked;
long long plain_calls = 0, memo_calls = 0;

long long paths(int r, int c) {
    ++plain_calls;
    if (r >= N || c >= N || blocked[r][c]) return 0;
    if (r == N - 1 && c == N - 1) return 1;
    return paths(r + 1, c) + paths(r, c + 1);
}

std::vector<std::vector<long long>> memo;

long long paths_memo(int r, int c) {
    if (r >= N || c >= N || blocked[r][c]) return 0;
    if (r == N - 1 && c == N - 1) return 1;
    long long& slot = memo[r][c];
    if (slot >= 0) return slot;                  // already solved
    ++memo_calls;                                // count only real work
    return slot = paths_memo(r + 1, c) + paths_memo(r, c + 1);
}

int main() {
    blocked.assign(N, std::vector<bool>(N, false));
    blocked[3][4] = blocked[6][2] = blocked[8][9] = blocked[10][5] = true;

    auto t0 = std::chrono::steady_clock::now();
    long long a = paths(0, 0);
    auto t1 = std::chrono::steady_clock::now();

    memo.assign(N, std::vector<long long>(N, -1));
    long long b = paths_memo(0, 0);
    auto t2 = std::chrono::steady_clock::now();

    keep(a); keep(b);
    std::printf("plain recursion %8.1f ms  %lld calls\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count(), plain_calls);
    std::printf("memoised        %8.3f ms  %lld distinct states\n",
                std::chrono::duration<double, std::milli>(t2 - t1).count(), memo_calls);
    std::printf("paths: %lld and %lld -- %s\n", a, b, a == b ? "equal" : "DIFFERENT");
}
```

1,059,464 paths either way. 6,241,589 calls and 1.3 seconds, against 164 states
and 0.3 milliseconds.

The precondition is **overlapping subproblems**: the answer for `(r, c)` depends
only on `(r, c)`, and the plain recursion reaches most cells thousands of times.
There are only 169 cells, so at most 169 answers exist and the rest of those six
million calls are recomputation.

That is also the test for whether memoisation applies at all, and it is a test
about the *signature*:

- **`paths(r, c)`** depends on two small integers — memoisable.
- **`subsets(a, i, chosen, out)`** depends on `chosen`, which is different in
  every branch by construction — not memoisable, and no amount of caching helps.
  It is enumerating distinct outputs, not recomputing one answer.
- **N-queens** depends on the whole set of placed columns. There are 2ⁿ of them,
  so a cache would be as large as the search — memoisation is possible and
  useless.

The rule: **memoisation pays exactly when the number of distinct argument tuples
is much smaller than the number of calls.** Count the states before writing the
cache; if there are 2ⁿ of them, you want pruning instead.

This is also the doorway to dynamic programming. `paths_memo` *is* a DP — the
same recurrence, computed lazily and cached, and chapter 10.26 does the same
thing eagerly with a loop and calls it a table. Top-down memoisation is usually
easier to get right, because the order the subproblems are solved in takes care
of itself.

:::quiz
{
  "question": "Your backtracking search modifies a shared `std::vector<int> chosen` and forgets the `chosen.pop_back()` after the recursive call. What is the symptom?",
  "options": [
    { "text": "Wrong answers that depend on the order branches are explored: later branches see choices made by earlier ones, so the state no longer describes the current path", "correct": true, "why": "The un-choose is what makes the shared mutable state equivalent to passing a fresh copy down each branch. Without it, `chosen` accumulates rather than tracking the path, and nothing crashes." },
    { "text": "A stack overflow, because the vector grows without bound", "why": "The vector lives on the heap and grows by at most one element per node. The search terminates normally; it just computes the wrong thing." },
    { "text": "It still works, because the vector is passed by reference and each frame has its own view", "why": "A reference gives every frame the *same* vector. That is the point of the pattern, and the reason the restore is mandatory." },
    { "text": "Undefined behaviour, since the vector is read after being modified", "why": "Reading a vector after pushing to it is perfectly defined. The bug is logical: the state stops matching the path being explored." }
  ]
}
:::

## Practice

:::exercise backtracking-audit

:::exercise memoise-it

:::exercise judge-subset-sums

:::exercise judge-n-queens

:::recap
- Every backtracking search is choose, explore, un-choose. The restore is what
  lets one shared container stand in for a fresh copy per branch — cheaper by a
  factor of the state size, and wrong if you forget it.
- Prune where a partial solution first becomes infeasible, not at the leaves.
  Measured on eight queens: 19,173,961 nodes and 2 seconds against 2,057 nodes
  and 1.3 ms, for the same 92 solutions.
- A stack frame in a sanitizer build here costs about 985 bytes and in a plain
  `-O0` build about 80; an 8 MB stack holds roughly 8,500 or 100,000 of them.
  Both numbers are real, which is why a measurement without its build flags is
  not a fact.
- Stack overflow is a segfault, not an exception. Deep recursion over 10⁶ levels
  needs an explicit stack.
- Memoisation applies when the number of distinct argument tuples is far smaller
  than the number of calls. Grid paths: 6,241,589 calls collapse to 164 states.
- If the state is the whole path — subsets, permutations, queens — caching
  cannot help, and pruning is the only lever.
:::
