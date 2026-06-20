import { useEffect, useState } from "react";
import { Play, Loader2, Check, Plus } from "lucide-react";
import { useStore } from "../store";
import { podcastEpisodes, subscribePodcast, unsubscribePodcast, listSubscriptions } from "../lib/api";
import { artBg } from "../lib/art";
import type { Track } from "../types";

/** A podcast show: its episodes, played directly from the RSS enclosure URLs. */
export function Podcast() {
  const { state, dispatch } = useStore();
  const show = state.podcast;
  const [eps, setEps] = useState<Track[] | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!show) return;
    setEps(null);
    podcastEpisodes(show.feedUrl, show.art).then(setEps).catch(() => setEps([]));
    listSubscriptions().then((s) => setSubscribed(s.some((p) => p.feed_url === show.feedUrl)));
  }, [show?.feedUrl]);

  if (!show) return null;

  const toggleSub = async () => {
    if (subscribed) {
      await unsubscribePodcast(show.feedUrl);
      setSubscribed(false);
    } else {
      await subscribePodcast({ id: show.feedUrl, title: show.title, author: show.author, art: show.art, feed_url: show.feedUrl });
      setSubscribed(true);
    }
    dispatch({ type: "refreshLibrary" });
  };

  return (
    <div>
      <header style={{ padding: "40px 34px 24px", display: "flex", gap: 26, alignItems: "flex-end", background: "linear-gradient(180deg,var(--accent-soft),transparent)" }}>
        <div style={{ width: 200, height: 200, borderRadius: 16, flex: "none", background: artBg(show.art), boxShadow: "0 20px 44px var(--shadow)" }} />
        <div style={{ paddingBottom: 6 }}>
          <div className="eyebrow" style={{ color: "var(--text-2)" }}>Podcast</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 46, lineHeight: 1.04, letterSpacing: "-.02em", margin: "8px 0 10px" }}>{show.title}</h1>
          <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 14 }}>{show.author}{eps ? ` · ${eps.length} episodes` : ""}</div>
          <button className={`chip press${subscribed ? "" : " active"}`} style={{ display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => void toggleSub()}>
            {subscribed ? <><Check size={16} /> Subscribed</> : <><Plus size={16} /> Subscribe</>}
          </button>
        </div>
      </header>

      <div style={{ padding: "12px 34px 40px" }}>
        {eps === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-2)", padding: "20px 12px", fontSize: 14 }}>
            <Loader2 size={18} className="spin" /> Loading episodes…
          </div>
        ) : eps.length === 0 ? (
          <div style={{ padding: "20px 12px", color: "var(--text-2)", fontSize: 14 }}>Couldn't load episodes for this show.</div>
        ) : (
          eps.map((ep, i) => (
            <div
              key={ep.id || i}
              className="trk"
              style={{ gridTemplateColumns: "40px 1fr 70px" }}
              onClick={() => dispatch({ type: "play", track: ep })}
              onContextMenu={(e) => { e.preventDefault(); dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track: ep }); }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
                <Play size={16} fill="currentColor" />
              </span>
              <span style={{ minWidth: 0, alignSelf: "center" }}>
                <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{ep.title}</span>
              </span>
              <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right", alignSelf: "center" }}>{ep.duration}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
