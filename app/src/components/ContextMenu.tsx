import { useEffect, useState } from "react";
import {
  Play, ListPlus, ListMusic, Plus, Heart, Radio, Disc3, User, Download, Share2, ChevronRight, ChevronLeft,
  MonitorSpeaker,
} from "lucide-react";
import { useStore } from "../store";
import { usePlaylists } from "../lib/usePlaylists";
import { downloadTrack, listPeers, sendTo, type Peer } from "../lib/api";

/**
 * Right-click context menu for a track. Opens at the cursor (state.menu).
 * Backdrop dismisses; "Add to playlist" swaps to a sub-view.
 */
export function ContextMenu() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<"main" | "playlists" | "send">("main");
  const [peers, setPeers] = useState<Peer[]>([]);
  const playlists = usePlaylists();
  const menu = state.menu;

  // Load LAN peers when the user opens the "Send to" sub-view.
  useEffect(() => {
    if (view === "send") listPeers().then(setPeers);
  }, [view]);

  if (!menu) return null;

  const close = () => { setView("main"); dispatch({ type: "closeMenu" }); };
  const x = Math.min(menu.x, window.innerWidth - 244);
  const y = Math.min(menu.y, window.innerHeight - 410);

  return (
    <div onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} style={{ position: "fixed", inset: 0, zIndex: 70 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", left: x, top: y, width: 236, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "0 18px 44px rgba(0,0,0,.3)", padding: 6 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px 10px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
          <span style={{ width: 38, height: 38, borderRadius: 7, flex: "none", background: menu.track.art }} />
          <span style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{menu.track.title}</span>
            <span className="ellipsis" style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{menu.track.artist}</span>
          </span>
        </div>

        {view === "main" ? (
          <>
            <Group>
              <Item icon={<Play size={17} />} label="Play" onClick={() => { dispatch({ type: "play", track: menu.track }); close(); }} />
              <Item icon={<ListPlus size={17} />} label="Play next" onClick={close} />
              <Item icon={<ListMusic size={17} />} label="Add to queue" onClick={close} />
            </Group>
            <Group divider>
              <Item icon={<Plus size={17} />} label="Add to playlist" chevron onClick={() => setView("playlists")} />
              <Item icon={<Heart size={17} />} label="Save to Liked Songs" onClick={close} />
              <Item icon={<Radio size={17} />} label="Start radio · songs like this" onClick={close} />
            </Group>
            <Group divider>
              <Item icon={<Disc3 size={17} />} label="Go to album" onClick={() => { dispatch({ type: "openDetail", id: "lnd" }); close(); }} />
              <Item icon={<User size={17} />} label="Go to artist" onClick={close} />
            </Group>
            <Group divider>
              <Item icon={<MonitorSpeaker size={17} />} label="Send to device" chevron onClick={() => setView("send")} />
              <Item icon={<Download size={17} />} label="Download" onClick={() => { void downloadTrack(menu.track); dispatch({ type: "go", screen: "downloads" }); close(); }} />
              <Item icon={<Share2 size={17} />} label="Share" onClick={close} />
            </Group>
          </>
        ) : view === "send" ? (
          <>
            <Group>
              <Item icon={<ChevronLeft size={17} />} label="Back to menu" onClick={() => setView("main")} />
            </Group>
            <Group divider>
              {peers.length === 0 ? (
                <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                  No Treble devices on your network yet.
                </div>
              ) : (
                peers.map((p) => (
                  <Item
                    key={p.device_id}
                    icon={<MonitorSpeaker size={17} />}
                    label={p.name}
                    onClick={() => { void sendTo(p.device_id, { kind: "Track", data: menu.track }); close(); }}
                  />
                ))
              )}
            </Group>
          </>
        ) : (
          <>
            <Group>
              <Item icon={<ChevronLeft size={17} />} label="Back to menu" onClick={() => setView("main")} />
            </Group>
            <Group divider>
              <Item icon={<Plus size={17} />} label="New playlist" onClick={close} />
              {playlists.length === 0 ? (
                <div style={{ padding: "8px 12px", fontSize: 12.5, color: "var(--text-3)" }}>No playlists yet.</div>
              ) : (
                playlists.map((p) => (
                  <Item key={p.id} icon={<ListMusic size={17} />} label={p.title} onClick={close} />
                ))
              )}
            </Group>
          </>
        )}
      </div>
    </div>
  );
}

function Group({ children, divider }: { children: React.ReactNode; divider?: boolean }) {
  return (
    <div style={{ borderTop: divider ? "1px solid var(--border)" : "none", paddingTop: divider ? 6 : 0, marginTop: divider ? 6 : 0 }}>
      {children}
    </div>
  );
}

function Item({ icon, label, onClick, chevron }: { icon: React.ReactNode; label: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button className="navitem" style={{ padding: "8px 10px", fontWeight: 500, fontSize: 13.5 }} onClick={onClick}>
      <span style={{ color: "var(--text-2)", display: "flex" }}>{icon}</span>
      <span className="ellipsis" style={{ flex: 1, textAlign: "left" }}>{label}</span>
      {chevron && <ChevronRight size={15} style={{ color: "var(--text-3)" }} />}
    </button>
  );
}
