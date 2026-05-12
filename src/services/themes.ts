export type AppearancePreference = "system" | "light" | "dark";
export type ResolvedAppearance = "light" | "dark";

export type ThemeFamilyId =
  | "fullmark"
  | "red-graphite"
  | "high-contrast"
  | "sepia"
  | "ink"
  | "paper"
  | "graphite"
  | "notes"
  | "academia"
  | "ayu"
  | "gruvbox"
  | "monokai"
  | "material"
  | "night-owl"
  | "nord"
  | "one-dark"
  | "dracula"
  | "rose-pine"
  | "tokyo-night"
  | "everforest"
  | "catppuccin"
  | "solarized"
  | "github"
  | "vscode-plus";

export type ThemeFamily = {
  id: ThemeFamilyId;
  name: string;
  swatches: {
    light?: string;
    dark?: string;
    accent: string;
  };
  syntax: Partial<Record<ResolvedAppearance, string>>;
};

export const THEME_FAMILIES: ThemeFamily[] = [
  {
    id: "fullmark",
    name: "FullMark",
    swatches: { light: "#fafaf7", dark: "#1a1715", accent: "#b65a2e" },
    syntax: { light: "vitesse-light", dark: "vitesse-dark" },
  },
  {
    id: "red-graphite",
    name: "Red Graphite",
    swatches: { light: "#f6f2f0", dark: "#211d1f", accent: "#d84e47" },
    syntax: { light: "github-light-default", dark: "github-dark-default" },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    swatches: { light: "#ffffff", dark: "#000000", accent: "#d12d2d" },
    syntax: { light: "light-plus", dark: "dark-plus" },
  },
  {
    id: "sepia",
    name: "Sepia",
    swatches: { light: "#f6ecd8", dark: "#2a2118", accent: "#9c6a35" },
    syntax: { light: "solarized-light", dark: "ayu-dark" },
  },
  {
    id: "ink",
    name: "Ink",
    swatches: { light: "#f7f7f4", dark: "#111111", accent: "#4d6f8f" },
    syntax: { light: "vitesse-light", dark: "vitesse-dark" },
  },
  {
    id: "paper",
    name: "Paper",
    swatches: { light: "#fffdf8", dark: "#202124", accent: "#6f7f54" },
    syntax: { light: "light-plus", dark: "dark-plus" },
  },
  {
    id: "graphite",
    name: "Graphite",
    swatches: { light: "#f3f3f1", dark: "#202020", accent: "#777777" },
    syntax: { light: "github-light-default", dark: "github-dark-default" },
  },
  {
    id: "notes",
    name: "Notes",
    swatches: { light: "#fffbea", dark: "#1c1c1e", accent: "#c58a00" },
    syntax: { light: "light-plus", dark: "dark-plus" },
  },
  {
    id: "academia",
    name: "Academia",
    swatches: { light: "#f0f3e8", dark: "#1f2a24", accent: "#4f7d62" },
    syntax: { light: "everforest-light", dark: "everforest-dark" },
  },
  {
    id: "ayu",
    name: "Ayu",
    swatches: { dark: "#0b0e14", accent: "#ffb454" },
    syntax: { dark: "ayu-dark" },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    swatches: { light: "#fbf1c7", dark: "#282828", accent: "#b57614" },
    syntax: { light: "gruvbox-light-medium", dark: "gruvbox-dark-medium" },
  },
  {
    id: "monokai",
    name: "Monokai",
    swatches: { light: "#f7f2e9", dark: "#272822", accent: "#a6e22e" },
    syntax: { dark: "monokai" },
  },
  {
    id: "material",
    name: "Material",
    swatches: { dark: "#212121", accent: "#80cbc4" },
    syntax: { dark: "material-theme-darker" },
  },
  {
    id: "night-owl",
    name: "Night Owl",
    swatches: { dark: "#011627", accent: "#82aaff" },
    syntax: { dark: "night-owl" },
  },
  {
    id: "nord",
    name: "Nord",
    swatches: { light: "#eceff4", dark: "#2e3440", accent: "#88c0d0" },
    syntax: { dark: "nord" },
  },
  {
    id: "one-dark",
    name: "One",
    swatches: { light: "#fafafa", dark: "#282c34", accent: "#61afef" },
    syntax: { light: "one-light", dark: "one-dark-pro" },
  },
  {
    id: "dracula",
    name: "Dracula",
    swatches: { light: "#fff8fb", dark: "#282a36", accent: "#ff79c6" },
    syntax: { dark: "dracula" },
  },
  {
    id: "rose-pine",
    name: "Rose Pine",
    swatches: { light: "#faf4ed", dark: "#232136", accent: "#907aa9" },
    syntax: { light: "rose-pine-dawn", dark: "rose-pine-moon" },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    swatches: { light: "#f2f4ff", dark: "#1a1b26", accent: "#7aa2f7" },
    syntax: { dark: "tokyo-night" },
  },
  {
    id: "everforest",
    name: "Everforest",
    swatches: { light: "#fdf6e3", dark: "#2d353b", accent: "#8da101" },
    syntax: { light: "everforest-light", dark: "everforest-dark" },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    swatches: { light: "#eff1f5", dark: "#1e1e2e", accent: "#8839ef" },
    syntax: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
  },
  {
    id: "solarized",
    name: "Solarized",
    swatches: { light: "#fdf6e3", dark: "#002b36", accent: "#b58900" },
    syntax: { light: "solarized-light", dark: "solarized-dark" },
  },
  {
    id: "github",
    name: "GitHub",
    swatches: { light: "#ffffff", dark: "#0d1117", accent: "#0969da" },
    syntax: { light: "github-light-default", dark: "github-dark-default" },
  },
  {
    id: "vscode-plus",
    name: "VS Code Plus",
    swatches: { light: "#ffffff", dark: "#1e1e1e", accent: "#007acc" },
    syntax: { light: "light-plus", dark: "dark-plus" },
  },
];

export const THEME_FAMILY_IDS = THEME_FAMILIES.map((theme) => theme.id);

export const THEME_FAMILY_BY_ID = Object.fromEntries(
  THEME_FAMILIES.map((theme) => [theme.id, theme]),
) as Record<ThemeFamilyId, ThemeFamily>;

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isThemeFamilyId(value: unknown): value is ThemeFamilyId {
  return (
    typeof value === "string" &&
    THEME_FAMILY_IDS.includes(value as ThemeFamilyId)
  );
}

export function getThemeFamily(value: unknown): ThemeFamily {
  return isThemeFamilyId(value) ? THEME_FAMILY_BY_ID[value] : THEME_FAMILY_BY_ID.fullmark;
}

export function getThemeFamilyName(value: unknown): string {
  return getThemeFamily(value).name;
}

export function themeSupportsAppearance(
  theme: ThemeFamily | undefined,
  appearance: ResolvedAppearance,
): boolean {
  return Boolean(theme?.swatches[appearance]);
}

export function resolveThemeFamilyId(
  appearance: ResolvedAppearance,
  lightThemeFamily: unknown,
  darkThemeFamily: unknown,
): ThemeFamilyId {
  const themeFamily = appearance === "dark" ? darkThemeFamily : lightThemeFamily;
  if (!isThemeFamilyId(themeFamily)) return "fullmark";
  const theme = THEME_FAMILY_BY_ID[themeFamily];
  return themeSupportsAppearance(theme, appearance) ? themeFamily : "fullmark";
}

export function resolveAppearancePreference(
  preference: AppearancePreference,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}
