import { Home, Search, Compass, Library, Download, Settings, Plus } from "lucide-react";
import { useStore } from "../store";
import { PLAYLISTS } from "../data/mock";
import type { Screen } from "../types";

const NAV: { key: Screen; label: string; Icon: typeof Home }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "search", label: "Search", Icon: Search },
  { key: "explore", label: "Explore", Icon: Compass },
  { key: "library", label: "Library", Icon: Library },
  { key: "downloads", label: "Downloads", Icon: Download },
  { key: "settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const { state, dispatch } = useStore();
  const active = (k: Screen) =>
    state.screen === k || (k === "library" && state.screen === "detail");

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">♪</span>
        <span className="brand-name">Treble</span>
      </div>

      {NAV.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`navitem${active(key) ? " active" : ""}`}
          onClick={() => dispatch({ type: "go", screen: key })}
        >
          <Icon size={19} /> {label}
        </button>
      ))}

      <div style={{ height: 1, background: "var(--border)", margin: "14px 8px 12px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 11px 10px" }}>
        <span className="eyebrow">Playlists</span>
        <Plus size={16} style={{ color: "var(--text-3)", cursor: "pointer" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        {PLAYLISTS.map((p) => (
          <button
            key={p.id}
            className="navitem"
            style={{ padding: "6px 11px" }}
            onClick={() => dispatch({ type: "openDetail", id: p.id })}
          >
            <span style={{ width: 34, height: 34, borderRadius: 7, flex: "none", background: p.art }} />
            <span style={{ minWidth: 0 }}>
              <span className="ellipsis" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{p.title}</span>
              <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>{p.subtitle}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
