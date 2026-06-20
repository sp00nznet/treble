import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { AccentName, Screen, ThemePref, Track } from "./types";
import { applyTheme, resolveTheme } from "./theme";
import { trackDuration } from "./lib/format";
import { likedIds as fetchLikedIds } from "./lib/api";

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
  loading: boolean; // resolving/buffering the current track's stream
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
  autoDownload: boolean; // cache tracks for offline as they're played
  back: NavEntry[]; // navigation history (back stack)
  forward: NavEntry[]; // navigation history (forward stack)
  podcast: { feedUrl: string; title: string; author: string; art: string } | null; // open show
  // --- play queue / playback context ---
  srcQueue: Track[]; // the queue in its original (unshuffled) order
  queue: Track[]; // effective play order (== srcQueue, or shuffled)
  queueIndex: number; // index of nowPlaying within `queue`
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  playToken: number; // bumps to force a replay of the same track (repeat one / restart)
  // --- liked songs ---
  likedIds: string[]; // ids of liked tracks (mirrors the DB for quick lookup)
  // --- search seeding (Go to artist / album) ---
  pendingSearch: string | null;
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
  | { type: "play"; track: Track; queue?: Track[] }
  | { type: "next"; auto?: boolean } // auto = fired by track-end (honors repeat one)
  | { type: "prev" }
  | { type: "enqueue"; track: Track } // add to end of queue
  | { type: "playNext"; track: Track } // insert right after current
  | { type: "clearQueue" }
  | { type: "toggleShuffle" }
  | { type: "cycleRepeat" }
  | { type: "setLiked"; ids: string[] }
  | { type: "toggleLikedLocal"; id: string; liked: boolean }
  | { type: "seedSearch"; query: string }
  | { type: "clearSearchSeed" }
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
  | { type: "openPodcast"; show: { feedUrl: string; title: string; author: string; art: string } }
  | { type: "setVolume"; volume: number }
  | { type: "setLoading"; loading: boolean }
  | { type: "setAutoDownload"; on: boolean };

const initial: State = {
  screen: (() => { try { return (localStorage.getItem("treble.defaultTab") as Screen) || "home"; } catch { return "home"; } })(),
  detailId: null,
  themePref: "light",
  accent: "Amber",
  libTab: "Playlists",
  playing: false,
  loading: false,
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
  autoDownload: (() => { try { return localStorage.getItem("treble.autoDownload") === "1"; } catch { return false; } })(),
  back: [],
  forward: [],
  podcast: null,
  srcQueue: [],
  queue: [],
  queueIndex: 0,
  shuffle: (() => { try { return localStorage.getItem("treble.shuffle") === "1"; } catch { return false; } })(),
  repeat: (() => { try { return (localStorage.getItem("treble.repeat") as State["repeat"]) || "off"; } catch { return "off"; } })(),
  playToken: 0,
  likedIds: [],
  pendingSearch: null,
};

