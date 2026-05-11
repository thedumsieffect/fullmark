/**
 * Horizontal tab bar. Shows open tabs with name, dirty marker, and close button.
 * Keyboard: Cmd+W close, Cmd+Shift+[/] navigate (registered in shortcuts service later).
 */

import { useTabsStore } from "@/stores/tabs";

export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activePath = useTabsStore((s) => s.activePath);
  const switchTo = useTabsStore((s) => s.switchTo);
  const closeTab = useTabsStore((s) => s.closeTab);

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`tab ${active ? "tab-active" : ""}`}
            onClick={() => switchTo(tab.path)}
            title={tab.path}
          >
            <span className="tab-name">{stripExt(tab.name)}</span>
            {tab.dirty && <span className="tab-dirty" aria-label="unsaved">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.path);
              }}
              aria-label="Close tab"
              title="Close tab"
            >
              ×
            </button>
          </div>
        );
      })}
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
