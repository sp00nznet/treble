import { Play } from "lucide-react";
import { useStore } from "../store";
import type { Track } from "../types";

interface Props {
  track: Track;
  index: number;
  /** Grid template for the columns this row should render. */
  columns: string;
  showAlbum?: boolean;
}

/**
 * One song row. Hover swaps the index for a play glyph (see :hover in global.css —
 * extend there). Right-click should open the context menu (TODO: <ContextMenu/>).
 */
export function TrackRow({ track, index, columns, showAlbum = true }: Props) {
  const { dispatch } = useStore();
  return (
    <div
      className="trk"
      style={{ gridTemplateColumns: columns }}
      onClick={() => dispatch({ type: "play", track })}
      onContextMenu={(e) => {
        e.preventDefault();
        dispatch({ type: "openMenu", x: e.clientX, y: e.clientY, track });
      }}
    >
      <span className="idx">{index + 1}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span className="trk-art" style={{ background: track.art }} />
        <span style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{track.title}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{track.artist}</span>
        </span>
      </span>
      {showAlbum && <span className="ellipsis" style={{ fontSize: 13, color: "var(--text-2)" }}>{track.album}</span>}
      <span style={{ fontSize: 13, color: "var(--text-3)", textAlign: "right" }}>{track.duration}</span>
    </div>
  );
}
