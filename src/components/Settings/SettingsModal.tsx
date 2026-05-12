/**
 * Settings modal (Cmd+, to open).
 *
 * Current settings:
 *   - Theme family and appearance preference.
 *   - Default app for .md / .mdx / .markdown via macOS LaunchServices.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore, type AppearancePreference } from "@/stores/ui";
import {
  THEME_FAMILIES,
  THEME_FAMILY_BY_ID,
  getThemeFamilyName,
  resolveAppearancePreference,
  themeSupportsAppearance,
  type ResolvedAppearance,
  type ThemeFamilyId,
} from "@/services/themes";

interface Props {
  open: boolean;
  onClose: () => void;
}

type DefaultHandlerState =
  | { status: "loading" }
  | { status: "ours" }
  | { status: "other"; bundleId: string | null }
  | { status: "error"; message: string };

const APPEARANCE_OPTIONS: Array<{
  value: AppearancePreference;
  label: string;
}> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsModal({ open, onClose }: Props) {
  const [handler, setHandler] = useState<DefaultHandlerState>({
    status: "loading",
  });
  const [applying, setApplying] = useState(false);
  const [themeSlot, setThemeSlot] = useState<ResolvedAppearance>("light");
  const lightThemeFamily = useUIStore((s) => s.lightThemeFamily);
  const darkThemeFamily = useUIStore((s) => s.darkThemeFamily);
  const appearancePreference = useUIStore((s) => s.appearancePreference);
  const setLightThemeFamily = useUIStore((s) => s.setLightThemeFamily);
  const setDarkThemeFamily = useUIStore((s) => s.setDarkThemeFamily);
  const setAppearancePreference = useUIStore(
    (s) => s.setAppearancePreference,
  );
  const setThemePreviewAppearance = useUIStore(
    (s) => s.setThemePreviewAppearance,
  );
  const selectedThemeFamily =
    themeSlot === "light" ? lightThemeFamily : darkThemeFamily;
  const availableThemeFamilies = THEME_FAMILIES.filter((theme) =>
    themeSupportsAppearance(theme, themeSlot),
  );
  const otherThemeFamily =
    themeSlot === "light" ? darkThemeFamily : lightThemeFamily;
  const otherThemeLabel =
    themeSlot === "light"
      ? `Dark: ${getThemeFamilyName(otherThemeFamily)}`
      : `Light: ${getThemeFamilyName(otherThemeFamily)}`;

  const setThemeFamily = (themeFamily: ThemeFamilyId) => {
    if (themeSlot === "light") {
      setLightThemeFamily(themeFamily);
    } else {
      setDarkThemeFamily(themeFamily);
    }
  };

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

  useEffect(() => {
    if (!open) return;
    const resolved = resolveAppearancePreference(
      appearancePreference,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    setThemeSlot(resolved);
    setThemePreviewAppearance(resolved);
    return () => setThemePreviewAppearance(null);
  }, [appearancePreference, open, setThemePreviewAppearance]);

  useEffect(() => {
    if (!open) return;
    setThemePreviewAppearance(themeSlot);
  }, [open, setThemePreviewAppearance, themeSlot]);

  useEffect(() => {
    if (!open) return;
    const selectedTheme = THEME_FAMILY_BY_ID[selectedThemeFamily];
    if (themeSupportsAppearance(selectedTheme, themeSlot)) return;
    setThemeFamily("fullmark");
  }, [open, selectedThemeFamily, themeSlot]);

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
            <div className="settings-section-header">
              <h3 className="settings-section-title">Theme</h3>
            </div>
            <div className="settings-row settings-row-stacked">
              <div className="settings-row-main">
                <div className="settings-row-title">Appearance</div>
                <div className="settings-row-desc">
                  Choose whether FullMark follows macOS or stays fixed.
                </div>
              </div>
              <div
                className="settings-segmented"
                role="group"
                aria-label="Appearance"
              >
                {APPEARANCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={
                      option.value === appearancePreference
                        ? "settings-segment settings-segment-active"
                        : "settings-segment"
                    }
                    onClick={() => setAppearancePreference(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row settings-row-stacked">
              <div className="settings-row-main">
                <div className="settings-row-title">Theme palettes</div>
                <div className="settings-row-desc">
                  Choose separate palettes for light and dark appearance.
                </div>
              </div>
              <div
                className="settings-segmented settings-segmented-themes"
                role="group"
                aria-label="Theme palette to edit"
              >
                <button
                  className={
                    themeSlot === "light"
                      ? "settings-segment settings-segment-active"
                      : "settings-segment"
                  }
                  onClick={() => setThemeSlot("light")}
                  type="button"
                  title={`Light: ${getThemeFamilyName(lightThemeFamily)}`}
                >
                  Light
                </button>
                <button
                  className={
                    themeSlot === "dark"
                      ? "settings-segment settings-segment-active"
                      : "settings-segment"
                  }
                  onClick={() => setThemeSlot("dark")}
                  type="button"
                  title={`Dark: ${getThemeFamilyName(darkThemeFamily)}`}
                >
                  Dark
                </button>
              </div>
              <div className="settings-theme-pair">
                Editing {themeSlot}; {otherThemeLabel}
              </div>
            </div>
            <div className="settings-theme-grid" role="list">
              {availableThemeFamilies.map((theme) => {
                const primarySwatch = theme.swatches[themeSlot];
                const alternateSwatch =
                  themeSlot === "light"
                    ? theme.swatches.dark
                    : theme.swatches.light;

                return (
                  <button
                    key={theme.id}
                    className={
                      theme.id === selectedThemeFamily
                        ? "settings-theme-card settings-theme-card-active"
                        : "settings-theme-card"
                    }
                    onClick={() => setThemeFamily(theme.id)}
                    type="button"
                    role="listitem"
                    aria-pressed={theme.id === selectedThemeFamily}
                  >
                    <span
                      className="settings-theme-swatches"
                      aria-hidden="true"
                    >
                      <span
                        className="settings-theme-swatch settings-theme-swatch-primary"
                        style={{ background: primarySwatch }}
                      />
                      {alternateSwatch ? (
                        <span
                          className="settings-theme-swatch"
                          style={{ background: alternateSwatch }}
                        />
                      ) : null}
                      <span
                        className="settings-theme-swatch settings-theme-swatch-accent"
                        style={{ background: theme.swatches.accent }}
                      />
                    </span>
                    <span className="settings-theme-name">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section-header">
              <h3 className="settings-section-title">Files</h3>
            </div>
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
                  <span className="settings-pill settings-pill-on">
                    ✓ Default
                  </span>
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
