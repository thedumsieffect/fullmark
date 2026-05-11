/**
 * UI mode store — reader mode, theme preference, and rendered/source view.
 * Persisted so the user's preferences survive restarts.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";
export type ViewMode = "rendered" | "source";

type UIState = {
  readerMode: boolean;
  themePreference: ThemePreference;
  viewMode: ViewMode;
  toggleReaderMode: () => void;
  setReaderMode: (v: boolean) => void;
  cycleTheme: () => void;
  setThemePreference: (t: ThemePreference) => void;
  toggleViewMode: () => void;
  setViewMode: (v: ViewMode) => void;
};

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      readerMode: false,
      themePreference: "system",
      viewMode: "rendered",
      toggleReaderMode: () => set((s) => ({ readerMode: !s.readerMode })),
      setReaderMode: (v) => set({ readerMode: v }),
      cycleTheme: () =>
        set((s) => ({ themePreference: NEXT_THEME[s.themePreference] })),
      setThemePreference: (t) => set({ themePreference: t }),
      toggleViewMode: () =>
        set((s) => ({
          viewMode: s.viewMode === "rendered" ? "source" : "rendered",
        })),
      setViewMode: (v) => set({ viewMode: v }),
    }),
    { name: "fullmark.ui" },
  ),
);
