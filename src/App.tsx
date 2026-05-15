import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { TabBar } from "@/components/Tabs/TabBar";
import { EditorPane } from "@/components/Editor/EditorPane";
import { Welcome } from "@/components/Welcome";
import { QuickSwitcher } from "@/components/CommandPalette/QuickSwitcher";
import { SettingsModal } from "@/components/Settings/SettingsModal";
import { ViewToggle } from "@/components/Editor/ViewToggle";
import { useWorkspaceStore } from "@/stores/workspace";
import { useTabsStore, selectActiveTab } from "@/stores/tabs";
import { useUIStore } from "@/stores/ui";
import {
  resolveAppearancePreference,
  resolveThemeFamilyId,
} from "@/services/themes";
import { dirname } from "@/services/path-utils";

let externalOpenQueue = Promise.resolve();

function enqueueExternalFiles(paths: string[]): Promise<void> {
  externalOpenQueue = externalOpenQueue.then(
    () => openExternalFiles(paths),
    () => openExternalFiles(paths),
  );
  return externalOpenQueue;
}

async function openExternalFiles(paths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
  if (uniquePaths.length === 0) return;

  const workspace = useWorkspaceStore.getState();
  if (!workspace.root) {
    try {
      await workspace.openWorkspace(dirname(uniquePaths[0]));
    } catch (e) {
      console.error("Failed to open workspace from file:", e);
    }
  }

  const tabs = useTabsStore.getState();
  for (const path of uniquePaths) {
    try {
      await tabs.openFile(path);
    } catch (e) {
      console.error(`Failed to open ${path}:`, e);
    }
  }
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export default function App() {
  const root = useWorkspaceStore((s) => s.root);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const activeTab = useTabsStore(selectActiveTab);
  const restoreTabSession = useTabsStore((s) => s.restoreSession);
  const readerMode = useUIStore((s) => s.readerMode);
  const toggleReaderMode = useUIStore((s) => s.toggleReaderMode);
  const lightThemeFamily = useUIStore((s) => s.lightThemeFamily);
  const darkThemeFamily = useUIStore((s) => s.darkThemeFamily);
  const appearancePreference = useUIStore((s) => s.appearancePreference);
  const themePreviewAppearance = useUIStore((s) => s.themePreviewAppearance);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Restore workspace tree on launch
  useEffect(() => {
    if (root && !useWorkspaceStore.getState().tree) {
      void refreshTree();
    }
  }, [root, refreshTree]);

  // Reopen the previous tab session from disk after persisted stores hydrate.
  useEffect(() => {
    void restoreTabSession();
  }, [restoreTabSession]);

  // Theme application — settings preview can temporarily force light/dark.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const appearance =
        themePreviewAppearance ??
        resolveAppearancePreference(appearancePreference, mq.matches);
      const themeFamily = resolveThemeFamilyId(
        appearance,
        lightThemeFamily,
        darkThemeFamily,
      );
      document.documentElement.setAttribute("data-theme", appearance);
      document.documentElement.setAttribute("data-appearance", appearance);
      document.documentElement.setAttribute("data-theme-family", themeFamily);
      document.documentElement.style.colorScheme = appearance;
    };
    apply();
    if (appearancePreference === "system" && !themePreviewAppearance) {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [
    appearancePreference,
    darkThemeFamily,
    lightThemeFamily,
    themePreviewAppearance,
  ]);

  // Default body font
  useEffect(() => {
    document.documentElement.setAttribute("data-font-body", "charter");
  }, []);

  // Reflect reader mode into the DOM so CSS can hide chrome
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-reader",
      readerMode ? "true" : "false",
    );
  }, [readerMode]);

  // Cmd+R toggles reader mode. Registered on the capture phase + with
  // preventDefault so WKWebView's default page-reload doesn't fire — that
  // was the source of the perceived "freeze". Capture phase runs before the
  // WebView's own handler.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "r"
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggleReaderMode();
      }
      // Also block Cmd+Shift+R (hard reload) so it doesn't reload either.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "r"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
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

  // Cmd+Shift+M flips between rendered and source view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "m"
      ) {
        e.preventDefault();
        toggleViewMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleViewMode]);

  // "Open With FullMark" handler. Rust queues paths because Finder can launch
  // the app before this listener exists; this effect drains the queue once the
  // frontend is ready and again whenever Rust signals new paths.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    const drainPendingOpenFiles = async () => {
      try {
        const paths = await invoke<string[]>("take_pending_open_files");
        if (!cancelled) await enqueueExternalFiles(paths);
      } catch (e) {
        console.error("Failed to read pending open files:", e);
      }
    };

    const unlistenP = listen("open-files", () => {
      void drainPendingOpenFiles();
    });
    void unlistenP.then(
      () => drainPendingOpenFiles(),
      (e) => console.error("Failed to listen for opened files:", e),
    );

    return () => {
      cancelled = true;
      void unlistenP.then((fn) => fn());
    };
  }, []);

  if (!root && !activeTab) {
    return (
      <div className="app app-empty">
        <header className="app-titlebar" data-tauri-drag-region="deep">
          <span className="app-title" data-tauri-drag-region="true">
            FullMark
          </span>
        </header>
        <Welcome />
      </div>
    );
  }

  // Always render the full structure. Reader mode is purely a CSS class on
  // the root element (set via the data-reader attribute on documentElement
  // above) — this keeps the editor mounted across mode switches so we don't
  // remount the ProseMirror instance, which froze the UI on large files.
  return (
    <div className={`app app-workspace${readerMode ? " app-reader" : ""}`}>
      <header className="app-titlebar" data-tauri-drag-region="deep">
        <div className="app-titlebar-left" data-tauri-drag-region="true">
          <button
            className="titlebar-sidebar-toggle"
            data-tauri-drag-region="false"
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? "☰" : "◧"}
          </button>
        </div>
        <span className="app-title" data-tauri-drag-region="true">
          {activeTab ? stripExt(activeTab.name) : "FullMark"}
          {readerMode && (
            <span className="app-title-mode" data-tauri-drag-region="true">
              {" "}
              · Reader
            </span>
          )}
          {!readerMode && activeTab?.dirty && (
            <span
              className="app-title-dirty"
              data-tauri-drag-region="true"
              aria-label="unsaved"
            >
              {" "}
              •
            </span>
          )}
        </span>
        <div className="app-titlebar-right" data-tauri-drag-region="true">
          {activeTab && !readerMode && <ViewToggle />}
        </div>
      </header>
      <div
        className={`app-body${sidebarCollapsed ? " app-body-sidebar-collapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        {!sidebarCollapsed && (
          <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        )}
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
