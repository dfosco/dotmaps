import type { Grid } from './types';

const TABS_KEY = 'dotmaps-tabs';
const FILE_PREFIX = 'dotmaps-file-';
const IMAGE_PREFIX = 'dotmaps-img-';

export interface FileTab {
  id: string;
  name: string;
}

export interface FileData {
  grid: Grid;
  width: number;
  height: number;
}

export interface TabsState {
  tabs: FileTab[];
  activeTabId: string;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadTabs(): TabsState | null {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TabsState;
    if (parsed.tabs.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTabs(state: TabsState): void {
  localStorage.setItem(TABS_KEY, JSON.stringify(state));
}

export function loadFileData(id: string): FileData | null {
  try {
    const raw = localStorage.getItem(FILE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as FileData;
  } catch {
    return null;
  }
}

export function saveFileData(id: string, data: FileData): void {
  try {
    localStorage.setItem(FILE_PREFIX + id, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded — try clearing source images to free space
    try {
      const tabs = loadTabs();
      if (tabs) {
        for (const tab of tabs.tabs) {
          localStorage.removeItem(IMAGE_PREFIX + tab.id);
        }
      }
      localStorage.setItem(FILE_PREFIX + id, JSON.stringify(data));
    } catch {
      // Still failing — silently drop the save
    }
  }
}

export function deleteFileData(id: string): void {
  localStorage.removeItem(FILE_PREFIX + id);
  localStorage.removeItem(IMAGE_PREFIX + id);
}

export function saveSourceImage(id: string, dataUrl: string): void {
  try {
    localStorage.setItem(IMAGE_PREFIX + id, dataUrl);
  } catch {
    // localStorage quota exceeded — non-fatal
  }
}

export function loadSourceImage(id: string): string | null {
  return localStorage.getItem(IMAGE_PREFIX + id);
}
