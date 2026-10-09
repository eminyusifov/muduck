export type Theme = 'paper' | 'light' | 'midnight' | 'nord' | 'obsidian';
export type FontFamily = 'serif' | 'sans' | 'mono';
export type ContentWidth = 'focused' | 'wide' | 'fluid';
export type ViewMode = 'reader' | 'split' | 'editor';

export interface TOCItem {
  id: string;
  level: number;
  text: string;
}

export interface DocStats {
  words: number;
  chars: number;
  readTimeMinutes: number;
}

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
}
