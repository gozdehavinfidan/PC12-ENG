import { Brush, Check, Eraser, Flag, Hand, Merge, Redo2, Save, Trash2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, urls } from '../api/client'
import type { ReviewItem, ReviewStatus } from '../api/types'
import { Badge, Button, IconButton, Kbd, Section, Segmented, Slider, Switch } from '../components/ui'
import { Viewer } from '../engine/viewer'
import { decodeImage } from '../engine/worker-client'
import { useApp } from '../state/app'
import { viewports, type ViewportStore } from '../state/viewport'
import sh from '../shell/shell.module.css'
import s from './screens.module.css'

type Tool = 'pan' | 'brush' | 'erase' | 'delete' | 'merge'
type Cls = 1 | 2 // 1 soma, 2 neurite
const ISSUES = ['missed cell', 'false positive', 'wrong boundary', 'merged cells', 'broken neurite', 'other']
const STATUS_COLOR: Record<ReviewStatus, string> = { pending: 'var(--text-3)', approved: 'var(--ok)', corrected: 'var(--accent)', issue: 'var(--warn)' }

/**
 * Annotation = a class map (0 bg / 1 soma / 2 neurite) edited on a CPU canvas.
 * The prediction stays immutable (its outline is drawn in yellow, model_version
 * attached); only the annotation changes — Label Studio's two-schema split.
 */
class Annotation {
  w: number
  h: number
  map: Uint8Array
  pred: Uint8Array
  canvas: HTMLCanvasElement
  outline: HTMLCanvasElement
  img: ImageData
  undo: Uint8Array[] = []
  redo: Uint8Array[] = []
  edits = 0

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.map = new Uint8Array(w * h)
    this.pred = new Uint8Array(w * h)
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.outline = document.createElement('canvas')
    this.outline.width = w
    this.outline.height = h
    this.img = new ImageData(w, h)
  }

  fromRGBA(data: Uint8ClampedArray, target: Uint8Array) {
    for (let i = 0, p = 0; i < target.length; i++, p += 4) target[i] = data[p] > 127 ? 1 : data[p + 1] > 127 ? 2 : 0
  }

  drawOutline() {
    const g = this.outline.getContext('2d')!
    const im = g.createImageData(this.w, this.h)
    const { w, h, pred } = this
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        const v = pred[i]
        if (!v) continue
        if (pred[i - 1] !== v || pred[i + 1] !== v || pred[i - w] !== v || pred[i + w] !== v) {
          const p = i * 4
          im.data[p] = 241
          im.data[p + 1] = 250
          im.data[p + 2] = 140
          im.data[p + 3] = 235
        }
      }
    g.putImageData(im, 0, 0)
  }

  paintRect(x0: number, y0: number, x1: number, y1: number) {
    x0 = Math.max(0, Math.floor(x0))
    y0 = Math.max(0, Math.floor(y0))
    x1 = Math.min(this.w, Math.ceil(x1))
    y1 = Math.min(this.h, Math.ceil(y1))
    if (x1 <= x0 || y1 <= y0) return
    const d = this.img.data
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * this.w + x
        const p = i * 4
        const v = this.map[i]
        if (v === 1) {
          d[p] = 80
          d[p + 1] = 250
          d[p + 2] = 123
          d[p + 3] = 150
        } else if (v === 2) {
          d[p] = 150
          d[p + 1] = 255
          d[p + 2] = 190
          d[p + 3] = 120
        } else d[p + 3] = 0
      }
    this.canvas.getContext('2d')!.putImageData(this.img, 0, 0, x0, y0, x1 - x0, y1 - y0)
  }

  snapshot() {
    this.undo.push(this.map.slice())
    if (this.undo.length > 25) this.undo.shift()
    this.redo = []
  }

  restore(from: Uint8Array[], to: Uint8Array[]) {
    const m = from.pop()
    if (!m) return false
    to.push(this.map)
    this.map = m
    this.paintRect(0, 0, this.w, this.h)
    return true
  }

  disc(cx: number, cy: number, r: number, v: number) {
    const r2 = r * r
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.map[y * this.w + x] = v
      }
    this.paintRect(cx - r - 1, cy - r - 1, cx + r + 2, cy + r + 2)
  }

  line(x0: number, y0: number, x1: number, y1: number, r: number, v: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r * 0.5)))
    for (let k = 0; k <= n; k++) this.disc(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, v)
  }

  /** flood-fill the connected object under (x, y) -> returns its pixel indices */
  component(x: number, y: number) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return []
    const v = this.map[yi * this.w + xi]
    if (!v) return []
    const seen = new Uint8Array(this.w * this.h)
    const out: number[] = []
    const stack = [yi * this.w + xi]
    seen[stack[0]] = 1
    while (stack.length) {
      const i = stack.pop()!
      out.push(i)
      const x0 = i % this.w
      for (const j of [i - 1, i + 1, i - this.w, i + this.w]) {
        if (j < 0 || j >= this.map.length || seen[j] || this.map[j] !== v) continue
        if ((j === i - 1 && x0 === 0) || (j === i + 1 && x0 === this.w - 1)) continue
        seen[j] = 1
        stack.push(j)
      }
      if (out.length > 400000) break
    }
    return out
  }

  async toPNG() {
    const oc = new OffscreenCanvas(this.w, this.h)
    const g = oc.getContext('2d')!
    const im = g.createImageData(this.w, this.h)
    for (let i = 0, p = 0; i < this.map.length; i++, p += 4) {
      im.data[p] = this.map[i] === 1 ? 255 : 0
      im.data[p + 1] = this.map[i] === 2 ? 255 : 0
      im.data[p + 3] = 255
    }
    g.putImageData(im, 0, 0)
    return oc.convertToBlob({ type: 'image/png' })
  }
}

