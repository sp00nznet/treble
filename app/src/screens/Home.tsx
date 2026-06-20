import { useState } from "react";
import { Play, Search, Import, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { useStore } from "../store";
import { usePlaylists } from "../lib/usePlaylists";
import { coverBg } from "../lib/art";
import { deletePlaylist, renamePlaylist, pickImage, setPlaylistCover } from "../lib/api";

export function Home() {
  const { state, dispatch } = useStore();
  const playlists = usePlaylists();
  const recent = state.recent;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const [menu, setMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const doRename = async () => {
    if (!renaming) return;
    const { id, value } = renaming;
    setRenaming(null);
    if (value.trim()) { await renamePlaylist(id, value.trim()); dispatch({ type: "refreshLibrary" }); }
  };
  const doDelete = async (id: string) => { setMenu(null); await deletePlaylist(id); dispatch({ type: "refreshLibrary" }); };
  const replaceCover = async (id: string) => {
    setMenu(null);
    const src = await pickImage();
    if (src) { await setPlaylistCover(id, src); dispatch({ type: "refreshLibrary" }); }
  };

  return (
    <div className="screen">
      <header style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{greeting}</div>
        <h1 className="h1" style={{ marginTop: 3 }}>Welcome back</h1>
      </header>

      {recent.length > 0 && (
        <>
          <h2 className="h2" style={{ marginBottom: 16 }}>Recently played</h2>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 10, marginBottom: 34 }}>
            {recent.slice(0, 14).map((t) => (
              <div
                key={t.id}
                style={{ width: 150, flex: "none", cursor: "pointer" }}
                onClick={() => dispatch({ type: "play", track: t, queue: recent })}
                onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
              >
                <div className="art" style={{ background: coverBg(t.art, t.title), marginBottom: 10 }} />
                <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{t.title}</div>
                <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{t.artist}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {playlists.length === 0 && recent.length === 0 ? (
        <EmptyHome
          onSearch={() => dispatch({ type: "go", screen: "search" })}
          onImport={() => dispatch({ type: "setImport", open: true })}
        />
      ) : playlists.length > 0 ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="h2">Your playlists</h2>
            <span className="eyebrow" style={{ cursor: "pointer" }} onClick={() => dispatch({ type: "go", screen: "library" })}>Show all</span>
          </div>
          <div className="grid-5">
            {playlists.map((p) => (
              <div
                key={p.id}
                className="card"
                onClick={() => renaming?.id === p.id || dispatch({ type: "openDetail", id: p.id })}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ id: p.id, title: p.title, x: e.clientX, y: e.clientY }); }}
              >
                <div className="art" style={{ background: coverBg(p.art, p.title), marginBottom: 12, position: "relative" }}>
                  <span className="fab" style={{ position: "absolute", right: 9, bottom: 9, width: 44, height: 44, boxShadow: "0 8px 18px rgba(255,107,92,.45)" }}>
                    <Play size={18} fill="#fff" />
                  </span>
                </div>
                {renaming?.id === p.id ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenaming({ id: p.id, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") void doRename(); if (e.key === "Escape") setRenaming(null); }}
                    onBlur={() => void doRename()}
                    style={{ width: "100%", fontSize: 15, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)", color: "var(--text)", padding: "4px 8px", outline: "none" }}
                  />
                ) : (
                  <div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{p.title}</div>
                )}
                <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>{p.subtitle}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
          <div style={{ position: "fixed", left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 170), zIndex: 71, width: 180, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 6 }}>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10 }} onClick={() => { dispatch({ type: "openDetail", id: menu.id }); setMenu(null); }}>
              <Play size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Open</span>
            </button>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10 }} onClick={() => { setRenaming({ id: menu.id, value: menu.title }); setMenu(null); }}>
              <Pencil size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Rename</span>
            </button>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10 }} onClick={() => void replaceCover(menu.id)}>
              <ImageIcon size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Replace cover</span>
            </button>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, color: "#e0463e" }} onClick={() => void doDelete(menu.id)}>
              <Trash2 size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyHome({ onSearch, onImport }: { onSearch: () => void; onImport: () => void }) {
  return (
    <div style={{ marginTop: 40, maxWidth: 460 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Your library is empty — for now.</div>
      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 22 }}>
        Search for anything to start listening, or import a playlist you already have. Everything you save
        shows up here and on the rest of your devices.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="chip active press" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={onSearch}>
          <Search size={16} /> Search music
        </button>
        <button className="chip press" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={onImport}>
          <Import size={16} /> Import
        </button>
      </div>
    </div>
  );
}
