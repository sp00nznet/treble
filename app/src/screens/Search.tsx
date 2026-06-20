import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { GENRES, RECENT_SEARCHES } from "../data/mock";
import { search as apiSearch } from "../lib/api";
import { isArtUrl, type Track } from "../types";
import { useStore } from "../store";

export function Search() {
  const { dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Debounced live search against the catalog (mock-filtered in the browser).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await apiSearch(q);
        if (mine === seq.current) setResults(r);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const browsing = query.trim().length === 0;

  return (
    <div className="screen">
      <div style={{ position: "relative", maxWidth: 560, marginBottom: 34 }}>
        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you want to listen to?"
          style={{
            width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--surface)", padding: "0 18px 0 46px", fontSize: 16,
            fontFamily: "inherit", color: "var(--text)", outline: "none",
          }}
        />
        {loading && (
          <Loader2 size={18} className="spin" style={{ position: "absolute", right: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />
        )}
      </div>

      {browsing ? (
        <>
          <h2 className="h2" style={{ fontSize: 20, marginBottom: 14 }}>Recent searches</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
            {RECENT_SEARCHES.map((r) => (
              <button key={r.label} onClick={() => setQuery(r.label)} className="chip press" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 8px", borderRadius: 24 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: r.art }} />
                {r.label}
              </button>
            ))}
          </div>

          <h2 className="h2" style={{ fontSize: 20, marginBottom: 16 }}>Browse all</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {GENRES.map((g) => (
              <button key={g.label} onClick={() => setQuery(g.label)} className="card press" style={{ height: 120, border: "none", background: g.art, padding: 16, position: "relative", overflow: "hidden", textAlign: "left" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.2)" }}>{g.label}</span>
                <span style={{ position: "absolute", right: -10, bottom: -10, width: 70, height: 70, borderRadius: 10, background: "rgba(255,255,255,.22)", transform: "rotate(25deg)" }} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="h2" style={{ fontSize: 20, marginBottom: 14 }}>
            {results.length > 0 ? "Songs" : loading ? "Searching…" : "No results"}
          </h2>
          <div>
            {results.map((t) => (
              <div
                key={t.id}
                className="trk"
                style={{ gridTemplateColumns: "1fr 1fr 70px" }}
                onClick={() => dispatch({ type: "play", track: t })}
                onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 7, flex: "none", background: isArtUrl(t.art) ? `center/cover no-repeat url(${t.art})` : t.art }} />
                  <span style={{ minWidth: 0 }}>
                    <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                    <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
                  </span>
                </span>
                <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
                <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
