/**
 * Wraps the editor with workspace/tabs integration:
 *  - loads content from the active tab
 *  - propagates edits back into the tabs store (sets dirty)
 *  - switches between rendered (TipTap) and source (textarea) views
 *  - registers Cmd+S to save the active tab
 *  - debounced auto-save (1.5s after last edit) on dirty tabs
 *  - reader mode forces rendered + locks editing
 */

import { useEffect } from "react";
import { BlockEditor } from "./BlockEditor";
import { SourceEditor } from "./SourceEditor";
import { useTabsStore, selectActiveTab } from "@/stores/tabs";
import { useUIStore } from "@/stores/ui";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export function EditorPane() {
  const activeTab = useTabsStore(selectActiveTab);
  const updateContent = useTabsStore((s) => s.updateContent);
  const saveActive = useTabsStore((s) => s.saveActive);
  const readerMode = useUIStore((s) => s.readerMode);
  const viewMode = useUIStore((s) => s.viewMode);

  const effectiveMode = readerMode ? "rendered" : viewMode;

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
  }, [activeTab?.content, activeTab?.dirty, saveActive, readerMode]);

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
        initialMarkdown={activeTab.baseContent}
        onChange={(md) => updateContent(activeTab.path, md)}
        editable={!readerMode}
      />
    </div>
  );
}
