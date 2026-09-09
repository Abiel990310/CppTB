---
title: "Greedy, and proving it with an exchange argument"
navTitle: "Greedy"
summary: >-
  Three plausible greedy rules for the same problem, two of them wrong, and the
  argument that tells you which is which before the judge does.
objectives:
  - State a greedy algorithm as a choice rule plus a claim
  - Test a greedy rule against brute force before trusting it
  - Prove a greedy optimal with an exchange argument
  - Recognise the problems where greedy is provably wrong
status: complete
standard: c++20
requires: [bitmask-enumeration]
---

A greedy algorithm makes the locally best choice and never reconsiders. When it
works it is the shortest correct solution you will write all contest; when it
does not, it produces plausible answers that are wrong on tests you cannot see.

The difficulty is never writing the code. It is knowing which rule is right, and
the honest answer is that **you cannot tell by looking.** This chapter is about
the two things that do tell you: a brute-force cross-check, and an exchange
argument.

## Three rules, one problem

Choose as many non-overlapping intervals as possible. Three rules suggest
themselves, all of them reasonable.

```cpp run title="Two of these are wrong"
#include <algorithm>
#include <cstdio>
#include <random>
#include <vector>

struct Interval { int start, finish; };

// Greedy: take intervals in some order, skipping any that overlap what is taken.
int greedy(std::vector<Interval> v, int rule) {
    if (rule == 0)                                   // earliest finish
        std::sort(v.begin(), v.end(), [](Interval a, Interval b) { return a.finish < b.finish; });
    else if (rule == 1)                              // earliest start
        std::sort(v.begin(), v.end(), [](Interval a, Interval b) { return a.start < b.start; });
    else                                             // shortest duration
        std::sort(v.begin(), v.end(), [](Interval a, Interval b) {
            return a.finish - a.start < b.finish - b.start; });

    int taken = 0, last_end = -1;
    for (Interval iv : v)
        if (iv.start >= last_end) { ++taken; last_end = iv.finish; }
    return taken;
}

// Exhaustive: try every subset, keep the largest pairwise-compatible one.
int optimal(const std::vector<Interval>& v) {
    int n = static_cast<int>(v.size()), best = 0;
    for (int m = 0; m < (1 << n); ++m) {
        std::vector<Interval> chosen;
        for (int i = 0; i < n; ++i) if (m >> i & 1) chosen.push_back(v[i]);
        std::sort(chosen.begin(), chosen.end(),
                  [](Interval a, Interval b) { return a.start < b.start; });
        bool ok = true;
        for (std::size_t i = 1; i < chosen.size(); ++i)
            if (chosen[i].start < chosen[i - 1].finish) ok = false;
        if (ok) best = std::max(best, static_cast<int>(chosen.size()));
    }
    return best;
}

int main() {
    const char* names[3] = {"earliest finish", "earliest start ", "shortest first "};
    std::mt19937 rng(2024);
    int failures[3] = {0, 0, 0};
    std::vector<Interval> first_bad[3];

    for (int trial = 0; trial < 4000; ++trial) {
        int n = 2 + static_cast<int>(rng() % 5);
        std::vector<Interval> v(n);
        for (Interval& iv : v) {
            int a = static_cast<int>(rng() % 10);
            int b = a + 1 + static_cast<int>(rng() % 5);
            iv = {a, b};
        }
        int best = optimal(v);
        for (int rule = 0; rule < 3; ++rule)
            if (greedy(v, rule) != best) {
                if (failures[rule] == 0) first_bad[rule] = v;
                ++failures[rule];
            }
    }

    for (int rule = 0; rule < 3; ++rule) {
        std::printf("%s wrong on %4d of 4000", names[rule], failures[rule]);
        if (failures[rule]) {
            std::printf("   first counterexample:");
            for (Interval iv : first_bad[rule]) std::printf(" [%d,%d)", iv.start, iv.finish);
            std::printf("  greedy %d, best %d",
                        greedy(first_bad[rule], rule), optimal(first_bad[rule]));
        }
        std::printf("\n");
    }
}
```

Earliest finish: 0 failures in 4,000. Earliest start: 412. Shortest first:
2,024 — wrong more often than right.

