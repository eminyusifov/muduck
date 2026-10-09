import React, { useState, useEffect } from 'react';
import { 
  ListTree, 
  Clock, 
  FileText, 
  History, 
  Trash2
} from 'lucide-react';
import { TOCItem, DocStats } from '../types';
import { basename } from '../utils/platform';

interface OutlineSidebarProps {
  isOpen: boolean;
  toc: TOCItem[];
  activeHeadingId: string;
  stats: DocStats;
  recentFiles: string[];
  onSelectRecentFile: (filePath: string) => void;
  onRemoveRecentFile: (filePath: string) => void;
  onClearRecentFiles: () => void;
}

export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  toc,
  activeHeadingId,
  stats,
  recentFiles,
  onSelectRecentFile,
  onRemoveRecentFile,
  onClearRecentFiles,
}) => {
  const [activeTab, setActiveTab] = useState<'outline' | 'recent'>('outline');

  useEffect(() => {
    if (toc.length > 0) {
      setActiveTab('outline');
    }
  }, [toc]);

  if (!isOpen) return null;

  const handleHeadingClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="no-print w-64 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] flex flex-col h-full select-none text-xs transition-colors duration-200">
      <div className="flex border-b border-[var(--border-color)] p-1.5 gap-1">
        <button
          onClick={() => setActiveTab('outline')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'outline'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <ListTree size={13} />
          <span>Outline</span>
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'recent'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <History size={13} />
          <span>Recent</span>
        </button>
      </div>

      {activeTab === 'outline' ? (
        <div className="flex-1 overflow-y-auto flex flex-col p-2 space-y-3">
          <div className="p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                <span>Read Time</span>
              </span>
              <span className="font-semibold text-[var(--text-main)]">{stats.readTimeMinutes} min</span>
            </div>
            <div className="flex items-center justify-between text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <FileText size={12} />
                <span>Length</span>
              </span>
              <span className="font-medium text-[var(--text-main)]">
                {stats.words.toLocaleString()} words ({stats.chars.toLocaleString()} chars)
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-0.5">
            <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Table of Contents ({toc.length})
            </div>
            {toc.length === 0 ? (
              <div className="text-[var(--text-muted)] italic px-2 py-4 text-center">
                No headings detected.
              </div>
            ) : (
              toc.map((item) => {
                const isActive = activeHeadingId === item.id;
                const indentClass = 
                  item.level === 1 ? 'pl-2 font-semibold' :
                  item.level === 2 ? 'pl-4 font-medium' :
                  item.level === 3 ? 'pl-6 text-[11px]' : 'pl-8 text-[11px] text-[var(--text-muted)]';

                return (
                  <button
                    key={item.id}
                    onClick={() => handleHeadingClick(item.id)}
                    className={`w-full text-left py-1.5 px-2 rounded-md transition-all truncate block relative group ${indentClass} ${
                      isActive
                        ? 'bg-[var(--accent-surface)] text-[var(--accent-color)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-subtle)]'
                    }`}
                    title={item.text}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3.5 bg-[var(--accent-color)] rounded-r" />
                    )}
                    <span className="truncate block">{item.text}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Recent Documents ({recentFiles.length})
            </div>
            {recentFiles.length === 0 ? (
              <div className="text-[var(--text-muted)] italic px-2 py-4 text-center">
                No recent files yet.
              </div>
            ) : (
              recentFiles.map((fp) => {
                const fileName = basename(fp);
                return (
                  <div
                    key={fp}
                    className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-color)] transition-all cursor-pointer"
                    onClick={() => onSelectRecentFile(fp)}
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="font-medium text-[var(--text-main)] truncate">{fileName}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate" title={fp}>{fp}</div>
                    </div>
                    <button
                      title="Remove from history"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRecentFile(fp);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {recentFiles.length > 0 && (
            <button
              onClick={onClearRecentFiles}
              className="mt-3 w-full py-1.5 rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-400 transition-colors text-center text-xs"
            >
              Clear History
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
