import React from 'react';
import { 
  BookOpen, 
  Columns2, 
  PenLine, 
  Palette, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  PanelLeftClose, 
  PanelLeft, 
  FolderOpen, 
  Save, 
  Printer, 
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Theme, ViewMode, FontFamily, ContentWidth } from '../types';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '../utils/tauriBridge';
import { isMac, MOD } from '../utils/platform';

interface TitleBarProps {
  fileName: string;
  isDirty?: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  fontFamily: FontFamily;
  setFontFamily: (f: FontFamily) => void;
  contentWidth: ContentWidth;
  setContentWidth: (w: ContentWidth) => void;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  zenMode: boolean;
  setZenMode: (zen: boolean | ((prev: boolean) => boolean)) => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onExportPdf: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  fileName,
  isDirty,
  theme,
  setTheme,
  viewMode,
  setViewMode,
  fontFamily,
  setFontFamily,
  contentWidth,
  setContentWidth,
  zoom,
  setZoom,
  sidebarOpen,
  setSidebarOpen,
  searchOpen,
  setSearchOpen,
  zenMode,
  setZenMode,
  onOpenFile,
  onSaveFile,
  onExportPdf,
}) => {
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const [showTypeMenu, setShowTypeMenu] = React.useState(false);

  const themeNames: Record<Theme, { name: string; emoji: string; desc: string }> = {
    paper: { name: 'Editorial Paper', emoji: '📜', desc: 'Warm cream, serif, easy on eyes' },
    light: { name: 'Modern Light', emoji: '☀️', desc: 'Clean Apple / Linear minimal' },
    midnight: { name: 'Midnight Dark', emoji: '🌙', desc: 'Deep slate, soothing dark reader' },
    nord: { name: 'Nordic Frost', emoji: '🌲', desc: 'Arctic cool slate & cyan' },
    obsidian: { name: 'Obsidian OLED', emoji: '🖤', desc: 'Pure pitch black, high contrast' },
  };

  // Elements marked data-tauri-drag-region are handled by Tauri itself (drag + double-click
  // maximize); handling them here too would toggle maximize twice. These cover their children.
  const isPlainDragTarget = (target: HTMLElement) =>
    isTauri &&
    !target.hasAttribute('data-tauri-drag-region') &&
    !target.closest('button, input, [data-no-drag]');

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.detail === 1 && isPlainDragTarget(e.target as HTMLElement)) {
      getCurrentWindow().startDragging();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isPlainDragTarget(e.target as HTMLElement)) {
      getCurrentWindow().toggleMaximize();
    }
  };

  return (
    <header 
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="no-print h-12 select-none border-b border-[var(--border-color)] bg-[var(--bg-surface-subtle)] flex items-center justify-between px-3 relative z-30 transition-colors duration-200 cursor-default"
    >
      {/* Left side: macOS traffic lights padding + Sidebar Toggle + File info */}
      <div className={`flex items-center gap-2 ${isMac ? 'pl-[72px]' : ''}`} data-tauri-drag-region>
        <button
          title={`Toggle Table of Contents (${MOD}+T)`}
          onClick={() => setSidebarOpen(prev => !prev)}
          className="p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <button
          title={`Open File (${MOD}+O)`}
          onClick={onOpenFile}
          className="p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          <FolderOpen size={16} />
        </button>

        <button
          title={`Save File (${MOD}+S)`}
          onClick={onSaveFile}
          className="p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          <Save size={16} />
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />

        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-main)] max-w-[220px] truncate" data-tauri-drag-region>
          <span className="truncate">{fileName || 'Untitled.md'}</span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center: View Mode Switcher (Reader / Split / Edit) */}
      <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-color)] p-0.5 rounded-lg text-xs font-medium shadow-sm">
        <button
          onClick={() => setViewMode('reader')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            viewMode === 'reader'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          title="Reader Mode"
        >
          <BookOpen size={13} />
          <span>Read</span>
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            viewMode === 'split'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          title="Split View"
        >
          <Columns2 size={13} />
          <span>Split</span>
        </button>
        <button
          onClick={() => setViewMode('editor')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            viewMode === 'editor'
              ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
          title="Editor Mode"
        >
          <PenLine size={13} />
          <span>Edit</span>
        </button>
      </div>

      {/* Right side: Search, Theme, Typography & Zoom Controls, Export, Zen Mode */}
      <div className="flex items-center gap-1.5" data-tauri-drag-region>
        <button
          title={`Find in document (${MOD}+F)`}
          onClick={() => setSearchOpen(prev => !prev)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            searchOpen
              ? 'bg-[var(--accent-surface)] text-[var(--accent-color)]'
              : 'hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Search size={15} />
        </button>

        {/* Theme Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowThemeMenu(!showThemeMenu);
              setShowTypeMenu(false);
            }}
            title="Choose Theme"
            className="flex items-center gap-1 p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs transition-colors cursor-pointer"
          >
            <Palette size={15} />
            <span className="hidden sm:inline">{themeNames[theme].emoji}</span>
          </button>

          {showThemeMenu && (
            <div
              data-no-drag
              className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowThemeMenu(false)}
            >
              <div className="px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Reading Themes
              </div>
              {(Object.keys(themeNames) as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    setShowThemeMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer ${
                    theme === t
                      ? 'bg-[var(--accent-surface)] text-[var(--accent-color)] font-medium'
                      : 'hover:bg-[var(--bg-surface-subtle)] text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{themeNames[t].emoji}</span>
                    <div>
                      <div className="font-medium">{themeNames[t].name}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{themeNames[t].desc}</div>
                    </div>
                  </div>
                  {theme === t && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Typography Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowTypeMenu(!showTypeMenu);
              setShowThemeMenu(false);
            }}
            title="Typography & Layout Settings"
            className="flex items-center gap-1 p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs transition-colors cursor-pointer"
          >
            <Sparkles size={15} />
          </button>

          {showTypeMenu && (
            <div
              data-no-drag
              className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowTypeMenu(false)}
            >
              <div className="px-1 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Font Style
              </div>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {(['serif', 'sans', 'mono'] as FontFamily[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFontFamily(f)}
                    className={`px-2 py-1 text-xs rounded-md capitalize transition-colors cursor-pointer ${
                      fontFamily === f
                        ? 'bg-[var(--accent-surface)] text-[var(--accent-color)] font-semibold'
                        : 'hover:bg-[var(--bg-surface-subtle)] text-[var(--text-main)]'
                    }`}
                  >
                    {f === 'serif' ? 'Book' : f === 'sans' ? 'Modern' : 'Code'}
                  </button>
                ))}
              </div>

              <div className="px-1 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Reading Width
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['focused', 'wide', 'fluid'] as ContentWidth[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setContentWidth(w)}
                    className={`px-2 py-1 text-xs rounded-md capitalize transition-colors cursor-pointer ${
                      contentWidth === w
                        ? 'bg-[var(--accent-surface)] text-[var(--accent-color)] font-semibold'
                        : 'hover:bg-[var(--bg-surface-subtle)] text-[var(--text-main)]'
                    }`}
                  >
                    {w === 'focused' ? 'Book' : w === 'wide' ? 'Wide' : 'Full'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-md px-1 py-0.5 text-xs text-[var(--text-muted)]">
          <button
            title={`Zoom Out (${MOD} -)`}
            onClick={() => setZoom(prev => Math.max(0.75, Number((prev - 0.1).toFixed(2))))}
            className="p-1 hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            <ZoomOut size={13} />
          </button>
          <button
            title={`Reset Zoom (${MOD} 0)`}
            onClick={() => setZoom(1)}
            className="font-mono text-[11px] px-1 hover:text-[var(--text-main)] cursor-pointer"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            title={`Zoom In (${MOD} +)`}
            onClick={() => setZoom(prev => Math.min(1.8, Number((prev + 0.1).toFixed(2))))}
            className="p-1 hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* PDF Export */}
        <button
          title={`Export to PDF (${MOD}+P)`}
          onClick={onExportPdf}
          className="p-1.5 rounded-md hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          <Printer size={15} />
        </button>

        {/* Zen Mode Toggle */}
        <button
          title={`Zen Mode / Focus Mode (${MOD}+Shift+F)`}
          onClick={() => setZenMode(prev => !prev)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            zenMode
              ? 'bg-[var(--accent-surface)] text-[var(--accent-color)]'
              : 'hover:bg-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          {zenMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </header>
  );
};
