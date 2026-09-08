import type { CheckMode } from '../../build/types.ts';

/**
 * Assembles what actually goes to the compiler when a reader submits a
 * solution, and reads the results back out.
 *
 * The harness prints machine-readable lines prefixed with `[cpptb]` so the UI
 * can show a checklist instead of a wall of text. Those lines are filtered out
 * of the output the reader sees.
 */

const HARNESS = String.raw`// ---- checking harness (added automatically) ----
#include <cstdio>
#include <cmath>
#include <ostream>
#include <sstream>
#include <string>
#include <type_traits>

namespace cpptb {
inline int passed = 0;
inline int failed = 0;

template <class...> using void_t_ = void;
template <class T, class = void> struct streamable : std::false_type {};
template <class T>
struct streamable<T, void_t_<decltype(std::declval<std::ostream&>() << std::declval<const T&>())>>
    : std::true_type {};

template <class T> std::string show(const T& v) {
  if constexpr (streamable<T>::value) {
    std::ostringstream os;
    os << std::boolalpha << v;
    return os.str();
  } else {
    return "<value of a type with no operator<<>";
  }
}

inline void report(bool ok, int line, const char* expr, const std::string& got,
                   const std::string& want) {
  if (ok) { ++passed; std::printf("[cpptb] PASS %d %s\n", line, expr); return; }
  ++failed;
  std::printf("[cpptb] FAIL %d %s\n", line, expr);
  if (!want.empty()) {
    std::printf("[cpptb]   expected %s\n", want.c_str());
    std::printf("[cpptb]   actual   %s\n", got.c_str());
  }
}

inline void check_bool(bool cond, const char* expr, int line) {
  report(cond, line, expr, cond ? "true" : "false", "");
}

template <class A, class B>
void check_eq(const A& a, const B& b, const char* expr, int line) {
  report(a == b, line, expr, show(a), show(b));
}

template <class A, class B>
void check_near(const A& a, const B& b, double eps, const char* expr, int line) {
  report(std::fabs(double(a) - double(b)) <= eps, line, expr, show(a), show(b));
}

inline int finish() {
  std::printf("[cpptb] SUMMARY %d %d\n", passed, failed);
  return failed == 0 ? 0 : 1;
}
}  // namespace cpptb

// Variadic so that a braced initialiser inside the expression — Point{1, 2} —
// is not split into separate macro arguments by its comma.
#define CHECK(...) ::cpptb::check_bool(static_cast<bool>(__VA_ARGS__), #__VA_ARGS__, __LINE__)
#define CHECK_EQ(a, b) ::cpptb::check_eq((a), (b), #a " == " #b, __LINE__)
#define CHECK_NEAR(a, b, eps) ::cpptb::check_near((a), (b), (eps), #a " ~= " #b, __LINE__)
// ---- end harness ----
`;

/** The number of harness lines prepended, so reported line numbers can be fixed up. */
const HARNESS_LINES = HARNESS.split('\n').length - 1;

export interface Submission {
  source: string;
  /** Lines added above the reader's code, to translate compiler line numbers. */
  offset: number;
}

export function buildSubmission(
  userCode: string,
  tests: string,
  mode: CheckMode,
): Submission {
  if (mode === 'output') {
    return { source: userCode, offset: 0 };
  }
  const source = `${HARNESS}
#line 1 "your code"
${userCode}

int main() {
#line 1 "checks"
${tests}
  return ::cpptb::finish();
}
`;
  return { source, offset: HARNESS_LINES };
}

export interface CheckLine {
  ok: boolean;
  line: number;
  expr: string;
  expected?: string;
  actual?: string;
}

export interface CheckReport {
  checks: CheckLine[];
  passed: number;
  failed: number;
  /** Program output with the harness chatter removed. */
  output: string;
  /** True when the harness ran to completion with nothing failing. */
  allPassed: boolean;
}

export function parseCheckOutput(stdout: string): CheckReport {
  const checks: CheckLine[] = [];
  const plain: string[] = [];
  let passed = 0;
  let failed = 0;
  let sawSummary = false;

  for (const raw of stdout.split('\n')) {
    if (!raw.startsWith('[cpptb]')) {
      plain.push(raw);
      continue;
    }
    const body = raw.slice('[cpptb]'.length).trim();

    const summary = /^SUMMARY (\d+) (\d+)$/.exec(body);
    if (summary) {
      passed = Number(summary[1]);
      failed = Number(summary[2]);
      sawSummary = true;
      continue;
    }

    const result = /^(PASS|FAIL) (\d+) (.*)$/.exec(body);
    if (result) {
      checks.push({ ok: result[1] === 'PASS', line: Number(result[2]), expr: result[3] });
      continue;
    }

    const expected = /^expected (.*)$/.exec(body);
    if (expected && checks.length) {
      checks[checks.length - 1].expected = expected[1];
      continue;
    }
    const actual = /^actual\s+(.*)$/.exec(body);
    if (actual && checks.length) {
      checks[checks.length - 1].actual = actual[1];
    }
  }

  return {
    checks,
    passed,
    failed,
    output: plain.join('\n').replace(/\n+$/, ''),
    allPassed: sawSummary && failed === 0 && passed > 0,
  };
}

/** Compare program output against the expected text, ignoring trailing space. */
export function compareOutput(actual: string, expected: string): CheckReport {
  const norm = (s: string) =>
    s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
  const ok = norm(actual) === norm(expected);
  return {
    checks: [
      {
        ok,
        line: 0,
        expr: 'program output matches expected output',
        expected: norm(expected),
        actual: norm(actual),
      },
    ],
    passed: ok ? 1 : 0,
    failed: ok ? 0 : 1,
    output: actual,
    allPassed: ok,
  };
}
