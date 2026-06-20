import { Play, ChevronRight } from "lucide-react";
import { useStore } from "../store";
import { NEW_RELEASES, CHARTS } from "../data/mock";

export function Explore() {
  const { dispatch } = useStore();
  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ padding: "48px 34px 30px", background: "radial-gradient(110% 90% at 85% -20%,var(--accent-soft),transparent 60%)" }}>
        <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 13, letterSpacing: ".14em" }}>Explore</div>
        <h1 className="h1" style={{ fontSize: 34, marginTop: 6 }}>Fresh sounds &amp; deep cuts</h1>
      </div>

      <div style={{ padding: "6px 34px 0" }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>New releases</h2>
        <div className="grid-5" style={{ marginBottom: 38 }}>
          {NEW_RELEASES.map((m) => (
            <div key={m.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openDetail", id: m.id })}>
              <div className="art" style={{ background: m.art, marginBottom: 11, position: "relative" }}>
                <span className="fab" style={{ position: "absolute", right: 9, bottom: 9, width: 44, height: 44, boxShadow: "0 8px 18px rgba(255,107,92,.45)" }}>
                  <Play size={18} fill="#fff" />
                </span>
              </div>
              <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{m.subtitle}</div>
            </div>
          ))}
        </div>

        <h2 className="h2" style={{ marginBottom: 16 }}>Charts</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {CHARTS.map((c) => (
            <button key={c.title} className="navitem press" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, gap: 14 }}>
              <span style={{ width: 56, height: 56, borderRadius: 9, flex: "none", background: c.art }} />
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{c.title}</span>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-2)", marginTop: 2, fontWeight: 500 }}>{c.subtitle}</span>
              </span>
              <ChevronRight size={18} style={{ color: "var(--text-3)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
