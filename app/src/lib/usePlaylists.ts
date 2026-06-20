/**
 * The user's real playlists from the library DB, refreshed whenever the library
 * changes (imports, local scans, received-from-peer). In a plain browser this
 * resolves to the mock catalog (api.listPlaylists' fallback) so previews populate;
 * in the shipped app it's strictly real data — no fabricated content.
 */
import { useEffect, useState } from "react";
import { useStore } from "../store";
import { listPlaylists, type CorePlaylist } from "./api";

export function usePlaylists(): CorePlaylist[] {
  const { state } = useStore();
  const [playlists, setPlaylists] = useState<CorePlaylist[]>([]);
  useEffect(() => {
    let live = true;
    listPlaylists()
      .then((p) => live && setPlaylists(p))
      .catch(() => live && setPlaylists([]));
    return () => {
      live = false;
    };
  }, [state.libRefresh]);
  return playlists;
}