The counterexamples are tiny. Earliest start fails on
`[0,5) [0,4) [0,1) [1,5)`: it takes `[0,5)` and stops, where `[0,1)` and `[1,5)`
both fit. Shortest first fails on six intervals where a three-interval solution
exists and it finds two.

**That program is the technique, not just the illustration.** Forty lines of
random cross-check against brute force will settle a greedy rule in the time it
takes to argue about one, and it is available in the contest. Write the
exponential reference first, then the greedy, then the loop that compares them
on small random inputs. If it survives ten thousand trials, submit it.

## The exchange argument

Cross-checking gives you confidence. An exchange argument gives you a reason,
and it is short enough to do at the whiteboard.

The claim: for interval scheduling, **taking the interval that finishes earliest
is always part of some optimal solution.**

The argument. Let `g` be the interval with the earliest finish time, and let `O`
be any optimal solution. If `O` contains `g`, done. Otherwise, let `f` be the
first interval in `O` by finish time. Since `g` finishes no later than `f`,
replacing `f` with `g` in `O` leaves every other interval in `O` still
compatible — they all start at or after `f`'s finish, hence at or after `g`'s.
The result is a solution of the same size containing `g`, so an optimal solution
containing `g` exists. Now recurse on the intervals starting after `g`.

That is the shape every exchange argument has:

1. Take an optimal solution that differs from the greedy choice.
2. **Exchange** the differing element for the greedy one.
3. Show the result is still valid and no worse.
4. Conclude some optimum agrees with the greedy choice, and induct.

Here is a second problem where the argument is even shorter, and the code is a
`sort`.

```cpp run title="Shortest job first, and the swap that proves it"
#include <algorithm>
#include <cstdio>
#include <random>
#include <vector>

// Sum of every job's completion time, if run in the given order.
long long total_completion(const std::vector<int>& order) {
    long long clock = 0, total = 0;
    for (int d : order) { clock += d; total += clock; }
    return total;
}

long long shortest_first(std::vector<int> jobs) {
    std::sort(jobs.begin(), jobs.end());
    return total_completion(jobs);
}

long long best_over_all_orders(std::vector<int> jobs) {
    std::sort(jobs.begin(), jobs.end());
    long long best = total_completion(jobs);
    while (std::next_permutation(jobs.begin(), jobs.end()))
        best = std::min(best, total_completion(jobs));
    return best;
}

int main() {
    std::vector<int> demo{4, 1, 3};
    std::printf("jobs 4 1 3\n");
    std::printf("  in the given order : %lld\n", total_completion(demo));
    std::printf("  shortest first     : %lld\n", shortest_first(demo));
    std::printf("  best of all orders : %lld\n", best_over_all_orders(demo));

    std::mt19937 rng(11);
    int checked = 0, mismatches = 0;
    for (int trial = 0; trial < 3000; ++trial) {
        int n = 1 + static_cast<int>(rng() % 6);
        std::vector<int> jobs(n);
        for (int& d : jobs) d = 1 + static_cast<int>(rng() % 20);
        if (shortest_first(jobs) != best_over_all_orders(jobs)) ++mismatches;
        ++checked;
    }
    std::printf("\n%d random job sets: shortest-first differs from the best order "
                "in %d of them\n", checked, mismatches);

    // The exchange argument, made concrete: swapping an adjacent out-of-order
    // pair can only help.
    std::vector<int> bad{5, 2, 7};
    std::vector<int> swapped{2, 5, 7};
    std::printf("5 2 7 -> %lld   after swapping the first two -> %lld\n",
                total_completion(bad), total_completion(swapped));
}
```

Zero mismatches in 3,000 trials, and `5 2 7` costs 26 against 23 for `2 5 7`.

The argument, in one line: if two **adjacent** jobs are out of order — a longer
one before a shorter one — swapping them reduces the total by exactly the
difference in their durations, and changes nothing for any other job, because
the pair occupies the same total time. So any order that is not sorted can be
improved, and the sorted order is optimal.

The "adjacent" is what makes it easy. **Exchange arguments are almost always
about adjacent elements**, because a swap of neighbours leaves the rest of the
schedule untouched and the accounting is one subtraction.

## Where greedy is provably wrong

Two classics, both worth having failed at least once.

