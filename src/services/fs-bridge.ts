/**
 * Thin typed bridge over Tauri's filesystem layer.
 *
 * Responsibilities:
 *   - typed wrappers around our custom Rust commands (atomic_write_text,
 *     list_dir, read_text_file, resolve_path, walk_workspace)
 *   - markdown-filtered workspace tree conversion
 *   - write-token suppression: every write tags its target path with an
 *     expiring token; watcher events with a non-expired matching token are
 *     dropped so we don't self-trigger a reload after our own save
 *   - per-file write queue: rapid edits on the same file serialize, no race
 *
 * Architecture: see docs/ARCHITECTURE.md #4 (atomic writes), #5 (write-token).
 */

import { invoke } from "@tauri-apps/api/core";

export type DirEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs?: number;
};

export type ReadResult = {
  content: string;
  canonicalPath: string;
  modifiedMs?: number;
};

// -- Write-token suppression -------------------------------------------------

const pendingWrites = new Map<string, { token: string; expiresAt: number }>();
const SUPPRESS_WINDOW_MS = 800;

function makeToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Should the watcher ignore an event for this path because we just wrote it?
 * Returns true if there's a non-expired pending-write token for the path.
 */
export function shouldSuppressWatcherEvent(path: string): boolean {
  const entry = pendingWrites.get(path);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    pendingWrites.delete(path);
    return false;
  }
  return true;
}

// -- Per-file write queue ---------------------------------------------------

const writeQueues = new Map<string, Promise<unknown>>();

function queueWrite<T>(path: string, op: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(path) ?? Promise.resolve();
  const next = prev.then(op, op);
  writeQueues.set(
    path,
    next.finally(() => {
      // Only clear if the queue head hasn't been replaced by a later write
      if (writeQueues.get(path) === next) writeQueues.delete(path);
    }),
  );
  return next;
}

// -- Public API -------------------------------------------------------------

/** Resolve `~/path` or relative paths against `$HOME` and canonicalize. */
export async function resolvePath(path: string): Promise<string> {
  return invoke<string>("resolve_path", { path });
}

/** Read a text file. Returns content + canonical path + modified time. */
export async function readTextFile(path: string): Promise<ReadResult> {
  const result = await invoke<{
    content: string;
    canonicalPath: string;
    modifiedMs?: number;
  }>("read_text_file", { path });
  return result;
}

/**
 * Atomic write — temp file + fsync + rename. Serialized per-path.
 * Tags the path with a suppression token so the watcher won't bounce.
 */
export async function atomicWrite(
  path: string,
  content: string,
): Promise<string> {
  return queueWrite(path, async () => {
    const token = makeToken();
    pendingWrites.set(path, {
      token,
      expiresAt: Date.now() + SUPPRESS_WINDOW_MS,
    });
    try {
      return await invoke<string>("atomic_write_text", { path, content });
    } catch (e) {
      pendingWrites.delete(path);
      throw e;
    }
  });
}

/** List immediate children of a directory (single level). */
export async function listDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_dir", { path });
}

// -- Workspace walk + .md filter --------------------------------------------

export type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  /** Whether this node (or any descendant) contains a markdown file. */
  hasMarkdown?: boolean;
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  isDir: boolean;
  parent: number | null;
};

function fallbackRoot(root: string): TreeNode {
  return {
    name: root.split("/").pop() || root,
    path: root,
    isDir: true,
    children: [],
    hasMarkdown: false,
  };
}

export function buildTreeFromWorkspaceEntries(
  entries: WorkspaceEntry[],
  root: string,
): TreeNode {
  if (entries.length === 0) return fallbackRoot(root);

  const nodes = entries.map<TreeNode>((entry) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.isDir,
    children: entry.isDir ? [] : undefined,
  }));

  for (let idx = 1; idx < entries.length; idx++) {
    const parentIdx = entries[idx].parent ?? 0;
    const parent = nodes[parentIdx];
    if (!parent?.isDir) continue;
    parent.children ??= [];
    parent.children.push(nodes[idx]);
  }

  function markMarkdown(node: TreeNode): boolean {
    if (!node.isDir) {
      node.hasMarkdown = true;
      return true;
    }
    const hasMarkdown = (node.children ?? []).some(markMarkdown);
    node.hasMarkdown = hasMarkdown;
    return hasMarkdown;
  }

  markMarkdown(nodes[0]);
  return nodes[0];
}

/**
 * Walk a directory recursively, returning a tree of **markdown files only**.
 * Non-markdown files are hidden. Directories with no markdown descendants
 * are pruned. Dotfiles, build directories, and common cruft are skipped.
 *
 * This is a hard rule for FullMark — there is no "show everything" escape
 * hatch by design. FullMark is a markdown editor; anything else is noise.
 */
export async function walkWorkspace(root: string): Promise<TreeNode> {
  const entries = await invoke<WorkspaceEntry[]>("walk_workspace", { root });
  return buildTreeFromWorkspaceEntries(entries, root);
}
