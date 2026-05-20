import { useEffect, useState } from "react";
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

export default function App() {
  const root = useWorkspaceStore((s) => s.root);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const activeTab = useTabsStore(selectActiveTab);
  const readerMode = useUIStore((s) => s.readerMode);
  const readerZoom = useUIStore((s) => s.readerZoom);
  const toggleReaderMode = useUIStore((s) => s.toggleReaderMode);
  const zoomReaderIn = useUIStore((s) => s.zoomReaderIn);
  const zoomReaderOut = useUIStore((s) => s.zoomReaderOut);
  const resetReaderZoom = useUIStore((s) => s.resetReaderZoom);
  const lightThemeFamily = useUIStore((s) => s.lightThemeFamily);
  const darkThemeFamily = useUIStore((s) => s.darkThemeFamily);
  const appearancePreference = useUIStore((s) => s.appearancePreference);
  const themePreviewAppearance = useUIStore((s) => s.themePreviewAppearance);
  const viewMode = useUIStore((s) => s.viewMode);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const zoomEnabled = Boolean(
    activeTab && (readerMode || viewMode === "rendered"),
  );

  // Restore workspace tree on launch
  useEffect(() => {
    if (root && !useWorkspaceStore.getState().tree) {
      void refreshTree();
    }
  }, [root, refreshTree]);

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

  // Rendered editor zoom behaves like browser zoom:
  // Cmd/Ctrl +/- steps levels, 0 resets.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--reader-zoom",
      String(readerZoom),
    );
  }, [readerZoom]);

  useEffect(() => {
    if (!zoomEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

      if (isZoomInKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        zoomReaderIn();
        return;
      }

      if (isZoomOutKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        zoomReaderOut();
        return;
      }

      if (isZoomResetKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        resetReaderZoom();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [resetReaderZoom, zoomEnabled, zoomReaderIn, zoomReaderOut]);

  useEffect(() => {
    if (!zoomEnabled) return;
    let lastZoomAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastZoomAt < 120) return;
      lastZoomAt = now;

      if (e.deltaY < 0) {
        zoomReaderIn();
      } else if (e.deltaY > 0) {
        zoomReaderOut();
      }
    };
    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    return () =>
      window.removeEventListener("wheel", onWheel, { capture: true });
  }, [zoomEnabled, zoomReaderIn, zoomReaderOut]);

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

  // "Open With FullMark" handler
  useEffect(() => {
    const unlistenP = listen<string[]>("open-files", async (event) => {
      const paths = event.payload ?? [];
      if (paths.length === 0) return;
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

  // Always render the full structure. Reader mode is purely a CSS class on
  // the root element (set via the data-reader attribute on documentElement
  // above) — this keeps the editor mounted across mode switches so we don't
  // remount the ProseMirror instance, which froze the UI on large files.
  return (
    <div className={`app app-workspace${readerMode ? " app-reader" : ""}`}>
      <header className="app-titlebar" data-tauri-drag-region>
        <div className="app-titlebar-left" />
        <span className="app-title">
          {activeTab ? stripExt(activeTab.name) : "FullMark"}
          {readerMode && (
            <span className="app-title-mode">
              {" "}
              · Reader
              {readerZoom !== 1 ? ` ${formatReaderZoom(readerZoom)}` : ""}
            </span>
          )}
          {!readerMode && activeTab?.dirty && (
            <span className="app-title-dirty" aria-label="unsaved">
              {" "}
              •
            </span>
          )}
        </span>
        <div className="app-titlebar-right">
          {zoomEnabled && (
            <div
              className="reader-zoom-controls"
              role="group"
              aria-label="Reader zoom"
            >
              <button
                type="button"
                className="reader-zoom-btn"
                data-tauri-drag-region="false"
                onClick={zoomReaderOut}
                title="Zoom out"
                aria-label="Zoom out"
              >
                -
              </button>
              <button
                type="button"
                className="reader-zoom-value"
                data-tauri-drag-region="false"
                onClick={resetReaderZoom}
                title="Reset zoom"
                aria-label="Reset reader zoom"
              >
                <span className="reader-zoom-reset-icon" aria-hidden="true">
                  ↺
                </span>
                <span>{formatReaderZoom(readerZoom)}</span>
              </button>
              <button
                type="button"
                className="reader-zoom-btn"
                data-tauri-drag-region="false"
                onClick={zoomReaderIn}
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
          {activeTab && !readerMode && <ViewToggle />}
        </div>
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

function isZoomInKey(e: KeyboardEvent): boolean {
  return e.code === "Equal" || e.code === "NumpadAdd" || e.key === "+";
}

function isZoomOutKey(e: KeyboardEvent): boolean {
  return e.code === "Minus" || e.code === "NumpadSubtract" || e.key === "-";
}

function isZoomResetKey(e: KeyboardEvent): boolean {
  return e.code === "Digit0" || e.code === "Numpad0" || e.key === "0";
}

function formatReaderZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
