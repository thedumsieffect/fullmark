/**
 * Recursive file tree filtered to markdown files.
 *
 * - Folders are expandable. State is local to the component (resets on workspace switch).
 * - Click a file → opens it in a tab.
 * - Empty-folder pruning + dotfile/build-dir hiding happens in fs-bridge.walkWorkspace.
 */

import { useState, useCallback } from "react";
import type { TreeNode } from "@/services/fs-bridge";
import { basename, isPathInsideRoot, stripMarkdownExt } from "@/services/path-utils";
import { useTabsStore, type Tab } from "@/stores/tabs";
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
      <span className="tree-row-name">{stripMarkdownExt(node.name)}</span>
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

interface LooseFileRowProps {
  tab: Tab;
}

function LooseFileRow({ tab }: LooseFileRowProps) {
  const activePath = useTabsStore((s) => s.activePath);
  const switchTo = useTabsStore((s) => s.switchTo);
  const closeTab = useTabsStore((s) => s.closeTab);
  const isActive = activePath === tab.path;

  return (
    <div
      role="treeitem"
      aria-selected={isActive}
      className={`tree-row loose-file-row ${isActive ? "tree-row-active" : ""}`}
      title={tab.path}
      onClick={() => switchTo(tab.path)}
    >
      <span className="tree-row-name">{stripMarkdownExt(basename(tab.path))}</span>
      {tab.dirty && <span className="tree-row-dirty">●</span>}
      <button
        className="loose-file-close"
        onClick={(event) => {
          event.stopPropagation();
          closeTab(tab.path);
        }}
        aria-label={`Close ${basename(tab.path)}`}
        title="Close loose file"
      >
        ×
      </button>
    </div>
  );
}

export function FileTree() {
  const tree = useWorkspaceStore((s) => s.tree);
  const root = useWorkspaceStore((s) => s.root);
  const loading = useWorkspaceStore((s) => s.loadingTree);
  const tabs = useTabsStore((s) => s.tabs);
  const looseTabs = tabs.filter((tab) => !isPathInsideRoot(tab.path, root));
  const hasWorkspaceFiles = Boolean(tree?.children?.length);

  if (loading && !tree) {
    return <div className="tree-empty">Loading…</div>;
  }
  if (!tree) {
    return null;
  }
  if (!hasWorkspaceFiles && looseTabs.length === 0) {
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
      {hasWorkspaceFiles ? (
        tree.children?.map((child) =>
          child.isDir ? (
            <DirRow key={child.path} node={child} depth={0} />
          ) : (
            <FileRow key={child.path} node={child} depth={0} />
          ),
        )
      ) : (
        <div className="tree-empty tree-empty-compact">
          No markdown files in this folder.
        </div>
      )}
      {looseTabs.length > 0 && (
        <div className="loose-files" role="group" aria-label="Loose files">
          <div className="tree-section-title">Loose files</div>
          {looseTabs.map((tab) => (
            <LooseFileRow key={tab.path} tab={tab} />
          ))}
        </div>
      )}
    </div>
  );
}
