import { ChevronDown, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { urls } from '../api/client'
import { IconButton, Ring } from '../components/ui'
import { ntiColor } from '../charts/charts'
import { useApp } from '../state/app'
import s from './shell.module.css'

const THUMB_W = 116 + 8

/**
 * Cohort filmstrip (U2). Virtualised: only thumbnails in (or near) view are in
 * the DOM, so 70+ images scroll at 60 fps while a 2048² image is processing
 * (CLAUDE.md s4 acceptance test). Thumbnails come from the server cache.
 */
export function Filmstrip({ mode = 'select' }: { mode?: 'select' | 'compare' }) {
  const order = useApp((st) => st.order)
  const images = useApp((st) => st.images)
  const selected = useApp((st) => st.selected)
  const compare = useApp((st) => st.compare)
  const jobs = useApp((st) => st.jobs)
  const live = useApp((st) => st.live)
  const scroller = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<[number, number]>([0, 24])
  const fileInput = useRef<HTMLInputElement>(null)

  // group by batch (acquisition date) with a vertical separator
  const items = useMemo(() => {
    const out: ({ kind: 'group'; label: string; count: number } | { kind: 'img'; id: string })[] = []
    let last = ''
    const sorted = [...order].sort((a, b) => (images[a]?.batch ?? '').localeCompare(images[b]?.batch ?? '') || a.localeCompare(b, undefined, { numeric: true }))
    for (const id of sorted) {
      const b = images[id]?.batch ?? '—'
      if (b !== last) {
        out.push({ kind: 'group', label: b, count: sorted.filter((x) => (images[x]?.batch ?? '—') === b).length })
        last = b
      }
      out.push({ kind: 'img', id })
    }
    return out
  }, [order, images])

  const running = useMemo(() => {
    const m: Record<string, number> = {}
    for (const j of Object.values(jobs)) if (j.state === 'running' || j.state === 'queued') m[j.image_id] = j.state === 'running' ? j.progress : 0.001
    return m
  }, [jobs])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => {
      const a = Math.max(0, Math.floor(el.scrollLeft / THUMB_W) - 6)
      const b = Math.ceil((el.scrollLeft + el.clientWidth) / THUMB_W) + 6
      setRange((r) => (r[0] === a && r[1] === b ? r : [a, b]))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', wheel)
      ro.disconnect()
    }
  }, [])

  // keep the selected thumbnail in view
  useEffect(() => {
    const el = scroller.current
    const target = mode === 'compare' ? compare.b : selected
    if (!el || !target) return
    const i = items.findIndex((it) => it.kind === 'img' && it.id === target)
    if (i < 0) return
    const x = i * THUMB_W
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - THUMB_W) el.scrollTo({ left: x - el.clientWidth / 2, behavior: 'smooth' })
  }, [selected, compare.b, mode, items])

  const done = order.filter((id) => images[id]?.has_result).length
  const click = (id: string, e: React.MouseEvent) => {
    const app = useApp.getState()
    if (mode === 'compare') {
      if (e.shiftKey || e.altKey) app.setCompare({ a: id })
      else app.setCompare({ b: id })
    } else app.select(id)
  }

  return (
    <div className={s.film}>
      <div className={s.filmHead}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }} title={`${order.length} images in the cohort, ${done} analysed`}>
          <span className={s.filmCount}>{order.length}</span>
          <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            images · {done} ✓
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: -4 }}>
          <IconButton small tip="Add image (CZI, TIFF, PNG, JPG)" side="top" onClick={() => fileInput.current?.click()}>
            <Upload size={16} />
          </IconButton>
          <IconButton small tip="Hide filmstrip  ·  T" side="top" onClick={() => useApp.setState({ filmstripOpen: false })}>
            <ChevronDown size={16} />
          </IconButton>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".czi,.tif,.tiff,.png,.jpg,.jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void useApp.getState().upload(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      <div ref={scroller} className={s.filmScroll}>
        <div style={{ flex: 'none', width: range[0] * THUMB_W }} />
        {items.slice(range[0], range[1]).map((it) => {
          if (it.kind === 'group')
            return (
              <div key={`g-${it.label}`} className={s.filmGroup} title="Acquisition batch (from CZI metadata)">
                <span className="eyebrow" style={{ fontSize: 12 }}>Batch</span>
                <b>{it.label}</b>
                <span>{it.count} images</span>
              </div>
            )
          const m = images[it.id]
          const isA = compare.a === it.id
          const isB = compare.b === it.id
          const sel = mode === 'compare' ? isA || isB : selected === it.id
          const prog = running[it.id] ?? (live[it.id]?.state === 'running' ? live[it.id].tilesDone / Math.max(1, live[it.id].tilesTotal) : undefined)
          return (
            <div
              key={it.id}
              className={s.thumb}
              data-selected={sel}
              role="button"
              tabIndex={0}
              title={`${m?.name ?? it.id}${m?.condition && m.condition !== 'unassigned' ? ` · ${m.condition}` : ''}${mode === 'compare' ? ' — click = B (test), Shift+click = A (reference)' : ''}`}
              onClick={(e) => click(it.id, e)}
              onKeyDown={(e) => e.key === 'Enter' && useApp.getState().select(it.id)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/intellicell-image', it.id)}
            >
              {m?.pending ? <div className={s.pendingThumb}>preparing…</div> : <img src={urls.thumb(it.id)} alt="" loading="lazy" draggable={false} />}
              <div className={s.thumbTag}>
                {isA && mode === 'compare' && (
                  <span className={s.slotTag} style={{ background: 'var(--c1)' }}>
                    A
                  </span>
                )}
                {isB && mode === 'compare' && (
                  <span className={s.slotTag} style={{ background: 'var(--c2)' }}>
                    B
                  </span>
                )}
                {m?.variant && (
                  <span className={s.slotTag} style={{ background: '#44475a', fontWeight: 500 }}>
                    variant
                  </span>
                )}
              </div>
              {prog !== undefined && (
                <span className={s.thumbState}>
                  <Ring value={prog} size={18} />
                </span>
              )}
              <div className={s.thumbOverlay}>
                <span className={s.thumbName}>{(m?.name ?? it.id).replace(/\.(czi|png|tiff?|jpe?g)$/i, '')}</span>
                <span className={s.thumbNti}>{m?.nti != null ? m.nti.toFixed(2) : prog !== undefined ? '···' : '—'}</span>
              </div>
              {m?.nti != null && <span className={s.ntiBar} style={{ background: ntiColor(m.nti), opacity: 0.9, width: `${m.nti * 100}%` }} />}
            </div>
          )
        })}
        <div style={{ flex: 'none', width: Math.max(0, items.length - range[1]) * THUMB_W }} />
      </div>
    </div>
  )
}
