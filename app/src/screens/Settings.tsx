import { useState } from "react";
import { useStore } from "../store";
import { ACCENTS } from "../theme";
import type { AccentName, ThemePref } from "../types";

const THEME_OPTS: ThemePref[] = ["light", "dark", "auto"];

/**
 * Condensed settings. The full surface (Appearance / Content / Player & audio /
 * Storage / Privacy / About) is specified in the handoff README §8 and the
 * prototype — add the remaining cards & controls to reach parity.
 */
export function Settings() {
  const { state, dispatch } = useStore();

  return (
    <div className="screen" style={{ maxWidth: 780 }}>
      <h1 className="h1" style={{ fontSize: 30, marginBottom: 24 }}>Settings</h1>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Appearance</div>
      <div style={card}>
        <Row label="Theme" sub="Light, dark, or follow system">
          <Segmented
            options={THEME_OPTS}
            value={state.themePref}
            onChange={(v) => dispatch({ type: "setThemePref", pref: v as ThemePref })}
          />
        </Row>
        <Row label="Accent color" sub="Signature highlight color" last>
          <div style={{ display: "flex", gap: 10 }}>
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
              <button
                key={name}
                className="press"
                onClick={() => dispatch({ type: "setAccent", accent: name })}
                style={{
                  width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                  background: ACCENTS[name].grad,
                  border: `3px solid ${state.accent === name ? "var(--accent)" : "transparent"}`,
                  boxShadow: "0 2px 6px var(--shadow)",
                }}
              />
            ))}
          </div>
        </Row>
      </div>

      <div className="eyebrow" style={{ margin: "8px 0 12px" }}>Player &amp; audio</div>
      <div style={card}>
        <Toggle label="Skip silence" sub="Trim silent intros & outros" defaultOn={false} />
        <Toggle label="Audio normalization" sub="Even loudness across tracks" defaultOn />
        <Toggle label="Crossfade" sub="Blend song transitions" defaultOn />
        <Toggle label="Gapless playback" sub="No silence between tracks" defaultOn last />
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 28,
};

function Row({ label, sub, children, last }: { label: string; sub: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 9, padding: 3 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            className="press"
            onClick={() => onChange(o)}
            style={{
              padding: "6px 15px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              textTransform: "capitalize",
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-2)",
              boxShadow: on ? "0 1px 3px var(--shadow)" : "none",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, sub, defaultOn, last }: { label: string; sub: string; defaultOn?: boolean; last?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <Row label={label} sub={sub} last={last}>
      <button
        className="press"
        onClick={() => setOn(!on)}
        style={{ width: 42, height: 24, borderRadius: 13, background: on ? "var(--accent)" : "var(--surface-2)", position: "relative", border: "none", cursor: "pointer" }}
      >
        <span style={{ position: "absolute", top: 2, [on ? "right" : "left"]: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </button>
    </Row>
  );
}
