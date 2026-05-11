/**
 * Workspace sidebar: header with current workspace name + open/refresh/theme actions,
 * file tree (markdown files only — no toggle).
 */

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import { useUIStore, type ThemePreference } from "@/stores/ui";
import { FileTree } from "./FileTree";

const THEME_ICON: Record<ThemePreference, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

const THEME_TITLE: Record<ThemePreference, string> = {
  system: "Theme: follows system (click for light)",
  light: "Theme: light (click for dark)",
  dark: "Theme: dark (click for system)",
};

export function Sidebar() {
  const root = useWorkspaceStore((s) => s.root);
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const themePreference = useUIStore((s) => s.themePreference);
  const cycleTheme = useUIStore((s) => s.cycleTheme);

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
            onClick={cycleTheme}
            title={THEME_TITLE[themePreference]}
            aria-label={THEME_TITLE[themePreference]}
          >
            {THEME_ICON[themePreference]}
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
          <button
            className="sidebar-action"
            onClick={() => void onOpen()}
            title="Open folder…"
          >
            ⤴
          </button>
        </div>
      </header>
      <div className="sidebar-tree">
        <FileTree />
      </div>
    </aside>
  );
}
