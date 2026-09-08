import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A local compile-and-run backend.
 *
 * SECURITY: this executes reader-supplied C++. The limits below (wall-clock
 * timeouts, address-space and file-size rlimits, a scratch directory per
 * request) stop honest mistakes — runaway loops, fork bombs, huge allocations —
 * but they are NOT a sandbox. Anything reachable by the process user is
 * reachable by the submitted program. Run this behind a container with no
 * network and a throwaway user (see docs/deployment.md), or point the client at
 * a hosted compiler instead.
 */

export type Action = 'run' | 'asm';

export interface CompileRequest {
  source: string;
  standard?: string;
  action?: Action;
  optimization?: string;
  stdin?: string;
  /**
   * Wall-clock budget for the program itself, in milliseconds. Clamped to the
   * server maximum — a judge problem may ask for less than the default so that
   * a solution of the wrong complexity fails the way it would on a real judge,
   * but nothing may ask for more.
   */
  timeLimitMs?: number;
}

export interface CompileResponse {
  compiled: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Compiler diagnostics, separate from the program's own stderr. */
  diagnostics: string;
  asm?: string;
  timedOut: boolean;
  durationMs: number;
  compiler: string;
}

/**
 * Sanitizer behaviour tuned for teaching: report and keep going where possible,
 * so the reader sees both the diagnosis and the program's output. Leak
 * detection stays on — a leak that changes the exit code is a lesson.
 */
const SANITIZER_ENV = {
  ASAN_OPTIONS: [
    'detect_leaks=1',
    'hard_rss_limit_mb=1024',
    'max_allocation_size_mb=512',
    'allocator_may_return_null=0',
    'log_path=stderr',
  ].join(':'),
  UBSAN_OPTIONS: ['print_stacktrace=1', 'halt_on_error=0'].join(':'),
};

const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 96 * 1024;
const COMPILE_TIMEOUT_MS = 15_000;
const RUN_TIMEOUT_MS = 6_000;

const ALLOWED_STANDARDS = new Set([
  'c++11', 'c++14', 'c++17', 'c++20', 'c++23', 'c++26',
]);
const ALLOWED_OPT = new Set(['-O0', '-O1', '-O2', '-O3', '-Os', '-Og']);

export const COMPILER = process.env.CPPTB_COMPILER ?? 'g++';

