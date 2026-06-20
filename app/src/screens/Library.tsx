import { useEffect, useState } from "react";
import { Plus, Import, FolderPlus, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { LIBRARY } from "../data/mock";
import { listPlaylists, pickFolder, scanLocalFolder } from "../lib/api";
import { isArtUrl, type LibraryItem } from "../types";
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

      {items.length === 0 ? (
        <div style={{ padding: "26px 2px", color: "var(--text-2)", fontSize: 14, lineHeight: 1.6, maxWidth: 460 }}>
          {tab === "Playlists"
            ? "No playlists yet. Import one from Spotify or add a music folder above."
            : `No ${tab.toLowerCase()} yet — they'll appear here as you save and download music.`}
        </div>
      ) : (
        <div className="grid-5">
          {items.map((m) => (
            <div key={m.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openDetail", id: m.id })}>
              <div className="art" style={{ background: isArtUrl(m.art) ? `center/cover no-repeat url(${m.art})` : m.art || "var(--surface-2)", borderRadius: m.shape === "circle" ? "50%" : "var(--r-art)", marginBottom: 11 }} />
              <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2, textAlign: m.shape === "circle" ? "center" : "left" }}>{m.subtitle}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
