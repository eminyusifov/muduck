import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  viewerRef: React.RefObject<HTMLDivElement>;
  /** Changes whenever the rendered document is replaced (highlights are wiped with it). */
  contentKey: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ isOpen, onClose, viewerRef, contentKey }) => {
  const [query, setQuery] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      clearHighlights();
    }
  }, [isOpen]);

  // A re-render of the document drops the <mark> nodes: search again in the new content
  useEffect(() => {
    if (isOpen && query) highlightMatches(query);
  }, [contentKey]);

  const clearHighlights = () => {
    if (!viewerRef.current) return;
    const marks = viewerRef.current.querySelectorAll('mark.search-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
    setTotalMatches(0);
    setCurrentMatch(0);
  };

  const highlightMatches = (searchTerm: string) => {
    clearHighlights();
    if (!searchTerm.trim() || !viewerRef.current) return;

    const walker = document.createTreeWalker(
      viewerRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToReplace: { node: Text; parent: Node }[] = [];
    let currentNode: Node | null = walker.nextNode();

    while (currentNode) {
      const parent = currentNode.parentNode;
      // Skip diagram SVG text, KaTeX's hidden MathML copy and code-block buttons
      if (parent && !(parent as Element).closest('svg, .katex-mathml, button, script, style')) {
        if (currentNode.textContent?.toLowerCase().includes(searchTerm.toLowerCase())) {
          nodesToReplace.push({ node: currentNode as Text, parent });
        }
      }
      currentNode = walker.nextNode();
    }

    let count = 0;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    nodesToReplace.forEach(({ node, parent }) => {
      const text = node.textContent || '';
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;

      text.replace(regex, (match, _g1, offset) => {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx, offset)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = match;
        mark.id = `search-match-${count}`;
        fragment.appendChild(mark);
        lastIdx = offset + match.length;
        count++;
        return match;
      });

      fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      parent.replaceChild(fragment, node);
    });

    setTotalMatches(count);
    if (count > 0) {
      setCurrentMatch(1);
      scrollToMatch(0);
    }
  };

  const scrollToMatch = (index: number) => {
    if (!viewerRef.current) return;
    // Remove active class from previous
    viewerRef.current.querySelectorAll('mark.search-highlight.active').forEach(m => m.classList.remove('active'));
    const el = document.getElementById(`search-match-${index}`);
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNext = () => {
    if (totalMatches === 0) return;
    const next = currentMatch >= totalMatches ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    scrollToMatch(next - 1);
  };

  const handlePrev = () => {
    if (totalMatches === 0) return;
    const prev = currentMatch <= 1 ? totalMatches : currentMatch - 1;
    setCurrentMatch(prev);
    scrollToMatch(prev - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="no-print absolute top-14 right-8 z-40 flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl px-3 py-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
      <Search size={14} className="text-[var(--text-muted)]" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in document..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          highlightMatches(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        className="w-48 bg-transparent outline-none text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
      />

      <span className="text-[11px] text-[var(--text-muted)] font-mono min-w-[3.5rem] text-right">
        {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : '0 results'}
      </span>

      <div className="h-4 w-[1px] bg-[var(--border-color)] mx-0.5" />

      <button
        onClick={handlePrev}
        disabled={totalMatches === 0}
        className="p-1 rounded hover:bg-[var(--bg-surface-subtle)] disabled:opacity-30 text-[var(--text-main)]"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp size={14} />
      </button>

      <button
        onClick={handleNext}
        disabled={totalMatches === 0}
        className="p-1 rounded hover:bg-[var(--bg-surface-subtle)] disabled:opacity-30 text-[var(--text-main)]"
        title="Next match (Enter)"
      >
        <ChevronDown size={14} />
      </button>

      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
        title="Close (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
};
