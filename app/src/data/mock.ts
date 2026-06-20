import type { LibraryItem, Playlist, Track } from "./types";

const g = (s: string) => `linear-gradient(135deg,${s})`;
/** Gradient placeholders stand in for cover art until real URLs are wired. */
export const ART = [
  g("#FF8A5B,#FFC15B"),
  g("#6C8CFF,#9B6CFF"),
  g("#2BC4A0,#7BE0C0"),
  g("#FF6B8B,#FFA86B"),
  g("#3A3A5C,#7A6CFF"),
  g("#E8A87C,#C38D5F"),
  g("#5BC0FF,#5B8AFF"),
  g("#F26B8A,#7A3A5C"),
  g("#8AC15B,#3A8A5C"),
  g("#FFC15B,#FF6B5C"),
];

export const LIKED_ART = g("#7A6CFF,#FF6B8B");

export const PLAYLISTS: Playlist[] = [
  { id: "liked", title: "Liked Songs", subtitle: "842 songs", art: LIKED_ART },
  { id: "lnd", title: "Late Night Drive", subtitle: "Playlist · Kaz", art: ART[0] },
  { id: "focus", title: "Focus Flow", subtitle: "Playlist · Kaz", art: ART[2] },
  { id: "golden", title: "Golden Hour", subtitle: "Playlist · Kaz", art: ART[5] },
  { id: "rainy", title: "Rainy Days", subtitle: "Playlist · Kaz", art: ART[4] },
  { id: "coffee", title: "Sunday Coffee", subtitle: "Playlist · Kaz", art: ART[9] },
];

const RAW: [string, string, string, string][] = [
  ["Midnight Coast", "Halsey Lane", "Neon Tide", "3:58"],
  ["Paper Planes", "Norah Vale", "Quiet Light", "4:12"],
  ["Golden", "The Idle Hours", "Coastline", "3:21"],
  ["Velvet Morning", "June Carver", "Slow Burn", "3:45"],
  ["Hollow", "Atlas Bay", "Driftwood", "4:02"],
  ["Cinnamon", "Norah Vale", "Quiet Light", "3:33"],
  ["Lantern", "Halsey Lane", "Neon Tide", "3:50"],
  ["Riverbed", "The Idle Hours", "Coastline", "4:28"],
];

export const TRACKS: Track[] = RAW.map((t, i) => ({
  id: `t${i}`,
  title: t[0],
  artist: t[1],
  album: t[2],
  duration: t[3],
  art: ART[(i + 1) % ART.length],
  downloaded: i < 6,
}));

export const QUICK_PICKS: Playlist[] = [
  { id: "liked", title: "Liked Songs", subtitle: "", art: LIKED_ART },
  { id: "dm1", title: "Daily Mix 1", subtitle: "", art: ART[0] },
  { id: "dw", title: "Discover Weekly", subtitle: "", art: ART[2] },
  { id: "lofi", title: "Chill Lofi Beats", subtitle: "", art: ART[5] },
  { id: "tb", title: "2000s Throwback", subtitle: "", art: ART[7] },
  { id: "nr", title: "New Releases", subtitle: "", art: ART[8] },
];

export const MADE_FOR_YOU: Playlist[] = [
  { id: "dm1", title: "Daily Mix 1", subtitle: "Halsey Lane, Norah Vale and more", art: ART[0] },
  { id: "dw", title: "Discover Weekly", subtitle: "Your weekly mixtape of fresh finds", art: ART[2] },
  { id: "golden", title: "Golden Hour", subtitle: "Warm indie & soul for the evening", art: ART[5] },
  { id: "focus", title: "Deep Focus", subtitle: "Ambient instrumental concentration", art: ART[4] },
  { id: "repeat", title: "On Repeat", subtitle: "Songs you can’t stop playing", art: ART[1] },
];

export const LIBRARY: Record<string, LibraryItem[]> = {
  Playlists: PLAYLISTS.map((p) => ({ ...p, subtitle: p.subtitle })),
  Albums: ["Coastline", "Slow Burn", "Driftwood", "Neon Tide", "Quiet Light"].map((t, i) => ({
    id: `al${i}`,
    title: t,
    subtitle: ["The Idle Hours", "June Carver", "Atlas Bay", "Halsey Lane", "Norah Vale"][i],
    art: ART[i % ART.length],
  })),
  Artists: ["Halsey Lane", "Norah Vale", "The Idle Hours", "June Carver", "Atlas Bay"].map((t, i) => ({
    id: `ar${i}`,
    title: t,
    subtitle: "Artist",
    art: ART[i % ART.length],
    shape: "circle" as const,
  })),
  Podcasts: [
    ["The Midnight Hour", "Nocturne Media"],
    ["Sound & Static", "Halsey Lane"],
    ["Liner Notes", "Atlas Bay Studio"],
    ["Off the Record", "June Carver"],
  ].map((p, i) => ({ id: `pc${i}`, title: p[0], subtitle: p[1], art: ART[i % ART.length] })),
};

export const LYRICS: { text: string; active?: boolean }[] = [
  { text: "City lights bleed in the rain" },
  { text: "Engine humming low and slow" },
  { text: "Driving down the midnight coast", active: true },
  { text: "Headlights chasing yesterday" },
  { text: "And I can’t let go" },
  { text: "Of the way you said my name" },
  { text: "Under all that golden glow" },
  { text: "The radio plays our song" },
  { text: "And the night just carries on" },
];

export const GENRES: { label: string; art: string }[] = [
  "Pop", "Hip-Hop", "Rock", "Indie", "Electronic", "Jazz", "Classical", "R&B",
  "Lo-fi", "Ambient", "Metal", "Folk",
].map((label, i) => ({ label, art: ART[i % ART.length] }));

export const RECENT_SEARCHES: { label: string; art: string }[] = [
  { label: "Halsey Lane", art: ART[0] },
  { label: "Lo-fi beats", art: ART[2] },
  { label: "Norah Vale", art: ART[3] },
  { label: "80s Synthwave", art: ART[4] },
  { label: "Jazz Cafe", art: ART[5] },
];

export const CHARTS: { title: string; subtitle: string; art: string }[] = [
  { title: "Top 50 — Global", subtitle: "Updated daily", art: g("#FF6B5C,#FFB35C") },
  { title: "Viral 50", subtitle: "Trending now", art: g("#7A6CFF,#FF6B8B") },
  { title: "New Music Friday", subtitle: "This week’s drops", art: ART[2] },
  { title: "Indie Rising", subtitle: "Underground picks", art: ART[8] },
];

export const NEW_RELEASES: Playlist[] = [
  { id: "coastline", title: "Coastline", subtitle: "The Idle Hours", art: ART[2] },
  { id: "slowburn", title: "Slow Burn", subtitle: "June Carver", art: ART[5] },
  { id: "driftwood", title: "Driftwood", subtitle: "Atlas Bay", art: ART[4] },
  { id: "neontide", title: "Neon Tide", subtitle: "Halsey Lane", art: ART[3] },
  { id: "quietlight", title: "Quiet Light", subtitle: "Norah Vale", art: ART[7] },
];
