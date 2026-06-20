/**
 * The actual sound. A headless component that owns a single <audio> element and
 * keeps it in sync with the store: when `nowPlaying` changes it resolves a real
 * stream URL from the Rust core and plays it; `playing` toggles play/pause.
 *
 * Under a plain browser (no Tauri core, no yt-dlp) there's nothing to resolve, so
 * this stays inert and the UI remains a visual preview.
 */
import { useEffect, useRef } from "react";
import { useStore } from "../store";
import { resolveStream } from "../lib/api";
import { isTauri } from "../lib/windows";

export function AudioEngine() {
  const { state, dispatch } = useStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedId = useRef<string | null>(null);

  // Create the audio element once.
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;
    const onEnded = () => dispatch({ type: "togglePlay" }); // simplistic: stop at end
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("ended", onEnded);
      el.pause();
      el.src = "";
    };
  }, [dispatch]);

  // Load a new track's stream when nowPlaying changes.
  useEffect(() => {
    const el = audioRef.current;
    const track = state.nowPlaying;
    if (!el || !track) return;
    if (loadedId.current === track.id) return;
    if (!isTauri()) return; // no resolver in the browser preview

    let cancelled = false;
    loadedId.current = track.id;
    (async () => {
      try {
        const url = await resolveStream(track.id);
        if (cancelled) return;
        el.src = url;
        if (state.playing) await el.play().catch(() => {});
      } catch {
        // Surface nothing intrusive; the track just won't start. (Logged by core.)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.nowPlaying, state.playing]);

  // Reflect play/pause state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (state.playing) el.play().catch(() => {});
    else el.pause();
  }, [state.playing]);

  return null;
}
