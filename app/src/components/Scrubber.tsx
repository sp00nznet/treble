/**
 * A click-to-seek progress bar driven by the store's live playback position.
 * Used by the docked panel, full-screen player, and mini-player so they all share
 * one source of truth. `theme="dark"` for the dark player surfaces.
 */
import { useStore } from "../store";

export function Scrubber({ theme = "default", height = 5 }: { theme?: "default" | "dark"; height?: number }) {
  const { state, dispatch } = useStore();
  const dur = state.durationSecs || 0;
  const pct = dur > 0 ? Math.min(100, (state.positionSecs / dur) * 100) : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dur <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    dispatch({ type: "seek", secs: frac * dur });
  };

  const bg = theme === "dark" ? "rgba(255,255,255,.16)" : "var(--surface-2)";
  const fill = theme === "dark" ? "linear-gradient(90deg,#FFB35C,#FF6B5C)" : "var(--accent-grad)";

  return (
    <div
      onClick={seek}
      style={{ height, borderRadius: height / 2, background: bg, position: "relative", cursor: dur > 0 ? "pointer" : "default" }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: fill, borderRadius: height / 2 }} />
      <div
        style={{
          position: "absolute",
          left: `calc(${pct}% - ${height + 1}px)`,
          top: "50%",
          transform: "translateY(-50%)",
          width: height + 2,
          height: height + 2,
          borderRadius: "50%",
          background: theme === "dark" ? "#fff" : "var(--accent)",
          opacity: dur > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
