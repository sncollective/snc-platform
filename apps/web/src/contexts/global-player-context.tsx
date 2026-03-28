"use no memo";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type React from "react";
import type { ReactNode } from "react";

// ── Public Types ──

export type MediaContentType = "audio" | "video" | "live" | "playout";

export type PlayerPresentation = "expanded" | "collapsed" | "hidden";

export interface MediaMetadata {
  readonly id: string;
  readonly contentType: MediaContentType;
  readonly title: string;
  readonly artist: string;
  readonly posterUrl: string | null;
  readonly source: string | { readonly src: string; readonly type: string };
  readonly streamType: "on-demand" | "live";
  /** Canonical URL for "return to content" link in collapsed player. */
  readonly contentUrl: string;
}

export interface GlobalPlayerState {
  readonly media: MediaMetadata | null;
  /** ID of the content whose detail page is currently mounted. Set by detail components. */
  readonly activeDetailId: string | null;
  /** True only when playback was triggered by a user gesture via play(). False on page load. */
  readonly shouldAutoPlay: boolean;
}

export interface GlobalPlayerActions {
  /** Load new content and begin playback. Replaces any current media. */
  readonly play: (media: MediaMetadata) => void;
  /** Stop playback and clear the loaded media entirely. */
  readonly clear: () => void;
  /** Signal that a detail page for this content ID is mounted (expanded mode). Pass null on unmount. */
  readonly setActiveDetail: (id: string | null) => void;
}

export interface GlobalPlayerContextValue {
  readonly state: GlobalPlayerState;
  readonly presentation: PlayerPresentation;
  readonly actions: GlobalPlayerActions;
}

// ── Constants ──

export const INITIAL_STATE: GlobalPlayerState = {
  media: null,
  activeDetailId: null,
  shouldAutoPlay: false,
};

// ── Reducer ──

type GlobalPlayerAction =
  | { readonly type: "PLAY"; readonly media: MediaMetadata }
  | { readonly type: "CLEAR" }
  | { readonly type: "SET_ACTIVE_DETAIL"; readonly id: string | null };

/** Pure reducer for global player state. */
export function globalPlayerReducer(
  state: GlobalPlayerState,
  action: GlobalPlayerAction,
): GlobalPlayerState {
  switch (action.type) {
    case "PLAY":
      return { ...state, media: action.media, shouldAutoPlay: true };
    case "CLEAR":
      return INITIAL_STATE;
    case "SET_ACTIVE_DETAIL":
      return { ...state, activeDetailId: action.id };
  }
}

// ── Context ──

const GlobalPlayerContext = createContext<GlobalPlayerContextValue | null>(null);

// ── Provider ──

/** Global media playback state. Manages one-at-a-time playback for all content types. */
export function GlobalPlayerProvider({
  children,
}: Readonly<{ children: ReactNode }>): React.ReactElement {
  const [state, dispatch] = useReducer(globalPlayerReducer, INITIAL_STATE);

  const presentation = useMemo<PlayerPresentation>(() => {
    if (!state.media) return "hidden";
    if (state.activeDetailId === state.media.id) return "expanded";
    return "collapsed";
  }, [state.media, state.activeDetailId]);

  const actions = useMemo<GlobalPlayerActions>(
    () => ({
      play(media: MediaMetadata) {
        if (media.id === state.media?.id) return;
        dispatch({ type: "PLAY", media });
      },
      clear() {
        dispatch({ type: "CLEAR" });
      },
      setActiveDetail(id: string | null) {
        dispatch({ type: "SET_ACTIVE_DETAIL", id });
      },
    }),
    [state.media?.id],
  );

  const value = useMemo<GlobalPlayerContextValue>(
    () => ({ state, presentation, actions }),
    [state, presentation, actions],
  );

  return (
    <GlobalPlayerContext value={value}>
      {children}
    </GlobalPlayerContext>
  );
}

// ── Hook ──

/** Access global player state, presentation mode, and actions. Must be used within `GlobalPlayerProvider`. */
export function useGlobalPlayer(): GlobalPlayerContextValue {
  const context = useContext(GlobalPlayerContext);
  if (!context) {
    throw new Error("useGlobalPlayer must be used within a GlobalPlayerProvider");
  }
  return context;
}
