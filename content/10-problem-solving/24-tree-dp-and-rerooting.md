---
title: "Tree DP and rerooting"
navTitle: "Tree DP"
summary: >-
  A tree is a DAG once you root it, so one sweep answers a question about every
  subtree. Two sweeps answer it for every possible root at once.
objectives:
  - Write a subtree DP as one iterative post-order sweep
  - Derive a rerooting transition and answer for every vertex in linear time
  - Handle a merge that has no inverse, using the runner-up
  - Recognise when a problem is asking you to reroot
status: complete
standard: c++20
requires: [topological-order]
---

Chapter 10.19 put a DAG on a line so that every edge pointed forward, and then
a DP over it was one sweep. A tree is a DAG the moment you pick a root: every
edge points away from the root, every vertex has exactly one parent, and the
subtrees hanging off a vertex are independent subproblems that do not interact.

So the sweep still works, and it is easier here than on a general DAG — you do
not need Kahn's algorithm to find the order, because a DFS hands it to you.

```cpp run title="Every subtree's size in one sweep"
#include <iostream>   // [hidden]
#include <vector>     // [hidden]

using Tree = std::vector<std::vector<int>>;

int main() {
    /*        0
            / | \
           1  2  3
          /      | \
         4       5  6      */
    Tree g{{1, 2, 3}, {0, 4}, {0}, {0, 5, 6}, {1}, {3}, {3}};
    int n = static_cast<int>(g.size());

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    seen[0] = true;
    while (!stack.empty()) {                       // pre-order: parents first
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<int> size(n, 1);
    for (int i = n - 1; i >= 1; --i) {             // backwards: children first
        int v = order[i];
        size[parent[v]] += size[v];
    }

    for (int v = 0; v < n; ++v)
        std::cout << "subtree of " << v << " holds " << size[v] << '\n';
}
```

## A tree is a DAG once you root it

The loop above is the whole technique, and it is worth looking at twice.

The first pass is an ordinary iterative DFS, which chapter 10.18 argued for: on
a tree shaped like a path, the recursive version runs out of stack, and a path
is not an exotic input. It records `order`, the vertices in the order they were
discovered, and `parent`.

The second pass walks `order` **backwards**. That is the trick worth keeping:
in a pre-order, every vertex appears before all of its descendants, so reversed,
every vertex appears after all of its descendants. Walking backwards is
therefore a valid post-order — every child is finished before its parent is
touched — and it costs one loop rather than a second traversal with its own
stack and its own state machine.

That gives the shape of every subtree DP:

```
for i from n-1 down to 1:
    v = order[i]
    combine v's finished value into parent[v]
```

`size` is the simplest instance. Swap the combine step and you get the number of
leaves below each vertex, the depth of each subtree, the sum of weights in it,
the number of vertices at even depth within it. The traversal never changes.

:::note
The root is `order[0]`, and the loop stops at `i >= 1` so it never reads
`parent[order[0]]`, which is −1. Every bug in this shape is at that boundary.
:::

## Asking the question at every vertex

Subtree DP answers questions about a *fixed* root. A different kind of question
asks about every root at once:

> For each vertex `v`, what is the sum of the distances from `v` to all the
> other vertices?

There is an obvious way to answer it: root at `v`, sweep, repeat. That is a
correct algorithm and it is quadratic, which the part's rule says to show before
replacing.

```cpp run title="Asking every vertex the slow way"
#include <algorithm>  // [hidden]
#include <chrono>     // [hidden]
#include <iostream>   // [hidden]
#include <numeric>    // [hidden]
#include <random>     // [hidden]
#include <vector>     // [hidden]

using Tree = std::vector<std::vector<int>>;

Tree random_tree(int n, std::mt19937& rng) {
    Tree g(n);
    for (int v = 1; v < n; ++v) {
        int p = std::uniform_int_distribution<int>(0, v - 1)(rng);
        g[v].push_back(p);
        g[p].push_back(v);
    }
    return g;
}

std::vector<long long> naive(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<long long> ans(n, 0);
    std::vector<int> dist(n), stack;
    for (int s = 0; s < n; ++s) {                  // once per vertex …
        std::fill(dist.begin(), dist.end(), -1);
        dist[s] = 0;
        stack.assign(1, s);
        long long total = 0;
        while (!stack.empty()) {                   // … a whole traversal
            int v = stack.back(); stack.pop_back();
            total += dist[v];
            for (int to : g[v])
                if (dist[to] < 0) { dist[to] = dist[v] + 1; stack.push_back(to); }
        }
        ans[s] = total;
    }
    return ans;
}

int main() {
    std::mt19937 rng(7);
    for (int n : {1000, 2000}) {
        Tree g = random_tree(n, rng);
        auto t0 = std::chrono::steady_clock::now();
        auto a = naive(g);
        auto t1 = std::chrono::steady_clock::now();
        long long sink = std::accumulate(a.begin(), a.end(), 0LL);
        std::cout << "n = " << n << ": "
                  << std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count()
                  << " ms  (checksum " << sink << ")\n";
    }
}
```

