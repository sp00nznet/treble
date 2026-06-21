import { useEffect, useState } from "react";
import {
  Home as HomeIcon, Search as SearchIcon, Library as LibIcon, Settings as SetIcon,
  Play, Pause, Heart, ChevronLeft, ChevronDown, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  ListMusic, MessageSquareText,
} from "lucide-react";
import { useStore } from "../store";
import { useLike } from "../lib/useLike";
import { useSyncedLyrics } from "../lib/useSyncedLyrics";
import { companionStatus } from "../lib/api";
import { coverBg } from "../lib/art";
import { fmtTime } from "../lib/format";
import { Scrubber } from "./Scrubber";
import { AudioEngine } from "./AudioEngine";
import { SyncReceiver } from "./SyncReceiver";
import { ContextMenu } from "./ContextMenu";
import { ImportModal } from "./ImportModal";
import { Home } from "../screens/Home";
import { Search } from "../screens/Search";
import { Explore } from "../screens/Explore";
import { Library } from "../screens/Library";
import { Detail } from "../screens/Detail";
import { Downloads } from "../screens/Downloads";
import { Queue } from "../screens/Queue";
import { Podcast } from "../screens/Podcast";
import { Settings } from "../screens/Settings";
import type { Screen } from "../types";

const TABS: { key: Screen; label: string; Icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "search", label: "Search", Icon: SearchIcon },
  { key: "library", label: "Library", Icon: LibIcon },
  { key: "settings", label: "Settings", Icon: SetIcon },
];

/** Which bottom tab is highlighted for a given screen. */
function navGroup(s: Screen): Screen {
  if (s === "explore") return "home";
  if (s === "detail" || s === "downloads" || s === "podcast") return "library";
  return s;
}
const TOP_LEVEL = new Set<Screen>(["home", "search", "library", "settings"]);

/**
 * The phone app shell — bottom tab bar + mini player, full-screen content, and a
 * vertical art-forward Now Playing overlay. Replaces the desktop titlebar/sidebar/
 * docked-panel layout entirely on Android/iOS (see design/README §Mobile).
 */
