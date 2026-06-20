import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { AccentName, Screen, ThemePref, Track } from "./types";
import { applyTheme, resolveTheme } from "./theme";
import { trackDuration } from "./lib/format";

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
  positionSecs: number; // live playback position (driven by AudioEngine)
  durationSecs: number; // current track length
  pendingSeek: number | null; // UI requested a seek; AudioEngine applies & clears
  sleepEndsAt: number | null; // epoch ms when the sleep timer pauses playback
  libRefresh: number; // bump to force library/detail screens to reload from the DB
  volume: number; // 0..1, applied to the audio element
  back: NavEntry[]; // navigation history (back stack)
  forward: NavEntry[]; // navigation history (forward stack)
}

interface NavEntry {
  screen: Screen;
  detailId: string | null;
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
  | { type: "setImport"; open: boolean }
  | { type: "setProgress"; position: number; duration: number }
  | { type: "seek"; secs: number }
  | { type: "seekDone" }
  | { type: "setSleep"; endsAt: number | null }
  | { type: "refreshLibrary" }
  | { type: "navBack" }
  | { type: "navForward" }
  | { type: "setVolume"; volume: number };

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
  positionSecs: 0,
  durationSecs: 0,
  pendingSeek: null,
  sleepEndsAt: null,
  libRefresh: 0,
  volume: 1,
  back: [],
  forward: [],
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "go":
      if (a.screen === s.screen && s.screen !== "detail") return s;
      return { ...s, screen: a.screen, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
    case "openDetail":
      return { ...s, screen: "detail", detailId: a.id, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
    case "navBack": {
      if (s.back.length === 0) return s;
      const prev = s.back[s.back.length - 1];
      return { ...s, screen: prev.screen, detailId: prev.detailId, back: s.back.slice(0, -1), forward: [...s.forward, { screen: s.screen, detailId: s.detailId }] };
    }
    case "navForward": {
      if (s.forward.length === 0) return s;
      const next = s.forward[s.forward.length - 1];
      return { ...s, screen: next.screen, detailId: next.detailId, forward: s.forward.slice(0, -1), back: [...s.back, { screen: s.screen, detailId: s.detailId }] };
    }
    case "setThemePref":
      return { ...s, themePref: a.pref };
    case "setAccent":
      return { ...s, accent: a.accent };
    case "setLibTab":
      return { ...s, libTab: a.tab };
    case "togglePlay":
      return { ...s, playing: !s.playing };
    case "play":
      return {
        ...s,
        nowPlaying: a.track,
        playing: true,
        positionSecs: 0,
        durationSecs: trackDuration(a.track),
        pendingSeek: null,
      };
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
    case "setProgress":
      return { ...s, positionSecs: a.position, durationSecs: a.duration || s.durationSecs };
    case "seek":
      return { ...s, positionSecs: a.secs, pendingSeek: a.secs };
    case "seekDone":
      return { ...s, pendingSeek: null };
    case "setSleep":
      return { ...s, sleepEndsAt: a.endsAt };
    case "refreshLibrary":
      return { ...s, libRefresh: s.libRefresh + 1 };
    case "setVolume":
      return { ...s, volume: Math.max(0, Math.min(1, a.volume)) };
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
