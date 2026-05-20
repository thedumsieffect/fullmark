/**
 * Wraps the editor with workspace/tabs integration:
 *  - loads content from the active tab
 *  - propagates edits back into the tabs store (sets dirty)
 *  - switches between rendered (TipTap) and source (textarea) views
 *  - registers Cmd+S to save the active tab
 *  - debounced auto-save (1.5s after last edit) on dirty tabs
 *  - reader mode forces rendered + locks editing
 */

import { useCallback, useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BlockEditor } from "./BlockEditor";
import { SourceEditor } from "./SourceEditor";
import { useTabsStore, selectActiveTab } from "@/stores/tabs";
import { useUIStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { resolveWorkspaceLinkTarget } from "@/services/link-targets";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export function EditorPane() {
  const activeTab = useTabsStore(selectActiveTab);
  const updateContent = useTabsStore((s) => s.updateContent);
  const markEditorChanged = useTabsStore((s) => s.markEditorChanged);
  const syncEditorSnapshot = useTabsStore((s) => s.syncEditorSnapshot);
  const registerSnapshotProvider = useTabsStore(
    (s) => s.registerSnapshotProvider,
  );
  const saveActive = useTabsStore((s) => s.saveActive);
  const openFile = useTabsStore((s) => s.openFile);
  const readerMode = useUIStore((s) => s.readerMode);
  const viewMode = useUIStore((s) => s.viewMode);
  const workspaceFiles = useWorkspaceStore((s) => s.files);

  const effectiveMode = readerMode ? "rendered" : viewMode;
  const activePath = activeTab?.path;

  const handleRenderedEdit = useCallback(
    (revision: number) => {
      if (activePath) markEditorChanged(activePath, revision);
    },
    [activePath, markEditorChanged],
  );

  const handleRenderedSnapshot = useCallback(
    (snapshot: { markdown: string; revision: number }) => {
      if (activePath) {
        syncEditorSnapshot(activePath, {
          content: snapshot.markdown,
          revision: snapshot.revision,
        });
      }
    },
    [activePath, syncEditorSnapshot],
  );

  const handleRegisterSnapshotProvider = useCallback(
    (provider: () => { markdown: string; revision: number }) => {
      if (!activePath) return () => {};
      return registerSnapshotProvider(activePath, () => {
        const snapshot = provider();
        return {
          content: snapshot.markdown,
          revision: snapshot.revision,
        };
      });
    },
    [activePath, registerSnapshotProvider],
  );

  const handleOpenLink = useCallback(
    (target: string) => {
      const file = resolveWorkspaceLinkTarget(workspaceFiles, target);
      if (!file) return;
      void openFile(file.path).catch((e: unknown) => {
        console.error(`Failed to open link target ${target}:`, e);
      });
    },
    [openFile, workspaceFiles],
  );

  const handleOpenUrl = useCallback((url: string) => {
    void openUrl(url).catch((e: unknown) => {
      console.error(`Failed to open URL ${url}:`, e);
    });
  }, []);

  // Cmd+S to save (suppressed in reader mode — there's nothing to save)
  useEffect(() => {
    if (readerMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveActive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive, readerMode]);

  // Debounced auto-save when the active tab is dirty
  useEffect(() => {
    if (readerMode) return;
    if (!activeTab?.dirty) return;
    const id = setTimeout(() => {
      void saveActive();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [activeTab?.revision, activeTab?.dirty, saveActive, readerMode]);

  if (!activeTab) {
    return (
      <div className="editor-empty">
        <p>Click a file in the sidebar to start editing.</p>
      </div>
    );
  }

  if (effectiveMode === "source") {
    return (
      <SourceEditor
        value={activeTab.content}
        onChange={(md) => updateContent(activeTab.path, md)}
      />
    );
  }

  return (
    <div className="editor-canvas">
      <BlockEditor
        key={activeTab.path}
        initialMarkdown={activeTab.content}
        initialRevision={activeTab.revision}
        onEdit={handleRenderedEdit}
        onSnapshot={handleRenderedSnapshot}
        onOpenLink={handleOpenLink}
        onOpenUrl={handleOpenUrl}
        registerSnapshotProvider={handleRegisterSnapshotProvider}
        editable={!readerMode}
      />
    </div>
  );
}
