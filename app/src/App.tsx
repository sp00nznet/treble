import { useEffect } from "react";
import { useStore } from "./store";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { NowPlayingPanel } from "./components/NowPlayingPanel";
import { NowPlaying } from "./components/NowPlaying";
import { ContextMenu } from "./components/ContextMenu";
import { MiniPlayer, LyricsWindow } from "./components/FloatingWindows";
import { AudioEngine } from "./components/AudioEngine";
import { Home } from "./screens/Home";
import { Search } from "./screens/Search";
import { Explore } from "./screens/Explore";
import { Library } from "./screens/Library";
import { Detail } from "./screens/Detail";
import { Downloads } from "./screens/Downloads";
import { Queue } from "./screens/Queue";
import { Settings } from "./screens/Settings";
import { Placeholder } from "./screens/Placeholder";

export function App() {
  const { state, dispatch } = useStore();

  // Global keyboard shortcuts: ⌘K / Ctrl+K → search, Esc → close top overlay.
  useEffect(() => {
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

  return (
    <div className="app">
      <Titlebar />
      <div className="body">
        <Sidebar />
        <main className="center">{renderScreen(state.screen)}</main>
        <NowPlayingPanel />
      </div>

      {/* the actual sound — headless, syncs <audio> to the store */}
      <AudioEngine />

      {/* overlays / floating windows */}
      {state.npOpen && <NowPlaying />}
      <MiniPlayer />
      <LyricsWindow />
      <ContextMenu />
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
    case "settings":
      return <Settings />;
    default:
      return <Placeholder name={screen} />;
  }
}