Doubling `n` costs roughly four times as much, which is what quadratic looks
like from the outside. On the sanitized build this runner uses, `n = 2000` takes
somewhere over a second; a tree with 200,000 vertices — an ordinary size for
this kind of problem — is out of reach by a factor of ten thousand.

The checksum is not decoration. Without consuming `a`, the compiler is entitled
to notice that nothing reads the result and delete the work being timed.

## Rerooting: move the root one edge

The naive version throws away almost everything it learns. The answers for two
adjacent vertices are nearly the same, and the difference between them can be
written down exactly.

Root the tree anywhere — say at 0 — and define

- `size[v]` — the number of vertices in `v`'s subtree,
- `down[v]` — the sum of distances from `v` to the vertices *in its own subtree*.

Both are ordinary subtree DP: `size[p] += size[v]` and `down[p] += down[v] + size[v]`,
the second because every vertex under `v` is one step further from `p` than it
was from `v`, and there are `size[v]` of them.

That gives the answer at the root, since the root's subtree is everything:
`ans[0] == down[0]`. Now move the root across one edge, from `p` to a child `c`:

- every vertex inside `c`'s subtree gets **one step closer** — there are `size[c]` of them,
- every other vertex gets **one step further** — there are `n - size[c]` of them.

So

```
ans[c] = ans[p] - size[c] + (n - size[c])
       = ans[p] + n - 2 * size[c]
```

One subtraction, one addition, no traversal. Sweep `order` forwards — parents
before children, which is exactly what a pre-order gives — and every vertex is
answered.

```cpp run title="Rerooting: two sweeps, any n"
#include <algorithm>  // [hidden]
#include <chrono>     // [hidden]
#include <iostream>   // [hidden]
#include <numeric>    // [hidden]
#include <random>     // [hidden]
#include <vector>     // [hidden]
using Tree = std::vector<std::vector<int>>;                                    // [hidden]
Tree random_tree(int n, std::mt19937& rng) {                                   // [hidden]
    Tree g(n);                                                                 // [hidden]
    for (int v = 1; v < n; ++v) {                                              // [hidden]
        int p = std::uniform_int_distribution<int>(0, v - 1)(rng);             // [hidden]
        g[v].push_back(p); g[p].push_back(v);                                  // [hidden]
    }                                                                          // [hidden]
    return g;                                                                  // [hidden]
}                                                                              // [hidden]
std::vector<long long> naive(const Tree& g) {                                  // [hidden]
    int n = static_cast<int>(g.size());                                        // [hidden]
    std::vector<long long> ans(n, 0);                                          // [hidden]
    std::vector<int> dist(n), stack;                                           // [hidden]
    for (int s = 0; s < n; ++s) {                                              // [hidden]
        std::fill(dist.begin(), dist.end(), -1);                               // [hidden]
        dist[s] = 0; stack.assign(1, s);                                       // [hidden]
        long long total = 0;                                                   // [hidden]
        while (!stack.empty()) {                                               // [hidden]
            int v = stack.back(); stack.pop_back();                            // [hidden]
            total += dist[v];                                                  // [hidden]
            for (int to : g[v])                                                // [hidden]
                if (dist[to] < 0) { dist[to] = dist[v] + 1; stack.push_back(to); } // [hidden]
        }                                                                      // [hidden]
        ans[s] = total;                                                        // [hidden]
    }                                                                          // [hidden]
    return ans;                                                                // [hidden]
}                                                                              // [hidden]

std::vector<long long> reroot(const Tree& g) {
    int n = static_cast<int>(g.size());

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    order.reserve(n);
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<long long> size(n, 1), down(n, 0);
    for (int i = n - 1; i >= 1; --i) {             // up: finish children first
        int v = order[i], p = parent[v];
        size[p] += size[v];
        down[p] += down[v] + size[v];
    }

    std::vector<long long> ans(n, 0);
    ans[0] = down[0];
    for (int i = 1; i < n; ++i) {                  // down: parents are ready
        int v = order[i], p = parent[v];
        ans[v] = ans[p] + n - 2 * size[v];
    }
    return ans;
}

int main() {
    std::mt19937 rng(12345);

    int agreed = 0;
    for (int t = 0; t < 300; ++t) {
        int n = 1 + std::uniform_int_distribution<int>(0, 50)(rng);
        Tree g = random_tree(n, rng);
        if (naive(g) != reroot(g)) { std::cout << "MISMATCH at n = " << n << '\n'; return 1; }
        ++agreed;
    }
    std::cout << "agrees with the slow version on " << agreed << " random trees\n";

    Tree big = random_tree(200000, rng);
    auto t0 = std::chrono::steady_clock::now();
    auto a = reroot(big);
    auto t1 = std::chrono::steady_clock::now();
    std::cout << "200000 vertices: "
              << std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count()
              << " ms  (checksum " << std::accumulate(a.begin(), a.end(), 0LL) << ")\n";
}
```

