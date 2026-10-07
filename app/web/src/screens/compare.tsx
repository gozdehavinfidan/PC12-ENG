import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import type { Result } from '../api/types'
import { Cdf, Histogram, ntiColor, Polar } from '../charts/charts'
import { Segmented } from '../components/ui'
import { Viewer } from '../engine/viewer'
import { areaUnit, areaVal, lenUnit, lenVal, signed } from '../lib/format'
import { useApp } from '../state/app'
import { viewports } from '../state/viewport'
import s from './screens.module.css'

const A_COLOR = '#2b8fe0'
const B_COLOR = '#d9772a'

function SlotHead({ slot, id }: { slot: 'A' | 'B'; id: string }) {
  const meta = useApp((st) => st.images[id])
  const r = useApp((st) => st.results[id])
  return (
    <div className={s.slotHead}>
      <span className={s.slotBadge} style={{ background: slot === 'A' ? A_COLOR : B_COLOR }}>
        {slot}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span className={s.slotName}>{meta?.name ?? id}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {slot === 'A' ? 'reference' : 'test'} · {meta?.condition ?? 'unassigned'}
        </span>
      </div>
      {/* text keeps the text token; the NTI hue rides on the dot (identity never by text colour) */}
      {r?.nti.score != null && <span style={{ width: 8, height: 8, borderRadius: 8, background: ntiColor(r.nti.score), flex: 'none' }} />}
      <span className={s.slotNti}>
        {r?.nti.score != null ? r.nti.score.toFixed(2) : '—'}
      </span>
    </div>
  )
}

function DropSlot({ onDrop, children }: { onDrop: (id: string) => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div
      className={s.slot}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/camex-image')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const id = e.dataTransfer.getData('text/camex-image')
        if (id) onDrop(id)
      }}
    >
      {children}
      {over && <div className={s.slotDrop}>Drop to place here</div>}
    </div>
  )
}

function meanNti(r?: Result) {
  if (!r || !r.cells.length) return null
  return r.cells.reduce((a, c) => a + c.nti, 0) / r.cells.length
}

