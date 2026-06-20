/**
 * Spotify playlist import.
 *
 * Copy a playlist's tracks in Spotify (select the rows → Ctrl/Cmd+C) and paste
 * here. The core parses the text, matches every track on YouTube Music, and saves
 * a real, playable Treble playlist. Live progress arrives on `import:progress`.
 */
import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, X, Check, Loader2 } from "lucide-react";
import { useStore } from "../store";
import { importSpotify, listen, type ImportProgress, type CorePlaylist } from "../lib/api";

type Phase = "input" | "importing" | "done";

export function ImportModal() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("Imported from Spotify");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<CorePlaylist | null>(null);
  const unlisten = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!state.importOpen) return;
    // Subscribe to match progress for the duration the modal is open.
    let live = true;
    listen<ImportProgress>("import:progress", (p) => live && setProgress(p)).then((un) => {
      unlisten.current = un;
    });
    return () => {
      live = false;
      unlisten.current?.();
      unlisten.current = null;
    };
  }, [state.importOpen]);

  if (!state.importOpen) return null;

  const close = () => {
    dispatch({ type: "setImport", open: false });
    // reset for next time
    setPhase("input");
    setProgress(null);
    setResult(null);
    setText("");
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      /* clipboard blocked — the user can paste manually */
    }
  };

  const run = async () => {
    if (!text.trim()) return;
    setPhase("importing");
    setProgress(null);
    try {
      const pl = await importSpotify(name.trim() || "Imported Playlist", text);
      setResult(pl);
      setPhase("done");
    } catch {
      setPhase("input"); // let them retry
    }
  };

  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 className="h2" style={{ fontSize: 22 }}>Import from Spotify</h2>
          <button className="icon-btn press" onClick={close} aria-label="Close"><X size={18} /></button>
        </div>

        {phase === "input" && (
          <>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px", lineHeight: 1.5 }}>
              In Spotify, open a playlist, select the tracks (Ctrl/Cmd+A), copy them
              (Ctrl/Cmd+C), then paste below. We'll match each track on YouTube Music.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playlist name"
              style={inputStyle}
            />
            <div style={{ position: "relative", marginTop: 12 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Paste your Spotify tracks here…\n\nMidnight Coast\tHalsey Lane\tNeon Tide\t3:58\nPaper Planes — Norah Vale\n…"}
                rows={9}
                style={{ ...inputStyle, height: "auto", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <button className="chip press" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={pasteFromClipboard}>
                <ClipboardPaste size={15} /> Paste from clipboard
              </button>
              <button
                className="chip active press"
                style={{ display: "flex", alignItems: "center", gap: 7, opacity: lineCount ? 1 : 0.5 }}
                disabled={!lineCount}
                onClick={run}
              >
                Import {lineCount ? `${lineCount} track${lineCount > 1 ? "s" : ""}` : ""}
              </button>
            </div>
          </>
        )}

        {phase === "importing" && (
          <div style={{ padding: "20px 0 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Matching tracks on YouTube Music…</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent-grad)", borderRadius: 4, transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
              <span className="ellipsis" style={{ maxWidth: 320 }}>{progress?.current || "Starting…"}</span>
              <span>{progress ? `${progress.done}/${progress.total} · ${progress.matched} matched` : ""}</span>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#2BAE66", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Check size={16} /></span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Imported “{result.title}”</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 18px" }}>
              {result.tracks.length} track{result.tracks.length === 1 ? "" : "s"} matched and saved as a playable playlist.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="chip press" onClick={close}>Close</button>
              <button
                className="chip active press"
                onClick={() => { dispatch({ type: "openDetail", id: result.id }); close(); }}
              >
                Open playlist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  padding: "0 14px",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};
