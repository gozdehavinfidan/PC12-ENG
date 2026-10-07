import { BookOpen, Check, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { urls } from '../api/client'
import { visible, same, type Hist, type ParamValue, type SchemaField, type SchemaSection } from '../api/preproc'
import { Badge, Button, Section, Segmented, Slider, Switch } from '../components/ui'
import sh from '../shell/shell.module.css'
import { useApp } from '../state/app'
import { usePreproc } from '../state/preproc'
import p from './preprocess.module.css'

type View = 'split' | 'swipe' | 'result' | 'try_all'
const ROI_SIZES = [512, 768, 1024]
const MAX_REGION = 2048 // server preview limit (pipeline.PREVIEW_MAX)
const b64 = (s: string, type = 'image/png') => `data:${type};base64,${s}`

/* ------------------------------------------------------------ pan / zoom */
interface Cam {
  z: number
  x: number
  y: number
}

function usePanZoom(w: number, h: number, panes: number) {
  const [cam, setCam] = useState<Cam>({ z: 1, x: 0, y: 0 })
  const box = useRef<HTMLDivElement>(null)
  const fit = useCallback(() => {
    const el = box.current
    if (!el || !w || !h) return
    const pw = el.clientWidth / panes
    const z = Math.min(pw / w, el.clientHeight / h) * 0.96
    setCam({ z, x: (pw - w * z) / 2, y: (el.clientHeight - h * z) / 2 })
  }, [w, h, panes])
  useEffect(() => {
    fit()
    const el = box.current
    if (!el) return
    // re-fit when the stage changes size (screen transition, window resize)
    const ro = new ResizeObserver(() => fit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  const onWheel = (e: React.WheelEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setCam((c) => {
      const z = Math.min(40, Math.max(0.05, c.z * Math.exp(-e.deltaY * 0.0015)))
      return { z, x: mx - ((mx - c.x) * z) / c.z, y: my - ((my - c.y) * z) / c.z }
    })
  }
  const drag = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    drag.current = { x: e.clientX, y: e.clientY }
    setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }))
  }
  const onPointerUp = () => (drag.current = null)
  return { cam, box, fit, handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp, onDoubleClick: fit } }
}

/* ------------------------------------------------------------ histogram */
function Histogram({
  hist,
  color,
  onDrag,
  unit,
}: {
  hist: Hist
  color: string
  onDrag?: (v: number) => void
  unit: string
}) {
  const W = 288
  const H = 72
  const max = Math.max(1, ...hist.counts.map((c) => Math.log1p(c)))
  const bw = W / hist.counts.length
  const xOf = (v: number) => ((v - hist.lo) / (hist.hi - hist.lo || 1)) * W
  const vOf = (x: number) => hist.lo + (Math.min(Math.max(x, 0), W) / W) * (hist.hi - hist.lo)
  const set = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onDrag?.(vOf(((e.clientX - r.left) / r.width) * W))
  }
  const tx = xOf(hist.threshold)
  const above = hist.counts.reduce((a, c, i) => a + (hist.lo + (i + 0.5) * (hist.hi - hist.lo) / hist.counts.length > hist.threshold ? c : 0), 0)
  const total = hist.counts.reduce((a, c) => a + c, 0) || 1
  return (
    <>
      <svg
        className={p.hist}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          if (!onDrag) return
          e.currentTarget.setPointerCapture(e.pointerId)
          set(e)
        }}
        onPointerMove={(e) => {
          if (onDrag && e.buttons === 1) set(e)
        }}
        role="img"
        aria-label={`Histogram with threshold at ${hist.threshold.toPrecision(3)}`}
      >
        {hist.counts.map((c, i) => {
          const bh = (Math.log1p(c) / max) * (H - 6)
          const mid = hist.lo + ((i + 0.5) * (hist.hi - hist.lo)) / hist.counts.length
          return (
            <rect key={i} x={i * bw} y={H - bh} width={Math.max(bw - 0.6, 0.6)} height={bh}
              fill={mid > hist.threshold ? color : 'var(--text-4)'} opacity={mid > hist.threshold ? 0.9 : 0.55} />
          )
        })}
        {hist.low != null && (
          <line x1={xOf(hist.low)} x2={xOf(hist.low)} y1={0} y2={H} stroke={color} strokeDasharray="3 3" strokeWidth={1.2} />
        )}
        {tx >= 0 && tx <= W && (
          <line x1={tx} x2={tx} y1={0} y2={H} stroke="var(--text-1)" strokeWidth={1.6}
            strokeDasharray={hist.local ? '4 3' : undefined} />
        )}
      </svg>
      <div className={p.histLegend}>
        <span className="mono">
          {hist.local ? 'local · median ' : 'thr '}
          {hist.threshold.toPrecision(3)}
          {hist.low != null ? ` · low ${hist.low.toPrecision(3)}` : ''}
        </span>
        <span className="mono">
          {((above / total) * 100).toFixed(1)}% {unit} above
        </span>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ fields */
