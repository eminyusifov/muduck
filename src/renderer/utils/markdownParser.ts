import { Marked, Renderer, type TokenizerAndRendererExtension } from 'marked';
// ~35 common languages instead of all ~190: a fraction of the bundle
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import DOMPurify from 'dompurify';
import { TOCItem, DocStats } from '../types';

export interface RenderedDocument {
  html: string;
  toc: TOCItem[];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculateStats(markdownText: string): DocStats {
  const clean = markdownText.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~\[\]()]/g, '');
  const words = clean.trim().split(/\s+/).filter(Boolean).length;
  const chars = clean.length;
  const readTimeMinutes = Math.max(1, Math.ceil(words / 180));
  return { words, chars, readTimeMinutes };
}

// Languages tried for unlabeled code blocks (highlightAuto over all ~190 grammars is very slow).
const AUTO_LANGS = ['bash', 'shell', 'json', 'python', 'javascript', 'typescript', 'sql', 'yaml', 'xml', 'css', 'rust', 'go'];
const MAX_AUTO_HIGHLIGHT = 20000;

const CALLOUTS: Record<string, { cls: string; title: string }> = {
  note: { cls: 'callout-note', title: 'ℹ️ Note' },
  tip: { cls: 'callout-tip', title: '💡 Tip' },
  important: { cls: 'callout-warning', title: '⚡ Important' },
  warning: { cls: 'callout-warning', title: '⚠️ Warning' },
  caution: { cls: 'callout-danger', title: '🚨 Caution' },
};

const renderKatex = (formula: string, displayMode: boolean) => {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false });
  } catch {
    return `<code class="math-error">${escapeHtml(formula)}</code>`;
  }
};