Two hundred thousand vertices in a fraction of a second, on the build where the
naive version needed over a second for two thousand.

:::pitfall
`size` and `down` are `long long` on purpose. With 2 × 10⁵ vertices the sum of
distances from one vertex reaches about 4 × 10¹⁰, which an `int` cannot hold,
and the overflow is undefined behaviour rather than a large number. The
intermediate `n - 2 * size[v]` is signed and often negative — that is correct,
and it is another reason not to reach for an unsigned type here.
:::

## When the merge has no inverse

The transition above worked because the answer for `p` could have `c`'s
contribution *removed* arithmetically. Sums allow that. Many merges do not.

Ask instead: for each vertex, how far away is the furthest vertex? That is the
**eccentricity**, and the merge is `max`, which has no inverse — knowing the
maximum over a set tells you nothing about the maximum over that set minus one
element.

Split the answer by direction. For each `v`:

- `down[v]` — the furthest distance *into* `v`'s own subtree,
- `up[v]` — the furthest distance starting by stepping to the parent.

`down` is the usual upward sweep. For `up`, a child `c` of `p` can go up to `p`
and then either keep going up, or turn into one of its **siblings**:

```
up[c] = 1 + max( up[p], best branch of p that does not go through c )
```

Everything turns on that last phrase. The tempting shortcut is to keep the
single best branch of `p` and use 0 when `c` happens to be it. That is wrong,
and the smallest tree that proves it has three vertices.

```cpp run title="The runner-up matters"
#include <algorithm>  // [hidden]
#include <iostream>   // [hidden]
#include <vector>     // [hidden]
using Tree = std::vector<std::vector<int>>;

// Eccentricity the honest way, for comparison: a traversal from every vertex.
std::vector<int> by_hand(const Tree& g) {
    int n = static_cast<int>(g.size());
    std::vector<int> ans(n, 0), dist(n), stack;
    for (int s = 0; s < n; ++s) {
        std::fill(dist.begin(), dist.end(), -1);
        dist[s] = 0; stack.assign(1, s);
        int best = 0;
        while (!stack.empty()) {
            int v = stack.back(); stack.pop_back();
            best = std::max(best, dist[v]);
            for (int to : g[v])
                if (dist[to] < 0) { dist[to] = dist[v] + 1; stack.push_back(to); }
        }
        ans[s] = best;
    }
    return ans;
}

int main() {
    //  1 — 0 — 2 , rooted at 0
    Tree g{{1, 2}, {0}, {0}};

    // Rooted at 0, both children are equally deep: down[1] = down[2] = 0,
    // so the best branch of 0 is "1" (whichever was seen first) at length 1.
    // Computing up[1] and forgetting the runner-up gives 1 + max(0, 0) = 1.
    std::cout << "correct:      ";
    for (int x : by_hand(g)) std::cout << x << ' ';
    std::cout << "\nforgetting it: 1 1 2\n";
}
```

