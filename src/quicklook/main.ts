// Quick Look preview page. Loaded by the Finder preview extension
// (src-tauri/quicklook) from file://, so it is a classic IIFE script, not a module.
import '../renderer/index.css';
import { renderMarkdown } from '../renderer/utils/markdownParser';
import { renderMermaidDiagrams } from '../renderer/utils/mermaidRender';

declare global {
  interface Window {
    muduckRender: (markdown: string) => void;
    mermaid?: typeof import('mermaid').default;
  }
}

// Bigger documents are cut: Quick Look should open instantly, the app is there for the rest.
const MAX_CHARS = 1_000_000;

const dark = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = () => {
  document.body.className = `theme-${dark.matches ? 'midnight' : 'paper'}`;
};

let mermaidLoad: Promise<NonNullable<Window['mermaid']>> | null = null;
const loadMermaid = () =>
  (mermaidLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'mermaid.min.js';
    script.onload = () => (window.mermaid ? resolve(window.mermaid) : reject(new Error('mermaid missing')));
    script.onerror = () => reject(new Error('mermaid failed to load'));
    document.head.appendChild(script);
  }));

let lastMarkdown = '';

const render = () => {
  applyTheme();
  const article = document.getElementById('content')!;
  let md = lastMarkdown;
  const truncated = md.length > MAX_CHARS;
  if (truncated) md = md.slice(0, MAX_CHARS);
  article.innerHTML = renderMarkdown(md).html;
  if (truncated) {
    const note = document.createElement('p');
    note.className = 'ql-truncated';
    note.textContent = 'Preview truncated. Open in Muduck to see the whole document.';
    article.appendChild(note);
  }
  renderMermaidDiagrams(article, { isDark: dark.matches, fontFamily: 'serif', load: loadMermaid });
};

window.muduckRender = (markdown: string) => {
  lastMarkdown = markdown;
  render();
};

dark.addEventListener('change', () => {
  if (lastMarkdown) render();
});

// Copy / collapse buttons in code blocks, same data-action contract as the app viewer
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'copy' && btn.dataset.code !== undefined) {
    navigator.clipboard?.writeText(decodeURIComponent(btn.dataset.code)).catch(() => {});
  } else if (btn.dataset.action === 'toggle-code') {
    const pre = btn.closest('.code-block-wrapper')?.querySelector('pre');
    const label = btn.querySelector('span');
    if (pre && label) {
      const collapse = pre.style.display !== 'none';
      pre.style.display = collapse ? 'none' : 'block';
      label.innerText = collapse ? 'Expand' : 'Collapse';
    }
  }
});
