import { useRef } from "react";
import { useStore } from "../store";

/**
 * Draggable volume slider with a thumb. Click anywhere to jump; press-and-drag to
 * scrub. Writes to the store (`setVolume`), which the AudioEngine applies.
 */
export function VolumeSlider() {
  const { state, dispatch } = useStore();
  const barRef = useRef<HTMLDivElement | null>(null);

  const apply = (clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    dispatch({ type: "setVolume", volume: v });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    apply(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) apply(e.clientX);
  };

  return (
    <div
      ref={barRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={{ flex: 1, margin: "0 10px", height: 14, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
      title="Volume"
    >
      <div style={{ position: "relative", width: "100%", height: 4, borderRadius: 2, background: "var(--surface-2)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.volume * 100}%`, background: "var(--text-2)", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: `calc(${state.volume * 100}% - 6px)`, top: "calc(50% - 6px)", width: 12, height: 12, borderRadius: "50%", background: "var(--text)", boxShadow: "0 1px 3px var(--shadow)" }} />
      </div>
    </div>
  );
}
