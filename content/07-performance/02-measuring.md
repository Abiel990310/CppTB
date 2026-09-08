---
title: "Measuring, not guessing"
navTitle: "Measuring"
summary: >-
  Benchmarks that tell the truth.
objectives:
  - Write a microbenchmark that is not optimized away
  - Explain why timing one run tells you nothing
  - Profile a program and find where the time goes
status: complete
standard: c++20
requires: [what-the-compiler-does]
---

Almost every performance intuition you have is wrong, including the ones that
turn out to be right — because you did not know which was which until you
measured. The previous chapter showed the compiler deleting work you thought you
had written. This one is about not being fooled by your own stopwatch.

Start with a warning about this page. **The Run button compiles at `-O0` with
sanitizers on**, because the priority everywhere else in this book is catching
your mistakes, not timing your code. Sanitized `-O0` code runs roughly five
times slower than `-O2` and, crucially, *does not perform the optimisations this
chapter is about*. Every timing sample below will print honest numbers for what
it actually ran — they just will not be the numbers your release build produces.
The `-O2` figures quoted in the prose come from running the same programs
outside the browser. That gap is the first lesson, not a caveat about it.

## One number is not a measurement

```cpp run title="The same work, fifteen times"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <numeric>
#include <vector>

template <class T>
inline void keep(const T& value) {          // explained in the next section
    asm volatile("" : : "r,m"(value) : "memory");
}

int main() {
    std::vector<int> data(50'000);
    std::iota(data.begin(), data.end(), 0);

    std::vector<double> samples;
    for (int run = 0; run < 15; ++run) {
        auto start = std::chrono::steady_clock::now();
        long long total = 0;
        for (int x : data) total += x;
        auto end = std::chrono::steady_clock::now();
        keep(total);
        samples.push_back(std::chrono::duration<double, std::micro>(end - start).count());
    }

    std::vector<double> sorted = samples;
    std::sort(sorted.begin(), sorted.end());
    double mean = std::accumulate(samples.begin(), samples.end(), 0.0) / samples.size();

    std::printf("first run: %8.2f us\n", samples.front());
    std::printf("min:       %8.2f us\n", sorted.front());
    std::printf("median:    %8.2f us\n", sorted[sorted.size() / 2]);
    std::printf("mean:      %8.2f us\n", mean);
    std::printf("max:       %8.2f us\n", sorted.back());
    std::printf("max/min:   %8.2fx\n", sorted.back() / sorted.front());
}
```

Run it several times. Identical work, identical input, one process — and the
slowest sample is routinely 25% above the fastest, sometimes two or three times
it. Nothing about the program changed between samples. What changed was the
machine: another process got scheduled, the CPU changed frequency, a page was
faulted in, the cache was evicted.

Two consequences follow, and they are the whole of benchmarking hygiene.

**Repeat, and report a distribution.** A single timing is a sample from a noisy
process. Reporting it as "this takes 21 µs" is a claim you did not measure.

**Report the minimum, not the mean, for a microbenchmark.** This is
counterintuitive and it is correct. All the noise here is *additive* — the
machine can only make your code slower, never faster than it actually is. The
minimum is therefore the best estimate of the true cost, and the mean is the
true cost plus however much interference you happened to collect. The median is
a reasonable middle ground and is more robust when the workload itself varies.

:::pitfall
The **first** sample is usually the slowest, and it is often the one people
quote. On the first pass the data is not in cache, the pages may not be mapped,
and the branch predictor has no history. Discard a few warm-up runs before you
start recording — but only if the thing you are measuring will be warm in
production. If it will run once, on cold data, the first run *is* the
measurement.
:::

## Which clock

`<chrono>` offers three, and only one of them is right for this.

| Clock | Use it for |
|---|---|
| `std::chrono::steady_clock` | **measuring durations** — guaranteed never to go backwards |
| `std::chrono::system_clock` | wall-clock time, dates, timestamps in logs |
| `std::chrono::high_resolution_clock` | nothing; it is an alias for one of the others |

`system_clock` tracks civil time, so NTP can adjust it, and it can jump
backwards while your benchmark is running — producing a negative duration or a
suspiciously fast result. `high_resolution_clock` is permitted to be an alias
for `system_clock`, and on libstdc++ it is exactly that, so it inherits the
problem while sounding like the obvious choice. Use `steady_clock`.

## Your benchmark was deleted

