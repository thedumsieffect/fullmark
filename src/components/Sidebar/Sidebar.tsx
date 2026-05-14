/**
 * Workspace sidebar: header with current workspace name + open/refresh/theme actions,
 * file tree (markdown files only — no toggle).
 */

import { useCallback, type KeyboardEvent, type PointerEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  SIDEBAR_COLLAPSE_THRESHOLD,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useUIStore,
  type AppearancePreference,
} from "@/stores/ui";
import { FileTree } from "./FileTree";

const THEME_ICON: Record<AppearancePreference, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

const THEME_TITLE: Record<AppearancePreference, string> = {
  system: "Appearance: follows system (click for light)",
  light: "Appearance: light (click for dark)",
  dark: "Appearance: dark (click for system)",
};

interface SidebarProps {
  onOpenSettings?: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps = {}) {
  const root = useWorkspaceStore((s) => s.root);
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const appearancePreference = useUIStore((s) => s.appearancePreference);
  const cycleAppearance = useUIStore((s) => s.cycleAppearance);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  const onOpen = useCallback(async () => {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Open Workspace Folder",
    });
    if (typeof result === "string" && result) {
      await openWorkspace(result);
    }
  }, [openWorkspace]);

  const beginResize = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = useUIStore.getState().sidebarWidth;

      document.documentElement.classList.add("is-resizing-sidebar");

      const finishResize = () => {
        document.documentElement.classList.remove("is-resizing-sidebar");
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finishResize);
        window.removeEventListener("pointercancel", finishResize);
      };

      const resize = (moveEvent: globalThis.PointerEvent) => {
        const nextWidth = startWidth + moveEvent.clientX - startX;
        if (nextWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
          setSidebarCollapsed(true);
          finishResize();
          return;
        }
        setSidebarWidth(nextWidth);
      };

      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finishResize);
      window.addEventListener("pointercancel", finishResize);
    },
    [setSidebarCollapsed, setSidebarWidth],
  );

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 40 : 16;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const nextWidth = sidebarWidth - step;
        if (nextWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
          setSidebarCollapsed(true);
        } else {
          setSidebarWidth(nextWidth);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setSidebarWidth(sidebarWidth + step);
      } else if (event.key === "Home") {
        event.preventDefault();
        setSidebarWidth(SIDEBAR_MIN_WIDTH);
      } else if (event.key === "End") {
        event.preventDefault();
        setSidebarWidth(SIDEBAR_MAX_WIDTH);
      } else if (event.key === "Enter") {
        event.preventDefault();
        setSidebarCollapsed(true);
      }
    },
    [setSidebarCollapsed, setSidebarWidth, sidebarWidth],
  );

  const workspaceName = root ? root.split("/").pop() || root : null;

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="sidebar-workspace" title={root ?? ""}>
          {workspaceName ?? "No workspace"}
        </div>
        <div className="sidebar-actions">
          <button
            className="sidebar-action"
            onClick={cycleAppearance}
            title={THEME_TITLE[appearancePreference]}
            aria-label={THEME_TITLE[appearancePreference]}
          >
            {THEME_ICON[appearancePreference]}
          </button>
          {root && (
            <button
              className="sidebar-action"
              onClick={() => void refreshTree()}
              title="Refresh tree"
            >
              ↻
            </button>
          )}
          {onOpenSettings && (
            <button
              className="sidebar-action"
              onClick={onOpenSettings}
              title="Settings (⌘,)"
              aria-label="Settings"
            >
              ⚙
            </button>
          )}
          <button
            className="sidebar-action"
            onClick={() => setSidebarCollapsed(true)}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            ◀
          </button>
        </div>
      </header>
      <div className="sidebar-tree">
        <FileTree />
      </div>
      <footer className="sidebar-footer">
        <button className="sidebar-toggle" onClick={() => void onOpen()}>
          Change folder…
        </button>
      </footer>
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={Math.round(sidebarWidth)}
        tabIndex={0}
        onPointerDown={beginResize}
        onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}
