import { useState } from "react";
import { Home, Search, Compass, Library, Download, Settings, Plus, Pencil, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { usePlaylists } from "../lib/usePlaylists";
import { deletePlaylist, renamePlaylist } from "../lib/api";
import { artBg } from "../lib/art";
import type { Screen } from "../types";

const NAV: { key: Screen; label: string; Icon: typeof Home }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "search", label: "Search", Icon: Search },
  { key: "explore", label: "Explore", Icon: Compass },
  { key: "library", label: "Library", Icon: Library },
  { key: "downloads", label: "Downloads", Icon: Download },
  { key: "settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const { state, dispatch } = useStore();
  const playlists = usePlaylists();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const active = (k: Screen) =>
    state.screen === k || (k === "library" && state.screen === "detail");

  const doDelete = async (id: string) => {
    setMenu(null);
    await deletePlaylist(id);
    dispatch({ type: "refreshLibrary" });
    if (state.detailId === id) dispatch({ type: "go", screen: "library" });
  };
  const doRename = async () => {
    if (!renaming) return;
    const { id, value } = renaming;
    setRenaming(null);
    if (value.trim()) {
      await renamePlaylist(id, value.trim());
      dispatch({ type: "refreshLibrary" });
    }
  };

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">♪</span>
        <span className="brand-name">Treble</span>
      </div>

      {NAV.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`navitem${active(key) ? " active" : ""}`}
          onClick={() => dispatch({ type: "go", screen: key })}
        >
          <Icon size={19} /> {label}
        </button>
      ))}

      <div style={{ height: 1, background: "var(--border)", margin: "14px 8px 12px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 11px 10px" }}>
        <span className="eyebrow">Playlists</span>
        <Plus size={16} style={{ color: "var(--text-3)", cursor: "pointer" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        {playlists.length === 0 ? (
          <div style={{ padding: "8px 11px", fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>
            No playlists yet. Import from Spotify or add a music folder in your Library.
          </div>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              className="navitem"
              style={{ padding: "6px 11px" }}
              onClick={() => renaming?.id === p.id || dispatch({ type: "openDetail", id: p.id })}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ id: p.id, x: e.clientX, y: e.clientY }); }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 7, flex: "none", background: artBg(p.art) }} />
              {renaming?.id === p.id ? (
                <input
                  autoFocus
                  value={renaming.value}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenaming({ id: p.id, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") void doRename(); if (e.key === "Escape") setRenaming(null); }}
                  onBlur={() => void doRename()}
                  style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text)", padding: "3px 6px", outline: "none" }}
                />
              ) : (
                <span style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{p.title}</span>
                  <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>{p.subtitle}</span>
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
          <div style={{ position: "fixed", left: Math.min(menu.x, window.innerWidth - 180), top: menu.y, zIndex: 71, width: 170, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 6 }}>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10 }} onClick={() => { const p = playlists.find((x) => x.id === menu.id); setRenaming({ id: menu.id, value: p?.title ?? "" }); setMenu(null); }}>
              <Pencil size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Rename</span>
            </button>
            <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, color: "#e0463e" }} onClick={() => void doDelete(menu.id)}>
              <Trash2 size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Delete</span>
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
