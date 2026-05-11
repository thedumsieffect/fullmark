/**
 * Recursive file tree filtered to markdown files.
 *
 * - Folders are expandable. State is local to the component (resets on workspace switch).
 * - Click a file → opens it in a tab.
 * - Empty-folder pruning + dotfile/build-dir hiding happens in fs-bridge.walkWorkspace.
 */

import { useState, useCallback } from "react";
import type { TreeNode } from "@/services/fs-bridge";
import { useTabsStore } from "@/stores/tabs";
import { useWorkspaceStore } from "@/stores/workspace";

interface RowProps {
  node: TreeNode;
  depth: number;
}

function FileRow({ node, depth }: RowProps) {
  const openFile = useTabsStore((s) => s.openFile);
  const activePath = useTabsStore((s) => s.activePath);
  const isDirty = useTabsStore((s) => s.isDirty(node.path));
  const isActive = activePath === node.path;

  const onClick = useCallback(() => {
    void openFile(node.path).catch((e: unknown) => {
      console.error("Failed to open file:", e);
    });
  }, [openFile, node.path]);

  return (
    <div
      role="treeitem"
      aria-selected={isActive}
      onClick={onClick}
      className={`tree-row ${isActive ? "tree-row-active" : ""}`}
      style={{ paddingLeft: depth * 14 + 12 }}
      title={node.path}
    >
      <span className="tree-row-name">{stripExt(node.name)}</span>
      {isDirty && <span className="tree-row-dirty">●</span>}
    </div>
  );
}

function DirRow({ node, depth }: RowProps) {
  const [open, setOpen] = useState(depth < 1); // top-level open by default
  return (
    <div role="group">
      <div
        role="treeitem"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tree-row tree-row-dir"
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <span className="tree-row-chevron">{open ? "▾" : "▸"}</span>
        <span className="tree-row-name">{node.name}</span>
      </div>
      {open && node.children && (
        <div role="group">
          {node.children.map((child) =>
            child.isDir ? (
              <DirRow key={child.path} node={child} depth={depth + 1} />
            ) : (
              <FileRow key={child.path} node={child} depth={depth + 1} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  const ext = name.slice(idx).toLowerCase();
  if (ext === ".md" || ext === ".mdx" || ext === ".markdown")
    return name.slice(0, idx);
  return name;
}

export function FileTree() {
  const tree = useWorkspaceStore((s) => s.tree);
  const loading = useWorkspaceStore((s) => s.loadingTree);

  if (loading && !tree) {
    return <div className="tree-empty">Loading…</div>;
  }
  if (!tree) {
    return null;
  }
  if (!tree.children || tree.children.length === 0) {
    return (
      <div className="tree-empty">
        No markdown files in this folder.
        <br />
        <small>FullMark only shows <code>.md</code> files.</small>
      </div>
    );
  }

  return (
    <div role="tree" className="tree">
      {tree.children.map((child) =>
        child.isDir ? (
          <DirRow key={child.path} node={child} depth={0} />
        ) : (
          <FileRow key={child.path} node={child} depth={0} />
        ),
      )}
    </div>
  );
}
