import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { FontFamily, ContentWidth, Theme } from '../types';
import { renderMermaidDiagrams } from '../utils/mermaidRender';

interface MarkdownViewerProps {
  html: string;
  theme: Theme;
  fontFamily: FontFamily;
  contentWidth: ContentWidth;
  zoom: number;
  onActiveHeadingChange?: (id: string) => void;
  onLinkClick?: (href: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const COPY_DONE_HTML = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  <span style="color:#10b981">Copied!</span>
`;

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  html,
  theme,
  fontFamily,
  contentWidth,
  zoom,
  onActiveHeadingChange,
  onLinkClick,
  scrollRef,
  onScroll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Copy / collapse buttons and links, via delegation (no inline handlers in the sanitized HTML)
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    const actionBtn = target.closest<HTMLButtonElement>('button[data-action]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'copy' && actionBtn.dataset.code !== undefined) {
        navigator.clipboard.writeText(decodeURIComponent(actionBtn.dataset.code));
        if (!actionBtn.dataset.copied) {
          actionBtn.dataset.copied = '1';
          const originalHtml = actionBtn.innerHTML;
          actionBtn.innerHTML = COPY_DONE_HTML;
          setTimeout(() => {
            actionBtn.innerHTML = originalHtml;
            delete actionBtn.dataset.copied;
          }, 1800);
        }
      } else if (actionBtn.dataset.action === 'toggle-code') {
        const pre = actionBtn.closest('.code-block-wrapper')?.querySelector('pre');
        const label = actionBtn.querySelector('span');
        if (pre && label) {
          const collapse = pre.style.display !== 'none';
          pre.style.display = collapse ? 'none' : 'block';
          label.innerText = collapse ? 'Expand' : 'Collapse';
        }
      }
      return;
    }

    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    e.preventDefault();
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      if (id) containerRef.current?.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Never let the webview itself navigate away from the app.
    onLinkClick?.(href);
  };

  // Mermaid: paint cached diagrams before the browser paints, so unchanged diagrams don't flicker
  useLayoutEffect(() => {
    const isDark = theme === 'midnight' || theme === 'nord' || theme === 'obsidian';
    const root = containerRef.current;
    if (!root) return;
    let cancelled = false;
    renderMermaidDiagrams(root, {
      isDark,
      fontFamily,
      // Loaded on first use: mermaid is most of the bundle and most documents have no diagrams
      load: () => import('mermaid').then((m) => m.default),
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [html, theme, fontFamily]);

  // Scrollspy for active heading
  useEffect(() => {
    const target = scrollRef?.current || containerRef.current;
    if (!target || !onActiveHeadingChange) return;

    const handleScroll = () => {
      const headings = target.querySelectorAll('h1, h2, h3, h4');
      if (headings.length === 0) return;

      const topOffset = target.scrollTop + 80;
      let currentId = '';

      headings.forEach((h) => {
        const top = (h as HTMLElement).offsetTop;
        if (top <= topOffset) {
          currentId = h.id;
        }
      });

      if (currentId) {
        onActiveHeadingChange(currentId);
      }
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [html, scrollRef, onActiveHeadingChange]);

  const fontClass =
    fontFamily === 'serif' ? 'font-serif' :
    fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  const widthClass =
    contentWidth === 'focused' ? 'max-w-3xl' :
    contentWidth === 'wide' ? 'max-w-5xl' : 'max-w-none';

  return (
    <div
      ref={scrollRef || containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto h-full px-6 py-8 md:px-12 bg-[var(--bg-app)] transition-colors duration-200"
    >
      <div
        className={`mx-auto transition-all duration-150 ${widthClass} ${fontClass}`}
        style={{ fontSize: `${zoom * 1.05}rem` }}
      >
        <article
          ref={containerRef}
          className="markdown-body prose prose-slate max-w-none leading-relaxed"
          style={{
            color: 'var(--text-main)',
            lineHeight: fontFamily === 'serif' ? '1.75' : '1.65',
          }}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};
