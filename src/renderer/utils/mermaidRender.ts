// Shared by the app viewer and the Quick Look preview page.

type Mermaid = typeof import('mermaid').default;

export interface MermaidOptions {
  isDark: boolean;
  fontFamily: string;
  /** How to get mermaid: a dynamic import in the app, a classic <script> in Quick Look. */
  load: () => Promise<Mermaid>;
  isCancelled?: () => boolean;
}

// Rendered diagrams survive re-parses: the HTML is rebuilt on every edit, the diagrams mostly aren't.
const cache = new Map<string, string>();
const CACHE_LIMIT = 100;
let seq = 0;

/**
 * Renders every `.mermaid-container[data-mermaid]` under `root`. Cached diagrams are
 * painted synchronously before this returns; the rest render one by one in the background.
 */
export function renderMermaidDiagrams(root: HTMLElement, opts: MermaidOptions): void {
  const cancelled = opts.isCancelled ?? (() => false);
  const keyOf = (code: string) => `${opts.isDark}|${opts.fontFamily}|${code}`;
  const pending: { el: HTMLElement; code: string }[] = [];

  for (const el of Array.from(root.querySelectorAll<HTMLElement>('.mermaid-container'))) {
    const code = decodeURIComponent(el.dataset.mermaid || '');
    const cached = cache.get(keyOf(code));
    if (cached) el.innerHTML = cached;
    else if (code) pending.push({ el, code });
  }
  if (pending.length === 0) return;

  (async () => {
    const mermaid = await opts.load();
    if (cancelled()) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: opts.isDark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: opts.fontFamily === 'serif' ? 'Charter, Georgia, serif' : 'system-ui, sans-serif',
    });

    // mermaid.render is not safe to run concurrently
    for (const { el, code } of pending) {
      if (cancelled()) return;
      const id = `mermaid-svg-${++seq}`;
      try {
        const { svg } = await mermaid.render(id, code);
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
        cache.set(keyOf(code), svg);
        if (!cancelled()) el.innerHTML = svg;
      } catch (err) {
        // mermaid leaves its error graphic attached to <body>
        document.getElementById(`d${id}`)?.remove();
        document.getElementById(id)?.remove();
        if (!cancelled()) {
          const box = document.createElement('div');
          box.className = 'text-xs text-red-400 p-2 font-mono border border-red-500/20 rounded';
          box.textContent = `Diagram render error: ${(err as Error)?.message || 'Invalid syntax'}`;
          el.replaceChildren(box);
        }
      }
    }
  })();
}
