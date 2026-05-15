/**
 * Recursive file tree filtered to markdown files.
 *
 * - Folders are expandable. State is local to the component (resets on workspace switch).
 * - Click a file → opens it in a tab.
 * - Empty-folder pruning + dotfile/build-dir hiding happens in fs-bridge.walkWorkspace.
 */

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { TreeNode } from "@/services/fs-bridge";
import { basename, isPathInsideRoot, stripMarkdownExt } from "@/services/path-utils";
import { useTabsStore, type Tab } from "@/stores/tabs";
import { useWorkspaceStore } from "@/stores/workspace";

const ROW_HEIGHT = 26;
const OVERSCAN_ROWS = 8;

interface RowProps {
  node: TreeNode;
  depth: number;
}

type VisibleRow = RowProps & {
  kind: "dir" | "file";
};

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

interface DirRowProps extends RowProps {
  open: boolean;
  onToggle: (path: string) => void;
}

function DirRow({ node, depth, open, onToggle }: DirRowProps) {
  return (
    <div
      role="treeitem"
      aria-expanded={open}
      onClick={() => onToggle(node.path)}
      className="tree-row tree-row-dir"
      style={{ paddingLeft: depth * 14 + 4 }}
      title={node.path}
    >
      <span className="tree-row-chevron">{open ? "▾" : "▸"}</span>
      <span className="tree-row-name">{node.name}</span>
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

function collectDefaultOpenDirs(tree: TreeNode | null): Set<string> {
  const openDirs = new Set<string>();
  for (const child of tree?.children ?? []) {
    if (child.isDir) openDirs.add(child.path);
  }
  return openDirs;
}

function collectVisibleRows(
  nodes: TreeNode[] | undefined,
  openDirs: Set<string>,
  depth: number,
  rows: VisibleRow[],
) {
  for (const node of nodes ?? []) {
    if (node.isDir) {
      rows.push({ node, depth, kind: "dir" });
      if (openDirs.has(node.path)) {
        collectVisibleRows(node.children, openDirs, depth + 1, rows);
      }
    } else {
      rows.push({ node, depth, kind: "file" });
    }
  }
}

export function FileTree() {
  const tree = useWorkspaceStore((s) => s.tree);
  const root = useWorkspaceStore((s) => s.root);
  const loading = useWorkspaceStore((s) => s.loadingTree);
  const tabs = useTabsStore((s) => s.tabs);
  const looseTabs = tabs.filter((tab) => !isPathInsideRoot(tab.path, root));
  const hasWorkspaceFiles = Boolean(tree?.children?.length);
  const [openDirs, setOpenDirs] = useState<Set<string>>(() =>
    collectDefaultOpenDirs(tree),
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenDirs(collectDefaultOpenDirs(tree));
    setScrollTop(0);
    treeRef.current?.scrollTo({ top: 0 });
  }, [tree?.path]);

  useLayoutEffect(() => {
    const el = treeRef.current;
    if (!el) return;

    const updateHeight = () => setViewportHeight(el.clientHeight);
    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const rows = useMemo(() => {
    const nextRows: VisibleRow[] = [];
    collectVisibleRows(tree?.children, openDirs, 0, nextRows);
    return nextRows;
  }, [openDirs, tree]);

  const toggleDir = useCallback((path: string) => {
    setOpenDirs((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

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
        <small>
          FullMark only shows <code>.md</code> files.
        </small>
      </div>
    );
  }

  const viewportRows = viewportHeight
    ? Math.ceil(viewportHeight / ROW_HEIGHT)
    : 40;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const end = Math.min(rows.length, start + viewportRows + OVERSCAN_ROWS * 2);
  const visibleRows = rows.slice(start, end);

  return (
    <div
      ref={treeRef}
      role="tree"
      className="tree"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ height: "100%", overflowY: "auto", position: "relative" }}
    >
      {hasWorkspaceFiles ? (
        <div style={{ height: rows.length * ROW_HEIGHT, position: "relative" }}>
          <div
            style={{
              transform: `translateY(${start * ROW_HEIGHT}px)`,
              position: "absolute",
              insetInline: 0,
              top: 0,
            }}
          >
            {visibleRows.map((row) =>
              row.kind === "dir" ? (
                <DirRow
                  key={row.node.path}
                  node={row.node}
                  depth={row.depth}
                  open={openDirs.has(row.node.path)}
                  onToggle={toggleDir}
                />
              ) : (
                <FileRow
                  key={row.node.path}
                  node={row.node}
                  depth={row.depth}
                />
              ),
            )}
          </div>
        </div>
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