Vertex 1's furthest vertex is 2, two steps away. The shortcut says one, because
it discarded the only branch that mattered the moment it excluded vertex 1's own.

The fix is to keep the **best two** branch lengths at each vertex, along with
which child produced the best. Excluding a child is then a lookup: if it was the
best, use the runner-up; otherwise use the best.

```cpp run title="Eccentricity everywhere, in two sweeps"
#include <algorithm>  // [hidden]
#include <iostream>   // [hidden]
#include <random>     // [hidden]
#include <vector>     // [hidden]
using Tree = std::vector<std::vector<int>>;                                     // [hidden]
Tree random_tree(int n, std::mt19937& rng, int bias) {                          // [hidden]
    Tree g(n);                                                                  // [hidden]
    for (int v = 1; v < n; ++v) {                                               // [hidden]
        int lo = bias ? std::max(0, v - bias) : 0;                              // [hidden]
        int p = std::uniform_int_distribution<int>(lo, v - 1)(rng);             // [hidden]
        g[v].push_back(p); g[p].push_back(v);                                   // [hidden]
    }                                                                           // [hidden]
    return g;                                                                   // [hidden]
}                                                                               // [hidden]
std::vector<int> by_hand(const Tree& g) {                                       // [hidden]
    int n = static_cast<int>(g.size());                                         // [hidden]
    std::vector<int> ans(n, 0), dist(n), stack;                                 // [hidden]
    for (int s = 0; s < n; ++s) {                                               // [hidden]
        std::fill(dist.begin(), dist.end(), -1);                                // [hidden]
        dist[s] = 0; stack.assign(1, s);                                        // [hidden]
        int best = 0;                                                           // [hidden]
        while (!stack.empty()) {                                                // [hidden]
            int v = stack.back(); stack.pop_back();                             // [hidden]
            best = std::max(best, dist[v]);                                     // [hidden]
            for (int to : g[v])                                                 // [hidden]
                if (dist[to] < 0) { dist[to] = dist[v] + 1; stack.push_back(to); } // [hidden]
        }                                                                       // [hidden]
        ans[s] = best;                                                          // [hidden]
    }                                                                           // [hidden]
    return ans;                                                                 // [hidden]
}                                                                               // [hidden]

std::vector<int> eccentricities(const Tree& g) {
    int n = static_cast<int>(g.size());

    std::vector<int> order, parent(n, -1), stack{0};
    std::vector<bool> seen(n, false);
    seen[0] = true;
    while (!stack.empty()) {
        int v = stack.back(); stack.pop_back();
        order.push_back(v);
        for (int to : g[v])
            if (!seen[to]) { seen[to] = true; parent[to] = v; stack.push_back(to); }
    }

    std::vector<int> down(n, 0);
    for (int i = n - 1; i >= 1; --i) {
        int v = order[i], p = parent[v];
        down[p] = std::max(down[p], down[v] + 1);
    }

    // best1 >= best2 are the two longest branches leaving v downwards;
    // `who` is the child that produced best1.
    std::vector<int> best1(n, 0), best2(n, 0), who(n, -1);
    for (int v = 0; v < n; ++v)
        for (int c : g[v]) {
            if (c == parent[v]) continue;
            int cand = down[c] + 1;
            if (cand > best1[v]) { best2[v] = best1[v]; best1[v] = cand; who[v] = c; }
            else if (cand > best2[v]) { best2[v] = cand; }
        }

    std::vector<int> up(n, 0);
    for (int i = 1; i < n; ++i) {
        int v = order[i], p = parent[v];
        int siblings = (who[p] == v) ? best2[p] : best1[p];   // exclude v's own branch
        up[v] = 1 + std::max(up[p], siblings);
    }

    std::vector<int> ans(n);
    for (int v = 0; v < n; ++v) ans[v] = std::max(down[v], up[v]);
    return ans;
}

int main() {
    std::mt19937 rng(999);
    int checked = 0, paths = 0;
    for (int t = 0; t < 600; ++t) {
        int n = 1 + std::uniform_int_distribution<int>(0, 70)(rng);
        int bias = (t % 3 == 0) ? 1 : (t % 3 == 1 ? 3 : 0);   // paths, near-paths, bushy
        Tree g = random_tree(n, rng, bias);
        if (by_hand(g) != eccentricities(g)) { std::cout << "MISMATCH\n"; return 1; }
        ++checked;
        if (bias == 1) ++paths;
    }
    std::cout << "agrees on " << checked << " trees, " << paths << " of them paths\n";

    Tree g = random_tree(20000, rng, 0);
    auto e = eccentricities(g);
    std::cout << "diameter of a 20000-vertex tree: "
              << *std::max_element(e.begin(), e.end()) << '\n';
}
```