export function MobileApp() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const active = navGroup(state.screen);
  const onTopTab = TOP_LEVEL.has(state.screen);
  const [companion, setCompanion] = useState(true);

  // Suppress the webview's long-press context menu (we open our own on rows).
  useEffect(() => {
    const onCtx = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("input,textarea")) e.preventDefault(); };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  // A phone can't run yt-dlp, so it streams via a desktop "companion" on the LAN.
  // Poll for one and warn if none is found.
  useEffect(() => {
    let live = true;
    const check = () => companionStatus().then((c) => live && setCompanion(c)).catch(() => {});
    check();
    const t = setInterval(check, 5000);
    return () => { live = false; clearInterval(t); };
  }, []);

  return (
    <div className="mobile-app">
      <main className="mobile-content">
        {!onTopTab && (
          <button className="m-back press" onClick={() => dispatch({ type: "navBack" })} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
        )}
        {!companion && (
          <div style={{ margin: "8px 16px 0", padding: "10px 14px", borderRadius: 12, background: "var(--accent-soft)", border: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--accent)" }}>Open Treble on your computer</b> (same Wi-Fi) to stream — the phone plays through your desktop. Local files &amp; downloads work without it.
          </div>
        )}
        {renderScreen(state.screen)}
      </main>

      {!state.npOpen && (
        <div className="mobile-bottom">
          {np && (
            <button className="mini-bar press" onClick={() => dispatch({ type: "setNp", open: true })}>
              <span className="mini-art" style={{ background: coverBg(np.art, np.title) }} />
              <span className="mini-meta">
                <span className="ellipsis mini-title">{np.title}</span>
                <span className="ellipsis mini-sub">{np.artist}</span>
              </span>
              <span className="press" style={{ display: "flex", color: "var(--text)", padding: 4 }} onClick={(e) => { e.stopPropagation(); dispatch({ type: "togglePlay" }); }}>
                {state.playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </span>
            </button>
          )}
          <nav className="tab-bar">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} className={`tab${active === key ? " active" : ""}`} onClick={() => dispatch({ type: "go", screen: key })}>
                <Icon size={23} fill={active === key ? "currentColor" : "none"} strokeWidth={active === key ? 2.4 : 2} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      <AudioEngine />
      <SyncReceiver />
      {state.npOpen && <MobileNowPlaying />}
      <ContextMenu />
      <ImportModal />
    </div>
  );
}

/** Vertical, art-forward full-screen player for phones. */
function MobileNowPlaying() {
  const { state, dispatch } = useStore();
  const np = state.nowPlaying;
  const { isLiked, toggle } = useLike();
  const liked = np ? isLiked(np.id) : false;
  const skipBack = () => { if (state.positionSecs > 3) dispatch({ type: "seek", secs: 0 }); else dispatch({ type: "prev" }); };

  return (
    <div className="m-np">
      <div className="m-np-top">
        <button className="press iconbtn" onClick={() => dispatch({ type: "setNp", open: false })} aria-label="Close"><ChevronDown size={26} /></button>
        <span style={{ textAlign: "center", lineHeight: 1.2 }}>
          <span className="eyebrow" style={{ display: "block", color: "var(--text-3)" }}>Now playing</span>
          <span className="ellipsis" style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{np?.artist ?? ""}</span>
        </span>
        <button className="press iconbtn" onClick={() => { dispatch({ type: "setNp", open: false }); dispatch({ type: "go", screen: "queue" }); }} aria-label="Queue"><ListMusic size={24} /></button>
      </div>

      <div className="m-np-art" style={{ background: np ? coverBg(np.art, np.title) : "var(--surface-2)" }} />

      <div className="m-np-meta">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ellipsis" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-.01em" }}>{np?.title ?? "Nothing playing"}</div>
          <div className="ellipsis" style={{ fontSize: 15, color: "var(--text-2)", marginTop: 3 }}>{np ? [np.artist, np.album].filter(Boolean).join(" · ") : ""}</div>
        </div>
        <Heart size={26} className="press" style={{ color: liked ? "var(--accent)" : "var(--text-3)", flex: "none", cursor: "pointer" }} fill={liked ? "currentColor" : "none"} onClick={() => np && toggle(np)} />
      </div>

      <div style={{ margin: "6px 4px 4px" }}><Scrubber /></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-3)", padding: "0 4px" }}>
        <span>{fmtTime(state.positionSecs)}</span><span>{fmtTime(state.durationSecs)}</span>
      </div>

      <div className="m-np-controls">
        <Shuffle size={24} className="press" style={{ color: state.shuffle ? "var(--accent)" : "var(--text-2)" }} onClick={() => dispatch({ type: "toggleShuffle" })} />
        <SkipBack size={30} className="press" fill="currentColor" style={{ color: "var(--text)" }} onClick={skipBack} />
        <button className="fab press" style={{ width: 72, height: 72, boxShadow: "0 10px 26px rgba(255,107,92,.45)" }} onClick={() => dispatch({ type: "togglePlay" })}>
          {state.playing ? <Pause size={30} fill="#fff" /> : <Play size={30} fill="#fff" />}
        </button>
        <SkipForward size={30} className="press" fill="currentColor" style={{ color: "var(--text)" }} onClick={() => dispatch({ type: "next" })} />
        {state.repeat === "one"
          ? <Repeat1 size={24} className="press" style={{ color: "var(--accent)" }} onClick={() => dispatch({ type: "cycleRepeat" })} />
          : <Repeat size={24} className="press" style={{ color: state.repeat === "all" ? "var(--accent)" : "var(--text-2)" }} onClick={() => dispatch({ type: "cycleRepeat" })} />}
      </div>

      <div className="m-np-foot">
        <button className="press iconbtn" onClick={() => dispatch({ type: "setLyrics", open: true })}><MessageSquareText size={22} /><span>Lyrics</span></button>
      </div>

      {state.lyricsOpen && <MobileLyrics />}
    </div>
  );
}

/** Full-screen synced lyrics overlay (phone). */
function MobileLyrics() {
  const { state, dispatch } = useStore();
  // Lyrics are computed by the shared hook used in the desktop teaser/window.
  return (
    <div className="m-lyrics">
      <div className="m-np-top">
        <button className="press iconbtn" onClick={() => dispatch({ type: "setLyrics", open: false })} aria-label="Close"><ChevronDown size={26} /></button>
        <span className="eyebrow" style={{ color: "var(--text-3)" }}>Lyrics</span>
        <span style={{ width: 40 }} />
      </div>
      <LyricsBody />
      <div style={{ flex: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid var(--border)" }}>
        <span className="mini-art" style={{ background: coverBg(state.nowPlaying?.art, state.nowPlaying?.title ?? ""), width: 38, height: 38 }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{state.nowPlaying?.title}</span>
          <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{state.nowPlaying?.artist}</span>
        </span>
        <span className="press" style={{ display: "flex", color: "var(--text)" }} onClick={() => dispatch({ type: "togglePlay" })}>
          {state.playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </span>
      </div>
    </div>
  );
}

function LyricsBody() {
  const { lines, activeIndex, seekToLine } = useSyncedLyrics();
  if (lines.length === 0) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>No lyrics found.</div>;
  }
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
      {lines.map((l, i) => (
        <div key={i} onClick={() => seekToLine(i)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: i === activeIndex ? 26 : 20, lineHeight: 1.2, color: i === activeIndex ? "var(--accent)" : "var(--text-3)", transition: "color .3s,font-size .2s" }}>{l.text}</div>
      ))}
    </div>
  );
}

function renderScreen(screen: string) {
  switch (screen) {
    case "home": return <Home />;
    case "search": return <Search />;
    case "explore": return <Explore />;
    case "library": return <Library />;
    case "detail": return <Detail />;
    case "downloads": return <Downloads />;
    case "queue": return <Queue />;
    case "podcast": return <Podcast />;
    case "settings": return <Settings />;
    default: return <Home />;
  }
}
