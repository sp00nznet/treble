import { Check } from "lucide-react";
import { useStore } from "../store";
import { TRACKS } from "../data/mock";

export function Downloads() {
  const { dispatch } = useStore();
  const downloaded = TRACKS.filter((t) => t.downloaded);

  return (
    <div className="screen">
      <h1 className="h1" style={{ fontSize: 30, marginBottom: 4 }}>Downloads</h1>
      <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 22 }}>Available offline · cached on this device</div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Storage used</span>
            <span style={{ color: "var(--text-2)" }}>2.4 GB of 8 GB</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "30%", background: "var(--accent-grad)", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 20, borderLeft: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Auto-download</span>
          <span style={{ width: 42, height: 24, borderRadius: 13, background: "var(--accent)", position: "relative" }}>
            <span style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
          </span>
        </div>
      </div>

      {downloaded.map((t) => (
        <div
          key={t.id}
          className="trk"
          style={{ gridTemplateColumns: "1fr 1fr 30px 60px" }}
          onClick={() => dispatch({ type: "play", track: t })}
          onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: 7, flex: "none", background: t.art }} />
            <span style={{ minWidth: 0 }}>
              <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
            </span>
          </span>
          <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
          <span style={{ color: "#2BAE66", display: "flex", justifyContent: "center" }}><Check size={18} /></span>
          <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
        </div>
      ))}
    </div>
  );
}
