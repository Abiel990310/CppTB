---
id: judge-sort-by-keys
title: "Leaderboard"
difficulty: core
chapter: sorting-and-comparators
topics: [sorting, comparators, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Print the players in leaderboard order: highest score first, ties broken by the
shorter time, and remaining ties broken by name in ascending alphabetical order.

**Input.** The first line contains `n`. Each of the next `n` lines contains a
name (no spaces), a score, and a time in seconds.

**Output.** `n` lines, the names in leaderboard order.

**Constraints.** `1 ≤ n ≤ 100000`, `0 ≤ score ≤ 10^9`, `0 ≤ seconds ≤ 10^9`,
and names are 1 to 20 lowercase letters.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Player {
    std::string name;
    int score;
    int seconds;
};

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;

    std::vector<Player> players(n);
    for (Player& p : players) std::cin >> p.name >> p.score >> p.seconds;

    // Score only, and not even strictly.
    std::sort(players.begin(), players.end(), [](const Player& a, const Player& b) {
        return a.score >= b.score;
    });

    for (const Player& p : players) std::cout << p.name << '\n';
}
```

## Cases

### Sample
```in
4
ada 90 300
grace 95 250
alan 90 250
edsger 95 250
```
```out
edsger
grace
alan
ada
```

### one player
```in
1
solo 0 0
```
```out
solo
```

### everything ties but the name
```in
3
zoe 10 5
amy 10 5
bob 10 5
```
```out
amy
bob
zoe
```

### scores tie, times decide
```in
3
slow 50 900
fast 50 100
middle 50 500
```
```out
fast
middle
slow
```

### already in the right order
```in
3
first 30 1
second 20 1
third 10 1
```
```out
first
second
third
```

### many equal players
```in
8
h 1 1
g 1 1
f 1 1
e 1 1
d 1 1
c 1 1
b 1 1
a 1 1
```
```out
a
b
c
d
e
f
g
h
```

## Hints
- Three keys, in order: score descending, seconds ascending, name ascending.
- `>=` is not a valid comparator. Even with the other keys added, it makes `comp(x, x)` true and the sort's behaviour undefined.
- The compact form is `std::tie(b.score, a.seconds, a.name) < std::tie(a.score, b.seconds, b.name)` — note that only the *score* field has its operands swapped, because only that key is descending.
- Written out by hand: compare scores and return if they differ, then compare seconds and return if they differ, then compare names. Guard each step with `!=` so that equal keys fall through rather than returning.
- Do not use `std::stable_sort` to "fix" the name ordering. The names are an explicit third key; relying on input order would give the wrong answer for the last case, where the input is in reverse.
- 100000 lines of input and output: keep `sync_with_stdio(false)` and print `'\n'` rather than `std::endl`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <string>
#include <tuple>
#include <vector>

struct Player {
    std::string name;
    int score;
    int seconds;
};

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) return 0;

    std::vector<Player> players(n);
    for (Player& p : players) std::cin >> p.name >> p.score >> p.seconds;

    std::sort(players.begin(), players.end(), [](const Player& a, const Player& b) {
        // Only `score` is descending, so only `score` has its operands swapped.
        return std::tie(b.score, a.seconds, a.name) < std::tie(a.score, b.seconds, b.name);
    });

    for (const Player& p : players) std::cout << p.name << '\n';
}
```

## Notes
The comparator is the entire problem, and the starter gets it wrong in two ways
at once: it uses only one of the three keys, and it uses `>=`.

The `>=` is the serious one. As Chapter 10.4's sample shows, a non-strict
comparator makes `std::sort` read past the end of its range — so the last case,
eight players with identical scores, is not a wrong-answer case but a
memory-safety one. On a judge that appears as a runtime error or, worse, as an
answer that is right on the machine you tested on.

The `std::tie` form is worth reading carefully, because the trick is easy to
misapply:

```cpp
std::tie(b.score, a.seconds, a.name) < std::tie(a.score, b.seconds, b.name)
```

Every ascending key keeps `a` on the left and `b` on the right. The one
descending key has them swapped, *in both tuples*, so the comparison reads
"b's score is less than a's score" — which puts a's higher score first. The whole
expression is still a single `<`, so it is strict by construction, and adding a
fourth key is one more pair of fields rather than another branch.

The case named "already in the right order" is there for the same reason samples
are usually badly chosen: a solution that returned `false` unconditionally — a
valid strict weak ordering that leaves everything alone — passes it. A test set
in which every case can be passed by accident tests nothing, so cases exist here
whose input order is reversed, whose keys tie at every level, and whose second
and third keys are the only distinguishing ones.

One temptation worth naming and rejecting: `std::stable_sort` on score alone
would produce the right answer for the sample, because the sample's input order
happens to agree with the name ordering. It fails the "everything ties but the
name" case, where the input is `zoe amy bob`. Stability preserves *input* order;
this problem asks for *name* order, and those are different requirements that
coincide often enough to be dangerous.
