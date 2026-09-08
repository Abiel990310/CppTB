---
id: summarise-samples
title: "What the fifteen numbers mean"
difficulty: core
chapter: measuring
topics: [performance, benchmarking, statistics]
check: unit
standard: c++20
---

You have a vector of timings from a benchmark. Turn it into the summary a reader
can act on.

Implement `summarise(samples)` returning a `Summary` with:

- `count` — how many samples.
- `min`, `max` — the extremes.
- `median` — the middle value for an odd count; the **mean of the two middle
  values** for an even one.
- `mean` — the arithmetic mean.
- `spread` — `max / min`, the factor between best and worst.

Two requirements the stubs get wrong and the checks enforce: `summarise` must
not modify the caller's vector, and an empty input must produce all zeroes
rather than dividing by zero or reading past the end.

## Starter
```cpp
#include <cstddef>
#include <vector>

struct Summary {
    std::size_t count = 0;
    double min = 0.0;
    double max = 0.0;
    double median = 0.0;
    double mean = 0.0;
    double spread = 0.0;
};

Summary summarise(std::vector<double>& samples) {
    Summary s;
    s.count = samples.size();
    s.min = samples[0];
    s.max = samples[samples.size() - 1];
    s.median = samples[samples.size() / 2];
    s.mean = samples[0];
    s.spread = s.max / s.min;
    return s;
}
```

## Tests
```cpp
// Odd count, deliberately unsorted. The caller's vector must come back
// untouched.
std::vector<double> odd = {21.5, 20.0, 55.0, 20.5, 21.0};
Summary a = summarise(odd);
CHECK_EQ(a.count, std::size_t{5});
CHECK_NEAR(a.min, 20.0, 1e-9);
CHECK_NEAR(a.max, 55.0, 1e-9);
CHECK_NEAR(a.median, 21.0, 1e-9);
CHECK_NEAR(a.mean, 27.6, 1e-9);
CHECK_NEAR(a.spread, 2.75, 1e-9);
CHECK_NEAR(odd[0], 21.5, 1e-9);          // not sorted in place
CHECK_NEAR(odd[2], 55.0, 1e-9);

// Even count: the median is the mean of the two middle values.
std::vector<double> even = {4.0, 1.0, 3.0, 2.0};
Summary b = summarise(even);
CHECK_EQ(b.count, std::size_t{4});
CHECK_NEAR(b.median, 2.5, 1e-9);
CHECK_NEAR(b.mean, 2.5, 1e-9);
CHECK_NEAR(b.min, 1.0, 1e-9);
CHECK_NEAR(b.max, 4.0, 1e-9);
CHECK_NEAR(b.spread, 4.0, 1e-9);

// One sample: everything is that sample, and the spread is exactly 1.
std::vector<double> one = {7.25};
Summary c = summarise(one);
CHECK_EQ(c.count, std::size_t{1});
CHECK_NEAR(c.median, 7.25, 1e-9);
CHECK_NEAR(c.mean, 7.25, 1e-9);
CHECK_NEAR(c.spread, 1.0, 1e-9);

// Empty: no crash, no division by zero, all zeroes.
std::vector<double> none;
Summary d = summarise(none);
CHECK_EQ(d.count, std::size_t{0});
CHECK_NEAR(d.min, 0.0, 1e-9);
CHECK_NEAR(d.max, 0.0, 1e-9);
CHECK_NEAR(d.median, 0.0, 1e-9);
CHECK_NEAR(d.mean, 0.0, 1e-9);
CHECK_NEAR(d.spread, 0.0, 1e-9);

// A single huge outlier drags the mean and leaves the median alone — the
// whole reason a benchmark reports both.
std::vector<double> outlier = {10.0, 10.0, 10.0, 10.0, 1000.0};
Summary e = summarise(outlier);
CHECK_NEAR(e.median, 10.0, 1e-9);
CHECK_NEAR(e.mean, 208.0, 1e-9);
CHECK_NEAR(e.min, 10.0, 1e-9);
```

## Hints
- Take the parameter as `const std::vector<double>&` and sort a **copy**. A benchmark harness that reorders the caller's samples destroys the run order, which is information — it is how you spot a warm-up effect.
- Handle the empty case first and return the default-constructed `Summary`. Every other line then gets to assume at least one element.
- After sorting the copy, `min` is `front()` and `max` is `back()`. Do not assume the input arrived sorted; the first check passes unsorted data for exactly that reason.
- Median for size `n`: if `n` is odd, `sorted[n / 2]`; if even, the average of `sorted[n / 2 - 1]` and `sorted[n / 2]`.
- `std::accumulate` from `<numeric>` sums the samples. Give it a `0.0` starting value, not `0` — an `int` seed makes the whole accumulation integer.
- `std::sort` is in `<algorithm>`.

## Solution
```cpp
#include <algorithm>
#include <cstddef>
#include <numeric>
#include <vector>

struct Summary {
    std::size_t count = 0;
    double min = 0.0;
    double max = 0.0;
    double median = 0.0;
    double mean = 0.0;
    double spread = 0.0;
};

Summary summarise(const std::vector<double>& samples) {
    Summary s;
    if (samples.empty()) return s;

    std::vector<double> sorted = samples;
    std::sort(sorted.begin(), sorted.end());

    const std::size_t n = sorted.size();
    s.count  = n;
    s.min    = sorted.front();
    s.max    = sorted.back();
    s.median = (n % 2 == 1) ? sorted[n / 2]
                            : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
    s.mean   = std::accumulate(sorted.begin(), sorted.end(), 0.0) / static_cast<double>(n);
    s.spread = s.max / s.min;
    return s;
}
```

## Notes
The last check is the one this exercise exists for. Four samples of 10 and one
of 1000 — one scheduling hiccup in five runs — give a median of 10 and a mean of
208. Report the mean and you have told your reader the operation costs twenty
times what it costs.

That asymmetry is not a quirk of the example. Interference from the rest of the
machine is one-sided: a context switch, a page fault, or a frequency drop can
only add time to a run, never remove it. So the distribution has a hard floor at
the true cost and a long tail above it, and the statistics that ignore the tail —
the minimum and the median — are the ones that describe your code rather than
your machine.

`spread` earns its place as a red flag rather than a result. A spread near 1
means the samples agree and the number is trustworthy. A spread of 3 means
something else was happening on the machine, and the honest response is to find
out what and measure again, not to average it away.

Two details that are easy to get wrong and are worth the habit. Sorting a copy
keeps the caller's run order intact, which is what lets you notice that sample
one was slow and samples two through fifteen were not — a warm-up effect, not
noise. And `std::accumulate(first, last, 0)` with an integer seed accumulates in
`int`, silently truncating every sample; the `0.0` is load-bearing.
