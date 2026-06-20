import { useEffect, useMemo, useState } from "react";
import { Play, Heart, Download, MoreHorizontal, Clock, Pencil, Trash2, Check, X, Star, ChevronUp, ChevronDown, Image as ImageIcon } from "lucide-react";
import { useStore } from "../store";
import { PLAYLISTS, TRACKS, ART } from "../data/mock";
import { getPlaylist, deletePlaylist, renamePlaylist, downloadTrack, setRating, pickImage, setPlaylistCover, type CorePlaylist } from "../lib/api";
import type { Track } from "../types";
import { isTauri } from "../lib/windows";
import { artBg } from "../lib/art";

type ColKey = "artist" | "album" | "rating";
type SortKey = "index" | "title" | "artist" | "album" | "rating" | "duration";
const OPTIONAL: { key: ColKey; label: string }[] = [
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "rating", label: "Rating" },
];
const COL_W: Record<ColKey, string> = { artist: "minmax(0,1fr)", album: "minmax(0,1fr)", rating: "118px" };

function loadCols(): ColKey[] {
  try {
    const s = localStorage.getItem("treble.detailCols");
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return ["album"]; // default: show Album
}

export function Detail() {
  const { state, dispatch } = useStore();
  const demo = !isTauri();
  const mock = demo ? PLAYLISTS.find((p) => p.id === state.detailId) ?? PLAYLISTS[1] : null;
  const [real, setReal] = useState<CorePlaylist | null>(null);

  useEffect(() => {
    let live = true;
    setReal(null);
    if (state.detailId) {
      getPlaylist(state.detailId).then((p) => {
        if (live && p && p.tracks.length > 0) setReal(p);
      });
    }
    return () => { live = false; };
  }, [state.detailId, state.libRefresh]);

  const title = real?.title ?? mock?.title ?? "Playlist";
  const art = real?.art || mock?.art || (demo ? ART[3] : "");
  const baseTracks: Track[] = real?.tracks ?? (demo ? TRACKS : []);
  const subtitle = `${baseTracks.length} song${baseTracks.length === 1 ? "" : "s"}`;
  const isReal = !!real;

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [cols, setCols] = useState<ColKey[]>(loadCols);
  const [colMenu, setColMenu] = useState<{ x: number; y: number } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "index", dir: "asc" });

  const toggleCol = (k: ColKey) => {
    setCols((c) => {
      const next = c.includes(k) ? c.filter((x) => x !== k) : [...c, k];
      localStorage.setItem("treble.detailCols", JSON.stringify(next));
      return next;
    });
  };
  const clickSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const tracks = useMemo(() => {
    if (sort.key === "index") return sort.dir === "asc" ? baseTracks : [...baseTracks].reverse();
    const val = (t: Track): string | number => {
      switch (sort.key) {
        case "title": return t.title.toLowerCase();
        case "artist": return t.artist.toLowerCase();
        case "album": return t.album.toLowerCase();
        case "rating": return t.rating ?? 0;
        case "duration": return t.duration_secs ?? 0;
        default: return 0;
      }
    };
    const sorted = [...baseTracks].sort((a, b) => {
      const va = val(a), vb = val(b);
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [baseTracks, sort]);

  const visible = OPTIONAL.filter((o) => cols.includes(o.key)).map((o) => o.key);
  const grid = ["30px", "minmax(0,2fr)", ...visible.map((k) => COL_W[k]), "60px"].join(" ");

  const playAll = () => baseTracks[0] && dispatch({ type: "play", track: baseTracks[0] });
  const downloadAll = () => { baseTracks.forEach((t) => void downloadTrack(t)); if (baseTracks.length) dispatch({ type: "go", screen: "downloads" }); };
  const doDelete = async () => { if (!real) return; await deletePlaylist(real.id); dispatch({ type: "refreshLibrary" }); dispatch({ type: "go", screen: "library" }); };
  const doRename = async () => {
    if (!real || !newName.trim()) { setRenaming(false); return; }
    await renamePlaylist(real.id, newName.trim());
    setRenaming(false);
    dispatch({ type: "refreshLibrary" });
    setReal({ ...real, title: newName.trim() });
  };
  const replaceCover = async () => {
    if (!real) return;
    const src = await pickImage();
    if (!src) return;
    const newArt = await setPlaylistCover(real.id, src);
    setReal({ ...real, art: newArt });
    dispatch({ type: "refreshLibrary" });
  };
  const rate = async (t: Track, n: number) => {
    const value = t.rating === n ? 0 : n; // click same star again to clear
    await setRating(t.id, value);
    if (real) setReal({ ...real, tracks: real.tracks.map((x) => (x.id === t.id ? { ...x, rating: value } : x)) });
  };

  const SortHead = ({ k, label, align }: { k: SortKey; label: React.ReactNode; align?: "right" }) => (
    <span
      onClick={() => clickSort(k)}
      onContextMenu={(e) => { e.preventDefault(); setColMenu({ x: e.clientX, y: e.clientY }); }}
      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4, justifyContent: align === "right" ? "flex-end" : "flex-start", userSelect: "none" }}
      title="Click to sort · right-click for columns"
    >
      {label}
      {sort.key === k && (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </span>
  );

  return (
    <div>
      <header style={{ padding: "40px 34px 24px", display: "flex", gap: 26, alignItems: "flex-end", background: "linear-gradient(180deg,var(--accent-soft),transparent)" }}>
        <div
          onContextMenu={(e) => { if (isReal) { e.preventDefault(); void replaceCover(); } }}
          title={isReal ? "Right-click to replace cover" : undefined}
          style={{ position: "relative", width: 212, height: 212, borderRadius: 14, flex: "none", background: artBg(art), boxShadow: "0 20px 44px var(--shadow)", cursor: isReal ? "pointer" : "default" }}
        >
          {isReal && (
            <span className="cover-edit" style={{ position: "absolute", right: 8, bottom: 8, width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => void replaceCover()} title="Replace cover">
              <ImageIcon size={15} />
            </span>
          )}
        </div>
        <div style={{ paddingBottom: 6 }}>
          <div className="eyebrow" style={{ color: "var(--text-2)" }}>Playlist</div>
          {renaming ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 14px" }}>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doRename(); if (e.key === "Escape") setRenaming(false); }} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text)", padding: "4px 12px", outline: "none", maxWidth: 460 }} />
              <button className="icon-btn press" onClick={() => void doRename()}><Check size={20} /></button>
              <button className="icon-btn press" onClick={() => setRenaming(false)}><X size={20} /></button>
            </div>
          ) : (
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 54, lineHeight: 1.02, letterSpacing: "-.03em", margin: "8px 0 14px" }}>{title}</h1>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 13, color: "var(--text-2)" }}>
            <span>{subtitle}</span>
          </div>
        </div>
      </header>

      <div style={{ padding: "18px 34px 8px", display: "flex", alignItems: "center", gap: 18 }}>
        <button className="fab press" style={{ width: 56, height: 56, boxShadow: "0 10px 24px rgba(255,107,92,.4)" }} onClick={playAll}><Play size={24} fill="#fff" /></button>
        <Heart size={26} className="press" style={{ color: "var(--accent)", cursor: "pointer" }} fill="currentColor" />
        <Download size={24} className="press" style={{ color: "var(--text-2)", cursor: "pointer" }} onClick={downloadAll} />
        <div style={{ position: "relative" }}>
          <MoreHorizontal size={24} className="press" style={{ color: "var(--text-2)", cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", top: 30, left: 0, zIndex: 50, width: 180, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 6 }}>
                <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, opacity: isReal ? 1 : 0.4 }} disabled={!isReal} onClick={() => { setNewName(title); setRenaming(true); setMenuOpen(false); }}>
                  <Pencil size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Rename</span>
                </button>
                <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, opacity: isReal ? 1 : 0.4 }} disabled={!isReal} onClick={() => { setMenuOpen(false); void replaceCover(); }}>
                  <ImageIcon size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Replace cover</span>
                </button>
                <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, color: "#e0463e", opacity: isReal ? 1 : 0.4 }} disabled={!isReal} onClick={() => { setMenuOpen(false); void doDelete(); }}>
                  <Trash2 size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Delete playlist</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "8px 34px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 16, padding: "0 12px 8px", borderBottom: "1px solid var(--border)", marginBottom: 6 }} className="eyebrow">
          <SortHead k="index" label="#" />
          <SortHead k="title" label="Title" />
          {visible.includes("artist") && <SortHead k="artist" label="Artist" />}
          {visible.includes("album") && <SortHead k="album" label="Album" />}
          {visible.includes("rating") && <SortHead k="rating" label="Rating" />}
          <SortHead k="duration" label={<Clock size={15} />} align="right" />
        </div>

        {tracks.length === 0 ? (
          <div style={{ padding: "20px 12px", color: "var(--text-2)", fontSize: 14 }}>This playlist is empty.</div>
        ) : (
          tracks.map((t, i) => (
            <div
              key={t.id || i}
              className="trk"
              style={{ gridTemplateColumns: grid }}
              onClick={() => dispatch({ type: "play", track: t })}
              onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
            >
              <span className="idx">{i + 1}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span className="trk-art" style={{ background: artBg(t.art) }} />
                <span style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                  <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
                </span>
              </span>
              {visible.includes("artist") && <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", alignSelf: "center" }}>{t.artist}</span>}
              {visible.includes("album") && <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", alignSelf: "center" }}>{t.album}</span>}
              {visible.includes("rating") && (
                <span style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className="press" onClick={() => void rate(t, n)} style={{ cursor: "pointer", color: (t.rating ?? 0) >= n ? "var(--accent)" : "var(--text-3)" }} fill={(t.rating ?? 0) >= n ? "currentColor" : "none"} />
                  ))}
                </span>
              )}
              <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right", alignSelf: "center" }}>{t.duration}</span>
            </div>
          ))
        )}
      </div>

      {colMenu && (
        <>
          <div onClick={() => setColMenu(null)} onContextMenu={(e) => { e.preventDefault(); setColMenu(null); }} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
          <div style={{ position: "fixed", left: Math.min(colMenu.x, window.innerWidth - 190), top: colMenu.y, zIndex: 71, width: 180, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 6 }}>
            <div className="eyebrow" style={{ padding: "6px 10px 8px", color: "var(--text-3)" }}>Columns</div>
            {OPTIONAL.map((o) => (
              <button key={o.key} className="navitem" style={{ padding: "8px 10px", width: "100%", gap: 10 }} onClick={() => toggleCol(o.key)}>
                <span style={{ width: 16 }}>{cols.includes(o.key) && <Check size={15} style={{ color: "var(--accent)" }} />}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
