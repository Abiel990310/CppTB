/**
 * Talks to whichever compiler is available.
 *
 * Preference order:
 *   1. `/api/compile` on this origin — present when the site is served by
 *      `npm run dev` or `npm run serve`. Sanitizers are on, so runtime errors
 *      come back as real diagnostics.
 *   2. Compiler Explorer's public API — needs no server, so the statically
 *      hosted book still runs code. No sanitizers, and it is someone else's
 *      free service, so we keep requests small and infrequent.
 */

export type Action = 'run' | 'asm';

export interface CompileRequest {
  source: string;
  standard?: string;
  action?: Action;
  optimization?: string;
  stdin?: string;
}

export interface CompileResult {
  compiled: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  diagnostics: string;
  asm?: string;
  timedOut: boolean;
  durationMs: number;
  compiler: string;
  backend: 'local' | 'hosted';
}

/** The local compile endpoint, if this deployment has one. */
const LOCAL_ENDPOINT = `${import.meta.env.BASE_URL}api/compile`;

const GODBOLT = 'https://godbolt.org/api';
/** Compiler Explorer's id for a recent GCC. */
const GODBOLT_COMPILER = 'g142';

let localAvailable: boolean | null = null;

async function probeLocal(): Promise<boolean> {
  if (localAvailable !== null) return localAvailable;
  try {
    const res = await fetch(LOCAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'int main(){}', action: 'run' }),
      signal: AbortSignal.timeout(20_000),
    });
    localAvailable = res.ok;
  } catch {
    localAvailable = false;
  }
  return localAvailable;
}

async function compileLocal(req: CompileRequest): Promise<CompileResult> {
  const res = await fetch(LOCAL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Compile server returned ${res.status}`);
  }
  return { ...((await res.json()) as Omit<CompileResult, 'backend'>), backend: 'local' };
}

const joinText = (parts: unknown): string =>
  Array.isArray(parts)
    ? parts.map((p) => (p as { text?: string }).text ?? '').join('\n')
    : '';

async function compileHosted(req: CompileRequest): Promise<CompileResult> {
  const started = performance.now();
  const asmMode = req.action === 'asm';
  const standard = req.standard ?? 'c++20';
  const optimization = req.optimization ?? (asmMode ? '-O2' : '-O0');

  const body = {
    source: req.source,
    lang: 'c++',
    allowStoreCodeDebug: false,
    options: {
      userArguments: `-std=${standard} ${optimization} -Wall -Wextra`,
      executeParameters: { args: [], stdin: req.stdin ?? '' },
      compilerOptions: { executorRequest: !asmMode, skipAsm: !asmMode },
      filters: asmMode
        ? {
            binary: false,
            commentOnly: true,
            demangle: true,
            directives: true,
            intel: true,
            labels: true,
            trim: true,
            execute: false,
          }
        : { execute: true },
    },
  };

  const res = await fetch(`${GODBOLT}/compiler/${GODBOLT_COMPILER}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`Compiler Explorer returned ${res.status}`);

  const data = (await res.json()) as {
    code?: number;
    stdout?: unknown;
    stderr?: unknown;
    asm?: unknown;
    buildResult?: { code?: number; stderr?: unknown };
    didExecute?: boolean;
  };

  const buildCode = data.buildResult?.code ?? (asmMode ? data.code : 0) ?? 0;
  const diagnostics = joinText(data.buildResult?.stderr) || (asmMode ? joinText(data.stderr) : '');

  return {
    compiled: buildCode === 0,
    exitCode: data.code ?? null,
    stdout: joinText(data.stdout),
    stderr: asmMode ? '' : joinText(data.stderr),
    diagnostics,
    asm: asmMode ? joinText(data.asm) : undefined,
    timedOut: false,
    durationMs: Math.round(performance.now() - started),
    compiler: 'gcc 14.2 (Compiler Explorer)',
    backend: 'hosted',
  };
}

export async function compile(req: CompileRequest): Promise<CompileResult> {
  if (await probeLocal()) {
    try {
      return await compileLocal(req);
    } catch (error) {
      // A local server that is up but failing should not strand the reader.
      if (error instanceof Error && /429/.test(error.message)) throw error;
      return compileHosted(req);
    }
  }
  return compileHosted(req);
}

/** Which backend the next request will use, for the UI to label output. */
export async function currentBackend(): Promise<'local' | 'hosted'> {
  return (await probeLocal()) ? 'local' : 'hosted';
}
