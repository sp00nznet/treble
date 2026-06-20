import { Search as SearchIcon } from "lucide-react";
import { GENRES, RECENT_SEARCHES } from "../data/mock";

export function Search() {
  return (
    <div className="screen">
      <div style={{ position: "relative", maxWidth: 560, marginBottom: 34 }}>
        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
        <input
          placeholder="What do you want to listen to?"
          style={{
            width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--surface)", padding: "0 18px 0 46px", fontSize: 16,
            fontFamily: "inherit", color: "var(--text)", outline: "none",
          }}
        />
      </div>

      <h2 className="h2" style={{ fontSize: 20, marginBottom: 14 }}>Recent searches</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
        {RECENT_SEARCHES.map((r) => (
          <button key={r.label} className="chip press" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 8px", borderRadius: 24 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: r.art }} />
            {r.label}
          </button>
        ))}
      </div>

      <h2 className="h2" style={{ fontSize: 20, marginBottom: 16 }}>Browse all</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {GENRES.map((g) => (
          <button key={g.label} className="card press" style={{ height: 120, border: "none", background: g.art, padding: 16, position: "relative", overflow: "hidden", textAlign: "left" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.2)" }}>{g.label}</span>
            <span style={{ position: "absolute", right: -10, bottom: -10, width: 70, height: 70, borderRadius: 10, background: "rgba(255,255,255,.22)", transform: "rotate(25deg)" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
