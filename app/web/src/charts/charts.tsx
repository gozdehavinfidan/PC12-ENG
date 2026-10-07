import { bin, extent, max } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { arc, area as d3area, curveStepAfter, line } from 'd3-shape'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, useState } from 'react'
import type { ContribKey } from '../api/types'
import s from './charts.module.css'

/* Chart rules followed here (dataviz skill): validated categorical slots in fixed
   order (A = --c1, B = --c2), one axis per chart, thin marks, recessive grid,
   text in text tokens (never series colour), legend for >= 2 series, hover
   readout on every chart. */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function mix(h1: string, h2: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = p(h1)
  const b = p(h2)
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`
}
/** compact axis numbers: 12000 -> 12k, 1500000 -> 1.5M */
export function compact(v: number) {
  const a = Math.abs(v)
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${+(v / 1e3).toFixed(0)}k`
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`
  return a >= 100 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)
}

/** diverging around the reference 0.5: protective blue <- neutral -> toxic magenta.
 *  DOM/SVG version: color-mix over CSS tokens, so the neutral midpoint follows
 *  the theme (dark grey on dark, light grey on white) with no re-render. */
export function ntiColor(v: number) {
  const t = Math.max(0, Math.min(1, v))
  return t < 0.5
    ? `color-mix(in oklab, var(--div-neg) ${Math.round((1 - t / 0.5) * 100)}%, var(--div-mid))`
    : `color-mix(in oklab, var(--div-pos) ${Math.round(((t - 0.5) / 0.5) * 100)}%, var(--div-mid))`
}

/** canvas version (canvas cannot resolve CSS variables) */
export function ntiColorHex(v: number, mid: string) {
  const t = Math.max(0, Math.min(1, v))
  return t < 0.5 ? mix('#2b8fe0', mid, t / 0.5) : mix(mid, '#d6528f', (t - 0.5) / 0.5)
}

export interface Series {
  label: string
  color: string
  values: number[]
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null
  return (
    <div className={s.legend}>
      {series.map((x) => (
        <span key={x.label}>
          <i style={{ background: x.color }} />
          {x.label}
        </span>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- histogram
export function Histogram({
  series,
  width = 280,
  height = 110,
  bins = 24,
  domain,
  unit = '',
  format = (v: number) => v.toFixed(0),
}: {
  series: Series[]
  width?: number
  height?: number
  bins?: number
  domain?: [number, number]
  unit?: string
  format?: (v: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((x) => x.values)
  const [lo, hi] = domain ?? (extent(all) as [number, number])
  const m = { l: 16, r: 16, t: 6, b: 20 }
  const x = scaleLinear().domain([lo ?? 0, hi ?? 1]).range([m.l, width - m.r]).nice()
  const binner = bin().domain(x.domain() as [number, number]).thresholds(x.ticks(bins))
  const hs = series.map((sr) => binner(sr.values).map((b) => ({ x0: b.x0!, x1: b.x1!, n: b.length / Math.max(1, sr.values.length) })))
  const y = scaleLinear().domain([0, max(hs.flat(), (b) => b.n) || 1]).range([height - m.b, m.t])
  const bw = hs[0]?.[0] ? x(hs[0][0].x1) - x(hs[0][0].x0) : 10
  return (
    <div className={s.wrap}>
      <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
        {y.ticks(3).map((t) => (
          <line key={t} x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className={s.grid} />
        ))}
        {hs.map((h, si) =>
          h.map((b, i) => {
            const w = Math.max(1, (bw - 2) / (series.length > 1 ? 2 : 1))
            const bx = x(b.x0) + 1 + (series.length > 1 ? si * w : 0)
            return (
              <motion.rect
                key={`${si}-${i}`}
                x={bx}
                width={w}
                initial={{ y: height - m.b, height: 0 }}
                animate={{ y: y(b.n), height: Math.max(0, height - m.b - y(b.n)) }}
                transition={{ duration: 0.5, delay: i * 0.012, ease: [0.2, 0, 0, 1] }}
                rx={1.5}
                fill={series[si].color}
                opacity={hover == null || hover === i ? 0.95 : 0.35}
                onMouseEnter={() => setHover(i)}
              />
            )
          }),
        )}
        <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} className={s.axis} />
        {x.ticks(Math.max(2, Math.floor(width / 80))).map((t) => (
          <text key={t} x={x(t)} y={height - 4} className={s.tick} textAnchor="middle">
            {compact(t)}
          </text>
        ))}
      </svg>
      {hover != null && hs[0]?.[hover] && (
        <div className={s.readout}>
          {format(hs[0][hover].x0)}–{format(hs[0][hover].x1)} {unit}
          {series.map((sr, si) => (
            <b key={sr.label} style={{ marginLeft: 8 }}>
              {series.length > 1 ? `${sr.label} ` : ''}
              {(hs[si][hover].n * 100).toFixed(0)}%
            </b>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  )
}

// ------------------------------------------------------------------- CDF
export function Cdf({ series, width = 300, height = 150, unit = '', format = (v: number) => v.toFixed(0) }: { series: Series[]; width?: number; height?: number; unit?: string; format?: (v: number) => string }) {
  const [hx, setHx] = useState<number | null>(null)
  const m = { l: 42, r: 14, t: 8, b: 22 }
  const all = series.flatMap((x) => x.values)
  const x = scaleLinear().domain([0, (max(all) ?? 1) * 1.02]).range([m.l, width - m.r]).nice()
  const y = scaleLinear().domain([0, 1]).range([height - m.b, m.t])
  const curves = series.map((sr) => {
    const v = [...sr.values].sort((a, b) => a - b)
    const pts: [number, number][] = [[x.domain()[0], 0]]
    v.forEach((val, i) => pts.push([val, (i + 1) / v.length]))
    pts.push([x.domain()[1], 1])
    return { sr, pts, sorted: v }
  })
  const ln = line<[number, number]>()
    .x((d) => x(d[0]))
    .y((d) => y(d[1]))
    .curve(curveStepAfter)
  const at = (sorted: number[], xv: number) => {
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] <= xv) lo = mid + 1
      else hi = mid
    }
    return sorted.length ? lo / sorted.length : 0
  }
  const reduce = useReducedMotion()
  return (
    <div className={s.wrap}>
      <svg
        width={width}
        height={height}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = e.clientX - r.left
          setHx(px < m.l || px > width - m.r ? null : x.invert(px))
        }}
        onMouseLeave={() => setHx(null)}
      >
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className={s.grid} />
            <text x={m.l - 6} y={y(t) + 3} className={s.tick} textAnchor="end">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {curves.map(({ sr, pts }) => (
          <motion.path
            key={sr.label}
            d={ln(pts) ?? ''}
            fill="none"
            stroke={sr.color}
            strokeWidth={2}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
          />
        ))}
        <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} className={s.axis} />
        {x.ticks(Math.max(2, Math.floor(width / 70))).map((t) => (
          <text key={t} x={x(t)} y={height - 5} className={s.tick} textAnchor="middle">
            {compact(t)}
          </text>
        ))}
        {hx != null && (
          <g>
            <line x1={x(hx)} x2={x(hx)} y1={m.t} y2={height - m.b} className={s.cross} />
            {curves.map(({ sr, sorted }) => (
              <circle key={sr.label} cx={x(hx)} cy={y(at(sorted, hx))} r={4} fill={sr.color} stroke="var(--bg-panel)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hx != null && (
        <div className={s.readout}>
          ≤ {format(hx)} {unit}
          {curves.map(({ sr, sorted }) => (
            <b key={sr.label} style={{ marginLeft: 8 }}>
              {sr.label} {(at(sorted, hx) * 100).toFixed(0)}%
            </b>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  )
}

// ------------------------------------------------------ polar (orientation)
export function Polar({ series, size = 170, bins = 18, span = 180 }: { series: Series[]; size?: number; bins?: number; span?: 180 | 360 }) {
  const [hover, setHover] = useState<number | null>(null)
  const r0 = 14
  const R = size / 2 - 14
  const step = span / bins
  const hs = series.map((sr) => {
    const c = new Array(bins).fill(0)
    for (const v of sr.values) c[Math.min(bins - 1, Math.floor(((v % span) + span) % span / step))]++
    const n = Math.max(1, sr.values.length)
    return c.map((k) => k / n)
  })
  const top = Math.max(...hs.flat(), 0.001)
  const rs = scaleLinear().domain([0, top]).range([r0, R])
  // orientation is axial (0 == 180): mirror so the rose reads symmetric
  const mirror = span === 180
  const id = useId()
  return (
    <div className={s.wrap}>
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} onMouseLeave={() => setHover(null)}>
        {[0.33, 0.66, 1].map((k) => (
          <circle key={k} r={r0 + (R - r0) * k} className={s.grid} fill="none" />
        ))}
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={Math.cos((a * Math.PI) / 180) * R} y1={-Math.sin((a * Math.PI) / 180) * R} x2={-Math.cos((a * Math.PI) / 180) * R} y2={Math.sin((a * Math.PI) / 180) * R} className={s.grid} />
        ))}
        {hs.map((h, si) =>
          h.flatMap((v, i) =>
            (mirror ? [0, 180] : [0]).map((off) => {
              const a0 = ((i * step + off) * Math.PI) / 180
              const a1 = (((i + 1) * step + off) * Math.PI) / 180
              const path = arc()({ innerRadius: r0, outerRadius: rs(v), startAngle: Math.PI / 2 - a1, endAngle: Math.PI / 2 - a0, padAngle: 0.02 } as never)
              return (
                <motion.path
                  key={`${id}-${si}-${i}-${off}`}
                  d={path ?? ''}
                  fill={series[si].color}
                  fillOpacity={series.length > 1 ? 0.5 : 0.62}
                  stroke="var(--bg-raised)"
                  strokeWidth={0.6}
                  opacity={hover == null || hover === i ? 1 : 0.35}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: hover == null || hover === i ? 1 : 0.35 }}
                  transition={{ duration: 0.45, delay: i * 0.015 }}
                  onMouseEnter={() => setHover(i)}
                />
              )
            }),
          ),
        )}
        <text y={-R - 3} className={s.tick} textAnchor="middle">
          90°
        </text>
        <text x={R + 3} y={3} className={s.tick} textAnchor="start">
          0°
        </text>
      </svg>
      {hover != null && (
        <div className={s.readout}>
          {(hover * step).toFixed(0)}–{((hover + 1) * step).toFixed(0)}°
          {series.map((sr, si) => (
            <b key={sr.label} style={{ marginLeft: 8 }}>
              {series.length > 1 ? `${sr.label} ` : ''}
              {(hs[si][hover] * 100).toFixed(0)}%
            </b>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  )
}

// ----------------------------------------------------- NTI contributions
const CONTRIB_LABEL: Record<ContribKey, string> = {
  neurite_length: 'Neurite length',
  branching: 'Branching',
  angle: 'Branch angle',
  soma: 'Soma shape',
}

export function ContribBars({ contrib, width = 290 }: { contrib: Record<ContribKey, number>; width?: number }) {
  const lim = 0.25
  const mid = 120 + (width - 120) / 2
  const half = (width - 120) / 2 - 36
  return (
    <div className={s.contrib}>
      {(Object.keys(CONTRIB_LABEL) as ContribKey[]).map((k, i) => {
        const v = contrib[k] ?? 0
        const w = (Math.min(lim, Math.abs(v)) / lim) * half
        return (
          <div key={k} className={s.contribRow} title={`${CONTRIB_LABEL[k]} contributes ${v >= 0 ? '+' : ''}${v.toFixed(3)} to NTI (uncalibrated formula)`}>
            <span className={s.contribLabel}>{CONTRIB_LABEL[k]}</span>
            <svg width={width - 120} height={16}>
              <line x1={mid - 120} x2={mid - 120} y1={0} y2={16} stroke="var(--line-3)" />
              <motion.rect
                y={3}
                height={10}
                rx={3}
                fill={v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'}
                initial={{ width: 0, x: mid - 120 }}
                animate={{ width: w, x: v >= 0 ? mid - 120 : mid - 120 - w }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 + i * 0.06 }}
              />
              <text x={v >= 0 ? mid - 120 + w + 5 : mid - 120 - w - 5} y={12} className={s.contribVal} textAnchor={v >= 0 ? 'start' : 'end'}>
                {v >= 0 ? '+' : '−'}
                {Math.abs(v).toFixed(2)}
              </text>
            </svg>
          </div>
        )
      })}
      <div className={s.contribAxis}>
        <span>← protective</span>
        <span>toxic →</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- NTI gauge
export function NtiGauge({ value, size = 150, live }: { value: number | null; size?: number; live?: boolean }) {
  const R = size / 2 - 10
  const a0 = -Math.PI * 0.75
  const a1 = Math.PI * 0.75
  const v = value == null ? 0 : Math.max(0, Math.min(1, value))
  const bg = arc()({ innerRadius: R - 9, outerRadius: R, startAngle: a0, endAngle: a1, cornerRadius: 5 } as never)
  const id = useId()
  const fg = arc()({ innerRadius: R - 9, outerRadius: R, startAngle: a0, endAngle: a0 + (a1 - a0) * v, cornerRadius: 5 } as never)
  const ticks = useMemo(() => Array.from({ length: 11 }, (_, i) => a0 + ((a1 - a0) * i) / 10), [a0, a1])
  return (
    <svg width={size} height={size * 0.78} viewBox={`${-size / 2} ${-size / 2} ${size} ${size * 0.78}`} className={s.gauge}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#2b8fe0" />
          <stop offset="0.5" stopColor="var(--div-mid)" />
          <stop offset="1" stopColor="#d6528f" />
        </linearGradient>
      </defs>
      <path d={bg ?? ''} fill="var(--bg-active)" />
      {value != null && <motion.path key={v.toFixed(3)} d={fg ?? ''} fill={`url(#g-${id})`} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />}
      {live && <path d={bg ?? ''} fill="none" stroke="var(--accent)" strokeOpacity={0.5} className={s.gaugeLive} />}
      {ticks.map((t, i) => (
        <line key={i} x1={Math.sin(t) * (R - 14)} y1={-Math.cos(t) * (R - 14)} x2={Math.sin(t) * (R - 17 - (i % 5 === 0 ? 3 : 0))} y2={-Math.cos(t) * (R - 17 - (i % 5 === 0 ? 3 : 0))} stroke="var(--text-4)" strokeWidth={1} />
      ))}
      <circle cx={Math.sin(a0 + (a1 - a0) * v) * (R - 4.5)} cy={-Math.cos(a0 + (a1 - a0) * v) * (R - 4.5)} r={value == null ? 0 : 5.5} fill="var(--text-1)" stroke="var(--bg-panel)" strokeWidth={2.5} style={{ transition: 'cx 600ms, cy 600ms' }} />
    </svg>
  )
}

// ------------------------------------------------------------ sparkline
export function Spark({ values, color = 'var(--text-3)', width = 92, height = 26 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (!values.length) return <svg width={width} height={height} />
  const [lo, hi] = extent(values) as [number, number]
  const x = scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).range([0, width])
  const bins = bin().domain(x.domain() as [number, number]).thresholds(14)(values)
  const y = scaleLinear().domain([0, max(bins, (b) => b.length) || 1]).range([height - 1, 2])
  const ar = d3area<(typeof bins)[number]>()
    .x((b) => x(((b.x0 ?? 0) + (b.x1 ?? 0)) / 2))
    .y0(height - 1)
    .y1((b) => y(b.length))
  return (
    <svg width={width} height={height}>
      <path d={ar(bins) ?? ''} fill={color} opacity={0.35} />
      <path d={ar.lineY1()(bins) ?? ''} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  )
}
