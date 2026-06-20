/**
 * The actual sound. A headless component that owns a single <audio> element and
 * keeps it in sync with the store: when `nowPlaying` changes it resolves a real
 * stream URL from the Rust core and plays it; `playing` toggles play/pause; it
 * reports playback position back to the store (driving every scrubber + the
 * synced lyrics), applies seek requests, and enforces the sleep timer.
 *
 * In a plain browser (no Tauri core / no yt-dlp) there's no stream to resolve, so
 * it simulates progress with a 1s ticker — the scrubbers still move for preview.
 */
import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { resolveStream, uiLog, downloadTrack } from "../lib/api";
import { isTauri } from "../lib/windows";
import { trackDuration } from "../lib/format";

export function AudioEngine() {
  const { state, dispatch } = useStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedId = useRef<string | null>(null); // the track we've committed to load
  const readyId = useRef<string | null>(null); // the track whose src is actually set
  const playingRef = useRef(state.playing);
  playingRef.current = state.playing;
  // Mirrored to refs so the (one-time) audio-element event handlers read fresh values.
  const repeatRef = useRef(state.repeat);
  repeatRef.current = state.repeat;
  // Consecutive resolve/playback failures — used to auto-skip dead tracks without
  // looping forever (give up once we've skipped roughly a whole queue).
  const failRef = useRef(0);
  const queueLenRef = useRef(1);
  queueLenRef.current = Math.max(1, state.queue.length);
  // Latest position, mirrored to a ref so the browser-sim ticker reads fresh values
  // (and so seeks mid-simulation are respected).
  const posRef = useRef(state.positionSecs);
  posRef.current = state.positionSecs;

  // Create the audio element once and pipe its position into the store.
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;
    const onTime = () => dispatch({ type: "setProgress", position: el.currentTime, duration: el.duration || 0 });
    const onMeta = () => dispatch({ type: "setProgress", position: el.currentTime, duration: el.duration || 0 });
    // Track ended → advance the queue (repeat-one replays the same track).
    const onEnded = () => {
      if (repeatRef.current === "one") { el.currentTime = 0; el.play().catch(() => {}); return; }
      dispatch({ type: "next", auto: true });
    };
    const onError = () => {
      dispatch({ type: "setLoading", loading: false });
      uiLog(`audio error: ${el.error?.code ?? "?"} for ${el.currentSrc?.slice(0, 60)}`);
      // A dead source: skip to the next track so playback doesn't just stall, but
      // give up once we've skipped about a whole queue (avoid an endless loop).
      if (playingRef.current && failRef.current < queueLenRef.current) {
        failRef.current += 1;
        dispatch({ type: "next", auto: true });
      }
    };
    const onPlaying = () => { failRef.current = 0; dispatch({ type: "setLoading", loading: false }); uiLog("audio playing"); };
    const onCanPlay = () => dispatch({ type: "setLoading", loading: false });
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      el.pause();
      el.src = "";
    };
  }, [dispatch]);

  // Load a new track's stream when nowPlaying changes (Tauri only).
  useEffect(() => {
    const el = audioRef.current;
    const track = state.nowPlaying;
    if (!el || !track) return;
    if (loadedId.current === track.id) return;
    if (!isTauri()) return;

    // A different track was requested: STOP the current audio immediately so the
    // old song/podcast can't keep playing while the new one resolves, and mark
    // the loaded source stale so the play/pause effect won't resume it.
    el.pause();
    readyId.current = null;

    let cancelled = false;
    loadedId.current = track.id;
    uiLog(`play requested: ${track.title} (${track.id})`);
    (async () => {
      try {
        const url = await resolveStream(track.id);
        // Bail if cancelled or the user already moved on to yet another track.
        if (cancelled || loadedId.current !== track.id) return;
        uiLog(`stream resolved, setting src + play`);
        el.src = url;
        readyId.current = track.id;
        if (playingRef.current) await el.play().catch((e) => uiLog(`play() rejected: ${e}`));
      } catch (e) {
        if (cancelled) return;
        dispatch({ type: "setLoading", loading: false });
        uiLog(`resolveStream failed: ${e}`);
        // Couldn't resolve a stream — skip this track (bounded, see onError).
        if (playingRef.current && failRef.current < queueLenRef.current) {
          failRef.current += 1;
          dispatch({ type: "next", auto: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.nowPlaying]);

  // Reflect play/pause — but only act on the audio that actually belongs to the
  // current track (never resume a stale source that's still being replaced).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (readyId.current !== state.nowPlaying?.id) return;
    if (state.playing) el.play().catch(() => {});
    else el.pause();
  }, [state.playing, state.nowPlaying]);

  // Reflect volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume;
  }, [state.volume]);

  // Auto-download: cache streamed tracks for offline as they play, when enabled.
  useEffect(() => {
    const t = state.nowPlaying;
    if (!t || !isTauri()) return;
    if (state.autoDownload && !t.downloaded && !t.id.startsWith("local:")) {
      void downloadTrack(t);
    }
  }, [state.nowPlaying, state.autoDownload]);

  // Apply a UI seek request.
  useEffect(() => {
    if (state.pendingSeek == null) return;
    const el = audioRef.current;
    if (el && el.src && Number.isFinite(el.duration)) el.currentTime = state.pendingSeek;
    dispatch({ type: "seekDone" });
  }, [state.pendingSeek, dispatch]);

  // Browser preview: no real audio, so simulate progress so scrubbers move.
  useEffect(() => {
    if (isTauri()) return;
    if (!state.playing || !state.nowPlaying) return;
    const dur = trackDuration(state.nowPlaying) || 200;
    const id = window.setInterval(() => {
      const next = posRef.current + 1;
      if (next >= dur) {
        dispatch({ type: "setProgress", position: dur, duration: dur });
        if (playingRef.current) dispatch({ type: "next", auto: true });
      } else {
        dispatch({ type: "setProgress", position: next, duration: dur });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.playing, state.nowPlaying, dispatch]);

  // Sleep timer: pause playback when the deadline passes.
  useEffect(() => {
    if (state.sleepEndsAt == null) return;
    const ms = state.sleepEndsAt - Date.now();
    const fire = () => {
      if (playingRef.current) dispatch({ type: "togglePlay" });
      dispatch({ type: "setSleep", endsAt: null });
    };
    if (ms <= 0) {
      fire();
      return;
    }
    const id = window.setTimeout(fire, ms);
    return () => window.clearTimeout(id);
  }, [state.sleepEndsAt, dispatch]);

  return null;
}
