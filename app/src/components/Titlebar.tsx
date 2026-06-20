import { Search, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import { useStore } from "../store";
import { resolveTheme } from "../theme";

export function Titlebar() {
  const { state, dispatch } = useStore();
  const isDark = resolveTheme(state.themePref) === "dark";

  return (
    // data-tauri-drag-region makes the whole bar draggable in Tauri.
    <div className="titlebar" data-tauri-drag-region>
      <div className="traffic">
        <span className="light" style={{ background: "#ff5f57" }} />
        <span className="light" style={{ background: "#febc2e" }} />
        <span className="light" style={{ background: "#28c840" }} />
      </div>
      <div style={{ display: "flex", gap: 6, color: "var(--text-3)" }}>
        <button className="press" style={iconBtn}><ChevronLeft size={18} /></button>
        <button className="press" style={{ ...iconBtn, opacity: 0.5 }}><ChevronRight size={18} /></button>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <button
          className="searchpill press"
          onClick={() => dispatch({ type: "go", screen: "search" })}
        >
          <Search size={16} />
          <span>Search songs, artists, albums…</span>
          <span style={kbd}>⌘K</span>
        </button>
      </div>

      <button
        className="press"
        onClick={() => dispatch({ type: "setThemePref", pref: isDark ? "light" : "dark" })}
        style={{ ...iconBtn, width: 32, height: 32, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        title="Toggle theme"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <div style={avatarChip}>
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#7A6CFF,#FF6B8B)" }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Kaz</span>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center",
  justifyContent: "center", border: "none", background: "transparent", color: "inherit", cursor: "pointer",
};
const kbd: React.CSSProperties = {
  marginLeft: "auto", fontSize: 11, border: "1px solid var(--border)", borderRadius: 5, padding: "1px 6px",
};
const avatarChip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "3px 10px 3px 3px", borderRadius: 20,
  background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer",
};
