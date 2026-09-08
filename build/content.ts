import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';
import { createRenderer } from './markdown.ts';
import type { Book, Chapter, CheckMode, Difficulty, Exercise, NavEntry, Part } from './types.ts';

export const CONTENT_DIR = 'content';

/** Directory and file names are `NN-slug`; the number only sets the order. */
function splitOrder(name: string): { order: number; slug: string } {
  const match = /^(\d+)[-_](.+)$/.exec(name);
  if (!match) return { order: 999, slug: name };
  return { order: Number(match[1]), slug: match[2] };
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : [];

/** Pull the body of the first fenced code block out of a Markdown section. */
function firstFence(section: string): string {
  const match = /```[a-z+]*\n([\s\S]*?)```/.exec(section);
  return match ? match[1].replace(/\n+$/, '') : '';
}

/** Split an exercise body on its `## Section` headings. */
function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = { prompt: '' };
  const parts = body.split(/^##\s+(.+?)\s*$/m);
  out.prompt = parts[0].trim();
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i].trim().toLowerCase()] = parts[i + 1].trim();
  }
  return out;
}

export async function loadBook(root: string): Promise<Book> {
  const render = await createRenderer();
  const contentRoot = join(root, CONTENT_DIR);

  const entries = await readdir(contentRoot, { withFileTypes: true });
  const partDirs = entries
    .filter((e) => e.isDirectory() && e.name !== 'exercises' && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, ...splitOrder(e.name) }))
    .sort((a, b) => a.order - b.order);

  const parts: Part[] = [];

  for (const dir of partDirs) {
    const partPath = join(contentRoot, dir.name);
    const files = (await readdir(partPath))
      .filter((f) => f.endsWith('.md') && f !== 'index.md')
      .map((f) => ({ file: f, ...splitOrder(basename(f, '.md')) }))
      .sort((a, b) => a.order - b.order);

    // A part's own metadata lives in its index.md.
    let partTitle = dir.slug;
    let partSummary = '';
    const indexPath = join(partPath, 'index.md');
    if (existsSync(indexPath)) {
      const meta = matter(await readFile(indexPath, 'utf8')).data;
      partTitle = String(meta.title ?? dir.slug);
      partSummary = String(meta.summary ?? '');
    }

    const chapters: Chapter[] = [];
    for (const f of files) {
      const raw = await readFile(join(partPath, f.file), 'utf8');
      const { data, content } = matter(raw);
      const { html, headings, exercises, text } = render(content);

      chapters.push({
        slug: String(data.slug ?? f.slug),
        partSlug: dir.slug,
        title: String(data.title ?? f.slug),
        navTitle: String(data.navTitle ?? data.title ?? f.slug),
        summary: String(data.summary ?? ''),
        objectives: asArray(data.objectives),
        requires: asArray(data.requires),
        standard: String(data.standard ?? 'c++20'),
        status: data.status === 'complete' ? 'complete' : 'draft',
        order: f.order,
        headings,
        exercises,
        words: text.split(/\s+/).filter(Boolean).length,
        html,
        text,
      });
    }

    parts.push({
      slug: dir.slug,
      title: partTitle,
      summary: partSummary,
      order: dir.order,
      chapters,
    });
  }

  const exercises = await loadExercises(contentRoot, render);
  return { title: 'The C++ Textbook', parts, exercises };
}

async function loadExercises(
  contentRoot: string,
  render: Awaited<ReturnType<typeof createRenderer>>,
): Promise<Exercise[]> {
  const dir = join(contentRoot, 'exercises');
  if (!existsSync(dir)) return [];

  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const out: Exercise[] = [];

  for (const file of files.sort()) {
    const { data, content } = matter(await readFile(join(dir, file), 'utf8'));
    const sections = splitSections(content);
    const difficulty = (['intro', 'core', 'stretch', 'deep'] as const).includes(
      data.difficulty as Difficulty,
    )
      ? (data.difficulty as Difficulty)
      : 'core';

    out.push({
      id: String(data.id ?? basename(file, '.md')),
      title: String(data.title ?? basename(file, '.md')),
      difficulty,
      chapter: String(data.chapter ?? ''),
      topics: asArray(data.topics),
      standard: String(data.standard ?? 'c++20'),
      check: (data.check === 'output' ? 'output' : 'unit') as CheckMode,
      stdin: String(data.stdin ?? ''),
      promptHtml: render(sections.prompt ?? '').html,
      starter: firstFence(sections.starter ?? ''),
      tests:
        data.check === 'output'
          ? (firstFence(sections.tests ?? '') || (sections.tests ?? '').trim())
          : firstFence(sections.tests ?? ''),
      hints: (sections.hints ?? '')
        .split(/^[-*]\s+/m)
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => render(h).html),
      solution: firstFence(sections.solution ?? ''),
      solutionNotesHtml: render(sections.notes ?? '').html,
    });
  }
  return out;
}

/** Flatten the book into the linear reading order used for prev/next links. */
export function toNav(book: Book): NavEntry[] {
  return book.parts.flatMap((part) =>
    part.chapters.map((ch) => ({
      slug: ch.slug,
      title: ch.title,
      part: part.title,
      url: `/${part.slug}/${ch.slug}/`,
    })),
  );
}
