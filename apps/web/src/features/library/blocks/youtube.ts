/**
 * The corner of YouTube's IFrame Player API this app touches, typed by hand: the package
 * of types for it is larger than the use, and pins a global this file would rather own.
 */

export type YTPlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  /** Loads a position without playing — the only way to place a player that has not started. */
  cueVideoById(options: { videoId: string; startSeconds?: number }): void
  getCurrentTime(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  destroy(): void
}

export type YTPlayerEvent = { data: number; target: YTPlayer }

type YTNamespace = {
  Player: new (
    element: HTMLIFrameElement | string,
    options: {
      events?: {
        onReady?: (event: YTPlayerEvent) => void
        onStateChange?: (event: YTPlayerEvent) => void
        onPlaybackRateChange?: (event: YTPlayerEvent) => void
      }
    },
  ) => YTPlayer
  PlayerState: {
    UNSTARTED: -1
    ENDED: 0
    PLAYING: 1
    PAUSED: 2
    BUFFERING: 3
    CUED: 5
  }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** The states, as numbers, so a component need not wait for the script to name them. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

let loading: Promise<YTNamespace> | null = null

/**
 * Loads the API script once for the page and resolves when it is ready. Only a live lesson
 * asks for it: everywhere else a video is an iframe and nothing more.
 */
export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading

  loading = new Promise<YTNamespace>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })

  return loading
}
