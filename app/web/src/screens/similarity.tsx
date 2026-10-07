import { Info, Microscope, RefreshCw, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, urls } from '../api/client'
import type { SimCell, SimGroupKey, Similarity as Sim } from '../api/types'
import { ntiColorHex } from '../charts/charts'
import { cssVar, useTheme } from '../state/theme'
import { Badge, Button, Section, Segmented } from '../components/ui'
import { useApp } from '../state/app'
import sh from '../shell/shell.module.css'
import s from './screens.module.css'

// validated categorical slots, fixed order (dataviz rule: colour follows the entity)
type ColorKey = SimGroupKey | 'nti'

const keyOf = (c: SimCell, k: SimGroupKey) => (c[k] as string | null | undefined) ?? '—'
const SLOTS = ['#2b8fe0', '#d9772a', '#2fa67f', '#b88916', '#d6528f', '#8f7ef0']
const FEATURE_LABEL: Record<string, string> = {
  area_px: 'soma area',
  circularity: 'circularity',
  eccentricity: 'eccentricity',
  neurite_length_px: 'neurite length',
  branches: 'branches',
  nti: 'cell NTI',
}

// crop cache: one decoded full image per id, crops drawn on demand
const imgCache = new Map<string, Promise<HTMLImageElement>>()
function loadImg(id: string) {
  if (!imgCache.has(id))
    imgCache.set(
      id,
      new Promise((res, rej) => {
        const im = new Image()
        im.decoding = 'async'
        im.onload = () => res(im)
        im.onerror = rej
        im.src = urls.raw(id)
      }),
    )
  return imgCache.get(id)!
}

function Crop({ cell, size = 84, ring }: { cell: SimCell; size?: number; ring?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    loadImg(cell.image_id).then((im) => {
      const c = ref.current
      if (!alive || !c) return
      const [x0, y0, x1, y1] = cell.bbox
      const half = Math.max(28, Math.max(x1 - x0, y1 - y0) * 1.6)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const g = c.getContext('2d')!
      g.imageSmoothingQuality = 'high'
      g.fillStyle = '#07080c'
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(im, cx - half, cy - half, half * 2, half * 2, 0, 0, c.width, c.height)
    })
    return () => {
      alive = false
    }
  }, [cell])
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size, borderRadius: 8, boxShadow: `inset 0 0 0 1px var(--line-2)${ring ? `, 0 0 0 2px ${ring}` : ''}`, background: '#07080c', display: 'block' }} />
}