const decimals = (step = 0.01) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))))

function DocLink({ url }: { url?: string | null }) {
  const toast = useApp((s) => s.toast)
  if (!url) return null
  return (
    <button
      className={p.docBtn}
      title={url}
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => toast({ tone: 'info', title: 'scikit-image doc link copied', body: url }),
          () => toast({ tone: 'info', title: 'scikit-image documentation', body: url }),
        )
      }}
    >
      <BookOpen size={12} /> skimage
    </button>
  )
}

function Field({ f, sec, value, onChange }: { f: SchemaField; sec: Record<string, ParamValue>; value: ParamValue; onChange: (v: ParamValue) => void }) {
  if (!visible(f, sec)) return null
  if (f.kind === 'select') {
    return (
      <div className={p.stack}>
        <span className={p.stackLabel}>{f.label}</span>
        <select className={p.selectFull} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {f.options?.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {f.help && <span className={p.fieldHelp}>{f.help}</span>}
      </div>
    )
  }
  if (f.kind === 'bool') {
    return (
      <div className={p.field}>
        <span>{f.label}</span>
        <Switch on={!!value} onChange={onChange} label={f.label} />
        {f.help && <span className={p.fieldHelp}>{f.help}</span>}
      </div>
    )
  }
  const d = decimals(f.step)
  return (
    <div className={p.fieldSlider}>
      <Slider
        label={f.label}
        value={Number(value)}
        min={f.min ?? 0}
        max={f.max ?? 1}
        step={f.step ?? 0.01}
        format={(v) => v.toFixed(d)}
        onChange={(v) => onChange(Number(v.toFixed(d)))}
        onReset={() => onChange(f.default)}
      />
      {f.help && <div className={p.fieldHelp} style={{ marginTop: 0 }}>{f.help}</div>}
    </div>
  )
}

function docFor(s: SchemaSection, sec: Record<string, ParamValue>): string | null {
  for (const f of s.fields) {
    if (f.docs && typeof sec[f.key] === 'string' && f.docs[String(sec[f.key])]) return f.docs[String(sec[f.key])]
  }
  return s.doc
}

/* ------------------------------------------------------------ region picker */
function NumBox({ label, value, min, max, onCommit, suffix }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void; suffix?: string }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const v = Math.round(Number(text))
    if (Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, v)))
    else setText(String(value))
  }
  return (
    <label className={p.numBox}>
      <span>{label}</span>
      <span className={p.numWrap}>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  )
}

function RegionPicker({ imageId }: { imageId: string }) {
  const meta = useApp((s) => s.images[imageId])
  const roi = usePreproc((s) => s.roi[imageId] ?? null)
  const size = usePreproc((s) => s.roiSize)
  const setRoi = usePreproc((s) => s.setRoi)
  const setSize = usePreproc((s) => s.setRoiSize)
  const W = meta?.width ?? 0
  const H = meta?.height ?? 0
  if (!W || !H) return <div className="muted">Image not prepared yet.</div>
  const maxEdge = Math.min(W, H, MAX_REGION)
  const w = Math.min(size, W)
  const h = Math.min(size, H)
  const r = roi ?? [Math.round((W - w) / 2), Math.round((H - h) / 2), w, h]
  const place = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const cx = ((e.clientX - b.left) / b.width) * W
    const cy = ((e.clientY - b.top) / b.height) * H
    const x = Math.round(Math.min(Math.max(cx - r[2] / 2, 0), W - r[2]))
    const y = Math.round(Math.min(Math.max(cy - r[3] / 2, 0), H - r[3]))
    setRoi(imageId, [x, y, r[2], r[3]])
  }
  const preset = ROI_SIZES.includes(size) ? String(size) : 'custom'
  return (
    <>
      <div
        className={p.roiPick}
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          place(e)
        }}
        onPointerMove={(e) => e.buttons === 1 && place(e)}
        title="Click or drag to move the preview region"
      >
        <img src={urls.thumb(imageId)} alt="" decoding="async" />
        <div className={p.roiBox} style={{ left: `${(r[0] / W) * 100}%`, top: `${(r[1] / H) * 100}%`, width: `${(r[2] / W) * 100}%`, height: `${(r[3] / H) * 100}%` }} />
      </div>
      <div className={p.roiMeta}>
        <span>Click the picture to move the square</span>
        <span className="mono">
          {W}×{H}
        </span>
      </div>
      <div className={p.stackLabel} style={{ marginTop: 12 }}>Region size</div>
      <Segmented
        full
        value={preset}
        options={[
          ...ROI_SIZES.map((n) => ({ value: String(n), label: `${n} px`, tip: `${n}×${n} pixels at full resolution` })),
          { value: 'custom', label: 'Custom', tip: 'Type your own size below' },
        ]}
        onChange={(v) => {
          if (v === 'custom') return
          setSize(Number(v))
          setRoi(imageId, null)
        }}
      />
      <div className={p.numRow}>
        <NumBox label="Size" suffix="px" value={Math.min(size, maxEdge)} min={64} max={maxEdge} onCommit={(v) => { setSize(v); setRoi(imageId, null) }} />
        <NumBox label="X" suffix="px" value={r[0]} min={0} max={W - r[2]} onCommit={(v) => setRoi(imageId, [v, r[1], r[2], r[3]])} />
        <NumBox label="Y" suffix="px" value={r[1]} min={0} max={H - r[3]} onCommit={(v) => setRoi(imageId, [r[0], v, r[2], r[3]])} />
      </div>
    </>
  )
}

