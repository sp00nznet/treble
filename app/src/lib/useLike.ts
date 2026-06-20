import { useStore } from "../store";
import { likeTrack, unlikeTrack } from "./api";
import type { Track } from "../types";

/**
 * Liked Songs helper. `isLiked(id)` reads the in-memory set (kept in sync with the
 * DB); `toggle(track)` flips it optimistically and persists to the backend.
 */
export function useLike() {
  const { state, dispatch } = useStore();
  const isLiked = (id: string) => state.likedIds.includes(id);
  const toggle = (t: Track) => {
    const liked = isLiked(t.id);
    dispatch({ type: "toggleLikedLocal", id: t.id, liked: !liked });
    (liked ? unlikeTrack(t.id) : likeTrack(t)).catch(() => {
      // revert on failure
      dispatch({ type: "toggleLikedLocal", id: t.id, liked });
    });
  };
  return { isLiked, toggle };
}
