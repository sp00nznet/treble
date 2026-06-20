import { Search, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import { useStore } from "../store";
import { resolveTheme } from "../theme";
import { Devices } from "./Devices";
import { WindowControls } from "./WindowControls";

export function Titlebar() {
  const { state, dispatch } = useStore();
  const isDark = resolveTheme(state.themePref) === "dark";

  return (
    // data-tauri-drag-region makes the whole bar draggable in Tauri.
    <div className="titlebar" data-tauri-drag-region>
      <div style={{ display: "flex", gap: 6, color: "var(--text-3)" }}>
        <button className="press" style={{ ...iconBtn, opacity: state.back.length ? 1 : 0.4 }} disabled={!state.back.length} onClick={() => dispatch({ type: "navBack" })}><ChevronLeft size={18} /></button>
        <button className="press" style={{ ...iconBtn, opacity: state.forward.length ? 1 : 0.4 }} disabled={!state.forward.length} onClick={() => dispatch({ type: "navForward" })}><ChevronRight size={18} /></button>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <button className="searchpill press" onClick={() => dispatch({ type: "go", screen: "search" })}>
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
      <Devices />
      <WindowControls />
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
