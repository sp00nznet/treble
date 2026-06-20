import { Play, Search, Import } from "lucide-react";
import { useStore } from "../store";
import { usePlaylists } from "../lib/usePlaylists";
import { isArtUrl } from "../types";

export function Home() {
  const { dispatch } = useStore();
  const playlists = usePlaylists();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="screen">
      <header style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{greeting}</div>
        <h1 className="h1" style={{ marginTop: 3 }}>Welcome back</h1>
      </header>

      {playlists.length === 0 ? (
        <EmptyHome
          onSearch={() => dispatch({ type: "go", screen: "search" })}
          onImport={() => dispatch({ type: "setImport", open: true })}
        />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="h2">Your playlists</h2>
            <span className="eyebrow" style={{ cursor: "pointer" }} onClick={() => dispatch({ type: "go", screen: "library" })}>Show all</span>
          </div>
          <div className="grid-5">
            {playlists.map((p) => (
              <div key={p.id} className="card" onClick={() => dispatch({ type: "openDetail", id: p.id })}>
                <div className="art" style={{ background: isArtUrl(p.art) ? `center/cover no-repeat url(${p.art})` : p.art || "var(--surface-2)", marginBottom: 12, position: "relative" }}>
                  <span className="fab" style={{ position: "absolute", right: 9, bottom: 9, width: 44, height: 44, boxShadow: "0 8px 18px rgba(255,107,92,.45)" }}>
                    <Play size={18} fill="#fff" />
                  </span>
                </div>
                <div className="ellipsis" style={{ fontSize: 15, fontWeight: 700 }}>{p.title}</div>
                <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>{p.subtitle}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyHome({ onSearch, onImport }: { onSearch: () => void; onImport: () => void }) {
  return (
    <div style={{ marginTop: 40, maxWidth: 460 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Your library is empty — for now.</div>
      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 22 }}>
        Search for anything to start listening, or bring a playlist over from Spotify. Everything you save
        shows up here and on the rest of your devices.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="chip active press" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={onSearch}>
          <Search size={16} /> Search music
        </button>
        <button className="chip press" style={{ display: "flex", alignItems: "center", gap: 7 }} onClick={onImport}>
          <Import size={16} /> Import from Spotify
        </button>
      </div>
    </div>
  );
}