function Atlas({ sim, colorKey, selected, onSelect }: { sim: Sim; colorKey: ColorKey; selected: number | null; onSelect: (i: number | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const theme = useTheme((st) => st.theme) // canvas cannot read CSS vars: redraw on theme change
  const groups = useMemo(() => (colorKey === 'nti' ? [] : [...new Set(sim.cells.map((c) => keyOf(c, colorKey)))].sort()), [sim, colorKey])
  const color = useCallback((g: string) => (groups.length > SLOTS.length && groups.indexOf(g) >= SLOTS.length - 1 ? '#6b6e85' : SLOTS[groups.indexOf(g) % SLOTS.length]), [groups])
  const pad = 40
  // 1st-99th percentile frame; the rare cell outside is pinned to the edge
  const bounds = useMemo(() => {
    const q = (v: number[], p: number) => {
      const s = [...v].sort((a, b) => a - b)
      return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]
    }
    const xs = sim.cells.map((c) => c.xy[0])
    const ys = sim.cells.map((c) => c.xy[1])
    const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99)
    const mx = (x1 - x0) * 0.06, my = (y1 - y0) * 0.06
    return { x0: x0 - mx, x1: x1 + mx, y0: y0 - my, y1: y1 + my }
  }, [sim])
  const proj = useCallback(
    (c: SimCell) => {
      const u = Math.max(0, Math.min(1, (c.xy[0] - bounds.x0) / (bounds.x1 - bounds.x0 || 1)))
      const v = Math.max(0, Math.min(1, (c.xy[1] - bounds.y0) / (bounds.y1 - bounds.y0 || 1)))
      return { x: pad + u * (size.w - pad * 2), y: size.h - pad - v * (size.h - pad * 2) }
    },
    [bounds, size],
  )

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // animated entrance: points fly from the centre to their positions
  const t0 = useRef(performance.now())
  useEffect(() => {
    t0.current = performance.now()
  }, [sim, colorKey])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = size.w * dpr
    c.height = size.h * dpr
    const g = c.getContext('2d')!
    let raf = 0
    const nn = selected != null ? new Set(sim.cells[selected].nn.map(([j]) => j)) : null
    const ink = { grid: cssVar('--line-1'), text: cssVar('--text-3'), focus: cssVar('--text-1'), accent: cssVar('--accent'), mid: cssVar('--div-mid') || '#4a4c5e', surface: cssVar('--bg-panel') }
    const draw = () => {
      const k = Math.min(1, (performance.now() - t0.current) / 700)
      const e = 1 - Math.pow(1 - k, 3)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, size.w, size.h)
      // recessive grid
      g.strokeStyle = ink.grid
      g.lineWidth = 1
      for (let i = 1; i < 6; i++) {
        const x = pad + ((size.w - pad * 2) * i) / 6
        const y = pad + ((size.h - pad * 2) * i) / 6
        g.beginPath()
        g.moveTo(x, pad)
        g.lineTo(x, size.h - pad)
        g.moveTo(pad, y)
        g.lineTo(size.w - pad, y)
        g.stroke()
      }
      const cx = size.w / 2
      const cy = size.h / 2
      sim.cells.forEach((cell, i) => {
        const p = proj(cell)
        const x = cx + (p.x - cx) * e
        const y = cy + (p.y - cy) * e
        const dim = nn && i !== selected && !nn.has(i)
        g.globalAlpha = dim ? 0.18 : 0.85
        g.fillStyle = colorKey === 'nti' ? ntiColorHex(cell.nti, ink.mid) : color(keyOf(cell, colorKey))
        g.beginPath()
        g.arc(x, y, 4, 0, Math.PI * 2)
        g.fill()
        if (cell.outlier) {
          g.globalAlpha = dim ? 0.2 : 0.9
          g.strokeStyle = '#ff5555'
          g.lineWidth = 1.5
          g.beginPath()
          g.arc(x, y, 7, 0, Math.PI * 2)
          g.stroke()
        }
      })
      g.globalAlpha = 1
      if (selected != null && k === 1) {
        const p = proj(sim.cells[selected])
        g.strokeStyle = ink.accent
        g.lineWidth = 1.2
        for (const [j] of sim.cells[selected].nn) {
          const q = proj(sim.cells[j])
          g.beginPath()
          g.moveTo(p.x, p.y)
          g.lineTo(q.x, q.y)
          g.stroke()
          g.beginPath()
          g.arc(q.x, q.y, 6, 0, Math.PI * 2)
          g.stroke()
        }
        g.fillStyle = ink.surface
        g.beginPath()
        g.arc(p.x, p.y, 6.5, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = ink.accent
        g.lineWidth = 3
        g.stroke()
      }
      if (hover) {
        const p = proj(sim.cells[hover.i])
        g.strokeStyle = ink.focus
        g.lineWidth = 2
        g.beginPath()
        g.arc(p.x, p.y, 7, 0, Math.PI * 2)
        g.stroke()
      }
      // axis labels (text tokens, not series colours)
      g.fillStyle = ink.text
      g.font = '11px Geist Variable, sans-serif'
      const ev = sim.explained_variance ?? [0, 0]
      g.fillText(`PC1 · ${(ev[0] * 100).toFixed(0)}% of variance`, pad, size.h - 14)
      g.save()
      g.translate(16, size.h - pad)
      g.rotate(-Math.PI / 2)
      g.fillText(`PC2 · ${(ev[1] * 100).toFixed(0)}%`, 0, 0)
      g.restore()
      if (k < 1) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [sim, size, selected, hover, colorKey, color, proj, theme])

  const pick = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    let best = -1
    let bd = 10
    sim.cells.forEach((c, i) => {
      const p = proj(c)
      const d = Math.hypot(p.x - mx, p.y - my)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return { i: best, mx, my }
  }

  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={ref}
        style={{ width: size.w, height: size.h, display: 'block', cursor: hover ? 'pointer' : 'crosshair' }}
        onPointerMove={(e) => {
          const { i, mx, my } = pick(e)
          setHover(i >= 0 ? { i, x: mx, y: my } : null)
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const { i } = pick(e)
          onSelect(i >= 0 ? i : null)
        }}
      />
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: '70%' }}>
        {colorKey === 'nti' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            cell NTI <span className="mono muted">0</span>
            <i style={{ width: 90, height: 6, borderRadius: 6, background: 'linear-gradient(90deg,#2b8fe0,var(--div-mid),#d6528f)' }} />
            <span className="mono muted">1</span>
          </span>
        )}
        {groups.slice(0, SLOTS.length).map((g, i) => (
          <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
            <i style={{ width: 9, height: 9, borderRadius: 9, background: groups.length > SLOTS.length && i === SLOTS.length - 1 ? '#6b6e85' : SLOTS[i] }} />
            {groups.length > SLOTS.length && i === SLOTS.length - 1 ? `Other (${groups.length - SLOTS.length + 1})` : g}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
          <i style={{ width: 9, height: 9, borderRadius: 9, boxShadow: '0 0 0 1.5px #ff5555' }} /> QC outlier
        </span>
      </div>
      <AnimatePresence>
        {hover && (
          <motion.div
            className={s.resultPill}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', left: Math.min(hover.x + 14, size.w - 260), top: Math.min(hover.y + 14, size.h - 120), translate: 'none', padding: 8, alignItems: 'flex-start', pointerEvents: 'none' }}
          >
            <Crop cell={sim.cells[hover.i]} size={72} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
              <b className="mono">
                {sim.cells[hover.i].image_id} · #{sim.cells[hover.i].cell_id}
              </b>
              <span className="muted">
                {sim.cells[hover.i].batch} · {sim.cells[hover.i].condition}{sim.cells[hover.i].group ? ` · ${sim.cells[hover.i].group}` : ''}
              </span>
              <span className="mono">NTI {sim.cells[hover.i].nti.toFixed(2)}</span>
              <span className="muted">click for neighbours</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** U4 cell similarity: canonical HCS feature-vector profiling, descriptive only. */
export function Similarity() {
  const [sim, setSim] = useState<Sim | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [colorKey, setColorKey] = useState<ColorKey>('nti')
  const [selected, setSelected] = useState<number | null>(null)
  const images = useApp((st) => st.images)
  const nDone = Object.values(images).filter((m) => m.has_result).length

  const load = useCallback(() => {
    setErr(null)
    api
      .similarity(colorKey === 'nti' ? undefined : colorKey)
      .then((d) => {
        setSim(d)
        setSelected(null)
      })
      .catch((e) => setErr(String(e.message)))
  }, [colorKey])
  useEffect(() => load(), [load, nDone])

  const sel = sim && selected != null ? sim.cells[selected] : null
  const openCell = (c: SimCell) => {
    const app = useApp.getState()
    app.setScreen('analyze')
    app.select(c.image_id)
    setTimeout(() => useApp.setState({ selectedCell: c.cell_id }), 50)
  }

  return (
    <div className={s.stage}>
      <div className={s.viewerArea} style={{ display: 'flex', flexDirection: 'column' }}>
        <div className={s.compareBar}>
          <span style={{ fontWeight: 600 }}>Cell atlas</span>
          <Badge tip="Standardised morphometric feature vectors (robust z) projected with PCA — no learned embedding (DeepProfiler weights are 5-channel Cell Painting only)">
            <Info size={13} /> PCA · {sim ? sim.features.length : '—'} features · {sim?.cells.length ?? '…'} cells
          </Badge>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 13 }}>
            colour by
          </span>
          <Segmented
            value={colorKey}
            onChange={setColorKey}
            options={[
              { value: 'nti', label: 'Cell NTI' },
              { value: 'condition', label: 'Condition' },
              { value: 'group', label: 'Group' },
              { value: 'modality', label: 'Modality' },
              { value: 'batch', label: 'Batch' },
            ]}
          />
          <Button size="sm" variant="ghost" onClick={load} tip="Recompute">
            <RefreshCw size={14} />
          </Button>
        </div>
        <div style={{ position: 'relative', flex: 1, background: 'radial-gradient(ellipse at 50% 50%, rgba(189,147,249,0.04), transparent 70%), var(--bg-canvas)' }}>
          {sim && sim.cells.length > 0 ? (
            <Atlas sim={sim} colorKey={colorKey} selected={selected} onSelect={setSelected} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
              {err ? `Could not compute the atlas: ${err}` : sim ? 'Not enough analysed cells yet — the cohort is still processing.' : 'Computing feature atlas on the server…'}
            </div>
          )}
        </div>
      </div>
      <aside className={sh.inspector} style={{ overflow: 'auto' }}>
        <Section title="k-NN inspector">
          {sel && sim ? (
            <motion.div key={selected} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <Crop cell={sel} size={92} ring="#bd93f9" />
                <div style={{ fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <b className="mono">
                    {sel.image_id} · #{sel.cell_id}
                  </b>
                  <span className="muted">{sel.condition}</span>
                  <span className="mono">NTI {sel.nti.toFixed(2)}</span>
                  {sel.outlier && (
                    <span style={{ color: 'var(--outlier)', fontSize: 13 }}>
                      <TriangleAlert size={13} style={{ verticalAlign: -1 }} /> QC outlier (d = {sel.robust_dist.toFixed(1)})
                    </span>
                  )}
                  <Button size="sm" onClick={() => openCell(sel)} style={{ marginTop: 4 }}>
                    <Microscope size={14} /> Open in Analyze
                  </Button>
                </div>
              </div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                5 nearest cells · feature-space distance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {sel.nn.map(([j, d]) => (
                  <button key={j} onClick={() => setSelected(j)} style={{ textAlign: 'left' }} title={`${sim.cells[j].image_id} #${sim.cells[j].cell_id}`}>
                    <Crop cell={sim.cells[j]} size={86} />
                    <div className="mono" style={{ fontSize: 12, marginTop: 3, color: 'var(--text-2)' }}>
                      d {d.toFixed(2)}
                    </div>
                    <div className="mono muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sim.cells[j].image_id}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              Click a point to see that cell and its five nearest neighbours in morphometric feature space.
            </div>
          )}
        </Section>
        <Section title={`Group distances · by ${sim?.group_key ?? 'condition'}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, padding: 10, borderRadius: 8, background: 'rgba(245,185,58,0.08)', boxShadow: 'inset 0 0 0 1px rgba(245,185,58,0.3)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            <TriangleAlert size={16} color="var(--warn)" />
            <span>
              <b>Descriptive — not a prediction.</b> Acquisition batch can dominate these distances (batch drift); without ≥ 3 technical replicates no p-value is claimed.
              {sim?.group_key === 'batch' && ' Assign conditions in Batch to compare treatments instead of acquisition days.'}
            </span>
          </div>
          {sim && sim.groups.length === 0 && <div className="muted" style={{ fontSize: 13.5 }}>Needs at least two groups with ≥ 3 cells.</div>}
          {sim?.groups.slice(0, 8).map((g) => (
            <div key={`${g.a}-${g.b}`} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                <span>
                  {g.a} <span className="muted">↔</span> {g.b}
                </span>
                <span className="mono">{g.distance.toFixed(2)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--bg-active)', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (g.distance / Math.max(...sim.groups.map((x) => x.distance), 0.01)) * 100)}%` }} transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }} style={{ height: '100%', background: '#8f7ef0', borderRadius: 6 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 10px', marginTop: 6 }}>
                {Object.entries(g.per_feature).map(([f, v]) => (
                  <span key={f} className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }} title="standardised mean difference (A − B)">
                    {FEATURE_LABEL[f] ?? f} <span style={{ color: Math.abs(v) > 0.5 ? 'var(--text-1)' : undefined }}>{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(1)}</span>
                  </span>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                n = {g.n_a} vs {g.n_b} cells
              </div>
            </div>
          ))}
        </Section>
        <Section title="Outliers (QC)">
          {sim ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sim.cells
                .map((c, i) => ({ c, i }))
                .filter(({ c }) => c.outlier)
                .sort((p, q) => q.c.robust_dist - p.c.robust_dist)
                .slice(0, 12)
                .map(({ c, i }) => (
                  <button key={i} onClick={() => setSelected(i)} title={`${c.image_id} #${c.cell_id} · robust distance ${c.robust_dist.toFixed(1)}`}>
                    <Crop cell={c} size={62} ring="#ff5555" />
                  </button>
                ))}
            </div>
          ) : null}
          <p className="muted" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
            Flag = robust median + MAD distance &gt; 3.5 or a per-image area/circularity outlier. It asks for a look; it is not a toxicity call.
          </p>
        </Section>
      </aside>
    </div>
  )
}
