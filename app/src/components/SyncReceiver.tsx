import { useEffect } from "react";
import { useStore } from "../store";
import { listen, importLibrary, downloadMany, type SendMessage, type CorePlaylist } from "../lib/api";
import type { Track } from "../types";

/**
 * Headless handler for inbound LAN messages (`sync:received`). Mounted in BOTH the
 * desktop and mobile shells. A sent track plays; a sent playlist is imported AND
 * downloaded for offline — this is the "Send → device" companion flow: discover on
 * the desktop, push a playlist, the phone keeps a playable offline copy.
 */
export function SyncReceiver() {
  const { dispatch } = useStore();
  useEffect(() => {
    let un: (() => void) | undefined;
    listen<SendMessage>("sync:received", (msg) => {
      if (msg.kind === "Track") {
        dispatch({ type: "play", track: msg.data as Track });
        dispatch({ type: "go", screen: "home" });
      } else if (msg.kind === "Playlist") {
        const pl = msg.data as CorePlaylist;
        importLibrary({ version: 1, device_id: "peer", playlists: [pl] }).then(() => {
          dispatch({ type: "refreshLibrary" });
          // Make the sent playlist available offline (resolves via this device's
          // own yt-dlp on desktop, or a desktop companion on a phone).
          if (pl.tracks && pl.tracks.length) void downloadMany(pl.tracks);
          dispatch({ type: "go", screen: "library" });
        }).catch(() => {});
      } else {
        importLibrary(msg.data).then(() => dispatch({ type: "refreshLibrary" })).catch(() => {});
      }
    }).then((u) => (un = u));
    return () => un?.();
  }, [dispatch]);
  return null;
}
