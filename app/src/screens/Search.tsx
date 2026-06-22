import { useEffect, useRef, useState } from "react";
import { Search as SearchIcon, Loader2, Music, Mic } from "lucide-react";
import { GENRES, RECENT_SEARCHES } from "../data/mock";
import { search as apiSearch, searchPodcasts, type Podcast } from "../lib/api";
import { isArtUrl, type Track } from "../types";
import { artBg } from "../lib/art";
import { useStore } from "../store";
import { isTauri } from "../lib/windows";

type Mode = "songs" | "podcasts";

export function Search() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("songs");

  // Seeded from "Go to artist / album" — prefill the query then clear the seed.
  useEffect(() => {
    if (state.pendingSearch != null) {
      setMode("songs");
      setQuery(state.pendingSearch);
      dispatch({ type: "clearSearchSeed" });
    }
  }, [state.pendingSearch, dispatch]);
  const [results, setResults] = useState<Track[]>([]);
  const [shows, setShows] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setShows([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        if (mode === "podcasts") {
          const r = await searchPodcasts(q);
          if (mine === seq.current) setShows(r);
        } else {
          const r = await apiSearch(q);
          if (mine === seq.current) setResults(r);
        }
      } catch (e) {
        if (mine === seq.current) { setResults([]); setShows([]); setError(String(e)); }
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, mode]);

  const browsing = query.trim().length === 0;

  return (
    <div className="screen">
      {/* Songs / Podcasts toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`chip press${mode === "songs" ? " active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={() => setMode("songs")}>
          <Music size={15} /> Songs
        </button>
        <button className={`chip press${mode === "podcasts" ? " active" : ""}`} style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={() => setMode("podcasts")}>
          <Mic size={15} /> Podcasts
        </button>
      </div>

      <div style={{ position: "relative", maxWidth: 560, marginBottom: 34 }}>
        <SearchIcon size={18} style={{ position: "absolute", left: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "podcasts" ? "Search podcasts…" : "What do you want to listen to?"}
          style={{ width: "100%", height: 52, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "0 18px 0 46px", fontSize: 16, fontFamily: "inherit", color: "var(--text)", outline: "none" }}
        />
        {loading && <Loader2 size={18} className="spin" style={{ position: "absolute", right: 16, top: "calc(50% - 9px)", color: "var(--text-3)" }} />}
      </div>

      {browsing ? (
        mode === "podcasts" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)", fontSize: 14 }}>
            <Mic size={18} /> Search any podcast — open a show to play episodes or subscribe.
          </div>
        ) : (
          <>
            {!isTauri() && (
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
              </>
            )}
            <h2 className="h2" style={{ fontSize: 20, marginBottom: 16 }}>Browse all</h2>
            <div className="genre-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
              {GENRES.map((g) => (
                <button key={g.label} onClick={() => setQuery(g.label)} className="card press" style={{ height: 120, border: "none", background: g.art, padding: 16, position: "relative", overflow: "hidden", textAlign: "left" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.2)" }}>{g.label}</span>
                  <span style={{ position: "absolute", right: -10, bottom: -10, width: 70, height: 70, borderRadius: 10, background: "rgba(255,255,255,.22)", transform: "rotate(25deg)" }} />
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          {error && (
            <div style={{ background: "var(--surface)", border: "1px solid #e0463e55", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
              <b style={{ color: "#e0463e" }}>Couldn't reach the catalog.</b> {error}
            </div>
          )}
          {mode === "podcasts" ? (
            <>
              <h2 className="h2" style={{ fontSize: 20, marginBottom: 14 }}>{shows.length > 0 ? "Shows" : loading ? "Searching…" : "No shows"}</h2>
              <div className="grid-5">
                {shows.map((p) => (
                  <div key={p.id} className="card" style={{ border: "none", background: "transparent", padding: 0 }} onClick={() => dispatch({ type: "openPodcast", show: { feedUrl: p.feed_url, title: p.title, author: p.author, art: p.art } })}>
                    <div className="art" style={{ background: artBg(p.art), marginBottom: 11 }} />
                    <div className="ellipsis" style={{ fontSize: 14, fontWeight: 700 }}>{p.title}</div>
                    <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{p.author}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="h2" style={{ fontSize: 20, marginBottom: 14 }}>{results.length > 0 ? "Songs" : loading ? "Searching…" : error ? "Something went wrong" : "No results"}</h2>
              <div>
                {results.map((t) => (
                  <div key={t.id} className="trk trk-songs" onClick={() => dispatch({ type: "play", track: t, queue: results })} onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: t }); }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span style={{ width: 42, height: 42, borderRadius: 7, flex: "none", background: isArtUrl(t.art) ? `center/cover no-repeat url(${t.art})` : t.art }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t.title}</span>
                        <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{t.artist}</span>
                      </span>
                    </span>
                    <span className="ellipsis trk-album" style={{ fontSize: 13, color: "var(--text-2)" }}>{t.album}</span>
                    <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{t.duration}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
