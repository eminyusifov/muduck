import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save, ask } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';

export interface FileData {
  path: string;
  name: string;
  content: string;
  last_modified: number;
}

// `listen` resolves asynchronously; if the caller unsubscribes first (React StrictMode
// mounts effects twice), the listener must still be removed once it is registered.
function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  let disposed = false;
  let unlisten: (() => void) | null = null;
  listen<T>(event, (e) => callback(e.payload)).then((fn) => {
    if (disposed) fn();
    else unlisten = fn;
  });
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export const tauriApi = {
  async getInitialFile(): Promise<FileData | null> {
    try {
      return await invoke<FileData | null>('get_initial_file');
    } catch (e) {
      console.warn('getInitialFile error:', e);
      return null;
    }
  },

  async openFileDialog(): Promise<FileData | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Markdown Documents',
          extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt']
        }]
      });
      if (selected && typeof selected === 'string') {
        return await this.readFile(selected);
      }
      return null;
    } catch (e) {
      console.warn('Plugin dialog open failed, falling back to invoke:', e);
      try {
        return await invoke<FileData | null>('open_file_dialog');
      } catch (err) {
        console.error('openFileDialog fallback error:', err);
        return null;
      }
    }
  },

  async saveFileDialog(defaultName: string, content: string): Promise<string | null> {
    try {
      const selected = await save({
        defaultPath: defaultName,
        filters: [{
          name: 'Markdown Documents',
          extensions: ['md', 'markdown', 'mdown']
        }]
      });
      if (selected && typeof selected === 'string') {
        return await this.saveFile(selected, content);
      }
      return null;
    } catch (e) {
      console.warn('Plugin dialog save failed, falling back to invoke:', e);
      try {
        return await invoke<string | null>('save_file_dialog', { defaultName, content });
      } catch (err) {
        console.error('saveFileDialog fallback error:', err);
        return null;
      }
    }
  },

  async readFile(filePath: string): Promise<FileData> {
    return await invoke<FileData>('read_file', { path: filePath });
  },

  /** Returns the canonical path the file was written to, or null on failure. */
  async saveFile(filePath: string, content: string): Promise<string | null> {
    try {
      return await invoke<string>('save_file', { path: filePath, content });
    } catch (e) {
      console.error('saveFile error:', e);
      return null;
    }
  },

  async confirm(message: string, okLabel: string): Promise<boolean> {
    try {
      return await ask(message, { title: 'Muduck', kind: 'warning', okLabel, cancelLabel: 'Cancel' });
    } catch {
      return window.confirm(message);
    }
  },

  async openExternal(url: string): Promise<void> {
    try {
      await openUrl(url);
    } catch (e) {
      console.error('openExternal error:', e);
      window.open(url, '_blank', 'noopener');
    }
  },

  async watchFile(filePath: string): Promise<void> {
    try {
      await invoke('watch_file', { path: filePath });
    } catch (e) {
      console.error('watchFile error:', e);
    }
  },

  async getRecentFiles(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_recent_files');
    } catch {
      return [];
    }
  },

  async removeRecentFile(filePath: string): Promise<string[]> {
    try {
      return await invoke<string[]>('remove_recent_file', { path: filePath });
    } catch {
      return [];
    }
  },

  async clearRecentFiles(): Promise<void> {
    try {
      await invoke('clear_recent_files');
    } catch (e) {
      console.error('clearRecentFiles error:', e);
    }
  },

  async exportPdf(): Promise<boolean> {
    window.print();
    return true;
  },

  onOpenFile(callback: (file: FileData) => void): () => void {
    return subscribe<FileData>('open-file-data', callback);
  },

  onFileChanged(callback: (data: { path: string; content: string }) => void): () => void {
    return subscribe<{ path: string; content: string }>('file-changed', callback);
  },
};
