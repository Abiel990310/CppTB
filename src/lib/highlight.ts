/**
 * A small C++ tokenizer for text the reader types.
 *
 * Chapter prose is highlighted at build time by Shiki, which is far more
 * accurate. This exists for the live editor and the assembly panel, where the
 * text changes as you type and a 2 MB grammar engine would not pay for itself.
 */

const KEYWORDS = new Set(
  `alignas alignof and asm auto bitand bitor bool break case catch char char8_t char16_t
   char32_t class co_await co_return co_yield compl concept const consteval constexpr
   constinit const_cast continue decltype default delete do double dynamic_cast else enum
   explicit export extern false float for friend goto if inline int long mutable namespace
   new noexcept not nullptr operator or private protected public register reinterpret_cast
   requires return short signed sizeof static static_assert static_cast struct switch
   template this thread_local throw true try typedef typeid typename union unsigned using
   virtual void volatile wchar_t while xor`.split(/\s+/),
);

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const span = (cls: string, text: string): string => `<span class="t-${cls}">${escapeHtml(text)}</span>`;

/** Ordered: the first pattern that matches at the cursor wins. */
const RULES: ReadonlyArray<{ re: RegExp; cls: string | null }> = [
  { re: /^\/\/[^\n]*/, cls: 'comment' },
  { re: /^\/\*[\s\S]*?(?:\*\/|$)/, cls: 'comment' },
  { re: /^#[ \t]*[a-z_]+/, cls: 'preproc' },
  { re: /^R"([^(]*)\([\s\S]*?\)\1"/, cls: 'string' },
  { re: /^"(?:[^"\\\n]|\\.)*"?/, cls: 'string' },
  { re: /^'(?:[^'\\\n]|\\.)*'?/, cls: 'string' },
  { re: /^\b\d[\d'a-zA-Z.+-]*\b/, cls: 'number' },
  { re: /^[A-Za-z_]\w*(?=\s*\()/, cls: 'fn' },
  { re: /^[A-Za-z_]\w*/, cls: null }, // resolved below: keyword, type, or plain
  { re: /^[{}()[\]<>;,.:?~!%^&*+\-/=|]+/, cls: 'punct' },
  { re: /^\s+/, cls: null },
];

export function highlightCpp(code: string): string {
  let out = '';
  let rest = code;

  while (rest.length > 0) {
    let matched = false;

    for (const rule of RULES) {
      const m = rule.re.exec(rest);
      if (!m || m[0].length === 0) continue;
      const text = m[0];

      if (rule.cls) {
        out += span(rule.cls, text);
      } else if (/^[A-Za-z_]/.test(text)) {
        if (KEYWORDS.has(text)) out += span('kw', text);
        else if (text.startsWith('std') || /^[A-Z]/.test(text)) out += span('type', text);
        else out += escapeHtml(text);
      } else {
        out += escapeHtml(text);
      }

      rest = rest.slice(text.length);
      matched = true;
      break;
    }

    if (!matched) {
      out += escapeHtml(rest[0]);
      rest = rest.slice(1);
    }
  }
  return out;
}

/** Assembly is simple enough to colour with three passes. */
export function highlightAsm(asm: string): string {
  return asm
    .split('\n')
    .map((line) => {
      const comment = line.indexOf('#');
      const code = comment === -1 ? line : line.slice(0, comment);
      const trailing = comment === -1 ? '' : span('comment', line.slice(comment));

      const body = escapeHtml(code)
        .replace(/^([\w.$@]+:)/, '<span class="t-label">$1</span>')
        .replace(/^(\s+)([a-z][a-z0-9.]*)/, '$1<span class="t-kw">$2</span>')
        .replace(/\b(rax|rbx|rcx|rdx|rsi|rdi|rsp|rbp|r8|r9|r1[0-5]|e[a-z]{2}|[a-d][lh]|xmm\d+)\b/g,
          '<span class="t-reg">$1</span>')
        .replace(/\b(0x[0-9a-f]+|\d+)\b/g, '<span class="t-number">$1</span>');

      return body + trailing;
    })
    .join('\n');
}