function AnnotationLayer({ ann, store, showPred, showAnn }: { ann: Annotation; store: ViewportStore; showPred: boolean; showAnn: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.innerHTML = ''
    for (const c of [ann.canvas, ann.outline]) {
      c.style.position = 'absolute'
      c.style.left = '0'
      c.style.top = '0'
      c.style.transformOrigin = '0 0'
      c.style.imageRendering = 'pixelated'
      el.appendChild(c)
    }
    const place = () => {
      const v = store.getState()
      const tr = `matrix(${v.zoom},0,0,${v.zoom},${v.vw / 2 - v.cx * v.zoom},${v.vh / 2 - v.cy * v.zoom})`
      ann.canvas.style.transform = tr
      ann.outline.style.transform = tr
    }
    place()
    return store.subscribe(place)
  }, [ann, store])
  useEffect(() => {
    ann.canvas.style.display = showAnn ? '' : 'none'
    ann.outline.style.display = showPred ? '' : 'none'
  }, [ann, showPred, showAnn])
  return <div ref={box} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
}

export function Review() {
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [ann, setAnn] = useState<Annotation | null>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [cls, setCls] = useState<Cls>(1)
  const [size, setSize] = useState(4)
  const [issues, setIssues] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [edits, setEdits] = useState(0)
  const [showPred, setShowPred] = useState(true)
  const [showAnn, setShowAnn] = useState(true)
  const [saving, setSaving] = useState(false)
  const [, force] = useState(0)
  const mergeFirst = useRef<{ x: number; y: number } | null>(null)
  const images = useApp((st) => st.images)
  const store = viewports.review

  const refresh = useCallback(() => api.reviewQueue().then(setQueue).catch(() => undefined), [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    if (!current && queue.length) setCurrent(queue[0].id)
  }, [queue, current])
  useEffect(() => {
    if (current) useApp.getState().select(current)
  }, [current])

  // load prediction (+ saved annotation, if any) into the editable class map
  useEffect(() => {
    if (!current) return
    let alive = true
    setAnn(null)
    setIssues([])
    setNote('')
    setEdits(0)
    void useApp.getState().loadResult(current)
    ;(async () => {
      const pred = await decodeImage(urls.layer(current, 'masks', String(Date.now())), true)
      const lab = await api.label(current).catch(() => ({ has_annotation: false, issues: [], note: '' }) as { has_annotation: boolean; issues?: string[]; note?: string })
      if (!alive) return
      const a = new Annotation(pred.w, pred.h)
      a.fromRGBA(pred.data!, a.pred)
      if (lab.has_annotation) {
        const saved = await decodeImage(urls.annotation(current), true)
        a.fromRGBA(saved.data!, a.map)
        saved.bitmap.close()
      } else a.map.set(a.pred)
      pred.bitmap.close()
      a.drawOutline()
      a.paintRect(0, 0, a.w, a.h)
      setIssues(lab.issues ?? [])
      setNote(lab.note ?? '')
      if (alive) setAnn(a)
    })().catch(() => undefined)
    return () => {
      alive = false
    }
  }, [current])

  const bump = () => {
    if (!ann) return
    ann.edits++
    setEdits(ann.edits)
  }

  const overlayPointer = useCallback(
    (e: React.PointerEvent, img: { x: number; y: number }) => {
      if (!ann || tool === 'pan') return false
      const t: Tool = e.ctrlKey ? 'delete' : e.altKey ? 'merge' : tool
      if (t === 'delete') {
        const comp = ann.component(img.x, img.y)
        if (comp.length) {
          ann.snapshot()
          for (const i of comp) ann.map[i] = 0
          ann.paintRect(0, 0, ann.w, ann.h)
          bump()
        }
        return true
      }
      if (t === 'merge') {
        if (!mergeFirst.current) {
          if (ann.component(img.x, img.y).length) mergeFirst.current = img
          force((k) => k + 1)
        } else {
          const a = mergeFirst.current
          ann.snapshot()
          const v = ann.map[Math.floor(a.y) * ann.w + Math.floor(a.x)] || cls
          ann.line(a.x, a.y, img.x, img.y, Math.max(2, size * 0.6), v)
          mergeFirst.current = null
          force((k) => k + 1)
          bump()
        }
        return true
      }
      // brush / erase: capture the stroke
      ann.snapshot()
      const v = t === 'erase' ? 0 : cls
      let last = img
      ann.disc(img.x, img.y, size, v)
      const target = e.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const move = (ev: PointerEvent) => {
        const st = store.getState()
        const p = { x: st.cx + (ev.clientX - rect.left - rect.width / 2) / st.zoom, y: st.cy + (ev.clientY - rect.top - rect.height / 2) / st.zoom }
        ann.line(last.x, last.y, p.x, p.y, size, v)
        last = p
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        bump()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ann, tool, cls, size, store],
  )

  const idx = queue.findIndex((q) => q.id === current)
  const go = (d: number) => {
    if (!queue.length) return
    setCurrent(queue[(idx + d + queue.length) % queue.length].id)
  }

  const save = async (status: ReviewStatus) => {
    if (!current || !ann) return
    setSaving(true)
    try {
      const png = edits > 0 || status === 'corrected' ? await ann.toPNG() : undefined
      const st = status === 'approved' && edits > 0 ? 'corrected' : status
      await api.saveLabel(current, st, status === 'issue' ? issues : [], note, png)
      useApp.getState().toast({ tone: st === 'issue' ? 'warn' : 'ok', title: `${images[current]?.name ?? current}: ${st}`, body: png ? 'annotation saved as versioned _seg file' : 'prediction accepted as-is' })
      await refresh()
      go(1)
    } catch (e) {
      useApp.getState().toast({ tone: 'bad', title: 'Save failed', body: String((e as Error).message) })
    } finally {
      setSaving(false)
    }
  }

  // workstation shortcuts (the global handler steps aside on this screen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (!ann) return
        if (e.shiftKey ? ann.restore(ann.redo, ann.undo) : ann.restore(ann.undo, ann.redo)) bump()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'b') setTool('brush')
      else if (k === 'e') setTool('erase')
      else if (k === 'h') setTool('pan')
      else if (k === '1') setCls(1)
      else if (k === '2') setCls(2)
      else if (k === '[') setSize((v) => Math.max(1, v - 1))
      else if (k === ']') setSize((v) => Math.min(30, v + 1))
      else if (k === 'j') go(1)
      else if (k === 'k') go(-1)
      else if (k === 'a') void save('approved')
      else if (k === 'escape') mergeFirst.current = null
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, corrected: 0, issue: 0 }
    for (const q of queue) c[q.status]++
    return c
  }, [queue])
  const cur = queue.find((q) => q.id === current)

  return (
    <div className={s.stage}>
      <aside className={sh.inspector} style={{ borderLeft: 0, borderRight: '1px solid var(--line-1)', width: 270 }}>
        <Section title="Review queue" flush>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {(['pending', 'approved', 'corrected', 'issue'] as const).map((k) => (
              <Badge key={k} color={k === 'pending' ? undefined : STATUS_COLOR[k].replace('var(--ok)', '#3ecf6e').replace('var(--accent)', '#bd93f9').replace('var(--warn)', '#f5b93a')}>
                {counts[k]} {k}
              </Badge>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Sorted by mean uncertainty — most doubtful first (VessQC pattern)
          </div>
        </Section>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {queue.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrent(q.id)}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '22px 56px 1fr',
                gap: 8,
                alignItems: 'center',
                padding: '7px 12px',
                textAlign: 'left',
                background: q.id === current ? 'var(--accent-soft)' : undefined,
                borderLeft: `2px solid ${q.id === current ? 'var(--accent)' : 'transparent'}`,
              }}
            >
              <span className="mono muted" style={{ fontSize: 12 }}>
                {i + 1}
              </span>
              <img src={urls.thumb(q.id)} alt="" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 4 }} loading="lazy" />
              <span style={{ minWidth: 0 }}>
                <span className="mono" title={q.name} style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.name}
                </span>
                <span style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: STATUS_COLOR[q.status] }}>● {q.status}</span>
                  <span className="mono muted">u {q.mean_uncertainty.toFixed(3)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className={s.viewerArea}>
        {current ? (
          <Viewer
            key={current}
            imageId={current}
            store={store}
            allowStack={false}
            forceLayers={['raw', 'uncertainty']}
            showLabels={false}
            roiTools={false}
            panTool={false}
            overlayPointer={overlayPointer}
            tools={
              <>
                <div style={{ height: 1, margin: '3px 4px', background: 'var(--line-2)' }} />
                <IconButton tip="Brush  ·  B" side="right" active={tool === 'brush'} onClick={() => setTool('brush')}>
                  <Brush size={18} />
                </IconButton>
                <IconButton tip="Erase  ·  E" side="right" active={tool === 'erase'} onClick={() => setTool('erase')}>
                  <Eraser size={18} />
                </IconButton>
                <IconButton tip="Delete object  ·  Ctrl+click" side="right" active={tool === 'delete'} onClick={() => setTool('delete')}>
                  <Trash2 size={18} />
                </IconButton>
                <IconButton tip="Merge two objects  ·  Alt+click ×2" side="right" active={tool === 'merge'} onClick={() => setTool('merge')}>
                  <Merge size={18} />
                </IconButton>
                <IconButton tip="Pan (edit off)  ·  H" side="right" active={tool === 'pan'} onClick={() => setTool('pan')}>
                  <Hand size={18} />
                </IconButton>
              </>
            }
          >
            {ann && <AnnotationLayer ann={ann} store={store} showPred={showPred} showAnn={showAnn} />}
            <AnimatePresence>
              {mergeFirst.current && (
                <motion.div className={s.resultPill} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Merge: click the second object · <Kbd>Esc</Kbd> cancel
                </motion.div>
              )}
            </AnimatePresence>
          </Viewer>
        ) : (
          <div className={s.empty} style={{ height: '100%' }}>
            <div className="muted">No analysed images to review yet.</div>
          </div>
        )}
      </div>

      <aside className={sh.inspector} style={{ overflow: 'auto' }}>
        <Section title="Decision">
          {cur && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 13.5 }}>
                {cur.name}
              </span>
              <Badge tip="The prediction is immutable and carries its model version">{cur.model_version}</Badge>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1 }} disabled={!ann || saving} onClick={() => void save('approved')}>
              <Check size={16} /> {edits > 0 ? 'Save correction' : 'Accept'} · A
            </Button>
            <Button disabled={!ann || saving || issues.length === 0} onClick={() => void save('issue')} tip={issues.length ? 'Flag with the selected issues' : 'Pick an issue type first'}>
              <Flag size={16} /> Issue
            </Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {ISSUES.map((i) => (
              <button
                key={i}
                onClick={() => setIssues((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}
                className="mono"
                style={{
                  fontSize: 12.5,
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 999,
                  boxShadow: `inset 0 0 0 1px ${issues.includes(i) ? 'rgba(245,185,58,0.6)' : 'var(--line-2)'}`,
                  background: issues.includes(i) ? 'rgba(245,185,58,0.1)' : undefined,
                  color: issues.includes(i) ? 'var(--warn)' : 'var(--text-2)',
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the dataset log (optional)"
            style={{ width: '100%', marginTop: 10, minHeight: 56, resize: 'vertical', background: 'var(--bg-canvas)', border: 0, borderRadius: 8, boxShadow: 'inset 0 0 0 1px var(--line-2)', padding: 8, fontSize: 13.5, outline: 'none' }}
          />
        </Section>
        <Section title="Editing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>Paint class</span>
              <Segmented<'1' | '2'>
                value={String(cls) as '1' | '2'}
                onChange={(v) => setCls(Number(v) as Cls)}
                options={[
                  { value: '1', label: 'Soma · 1' },
                  { value: '2', label: 'Neurite · 2' },
                ]}
              />
            </div>
            <Slider label="Brush radius" value={size} min={1} max={30} step={1} onChange={setSize} format={(v) => `${v} px`} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" disabled={!ann?.undo.length} onClick={() => ann?.restore(ann.undo, ann.redo) && bump()}>
                <Undo2 size={14} /> Undo
              </Button>
              <Button size="sm" disabled={!ann?.redo.length} onClick={() => ann?.restore(ann.redo, ann.undo) && bump()}>
                <Redo2 size={14} /> Redo
              </Button>
              <span className="mono muted" style={{ fontSize: 13, marginLeft: 'auto', alignSelf: 'center' }}>
                {edits} edits
              </span>
            </div>
          </div>
        </Section>
        <Section title="Layers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 14, height: 4, background: 'var(--prediction)', borderRadius: 2, flex: 'none' }} />
              <span style={{ flex: 1 }}>
                Prediction outline <span className="muted">· locked</span>
              </span>
              <Switch on={showPred} onChange={setShowPred} label="Prediction outline" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 14, height: 10, background: 'rgba(80,250,123,0.6)', borderRadius: 3, flex: 'none' }} />
              <span style={{ flex: 1 }}>
                Annotation <span className="muted">· editable</span>
              </span>
              <Switch on={showAnn} onChange={setShowAnn} label="Annotation" />
            </div>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Blue flicker = model uncertainty. Start where it is densest.
            </span>
          </div>
        </Section>
        <Section title="Shortcuts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(
              [
                [['B'], 'Brush'],
                [['E'], 'Erase'],
                [['H'], 'Pan (editing off)'],
                [['1', '2'], 'Soma / neurite class'],
                [['[', ']'], 'Brush size'],
                [['Ctrl', 'click'], 'Delete object'],
                [['Alt', 'click'], 'Merge two objects'],
                [['Ctrl', 'Z'], 'Undo'],
                [['A'], 'Accept / save correction'],
                [['J', 'K'], 'Next / previous image'],
              ] as [string[], string][]
            ).map(([keys, what]) => (
              <div key={what} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed var(--line-1)', fontSize: 13.5 }}>
                <span style={{ color: 'var(--text-2)' }}>{what}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <Button size="sm" style={{ marginTop: 14 }} disabled={!ann || saving} onClick={() => void save('pending')}>
            <Save size={14} /> Save draft
          </Button>
        </Section>
      </aside>
    </div>
  )
}
