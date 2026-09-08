/**
 * Compiles every runnable code sample in the book.
 *
 * A sample marked `run` or `asm` must compile; one marked `expect-error` must
 * not. Samples with neither flag are illustrative fragments and are skipped.
 *
 *   node --experimental-strip-types scripts/verify-snippets.ts [chapter-slug]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileAndRun } from '../server/compile.ts';

interface Snippet {
  file: string;
  index: number;
  flags: Set<string>;
  standard: string;
  source: string;
}

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.name.endsWith('.md') && !path.includes('exercises')) files.push(path);
  }
  return files;
}

function extract(file: string, text: string): Snippet[] {
  const snippets: Snippet[] = [];
  const fence = /^```cpp([^\n]*)\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = fence.exec(text)) !== null) {
    index += 1;
    const info = match[1].trim();
    const flags = new Set(info.split(/\s+/).filter(Boolean));
    if (!flags.has('run') && !flags.has('asm')) continue;

    const std = /std=(\S+)/.exec(info)?.[1] ?? 'c++20';
    // `// [hidden]` lines are compiled but not shown to the reader.
    const source = match[2].replace(/\s*\/\/\s*\[hidden\]\s*$/gm, '');
    snippets.push({ file, index, flags, standard: std, source });
  }
  return snippets;
}

const only = process.argv[2];
const files = (await markdownFiles('content')).filter((f) => !only || f.includes(only));
let failures = 0;
let checked = 0;

for (const file of files.sort()) {
  const snippets = extract(file, await readFile(file, 'utf8'));
  for (const snippet of snippets) {
    checked += 1;
    const expectError = snippet.flags.has('expect-error');
    const expectUb = snippet.flags.has('expect-ub');
    const result = await compileAndRun({
      source: snippet.source,
      standard: snippet.standard,
      action: snippet.flags.has('asm') && !snippet.flags.has('run') ? 'asm' : 'run',
    });

    const label = `${snippet.file} #${snippet.index}`;

    if (expectError) {
      if (result.compiled) {
        failures += 1;
        console.log(`FAIL   ${label}: marked expect-error but it compiled`);
      } else {
        console.log(`  ok   ${label} (fails to compile, as intended)`);
      }
      continue;
    }

    if (!result.compiled) {
      failures += 1;
      console.log(`FAIL   ${label}: ${result.diagnostics.split('\n').slice(0, 3).join('\n         ')}`);
      continue;
    }

    // A sample marked expect-ub exists to be caught. If the sanitizers stay
    // quiet, the demonstration silently stopped demonstrating anything.
    if (expectUb) {
      if (result.stderr.trim()) {
        console.log(`  ok   ${label} (sanitizers catch it, as intended)`);
      } else {
        failures += 1;
        console.log(`FAIL   ${label}: marked expect-ub but nothing was reported`);
      }
      continue;
    }

    if (result.stderr.trim()) {
      failures += 1;
      console.log(`FAIL   ${label}: sanitizers reported ${result.stderr.split('\n')[0]}`);
      continue;
    }
    if (result.diagnostics.trim()) {
      console.log(`  warn ${label}: ${result.diagnostics.split('\n')[0]}`);
    }
    console.log(`  ok   ${label}`);
  }
}

console.log(
  failures === 0
    ? `\nAll ${checked} runnable samples behave as documented.`
    : `\n${failures} of ${checked} samples are wrong.`,
);
process.exit(failures === 0 ? 0 : 1);
