/**
 * UI mode store — reader mode + theme preference.
 * Persisted so the user's preferences survive restarts.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

type UIState = {
  readerMode: boolean;
  themePreference: ThemePreference;
  toggleReaderMode: () => void;
  setReaderMode: (v: boolean) => void;
  cycleTheme: () => void;
  setThemePreference: (t: ThemePreference) => void;
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
      toggleReaderMode: () => set((s) => ({ readerMode: !s.readerMode })),
      setReaderMode: (v) => set({ readerMode: v }),
      cycleTheme: () =>
        set((s) => ({ themePreference: NEXT_THEME[s.themePreference] })),
      setThemePreference: (t) => set({ themePreference: t }),
    }),
    { name: "fullmark.ui" },
  ),
);
