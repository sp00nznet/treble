import { useEffect, useRef, useState } from "react";
import { Plus, Import, FolderPlus, Loader2, Search as SearchIcon, Mic } from "lucide-react";
import { useStore } from "../store";
import { LIBRARY } from "../data/mock";
import { listPlaylists, pickFolder, scanLocalFolder, searchPodcasts, listSubscriptions, unsubscribePodcast, listAllTracks, newPlaylist, type Podcast } from "../lib/api";
import { artBg } from "../lib/art";
import type { LibraryItem, Track } from "../types";
import { isTauri } from "../lib/windows";
import { VirtualList } from "../components/VirtualList";

const TABS = ["Playlists", "Albums", "Artists", "Podcasts", "Songs"];

export function Library() {
  const { state, dispatch } = useStore();
  const tab = state.libTab;
  const [playlists, setPlaylists] = useState<LibraryItem[] | null>(null);

  // Load real playlists from the library DB (incl. anything imported from Spotify).
  // Refreshes whenever the import modal closes.
  useEffect(() => {
    let live = true;
    listPlaylists()
      .then((pls) => live && setPlaylists(pls.map((p) => ({ id: p.id, title: p.title, subtitle: p.subtitle, art: p.art }))))
      .catch(() => live && setPlaylists(null));
    return () => {
      live = false;
    };
  }, [state.importOpen, state.libRefresh]);

  const [scanning, setScanning] = useState(false);

  // Playlists are real (from the DB). Other tabs have no real source yet, so in
  // the shipped app they're empty; the mock board shows only in browser preview.
  const items: LibraryItem[] =
    tab === "Playlists"
      ? (playlists ?? [])
      : isTauri()
        ? []
        : LIBRARY[tab] ?? [];

  const addFolder = async () => {
    const folder = await pickFolder();
    if (!folder) return;
    setScanning(true);
    try {
      await scanLocalFolder(folder);
      dispatch({ type: "refreshLibrary" });
      dispatch({ type: "setLibTab", tab: "Playlists" });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 className="h1" style={{ fontSize: 30 }}>Your Library</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="chip press"
            style={{ display: "flex", alignItems: "center", gap: 7 }}
            onClick={addFolder}
            disabled={scanning}
          >
            {scanning ? <Loader2 size={16} className="spin" /> : <FolderPlus size={16} />} {scanning ? "Scanning…" : "Add music folder"}
          </button>
          <button
            className="chip press"
            style={{ display: "flex", alignItems: "center", gap: 7 }}
            onClick={() => dispatch({ type: "setImport", open: true })}
          >
            <Import size={16} /> Import from Spotify
          </button>
          <button
            className="chip active press"
            style={{ display: "flex", alignItems: "center", gap: 7 }}
            onClick={async () => {
              const pl = await newPlaylist("New Playlist");
              dispatch({ type: "refreshLibrary" });
              dispatch({ type: "openDetail", id: pl.id });
            }}
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => dispatch({ type: "setLibTab", tab: t })}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Podcasts" && isTauri() ? (
        <PodcastSearch />
      ) : tab === "Songs" && isTauri() ? (
        <SongsTab />
      ) : items.length === 0 ? (
        <div style={{ padding: "26px 2px", color: "var(--text-2)", fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>
          {tab === "Playlists"
            ? "No playlists yet. Import one from Spotify or add a music folder above."
            : `No ${tab.toLowerCase()} yet — they'll appear here as you save and download music.`}
        </div>
      ) : (
        <div className="grid-5">
          {items.map((m) => (
            <div key={m.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openDetail", id: m.id })}>
              <div className="art" style={{ background: artBg(m.art), borderRadius: m.shape === "circle" ? "50%" : "var(--r-art)", marginBottom: 11 }} />
              <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.subtitle}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** All tracks across the library (virtualized — handles thousands of songs). */
function SongsTab() {
  const { dispatch } = useStore();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  useEffect(() => {
    let live = true;
    listAllTracks().then((t) => live && setTracks(t)).catch(() => live && setTracks([]));
    return () => { live = false; };
  }, []);

  if (tracks === null) return <div style={{ display: "flex", gap: 10, color: "var(--text-2)", padding: "10px 2px" }}><Loader2 size={18} className="spin" /> Loading songs…</div>;
  if (tracks.length === 0) return <div style={{ color: "var(--text-2)", fontSize: 14, padding: "10px 2px" }}>No songs yet — import a playlist or add a music folder.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 218px)", margin: "0 -4px" }}>
      <VirtualList
        items={tracks}
        rowHeight={56}
        renderRow={(t) => (
          <div className="trk" style={{ gridTemplateColumns: "1fr 1fr 60px", height: "100%" }} onClick={() => dispatch({ type: "play", track: t })} onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span className="trk-art" style={{ background: artBg(t.art) }} />
              <span style={{ minWidth: 0 }}>
                <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
              </span>
            </span>
            <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
            <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
          </div>
        )}
      />
    </div>
  );
}

/** Subscribed shows + search to find/add more. */
function PodcastSearch() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Podcast[]>([]);
  const [subs, setSubs] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const seq = useRef(0);

  useEffect(() => { listSubscriptions().then(setSubs).catch(() => {}); }, [state.libRefresh]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try { const r = await searchPodcasts(q); if (mine === seq.current) setResults(r); }
      finally { if (mine === seq.current) setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const open = (p: Podcast) => dispatch({ type: "openPodcast", show: { feedUrl: p.feed_url, title: p.title, author: p.author, art: p.art } });
  const ShowCard = ({ p, onCtx }: { p: Podcast; onCtx?: (e: React.MouseEvent) => void }) => (
    <div className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => open(p)} onContextMenu={onCtx}>
      <div className="art" style={{ background: artBg(p.art), marginBottom: 11 }} />
      <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{p.title}</div>
      <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{p.author}</div>
    </div>
  );

  return (
    <div>
      {subs.length > 0 && (
        <>
          <h2 className="h2" style={{ fontSize: 18, marginBottom: 12 }}>Your shows</h2>
          <div className="grid-5" style={{ marginBottom: 30 }}>
            {subs.map((p) => <ShowCard key={p.id} p={p} onCtx={(e) => { e.preventDefault(); setMenu({ id: p.id, x: e.clientX, y: e.clientY }); }} />)}
          </div>
        </>
      )}

      <div style={{ position: "relative", maxWidth: 480, marginBottom: 24 }}>
        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search podcasts to subscribe…" style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "0 16px 0 46px", fontSize: 15, fontFamily: "inherit", color: "var(--text)", outline: "none" }} />
        {loading && <Loader2 size={18} className="spin" style={{ position: "absolute", right: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />}
      </div>

      {results.length === 0 && !loading ? (
        subs.length === 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)", fontSize: 14, padding: "10px 2px" }}>
          <Mic size={18} /> {query ? "No shows found." : "Find any podcast and subscribe — episodes play right here."}
        </div>
      ) : (
        <div className="grid-5">{results.map((p) => <ShowCard key={p.id} p={p} />)}</div>
      )}

      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
          <div style={{ position: "fixed", left: Math.min(menu.x, window.innerWidth - 200), top: menu.y, zIndex: 71, width: 190, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 6 }}>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, color: "#e0463e" }} onClick={async () => { await unsubscribePodcast(menu.id); setMenu(null); dispatch({ type: "refreshLibrary" }); }}>
              Remove subscription
            </button>
          </div>
        </>
      )}
    </div>
  );
}
