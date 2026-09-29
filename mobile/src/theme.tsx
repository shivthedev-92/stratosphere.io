import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

// Tokens from design/handoff-mobile/README.md (Night & Dawn).
export type ThemeName = "night" | "dawn";
export type ThemePreference = ThemeName | "system";

export type Colors = {
  bg: string;
  sunken: string;
  sheet: string;
  raised: string;
  seg: string;
  bar: string;
  scrim: string;
  ink: string;
  muted: string;
  subtle: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  low: string;
  med: string;
  high: string;
  lowBg: string;
  medBg: string;
  highBg: string;
  nd: string;
  danger: string;
  heat: [string, string, string, string];
  glow: string;
  gradient: [string, string];
};

const night: Colors = {
  bg: "#0B0A14",
  sunken: "#13121F",
  sheet: "#13121F",
  raised: "#1C1A2B",
  seg: "#2A2840",
  bar: "rgba(11,10,20,0.92)",
  scrim: "rgba(3,2,10,0.6)",
  ink: "#F3F2F8",
  muted: "#A6A3B8",
  subtle: "#8A879E",
  line: "#2A2840",
  lineStrong: "#3A3857",
  accent: "#5B4CF0",
  accentSoft: "rgba(107,92,255,0.18)",
  accentText: "#A79BFF",
  low: "#3CCFB4",
  med: "#6CC0F5",
  high: "#F2B24C",
  lowBg: "rgba(60,207,180,0.14)",
  medBg: "rgba(108,192,245,0.14)",
  highBg: "rgba(242,178,76,0.14)",
  nd: "#8A879E",
  danger: "#F0707A",
  heat: ["#2A2840", "#2B2275", "#4A3CE0", "#8676FF"],
  glow: "#6B5CFF",
  gradient: ["#15123A", "#0B0A14"],
};

const dawn: Colors = {
  bg: "#F7F5F1",
  sunken: "#F3F0EA",
  sheet: "#F7F5F1",
  raised: "#FFFFFF",
  seg: "#FFFFFF",
  bar: "rgba(247,245,241,0.94)",
  scrim: "rgba(22,21,31,0.35)",
  ink: "#16151F",
  muted: "#56536A",
  subtle: "#6E6B7E",
  line: "#E6E2DA",
  lineStrong: "#CFC9BE",
  accent: "#4A3CE0",
  accentSoft: "rgba(74,60,224,0.10)",
  accentText: "#4A3CE0",
  low: "#0E8A76",
  med: "#1C73B0",
  high: "#9A5F08",
  lowBg: "rgba(14,138,118,0.10)",
  medBg: "rgba(28,115,176,0.10)",
  highBg: "rgba(154,95,8,0.10)",
  nd: "#6E6B7E",
  danger: "#C0323F",
  heat: ["#E6E2DA", "#E2DEFF", "#A79BFF", "#4A3CE0"],
  glow: "#F2A76B",
  gradient: ["#EEEBF7", "#FBE2CF"],
};

export const palettes: Record<ThemeName, Colors> = { night, dawn };

export const fonts = {
  regular: "InstrumentSans_400Regular",
  medium: "InstrumentSans_500Medium",
  semibold: "InstrumentSans_600SemiBold",
  journal: "Newsreader_400Regular_Italic",
} as const;

export const radius = { chip: 8, control: 14, card: 18, sheet: 28, full: 999 } as const;
export const hitTarget = 44;

const THEME_KEY = "stratosphere_mobile_theme";

/** Saved values from the old Dusk/Dark/Blue picker map onto Night and Dawn. */
export function migrateThemePreference(value: string | null): ThemePreference {
  if (value === "night" || value === "dawn" || value === "system") return value;
  if (value === "dusk" || value === "dark") return "night";
  if (value === "blue") return "dawn";
  return "system";
}

type ThemeContextValue = {
  name: ThemeName;
  colors: Colors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((saved) => {
      const migrated = migrateThemePreference(saved);
      setPreferenceState(migrated);
      if (saved !== null && saved !== migrated) SecureStore.setItemAsync(THEME_KEY, migrated);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(THEME_KEY, next);
  }, []);

  const name: ThemeName = preference === "system" ? (scheme === "light" ? "dawn" : "night") : preference;
  const value = useMemo(
    () => ({ name, colors: palettes[name], preference, setPreference }),
    [name, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
