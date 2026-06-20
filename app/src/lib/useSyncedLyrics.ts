/**
 * Loads lyrics for the current track and tracks which line is active based on the
 * live playback position. Real synced lyrics come from LRCLIB via the core; in the
 * browser (or when a track has no synced lyrics) we synthesize evenly-spaced
 * timings from the mock lines so the highlight still moves during preview.
 */
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { getLyrics, type Lyrics, type LyricLine } from "./api";
import { LYRICS } from "../data/mock";
import { isTauri } from "./windows";

// Cache lyrics per track id so the docked panel, full-screen player, and pop-out
// window don't each hit the network for the same track.
const lyricsCache = new Map<string, Promise<Lyrics>>();

export function useSyncedLyrics() {
  const { state, dispatch } = useStore();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [synced, setSynced] = useState(false);
  const track = state.nowPlaying;

  useEffect(() => {
    let live = true;
    if (!track) {
      setLines(fallbackLines(state.durationSecs));
      setSynced(false);
      return;
    }
    let cached = lyricsCache.get(track.id);
    if (!cached) {
      cached = getLyrics(track);
      lyricsCache.set(track.id, cached);
    }
    cached
      .then((ly) => {
        if (!live) return;
        if (ly.synced && ly.lines.length) {
          setLines(ly.lines);
          setSynced(true);
        } else if (!ly.synced && ly.plain) {
          setLines(ly.plain.split("\n").filter(Boolean).map((text) => ({ time_secs: -1, text })));
          setSynced(false);
        } else {
          setLines(fallbackLines(state.durationSecs));
          setSynced(false);
        }
      })
      .catch(() => live && setLines(fallbackLines(state.durationSecs)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  const activeIndex = useMemo(() => {
    if (!lines.length || lines[0].time_secs < 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time_secs <= state.positionSecs) idx = i;
      else break;
    }
    return idx;
  }, [lines, state.positionSecs]);

  const seekToLine = (i: number) => {
    const t = lines[i]?.time_secs;
    if (typeof t === "number" && t >= 0) dispatch({ type: "seek", secs: t });
  };

  return { lines, activeIndex, synced, seekToLine };
}

/**
 * Browser-preview only: spread the mock lyric lines across the track so the active
 * line advances. In the shipped app there's no fabricated fallback — a track with
 * no lyrics simply shows none.
 */
function fallbackLines(durationSecs: number): LyricLine[] {
  if (isTauri()) return [];
  const dur = durationSecs > 0 ? durationSecs : 200;
  const step = dur / (LYRICS.length + 1);
  return LYRICS.map((l, i) => ({ time_secs: step * (i + 1), text: l.text }));
}
