---
id: judge-distinct-permutations
title: "Every distinct arrangement, in order"
difficulty: core
chapter: bitmask-enumeration
topics: [permutations, algorithms, io]
check: output
standard: c++20
timeLimitMs: 3000
---

Print every **distinct** permutation of a string, in lexicographic order, one
per line.

**Input.** One line: a string of lower-case letters.

**Output.** First a line containing the number of distinct permutations, then
that many lines, each one permutation, in increasing lexicographic order.

**Constraints.** The string has between 1 and 8 characters.

## Starter
```cpp
#include <algorithm>
#include <cstddef>
#include <iostream>
#include <string>
#include <vector>

std::string s;
std::vector<std::string> out;

void generate(std::size_t k) {
    if (k == s.size()) { out.push_back(s); return; }
    for (std::size_t i = k; i < s.size(); ++i) {
        std::swap(s[k], s[i]);
        generate(k + 1);
        std::swap(s[k], s[i]);
    }
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::cin >> s;
    generate(0);
    std::sort(out.begin(), out.end());

    std::cout << out.size() << '\n';
    for (const std::string& p : out) std::cout << p << '\n';
}
```

## Cases

### Sample
```in
aab
```
```out
3
aab
aba
baa
```

### all different
```in
abc
```
```out
6
abc
acb
bac
bca
cab
cba
```

### all the same
```in
aaa
```
```out
1
aaa
```

### two of each
```in
aabb
```
```out
6
aabb
abab
abba
baab
baba
bbaa
```

### a single character
```in
z
```
```out
1
z
```

### two characters
```in
ba
```
```out
2
ab
ba
```

### one repeat among three
```in
aba
```
```out
3
aab
aba
baa
```

## Hints
- The swap recursion makes one branch per position, so a repeated character produces the same string more than once. Sorting the results puts them in order but does not remove the duplicates.
- `std::unique` removes *adjacent* duplicates, so it works on a sorted vector: `out.erase(std::unique(out.begin(), out.end()), out.end());`.
- There is a shorter route that never creates a duplicate: sort the string, then loop with `std::next_permutation` until it returns `false`.
- `std::next_permutation` produces the next lexicographically larger arrangement, so it visits each distinct permutation exactly once, in order — repeats included, for free. It requires the input to start sorted.
- Write it as `do { ... } while (std::next_permutation(...));` so the sorted string itself is printed before the first advance.
- Eight characters give at most 40,320 lines, so either approach is fast enough; the difference is only in how much you have to think about duplicates.

## Solution
```cpp
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::string s;
    std::cin >> s;
    std::sort(s.begin(), s.end());          // next_permutation starts from sorted

    std::vector<std::string> out;
    do { out.push_back(s); }
    while (std::next_permutation(s.begin(), s.end()));

    std::cout << out.size() << '\n';
    for (const std::string& p : out) std::cout << p << '\n';
}
```

## Notes
The swap recursion enumerates *positions*, not *values*. On `aab` it branches
three ways at position 0, and two of those branches put an `a` there — so the
same string is produced twice. Six strings come out where three are wanted, and
sorting them makes the duplicates adjacent rather than absent.

Two ways to fix it, and the difference in effort is the point.

**Deduplicate after the fact.** `sort` then `unique` then `erase` — the
erase-remove idiom from chapter 4.5, which is correct and costs a full
enumeration of the duplicates first. On a string of eight identical characters
that is 40,320 strings generated to yield one.

**Never generate them.** `std::next_permutation` walks the distinct
arrangements in lexicographic order, because "next larger arrangement" has no
room for a repeat between two equal ones. It needs a sorted start, returns
`false` once it has produced the largest, and does the whole job in a `do`/`while`
loop. On `aaaaaaaa` it runs exactly once.

If you want to keep the recursion — and sometimes you must, when the branches do
more than emit a string — the fix is to sort the input and skip equal choices at
each level:

```cpp
std::sort(s.begin(), s.end());
// inside the loop over i, with a copy rather than swaps:
if (i > k && s[i] == s[i - 1]) continue;   // this value was already tried here
```

That guard depends on the remaining elements staying sorted, which the swapping
version does not preserve — so it goes with a "pick an unused index" recursion,
not with `std::swap`. Being clear about which recursion you are writing is what
makes the guard correct.

**Two smaller things this problem checks.**

`do { } while (next_permutation(...))` and not `while (next_permutation(...))
{ }`. The second form advances before the first output, so the sorted string
itself — the lexicographically smallest permutation — is never printed. The
`aaa` case catches it: the answer is one line, and the `while` form prints zero.

And the count comes first, which means the permutations must be collected before
any of them is printed. That is why the solution builds a vector rather than
printing inside the loop. When a problem wants a count followed by the items,
either buffer them or compute the count in closed form — here it is
`n! / ∏(multiplicities!)`, which is worth knowing but not worth the risk.
