/**
 * Tabs store: open files, dirty state, active tab.
 *
 * **Single-tab-per-path constraint**: opening a file already open switches
 * focus to the existing tab. This is a hard correctness rule — multi-tab
 * same-file = silent data corruption. See docs/ARCHITECTURE.md #6.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  /** Current local revision. Increments on every edit. */
  revision: number;
  /** Revision represented by `content`; rendered editor edits can be newer. */
  contentRevision: number;
  /** Revision known to match `baseContent` on disk. */
  savedRevision: number;
  /** True when current editor state does not match the saved revision. */
  dirty: boolean;
  /** mtime when last read/written, for external-change detection. */
  lastSyncedMs?: number;
};

export type EditorContentSnapshot = {
  content: string;
  revision: number;
};

type SnapshotProvider = () => EditorContentSnapshot;

type TabsState = {
  tabs: Tab[];
  activePath: string | null;
  restoredPaths: string[];
  restoringTabs: boolean;
  hasRestoredSession: boolean;

  openFile: (path: string) => Promise<string>;
  restoreSession: () => Promise<void>;
  closeTab: (path: string) => void;
  switchTo: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  markEditorChanged: (path: string, revision: number) => void;
  syncEditorSnapshot: (path: string, snapshot: EditorContentSnapshot) => void;
  registerSnapshotProvider: (
    path: string,
    provider: SnapshotProvider,
  ) => () => void;
  save: (path: string) => Promise<void>;
  saveActive: () => Promise<void>;
  isDirty: (path: string) => boolean;
};

const snapshotProviders = new Map<string, SnapshotProvider>();

type PersistedTabsState = {
  tabs?: Array<{ path?: unknown }>;
  restoredPaths?: unknown;
  activePath?: unknown;
};

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx < 0 ? p : p.slice(idx + 1);
}

function uniqueStringPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (typeof path !== "string" || !path || seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function tabPaths(tabs: Tab[]): string[] {
  return tabs.map((tab) => tab.path);
}

function extractPersistedPaths(state: PersistedTabsState): string[] {
  const restoredPaths = uniqueStringPaths(state.restoredPaths);
  if (restoredPaths.length > 0) return restoredPaths;
  return uniqueStringPaths(state.tabs?.map((tab) => tab.path));
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activePath: null,
      restoredPaths: [],
      restoringTabs: false,
      hasRestoredSession: false,

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
          revision: 0,
          contentRevision: 0,
          savedRevision: 0,
          dirty: false,
          lastSyncedMs: result.modifiedMs,
        };
        set((s) => ({
          tabs: [...s.tabs, tab],
          activePath: canonical,
        }));
        return canonical;
      },

      restoreSession: async () => {
        const state = get();
        if (state.hasRestoredSession || state.restoringTabs) return;

        const paths = uniqueStringPaths(state.restoredPaths);
        set({ restoringTabs: true, hasRestoredSession: true });

        if (paths.length === 0) {
          set({ restoringTabs: false, activePath: null });
          return;
        }

        const desiredActivePath = state.activePath;
        let restoredActivePath: string | null = null;

        for (const path of paths) {
          try {
            const canonical = await get().openFile(path);
            if (path === desiredActivePath || canonical === desiredActivePath) {
              restoredActivePath = canonical;
            }
          } catch (e) {
            console.error(`Failed to restore tab ${path}:`, e);
          }
        }

        set((current) => {
          const activePath =
            restoredActivePath ??
            (current.tabs.some((tab) => tab.path === desiredActivePath)
              ? desiredActivePath
              : current.activePath);
          return {
            activePath,
            restoringTabs: false,
            restoredPaths: tabPaths(current.tabs),
          };
        });
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
          tabs: s.tabs.map((t) => {
            if (t.path !== path) return t;
            if (content === t.content && t.contentRevision === t.revision) {
              return t;
            }

            const revision = t.revision + 1;
            const dirty = content !== t.baseContent;
            return {
              ...t,
              content,
              revision,
              contentRevision: revision,
              savedRevision: dirty ? t.savedRevision : revision,
              dirty,
            };
          }),
        }));
      },

      markEditorChanged: (path, revision) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.path === path
              ? {
                  ...t,
                  revision: Math.max(t.revision, revision),
                  dirty: true,
                }
              : t,
          ),
        }));
      },

      syncEditorSnapshot: (path, snapshot) => {
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.path !== path) return t;
            if (snapshot.revision < t.contentRevision) return t;

            const revision = Math.max(t.revision, snapshot.revision);
            const dirty = snapshot.content !== t.baseContent;
            return {
              ...t,
              content: snapshot.content,
              revision,
              contentRevision: snapshot.revision,
              savedRevision: dirty ? t.savedRevision : revision,
              dirty: dirty || revision !== snapshot.revision,
            };
          }),
        }));
      },

      registerSnapshotProvider: (path, provider) => {
        snapshotProviders.set(path, provider);
        return () => {
          if (snapshotProviders.get(path) === provider) {
            snapshotProviders.delete(path);
          }
        };
      },

      save: async (path) => {
        const tab = get().tabs.find((t) => t.path === path);
        if (!tab) return;
        const provider = snapshotProviders.get(path);
        const snapshot = provider?.() ?? {
          content: tab.content,
          revision: tab.revision,
        };

        if (snapshot.content === tab.baseContent) {
          set((s) => ({
            tabs: s.tabs.map((t) => {
              if (t.path !== path) return t;
              if (t.revision > snapshot.revision) return t;
              return {
                ...t,
                content: snapshot.content,
                revision: snapshot.revision,
                contentRevision: snapshot.revision,
                savedRevision: snapshot.revision,
                dirty: false,
              };
            }),
          }));
          return;
        }

        // Save-on-dirty only: skip writes when nothing changed.
        // This is the mitigation for first-save normalization (see fidelity-gate-results.md).
        if (!tab.dirty && snapshot.revision === tab.savedRevision) return;

        await atomicWrite(tab.path, snapshot.content);
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.path !== path) return t;

            const hasNewerEdits = t.revision > snapshot.revision;
            const knownContentMatchesDisk =
              hasNewerEdits &&
              t.contentRevision === t.revision &&
              t.content === snapshot.content;

            return {
              ...t,
              baseContent: snapshot.content,
              content: hasNewerEdits ? t.content : snapshot.content,
              contentRevision: hasNewerEdits
                ? t.contentRevision
                : snapshot.revision,
              savedRevision: knownContentMatchesDisk
                ? t.revision
                : snapshot.revision,
              dirty: hasNewerEdits && !knownContentMatchesDisk,
              lastSyncedMs: Date.now(),
            };
          }),
        }));
      },

      saveActive: async () => {
        const active = get().activePath;
        if (active) await get().save(active);
      },

      isDirty: (path) => {
        return get().tabs.find((t) => t.path === path)?.dirty ?? false;
      },
    }),
    {
      name: "fullmark.tabs",
      version: 1,
      merge: (persisted, current) => {
        const persistedState =
          typeof persisted === "object" && persisted !== null
            ? (persisted as PersistedTabsState)
            : {};
        const activePath =
          typeof persistedState.activePath === "string"
            ? persistedState.activePath
            : null;
        return {
          ...current,
          activePath,
          restoredPaths: extractPersistedPaths(persistedState),
        };
      },
      partialize: (state) => ({
        restoredPaths: tabPaths(state.tabs),
        activePath: state.activePath,
      }),
    },
  ),
);

// Selector helpers
export const selectActiveTab = (s: TabsState): Tab | null =>
  s.activePath ? (s.tabs.find((t) => t.path === s.activePath) ?? null) : null;
