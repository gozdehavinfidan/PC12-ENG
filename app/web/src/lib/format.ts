export const fmt = (v: number | null | undefined, d = 2) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d))

export function len(px: number | null | undefined, um: number | null, d = 1) {
  if (px == null) return '—'
  return um ? `${(px * um).toFixed(d)} µm` : `${px.toFixed(0)} px`
}

export function area(px: number | null | undefined, um: number | null) {
  if (px == null) return '—'
  return um ? `${(px * um * um).toFixed(um * um * px < 10 ? 2 : 0)} µm²` : `${px.toFixed(0)} px²`
}

export const lenUnit = (um: number | null) => (um ? 'µm' : 'px')
export const lenVal = (px: number, um: number | null) => (um ? px * um : px)
export const areaVal = (px: number, um: number | null) => (um ? px * um * um : px)
export const areaUnit = (um: number | null) => (um ? 'µm²' : 'px²')

/** pick a 1/2/5 x 10^n length that renders between lo and hi screen px */
export function niceScale(unitsPerScreenPx: number, targetPx = 110) {
  const raw = unitsPerScreenPx * targetPx
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  const n = m >= 5 ? 5 : m >= 2 ? 2 : 1
  const value = n * p
  return { value, px: value / unitsPerScreenPx }
}

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`

export function signed(v: number, d = 2) {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
}

export function timeAgo(ts: number) {
  const s = Math.max(0, Date.now() / 1000 - ts)
  if (s < 60) return `${s.toFixed(0)} s ago`
  if (s < 3600) return `${(s / 60).toFixed(0)} min ago`
  return `${(s / 3600).toFixed(1)} h ago`
}
