/**
 * Workspace sidebar: header with current workspace name + open/refresh/theme actions,
 * file tree (markdown files only — no toggle).
 */

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/workspace";
import { useUIStore, type AppearancePreference } from "@/stores/ui";
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
          <button
            className="sidebar-action"
            onClick={() => void onOpen()}
            title="Open folder…"
          >
            ⤴
          </button>
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
        </div>
      </header>
      <div className="sidebar-tree">
        <FileTree />
      </div>
    </aside>
  );
}