/** Fisher–Yates shuffle of a copy (browser Math.random is fine here). */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build the effective play order for a queue + current track, honoring shuffle. */
function orderFor(src: Track[], current: Track, shuffle: boolean): { queue: Track[]; index: number } {
  if (!shuffle) {
    const index = Math.max(0, src.findIndex((t) => t.id === current.id));
    return { queue: src, index };
  }
  const rest = src.filter((t) => t.id !== current.id);
  return { queue: [current, ...shuffled(rest)], index: 0 };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "go":
      if (a.screen === s.screen && s.screen !== "detail") return s;
      return { ...s, screen: a.screen, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
    case "openDetail":
      return { ...s, screen: "detail", detailId: a.id, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
    case "openPodcast":
      return { ...s, screen: "podcast", podcast: a.show, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
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
    case "play": {
      const src = a.queue && a.queue.length ? a.queue : [a.track];
      const { queue, index } = orderFor(src, a.track, s.shuffle);
      return {
        ...s,
        nowPlaying: a.track,
        srcQueue: src,
        queue,
        queueIndex: index,
        playing: true,
        loading: true,
        positionSecs: 0,
        durationSecs: trackDuration(a.track),
        pendingSeek: null,
        playToken: s.playToken + 1,
      };
    }
    case "next": {
      if (s.queue.length === 0) return s;
      // Auto-advance (track ended) with repeat-one → replay the same track.
      if (a.auto && s.repeat === "one") {
        return { ...s, positionSecs: 0, playing: true, loading: true, playToken: s.playToken + 1 };
      }
      let i = s.queueIndex + 1;
      if (i >= s.queue.length) {
        if (s.repeat === "all") i = 0;
        else return { ...s, playing: false }; // end of queue
      }
      const track = s.queue[i];
      return { ...s, nowPlaying: track, queueIndex: i, playing: true, loading: true, positionSecs: 0, durationSecs: trackDuration(track), pendingSeek: null, playToken: s.playToken + 1 };
    }
    case "prev": {
      if (s.queue.length === 0) return s;
      const i = Math.max(0, s.queueIndex - 1);
      const track = s.queue[i];
      return { ...s, nowPlaying: track, queueIndex: i, playing: true, loading: true, positionSecs: 0, durationSecs: trackDuration(track), pendingSeek: null, playToken: s.playToken + 1 };
    }
    case "enqueue":
      if (!s.nowPlaying) return reducer(s, { type: "play", track: a.track });
      return { ...s, srcQueue: [...s.srcQueue, a.track], queue: [...s.queue, a.track] };
    case "playNext": {
      if (!s.nowPlaying) return reducer(s, { type: "play", track: a.track });
      const q = [...s.queue];
      q.splice(s.queueIndex + 1, 0, a.track);
      return { ...s, queue: q, srcQueue: [...s.srcQueue, a.track] };
    }
    case "clearQueue": {
      if (!s.nowPlaying) return { ...s, srcQueue: [], queue: [], queueIndex: 0 };
      return { ...s, srcQueue: [s.nowPlaying], queue: [s.nowPlaying], queueIndex: 0 };
    }
    case "toggleShuffle": {
      const shuffle = !s.shuffle;
      try { localStorage.setItem("treble.shuffle", shuffle ? "1" : "0"); } catch { /* ignore */ }
      if (!s.nowPlaying) return { ...s, shuffle };
      const { queue, index } = orderFor(s.srcQueue.length ? s.srcQueue : s.queue, s.nowPlaying, shuffle);
      return { ...s, shuffle, queue, queueIndex: index };
    }
    case "cycleRepeat": {
      const order: State["repeat"][] = ["off", "all", "one"];
      const repeat = order[(order.indexOf(s.repeat) + 1) % order.length];
      try { localStorage.setItem("treble.repeat", repeat); } catch { /* ignore */ }
      return { ...s, repeat };
    }
    case "setLiked":
      return { ...s, likedIds: a.ids };
    case "toggleLikedLocal":
      return { ...s, likedIds: a.liked ? [...new Set([...s.likedIds, a.id])] : s.likedIds.filter((x) => x !== a.id) };
    case "seedSearch":
      return { ...s, screen: "search", pendingSearch: a.query, back: [...s.back, { screen: s.screen, detailId: s.detailId }], forward: [] };
    case "clearSearchSeed":
      return { ...s, pendingSearch: null };
    case "setLoading":
      return { ...s, loading: a.loading };
    case "setAutoDownload":
      try { localStorage.setItem("treble.autoDownload", a.on ? "1" : "0"); } catch { /* ignore */ }
      return { ...s, autoDownload: a.on };
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

  // Load the set of liked track ids once so hearts reflect saved state everywhere.
  useEffect(() => {
    fetchLikedIds().then((ids) => dispatch({ type: "setLiked", ids })).catch(() => {});
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
