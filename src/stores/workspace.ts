/**
 * Workspace store: current open folder + recent workspaces + file tree.
 *
 * The tree is **always filtered to markdown files only** — see fs-bridge.walkWorkspace.
 * FullMark is a markdown editor; other files are never shown.
 *
 * Persisted to localStorage so the same folder reopens on next launch.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { walkWorkspace, type TreeNode } from "@/services/fs-bridge";

type WorkspaceState = {
  /** Absolute path of the current workspace root, or null when no folder is open. */
  root: string | null;
  /** File tree (markdown files only). */
  tree: TreeNode | null;
  /** Loading state for tree rebuild. */
  loadingTree: boolean;
  /** Most-recently-opened workspace paths (most recent first, capped at 8). */
  recent: string[];

  openWorkspace: (root: string) => Promise<void>;
  closeWorkspace: () => void;
  refreshTree: () => Promise<void>;
};

const RECENT_LIMIT = 8;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      root: null,
      tree: null,
      loadingTree: false,
      recent: [],

      openWorkspace: async (root) => {
        set({ root, tree: null, loadingTree: true });
        try {
          const tree = await walkWorkspace(root);
          set((s) => ({
            tree,
            loadingTree: false,
            recent: [root, ...s.recent.filter((r) => r !== root)].slice(
              0,
              RECENT_LIMIT,
            ),
          }));
        } catch (e) {
          console.error("Failed to open workspace:", e);
          set({ loadingTree: false });
          throw e;
        }
      },

      closeWorkspace: () => {
        set({ root: null, tree: null });
      },

      refreshTree: async () => {
        const root = get().root;
        if (!root) return;
        set({ loadingTree: true });
        try {
          const tree = await walkWorkspace(root);
          set({ tree, loadingTree: false });
        } catch (e) {
          console.error("Failed to refresh tree:", e);
          set({ loadingTree: false });
        }
      },
    }),
    {
      name: "fullmark.workspace",
      partialize: (s) => ({
        root: s.root,
        recent: s.recent,
      }),
    },
  ),
);
