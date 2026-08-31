import * as React from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * A media query is external state, so it is read through useSyncExternalStore rather
 * than mirrored into an effect. That avoids the extra render pass on mount, and React
 * keeps the value consistent if it renders the tree more than once.
 */
function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  query.addEventListener('change', onStoreChange)

  return () => query.removeEventListener('change', onStoreChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

/** There is no viewport on the server; assume desktop and let the client correct it. */
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