/** U2 Before/After Toxicity: one shared viewport store = synchronised pan/zoom. */
export function Compare() {
  const { a, b, mode, split } = useApp((st) => st.compare)
  const setCompare = useApp((st) => st.setCompare)
  const ra = useApp((st) => (a ? st.results[a] : undefined))
  const rb = useApp((st) => (b ? st.results[b] : undefined))
  // collapsed by default: the images keep >= 70% of the screen (CLAUDE.md s5.1)
  const [drawer, setDrawer] = useState(false)
  const views = useRef<HTMLDivElement>(null)
  const refNti = meanNti(ra)

  const dragSplit = (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const r = views.current!.getBoundingClientRect()
      setCompare({ split: Math.max(0.02, Math.min(0.98, (ev.clientX - r.left) / r.width)) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!a || !b) {
    return (
      <div className={s.empty} style={{ flex: 1 }}>
        <div className={s.drop}>
          <h1 className={s.dropTitle}>Pick two images</h1>
          <p className={s.dropSub}>Click a thumbnail to place it in slot B (test); Shift+click places it in slot A (reference). The cohort is still being analysed in the background.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={s.compare}>
      <div className={s.compareBar}>
        <Segmented
          value={mode}
          onChange={(m) => setCompare({ mode: m })}
          options={[
            { value: 'split', label: 'Side by side', tip: 'Two synced views' },
            { value: 'swipe', label: 'Swipe', tip: 'One view, draggable divider' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>
          Cell badges on B = cell NTI − mean cell NTI of A
        </span>
      </div>

      <div className={s.compareViews} ref={views}>
        {mode === 'split' ? (
          <>
            <DropSlot onDrop={(id) => setCompare({ a: id })}>
              <Viewer key={`a-${a}`} imageId={a} store={viewports.compare} allowStack={false} showMinimap={false} />
              <SlotHead slot="A" id={a} />
            </DropSlot>
            <DropSlot onDrop={(id) => setCompare({ b: id })}>
              <Viewer key={`b-${b}`} imageId={b} store={viewports.compare} allowStack={false} labelMode="delta" deltaRef={refNti} />
              <SlotHead slot="B" id={b} />
            </DropSlot>
          </>
        ) : (
          <div className={s.slot}>
            <div className={s.swipeLayer}>
              <Viewer key={`a-${a}`} imageId={a} store={viewports.compare} allowStack={false} chrome={false} />
            </div>
            <div
              className={s.swipeLayer}
              style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
            >
              <Viewer key={`b-${b}`} imageId={b} store={viewports.compare} allowStack={false} labelMode="delta" deltaRef={refNti} />
            </div>
            <div className={s.divider} style={{ left: `${split * 100}%` }} onPointerDown={dragSplit}>
              <div className={s.dividerKnob}>
                <GripVertical size={18} />
              </div>
            </div>
            <div style={{ position: 'absolute', top: 12, left: 60, zIndex: 7 }}>
              <SlotHead slot="A" id={a} />
            </div>
            <SlotHead slot="B" id={b} />
          </div>
        )}
      </div>

      <div className={s.drawer}>
        <div className={s.drawerHead} onClick={() => setDrawer((d) => !d)}>
          <span className="eyebrow">Distribution comparison</span>
          {ra && rb && ra.nti.score != null && rb.nti.score != null && (
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              ΔNTI (B − A) <b style={{ color: rb.nti.score - ra.nti.score > 0 ? 'var(--div-pos)' : 'var(--div-neg)' }}>{signed(rb.nti.score - ra.nti.score)}</b>
            </span>
          )}
          <div style={{ flex: 1 }} />
          {drawer ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </div>
        <AnimatePresence initial={false}>
          {drawer && ra && rb && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} style={{ overflow: 'hidden' }}>
              <CompareCharts ra={ra} rb={rb} a={a} b={b} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function CompareCharts({ ra, rb, a, b }: { ra: Result; rb: Result; a: string; b: string }) {
  const umA = useApp((st) => st.umPerPx(a))
  const umB = useApp((st) => st.umPerPx(b))
  // mixed calibrations cannot share a µm axis -> fall back to px for both
  const um = umA && umB && Math.abs(umA - umB) / umA < 0.01 ? umA : null
  const rows = useMemo(() => {
    const perCell = (r: Result) => (r.summary.cell_count ? r.summary.neurite_length_px.total / r.summary.cell_count : 0)
    return [
      { k: 'NTI', va: ra.nti.score ?? NaN, vb: rb.nti.score ?? NaN, d: 2 },
      { k: `Neurite / cell (${lenUnit(um)})`, va: lenVal(perCell(ra), um), vb: lenVal(perCell(rb), um), d: 0 },
      { k: 'Branches / cell', va: ra.summary.branches_per_cell.mean, vb: rb.summary.branches_per_cell.mean, d: 1 },
      { k: 'Angle median (°)', va: ra.summary.angle_deg.median, vb: rb.summary.angle_deg.median, d: 0 },
      { k: `Soma area (${areaUnit(um)})`, va: areaVal(ra.summary.soma_area_px.mean, um), vb: areaVal(rb.summary.soma_area_px.mean, um), d: 0 },
      { k: 'Circularity', va: ra.summary.soma_circularity.mean, vb: rb.summary.soma_circularity.mean, d: 2 },
      { k: 'Cells', va: ra.summary.cell_count, vb: rb.summary.cell_count, d: 0 },
    ]
  }, [ra, rb, um])
  return (
    <div className={s.drawerBody}>
      <div className={s.panelCard}>
        <div className={s.panelTitle}>
          <span>Neurite length — cumulative</span>
          <span className="muted mono" style={{ fontSize: 12 }}>
            {lenUnit(um)}
          </span>
        </div>
        <Cdf
          width={300}
          height={138}
          unit={lenUnit(um)}
          series={[
            { label: 'A', color: A_COLOR, values: ra.neurites.map((n) => lenVal(n.length_px, um)) },
            { label: 'B', color: B_COLOR, values: rb.neurites.map((n) => lenVal(n.length_px, um)) },
          ]}
        />
      </div>
      <div className={s.panelCard}>
        <div className={s.panelTitle}>
          <span>Soma area</span>
          <span className="muted mono" style={{ fontSize: 12 }}>
            {areaUnit(um)}
          </span>
        </div>
        <Histogram
          width={250}
          height={130}
          bins={14}
          unit={areaUnit(um)}
          format={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))}
          series={[
            { label: 'A', color: A_COLOR, values: ra.cells.map((c) => areaVal(c.area_px, um)) },
            { label: 'B', color: B_COLOR, values: rb.cells.map((c) => areaVal(c.area_px, um)) },
          ]}
        />
      </div>
      <div className={s.panelCard}>
        <div className={s.panelTitle}>
          <span>Branch orientation</span>
        </div>
        <Polar
          size={150}
          bins={12}
          series={[
            { label: 'A', color: A_COLOR, values: ra.neurites.map((n) => n.orientation_deg) },
            { label: 'B', color: B_COLOR, values: rb.neurites.map((n) => n.orientation_deg) },
          ]}
        />
      </div>
      <div className={s.panelCard}>
        <div className={s.panelTitle}>
          <span>Parameter deltas</span>
          <span className="muted" style={{ fontSize: 12 }}>
            descriptive · n = 1 image each
          </span>
        </div>
        <table className={s.deltaTable}>
          <thead>
            <tr>
              <th>parameter</th>
              <th style={{ color: A_COLOR }}>A</th>
              <th style={{ color: B_COLOR }}>B</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.vb - r.va
              return (
                <tr key={r.k}>
                  <td>{r.k}</td>
                  <td>{r.va.toFixed(r.d)}</td>
                  <td>{r.vb.toFixed(r.d)}</td>
                  <td style={{ color: Math.abs(d) < 1e-9 ? 'var(--text-3)' : 'var(--text-1)' }}>
                    {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(r.d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
