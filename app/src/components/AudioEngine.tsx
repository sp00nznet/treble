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
import { resolveStream } from "../lib/api";
import { isTauri } from "../lib/windows";
import { trackDuration } from "../lib/format";

export function AudioEngine() {
  const { state, dispatch } = useStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedId = useRef<string | null>(null);
  const playingRef = useRef(state.playing);
  playingRef.current = state.playing;
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
    const onEnded = () => dispatch({ type: "togglePlay" });
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
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

    let cancelled = false;
    loadedId.current = track.id;
    (async () => {
      try {
        const url = await resolveStream(track.id);
        if (cancelled) return;
        el.src = url;
        if (playingRef.current) await el.play().catch(() => {});
      } catch {
        /* track won't start; core logs the reason */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.nowPlaying]);

  // Reflect play/pause.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (state.playing) el.play().catch(() => {});
    else el.pause();
  }, [state.playing]);

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
        if (playingRef.current) dispatch({ type: "togglePlay" });
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
