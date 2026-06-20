/**
 * Spotify playlist import with **smart match review**.
 *
 * Copy a playlist's tracks in Spotify (select the rows → Ctrl/Cmd+C) and paste
 * here. Treble parses the text and fetches ranked YouTube Music candidates for
 * each track — then, instead of silently guessing, it shows you the matches:
 * confident ones are pre-accepted, uncertain ones are flagged so you can pick the
 * right candidate (or skip) before the playlist is saved.
 */
import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, X, Check, Loader2, AlertTriangle, ChevronDown } from "lucide-react";
import { useStore } from "../store";
import {
  importRun, importCancel, prepareImportBrowser, saveMatchedPlaylist, listen,
  type ImportProgress, type MatchRow, type CorePlaylist, type ImportRowsEvent, type ImportDoneEvent,
} from "../lib/api";
import { isTauri } from "../lib/windows";
import { isArtUrl, type Track } from "../types";

type Phase = "input" | "matching" | "review" | "saving" | "done";

const SKIP = -1;

export function ImportModal() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("Imported from Spotify");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [sel, setSel] = useState<number[]>([]); // chosen candidate index per row (SKIP = skip)
  const [expanded, setExpanded] = useState<number | null>(null);
  const [result, setResult] = useState<CorePlaylist | null>(null);
  const [summary, setSummary] = useState<{ matched: number; total: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const uns = useRef<Array<() => void>>([]);

  // Subscribe to the import lifecycle while the modal is open.
  useEffect(() => {
    if (!state.importOpen) return;
    let live = true;
    const add = (p: Promise<() => void>) => p.then((u) => live ? uns.current.push(u) : u());
    add(listen<ImportProgress>("import:progress", (p) => live && setProgress(p)));
    add(listen<ImportRowsEvent>("import:rows", (e) => {
      if (!live) return;
      setRows(e.rows);
      setSel(e.rows.map((r) => (r.candidates.length ? 0 : SKIP)));
      setPhase("review");
    }));
    add(listen<ImportDoneEvent>("import:done", (e) => {
      if (!live) return;
      setResult(e.playlist);
      setSummary({ matched: e.matched, total: e.total, skipped: e.skipped });
      setPhase("done");
    }));
    add(listen<null>("import:cancelled", () => live && setPhase("input")));
    return () => {
      live = false;
      uns.current.forEach((u) => u());
      uns.current = [];
    };
  }, [state.importOpen]);

  if (!state.importOpen) return null;

  const close = () => {
    dispatch({ type: "setImport", open: false });
    setPhase("input");
    setProgress(null);
    setRows([]);
    setSel([]);
    setExpanded(null);
    setResult(null);
    setSummary(null);
    setErr(null);
    setText("");
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      /* clipboard blocked — paste manually */
    }
  };

  const run = async () => {
    if (!text.trim()) return;
    setPhase("matching");
    setProgress(null);
    setErr(null);
    // Browser preview has no backend/events — build review rows synchronously.
    if (!isTauri()) {
      const r = prepareImportBrowser(text);
      setRows(r);
      setSel(r.map((row) => (row.candidates.length ? 0 : SKIP)));
      setPhase("review");
      return;
    }
    // Real import runs in the background; import:rows / import:done drive the rest.
    try {
      await importRun(name.trim() || "Imported Playlist", text);
    } catch (e) {
      setErr(String(e));
      setPhase("input");
    }
  };

  const cancel = () => {
    void importCancel();
    setPhase("input");
  };

  const create = async () => {
    const tracks: Track[] = rows
      .map((row, i) => (sel[i] >= 0 ? row.candidates[sel[i]] : null))
      .filter((t): t is Track => !!t);
    setPhase("saving");
    try {
      const pl = await saveMatchedPlaylist(name.trim() || "Imported Playlist", tracks);
      setResult(pl);
      setPhase("done");
    } catch {
      setPhase("review");
    }
  };

  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const chosen = sel.filter((s) => s >= 0).length;
  const needsReview = rows.filter((r, i) => !r.confident && sel[i] >= 0).length;

  return (
    // Backdrop does NOT dismiss — this is a multi-step wizard with text input, so an
    // accidental click outside shouldn't throw away a paste. Close via the ✕ only.
    <div className="modal-backdrop">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={phase === "review" ? { maxWidth: 600 } : undefined}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 className="h2" style={{ fontSize: 22 }}>Import from Spotify</h2>
          <button className="icon-btn press" onClick={close} aria-label="Close"><X size={18} /></button>
        </div>

        {phase === "input" && (
          <>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px", lineHeight: 1.5 }}>
              In Spotify, open a playlist, select the tracks (Ctrl/Cmd+A), copy them
              (Ctrl/Cmd+C), then paste below. We'll find matches on YouTube Music and let you review them.
            </p>
            {err && (
              <div style={{ background: "var(--surface)", border: "1px solid #e0463e55", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: "var(--text-2)" }}>
                <b style={{ color: "#e0463e" }}>Import failed.</b> {err}
              </div>
            )}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" style={inputStyle} />
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
              <button className="chip active press" style={{ display: "flex", alignItems: "center", gap: 7, opacity: lineCount ? 1 : 0.5 }} disabled={!lineCount} onClick={run}>
                Find matches {lineCount ? `· ${lineCount}` : ""}
              </button>
            </div>
          </>
        )}

        {phase === "matching" && (
          <div style={{ padding: "20px 0 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Finding matches on YouTube Music…</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent-grad)", borderRadius: 4, transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
              <span className="ellipsis" style={{ maxWidth: 360 }}>{progress?.current || "Starting…"}</span>
              <span>{progress ? `${progress.done}/${progress.total}` : ""}</span>
            </div>
            {progress && progress.total > 60 && (
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>
                Large playlist — importing the best match for each track in the background.
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="chip press" onClick={cancel}>Cancel</button>
            </div>
          </div>
        )}

        {phase === "review" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-2)", margin: "2px 0 12px" }}>
              <span><b style={{ color: "var(--text)" }}>{chosen}</b> of {rows.length} selected</span>
              {needsReview > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#C77B16" }}>
                  <AlertTriangle size={14} /> {needsReview} need a look
                </span>
              )}
            </div>

            <div style={{ maxHeight: 380, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
              {rows.map((row, i) => (
                <ReviewRow
                  key={i}
                  row={row}
                  selected={sel[i]}
                  open={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                  onChoose={(idx) => { setSel((s) => s.map((v, j) => (j === i ? idx : v))); setExpanded(null); }}
                />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <button className="chip press" onClick={() => setPhase("input")}>Back</button>
              <button className="chip active press" style={{ opacity: chosen ? 1 : 0.5 }} disabled={!chosen} onClick={create}>
                Create playlist · {chosen}
              </button>
            </div>
          </>
        )}

        {phase === "saving" && (
          <div style={{ padding: "24px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <Loader2 size={18} className="spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Saving your playlist…</span>
          </div>
        )}

        {phase === "done" && result && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#2BAE66", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Check size={16} /></span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Imported “{result.title}”</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 18px" }}>
              {summary
                ? `${summary.matched} of ${summary.total} track${summary.total === 1 ? "" : "s"} matched and saved${summary.skipped ? ` · ${summary.skipped} couldn't be found` : ""}.`
                : `${result.tracks.length} track${result.tracks.length === 1 ? "" : "s"} saved as a playable playlist.`}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="chip press" onClick={close}>Close</button>
              <button className="chip active press" onClick={() => { dispatch({ type: "openDetail", id: result.id }); close(); }}>
                Open playlist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One reviewable match: the Spotify source, the chosen candidate, and (expanded) alternatives. */
function ReviewRow({
  row, selected, open, onToggle, onChoose,
}: {
  row: MatchRow;
  selected: number;
  open: boolean;
  onToggle: () => void;
  onChoose: (idx: number) => void;
}) {
  const source = `${row.parsed.title}${row.parsed.artist ? ` — ${row.parsed.artist}` : ""}`;
  const pick = selected >= 0 ? row.candidates[selected] : null;
  const flagged = !row.confident && selected >= 0;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, background: "var(--surface)", overflow: "hidden" }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Art track={pick} skipped={selected === SKIP} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: pick ? "var(--text)" : "var(--text-3)" }}>
            {pick ? `${pick.title}` : "Skipped"}
          </span>
          <span className="ellipsis" style={{ display: "block", fontSize: 11.5, color: "var(--text-3)" }}>
            from Spotify: {source}
          </span>
        </span>
        {flagged ? (
          <AlertTriangle size={15} style={{ color: "#C77B16", flex: "none" }} />
        ) : pick ? (
          <Check size={15} style={{ color: "#2BAE66", flex: "none" }} />
        ) : null}
        <ChevronDown size={15} style={{ color: "var(--text-3)", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 6, background: "var(--surface-2)" }}>
          {row.candidates.map((c, idx) => (
            <button key={c.id || idx} onClick={() => onChoose(idx)} className="navitem" style={{ padding: "8px 10px", width: "100%", gap: 10, background: idx === selected ? "var(--accent-soft)" : "transparent" }}>
              <Art track={c} skipped={false} small />
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span className="ellipsis" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{c.title}</span>
                <span className="ellipsis" style={{ display: "block", fontSize: 11.5, color: "var(--text-2)" }}>{c.artist}{c.duration ? ` · ${c.duration}` : ""}</span>
              </span>
              {idx === selected && <Check size={14} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
          <button onClick={() => onChoose(SKIP)} className="navitem" style={{ padding: "8px 10px", width: "100%", gap: 10, color: "var(--text-2)", background: selected === SKIP ? "var(--accent-soft)" : "transparent" }}>
            <span style={{ width: 34, height: 34, borderRadius: 6, flex: "none", border: "1px dashed var(--border)" }} />
            <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>Don't import this track</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Art({ track, skipped, small }: { track: Track | null; skipped: boolean; small?: boolean }) {
  const s = small ? 34 : 38;
  const bg = skipped
    ? "var(--surface-2)"
    : track && isArtUrl(track.art)
      ? `center/cover no-repeat url(${track.art})`
      : track?.art || "var(--surface-2)";
  return <span style={{ width: s, height: s, borderRadius: 6, flex: "none", background: bg, border: skipped ? "1px dashed var(--border)" : "none" }} />;
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
