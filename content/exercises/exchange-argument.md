---
id: exchange-argument
title: "Two rules you have to derive"
difficulty: stretch
chapter: greedy
topics: [greedy, two-pointers, sorting, algorithms]
check: unit
standard: c++20
---

Two greedy problems where the plausible rule and the correct rule differ. In
both cases the correct rule has a one-sentence exchange argument, and the
starter's does not.

- `min_intervals_to_cover(points, length)` — the fewest closed intervals of the
  given `length` needed so that every point is inside one. Centres each interval
  on the point it is placed for.
- `min_boats(weights, limit)` — the fewest boats needed to carry everyone, given
  that a boat holds at most two people and at most `limit` total weight (every
  individual weight is at most `limit`). Pairs the two lightest people.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

int min_intervals_to_cover(std::vector<int> points, int length) {
    std::sort(points.begin(), points.end());

    int used = 0;
    long long covered_to = -1;                     // rightmost covered coordinate
    for (std::size_t i = 0; i < points.size(); ++i) {
        if (points[i] <= covered_to) continue;
        ++used;
        covered_to = points[i] + length / 2;       // centred on the point
    }
    return used;
}

int min_boats(std::vector<int> weights, int limit) {
    std::sort(weights.begin(), weights.end());

    int boats = 0;
    std::size_t i = 0;
    while (i < weights.size()) {                   // pair up the two lightest
        if (i + 1 < weights.size() && weights[i] + weights[i + 1] <= limit) i += 2;
        else i += 1;
        ++boats;
    }
    return boats;
}
```

## Tests
```cpp
// min_intervals_to_cover
CHECK_EQ(min_intervals_to_cover({1, 2, 3, 4, 5, 6, 7}, 2), 3);
CHECK_EQ(min_intervals_to_cover({1, 10, 20}, 2), 3);
CHECK_EQ(min_intervals_to_cover({5}, 0), 1);
CHECK_EQ(min_intervals_to_cover({1, 2, 3}, 0), 3);
CHECK_EQ(min_intervals_to_cover({0, 1, 2, 3, 4}, 4), 1);
CHECK_EQ(min_intervals_to_cover({3, 1, 2}, 1), 2);
CHECK_EQ(min_intervals_to_cover({}, 5), 0);
CHECK_EQ(min_intervals_to_cover({2, 2, 2}, 1), 1);

// min_boats
CHECK_EQ(min_boats({1, 2}, 3), 1);
CHECK_EQ(min_boats({3, 2, 2, 1}, 3), 3);
CHECK_EQ(min_boats({3, 5, 3, 4}, 5), 4);
CHECK_EQ(min_boats({1, 1, 1, 1}, 2), 2);
CHECK_EQ(min_boats({5}, 5), 1);
CHECK_EQ(min_boats({2, 2, 2}, 4), 2);
CHECK_EQ(min_boats({}, 5), 0);
CHECK_EQ(min_boats({1, 2, 3, 4, 5}, 6), 3);
```

## Hints
- An interval placed to cover the leftmost uncovered point should **start** at that point, not be centred on it. Starting there covers `[p, p + length]`, which is the furthest right any legal interval covering `p` can reach.
- With `length = 2` and points `1 … 7`, starting at the point gives `[1,3]`, `[4,6]`, `[7,9]` — three intervals. Centring gives coverage only to `p + 1` and needs four.
- `length / 2` is also integer division, so an odd length loses half a unit — two bugs for the price of one.
- For the boats, think about the **heaviest** person: they must travel, and the only question is who goes with them. Give them the lightest person who fits; if even the lightest does not fit, they go alone.
- That is a two-pointer sweep over the sorted weights: `if (w[i] + w[j] <= limit) ++i; --j; ++boats;` with `i` at the lightest and `j` at the heaviest.
- Pairing the two lightest wastes the pairing on people who could have travelled with someone heavy. `{3, 5, 3, 4}` with a limit of 5 needs four boats either way; `{1, 2, 3, 4, 5}` with a limit of 6 is where the rules part company.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <vector>

int min_intervals_to_cover(std::vector<int> points, int length) {
    std::sort(points.begin(), points.end());

    int used = 0;
    long long covered_to = -1;
    for (std::size_t i = 0; i < points.size(); ++i) {
        if (used > 0 && points[i] <= covered_to) continue;
        ++used;
        covered_to = static_cast<long long>(points[i]) + length;   // start at the point
    }
    return used;
}

int min_boats(std::vector<int> weights, int limit) {
    std::sort(weights.begin(), weights.end());

    int boats = 0;
    int i = 0, j = static_cast<int>(weights.size()) - 1;
    while (i <= j) {
        if (weights[i] + weights[j] <= limit) ++i;   // the lightest joins the heaviest
        --j;                                         // the heaviest always sails
        ++boats;
    }
    return boats;
}
```

## Notes
**Place the interval as far right as it can legally go.** To cover the leftmost
uncovered point `p`, any interval must contain `p`, so it can extend at most to
`p + length`. Starting exactly at `p` achieves that maximum, and covering more of
what is ahead can never be worse.

The exchange argument: take an optimal cover, and look at the interval covering
the leftmost point. Slide it right until it starts at `p`. It still covers `p`,
and every point it used to cover to the right is still covered — sliding right
only adds. So an optimal solution exists whose first interval starts at `p`, and
the rest of the problem is the same problem on the uncovered points. That is the
standard shape: **push the greedy choice to its extreme and show nothing is
lost.**

Centring is a natural-looking alternative and is simply weaker: `[p - l/2,
p + l/2]` reaches `l/2` to the right where `[p, p + l]` reaches `l`. With points
`1 … 7` and length 2 it needs four intervals instead of three.

Note the guard `used > 0 &&` in the loop. `covered_to` starts at −1 to mean
"nothing covered", but a point could legitimately be at −1 or below; comparing
against a sentinel that is also a possible coordinate is exactly the kind of
thing that fails on the one test with negative inputs. Keying the check on
whether any interval exists yet says what is meant.

**Think about the element with the fewest options.** For the boats that is the
heaviest person: they are going, and the only choice is their companion. Giving
them the lightest available person is safe, because if the lightest cannot fit
with them, nobody can, and if someone else could fit, the lightest could have
too — so swapping the lightest in never makes things worse and frees a heavier
person to pair with someone else.

That argument does not work in the other direction, which is why pairing the two
lightest is wrong: it spends the lightest person on someone who had many
partners available. `{1, 2, 3, 4, 5}` with a limit of 6 makes it concrete — the
correct pairing is (1,5), (2,4), (3) for three boats, while pairing the lightest
two gives (1,2), (3), (4), (5) and needs four.

The implementation is the two-pointer sweep of chapter 10.6: `j` moves every
iteration, because the heaviest person always sails; `i` moves only when the
lightest goes with them. Each iteration is one boat, and the loop condition is
`i <= j` rather than `i < j` so that the last person, travelling alone, is
counted.
