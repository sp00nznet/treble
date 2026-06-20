/**
 * Sleep timer control. A moon icon that opens a small menu of durations; when a
 * timer is armed it shows the remaining time. The actual pause is enforced by
 * AudioEngine watching `state.sleepEndsAt`.
 */
import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { useStore } from "../store";
import { fmtTime } from "../lib/format";

const OPTIONS = [15, 30, 45, 60]; // minutes

export function SleepTimer() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  // Re-render every second while a timer is active so the countdown updates.
  useEffect(() => {
    if (state.sleepEndsAt == null) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.sleepEndsAt]);

  const active = state.sleepEndsAt != null;
  const remaining = active ? Math.max(0, Math.round((state.sleepEndsAt! - Date.now()) / 1000)) : 0;

  const arm = (minutes: number) => {
    dispatch({ type: "setSleep", endsAt: Date.now() + minutes * 60_000 });
    setOpen(false);
  };
  const armEndOfTrack = () => {
    const left = Math.max(0, state.durationSecs - state.positionSecs);
    dispatch({ type: "setSleep", endsAt: Date.now() + left * 1000 });
    setOpen(false);
  };
  const off = () => {
    dispatch({ type: "setSleep", endsAt: null });
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        className="press"
        onClick={() => setOpen((o) => !o)}
        title={active ? `Sleep in ${fmtTime(remaining)}` : "Sleep timer"}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: active ? "var(--accent)" : "var(--text-2)", cursor: "pointer", padding: 0, font: "inherit" }}
      >
        <Moon size={17} fill={active ? "currentColor" : "none"} />
        {active && <span style={{ fontSize: 11, fontWeight: 700 }}>{fmtTime(remaining)}</span>}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50, width: 168,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "0 16px 40px var(--shadow)", padding: 6,
            }}
          >
            <div className="eyebrow" style={{ padding: "6px 10px 8px", color: "var(--text-3)" }}>Sleep timer</div>
            {OPTIONS.map((m) => (
              <button key={m} className="navitem" style={menuItem} onClick={() => arm(m)}>
                <span style={{ flex: 1, textAlign: "left" }}>{m} minutes</span>
              </button>
            ))}
            <button className="navitem" style={menuItem} onClick={armEndOfTrack}>
              <span style={{ flex: 1, textAlign: "left" }}>End of track</span>
            </button>
            {active && (
              <button className="navitem" style={{ ...menuItem, color: "var(--accent)" }} onClick={off}>
                <span style={{ flex: 1, textAlign: "left" }}>Turn off</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = { padding: "8px 10px", fontWeight: 500, fontSize: 13.5, width: "100%" };