/* ------------------------------------------------------------ screen */
export function Preprocess() {
  const selected = useApp((s) => s.selected)
  const order = useApp((s) => s.order)
  const images = useApp((s) => s.images)
  const select = useApp((s) => s.select)
  const imageId = selected && images[selected] ? selected : order.find((i) => images[i] && !images[i].pending) ?? null
  const meta = imageId ? images[imageId] : null

  const { server, draft, presetName, loadError, preview, tryAll, busy, error, applying } = usePreproc()
  const store = usePreproc
  const roiKey = usePreproc((s) => (imageId ? JSON.stringify(s.roi[imageId] ?? null) : ''))
  const roiSize = usePreproc((s) => s.roiSize)

  const [view, setView] = useState<View>('split')
  const [base, setBase] = useState<'filtered' | 'raw'>('filtered')
  const [showMask, setShowMask] = useState(true)
  const [showUnc, setShowUnc] = useState(false)
  const [opacity, setOpacity] = useState(0.6)
  const [swipe, setSwipe] = useState(0.5)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    store.getState().load()
  }, [store])
  useEffect(() => {
    if (imageId && !selected) select(imageId)
  }, [imageId, selected, select])

  const draftKey = JSON.stringify(draft)
  useEffect(() => {
    if (!imageId || !draft) return
    store.getState().request(imageId, 'preview')
    if (view === 'try_all') store.getState().request(imageId, 'try_all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, draftKey, roiKey, roiSize, view === 'try_all'])

  const pw = preview?.roi[2] ?? 0
  const ph = preview?.roi[3] ?? 0
  const pz = usePanZoom(pw, ph, view === 'split' ? 2 : 1)

  const dirty = !!server && !!draft && !same(server.params, draft)
  const presetOptions = server?.presets ?? []
  const setParam = (section: string, key: string, v: ParamValue) => store.getState().set(section, key, v)
  const toManual = (section: 'soma' | 'neurite') => (v: number) => {
    store.getState().set(section, 'method', 'manual')
    store.getState().set(section, 'value', Number(v.toFixed(5)))
  }

  const st = preview?.stats
  const um = meta?.um_per_px ?? null
  const fmtLen = (px: number) => (um ? `${(px * um).toFixed(0)} µm` : `${px} px`)
  const fmtArea = (px: number) => (um ? `${(px * um * um).toFixed(0)} µm²` : `${px} px²`)

  const layers = (which: 'raw' | 'result') => {
    if (!preview) return null
    const pix = pz.cam.z > 2
    return (
      <div className={p.layers} data-pixel={pix} style={{ width: pw, height: ph, transform: `translate(${pz.cam.x}px, ${pz.cam.y}px) scale(${pz.cam.z})` }}>
        {which === 'raw' ? (
          <img src={b64(preview.raw)} alt="Raw region" decoding="async" />
        ) : (
          <>
            <img src={b64(base === 'raw' ? preview.raw : preview.filtered)} alt="Filtered region" decoding="async" />
            {showUnc && preview.uncertainty && <img src={b64(preview.uncertainty)} alt="" decoding="async" style={{ opacity: 0.9 }} />}
            {showMask && preview.overlay && <img src={b64(preview.overlay)} alt="" decoding="async" style={{ opacity }} />}
          </>
        )}
      </div>
    )
  }

  if (!imageId || !meta) {
    return (
      <div className={p.main}>
        <div className={p.placeholderStage}>No images available yet — they appear here as soon as the data folder is scanned.</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
      <div className={p.main}>
        <div className={p.bar}>
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'split', label: 'Side by side', tip: 'Raw region | processed + masks (synced pan/zoom)' },
              { value: 'swipe', label: 'Swipe', tip: 'Drag the divider to compare' },
              { value: 'result', label: 'Result', tip: 'Processed image + masks only' },
              { value: 'try_all', label: 'Try all thresholds', tip: 'filters.try_all_threshold on this region' },
            ]}
          />
          <span className={p.spacer} />
          <span className={p.imageName}>
            {meta.name}
            {meta.modality_label ? <em> · {meta.modality_label}</em> : null}
          </span>
        </div>

        {view !== 'try_all' && (
          <div className={p.stats}>
            <span title="How many separate cell bodies (somata) the soma threshold finds in this region.">
              Cell bodies found<b>{st ? st.soma_count : '—'}</b>
            </span>
            <span title="Total area covered by the cell-body mask in this region.">
              Cell body area<b>{st ? fmtArea(st.soma_px) : '—'}</b>
            </span>
            <span title="Total length of all neurites: the neurite mask thinned to 1-pixel centre lines, then measured.">
              Neurite length<b>{st ? fmtLen(st.skeleton_px) : '—'}</b>
            </span>
            <span title="Share of the region that is marked as cell body or neurite.">
              Marked area<b>{st ? `${(st.fg_ratio * 100).toFixed(1)}%` : '—'}</b>
            </span>
          </div>
        )}

        {view === 'try_all' ? (
          <div className={p.grid}>
            {tryAll?.grid?.map((g) => {
              const on = draft?.soma?.method === g.method
              return (
                <button key={g.method} className={p.cell} data-on={on} disabled={!!g.error} onClick={() => setParam('soma', 'method', g.method)}
                  title={g.error ?? `Use threshold_${g.method} for somata`}>
                  <div className={p.cellHead}>
                    <b>{g.method}</b>
                    <span className="mono">{g.threshold != null ? g.threshold.toPrecision(3) : 'n/a'}</span>
                  </div>
                  {g.png ? <img src={b64(g.png)} alt={`${g.method} mask`} decoding="async" /> : <div className="muted">{g.error}</div>}
                  {g.fg_ratio != null && <span className="mono" style={{ fontSize: 'var(--fs-10)' }}>{(g.fg_ratio * 100).toFixed(2)}% foreground</span>}
                </button>
              )
            })}
            {!tryAll && <div className="muted">Computing every global threshold on this region…</div>}
          </div>
        ) : (
          <div className={p.stage} ref={pz.box}>
            {!preview ? (
              <div className={p.placeholderStage}>
                <span>
                  <span className={p.spin} style={{ display: 'inline-block', verticalAlign: -2, marginRight: 8 }} />
                  Filtering the selected region…
                </span>
              </div>
            ) : view === 'split' ? (
              <>
                <div className={p.pane} {...pz.handlers}>
                  <span className={p.paneLabel}>Raw</span>
                  {layers('raw')}
                </div>
                <div className={p.pane} {...pz.handlers}>
                  <span className={p.paneLabel}>Processed + threshold</span>
                  {layers('result')}
                </div>
              </>
            ) : view === 'swipe' ? (
              <div className={p.pane} {...pz.handlers}>
                <span className={p.paneLabel}>Raw ◂ ▸ Processed</span>
                {layers('result')}
                <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - swipe * 100}% 0 0)`, pointerEvents: 'none' }}>{layers('raw')}</div>
                <div
                  className={p.swipeLine}
                  style={{ left: `${swipe * 100}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons !== 1) return
                    e.stopPropagation()
                    const b = e.currentTarget.parentElement!.getBoundingClientRect()
                    setSwipe(Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)))
                  }}
                />
              </div>
            ) : (
              <div className={p.pane} {...pz.handlers}>
                <span className={p.paneLabel}>Processed + threshold</span>
                {layers('result')}
              </div>
            )}
          </div>
        )}
        {busy && (
          <div className={p.busy}>
            <span className={p.spin} /> {busy === 'try_all' ? 'Comparing thresholds' : 'Updating preview'}
          </div>
        )}
        {error && <div className={p.error}>Preview failed: {error}</div>}
      </div>

      <aside className={sh.inspector}>
        <div className={p.inspectorBody}>
          {loadError && <div className={p.warnBox}>Could not load the preprocessing settings: {loadError}</div>}
          {view !== 'try_all' && (
            <Section title="Display">
              <div className={p.stackLabel}>Background picture</div>
              <Segmented
                full
                value={base}
                onChange={setBase}
                options={[
                  { value: 'filtered', label: 'Filtered', tip: 'The image after your filters' },
                  { value: 'raw', label: 'Original', tip: 'The unprocessed micrograph' },
                ]}
              />
              <div className={p.bigToggles}>
                <button className={p.bigToggle} data-on={showMask} onClick={() => setShowMask(!showMask)}
                  title="Show what the thresholds mark: cell bodies (orange) and neurites (blue)">
                  <span className={p.swatches}>
                    <span className={p.swatch} style={{ background: 'var(--soma)' }} />
                    <span className={p.swatch} style={{ background: 'var(--neurite)' }} />
                  </span>
                  Masks
                </button>
                <button className={p.bigToggle} data-on={showUnc} onClick={() => setShowUnc(!showUnc)}
                  title="Pixels whose value is close to the threshold: the decision there is uncertain">
                  <span className={p.swatches}>
                    <span className={p.swatch} style={{ background: 'var(--uncert)' }} />
                  </span>
                  Uncertainty
                </button>
              </div>
              <Slider label="Mask opacity" value={opacity} min={0} max={1} step={0.05} onChange={setOpacity} format={(v) => `${Math.round(v * 100)}%`} />
            </Section>
          )}
          <Section title="Preview region">
            <RegionPicker imageId={imageId} />
          </Section>
          {preview?.warnings?.length ? (
            <div className={p.warnBox}>{preview.warnings.join(' · ')}</div>
          ) : null}
          {server &&
            draft &&
            server.schema.map((sec) => {
              const vals = draft[sec.id] ?? {}
              return (
                <Section key={sec.id} title={sec.title} action={<DocLink url={docFor(sec, vals)} />}>
                  <p className={p.help}>{sec.help}</p>
                  {sec.fields.map((f) => (
                    <Field key={f.key} f={f} sec={vals} value={vals[f.key] ?? f.default} onChange={(v) => setParam(sec.id, f.key, v)} />
                  ))}
                  {sec.id === 'soma' && preview?.hist && (
                    <>
                      <Histogram hist={preview.hist.soma} color="var(--soma)" unit="px" onDrag={toManual('soma')} />
                    </>
                  )}
                  {sec.id === 'neurite' && preview?.hist && (
                    <Histogram hist={preview.hist.neurite} color="var(--neurite)" unit="px" onDrag={toManual('neurite')} />
                  )}
                </Section>
              )
            })}
        </div>
        <div className={p.footer}>
          <div className={p.activeLine}>
            Pipeline uses <b>{server?.preset ?? '…'}</b> · <b>{server?.hash ?? ''}</b>
            {server && server.stale > 0 && <Badge color="var(--warn)" style={{ marginLeft: 6 }}>{server.stale} stale</Badge>}
            {dirty && <Badge color="var(--accent)" style={{ marginLeft: 6 }}>unapplied changes</Badge>}
          </div>
          <div className={p.footerRow}>
            <select className={p.selectFull} value={presetOptions.some((x) => x.name === presetName && draft && same(x.params, draft)) ? presetName : ''}
              onChange={(e) => store.getState().usePreset(e.target.value)} aria-label="Preset">
              <option value="" disabled>
                custom
              </option>
              {presetOptions.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                  {x.builtin ? ' (built-in)' : ''}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" style={{ flex: 'none' }} tip="Delete this preset" disabled={!presetOptions.some((x) => x.name === presetName && !x.builtin)}
              onClick={() => store.getState().deletePreset(presetName)}>
              <Trash2 size={14} />
            </Button>
          </div>
          <div className={p.footerRow}>
            <input className={p.nameInput} placeholder="New preset name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button size="sm" style={{ flex: 'none' }} disabled={!newName.trim()} onClick={() => store.getState().savePreset(newName).then(() => setNewName(''))}>
              <Save size={14} /> Save
            </Button>
          </div>
          <div className={p.footerRow}>
            <Button size="sm" variant="ghost" onClick={() => store.getState().reset()} tip="Back to the default pipeline settings">
              <RotateCcw size={14} /> Defaults
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || applying} onClick={() => store.getState().apply()}
              tip="Every later analysis (Analyze, Batch) uses these settings">
              <Check size={14} /> {applying ? 'Applying…' : 'Apply to pipeline'}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default Preprocess