/** Rewrite scratch paths so diagnostics read as if the file were local. */
function tidyPaths(s: string, dir: string): string {
  return s.split(dir + '/').join('').split(dir).join('');
}

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  return `${s.slice(0, MAX_OUTPUT_BYTES)}\n… output truncated at ${MAX_OUTPUT_BYTES} bytes …`;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function run(
  cmd: string,
  args: readonly string[],
  opts: { cwd: string; timeoutMs: number; stdin?: string; env?: Record<string, string> },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: {
        PATH: process.env.PATH ?? '/usr/bin:/bin',
        HOME: opts.cwd,
        TMPDIR: opts.cwd,
        ...opts.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let size = 0;

    const cap = (chunk: Buffer, sink: 'out' | 'err') => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES * 2) {
        timedOut = false;
        child.kill('SIGKILL');
        return;
      }
      if (sink === 'out') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };

    child.stdout.on('data', (c: Buffer) => cap(c, 'out'));
    child.stderr.on('data', (c: Buffer) => cap(c, 'err'));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, opts.timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${err.message}`, timedOut });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: truncate(stdout), stderr: truncate(stderr), timedOut });
    });

    if (opts.stdin) child.stdin.write(opts.stdin);
    child.stdin.end();
  });
}

/** Drop assembler directives that carry no meaning for a reader. */
function cleanAssembly(asm: string, dir: string): string {
  const directiveNoise =
    /^\s*\.(file|ident|intel_syntax|section\s+\.note|cfi_\w+|size|type|globl|p2align|align|text|data|bss|addrsig\w*|weak|hidden|local|comm|zero|space)\b/;
  // Toolchain banner that -fverbose-asm prints before any real instruction.
  const bannerNoise = /^#\s*(GNU C|compiled by|GGC|options passed|options enabled|clang version)/;
  const internalLabel = /^(\.L(FB|FE|CFI)\d*|\d+):/;
  const dataDirective = /^\s*\.(long|quad|string|byte|value|uleb128|sleb128|asci[iz])\b/;

  // Everything from the GNU property note onward is linker metadata.
  const body = asm.split(/^\s*\.section\s+\.note/m)[0];

  return tidyPaths(body, dir)
    .split('\n')
    .filter(
      (line) =>
        line.trim() !== '' &&
        !directiveNoise.test(line) &&
        !bannerNoise.test(line) &&
        !internalLabel.test(line) &&
        !dataDirective.test(line),
    )
    .join('\n');
}

export async function compileAndRun(req: CompileRequest): Promise<CompileResponse> {
  const started = Date.now();
  const source = req.source ?? '';

  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw Object.assign(new Error('Source exceeds 64 KB'), { status: 413 });
  }

  const standard = ALLOWED_STANDARDS.has(req.standard ?? '') ? req.standard! : 'c++20';
  const action: Action = req.action === 'asm' ? 'asm' : 'run';
  const opt = ALLOWED_OPT.has(req.optimization ?? '')
    ? req.optimization!
    : action === 'asm'
      ? '-O2'
      : '-O0';

  // A problem may ask for a shorter budget than the default; never a longer one.
  const requested = Number(req.timeLimitMs ?? 0);
  const runTimeout =
    requested > 0 ? Math.min(requested, RUN_TIMEOUT_MS) : RUN_TIMEOUT_MS;

  const dir = await mkdtemp(join(tmpdir(), 'cpptb-'));
  try {
    const src = join(dir, 'main.cpp');
    await writeFile(src, source, 'utf8');

    const common = [
      `-std=${standard}`,
      opt,
      '-Wall',
      '-Wextra',
      '-pedantic',
      // Catch the mistakes a learner actually makes, at run time.
      ...(action === 'run' ? ['-fsanitize=address,undefined', '-fno-omit-frame-pointer', '-g'] : []),
    ];

    if (action === 'asm') {
      const out = join(dir, 'main.s');
      const compile = await run(
        COMPILER,
        [...common, '-S', '-masm=intel', '-fno-asynchronous-unwind-tables', '-fverbose-asm', '-o', out, src],
        { cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS },
      );
      const asm = compile.code === 0 ? cleanAssembly(await readFile(out, 'utf8'), dir) : '';
      return {
        compiled: compile.code === 0,
        exitCode: compile.code,
        stdout: '',
        stderr: '',
        diagnostics: tidyPaths(compile.stderr, dir),
        asm,
        timedOut: compile.timedOut,
        durationMs: Date.now() - started,
        compiler: COMPILER,
      };
    }

    const exe = join(dir, 'program');
    const compile = await run(COMPILER, [...common, '-o', exe, src], {
      cwd: dir,
      timeoutMs: COMPILE_TIMEOUT_MS,
    });

    if (compile.code !== 0) {
      return {
        compiled: false,
        exitCode: compile.code,
        stdout: '',
        stderr: '',
        diagnostics: compile.timedOut ? 'Compilation timed out.' : tidyPaths(compile.stderr, dir),
        timedOut: compile.timedOut,
        durationMs: Date.now() - started,
        compiler: COMPILER,
      };
    }

    // rlimits: 1 GB address space (ASan reserves a lot), 8 MB files, no core dumps.
    const exec = await run(
      '/bin/sh',
      // No `ulimit -v`: AddressSanitizer maps terabytes of shadow memory at
      // startup and refuses to run under an address-space cap. Memory is
      // bounded by the sanitizer's own RSS limit instead.
      ['-c', `ulimit -f 8192; ulimit -c 0; exec "${exe}"`],
      {
        cwd: dir,
        timeoutMs: runTimeout,
        stdin: req.stdin,
        env: {
          ASAN_OPTIONS: SANITIZER_ENV.ASAN_OPTIONS,
          UBSAN_OPTIONS: SANITIZER_ENV.UBSAN_OPTIONS,
        },
      },
    );

    return {
      compiled: true,
      exitCode: exec.code,
      stdout: exec.stdout,
      stderr: tidyPaths(exec.stderr, dir),
      diagnostics: tidyPaths(compile.stderr, dir),
      timedOut: exec.timedOut,
      durationMs: Date.now() - started,
      compiler: COMPILER,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Crude per-client budget so one tab cannot occupy the machine. */
const budgets = new Map<string, { tokens: number; last: number }>();
const RATE_CAPACITY = 12;
const RATE_REFILL_PER_MS = 12 / 60_000;

export function takeToken(client: string): boolean {
  const now = Date.now();
  const entry = budgets.get(client) ?? { tokens: RATE_CAPACITY, last: now };
  entry.tokens = Math.min(RATE_CAPACITY, entry.tokens + (now - entry.last) * RATE_REFILL_PER_MS);
  entry.last = now;
  if (entry.tokens < 1) {
    budgets.set(client, entry);
    return false;
  }
  entry.tokens -= 1;
  budgets.set(client, entry);
  return true;
}
