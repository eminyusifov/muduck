import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { TitleBar } from './components/TitleBar';
import { OutlineSidebar } from './components/OutlineSidebar';
import { MarkdownViewer } from './components/MarkdownViewer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { SearchBar } from './components/SearchBar';
import { DEFAULT_DOCUMENT } from './utils/defaultDocument';
import { renderMarkdown, calculateStats } from './utils/markdownParser';
import { Theme, ViewMode, FontFamily, ContentWidth } from './types';
import { tauriApi, isTauri, FileData } from './utils/tauriBridge';
import { isMac, basename, MOD } from './utils/platform';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CheckCircle2, RefreshCw, Minimize2 } from 'lucide-react';

const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd|mkdn|mdwn|txt)$/i;

export const App: React.FC = () => {
  // Document state
  const [content, setContent] = useState<string>(DEFAULT_DOCUMENT);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('Welcome.md');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Latest values for async callbacks (Tauri events, dialogs) that outlive a render
  const contentRef = useRef(content);
  const filePathRef = useRef(filePath);
  const fileNameRef = useRef(fileName);
  const isDirtyRef = useRef(isDirty);
  contentRef.current = content;
  filePathRef.current = filePath;
  fileNameRef.current = fileName;
  isDirtyRef.current = isDirty;

  // Appearance & Preferences
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('muduck-theme') as Theme) || 'paper';
  });
  const [fontFamily, setFontFamily] = useState<FontFamily>(() => {
    return (localStorage.getItem('muduck-font') as FontFamily) || 'serif';
  });
  const [contentWidth, setContentWidth] = useState<ContentWidth>(() => {
    return (localStorage.getItem('muduck-width') as ContentWidth) || 'focused';
  });
  const [zoom, setZoom] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('muduck-zoom') || '');
    return Number.isFinite(saved) ? saved : 1.0;
  });

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('reader');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' } | null>(null);

  const viewerScrollRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLTextAreaElement>(null);
  const scrollLock = useRef<{ pane: 'editor' | 'viewer'; until: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('muduck-theme', theme);
    document.body.className = `theme-${theme} select-text`;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('muduck-font', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('muduck-width', contentWidth);
  }, [contentWidth]);

  useEffect(() => {
    localStorage.setItem('muduck-zoom', zoom.toString());
  }, [zoom]);

  const showToast = (message: string, type: 'info' | 'success' = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const refreshRecentFiles = () => {
    tauriApi.getRecentFiles().then((f) => f && setRecentFiles(f));
  };

  /** Single entry point for showing a file that was read from disk. */
  const loadDocument = (file: FileData, toastMessage?: string) => {
    setContent(file.content);
    setFilePath(file.path);
    setFileName(file.name);
    setIsDirty(false);
    if (toastMessage) showToast(toastMessage);
    if (viewerScrollRef.current) viewerScrollRef.current.scrollTop = 0;
    if (editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
    refreshRecentFiles();
  };

  /** Asks before throwing away unsaved edits. */
  const confirmDiscard = async (): Promise<boolean> => {
    if (!isDirtyRef.current) return true;
    return tauriApi.confirm(`"${fileNameRef.current}" has unsaved changes. Discard them?`, 'Discard');
  };

  const openPath = async (path: string) => {
    if (!(await confirmDiscard())) return;
    try {
      const data = await tauriApi.readFile(path);
      loadDocument(data, `Opened ${data.name}`);
    } catch (err) {
      showToast(`Could not open file: ${err}`, 'info');
    }
  };

  // Load initial file & setup listeners
  useEffect(() => {
    if (!isTauri) return;

    tauriApi.getInitialFile().then((file) => {
      if (file) loadDocument(file);
    });
    refreshRecentFiles();

    // Files opened via macOS Finder / a second launch on Windows while the app is running.
    // The backend leaves its watcher on the current file until the switch is accepted.
    const cleanupOpen = tauriApi.onOpenFile(async (file) => {
      if (await confirmDiscard()) {
        loadDocument(file, `Opened ${file.name}`);
        tauriApi.watchFile(file.path);
      }
    });

    // Background updates (an AI tool rewriting the open file)
    const cleanupChanged = tauriApi.onFileChanged((data) => {
      if (data.path !== filePathRef.current || data.content === contentRef.current) return;
      if (isDirtyRef.current) {
        showToast('File changed on disk. Your unsaved edits were kept', 'info');
        return;
      }
      setContent(data.content);
      showToast('⚡ Updated externally', 'info');
    });

    let disposed = false;
    const unlisteners: (() => void)[] = [];
    const keep = (fn: () => void) => (disposed ? fn() : unlisteners.push(fn));

    // Native drag & drop
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'drop' && event.payload.paths?.length) {
          openPath(event.payload.paths[0]);
        }
      })
      .then(keep)
      .catch((e) => console.warn('onDragDropEvent init error:', e));

    // Don't lose unsaved edits when the window is closed
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (isDirtyRef.current && !(await tauriApi.confirm(`"${fileNameRef.current}" has unsaved changes. Close anyway?`, 'Close'))) {
          event.preventDefault();
        }
      })
      .then(keep)
      .catch((e) => console.warn('onCloseRequested init error:', e));

    return () => {
      disposed = true;
      cleanupOpen();
      cleanupChanged();
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
        return;
      }

      if (!modifier) return;

      if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setZenMode(prev => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleExportPdf();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom((prev) => Math.min(1.8, Number((prev + 0.1).toFixed(2))));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((prev) => Math.max(0.75, Number((prev - 0.1).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, filePath, fileName, zenMode]);

  // Fallback web drag & drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isTauri && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setContent(event.target.result as string);
          setFileName(file.name);
          setFilePath(null);
          setIsDirty(false);
        }
      };
      reader.readAsText(file);
    }
  };

  // Synchronized scroll in split view. Only the echo from the pane we just moved is ignored,
  // never the pane the user is actually scrolling.
  const syncScroll = (
    from: 'editor' | 'viewer',
    source: HTMLElement,
    target: HTMLElement | null,
  ) => {
    if (viewMode !== 'split' || !target) return;
    const lock = scrollLock.current;
    if (lock && lock.pane === from && performance.now() < lock.until) return;
    const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight || 1);
    scrollLock.current = { pane: from === 'editor' ? 'viewer' : 'editor', until: performance.now() + 80 };
    target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) =>
    syncScroll('editor', e.currentTarget, viewerScrollRef.current);

  const handleViewerScroll = (e: React.UIEvent<HTMLDivElement>) =>
    syncScroll('viewer', e.currentTarget, editorScrollRef.current);

  // Actions
  const handleOpenFile = async () => {
    if (!isTauri || !(await confirmDiscard())) return;
    const file = await tauriApi.openFileDialog();
    if (file) loadDocument(file, `Opened ${file.name}`);
  };

  const handleSaveFile = async () => {
    if (!isTauri) return;
    const savedContent = content;
    const savedPath = filePath
      ? await tauriApi.saveFile(filePath, savedContent)
      : await tauriApi.saveFileDialog(fileName, savedContent);
    if (!savedPath) {
      if (filePath) showToast('Could not save the file', 'info');
      return;
    }
    setFilePath(savedPath);
    setFileName(basename(savedPath));
    // Edits typed while the save was in flight are still unsaved
    setIsDirty(contentRef.current !== savedContent);
    showToast('Saved successfully', 'success');
    refreshRecentFiles();
  };

  const handleExportPdf = async () => {
    await tauriApi.exportPdf();
  };

  const handleSelectRecentFile = (selectedPath: string) => {
    if (isTauri) openPath(selectedPath);
  };

  // Links inside the document: web links go to the browser, relative Markdown links open here
  const handleLinkClick = (href: string) => {
    if (/^(https?:|mailto:)/i.test(href)) {
      tauriApi.openExternal(href);
      return;
    }
    const current = filePathRef.current;
    // Other URL schemes are ignored; "C:\..." is a Windows path, not a scheme
    const isOtherScheme = /^[a-z][a-z\d+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href);
    if (!isTauri || !current || isOtherScheme) return;
    let target = href.split(/[?#]/)[0];
    try {
      target = decodeURI(target);
    } catch {
      return;
    }
    if (!MARKDOWN_EXT.test(target)) return;
    const sep = current.includes('\\') ? '\\' : '/';
    const isAbsolute = target.startsWith('/') || /^[a-z]:[\\/]/i.test(target);
    const dir = current.slice(0, Math.max(current.lastIndexOf('/'), current.lastIndexOf('\\')));
    openPath(isAbsolute ? target : `${dir}${sep}${target.replace(/[\\/]/g, sep)}`);
  };

  const handleRemoveRecentFile = async (targetPath: string) => {
    if (isTauri) {
      const updated = await tauriApi.removeRecentFile(targetPath);
      setRecentFiles(updated);
    }
  };

  const handleClearRecentFiles = async () => {
    if (isTauri) {
      await tauriApi.clearRecentFiles();
      setRecentFiles([]);
    }
  };

  const handleEditorChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };

  // Rendering lags behind typing instead of blocking it
  const renderedContent = useDeferredValue(content);
  const doc = useMemo(() => renderMarkdown(renderedContent), [renderedContent]);
  const stats = useMemo(() => calculateStats(renderedContent), [renderedContent]);

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!zenMode && (
        <TitleBar
          fileName={fileName}
          isDirty={isDirty}
          theme={theme}
          setTheme={setTheme}
          viewMode={viewMode}
          setViewMode={setViewMode}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          contentWidth={contentWidth}
          setContentWidth={setContentWidth}
          zoom={zoom}
          setZoom={setZoom}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          zenMode={zenMode}
          setZenMode={setZenMode}
          onOpenFile={handleOpenFile}
          onSaveFile={handleSaveFile}
          onExportPdf={handleExportPdf}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {!zenMode && (
          <OutlineSidebar
            isOpen={sidebarOpen}
            toc={doc.toc}
            activeHeadingId={activeHeadingId}
            stats={stats}
            recentFiles={recentFiles}
            onSelectRecentFile={handleSelectRecentFile}
            onRemoveRecentFile={handleRemoveRecentFile}
            onClearRecentFiles={handleClearRecentFiles}
          />
        )}

        {viewMode === 'reader' && (
          <MarkdownViewer
            html={doc.html}
            theme={theme}
            fontFamily={fontFamily}
            contentWidth={contentWidth}
            zoom={zoom}
            onActiveHeadingChange={setActiveHeadingId}
            onLinkClick={handleLinkClick}
            scrollRef={viewerScrollRef}
          />
        )}

        {viewMode === 'editor' && (
          <MarkdownEditor
            content={content}
            onChange={handleEditorChange}
            scrollRef={editorScrollRef}
          />
        )}

        {viewMode === 'split' && (
          <div className="flex-1 flex h-full overflow-hidden">
            <MarkdownEditor
              content={content}
              onChange={handleEditorChange}
              scrollRef={editorScrollRef}
              onScroll={handleEditorScroll}
            />
            <MarkdownViewer
              html={doc.html}
              theme={theme}
              fontFamily={fontFamily}
              contentWidth="fluid"
              zoom={zoom}
              onActiveHeadingChange={setActiveHeadingId}
              onLinkClick={handleLinkClick}
              scrollRef={viewerScrollRef}
              onScroll={handleViewerScroll}
            />
          </div>
        )}

        <SearchBar
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          viewerRef={viewerScrollRef}
          contentKey={doc.html}
        />

        {/* Zen Mode Floating Exit Button */}
        {zenMode && (
          <button
            onClick={() => setZenMode(false)}
            title={`Exit Zen Mode (Esc or ${MOD}+Shift+F)`}
            className="no-print absolute top-4 right-4 z-50 p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] shadow-xl transition-all opacity-40 hover:opacity-100 cursor-pointer"
          >
            <Minimize2 size={16} />
          </button>
        )}

        {/* Toast Alert */}
        {toast && (
          <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] px-4 py-2 rounded-xl shadow-2xl text-xs font-medium text-[var(--text-main)] animate-in fade-in slide-in-from-bottom-2 duration-150">
            {toast.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-500" />
            ) : (
              <RefreshCw size={15} className="text-[var(--accent-color)] animate-spin-once" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