The diameter falls out for free: it is the largest eccentricity. Paths are in
the test set deliberately — they are the shape where a recursive version dies
and where the runner-up bug is most visible.

:::tip
The runner-up is the specialised fix for `max`. The general one, when a merge is
associative but has no inverse, is **prefix and suffix accumulations** over each
vertex's child list: for child *i*, combine `prefix[i-1]` with `suffix[i+1]`.
That costs the same linear total, works for any associative merge, and is what
to reach for when the combine step is matrix multiplication or a modular
product rather than `max`.
:::

## Recognising it

Three signals, in the order they usually appear:

1. **The input is a tree** — `n` vertices, `n − 1` edges, connected. Say it
   aloud, because problems often describe one without using the word.
2. **The question is asked for every vertex**, not for one. "For each city,
   print …" is the giveaway.
3. **Rooting somewhere makes the question easy.** If a single root gives a
   one-sweep answer, two sweeps give all of them.

If the first two hold but the third does not — the quantity genuinely depends on
the whole tree in a way no rooting simplifies — rerooting will not save you, and
the answer is usually a different decomposition entirely, which is what chapter
10.35 is for.

:::quiz
{
  "question": "In the sum-of-distances rerooting, the transition is `ans[c] = ans[p] + n - 2 * size[c]`. What goes wrong if `size[c]` is the subtree size computed with the tree rooted at `c` instead of at the original root?",
  "options": [
    {
      "text": "`size[c]` would be `n`, so every answer after the root becomes `ans[p] - n`",
      "correct": true,
      "why": "Rooted at `c`, `c`'s subtree is the entire tree. The transition counts how many vertices get closer when the root moves, and that count is only meaningful relative to one fixed rooting — the sizes must all come from the same upward sweep."
    },
    {
      "text": "Nothing — subtree sizes are a property of the tree, not of the root",
      "correct": false,
      "why": "They are not. `size[v]` counts the vertices separated from the root by `v`, which changes completely when the root moves. This is the single most common misreading of the technique."
    },
    {
      "text": "It still works, but only for trees where every vertex has at most two children",
      "correct": false,
      "why": "The transition never mentions the number of children; it depends only on how the edge `(p, c)` splits the vertex set into two parts. Branching factor is irrelevant here."
    },
    {
      "text": "The answers come out correct but negative",
      "correct": false,
      "why": "`n - 2 * size[v]` being negative is normal and correct — it happens whenever `v`'s subtree holds more than half the tree. A negative intermediate is not the symptom of this bug."
    }
  ]
}
:::

## Practice

:::exercise reroot-audit

:::exercise tree-dp-toolkit

:::exercise judge-village-distances

:::exercise judge-farthest-village

:::recap
- Rooting a tree turns it into a DAG, so a subtree DP is one sweep — and
  walking a pre-order backwards *is* a post-order, with no second traversal.
- `ans[c] = ans[p] + n - 2 * size[c]` moves the root across one edge for the
  sum of distances: `size[c]` vertices get closer, the rest get further.
- Two sweeps — one up, one down — answer a per-vertex question for every vertex
  in linear time, where the obvious method is quadratic.
- A merge with an inverse lets you subtract a child out. `max` has none, so keep
  the best *two* branches and the child that produced the best.
- The general form of that fix is prefix and suffix accumulations over the child
  list, which works for any associative merge.
- Subtree sums reach 4 × 10¹⁰ at 2 × 10⁵ vertices: `long long`, and signed,
  because `n - 2 * size[v]` is meant to go negative.
:::
