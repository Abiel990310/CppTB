import { compile } from '../lib/compile-client.ts';
import { CodeEditor } from '../lib/editor.ts';
import { progress } from '../lib/progress.ts';
import {
  buildSubmission,
  parseCheckOutput,
  compareOutput,
  type CheckReport,
} from '../lib/harness.ts';

interface ExerciseData {
  id: string;
  title: string;
  difficulty: string;
  standard: string;
  check: 'unit' | 'output';
  stdin: string;
  promptHtml: string;
  starter: string;
  tests: string;
  hints: string[];
  solution: string;
  solutionNotesHtml: string;
}

const cache = new Map<string, Promise<ExerciseData>>();

function fetchExercise(id: string): Promise<ExerciseData> {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(`/data/exercises/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`No problem with id "${id}"`);
      return r.json() as Promise<ExerciseData>;
    });
    cache.set(id, pending);
  }
  return pending;
}

/**
 * `<cpp-exercise data-id="…">` — a problem with an editor and a grader.
 *
 * The reader's code is combined with the problem's checks (see lib/harness.ts)
 * and compiled. Failures come back as a list of assertions with the values that
 * did not match, rather than a wall of compiler output.
 */
export class CppExercise extends HTMLElement {
  private data!: ExerciseData;
  private editor!: CodeEditor;
  private results!: HTMLElement;
  private status!: HTMLElement;
  private busy = false;

  connectedCallback(): void {
    const id = this.dataset.id;
    if (!id) return;
    this.innerHTML = '<p class="exercise__loading">Loading problem…</p>';
    fetchExercise(id)
      .then((data) => {
        this.data = data;
        this.build();
      })
      .catch((error: Error) => {
        this.innerHTML = `<p class="exercise__loading">Could not load this problem: ${error.message}</p>`;
      });
  }

  private build(): void {
    const { data } = this;
    this.innerHTML = '';
    this.classList.add('exercise');
    if (progress.isSolved(data.id)) this.classList.add('is-solved');

    const head = document.createElement('div');
    head.className = 'exercise__head';
    head.innerHTML = `
      <div class="exercise__meta">
        <span class="exercise__badge exercise__badge--${data.difficulty}">${data.difficulty}</span>
        ${progress.isSolved(data.id) ? '<span class="exercise__solved">solved</span>' : ''}
      </div>
      ${this.dataset.standalone ? '' : `<h3 class="exercise__title"><a href="/practice/${data.id}/">${data.title}</a></h3>`}
      <div class="exercise__prompt">${data.promptHtml}</div>`;

    this.editor = new CodeEditor(progress.draft(data.id) ?? data.starter, { minRows: 10 });
    this.editor.onRunRequested(() => void this.check());
    this.editor.onValueChanged((value) => progress.saveDraft(data.id, value));

    const bar = document.createElement('div');
    bar.className = 'runner__bar';

    const checkBtn = document.createElement('button');
    checkBtn.className = 'runner__btn runner__btn--primary';
    checkBtn.type = 'button';
    checkBtn.textContent = 'Check my answer';
    checkBtn.addEventListener('click', () => void this.check());

    const resetBtn = document.createElement('button');
    resetBtn.className = 'runner__btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      this.editor.value = data.starter;
      this.results.hidden = true;
    });

    this.status = document.createElement('span');
    this.status.className = 'runner__status';

    const spacer = document.createElement('span');
    spacer.className = 'runner__spacer';
    bar.append(checkBtn, resetBtn, spacer, this.status);

    this.results = document.createElement('div');
    this.results.className = 'exercise__results';
    this.results.hidden = true;

    this.append(head, this.editor.root, bar, this.results, this.buildHelp());
  }

  private buildHelp(): HTMLElement {
    const { data } = this;
    const help = document.createElement('div');
    help.className = 'exercise__help';

    data.hints.forEach((hint, i) => {
      const details = document.createElement('details');
      details.className = 'hint';
      details.innerHTML = `<summary>Hint ${i + 1}</summary><div class="hint__body">${hint}</div>`;
      help.append(details);
    });

    if (data.solution) {
      const details = document.createElement('details');
      details.className = 'hint hint--solution';
      details.innerHTML =
        `<summary>Show a worked solution</summary>` +
        `<div class="hint__body"><pre class="solution"><code>${data.solution
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</code></pre>${data.solutionNotesHtml}</div>`;
      help.append(details);
    }
    return help;
  }

  private async check(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.status.textContent = 'Compiling…';
    this.status.classList.add('is-busy');
    this.results.hidden = false;
    this.results.innerHTML = '<div class="runner__spinner" role="status">Working…</div>';

    const { data } = this;
    const submission = buildSubmission(this.editor.value, data.tests, data.check);

    try {
      const result = await compile({
        source: submission.source,
        standard: data.standard,
        action: 'run',
        stdin: data.stdin,
      });

      if (!result.compiled) {
        this.showCompileError(result.diagnostics);
        return;
      }
      if (result.timedOut) {
        this.showMessage('bad', 'Timed out', 'Your program was still running when the limit ran out — most often an infinite loop.');
        return;
      }

      const report =
        data.check === 'output'
          ? compareOutput(result.stdout, data.tests)
          : parseCheckOutput(result.stdout);

      this.showReport(report, result.stderr);
    } catch (error) {
      this.showMessage('bad', 'Could not reach a compiler', error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      this.status.classList.remove('is-busy');
      this.status.textContent = '';
    }
  }

  private showCompileError(diagnostics: string): void {
    this.results.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel panel--error';
    panel.innerHTML =
      '<p class="panel__title">It does not compile yet</p>' +
      '<p class="panel__hint">Line numbers under <code>your code</code> are your own; lines under <code>checks</code> are in the hidden test.</p>';
    const pre = document.createElement('pre');
    pre.className = 'panel__body';
    pre.textContent = diagnostics;
    panel.append(pre);
    this.results.append(panel);
  }

  private showMessage(kind: string, title: string, body: string): void {
    this.results.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = `panel panel--${kind === 'bad' ? 'error' : 'out'}`;
    panel.innerHTML = `<p class="panel__title">${title}</p>`;
    const pre = document.createElement('pre');
    pre.className = 'panel__body';
    pre.textContent = body;
    panel.append(pre);
    this.results.append(panel);
  }

  private showReport(report: CheckReport, stderr: string): void {
    this.results.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = `verdict ${report.allPassed ? 'verdict--pass' : 'verdict--fail'}`;
    summary.innerHTML = report.allPassed
      ? `<strong>All ${report.passed} checks passed.</strong> <span>Nicely done.</span>`
      : `<strong>${report.failed} of ${report.passed + report.failed} checks failed.</strong> <span>The failing ones are below.</span>`;
    this.results.append(summary);

    if (report.checks.length) {
      const list = document.createElement('ul');
      list.className = 'checks';
      for (const check of report.checks) {
        const item = document.createElement('li');
        item.className = `check ${check.ok ? 'check--pass' : 'check--fail'}`;
        const detail =
          !check.ok && check.expected !== undefined
            ? `<div class="check__detail"><span>expected</span><code>${escape(check.expected)}</code><span>actual</span><code>${escape(check.actual ?? '')}</code></div>`
            : '';
        item.innerHTML = `<code class="check__expr">${escape(check.expr)}</code>${detail}`;
        list.append(item);
      }
      this.results.append(list);
    }

    if (report.output.trim()) {
      const out = document.createElement('div');
      out.className = 'panel panel--out';
      out.innerHTML = '<p class="panel__title">Your program also printed</p>';
      const pre = document.createElement('pre');
      pre.className = 'panel__body';
      pre.textContent = report.output;
      out.append(pre);
      this.results.append(out);
    }

    if (stderr.trim()) {
      const err = document.createElement('div');
      err.className = 'panel panel--error';
      err.innerHTML = '<p class="panel__title">The sanitizers reported this</p>';
      const pre = document.createElement('pre');
      pre.className = 'panel__body';
      pre.textContent = stderr;
      err.append(pre);
      this.results.append(err);
    }

    if (report.allPassed && !stderr.trim()) {
      progress.markSolved(this.data.id);
      this.classList.add('is-solved');
    }
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
