/**
 * Settings modal (Cmd+, to open).
 *
 * v0.1 setting:
 *   - Default app for .md / .mdx / .markdown — flip FullMark to be the system
 *     default via macOS LaunchServices. Read-only on non-macOS.
 *
 * Other settings (font, theme, etc) live elsewhere for now; this modal
 * exists as a place to grow them into.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  open: boolean;
  onClose: () => void;
}

type DefaultHandlerState =
  | { status: "loading" }
  | { status: "ours" }
  | { status: "other"; bundleId: string | null }
  | { status: "error"; message: string };

export function SettingsModal({ open, onClose }: Props) {
  const [handler, setHandler] = useState<DefaultHandlerState>({
    status: "loading",
  });
  const [applying, setApplying] = useState(false);

  const refresh = async () => {
    try {
      const isOurs = await invoke<boolean>("is_default_markdown_handler");
      if (isOurs) {
        setHandler({ status: "ours" });
      } else {
        const id = await invoke<string | null>("get_default_markdown_handler");
        setHandler({ status: "other", bundleId: id });
      }
    } catch (e) {
      setHandler({ status: "error", message: String(e) });
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const makeDefault = async () => {
    setApplying(true);
    try {
      await invoke("set_default_markdown_handler");
      // LaunchServices is asynchronous internally; give it a beat before re-reading.
      await new Promise((r) => setTimeout(r, 200));
      await refresh();
    } catch (e) {
      setHandler({ status: "error", message: String(e) });
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="cmdk-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="settings-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-row">
              <div className="settings-row-main">
                <div className="settings-row-title">
                  Default app for <code>.md</code> files
                </div>
                <div className="settings-row-desc">
                  {handler.status === "loading" && "Checking…"}
                  {handler.status === "ours" && (
                    <>FullMark is the default. Double-clicking any{" "}
                    <code>.md</code> file in Finder opens it here.</>
                  )}
                  {handler.status === "other" && (
                    <>
                      Currently handled by{" "}
                      <code>{handler.bundleId ?? "(none)"}</code>.
                    </>
                  )}
                  {handler.status === "error" && (
                    <span className="settings-error">
                      Couldn't read the current default: {handler.message}
                    </span>
                  )}
                </div>
              </div>
              <div className="settings-row-action">
                {handler.status === "ours" ? (
                  <span className="settings-pill settings-pill-on">✓ Default</span>
                ) : (
                  <button
                    className="settings-button-primary"
                    onClick={() => void makeDefault()}
                    disabled={applying || handler.status === "loading"}
                  >
                    {applying ? "Setting…" : "Set as default"}
                  </button>
                )}
              </div>
            </div>
            <p className="settings-note">
              Applies to <code>.md</code>, <code>.mdx</code>, and{" "}
              <code>.markdown</code>. If you change your mind later, you can
              switch back via Finder → Get Info → "Open with…" → Change All.
            </p>
          </section>
        </div>
        <footer className="settings-footer">
          <span className="settings-hint">
            <kbd>esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
}
