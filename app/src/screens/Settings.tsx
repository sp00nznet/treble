import { useEffect, useState } from "react";
import { useStore } from "../store";
import { ACCENTS } from "../theme";
import { getLogPath, getSetting, setSetting, getDownloadDir, storageStats, clearDownloads, pickFolder } from "../lib/api";
import { isTauri } from "../lib/windows";
import type { AccentName, ThemePref } from "../types";

const THEME_OPTS: ThemePref[] = ["light", "dark", "auto"];
const QUALITY_OPTS = ["low", "normal", "high", "best"];
const TAB_OPTS = [
  { key: "home", label: "Home" },
  { key: "library", label: "Library" },
  { key: "search", label: "Search" },
];
const REGIONS = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["SE", "Sweden"],
  ["BR", "Brazil"], ["MX", "Mexico"], ["JP", "Japan"], ["KR", "South Korea"], ["IN", "India"],
];
const LANGS = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"],
  ["pt", "Portuguese"], ["ja", "Japanese"], ["ko", "Korean"],
];

function fmtBytes(n: number): string {
  if (n <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${units[i]}`;
}

export function Settings() {
  const { state, dispatch } = useStore();
  const [logPath, setLogPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [quality, setQuality] = useState("best");
  const [downloadDir, setDownloadDir] = useState("");
  const [storage, setStorage] = useState<{ bytes: number; count: number }>({ bytes: 0, count: 0 });
  const [clearing, setClearing] = useState(false);
  const [defaultTab, setDefaultTab] = useState<string>(() => { try { return localStorage.getItem("treble.defaultTab") || "home"; } catch { return "home"; } });
  const [region, setRegion] = useState<string>(() => { try { return localStorage.getItem("treble.region") || "US"; } catch { return "US"; } });
  const [lang, setLang] = useState<string>(() => { try { return localStorage.getItem("treble.lang") || "en"; } catch { return "en"; } });

  useEffect(() => { getLogPath().then(setLogPath).catch(() => {}); }, []);
  useEffect(() => {
    if (!isTauri()) return;
    getSetting("quality").then((q) => setQuality(q || "best")).catch(() => {});
    getDownloadDir().then(setDownloadDir).catch(() => {});
    storageStats().then(setStorage).catch(() => {});
  }, []);

  const pickQuality = (q: string) => { setQuality(q); void setSetting("quality", q); };
  const changeDir = async () => {
    const dir = await pickFolder();
    if (!dir) return;
    await setSetting("download_dir", dir);
    setDownloadDir(dir);
  };
  const doClear = async () => {
    setClearing(true);
    try { await clearDownloads(); setStorage({ bytes: 0, count: 0 }); }
    finally { setClearing(false); }
  };
  const persist = (key: string, value: string, set: (v: string) => void) => { set(value); try { localStorage.setItem(key, value); } catch { /* ignore */ } };

  return (
    <div className="screen" style={{ maxWidth: 780 }}>
      <h1 className="h1" style={{ fontSize: 30, marginBottom: 24 }}>Settings</h1>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Appearance</div>
      <div style={card}>
        <Row label="Theme" sub="Light, dark, or follow system">
          <Segmented options={THEME_OPTS} value={state.themePref} onChange={(v) => dispatch({ type: "setThemePref", pref: v as ThemePref })} />
        </Row>
        <Row label="Accent color" sub="Signature highlight color" last>
          <div style={{ display: "flex", gap: 10 }}>
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
              <button key={name} className="press" onClick={() => dispatch({ type: "setAccent", accent: name })}
                style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", background: ACCENTS[name].grad, border: `3px solid ${state.accent === name ? "var(--accent)" : "transparent"}`, boxShadow: "0 2px 6px var(--shadow)" }} />
            ))}
          </div>
        </Row>
      </div>

      <div className="eyebrow" style={{ margin: "8px 0 12px" }}>Startup &amp; content</div>
      <div style={card}>
        <Row label="Open to" sub="Which screen Treble shows on launch">
          <Segmented options={TAB_OPTS.map((t) => t.key)} labels={TAB_OPTS.map((t) => t.label)} value={defaultTab} onChange={(v) => persist("treble.defaultTab", v, setDefaultTab)} />
        </Row>
        <Row label="Content region" sub="Bias search & charts to a country">
          <Select value={region} onChange={(v) => persist("treble.region", v, setRegion)} options={REGIONS} />
        </Row>
        <Row label="Content language" sub="Preferred language for results" last>
          <Select value={lang} onChange={(v) => persist("treble.lang", v, setLang)} options={LANGS} />
        </Row>
      </div>

      <div className="eyebrow" style={{ margin: "8px 0 12px" }}>Library &amp; downloads</div>
      <div style={card}>
        <Row label="Auto-download" sub="Cache tracks for offline as you play them">
          <Switch on={state.autoDownload} onChange={(v) => dispatch({ type: "setAutoDownload", on: v })} />
        </Row>
        <Row label="Default volume" sub="Applied to playback">
          <div onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); dispatch({ type: "setVolume", volume: (e.clientX - r.left) / r.width }); }}
            style={{ width: 140, height: 5, borderRadius: 3, background: "var(--surface-2)", position: "relative", cursor: "pointer" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${state.volume * 100}%`, background: "var(--accent)", borderRadius: 3 }} />
          </div>
        </Row>
        <Row label="Download quality" sub="Higher quality = larger files">
          <Segmented options={QUALITY_OPTS} value={quality} onChange={pickQuality} />
        </Row>
        <Row label="Download location" sub={downloadDir || "Default app folder"}>
          <button className="chip press" onClick={() => void changeDir()} disabled={!isTauri()}>Change…</button>
        </Row>
        <Row label="Downloaded files" sub={`${storage.count} file${storage.count === 1 ? "" : "s"} · ${fmtBytes(storage.bytes)}`} last>
          <button className="chip press" style={{ color: storage.count ? "#e0463e" : "var(--text-3)" }} disabled={!storage.count || clearing} onClick={() => void doClear()}>
            {clearing ? "Clearing…" : "Clear cache"}
          </button>
        </Row>
      </div>

      <div className="eyebrow" style={{ margin: "8px 0 12px" }}>Player &amp; audio</div>
      <div style={card}>
        <Toggle label="Skip silence" sub="Trim silent intros & outros" defaultOn={false} />
        <Toggle label="Audio normalization" sub="Even loudness across tracks" defaultOn />
        <Toggle label="Crossfade" sub="Blend song transitions" defaultOn />
        <Toggle label="Gapless playback" sub="No silence between tracks" defaultOn last />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", margin: "-20px 4px 24px" }}>These four are placeholders — the toggles save but the DSP isn't wired yet.</div>

      <div className="eyebrow" style={{ margin: "8px 0 12px" }}>Diagnostics &amp; about</div>
      <div style={card}>
        <Row label="Log file" sub={logPath ?? "—"}>
          <button className="chip press" disabled={!logPath} onClick={() => { if (logPath) { void navigator.clipboard.writeText(logPath); setCopied(true); setTimeout(() => setCopied(false), 1200); } }}>
            {copied ? "Copied" : "Copy path"}
          </button>
        </Row>
        <Row label="Treble" sub="Version 1.0.0 · github.com/sp00nznet/treble" last>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Powered by yt-dlp · rustypipe · LRCLIB</span>
        </Row>
      </div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="press" onClick={() => onChange(!on)} style={{ width: 42, height: 24, borderRadius: 13, background: on ? "var(--accent)" : "var(--surface-2)", position: "relative", border: "none", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, [on ? "right" : "left"]: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ height: 34, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", padding: "0 10px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 28,
};

function Row({ label, sub, children, last }: { label: string; sub: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        <div className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Segmented({ options, labels, value, onChange }: { options: string[]; labels?: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 9, padding: 3 }}>
      {options.map((o, i) => {
        const on = o === value;
        return (
          <button key={o} className="press" onClick={() => onChange(o)}
            style={{ padding: "6px 13px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", textTransform: "capitalize",
              background: on ? "var(--surface)" : "transparent", color: on ? "var(--accent)" : "var(--text-2)", boxShadow: on ? "0 1px 3px var(--shadow)" : "none" }}>
            {labels ? labels[i] : o}
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
      <button className="press" onClick={() => setOn(!on)} style={{ width: 42, height: 24, borderRadius: 13, background: on ? "var(--accent)" : "var(--surface-2)", position: "relative", border: "none", cursor: "pointer" }}>
        <span style={{ position: "absolute", top: 2, [on ? "right" : "left"]: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </button>
    </Row>
  );
}
