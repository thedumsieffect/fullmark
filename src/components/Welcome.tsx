/**
 * Empty-state shown when no workspace is open.
 * Shows recents + "Open folder…" CTA.
 */

import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/workspace";

export function Welcome() {
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace);
  const recent = useWorkspaceStore((s) => s.recent);

  const onPick = useCallback(async () => {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Open Workspace Folder",
    });
    if (typeof result === "string" && result) {
      await openWorkspace(result);
    }
  }, [openWorkspace]);

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1 className="welcome-title">FullMark</h1>
        <p className="welcome-tagline">
          A really useful markdown editor. Open a folder of <code>.md</code>{" "}
          files to begin.
        </p>
        <button className="welcome-cta" onClick={() => void onPick()}>
          Open folder…
        </button>

        {recent.length > 0 && (
          <div className="welcome-recents">
            <div className="welcome-recents-title">Recent</div>
            {recent.map((path) => (
              <button
                key={path}
                className="welcome-recent"
                onClick={() => void openWorkspace(path)}
                title={path}
              >
                <span className="welcome-recent-name">
                  {path.split("/").pop() || path}
                </span>
                <span className="welcome-recent-path">{path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
