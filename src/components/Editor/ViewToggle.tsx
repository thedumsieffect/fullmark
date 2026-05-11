/**
 * Segmented control: Rendered ↔ Source.
 * Lives in the top-right of the titlebar.
 */

import { useUIStore } from "@/stores/ui";

export function ViewToggle() {
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);

  return (
    <div className="view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={`view-toggle-btn ${viewMode === "rendered" ? "view-toggle-active" : ""}`}
        onClick={() => setViewMode("rendered")}
        aria-pressed={viewMode === "rendered"}
        title="Rendered view"
      >
        Aa
      </button>
      <button
        type="button"
        className={`view-toggle-btn ${viewMode === "source" ? "view-toggle-active" : ""}`}
        onClick={() => setViewMode("source")}
        aria-pressed={viewMode === "source"}
        title="Source view (raw markdown) — ⌘⇧M"
      >
        &lt;/&gt;
      </button>
    </div>
  );
}
