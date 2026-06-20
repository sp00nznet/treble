import { useEffect, useState } from "react";
import { Play, Heart, Download, MoreHorizontal, Clock, Pencil, Trash2, Check, X } from "lucide-react";
import { useStore } from "../store";
import { PLAYLISTS, TRACKS, ART } from "../data/mock";
import { getPlaylist, deletePlaylist, renamePlaylist, downloadTrack, type CorePlaylist } from "../lib/api";
import { isArtUrl, type Track } from "../types";
import { isTauri } from "../lib/windows";

/**
 * Album/playlist detail. Loads the real playlist (incl. Spotify-imported ones)
 * from the library by `state.detailId`. Mock data is used only for browser preview
 * — the shipped app shows real tracks or an empty state.
 */
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
    return () => {
      live = false;
    };
  }, [state.detailId, state.libRefresh]);

  const title = real?.title ?? mock?.title ?? "Playlist";
  const art = real?.art || mock?.art || (demo ? ART[3] : "var(--surface-2)");
  const tracks: Track[] = real?.tracks ?? (demo ? TRACKS : []);
  const dates = ["2 days ago", "5 days ago", "1 week ago", "2 weeks ago", "3 weeks ago", "Mar 12", "Mar 8", "Feb 28"];
  const subtitle = real ? `${tracks.length} songs` : demo ? "24 songs, 1h 38m" : `${tracks.length} songs`;

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const isReal = !!real;

  const playAll = () => tracks[0] && dispatch({ type: "play", track: tracks[0] });
  const downloadAll = () => {
    tracks.forEach((t) => void downloadTrack(t));
    if (tracks.length) dispatch({ type: "go", screen: "downloads" });
  };
  const doDelete = async () => {
    if (!real) return;
    await deletePlaylist(real.id);
    dispatch({ type: "refreshLibrary" });
    dispatch({ type: "go", screen: "library" });
  };
  const doRename = async () => {
    if (!real || !newName.trim()) { setRenaming(false); return; }
    await renamePlaylist(real.id, newName.trim());
    setRenaming(false);
    dispatch({ type: "refreshLibrary" });
    setReal({ ...real, title: newName.trim() });
  };

  return (
    <div>
      <header style={{ padding: "40px 34px 24px", display: "flex", gap: 26, alignItems: "flex-end", background: "linear-gradient(180deg,var(--accent-soft),transparent)" }}>
        <div style={{ width: 212, height: 212, borderRadius: 14, flex: "none", background: isArtUrl(art) ? `center/cover no-repeat url(${art})` : art, boxShadow: "0 20px 44px var(--shadow)" }} />
        <div style={{ paddingBottom: 6 }}>
          <div className="eyebrow" style={{ color: "var(--text-2)" }}>Playlist</div>
          {renaming ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 14px" }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void doRename(); if (e.key === "Escape") setRenaming(false); }}
                style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 40, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", color: "var(--text)", padding: "4px 12px", outline: "none", maxWidth: 460 }}
              />
              <button className="icon-btn press" onClick={() => void doRename()}><Check size={20} /></button>
              <button className="icon-btn press" onClick={() => setRenaming(false)}><X size={20} /></button>
            </div>
          ) : (
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 54, lineHeight: 1.02, letterSpacing: "-.03em", margin: "8px 0 14px" }}>{title}</h1>
          )}
          <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5, maxWidth: 520 }}>
            {real
              ? "Saved in Treble — matched on YouTube Music and ready to play."
              : demo
                ? "The slow-burn nocturne mix. Warm synths, lonely guitars, and headlights on an empty highway."
                : "Your playlist."}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: "var(--text-2)" }}>
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
                <button className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10, color: "#e0463e", opacity: isReal ? 1 : 0.4 }} disabled={!isReal} onClick={() => { setMenuOpen(false); void doDelete(); }}>
                  <Trash2 size={16} /> <span style={{ flex: 1, textAlign: "left" }}>Delete playlist</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "8px 34px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr 90px 60px", gap: 16, padding: "0 12px 8px", borderBottom: "1px solid var(--border)", marginBottom: 6 }} className="eyebrow">
          <span>#</span><span>Title</span><span>Album</span><span>Date added</span><span style={{ textAlign: "right" }}><Clock size={15} /></span>
        </div>
        {tracks.length === 0 ? (
          <div style={{ padding: "20px 12px", color: "var(--text-2)", fontSize: 14 }}>This playlist is empty.</div>
        ) : (
          tracks.map((t, i) => (
            <DetailRow key={t.id || i} index={i} date={dates[i % dates.length]} track={t} />
          ))
        )}
      </div>
    </div>
  );
}

function DetailRow({ track, index, date }: { track: Track; index: number; date: string }) {
  const { dispatch } = useStore();
  return (
    <div
      className="trk"
      style={{ gridTemplateColumns: "30px 1fr 1fr 90px 60px" }}
      onClick={() => dispatch({ type: "play", track })}
      onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track }); }}
    >
      <span className="idx">{index + 1}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span className="trk-art" style={{ background: isArtUrl(track.art) ? `center/cover no-repeat url(${track.art})` : track.art }} />
        <span style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{track.title}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{track.artist}</span>
        </span>
      </span>
      <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{track.album}</span>
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>{date}</span>
      <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{track.duration}</span>
    </div>
  );
}
