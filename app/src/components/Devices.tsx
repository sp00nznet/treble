/**
 * Devices — Spotify-Connect-style LAN device list. The button shows how many
 * Treble devices are on the network; the popover lets you send the current song
 * to any of them. Discovery + receiving are handled by the Rust core (mDNS);
 * this subscribes to `sync:peer-found` / `sync:peer-lost` and also handles
 * inbound `sync:received` messages (play a sent track / import a sent playlist).
 */
import { useEffect, useState } from "react";
import { MonitorSpeaker, Send } from "lucide-react";
import { useStore } from "../store";
import { listPeers, listen, sendTo, type Peer } from "../lib/api";

export function Devices() {
  const { state } = useStore();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  // Discover peers (inbound messages are handled globally by <SyncReceiver/>).
  useEffect(() => {
    let live = true;
    const uns: Array<() => void> = [];
    listPeers().then((p) => live && setPeers(p));
    listen<Peer>("sync:peer-found", (p) =>
      setPeers((cur) => (cur.some((x) => x.device_id === p.device_id) ? cur : [...cur, p]))
    ).then((u) => uns.push(u));
    listen<Peer>("sync:peer-lost", (p) =>
      setPeers((cur) => cur.filter((x) => x.device_id !== p.device_id))
    ).then((u) => uns.push(u));
    return () => {
      live = false;
      uns.forEach((u) => u());
    };
  }, []);

  const sendCurrent = async (peer: Peer) => {
    if (!state.nowPlaying) return;
    await sendTo(peer.device_id, { kind: "Track", data: state.nowPlaying });
    setSent(peer.device_id);
    setTimeout(() => setSent(null), 1500);
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        className="press"
        onClick={() => setOpen((o) => !o)}
        title="Devices on your network"
        style={{ position: "relative", width: 32, height: 32, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px solid var(--border)", color: peers.length ? "var(--accent)" : "var(--text-2)", cursor: "pointer" }}
      >
        <MonitorSpeaker size={17} />
        {peers.length > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{peers.length}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50, width: 240, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px var(--shadow)", padding: 8 }}>
            <div className="eyebrow" style={{ padding: "4px 8px 10px", color: "var(--text-3)" }}>Devices on your network</div>
            {peers.length === 0 ? (
              <div style={{ padding: "8px 8px 12px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                No other Treble devices found. Open Treble on another device on the same Wi-Fi.
              </div>
            ) : (
              peers.map((p) => (
                <button key={p.device_id} className="navitem" style={{ padding: "9px 10px", width: "100%", gap: 10 }} onClick={() => sendCurrent(p)} disabled={!state.nowPlaying}>
                  <MonitorSpeaker size={17} style={{ color: "var(--text-2)" }} />
                  <span className="ellipsis" style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
                  {sent === p.device_id ? <span style={{ fontSize: 11, color: "#2BAE66" }}>Sent ✓</span> : <Send size={14} style={{ color: "var(--text-3)" }} />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