Chapter 7.1 showed that a computation nothing reads does not survive. A
benchmark loop is precisely such a computation.

```cpp run title="Timing nothing at all"
#include <chrono>
#include <cstdio>

template <class T>
inline void keep(const T& value) {
    asm volatile("" : : "r,m"(value) : "memory");
}

long long sum_to(int n) {
    long long total = 0;
    for (int i = 0; i < n; ++i) total += i;
    return total;
}

int main() {
    volatile int opaque = 10000;      // hide the value from constant folding
    const int n = opaque;

    auto t0 = std::chrono::steady_clock::now();
    for (int r = 0; r < 2000; ++r) { long long s = sum_to(n); (void)s; }
    auto t1 = std::chrono::steady_clock::now();

    auto t2 = std::chrono::steady_clock::now();
    for (int r = 0; r < 2000; ++r) { long long s = sum_to(n); keep(s); }
    auto t3 = std::chrono::steady_clock::now();

    std::printf("result unused: %.3f ms\n",
                std::chrono::duration<double, std::milli>(t1 - t0).count());
    std::printf("result kept:   %.3f ms\n",
                std::chrono::duration<double, std::milli>(t3 - t2).count());
}
```

Press Run and the two numbers come out roughly equal — around 50 ms each,
because `-O0` does not delete anything. Compile the same file at `-O2` and it
prints:

```
result unused: 0.000 ms
result kept:   9.3 ms
```

The first loop is gone. `s` is never read, so `sum_to` has no observable effect,
so twenty million additions were deleted and the timer measured the distance
between two adjacent instructions.

`keep` is the standard defence, and it is worth understanding rather than
copying. `asm volatile("" : : "r,m"(value) : "memory")` is an empty piece of
inline assembly that claims to *use* `value` — in a register or in memory — and
to clobber memory. The compiler cannot see inside it, so it must materialise the
value and must not reorder memory operations across it, and it costs no
instructions because there are none. Google Benchmark spells the same trick
`benchmark::DoNotOptimize`.

The other half of the defence is the `volatile int opaque`. Without it, `n` is
the literal `10000`, so `sum_to(n)` folds to a constant at compile time and even
the kept version measures nothing. **Both** ends need blocking: the input, so the
work cannot be precomputed, and the output, so it cannot be discarded.

:::warning
The most common "fix" for a benchmark that reports zero is to compile it at
`-O0`. That produces numbers, and they are meaningless: you are measuring the
stack traffic of debug code that nobody will ever run. If your benchmark reports
zero at `-O2`, the benchmark is broken, not the optimiser.
:::

## Find the hotspot before you optimise anything

Knowing how to time a function is not the same as knowing which function to
time. The cheapest useful profiler is a scoped timer that adds up where the
program actually spent its wall clock.

```cpp run title="A profiler in twenty lines"
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

class Region {
public:
    explicit Region(const char* name) : name_(name), start_(clock_type::now()) {}
    ~Region() {
        auto elapsed = std::chrono::duration<double, std::milli>(clock_type::now() - start_);
        totals()[name_] += elapsed.count();
    }
    static std::map<std::string, double>& totals() {
        static std::map<std::string, double> t;
        return t;
    }

private:
    using clock_type = std::chrono::steady_clock;
    std::string name_;
    clock_type::time_point start_;
};

int main() {
    std::vector<int> scores;
    {
        Region r{"generate"};
        scores.reserve(8000);
        for (int i = 0; i < 8000; ++i) scores.push_back((i * 7919) % 100000);
    }
    {
        Region r{"sort"};
        std::sort(scores.begin(), scores.end());
    }
    std::string report;
    {
        Region r{"format"};
        for (int s : scores) report = report + std::to_string(s) + "\n";
    }
    long long checksum = 0;
    {
        Region r{"checksum"};
        for (char c : report) checksum += c;
    }

    std::printf("report: %zu bytes, checksum %lld\n", report.size(), checksum);
    double total = 0;
    for (const auto& [name, ms] : Region::totals()) total += ms;
    for (const auto& [name, ms] : Region::totals())
        std::printf("  %-10s %8.2f ms  %5.1f%%\n", name.c_str(), ms, 100.0 * ms / total);
}
```

Ask someone which line is slow and they will say the `std::sort`. It is the only
part with a name that sounds expensive, and it is `O(n log n)` on eight thousand
elements.

