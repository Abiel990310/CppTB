/**
 * Compiles every problem's starter and worked solution against its own checks.
 *
 * A solution that does not pass, or a starter that already passes, means the
 * problem is broken — so this runs in CI and before any content change lands.
 *
 *   node --experimental-strip-types scripts/verify-exercises.ts
 *   node --experimental-strip-types scripts/verify-exercises.ts trim-whitespace split-on-delimiter
 *
 * Naming ids checks only those, which is what you want while writing a chapter;
 * the unfiltered run is what CI does.
 */
import { loadBook } from '../build/content.ts';
import { compileAndRun } from '../server/compile.ts';
import { buildSubmission, parseCheckOutput, compareOutput } from '../src/lib/harness.ts';

const book = await loadBook(process.cwd());

const only = new Set(process.argv.slice(2));
const selected = only.size
  ? book.exercises.filter((e) => only.has(e.id))
  : book.exercises;

for (const id of only) {
  if (!book.exercises.some((e) => e.id === id)) {
    console.log(`FAIL   no problem with id "${id}"`);
    process.exit(1);
  }
}

let failures = 0;

for (const exercise of selected) {
  const attempt = async (code: string) => {
    const submission = buildSubmission(code, exercise.tests, exercise.check);
    const result = await compileAndRun({
      source: submission.source,
      standard: exercise.standard,
      action: 'run',
      stdin: exercise.stdin,
    });
    if (!result.compiled)
      return { ok: false, why: `did not compile: ${result.diagnostics.split('\n')[0]}` };
    if (result.timedOut) return { ok: false, why: 'timed out' };

    const report =
      exercise.check === 'output'
        ? compareOutput(result.stdout, exercise.tests)
        : parseCheckOutput(result.stdout);

    const sanitizer = result.stderr.trim();
    if (report.allPassed && sanitizer) {
      return {
        ok: false,
        why: `checks passed but the sanitizers complained: ${sanitizer.split('\n')[0]}`,
      };
    }
    return {
      ok: report.allPassed,
      why: report.failed
        ? `${report.failed} check(s) failed`
        : report.checks.length === 0
          ? 'produced no checks'
          : '',
    };
  };

  const solution = await attempt(exercise.solution);
  const starter = await attempt(exercise.starter);

  // A starter that already passes gives the reader nothing to do.
  if (solution.ok && !starter.ok) {
    console.log(`  ok   ${exercise.id}`);
  } else {
    failures += 1;
    console.log(`FAIL   ${exercise.id}`);
    if (!solution.ok) console.log(`         solution should pass but ${solution.why}`);
    if (starter.ok) console.log('         starter already passes — the problem is a no-op');
  }
}

console.log(
  failures === 0
    ? `\nAll ${selected.length} problems verified.`
    : `\n${failures} of ${selected.length} problems are broken.`,
);
process.exit(failures === 0 ? 0 : 1);
