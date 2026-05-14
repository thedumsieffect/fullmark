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

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 520;
export const SIDEBAR_COLLAPSE_THRESHOLD = 96;

type UIState = {
  readerMode: boolean;
  lightThemeFamily: ThemeFamilyId;
  darkThemeFamily: ThemeFamilyId;
  appearancePreference: AppearancePreference;
  themePreviewAppearance: ResolvedAppearance | null;
  viewMode: ViewMode;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  toggleReaderMode: () => void;
  setReaderMode: (v: boolean) => void;
  cycleAppearance: () => void;
  setAppearancePreference: (t: AppearancePreference) => void;
  setLightThemeFamily: (t: ThemeFamilyId) => void;
  setDarkThemeFamily: (t: ThemeFamilyId) => void;
  setThemePreviewAppearance: (t: ResolvedAppearance | null) => void;
  toggleViewMode: () => void;
  setViewMode: (v: ViewMode) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

const NEXT_APPEARANCE: Record<AppearancePreference, AppearancePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function isViewMode(value: unknown): value is ViewMode {
  return value === "rendered" || value === "source";
}

function clampSidebarWidth(width: unknown): number {
  if (typeof width !== "number" || !Number.isFinite(width)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
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
    sidebarWidth: clampSidebarWidth(state.sidebarWidth),
    sidebarCollapsed: state.sidebarCollapsed ?? false,
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
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      sidebarCollapsed: false,
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
      setSidebarWidth: (width) =>
        set({
          sidebarWidth: clampSidebarWidth(width),
          sidebarCollapsed: false,
        }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "fullmark.ui",
      version: 4,
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
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
