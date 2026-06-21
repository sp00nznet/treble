import { useEffect } from "react";
import { useStore } from "./store";
import { isMobile } from "./lib/windows";
import { MobileApp } from "./components/MobileApp";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { NowPlaying } from "./components/NowPlaying";
import { ContextMenu } from "./components/ContextMenu";
import { MiniPlayer, LyricsWindow } from "./components/FloatingWindows";
import { AudioEngine } from "./components/AudioEngine";
import { ImportModal } from "./components/ImportModal";
import { Home } from "./screens/Home";
import { Search } from "./screens/Search";
import { Explore } from "./screens/Explore";
import { Library } from "./screens/Library";
import { Detail } from "./screens/Detail";
import { Downloads } from "./screens/Downloads";
import { Queue } from "./screens/Queue";
import { Podcast } from "./screens/Podcast";
import { Settings } from "./screens/Settings";
import { Placeholder } from "./screens/Placeholder";

// Phones (Android/iOS) get a dedicated mobile shell; `?mobile` forces it for
// previewing in a desktop browser.
const MOBILE = isMobile() || (typeof location !== "undefined" && location.search.includes("mobile"));

export function App() {
  const { state, dispatch } = useStore();

  // Global keyboard shortcuts: ⌘K / Ctrl+K → search, Esc → close top overlay.
  useEffect(() => {
    if (MOBILE) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch({ type: "go", screen: "search" });
        return;
      }
      if (e.key === "Escape") {
        if (state.menu) dispatch({ type: "closeMenu" });
        else if (state.npOpen) dispatch({ type: "setNp", open: false });
        else if (state.lyricsOpen) dispatch({ type: "setLyrics", open: false });
        else if (state.miniOpen) dispatch({ type: "setMini", open: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.menu, state.npOpen, state.lyricsOpen, state.miniOpen, dispatch]);

  // Mouse back/forward (buttons 3 & 4) navigate Treble's own history. `mouseup`
  // only (adding auxclick too would double-fire on a single press).
  useEffect(() => {
    if (MOBILE) return;
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); dispatch({ type: "navBack" }); }
      else if (e.button === 4) { e.preventDefault(); dispatch({ type: "navForward" }); }
    };
    window.addEventListener("mouseup", onMouse);
    return () => window.removeEventListener("mouseup", onMouse);
  }, [dispatch]);

  // Suppress the webview's native context menu everywhere (the "Save as…" junk).
  // Track rows still open Treble's own menu via their React onContextMenu handlers.
  useEffect(() => {
    if (MOBILE) return;
    const onCtx = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea")) return; // keep it in text fields
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  if (MOBILE) return <MobileApp />;

  return (
    <div className="app">
      <Titlebar />
      <div className="body">
        <Sidebar />
        <main className="center">{renderScreen(state.screen)}</main>
        {state.playerOpen && <NowPlayingPanel />}
      </div>

      {/* the actual sound — headless, syncs <audio> to the store */}
      <AudioEngine />

      {/* overlays / floating windows */}
      {state.npOpen && <NowPlaying />}
      <MiniPlayer />
      <LyricsWindow />
      <ContextMenu />
      <ImportModal />
    </div>
  );
}

function renderScreen(screen: string) {
  switch (screen) {
    case "home":
      return <Home />;
    case "search":
      return <Search />;
    case "explore":
      return <Explore />;
    case "library":
      return <Library />;
    case "detail":
      return <Detail />;
    case "downloads":
      return <Downloads />;
    case "queue":
      return <Queue />;
    case "podcast":
      return <Podcast />;
    case "settings":
      return <Settings />;
    default:
      return <Placeholder name={screen} />;
  }
}
