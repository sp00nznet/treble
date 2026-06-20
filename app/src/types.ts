/** Core domain types for Treble. Expand as the player/library grow. */

export type Screen =
  | "home"
  | "search"
  | "explore"
  | "library"
  | "detail"
  | "downloads"
  | "settings"
  | "queue";

export type ThemeName = "light" | "dark";
export type ThemePref = "light" | "dark" | "auto";
export type AccentName = "Amber" | "Coral" | "Rose" | "Gold";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string; // "3:58" — display string
  /** Source of truth for scrubbing/lyrics sync; 0 when unknown (mock data). */
  duration_secs?: number;
  /** A CSS gradient (mock data) OR a real cover-art URL (`http(s)://…`) from the catalog. */
  art: string;
  downloaded?: boolean;
}

/** True when `art` is a real image URL rather than a CSS gradient placeholder. */
export function isArtUrl(art: string): boolean {
  return /^https?:\/\//.test(art);
}

export interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  art: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  art: string;
  shape?: "square" | "circle";
}
