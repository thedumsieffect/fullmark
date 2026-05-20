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

export type WorkspaceFile = {
  name: string;
  path: string;
  label: string;
  relativePath: string;
  folder: string;
  searchName: string;
  searchPath: string;
};

type WorkspaceState = {
  /** Absolute path of the current workspace root, or null when no folder is open. */
  root: string | null;
  /** File tree (markdown files only). */
  tree: TreeNode | null;
  /** Flat markdown file index derived once per successful workspace scan. */
  files: WorkspaceFile[];
  /** Loading state for tree rebuild. */
  loadingTree: boolean;
  /** Monotonic scan id used to ignore stale async walk results. */
  scanVersion: number;
  /** Most-recently-opened workspace paths (most recent first, capped at 8). */
  recent: string[];

  openWorkspace: (root: string) => Promise<void>;
  closeWorkspace: () => void;
  refreshTree: () => Promise<void>;
};

const RECENT_LIMIT = 8;
let nextScanVersion = 0;

function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  const ext = name.slice(idx).toLowerCase();
  if (ext === ".md" || ext === ".mdx" || ext === ".markdown") {
    return name.slice(0, idx);
  }
  return name;
}

function relativePath(fullPath: string, workspaceRoot: string | null): string {
  if (workspaceRoot && fullPath.startsWith(workspaceRoot + "/")) {
    return fullPath.slice(workspaceRoot.length + 1);
  }
  return fullPath;
}

export function buildWorkspaceFileIndex(
  tree: TreeNode | null,
  root: string | null,
): WorkspaceFile[] {
  const files: WorkspaceFile[] = [];

  function visit(node: TreeNode) {
    if (!node.isDir) {
      const rel = relativePath(node.path, root);
      const folder = rel.includes("/")
        ? rel.slice(0, rel.lastIndexOf("/"))
        : "";
      const label = stripExt(node.name);
      files.push({
        name: node.name,
        path: node.path,
        label,
        relativePath: rel,
        folder,
        searchName: label.toLowerCase(),
        searchPath: rel.toLowerCase(),
      });
      return;
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  if (tree) visit(tree);
  return files;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      root: null,
      tree: null,
      files: [],
      loadingTree: false,
      scanVersion: 0,
      recent: [],

      openWorkspace: async (root) => {
        const scanVersion = ++nextScanVersion;
        set({ root, tree: null, files: [], loadingTree: true, scanVersion });
        try {
          const tree = await walkWorkspace(root);
          if (get().scanVersion !== scanVersion || get().root !== root) return;
          const files = buildWorkspaceFileIndex(tree, root);
          set((s) => ({
            tree,
            files,
            loadingTree: false,
            recent: [root, ...s.recent.filter((r) => r !== root)].slice(
              0,
              RECENT_LIMIT,
            ),
          }));
        } catch (e) {
          if (get().scanVersion !== scanVersion || get().root !== root) return;
          console.error("Failed to open workspace:", e);
          set({ loadingTree: false });
          throw e;
        }
      },

      closeWorkspace: () => {
        const scanVersion = ++nextScanVersion;
        set({
          root: null,
          tree: null,
          files: [],
          loadingTree: false,
          scanVersion,
        });
      },

      refreshTree: async () => {
        const root = get().root;
        if (!root) return;
        const scanVersion = ++nextScanVersion;
        set({ loadingTree: true, scanVersion });
        try {
          const tree = await walkWorkspace(root);
          if (get().scanVersion !== scanVersion || get().root !== root) return;
          const files = buildWorkspaceFileIndex(tree, root);
          set({ tree, files, loadingTree: false });
        } catch (e) {
          if (get().scanVersion !== scanVersion || get().root !== root) return;
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
