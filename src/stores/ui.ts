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

const READER_ZOOM_LEVELS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const DEFAULT_READER_ZOOM = 1;

type UIState = {
  readerMode: boolean;
  readerZoom: number;
  lightThemeFamily: ThemeFamilyId;
  darkThemeFamily: ThemeFamilyId;
  appearancePreference: AppearancePreference;
  themePreviewAppearance: ResolvedAppearance | null;
  viewMode: ViewMode;
  toggleReaderMode: () => void;
  setReaderMode: (v: boolean) => void;
  zoomReaderIn: () => void;
  zoomReaderOut: () => void;
  resetReaderZoom: () => void;
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

function sanitizeReaderZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_READER_ZOOM;
  }
  return READER_ZOOM_LEVELS.reduce((closest, level) =>
    Math.abs(level - value) < Math.abs(closest - value) ? level : closest,
  );
}

function stepReaderZoom(current: number, direction: -1 | 1): number {
  const normalized = sanitizeReaderZoom(current);
  const index = READER_ZOOM_LEVELS.indexOf(normalized);
  const nextIndex = Math.min(
    Math.max(index + direction, 0),
    READER_ZOOM_LEVELS.length - 1,
  );
  return READER_ZOOM_LEVELS[nextIndex];
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
    readerZoom: sanitizeReaderZoom(state.readerZoom),
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
      readerZoom: DEFAULT_READER_ZOOM,
      lightThemeFamily: "fullmark",
      darkThemeFamily: "fullmark",
      appearancePreference: "system",
      themePreviewAppearance: null,
      viewMode: "rendered",
      toggleReaderMode: () => set((s) => ({ readerMode: !s.readerMode })),
      setReaderMode: (v) => set({ readerMode: v }),
      zoomReaderIn: () =>
        set((s) => ({ readerZoom: stepReaderZoom(s.readerZoom, 1) })),
      zoomReaderOut: () =>
        set((s) => ({ readerZoom: stepReaderZoom(s.readerZoom, -1) })),
      resetReaderZoom: () => set({ readerZoom: DEFAULT_READER_ZOOM }),
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
        readerZoom: state.readerZoom,
        lightThemeFamily: state.lightThemeFamily,
        darkThemeFamily: state.darkThemeFamily,
        appearancePreference: state.appearancePreference,
        viewMode: state.viewMode,
      }),
    },
  ),
);