```cpp run title="Coin change, and when the largest coin is a mistake"
#include <algorithm>
#include <cstdio>
#include <vector>

// Greedy: take the largest coin that fits, repeatedly.
int greedy_coins(const std::vector<int>& coins, int amount) {
    int used = 0;
    for (int i = static_cast<int>(coins.size()) - 1; i >= 0; --i)
        while (amount >= coins[i]) { amount -= coins[i]; ++used; }
    return amount == 0 ? used : -1;
}

// Exact: the usual coin-change dynamic program.
int fewest_coins(const std::vector<int>& coins, int amount) {
    std::vector<int> best(amount + 1, amount + 1);
    best[0] = 0;
    for (int a = 1; a <= amount; ++a)
        for (int c : coins)
            if (c <= a) best[a] = std::min(best[a], best[a - c] + 1);
    return best[amount] > amount ? -1 : best[amount];
}

int main() {
    std::vector<int> uk{1, 2, 5, 10, 20, 50};      // a canonical system
    std::vector<int> odd{1, 3, 4};                 // not canonical

    for (const auto& [name, coins] :
         {std::pair{"1 2 5 10 20 50", uk}, std::pair{"1 3 4      ", odd}}) {
        int first_bad = -1, checked = 0;
        for (int amount = 1; amount <= 200; ++amount) {
            ++checked;
            if (greedy_coins(coins, amount) != fewest_coins(coins, amount)) {
                first_bad = amount;
                break;
            }
        }
        if (first_bad < 0)
            std::printf("%s : greedy matches the optimum for every amount up to %d\n",
                        name, checked);
        else
            std::printf("%s : greedy first fails at %d -- %d coins against %d\n",
                        name, first_bad,
                        greedy_coins(coins, first_bad), fewest_coins(coins, first_bad));
    }
}
```

Greedy is right for every amount up to 200 with real coins, and wrong at 6 with
`{1, 3, 4}`: it takes 4, then 1, then 1, where 3 + 3 is two coins.

Coin systems where greedy always works are called **canonical**, most real
currencies are canonical by design, and there is no quick test — deciding
canonicity is itself an algorithm. So: if the coin denominations are given as
*input*, greedy is wrong, and the problem wants the dynamic program (chapter
10.27).

```cpp run title="Knapsack: the best ratio first is not the best"
#include <algorithm>
#include <cstdio>
#include <vector>

struct Item { int weight, value; };

// Greedy by value density: take the best ratio first, whole items only.
int greedy_01(std::vector<Item> items, int capacity) {
    std::sort(items.begin(), items.end(), [](Item a, Item b) {
        return static_cast<long long>(a.value) * b.weight >
               static_cast<long long>(b.value) * a.weight;   // a.v/a.w > b.v/b.w
    });
    int total = 0;
    for (Item it : items)
        if (it.weight <= capacity) { capacity -= it.weight; total += it.value; }
    return total;
}

// The same greedy, but allowed to take fractions of an item.
double greedy_fractional(std::vector<Item> items, int capacity) {
    std::sort(items.begin(), items.end(), [](Item a, Item b) {
        return static_cast<long long>(a.value) * b.weight >
               static_cast<long long>(b.value) * a.weight;
    });
    double total = 0;
    for (Item it : items) {
        if (capacity == 0) break;
        int take = std::min(it.weight, capacity);
        total += static_cast<double>(it.value) * take / it.weight;
        capacity -= take;
    }
    return total;
}

int exact_01(const std::vector<Item>& items, int capacity) {
    int n = static_cast<int>(items.size()), best = 0;
    for (int m = 0; m < (1 << n); ++m) {
        int w = 0, v = 0;
        for (int i = 0; i < n; ++i)
            if (m >> i & 1) { w += items[i].weight; v += items[i].value; }
        if (w <= capacity) best = std::max(best, v);
    }
    return best;
}

int main() {
    std::vector<Item> items{{10, 60}, {20, 100}, {30, 120}};
    const int capacity = 50;

    std::printf("ratios: %.1f %.1f %.1f per unit weight\n",
                60.0 / 10, 100.0 / 20, 120.0 / 30);
    std::printf("0/1 greedy      %d\n", greedy_01(items, capacity));
    std::printf("0/1 exact       %d\n", exact_01(items, capacity));
    std::printf("fractional      %.1f\n", greedy_fractional(items, capacity));

    // A capacity where taking the best ratio first is a mistake.
    std::vector<Item> trap{{3, 30}, {5, 45}, {5, 45}};
    const int cap2 = 10;
    std::printf("\ntrap ratios: %.1f %.1f %.1f\n", 30.0 / 3, 45.0 / 5, 45.0 / 5);
    std::printf("0/1 greedy      %d\n", greedy_01(trap, cap2));
    std::printf("0/1 exact       %d\n", exact_01(trap, cap2));
    std::printf("fractional      %.1f\n", greedy_fractional(trap, cap2));
}
```

