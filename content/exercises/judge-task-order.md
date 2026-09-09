---
id: judge-task-order
title: "Schedule the tasks, alphabetically"
difficulty: core
chapter: topological-order
topics: [graphs, topological-sort, io]
check: output
standard: c++20
timeLimitMs: 2000
---

`n` tasks are numbered 1 to `n`, and `m` prerequisites say that task `a` must be
done before task `b`. Print the **lexicographically smallest** order in which
all the tasks can be done, or `IMPOSSIBLE` if no order exists.

**Input.** The first line contains `n` and `m`. Each of the next `m` lines
contains `a` and `b`, meaning `a` comes before `b`.

**Output.** One line of `n` task numbers separated by single spaces, or the word
`IMPOSSIBLE`.

**Constraints.** `1 ≤ n ≤ 200000`, `0 ≤ m ≤ 200000`.

## Starter
```cpp
#include <iostream>
#include <queue>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    std::vector<int> indeg(n, 0);
    for (int i = 0; i < m; ++i) {
        int a, b;
        std::cin >> a >> b;
        g[a - 1].push_back(b - 1);
        ++indeg[b - 1];
    }

    std::queue<int> ready;                 // whatever became ready first
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.front(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }

    if (static_cast<int>(order.size()) != n) { std::cout << "IMPOSSIBLE\n"; return 0; }
    for (int i = 0; i < n; ++i) std::cout << order[i] + 1 << " \n"[i == n - 1];
}
```

## Cases

### Sample
```in
3 1
1 2
```
```out
1 2 3
```

### a diamond
```in
4 3
1 3
2 3
3 4
```
```out
1 2 3 4
```

### a cycle
```in
3 3
1 2
2 3
3 1
```
```out
IMPOSSIBLE
```

### nothing to do first
```in
4 0
```
```out
1 2 3 4
```

### the numbering runs backwards
```in
2 1
2 1
```
```out
2 1
```

### a task freed later is smaller
```in
5 2
1 4
4 2
```
```out
1 3 4 2 5
```

### two branches
```in
5 4
1 2
1 3
2 5
3 4
```
```out
1 2 3 4 5
```

### one task
```in
1 0
```
```out
1
```

## Hints
- Kahn's algorithm gives *a* valid order. Which one depends entirely on which ready task you take next.
- For the smallest order, always take the smallest ready task: replace the queue with `std::priority_queue<int, std::vector<int>, std::greater<>>`.
- `std::priority_queue` is a max-heap by default; the `std::greater<>` comparator is what makes it a min-heap, and it is why the type takes three template arguments.
- `3 1 / 1 2` is the smallest case that separates them. After task 1 is done, task 2 becomes ready while task 3 is already waiting — a queue takes 3 first, and the answer is `1 2 3`.
- The greedy is correct because no ready task depends on any other ready task, so taking the smallest can never block anything (chapter 10.13's exchange argument).
- If fewer than `n` tasks come out, there is a cycle. That check is the whole of the `IMPOSSIBLE` case.

## Solution
```cpp
#include <functional>
#include <iostream>
#include <queue>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n, m;
    std::cin >> n >> m;
    std::vector<std::vector<int>> g(n);
    std::vector<int> indeg(n, 0);
    for (int i = 0; i < m; ++i) {
        int a, b;
        std::cin >> a >> b;
        g[a - 1].push_back(b - 1);
        ++indeg[b - 1];
    }

    std::priority_queue<int, std::vector<int>, std::greater<>> ready;   // smallest first
    for (int v = 0; v < n; ++v) if (indeg[v] == 0) ready.push(v);

    std::vector<int> order;
    while (!ready.empty()) {
        int v = ready.top(); ready.pop();
        order.push_back(v);
        for (int w : g[v]) if (--indeg[w] == 0) ready.push(w);
    }

    if (static_cast<int>(order.size()) != n) { std::cout << "IMPOSSIBLE\n"; return 0; }
    for (int i = 0; i < n; ++i) std::cout << order[i] + 1 << " \n"[i == n - 1];
}
```

## Notes
The starter is a correct topological sort answering a question that was not
asked. A topological order is not unique, and this problem names the one it
wants.

The sample is the minimum demonstration. With only the prerequisite `1 → 2`,
tasks 1 and 3 start ready. A queue emits 1, then finds 2 newly ready and puts it
*behind* 3, giving `1 3 2`. A min-heap compares them and gives `1 2 3`. The
difference appears exactly when a task freed later is smaller than one already
waiting — which is most inputs of any size.

**Why the greedy is right.** Among the tasks currently ready, none depends on
another: each has no remaining prerequisites at all. So placing the smallest one
first cannot make any other task impossible, and swapping it earlier in any valid
order keeps that order valid — the exchange argument of chapter 10.13, in two
lines. It is worth doing that argument rather than assuming it, because "smallest
at each step" is *not* generally the same as "smallest overall", and here it
happens to be.

**The cycle test is free.** A task on a cycle keeps a prerequisite forever, so it
never becomes ready, and neither does anything depending on it. Counting what
came out and comparing with `n` detects that with no extra pass — and the tasks
missing from the output are precisely those on or downstream of a cycle, which is
useful if the problem asks *which* tasks are impossible.

**On the cost.** The heap makes the algorithm O((n + m) log n) rather than
O(n + m). At 2 × 10⁵ that log factor is about 18 and entirely affordable; if a
problem wanted only *some* valid order, the queue would be the right choice and
the heap a needless expense. Read which one is being asked for.

**On the output.** `" \n"[i == n - 1]` prints a space between values and a
newline after the last, avoiding a trailing space. With 2 × 10⁵ numbers on one
line, `sync_with_stdio(false)` and `'\n'` matter (chapter 10.3).
