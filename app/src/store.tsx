import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { AccentName, Screen, ThemePref, Track } from "./types";
import { applyTheme, resolveTheme } from "./theme";

/**
 * Minimal app store via Context + useReducer. This intentionally maps 1:1 to the
 * prototype's state. For production, swap to Zustand/Redux and back `nowPlaying`
 * + `queue` + `position` with a real media session / Tauri audio backend.
 */
interface State {
  screen: Screen;
  detailId: string | null;
  themePref: ThemePref;
  accent: AccentName;
  libTab: string;
  playing: boolean;
  npOpen: boolean; // full-screen now playing
  miniOpen: boolean; // floating mini window
  lyricsOpen: boolean; // floating lyrics window
  nowPlaying: Track | null;
  menu: { x: number; y: number; track: Track } | null; // right-click context menu
  importOpen: boolean; // Spotify import modal
}

type Action =
  | { type: "go"; screen: Screen }
  | { type: "openDetail"; id: string }
  | { type: "setThemePref"; pref: ThemePref }
  | { type: "setAccent"; accent: AccentName }
  | { type: "setLibTab"; tab: string }
  | { type: "togglePlay" }
  | { type: "play"; track: Track }
  | { type: "setNp"; open: boolean }
  | { type: "setMini"; open: boolean }
  | { type: "setLyrics"; open: boolean }
  | { type: "openMenu"; x: number; y: number; track: Track }
  | { type: "closeMenu" }
  | { type: "setImport"; open: boolean };

const initial: State = {
  screen: "home",
  detailId: null,
  themePref: "light",
  accent: "Amber",
  libTab: "Playlists",
  playing: true,
  npOpen: false,
  miniOpen: false,
  lyricsOpen: false,
  nowPlaying: null,
  menu: null,
  importOpen: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "go":
      return { ...s, screen: a.screen };
    case "openDetail":
      return { ...s, screen: "detail", detailId: a.id };
    case "setThemePref":
      return { ...s, themePref: a.pref };
    case "setAccent":
      return { ...s, accent: a.accent };
    case "setLibTab":
      return { ...s, libTab: a.tab };
    case "togglePlay":
      return { ...s, playing: !s.playing };
    case "play":
      return { ...s, nowPlaying: a.track, playing: true };
    case "setNp":
      return { ...s, npOpen: a.open };
    case "setMini":
      return { ...s, miniOpen: a.open };
    case "setLyrics":
      return { ...s, lyricsOpen: a.open };
    case "openMenu":
      return { ...s, menu: { x: a.x, y: a.y, track: a.track } };
    case "closeMenu":
      return { ...s, menu: null };
    case "setImport":
      return { ...s, importOpen: a.open };
    default:
      return s;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // Re-apply theme whenever pref/accent changes (and on system theme change in auto mode).
  useEffect(() => {
    applyTheme(resolveTheme(state.themePref), state.accent);
    if (state.themePref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("auto"), state.accent);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state.themePref, state.accent]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
