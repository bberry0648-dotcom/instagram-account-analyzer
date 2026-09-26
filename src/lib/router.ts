import { useEffect, useState } from 'react'

/**
 * Hash routing so GitHub Pages never 404s on refresh or deep links:
 *   #/                                  home
 *   #/a/<source>/<username>/<tab>?period=6m
 */
export interface Route {
  path: string[]
  query: URLSearchParams
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [p, q = ''] = hash.split('?')
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(path: string, query?: Record<string, string>, replace = false): void {
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const next = `#${path}${qs}`
  if (replace) window.history.replaceState(null, '', next)
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else window.location.hash = next
}

export function accountPath(source: string, username: string, tab = 'overview'): string {
  return `/a/${source}/${encodeURIComponent(username)}/${tab}`
}
