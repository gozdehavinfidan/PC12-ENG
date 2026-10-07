import { createStore, type StoreApi } from 'zustand/vanilla'

/**
 * Camera state in image pixels, kept OUTSIDE React: pan/zoom writes here at
 * pointer rate and every subscriber (r3f camera, minimap, scale bar, labels)
 * reads it imperatively — no React re-render per frame (CLAUDE.md s4.8).
 * Two viewers sharing one store = synchronised multi-view (s5.5, U2).
 */
export interface Viewport {
  cx: number // image x at the viewport centre
  cy: number
  zoom: number // screen px per image px
  vw: number // viewport size in CSS px (last viewer that measured)
  vh: number
  imgW: number
  imgH: number
}

export type ViewportStore = StoreApi<Viewport>

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 40

export function createViewport(): ViewportStore {
  return createStore<Viewport>(() => ({ cx: 960, cy: 540, zoom: 0.5, vw: 1, vh: 1, imgW: 1920, imgH: 1080 }))
}

export const viewports = {
  main: createViewport(),
  preprocess: createViewport(),
  compare: createViewport(),
  review: createViewport(),
}

export function fitZoom(imgW: number, imgH: number, vw: number, vh: number, pad = 0.92) {
  return Math.min((vw * pad) / imgW, (vh * pad) / imgH)
}

export function fit(store: ViewportStore, pad = 0.92) {
  const s = store.getState()
  store.setState({ cx: s.imgW / 2, cy: s.imgH / 2, zoom: fitZoom(s.imgW, s.imgH, s.vw, s.vh, pad) })
}

let flight = 0
/** Animated camera flight (object list -> camera, s5.3). Interruptible. */
export function flyTo(store: ViewportStore, cx: number, cy: number, zoom?: number, ms = 520) {
  const id = ++flight
  const s0 = store.getState()
  const z1 = zoom ?? s0.zoom
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || ms <= 0) {
    store.setState({ cx, cy, zoom: z1 })
    return
  }
  const t0 = performance.now()
  // zoom interpolates in log space so the flight feels uniform
  const lz0 = Math.log(s0.zoom)
  const lz1 = Math.log(z1)
  const step = (now: number) => {
    if (id !== flight) return
    const t = Math.min(1, (now - t0) / ms)
    const e = 1 - Math.pow(1 - t, 3)
    store.setState({
      cx: s0.cx + (cx - s0.cx) * e,
      cy: s0.cy + (cy - s0.cy) * e,
      zoom: Math.exp(lz0 + (lz1 - lz0) * e),
    })
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function cancelFlight() {
  flight++
}

/** screen (CSS px, relative to the viewer) -> image px */
export function screenToImage(v: Viewport, sx: number, sy: number, vw = v.vw, vh = v.vh) {
  return { x: v.cx + (sx - vw / 2) / v.zoom, y: v.cy + (sy - vh / 2) / v.zoom }
}

export function imageToScreen(v: Viewport, x: number, y: number, vw = v.vw, vh = v.vh) {
  return { x: (x - v.cx) * v.zoom + vw / 2, y: (y - v.cy) * v.zoom + vh / 2 }
}
