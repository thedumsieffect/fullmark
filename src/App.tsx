import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { TabBar } from "@/components/Tabs/TabBar";
import { EditorPane } from "@/components/Editor/EditorPane";
import { Welcome } from "@/components/Welcome";
import { QuickSwitcher } from "@/components/CommandPalette/QuickSwitcher";
import { SettingsModal } from "@/components/Settings/SettingsModal";
import { useWorkspaceStore } from "@/stores/workspace";
import { useTabsStore, selectActiveTab } from "@/stores/tabs";
import { useUIStore } from "@/stores/ui";

export default function App() {
  const root = useWorkspaceStore((s) => s.root);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const activeTab = useTabsStore(selectActiveTab);
  const readerMode = useUIStore((s) => s.readerMode);
  const toggleReaderMode = useUIStore((s) => s.toggleReaderMode);
  const themePreference = useUIStore((s) => s.themePreference);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Restore workspace tree on launch
  useEffect(() => {
    if (root && !useWorkspaceStore.getState().tree) {
      void refreshTree();
    }
  }, [root, refreshTree]);

  // Theme application — explicit override takes precedence, otherwise follow OS.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        themePreference === "system"
          ? mq.matches
            ? "dark"
            : "light"
          : themePreference;
      document.documentElement.setAttribute("data-theme", theme);
    };
    apply();
    if (themePreference === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [themePreference]);

  // Default body font
  useEffect(() => {
    document.documentElement.setAttribute("data-font-body", "charter");
  }, []);

  // Reflect reader mode into the DOM so CSS can respond
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-reader",
      readerMode ? "true" : "false",
    );
  }, [readerMode]);

  // Cmd+R toggles reader mode globally
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        toggleReaderMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleReaderMode]);

  // Cmd+K opens the quick switcher (requires a workspace; ignored otherwise)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (!root) return;
        e.preventDefault();
        setCmdkOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [root]);

  // Cmd+, opens Settings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Open With FullMark" handler — fires when macOS Launch Services hands us
  // a file path (right-click in Finder, double-click a .md, etc.).
  useEffect(() => {
    const unlistenP = listen<string[]>("open-files", async (event) => {
      const paths = event.payload ?? [];
      if (paths.length === 0) return;

      // Infer a workspace from the first file's parent dir if none is open.
      const ws = useWorkspaceStore.getState();
      if (!ws.root) {
        const firstPath = paths[0];
        const sep = Math.max(
          firstPath.lastIndexOf("/"),
          firstPath.lastIndexOf("\\"),
        );
        const parentDir = sep > 0 ? firstPath.slice(0, sep) : firstPath;
        try {
          await ws.openWorkspace(parentDir);
        } catch (e) {
          console.error("Failed to open workspace from file:", e);
        }
      }

      // Open each file in a tab (single-tab-per-path enforced by the store).
      const tabs = useTabsStore.getState();
      for (const path of paths) {
        try {
          await tabs.openFile(path);
        } catch (e) {
          console.error(`Failed to open ${path}:`, e);
        }
      }
    });
    return () => {
      void unlistenP.then((fn) => fn());
    };
  }, []);

  if (!root) {
    return (
      <div className="app app-empty">
        <header className="app-titlebar" data-tauri-drag-region>
          <span className="app-title">FullMark</span>
        </header>
        <Welcome />
      </div>
    );
  }

  if (readerMode) {
    return (
      <div className="app app-reader">
        <header className="app-titlebar" data-tauri-drag-region>
          <span className="app-title">
            {activeTab ? stripExt(activeTab.name) : "FullMark"}
            <span className="app-title-mode">  ·  Reader</span>
          </span>
        </header>
        <main className="app-main">
          <EditorPane />
        </main>
      </div>
    );
  }

  return (
    <div className="app app-workspace">
      <header className="app-titlebar" data-tauri-drag-region>
        <span className="app-title">
          {activeTab ? stripExt(activeTab.name) : "FullMark"}
          {activeTab?.dirty && (
            <span className="app-title-dirty" aria-label="unsaved">
              {" "}
              •
            </span>
          )}
        </span>
      </header>
      <div className="app-body">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <main className="app-main">
          <TabBar />
          <EditorPane />
        </main>
      </div>
      <footer className="app-statusbar">
        <span className="status-left">{activeTab ? activeTab.path : ""}</span>
        <span className="status-right">
          {activeTab && (
            <>
              <span>{activeTab.content.length} chars</span>
              <span>
                {activeTab.content.split(/\s+/).filter(Boolean).length} words
              </span>
              <span
                className={activeTab.dirty ? "status-dirty" : "status-clean"}
              >
                {activeTab.dirty ? "Unsaved" : "Saved"}
              </span>
            </>
          )}
          <span className="status-hint">⌘K Search</span>
          <span className="status-hint">⌘R Reader</span>
        </span>
      </footer>
      <QuickSwitcher open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
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