The measurement says `format` takes **97%** of the time and `sort` takes one or
two. The reason is `report = report + std::to_string(s) + "\n"`, which builds a
brand-new string containing everything so far, on every one of eight thousand
iterations — quadratic work, and 15,992 heap allocations. Changing it to
`report += std::to_string(s); report += '\n';` makes it linear, brings the
allocation count down to 12, and drops the region below `sort`.

The same shape holds at both optimisation levels, which is why this sample is
worth running here: `format` is 97–98% whether you press Run or compile at
`-O2`. Profiles are much more portable than timings.

:::tip
Amdahl's law, in one sentence: speeding up a part that takes fraction *p* of the
runtime can make the whole program at most `1/(1-p)` times faster. Making the
`sort` here infinitely fast — free, instantaneous — would improve total runtime
by about 2%. Making `format` linear improves it by about thirty times. This is
why "find the hotspot" is not advice about tooling; it is the difference between
work that matters and work that does not.
:::

## Real profilers

Instrumenting by hand tells you about the regions you thought to instrument. A
sampling profiler tells you about the ones you did not.

```
perf stat ./program            # cycles, instructions, cache misses, branch misses
perf record -g ./program       # sample the call stack ~1000×/second
perf report                    # browse the result, hottest first

valgrind --tool=callgrind ./program   # exact instruction counts, ~50× slower
```

A sampling profiler like `perf` interrupts the process periodically and records
where it was. It costs a few percent, needs no changes to your code, and finds
the function you never suspected — but it attributes time to whatever was on the
stack, so inlined functions can be reported under their caller. Callgrind
simulates the machine, so it counts everything exactly and is unaffected by
noise, at the price of running dozens of times slower and modelling a cache that
is not quite yours.

Build with `-O2 -g` for either. `-g` adds symbols without changing code
generation, so you get function names and line numbers from the binary you
actually ship.

## Check yourself

:::quiz
{
  "question": "Your microbenchmark reports 0.000 ms at `-O2` and 40 ms at `-O0`. What should you conclude?",
  "options": [
    { "text": "The benchmark is broken: the optimiser deleted the work because nothing observable depended on it", "correct": true, "why": "Fix it by blocking both ends — hide the input from constant folding and consume the result — not by dropping to `-O0`." },
    { "text": "The optimiser made the code infinitely fast", "why": "It made it non-existent. Look at the assembly and the loop is not there." },
    { "text": "`-O0` is the honest measurement and should be reported", "why": "It measures debug-mode stack traffic for code nobody runs. Both numbers are wrong; only one of them is fixable." },
    { "text": "The timer resolution is too coarse", "why": "`steady_clock` resolves nanoseconds on any machine that would run this. Forty milliseconds of work did not vanish into rounding." }
  ]
}
:::

:::quiz
{
  "question": "You have fifteen samples of the same operation. Which do you report, and why?",
  "options": [
    { "text": "The minimum, because interference from the rest of the machine can only add time, never subtract it", "correct": true, "why": "For a microbenchmark of fixed work, the fastest sample is the closest to the true cost. The median is the better choice when the workload itself varies between runs." },
    { "text": "The mean, because averaging cancels out noise", "why": "Averaging cancels *symmetric* noise. Scheduling and cache interference are one-sided: they only ever make a run slower, so the mean is biased upwards by however much you collected." },
    { "text": "The maximum, to be conservative", "why": "That reports the worst interference the machine happened to produce, which is a property of the machine that day, not of your code." },
    { "text": "The first, because later runs benefit from warm caches", "why": "Backwards — if the code will run warm in production, the first sample is the unrepresentative one." }
  ]
}
:::

## Practice

:::exercise count-the-allocations

:::exercise summarise-samples

:::recap
- A single timing is a sample from a noisy process. Repeat, and report a
  distribution.
- For a microbenchmark of fixed work, report the minimum: interference is
  one-sided, so the fastest run is the closest to the truth. The median is
  better when the work itself varies.
- Use `steady_clock`. `system_clock` can jump; `high_resolution_clock` is an
  alias for one of the other two.
- A benchmark whose result nobody reads gets deleted. Block both ends — hide the
  input from constant folding, consume the output with an empty `asm volatile`
  barrier — and never "fix" it by compiling at `-O0`.
- Profile before optimising. Amdahl's law bounds what any local improvement can
  buy you, and the bound is usually much smaller than it feels.
- Profiles are far more portable than timings: the 97% hotspot in this chapter's
  sample is 97% at every optimisation level.
:::
