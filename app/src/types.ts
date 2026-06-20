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
  duration: string; // "3:58" — swap to seconds when wiring real playback
  /** CSS gradient placeholder in mock data; real cover URL in production. */
  art: string;
  downloaded?: boolean;
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