160 against an optimum of 220, and 75 against 90 — while the *fractional*
version, allowed to take part of an item, reaches 240 and 93 and is provably
optimal.

That contrast is the lesson. The exchange argument for fractional knapsack works
because you can always swap out a sliver of a worse-ratio item for a sliver of a
better one. In the 0/1 version the items are indivisible, the exchange is not
available, and the greedy loses. **The proof failing is not a formality — it is
the algorithm failing.**

## In practice

| Problem | Greedy rule | Verdict |
|---|---|---|
| Maximum non-overlapping intervals | earliest finish time | optimal |
| Minimise total completion time | shortest job first | optimal |
| Cover a line with fewest fixed-length intervals | leftmost uncovered point | optimal |
| Fractional knapsack | best value per unit weight | optimal |
| 0/1 knapsack | best value per unit weight | **wrong** — DP (10.27) |
| Coin change, denominations given as input | largest coin first | **wrong** — DP (10.27) |
| Minimum set cover | largest number of new items | **wrong** — NP-hard |
| Merge files, cheapest pair first | smallest two | optimal (Huffman) |

The routine when you meet a new problem:

1. Guess a rule. Usually there are two or three plausible ones.
2. Write the exponential reference solution — it is short, and you need it
   anyway to test the real one.
3. Compare on ten thousand small random inputs. Most wrong rules die in the
   first hundred.
4. If it survives, look for the exchange argument. If you find one, submit with
   confidence; if you cannot, submit anyway and keep the DP in mind.

Step 3 before step 4 is deliberate. Testing is faster than proving and kills
most candidates; proving is what tells you the survivor is not merely lucky on
small inputs.

:::quiz
{
  "question": "You have a greedy rule that agrees with brute force on 10,000 random inputs of size up to 6. What have you established?",
  "options": [
    { "text": "Strong evidence, not proof — and specifically no evidence about structure that only appears in larger inputs", "correct": true, "why": "Random small tests kill most wrong rules quickly, which is why the check is worth running first. But a counterexample needing seven elements, or a particular skew the generator never produces, will not show up. That is what the exchange argument is for." },
    { "text": "A proof, since any counterexample could be shrunk to a small one", "why": "Counterexamples are often minimal at a size the generator never reaches — the shortest-first interval counterexample here needs six intervals — and 'can be shrunk' is itself a claim that needs proof." },
    { "text": "Nothing useful; only a proof counts", "why": "It is the fastest way to eliminate a wrong rule, and this chapter's first sample kills two of three candidates in one run. Discarding it wastes the cheapest tool available." },
    { "text": "That the rule is optimal for inputs up to size 6, and probably beyond", "why": "Not even that: the generator samples inputs of those sizes, it does not enumerate them, so untested small inputs remain." }
  ]
}
:::

## Practice

:::exercise greedy-audit

:::exercise exchange-argument

:::exercise judge-interval-cover

:::exercise judge-deadline-jobs

:::recap
- A greedy algorithm is a choice rule plus a claim that the rule is safe. The
  code is trivial; the claim is the work.
- Test before you trust. Measured here: over 4,000 random interval sets,
  earliest-finish was wrong 0 times, earliest-start 412, and shortest-first
  2,024. The cross-check that produced those numbers is forty lines and works in
  a contest.
- An exchange argument takes an optimal solution, swaps in the greedy choice,
  and shows nothing got worse. Adjacent swaps are the easy case, because the
  rest of the arrangement is untouched.
- Greedy is provably wrong for 0/1 knapsack (160 against 220 here) and for coin
  change with arbitrary denominations (3 coins against 2, at amount 6 with
  `{1, 3, 4}`). Both are dynamic programs.
- The fractional knapsack differs from the 0/1 version by exactly the thing that
  makes the exchange argument work — you can swap a sliver. When the exchange is
  not available, neither is the greedy.
:::