// Math is tokenized by marked itself, so `$` inside code spans / fences is never touched.
const mathBlock: TokenizerAndRendererExtension = {
  name: 'mathBlock',
  level: 'block',
  start(src) {
    const m = /(^|\n)\$\$/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(src) {
    const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
    if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
    return undefined;
  },
  renderer(token) {
    return `<div class="math-block">${renderKatex(token.text, true)}</div>\n`;
  },
};

const mathInline: TokenizerAndRendererExtension = {
  name: 'mathInline',
  level: 'inline',
  start(src) {
    const i = src.indexOf('$');
    return i < 0 ? undefined : i;
  },
  tokenizer(src) {
    const display = /^\$\$([^$]+?)\$\$/.exec(src);
    if (display) return { type: 'mathInline', raw: display[0], text: display[1].trim(), display: true };
    // Pandoc rule: no space after the opening `$` or before the closing one, no digit right after it.
    // Keeps prices like "$5 and $10" as plain text.
    const inline = /^\$(?=\S)([^$\n]*?\S)\$(?!\d)/.exec(src);
    if (inline) return { type: 'mathInline', raw: inline[0], text: inline[1], display: false };
    return undefined;
  },
  renderer(token) {
    return renderKatex(token.text, !!token.display);
  },
};

// Per-render state shared by the renderer callbacks (rendering is synchronous).
let toc: TOCItem[] = [];
let usedIds = new Set<string>();

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Heading text for the outline/slug, taken from the rendered inline HTML
// (marked's own `raw` argument drops named entities: "Q&A" arrives as "QA").
const plainHeadingText = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();

const renderer = new Renderer();

renderer.heading = (text, level) => {
  const plain = plainHeadingText(text);
  const base = slugify(plain) || 'section';
  // "Foo", "Foo", "Foo 1" must not end up as foo, foo-1, foo-1
  let slug = base;
  for (let i = 1; usedIds.has(slug); i++) slug = `${base}-${i}`;
  usedIds.add(slug);
  if (level <= 4) toc.push({ id: slug, level, text: plain });

  // A heading that already contains a link can't be wrapped in another <a>.
  const inner = text.includes('<a ')
    ? text
    : `<a href="#${slug}" class="heading-anchor text-inherit no-underline hover:underline">${text}</a>`;
  return `<h${level} id="${slug}" class="group relative flex items-center">
      ${inner}
    </h${level}>\n`;
};

renderer.code = (code, language) => {
  const lang = (language || '').trim().split(/\s+/)[0].toLowerCase();
  const safeLang = lang.replace(/[^\w+#.-]/g, '');

  if (lang === 'mermaid') {
    return `<div class="mermaid-container" data-mermaid="${encodeURIComponent(code)}"><pre class="mermaid-source">${escapeHtml(code)}</pre></div>`;
  }

  let highlighted: string;
  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } else if (!lang && code.length <= MAX_AUTO_HIGHLIGHT) {
    highlighted = hljs.highlightAuto(code, AUTO_LANGS).value;
  } else {
    highlighted = escapeHtml(code);
  }

  const linesCount = code.split('\n').length;
  const isLong = linesCount > 20;
  const langBadge = safeLang ? safeLang.toUpperCase() : 'CODE';

  return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-semibold">${langBadge}</span>
            <span class="text-[10px] text-[var(--text-muted)] font-mono">${linesCount} lines</span>
          </div>
          <div class="flex items-center gap-2">
            ${isLong ? `
              <button class="code-toggle-btn text-[11px] px-1.5 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--accent-surface)] cursor-pointer" data-action="toggle-code">
                <span>Collapse</span>
              </button>
            ` : ''}
            <button class="code-copy-btn cursor-pointer" data-action="copy" data-code="${encodeURIComponent(code)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy</span>
            </button>
          </div>
        </div>
        <pre><code class="hljs language-${safeLang}">${highlighted}</code></pre>
      </div>
    `;
};

// GitHub-style `> [!NOTE]` callouts, detected on the already-rendered blockquote.
renderer.blockquote = (quote) => {
  const m = /^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|<br>)?/i.exec(quote);
  if (!m) return `<blockquote>\n${quote}</blockquote>\n`;
  const kind = CALLOUTS[m[1].toLowerCase()];
  const body = ('<p>' + quote.slice(m[0].length)).replace(/^<p>\s*<\/p>\s*/, '');
  return `<div class="callout ${kind.cls}"><div class="callout-title">${kind.title}</div><div class="callout-body">${body}</div></div>\n`;
};

renderer.table = (header, body) => {
  return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
};

// marked prepends the checkbox to the item text itself; only style it here.
renderer.checkbox = (checked) =>
  `<input type="checkbox" ${checked ? 'checked' : ''} disabled class="mt-1 rounded accent-blue-600" />`;

renderer.listitem = (text, task) => {
  if (task) {
    return `<li class="task-item flex items-start gap-2.5 my-1.5">${text}</li>\n`;
  }
  return `<li>${text}</li>\n`;
};

renderer.link = (href, title, text) => {
  const url = (href || '').trim();
  const safe = /^(javascript|vbscript|data):/i.test(url) ? '#' : url;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(safe)}"${titleAttr} class="text-[var(--accent-color)] hover:underline">${text}</a>`;
};

const md = new Marked({ gfm: true, breaks: false, renderer, extensions: [mathBlock, mathInline] });

const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'form'],
  // `name` can shadow document.createElement & co. and blank the whole app
  FORBID_ATTR: ['name'],
  // KaTeX's MathML wrapper; dropped by default, which leaves raw TeX as loose text
  ADD_TAGS: ['semantics', 'annotation'],
  // Heading ids like "title" or "images" must survive; DOM clobbering is moot with scripts stripped.
  SANITIZE_DOM: false,
};

export function renderMarkdown(markdown: string): RenderedDocument {
  toc = [];
  usedIds = new Set();
  if (!markdown) return { html: '', toc: [] };
  const raw = md.parse(markdown) as string;
  return { html: DOMPurify.sanitize(raw, PURIFY_CONFIG) as string, toc };
}
