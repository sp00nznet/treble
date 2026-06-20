import { useEffect, useRef, useState } from "react";
import { Plus, Import, FolderPlus, Loader2, Search as SearchIcon, Mic } from "lucide-react";
import { useStore } from "../store";
import { LIBRARY } from "../data/mock";
import { listPlaylists, pickFolder, scanLocalFolder, searchPodcasts, type Podcast } from "../lib/api";
import { artBg } from "../lib/art";
import type { LibraryItem } from "../types";
import { isTauri } from "../lib/windows";

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
          <button className="chip active press" style={{ display: "flex", alignItems: "center", gap: 7 }}>
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

/** Search Apple Podcasts and open a show's episodes. */
function PodcastSearch() {
  const { dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await searchPodcasts(q);
        if (mine === seq.current) setResults(r);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      <div style={{ position: "relative", maxWidth: 480, marginBottom: 24 }}>
        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search podcasts…"
          style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "0 16px 0 46px", fontSize: 15, fontFamily: "inherit", color: "var(--text)", outline: "none" }}
        />
        {loading && <Loader2 size={18} className="spin" style={{ position: "absolute", right: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />}
      </div>

      {results.length === 0 && !loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)", fontSize: 14, padding: "10px 2px" }}>
          <Mic size={18} /> {query ? "No shows found." : "Find any podcast — episodes play right here."}
        </div>
      ) : (
        <div className="grid-5">
          {results.map((p) => (
            <div key={p.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openPodcast", show: { feedUrl: p.feed_url, title: p.title, author: p.author, art: p.art } })}>
              <div className="art" style={{ background: artBg(p.art), marginBottom: 11 }} />
              <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{p.title}</div>
              <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{p.author}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
