import React, { useRef } from 'react';
import { isMac, MOD } from '../utils/platform';

interface MarkdownEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  scrollRef?: React.RefObject<HTMLTextAreaElement>;
  onScroll?: (e: React.UIEvent<HTMLTextAreaElement>) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  scrollRef,
  onScroll,
}) => {
  const localRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const updated = val.substring(0, start) + '  ' + val.substring(end);
      onChange(updated);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      }, 0);
      return;
    }

    if (modifier && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapSelection(el, '**', '**');
      return;
    }

    if (modifier && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapSelection(el, '*', '*');
      return;
    }

    if (modifier && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      wrapSelection(el, '[', '](url)');
      return;
    }
  };

  const wrapSelection = (el: HTMLTextAreaElement, before: string, after: string) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selected = val.substring(start, end) || 'text';
    const updated = val.substring(0, start) + before + selected + after + val.substring(end);
    onChange(updated);
    setTimeout(() => {
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
      el.focus();
    }, 0);
  };

  const lines = content.split('\n').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-surface)] border-r border-[var(--border-color)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-muted)] select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-main)]">Markdown Source</span>
          <span>•</span>
          <span>{lines} lines</span>
        </div>
        <div className="text-[11px]">
          <span className="bg-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)] font-mono">{MOD}+S</span> to save
        </div>
      </div>

      <textarea
        ref={scrollRef || localRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={onScroll}
        spellCheck={false}
        placeholder="Type markdown content here..."
        className="flex-1 w-full p-4 md:p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed text-[var(--text-main)] selection:bg-[var(--accent-surface)]"
      />
    </div>
  );
};
