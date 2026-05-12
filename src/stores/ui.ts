import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type AppearancePreference,
  type ResolvedAppearance,
  type ThemeFamilyId,
  isAppearancePreference,
  isThemeFamilyId,
} from "@/services/themes";

export type { AppearancePreference, ResolvedAppearance, ThemeFamilyId };

export type ViewMode = "rendered" | "source";

type UIState = {
  readerMode: boolean;
  lightThemeFamily: ThemeFamilyId;
  darkThemeFamily: ThemeFamilyId;
  appearancePreference: AppearancePreference;
  themePreviewAppearance: ResolvedAppearance | null;
  viewMode: ViewMode;
  toggleReaderMode: () => void;
  setReaderMode: (v: boolean) => void;
  cycleAppearance: () => void;
  setAppearancePreference: (t: AppearancePreference) => void;
  setLightThemeFamily: (t: ThemeFamilyId) => void;
  setDarkThemeFamily: (t: ThemeFamilyId) => void;
  setThemePreviewAppearance: (t: ResolvedAppearance | null) => void;
  toggleViewMode: () => void;
  setViewMode: (v: ViewMode) => void;
};

const NEXT_APPEARANCE: Record<AppearancePreference, AppearancePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function isViewMode(value: unknown): value is ViewMode {
  return value === "rendered" || value === "source";
}

type PersistedUIState = Partial<UIState> & {
  themeFamily?: ThemeFamilyId;
  themePreference?: AppearancePreference;
};

function sanitizePersistedUIState(
  state: PersistedUIState,
  fallback: UIState,
): UIState {
  const migratedThemeFamily = isThemeFamilyId(state.themeFamily)
    ? state.themeFamily
    : "fullmark";
  return {
    ...fallback,
    readerMode: state.readerMode ?? false,
    lightThemeFamily: isThemeFamilyId(state.lightThemeFamily)
      ? state.lightThemeFamily
      : migratedThemeFamily,
    darkThemeFamily: isThemeFamilyId(state.darkThemeFamily)
      ? state.darkThemeFamily
      : migratedThemeFamily,
    appearancePreference: isAppearancePreference(state.appearancePreference)
      ? state.appearancePreference
      : isAppearancePreference(state.themePreference)
        ? state.themePreference
        : "system",
    themePreviewAppearance: null,
    viewMode: isViewMode(state.viewMode) ? state.viewMode : "rendered",
  };
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      readerMode: false,
      lightThemeFamily: "fullmark",
      darkThemeFamily: "fullmark",
      appearancePreference: "system",
      themePreviewAppearance: null,
      viewMode: "rendered",
      toggleReaderMode: () => set((s) => ({ readerMode: !s.readerMode })),
      setReaderMode: (v) => set({ readerMode: v }),
      cycleAppearance: () =>
        set((s) => ({
          appearancePreference: NEXT_APPEARANCE[s.appearancePreference],
        })),
      setAppearancePreference: (t) => set({ appearancePreference: t }),
      setLightThemeFamily: (t) => set({ lightThemeFamily: t }),
      setDarkThemeFamily: (t) => set({ darkThemeFamily: t }),
      setThemePreviewAppearance: (t) => set({ themePreviewAppearance: t }),
      toggleViewMode: () =>
        set((s) => ({
          viewMode: s.viewMode === "rendered" ? "source" : "rendered",
        })),
      setViewMode: (v) => set({ viewMode: v }),
    }),
    {
      name: "fullmark.ui",
      version: 3,
      migrate: (persisted) => {
        return persisted as UIState;
      },
      merge: (persisted, current) => {
        const persistedState =
          typeof persisted === "object" && persisted !== null
            ? (persisted as PersistedUIState)
            : {};
        return sanitizePersistedUIState(persistedState, current);
      },
      partialize: (state) => ({
        readerMode: state.readerMode,
        lightThemeFamily: state.lightThemeFamily,
        darkThemeFamily: state.darkThemeFamily,
        appearancePreference: state.appearancePreference,
        viewMode: state.viewMode,
      }),
    },
  ),
);
