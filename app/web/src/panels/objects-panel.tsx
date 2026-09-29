import { TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Segmented, Switch } from '../components/ui'
import { area, len } from '../lib/format'
import { useApp } from '../state/app'
import { flyTo, fitZoom, type ViewportStore } from '../state/viewport'
import s from './panels.module.css'

type Kind = 'cells' | 'branches' | 'junctions'
const ROW = 34

/** Object list <-> camera link (CLAUDE.md s5.3): click a row, the camera flies. */
export function ObjectsPanel({ imageId, store }: { imageId: string | null; store: ViewportStore }) {
  const result = useApp((st) => (imageId ? st.results[imageId] : undefined))
  const selected = useApp((st) => st.selectedCell)
  const um = useApp((st) => (imageId ? st.umPerPx(imageId) : null))
  const [kind, setKind] = useState<Kind>('cells')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'id', dir: 1 })
  const [outliersOnly, setOutliersOnly] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [hgt, setHgt] = useState(600)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setHgt(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = useMemo(() => {
    if (!result) return []
    let r: { id: string | number; a: number; b: number; c: number; x: number; y: number; w: number; outlier?: boolean }[] = []
    if (kind === 'cells')
      r = result.cells
        .filter((c) => !outliersOnly || c.outlier)
        .map((c) => ({ id: c.id, a: c.area_px, b: c.circularity, c: c.nti, x: c.centroid[0], y: c.centroid[1], w: Math.max(c.bbox[2] - c.bbox[0], c.bbox[3] - c.bbox[1]), outlier: c.outlier }))
    else if (kind === 'branches')
      r = result.neurites.map((b) => {
        const mid = b.polyline[Math.floor(b.polyline.length / 2)]
        const xs = b.polyline.map((p) => p[0])
        const ys = b.polyline.map((p) => p[1])
        return { id: b.id, a: b.length_px, b: b.tortuosity, c: b.orientation_deg, x: mid[0], y: mid[1], w: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) }
      })
    else r = result.junctions.map((j) => ({ id: j.id, a: j.branch_ids.length, b: j.angles_deg.length ? Math.min(...j.angles_deg) : 0, c: j.angles_deg.length ? Math.max(...j.angles_deg) : 0, x: j.x, y: j.y, w: 40 }))
    const k = sort.key as 'a' | 'b' | 'c' | 'id'
    return r.sort((p, q) => {
      const pv = k === 'id' ? (typeof p.id === 'number' ? p.id : parseInt(String(p.id).slice(1))) : p[k]
      const qv = k === 'id' ? (typeof q.id === 'number' ? q.id : parseInt(String(q.id).slice(1))) : q[k]
      return (pv - qv) * sort.dir
    })
  }, [result, kind, sort, outliersOnly])

  if (!result) return <div className={s.emptyPanel}>Objects appear here once the image is analysed.</div>

  const cols: Record<Kind, [string, string, string]> = {
    cells: ['area', 'circ.', 'NTI'],
    branches: ['length', 'tort.', 'orient.'],
    junctions: ['branches', 'min °', 'max °'],
  }
  const fmtCell = (r: (typeof rows)[number], col: 0 | 1 | 2) => {
    if (kind === 'cells') return col === 0 ? area(r.a, um) : r[col === 1 ? 'b' : 'c'].toFixed(2)
    if (kind === 'branches') return col === 0 ? len(r.a, um) : col === 1 ? r.b.toFixed(2) : `${r.c.toFixed(0)}°`
    return col === 0 ? String(r.a) : `${r[col === 1 ? 'b' : 'c'].toFixed(0)}°`
  }
  const first = Math.max(0, Math.floor(scroll / ROW) - 5)
  const last = Math.min(rows.length, Math.ceil((scroll + hgt) / ROW) + 5)
  const go = (r: (typeof rows)[number]) => {
    if (kind === 'cells') useApp.setState({ selectedCell: r.id as number })
    const v = store.getState()
    const z = Math.min(6, Math.max(fitZoom(v.imgW, v.imgH, v.vw, v.vh) * 2, Math.min(v.vw, v.vh) / (r.w * 5 + 40)))
    flyTo(store, r.x, r.y, z)
  }
  const th = (label: string, key: string) => (
    <button data-on={sort.key === key} onClick={() => setSort((st) => ({ key, dir: st.key === key ? ((-st.dir) as 1 | -1) : 1 }))}>
      {label}
      {sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className={s.objHead}>
        <Segmented<Kind>
          value={kind}
          onChange={(k) => {
            setKind(k)
            setSort({ key: 'id', dir: 1 })
          }}
          options={[
            { value: 'cells', label: `Cells ${result.cells.length}` },
            { value: 'branches', label: `Branches ${result.neurites.length}` },
            { value: 'junctions', label: `Junctions ${result.junctions.length}` },
          ]}
        />
      </div>
      {kind === 'cells' && (
        <div className={s.row} style={{ padding: '0 12px 8px' }}>
          <span>
            <TriangleAlert size={14} style={{ verticalAlign: -2, color: 'var(--outlier)' }} /> QC outliers only
          </span>
          <Switch on={outliersOnly} onChange={setOutliersOnly} label="Outliers only" />
        </div>
      )}
      <div className={s.objTable} style={{ flex: 1, overflow: 'auto', minHeight: 0 }} ref={box} onScroll={(e) => setScroll((e.target as HTMLElement).scrollTop)}>
        <div className={`${s.objTr} ${s.objTh}`}>
          {th('#', 'id')}
          {th(cols[kind][0], 'a')}
          {th(cols[kind][1], 'b')}
          {th(cols[kind][2], 'c')}
          <span />
        </div>
        <div style={{ height: rows.length * ROW, position: 'relative' }}>
          {rows.slice(first, last).map((r, k) => (
            <div
              key={String(r.id)}
              className={s.objTr}
              style={{ position: 'absolute', left: 0, right: 0, top: (first + k) * ROW }}
              data-selected={kind === 'cells' && selected === r.id}
              onClick={() => go(r)}
              onMouseEnter={() => kind === 'cells' && useApp.setState({ hoverCell: r.id as number })}
              onMouseLeave={() => kind === 'cells' && useApp.setState({ hoverCell: null })}
            >
              <span className={s.objTd} style={{ color: 'var(--text-1)' }}>
                {kind === 'cells' ? `#${r.id}` : r.id}
              </span>
              <span className={s.objTd}>{fmtCell(r, 0)}</span>
              <span className={s.objTd}>{fmtCell(r, 1)}</span>
              <span className={s.objTd}>{fmtCell(r, 2)}</span>
              <span>{r.outlier && <TriangleAlert size={14} color="var(--outlier)" />}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
