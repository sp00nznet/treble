import type { AccentName, ThemeName } from "./types";

/** Accent palette — { flat color per theme, soft tint, gradient } — from the design system. */
export const ACCENTS: Record<
  AccentName,
  { light: string; lightSoft: string; dark: string; darkSoft: string; grad: string }
> = {
  Amber: {
    light: "#E2622E",
    lightSoft: "rgba(226,98,46,.12)",
    dark: "#FF9A5C",
    darkSoft: "rgba(255,138,76,.14)",
    grad: "linear-gradient(135deg,#FFB35C,#FF6B5C)",
  },
  Coral: {
    light: "#E0463E",
    lightSoft: "rgba(224,70,62,.12)",
    dark: "#FF7A6B",
    darkSoft: "rgba(255,122,107,.15)",
    grad: "linear-gradient(135deg,#FF8A6B,#FF4E5C)",
  },
  Rose: {
    light: "#D2456A",
    lightSoft: "rgba(210,69,106,.12)",
    dark: "#FF8AB0",
    darkSoft: "rgba(255,138,176,.15)",
    grad: "linear-gradient(135deg,#FF8AB0,#E84E7C)",
  },
  Gold: {
    light: "#B5851A",
    lightSoft: "rgba(181,133,26,.14)",
    dark: "#F2C24E",
    darkSoft: "rgba(242,194,78,.16)",
    grad: "linear-gradient(135deg,#FFD27A,#F2A93E)",
  },
};

/**
 * Apply theme + accent by toggling `data-theme` (drives the neutral palette in
 * tokens.css) and writing the accent CSS variables on :root. Mirrors the
 * prototype's applyTheme() — keep this as the single source of theming truth.
 */
export function applyTheme(theme: ThemeName, accent: AccentName) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const a = ACCENTS[accent];
  root.style.setProperty("--accent", theme === "dark" ? a.dark : a.light);
  root.style.setProperty("--accent-soft", theme === "dark" ? a.darkSoft : a.lightSoft);
  root.style.setProperty("--accent-grad", a.grad);
}

export function resolveTheme(pref: "light" | "dark" | "auto"): ThemeName {
  if (pref === "auto") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}
