---
id: judge-deadline-jobs
title: "Jobs with deadlines"
difficulty: stretch
chapter: greedy
topics: [greedy, sorting, io]
check: output
standard: c++20
timeLimitMs: 2000
---

Each of `n` jobs takes exactly one unit of time, has a deadline, and pays a
profit if it finishes by that deadline. Time is divided into unit slots
1, 2, 3, …, and only one job runs per slot. Print the largest total profit
obtainable.

**Input.** The first line contains `n`. Each of the next `n` lines contains a
job's deadline `d` and profit `p`.

**Output.** One line: the maximum total profit.

**Constraints.** `1 ≤ n ≤ 2000`, `1 ≤ d ≤ 2000`, `1 ≤ p ≤ 10⁹`.

## Starter
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::pair<int, long long>> jobs(n);
    int latest = 0;
    for (auto& [d, p] : jobs) { std::cin >> d >> p; latest = std::max(latest, d); }

    // Take the jobs in deadline order and give each the latest free slot it can use.
    std::sort(jobs.begin(), jobs.end(),
              [](const auto& a, const auto& b) { return a.first < b.first; });

    std::vector<bool> busy(latest + 1, false);
    long long total = 0;
    for (const auto& [d, p] : jobs)
        for (int t = std::min(d, latest); t >= 1; --t)
            if (!busy[t]) { busy[t] = true; total += p; break; }

    std::cout << total << '\n';
}
```

## Cases

### Sample
```in
5
2 100
1 19
2 27
1 25
3 15
```
```out
142
```

### one late job and three early ones
```in
4
4 20
1 10
1 40
1 30
```
```out
60
```

### profit decides, not deadline
```in
2
1 1
1 1000000000
```
```out
1000000000
```

### only one job
```in
1
1 5
```
```out
5
```

### two slots, three jobs
```in
3
2 50
2 60
2 20
```
```out
110
```

### every job fits
```in
4
3 10
3 10
3 10
3 10
```
```out
30
```

### a mixture
```in
4
3 20
1 10
1 40
1 30
```
```out
60
```

## Hints
- Only one job can run in each slot, so the question is which jobs to drop — and the ones to drop are the least profitable.
- Take the jobs in **decreasing profit** order. Deadline order tells you nothing about which job is worth keeping.
- For each job in that order, put it in the **latest** free slot at or before its deadline. Using a late slot keeps the early ones available for jobs with tighter deadlines.
- If no slot at or before the deadline is free, the job cannot be scheduled at all; skip it.
- `{1 1}` and `{1 1000000000}` both want slot 1. Deadline order takes whichever was read first; profit order takes the billion.
- Profits reach 10⁹ and there can be 2,000 of them, so the total reaches 2 × 10¹² — `long long`.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    std::cin >> n;
    std::vector<std::pair<int, long long>> jobs(n);
    int latest = 0;
    for (auto& [d, p] : jobs) { std::cin >> d >> p; latest = std::max(latest, d); }

    // Most valuable first; each takes the latest slot it is still allowed.
    std::sort(jobs.begin(), jobs.end(),
              [](const auto& a, const auto& b) { return a.second > b.second; });

    std::vector<bool> busy(latest + 1, false);
    long long total = 0;
    for (const auto& [d, p] : jobs)
        for (int t = std::min(d, latest); t >= 1; --t)
            if (!busy[t]) { busy[t] = true; total += p; break; }

    std::cout << total << '\n';
}
```

## Notes
Two greedy decisions, and the starter gets the second one right and the first
one wrong.

**Order by profit, not by deadline.** Every slot holds one job, so scheduling is
a competition for slots, and the job that should win a contested slot is the one
worth more. Deadline order says nothing about value — on the third case both
jobs want slot 1, and reading order decides, which is not an algorithm.

The exchange argument: suppose an optimal schedule omits job `A` but includes
job `B` with `profit(B) < profit(A)`, and `A` could have been scheduled. Then
`A` fits in some slot at or before its deadline; if that slot is free, add it and
the profit rises. If it is occupied by `B`, swap them — `B` leaves, `A` enters —
and the total rises by `profit(A) − profit(B) > 0`, contradicting optimality. So
no optimal schedule ever prefers a less profitable job over a more profitable
one it could have taken.

**Take the latest slot that still works.** This part the starter has right, and
it is worth stating why: an early slot is usable by *more* jobs than a late one,
because every job with a deadline of `d` or more can use slot 1 while only jobs
with a deadline of at least `t` can use slot `t`. Filling from the back therefore
leaves the most flexible slots free. Taking the earliest free slot instead can
block a later job with a tight deadline — and this is the second exchange
argument, with the same shape as the first.

**Complexity, and when it stops being enough.** The inner scan is O(d) per job,
so the whole thing is O(n · d), which at `n = d = 2000` is four million steps —
comfortable. At `n = d = 2 × 10⁵` it is 4 × 10¹⁰ and would not pass. The standard
upgrade is a disjoint-set structure over the slots where `find(t)` returns the
latest free slot at or before `t`, making each assignment near-constant; chapter
10.20 builds it. A `std::set<int>` of free slots with `upper_bound` is the same
idea at a log factor and is easier to write under time pressure.

**Widths.** The profits are `long long` from the moment they are read. 2,000
jobs at 10⁹ is 2 × 10¹², which is fine for a 64-bit accumulator and about a
thousand times too big for a 32-bit one.
