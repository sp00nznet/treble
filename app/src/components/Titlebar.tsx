import { ChevronLeft, ChevronRight, PanelRight } from "lucide-react";
import { useStore } from "../store";
import { Devices } from "./Devices";
import { WindowControls } from "./WindowControls";

// Interactive titlebar elements stop the mousedown from reaching the drag region
// (otherwise Tauri starts a window drag and the click never fires). Empty areas
// of the bar still drag the window.
const noDrag = { onMouseDown: (e: React.MouseEvent) => e.stopPropagation() };

export function Titlebar() {
  const { state, dispatch } = useStore();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div style={{ display: "flex", gap: 6, color: "var(--text-3)" }} data-tauri-drag-region>
        <button {...noDrag} className="press" style={{ ...iconBtn, opacity: state.back.length ? 1 : 0.4 }} disabled={!state.back.length} onClick={() => dispatch({ type: "navBack" })}><ChevronLeft size={18} /></button>
        <button {...noDrag} className="press" style={{ ...iconBtn, opacity: state.forward.length ? 1 : 0.4 }} disabled={!state.forward.length} onClick={() => dispatch({ type: "navForward" })}><ChevronRight size={18} /></button>
      </div>

      {/* draggable spacer (search lives in the sidebar now) */}
      <div style={{ flex: 1 }} data-tauri-drag-region />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-3)", marginRight: 8 }} data-tauri-drag-region>Treble</span>
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {!state.playerOpen && (
        <button
          {...noDrag}
          className="press"
          onClick={() => dispatch({ type: "setPlayerOpen", open: true })}
          style={{ ...iconBtn, width: 32, height: 32, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)" }}
          title="Show now-playing panel"
        >
          <PanelRight size={17} />
        </button>
      )}
      <span {...noDrag}><Devices /></span>
      <span {...noDrag}><WindowControls /></span>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center",
  justifyContent: "center", border: "none", background: "transparent", color: "inherit", cursor: "pointer",
};
