/**
 * Tabs store: open files, dirty state, active tab.
 *
 * **Single-tab-per-path constraint**: opening a file already open switches
 * focus to the existing tab. This is a hard correctness rule — multi-tab
 * same-file = silent data corruption. See docs/ARCHITECTURE.md #6.
 */

import { create } from "zustand";
import { readTextFile, atomicWrite } from "@/services/fs-bridge";

export type Tab = {
  /** Canonical absolute path. Identity key. */
  path: string;
  /** Display name (filename). */
  name: string;
  /** Original markdown loaded from disk (what's currently saved). */
  baseContent: string;
  /** Current markdown in the editor (may have unsaved changes). */
  content: string;
  /** baseContent !== content */
  dirty: boolean;
  /** mtime when last read/written, for external-change detection. */
  lastSyncedMs?: number;
};

type TabsState = {
  tabs: Tab[];
  activePath: string | null;

  openFile: (path: string) => Promise<string>;
  closeTab: (path: string) => void;
  switchTo: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  save: (path: string) => Promise<void>;
  saveActive: () => Promise<void>;
  isDirty: (path: string) => boolean;
};

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx < 0 ? p : p.slice(idx + 1);
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activePath: null,

  openFile: async (path) => {
    // Single-tab-per-path: focus existing if already open.
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      set({ activePath: existing.path });
      return existing.path;
    }

    const result = await readTextFile(path);
    const canonical = result.canonicalPath;

    // Check canonical path too — case-insensitive filesystems may have aliased it.
    const existingByCanon = get().tabs.find((t) => t.path === canonical);
    if (existingByCanon) {
      set({ activePath: existingByCanon.path });
      return existingByCanon.path;
    }

    const tab: Tab = {
      path: canonical,
      name: basename(canonical),
      baseContent: result.content,
      content: result.content,
      dirty: false,
      lastSyncedMs: result.modifiedMs,
    };
    set((s) => ({
      tabs: [...s.tabs, tab],
      activePath: canonical,
    }));
    return canonical;
  },

  closeTab: (path) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.path === path);
      if (idx < 0) return s;
      const tabs = s.tabs.filter((t) => t.path !== path);
      let activePath = s.activePath;
      if (activePath === path) {
        const next = tabs[idx] ?? tabs[idx - 1] ?? null;
        activePath = next?.path ?? null;
      }
      return { tabs, activePath };
    });
  },

  switchTo: (path) => {
    if (get().tabs.some((t) => t.path === path)) {
      set({ activePath: path });
    }
  },

  updateContent: (path, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path
          ? { ...t, content, dirty: content !== t.baseContent }
          : t,
      ),
    }));
  },

  save: async (path) => {
    const tab = get().tabs.find((t) => t.path === path);
    if (!tab) return;
    // Save-on-dirty only: skip writes when nothing changed.
    // This is the mitigation for first-save normalization (see fidelity-gate-results.md).
    if (!tab.dirty) return;

    await atomicWrite(tab.path, tab.content);
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path
          ? {
              ...t,
              baseContent: t.content,
              dirty: false,
              lastSyncedMs: Date.now(),
            }
          : t,
      ),
    }));
  },

  saveActive: async () => {
    const active = get().activePath;
    if (active) await get().save(active);
  },

  isDirty: (path) => {
    return get().tabs.find((t) => t.path === path)?.dirty ?? false;
  },
}));

// Selector helpers
export const selectActiveTab = (s: TabsState): Tab | null =>
  s.activePath ? (s.tabs.find((t) => t.path === s.activePath) ?? null) : null;
