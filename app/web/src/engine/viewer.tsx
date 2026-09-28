import { Canvas } from '@react-three/fiber'
import { Crosshair, Hand, Layers2, Maximize, Pentagon, Scan, SquareDashed } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, urls } from '../api/client'
import type { Cell, Junction, Result } from '../api/types'
import { IconButton, Kbd } from '../components/ui'
import { area, fmt, len, niceScale } from '../lib/format'
import { useApp } from '../state/app'
import { effectiveVisible, useLayers, type LayerId } from '../state/layers'
import { cancelFlight, fit, fitZoom, flyTo, imageToScreen, MAX_ZOOM, MIN_ZOOM, screenToImage, type ViewportStore } from '../state/viewport'
import type { ImageAssets } from './assets'
import { HitIndex } from './hit'
import { LayerScene, type StackAnim } from './layer-scene'
import s from './viewer.module.css'

export type LabelMode = 'number' | 'delta'

interface ViewerProps {
  imageId: string
  store: ViewportStore
  /** show the floating toolbar / minimap / scale bar */
  chrome?: boolean
  interactive?: boolean
  labelMode?: LabelMode
  deltaRef?: number | null
  children?: ReactNode
  /** extra toolbar buttons */
  tools?: ReactNode
  showMinimap?: boolean
  className?: string
  /** layer stack allowed on this viewer */
  allowStack?: boolean
  onCellClick?: (c: Cell) => void
  overlayPointer?: (e: React.PointerEvent, img: { x: number; y: number }) => boolean
  /** restrict GPU layers to this set (e.g. review shows raw + uncertainty only) */
  forceLayers?: LayerId[]
  showLabels?: boolean
  roiTools?: boolean
  panTool?: boolean
}

export function Viewer({
  imageId,
  store,
  chrome = true,
  interactive = true,
  labelMode = 'number',
  deltaRef = null,
  children,
  tools,
  showMinimap = true,
  className,
  allowStack = true,
  onCellClick,
  overlayPointer,
  forceLayers,
  showLabels = true,
  roiTools = true,
  panTool = true,
}: ViewerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const result = useApp((st) => st.results[imageId])
  const tool = useApp((st) => st.tool)
  const stack = useApp((st) => st.stack) && allowStack
  const flickerPref = useApp((st) => st.prefs.flicker)
  const live = useApp((st) => st.live[imageId])
  const layers = useLayers((st) => st.layers)
  const solo = useLayers((st) => st.solo)
  const anim = useRef<StackAnim>({ t: 0, target: 0, yaw: 0, pitch: 0, hover: null })
  const assetsRef = useRef<ImageAssets | null>(null)
  const [animating, setAnimating] = useState(false)
  const [rawReady, setRawReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [wl, setWl] = useState<{ level: number; width: number } | null>(null)
  const readout = useRef<HTMLDivElement>(null)

  useEffect(() => {
    anim.current.target = stack ? 1 : 0
    if (!stack) {
      anim.current.yaw = 0
      anim.current.pitch = 0
      anim.current.hover = null
    }
    setAnimating(true)
  }, [stack])

  // measure + fit when the image (or its size) changes
  const fitted = useRef('')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      store.setState({ vw: r.width, vh: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [store])

  useEffect(() => {
    setRawReady(false)
    const id = setInterval(() => {
      const a = assetsRef.current
      if (a?.raw) {
        setRawReady(true)
        clearInterval(id)
      }
    }, 60)
    return () => clearInterval(id)
  }, [imageId])

  useEffect(() => {
    return store.subscribe((v) => {
      const key = `${imageId}:${v.imgW}x${v.imgH}`
      if (fitted.current !== key && v.vw > 10 && rawReady) {
        fitted.current = key
        fit(store)
      }
    })
  }, [store, imageId, rawReady])
  useEffect(() => {
    const v = store.getState()
    const key = `${imageId}:${v.imgW}x${v.imgH}`
    if (rawReady && fitted.current !== key && v.vw > 10) {
      fitted.current = key
      fit(store)
    }
  }, [rawReady, imageId, store])

  const hit = useMemo(() => (result ? new HitIndex(result) : null), [result])

  // ---------------- pointer: pan / zoom / window-level / orbit / ROI
  const drag = useRef<{ kind: 'pan' | 'wl' | 'orbit' | 'none'; x: number; y: number; cx: number; cy: number; lv: number; wd: number; moved: number }>({
    kind: 'none',
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    lv: 0,
    wd: 0,
    moved: 0,
  })

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { sx: e.clientX - r.left, sy: e.clientY - r.top, w: r.width, h: r.height }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return
    const p = local(e)
    const v = store.getState()
    const img = screenToImage(v, p.sx, p.sy, p.w, p.h)
    if (overlayPointer && e.button === 0 && !stack && overlayPointer(e, img)) return
    cancelFlight()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const raw = useLayers.getState().raw
    if (stack && e.button === 0) drag.current = { kind: 'orbit', x: e.clientX, y: e.clientY, cx: anim.current.yaw, cy: anim.current.pitch, lv: 0, wd: 0, moved: 0 }
    else if (e.button === 2) drag.current = { kind: 'wl', x: e.clientX, y: e.clientY, cx: 0, cy: 0, lv: raw.level, wd: raw.width, moved: 0 }
    else if (e.button === 1 || (e.button === 0 && tool === 'pan')) drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, lv: 0, wd: 0, moved: 0 }
    else drag.current.kind = 'none'
    if (drag.current.kind !== 'none') setDragging(true)
  }

  const hoverRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ kind: 'cell'; cell: Cell } | { kind: 'junction'; j: Junction } | null>(null)
  const hoverKey = useRef('')

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e)
    const v = store.getState()
    const d = drag.current
    if (d.kind === 'pan') {
      d.moved += Math.abs(e.movementX) + Math.abs(e.movementY)
      store.setState({ cx: d.cx - (e.clientX - d.x) / v.zoom, cy: d.cy - (e.clientY - d.y) / v.zoom })
      return
    }
    if (d.kind === 'orbit') {
      d.moved += Math.abs(e.movementX) + Math.abs(e.movementY)
      anim.current.yaw = d.cx + (e.clientX - d.x) * 0.006
      anim.current.pitch = Math.max(-0.7, Math.min(0.35, d.cy - (e.clientY - d.y) * 0.004))
      store.setState({ ...v })
      return
    }
    if (d.kind === 'wl') {
      // ilastik convention: left-right = level, up-down = width (s5.6)
      const level = Math.max(0, Math.min(1, d.lv + (e.clientX - d.x) / 600))
      const width = Math.max(0.02, Math.min(2, d.wd * Math.exp((e.clientY - d.y) / 220)))
      useLayers.getState().setRaw({ level, width })
      setWl({ level, width })
      return
    }
    if (stack) return
    const img = screenToImage(v, p.sx, p.sy, p.w, p.h)
    const inten = assetsRef.current?.intensityAt(img.x, img.y)
    if (readout.current) {
      const um = useApp.getState().umPerPx(imageId)
      const inside = img.x >= 0 && img.y >= 0 && img.x < v.imgW && img.y < v.imgH
      readout.current.innerHTML = inside
        ? `<span>x <b>${img.x.toFixed(0)}</b></span><span>y <b>${img.y.toFixed(0)}</b></span>${um ? `<span><b>${(img.x * um).toFixed(1)}</b>,<b>${(img.y * um).toFixed(1)}</b> µm</span>` : ''}<span>I <b>${inten == null ? '—' : inten.toFixed(3)}</b></span>`
        : `<span>outside image</span>`
    }
    if (hit && tool === 'pan') {
      const slack = 4 / v.zoom
      const j = effectiveVisible(layers, solo, 'junctions') || effectiveVisible(layers, solo, 'angles') ? hit.junctionAt(img.x, img.y, 9 / v.zoom) : null
      const c = j ? null : hit.cellAt(img.x, img.y, slack)
      const key = j ? `j${j.id}` : c ? `c${c.id}` : ''
      if (key !== hoverKey.current) {
        hoverKey.current = key
        setHover(j ? { kind: 'junction', j } : c ? { kind: 'cell', cell: c } : null)
        useApp.setState({ hoverCell: c ? c.id : null })
      }
      if (hoverRef.current) {
        const tx = Math.min(p.sx + 16, p.w - 200)
        const ty = Math.min(p.sy + 16, p.h - 120)
        hoverRef.current.style.transform = `translate(${tx}px, ${ty}px)`
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (d.kind === 'pan' && d.moved < 4 && e.button === 0 && hit) {
      const p = local(e)
      const img = screenToImage(store.getState(), p.sx, p.sy, p.w, p.h)
      const c = hit.cellAt(img.x, img.y, 4 / store.getState().zoom)
      useApp.setState({ selectedCell: c ? c.id : null })
      if (c) onCellClick?.(c)
    }
    drag.current.kind = 'none'
    setDragging(false)
    setWl(null)
  }

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!interactive) return
      e.preventDefault()
      cancelFlight()
      const el = ref.current!
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      const v = store.getState()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))
      const z1 = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor))
      if (useApp.getState().stack) {
        store.setState({ zoom: z1 })
        return
      }
      const img = screenToImage(v, sx, sy, r.width, r.height)
      store.setState({ zoom: z1, cx: img.x - (sx - r.width / 2) / z1, cy: img.y - (sy - r.height / 2) / z1 })
    },
    [store, interactive],
  )
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!interactive || stack || tool !== 'pan') return
    const p = local(e)
    const v = store.getState()
    const img = screenToImage(v, p.sx, p.sy, p.w, p.h)
    flyTo(store, img.x, img.y, Math.min(MAX_ZOOM, v.zoom * 2.2), 380)
  }

  const uncVisible = effectiveVisible(layers, solo, 'uncertainty') && (!forceLayers || forceLayers.includes('uncertainty'))
  const streaming = !!live && (live.state === 'queued' || live.state === 'running')
  const frameloop = (uncVisible && flickerPref) || streaming || animating || stack ? 'always' : 'demand'
  const onAssets = useCallback((a: ImageAssets) => {
    assetsRef.current = a
  }, [])

  return (
    <div
      ref={ref}
      className={`${s.viewer} ${className ?? ''}`}
      data-tool={tool}
      data-dragging={dragging}
      data-stack={stack}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        if (hoverKey.current) {
          hoverKey.current = ''
          setHover(null)
          useApp.setState({ hoverCell: null })
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={s.grid} />
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: 35, position: [960, -540, 2000], near: 1, far: 100000 }}
        flat
        linear
        style={{ position: 'absolute', inset: 0 }}
      >
        <LayerScene imageId={imageId} store={store} anim={anim} onAssets={onAssets} onAnimating={setAnimating} forceLayers={forceLayers} />
      </Canvas>

      {!rawReady && (
        <div className={`${s.decoding} ${s.glass}`}>
          <span className={s.bar} />
          Decoding micrograph in a worker…
        </div>
      )}

      <div className={s.dom2d}>
        {result && showLabels && effectiveVisible(layers, solo, 'labels') && <CellLabels result={result} store={store} mode={labelMode} deltaRef={deltaRef} />}
        <RoiLayer imageId={imageId} store={store} viewerRef={ref} />
      </div>

      {hover && !dragging && !stack && (
        <div ref={hoverRef} className={`${s.hoverTip} ${s.glass}`}>
          <HoverContent hover={hover} imageId={imageId} />
        </div>
      )}

      {chrome && (
        <>
          <div className={`${s.toolbar} ${s.glass}`}>
            {panTool && (
              <IconButton tip="Pan & select  ·  H" side="right" active={tool === 'pan'} onClick={() => useApp.setState({ tool: 'pan' })}>
                <Hand size={18} />
              </IconButton>
            )}
            {roiTools && (
              <>
                <IconButton tip="Rectangle ROI  ·  Q" side="right" active={tool === 'roi-rect'} onClick={() => useApp.setState({ tool: 'roi-rect' })}>
                  <SquareDashed size={18} />
                </IconButton>
                <IconButton tip="Polygon ROI  ·  P" side="right" active={tool === 'roi-poly'} onClick={() => useApp.setState({ tool: 'roi-poly' })}>
                  <Pentagon size={18} />
                </IconButton>
              </>
            )}
            <div className={s.toolSep} />
            <IconButton tip="Fit to view  ·  F" side="right" onClick={() => fitAnimated(store)}>
              <Maximize size={18} />
            </IconButton>
            <IconButton tip="Actual pixels 1:1  ·  Z" side="right" onClick={() => flyTo(store, store.getState().cx, store.getState().cy, 1, 380)}>
              <Scan size={18} />
            </IconButton>
            {allowStack && (
              <IconButton tip="Layer stack — explode layers in 3D  ·  S" side="right" active={stack} onClick={() => useApp.setState((st) => ({ stack: !st.stack }))}>
                <Layers2 size={18} />
              </IconButton>
            )}
            {tools}
          </div>

          <div className={s.bottomLeft}>
            {showMinimap && <Minimap imageId={imageId} store={store} />}
            <div ref={readout} className={`${s.readout} ${s.glass}`}>
              <span>
                <Crosshair size={13} style={{ verticalAlign: -1 }} /> hover the image
              </span>
            </div>
          </div>

          <div className={s.bottomRight}>
            <ZoomChip store={store} />
            <ScaleBar imageId={imageId} store={store} />
          </div>
        </>
      )}

      <AnimatePresence>
        {wl && (
          <motion.div className={`${s.wlHud} ${s.glass}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span>
              level <b>{wl.level.toFixed(3)}</b>
            </span>
            <span>
              width <b>{wl.width.toFixed(3)}</b>
            </span>
            <span className="muted">
              <Kbd>0</Kbd> reset
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  )
}

export function fitAnimated(store: ViewportStore) {
  const v = store.getState()
  flyTo(store, v.imgW / 2, v.imgH / 2, fitZoom(v.imgW, v.imgH, v.vw, v.vh), 420)
}

// ---------------------------------------------------------------- overlays
function HoverContent({ hover, imageId }: { hover: NonNullable<Parameters<typeof HoverBody>[0]['hover']>; imageId: string }) {
  return <HoverBody hover={hover} imageId={imageId} />
}

function HoverBody({ hover, imageId }: { hover: { kind: 'cell'; cell: Cell } | { kind: 'junction'; j: Junction }; imageId: string }) {
  const um = useApp.getState().umPerPx(imageId)
  if (hover.kind === 'junction') {
    const j = hover.j
    return (
      <>
        <div className={s.hoverTitle}>
          <span style={{ width: 8, height: 8, borderRadius: 8, border: '1.5px solid var(--junction)' }} />
          Junction {j.id}
        </div>
        <div className={s.hoverRow}>
          <span>branches</span>
          <span>{j.branch_ids.length}</span>
        </div>
        <div className={s.hoverRow}>
          <span>angles</span>
          <span>{j.angles_deg.map((a) => `${a.toFixed(0)}°`).join(' · ')}</span>
        </div>
      </>
    )
  }
  const c = hover.cell
  return (
    <>
      <div className={s.hoverTitle}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: c.outlier ? 'var(--outlier)' : 'var(--soma)' }} />
        Cell #{c.id}
        {c.outlier && <span style={{ color: 'var(--outlier)', fontWeight: 500, fontSize: 12 }}>QC outlier</span>}
      </div>
      <div className={s.hoverRow}>
        <span>soma area</span>
        <span>{area(c.area_px, um)}</span>
      </div>
      <div className={s.hoverRow}>
        <span>circularity</span>
        <span>{fmt(c.circularity)}</span>
      </div>
      <div className={s.hoverRow}>
        <span>neurite length</span>
        <span>{len(c.neurite_length_px, um)}</span>
      </div>
      <div className={s.hoverRow}>
        <span>cell NTI</span>
        <span>{fmt(c.nti)}</span>
      </div>
    </>
  )
}

function CellLabels({ result, store, mode, deltaRef }: { result: Result; store: ViewportStore; mode: LabelMode; deltaRef: number | null }) {
  const box = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const selected = useApp((st) => st.selectedCell)
  const hoverCell = useApp((st) => st.hoverCell)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-cell]')).filter((n) => n.dataset.prio !== undefined)
    // badge widths are measured once (content is static) - no layout reads per frame
    nodes.forEach((n) => (n.style.display = '')) // hidden badges report 0 width
    const widths = new Map(nodes.map((n) => [n, n.offsetWidth || 30]))
    const ordered = [...nodes].sort((a, b) => Number(b.dataset.prio) - Number(a.dataset.prio))
    const cells = new Map(result.cells.map((c) => [c.id, c]))
    let raf = 0
    const place = () => {
      raf = 0
      const v = store.getState()
      const show = v.zoom > 0.22
      // declutter: greedy placement by priority (selected > outlier > |delta| /
      // area) with a true rectangle test, so no two visible badges ever overlap
      const placed: [number, number, number, number][] = []
      for (const n of ordered) {
        const c = cells.get(Number(n.dataset.cell))!
        const p = imageToScreen(v, c.centroid[0], c.centroid[1])
        const off = (c.bbox[3] - c.bbox[1]) * 0.5 * v.zoom + 11
        const x = p.x
        const y = p.y - off
        const w = (widths.get(n) ?? 30) / 2 + 2
        const h = 11
        // keep clear of the floating toolbar strip on the left (x < 64)
        const onScreen = x - w > 60 && y - h > 4 && x + w < v.vw - 4 && y + h < v.vh - 4
        const free = !placed.some(([l, t2, r, b]) => x - w < r && x + w > l && y - h < b && y + h > t2)
        const vis = onScreen && (n.dataset.selected === 'true' || (show && free))
        if (vis) placed.push([x - w, y - h, x + w, y + h])
        n.style.transform = `translate(${x}px, ${y}px)`
        n.style.display = vis ? '' : 'none'
      }
      if (ring.current) {
        const c = cells.get(Number(ring.current.dataset.cell))
        if (c) {
          const p = imageToScreen(v, c.centroid[0], c.centroid[1])
          const r = Math.max(14, Math.max(c.bbox[2] - c.bbox[0], c.bbox[3] - c.bbox[1]) * 0.75 * v.zoom + 8)
          ring.current.style.width = `${r * 2}px`
          ring.current.style.height = `${r * 2}px`
          ring.current.style.transform = `translate(${p.x - r}px, ${p.y - r}px)`
        }
      }
    }
    place()
    const unsub = store.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(place)
    })
    return () => {
      unsub()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [result, store, selected, mode, deltaRef])

  const focus = selected ?? hoverCell
  return (
    <div ref={box}>
      {focus != null && result.cells.some((c) => c.id === focus) && <div key={focus} ref={ring} className={s.selRing} data-cell={focus} />}
      {result.cells.map((c) => {
        const delta = mode === 'delta' && deltaRef != null ? c.nti - deltaRef : null
        return (
          <div
            key={c.id}
            data-cell={c.id}
            className={s.label}
            data-outlier={c.outlier}
            data-selected={selected === c.id}
            data-delta={delta == null ? undefined : Math.abs(delta) < 0.02 ? undefined : delta > 0 ? 'pos' : 'neg'}
            data-prio={selected === c.id ? 1e6 : (c.outlier ? 1000 : 0) + (delta == null ? c.area_px / 1e3 : Math.abs(delta) * 100)}
          >
            {delta == null ? c.id : `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`}
          </div>
        )
      })}
    </div>
  )
}

function Minimap({ imageId, store }: { imageId: string; store: ViewportStore }) {
  const rect = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const meta = useApp((st) => st.images[imageId])
  const aspect = (meta?.height ?? 1080) / (meta?.width ?? 1920)
  const W = 168
  const H = Math.round(W * aspect)
  useEffect(() => {
    const place = () => {
      const v = store.getState()
      if (!rect.current) return
      const k = W / v.imgW
      const w = (v.vw / v.zoom) * k
      const h = (v.vh / v.zoom) * k
      const x = (v.cx - v.vw / v.zoom / 2) * k
      const y = (v.cy - v.vh / v.zoom / 2) * k
      rect.current.style.width = `${w}px`
      rect.current.style.height = `${h}px`
      rect.current.style.transform = `translate(${x}px, ${y}px)`
    }
    place()
    return store.subscribe(place)
  }, [store])
  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    const v = store.getState()
    store.setState({ cx: ((e.clientX - r.left) / W) * v.imgW, cy: ((e.clientY - r.top) / H) * v.imgH })
  }
  return (
    <div
      ref={box}
      className={`${s.minimap} ${s.glass}`}
      style={{ width: W, height: H }}
      onPointerDown={(e) => {
        e.stopPropagation()
        ;(e.target as Element).setPointerCapture(e.pointerId)
        cancelFlight()
        move(e)
      }}
      onPointerMove={(e) => {
        e.stopPropagation()
        if (e.buttons & 1) move(e)
      }}
      onWheel={(e) => e.stopPropagation()}
      title="Overview — drag to navigate"
    >
      <img src={urls.thumb(imageId)} alt="" draggable={false} />
      <div ref={rect} className={s.miniRect} />
    </div>
  )
}

function ScaleBar({ imageId, store }: { imageId: string; store: ViewportStore }) {
  const line = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const um = useApp((st) => st.umPerPx(imageId))
  useEffect(() => {
    const place = () => {
      const v = store.getState()
      const unitsPerPx = (um ?? 1) / v.zoom
      const n = niceScale(unitsPerPx, 100)
      if (line.current) line.current.style.width = `${n.px}px`
      if (text.current) text.current.textContent = `${n.value >= 1 ? n.value.toFixed(0) : n.value} ${um ? 'µm' : 'px'}`
    }
    place()
    return store.subscribe(place)
  }, [store, um])
  return (
    <div className={`${s.scalebar} ${s.glass}`} title={um ? `Calibration ${um.toFixed(4)} µm/px from CZI metadata [VERIFY — D5 open]` : 'No calibration: pixel units'}>
      <div ref={line} className={s.scaleLine} />
      <span ref={text} className={s.scaleText} />
    </div>
  )
}

function ZoomChip({ store }: { store: ViewportStore }) {
  const t = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const place = () => {
      if (t.current) t.current.textContent = `${(store.getState().zoom * 100).toFixed(store.getState().zoom < 1 ? 0 : 0)}%`
    }
    place()
    return store.subscribe(place)
  }, [store])
  return (
    <button className={`${s.zoomChip} ${s.glass}`} onClick={() => fitAnimated(store)} title="Zoom — click to fit">
      <span ref={t} />
    </button>
  )
}

// ---------------------------------------------------------------- ROI tool
function RoiLayer({ imageId, store, viewerRef }: { imageId: string; store: ViewportStore; viewerRef: React.RefObject<HTMLDivElement | null> }) {
  const tool = useApp((st) => st.tool)
  const roi = useApp((st) => (st.roi?.imageId === imageId ? st.roi : null))
  const [draft, setDraft] = useState<[number, number][]>([])
  const g = useRef<SVGGElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const startRef = useRef<[number, number] | null>(null)
  const um = useApp((st) => st.umPerPx(imageId))

  useEffect(() => {
    const place = () => {
      const v = store.getState()
      if (g.current) g.current.setAttribute('transform', `matrix(${v.zoom},0,0,${v.zoom},${v.vw / 2 - v.cx * v.zoom},${v.vh / 2 - v.cy * v.zoom})`)
      if (card.current && roi) {
        const xs = roi.polygon.map((p) => p[0])
        const ys = roi.polygon.map((p) => p[1])
        const p = imageToScreen(v, Math.max(...xs), Math.min(...ys))
        const x = Math.min(Math.max(8, p.x + 12), v.vw - 248)
        const y = Math.min(Math.max(8, p.y), v.vh - 260)
        card.current.style.transform = `translate(${x}px, ${y}px)`
      }
    }
    place()
    const raf = requestAnimationFrame(place)
    const unsub = store.subscribe(place)
    return () => {
      cancelAnimationFrame(raf)
      unsub()
    }
  }, [store, roi])

  const commit = useCallback(
    (poly: [number, number][]) => {
      setDraft([])
      startRef.current = null
      if (poly.length < 3) return
      useApp.setState({ roi: { imageId, polygon: poly, loading: true }, tool: 'pan' })
      api
        .roi(imageId, poly)
        .then((metrics) => useApp.setState((st) => (st.roi?.polygon === poly ? { roi: { ...st.roi, metrics, loading: false } } : {})))
        .catch((e) => useApp.setState((st) => (st.roi?.polygon === poly ? { roi: { ...st.roi, loading: false, error: String(e.message) } } : {})))
    },
    [imageId],
  )

  // pointer handling for the ROI tools (attached to the viewer element)
  useEffect(() => {
    const el = viewerRef.current
    if (!el || (tool !== 'roi-rect' && tool !== 'roi-poly')) return
    const toImg = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect()
      const p = screenToImage(store.getState(), e.clientX - r.left, e.clientY - r.top, r.width, r.height)
      const v = store.getState()
      return [Math.max(0, Math.min(v.imgW, p.x)), Math.max(0, Math.min(v.imgH, p.y))] as [number, number]
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const p = toImg(e)
      if (tool === 'roi-rect') {
        startRef.current = p
        setDraft([p, p, p, p])
      } else {
        setDraft((d) => {
          if (d.length >= 3) {
            const v = store.getState()
            const first = d[0]
            if (Math.hypot(first[0] - p[0], first[1] - p[1]) * v.zoom < 10) {
              queueMicrotask(() => commit(d))
              return d
            }
          }
          return [...d, p]
        })
      }
    }
    const move = (e: PointerEvent) => {
      const p = toImg(e)
      setCursor(p)
      if (tool === 'roi-rect' && startRef.current && e.buttons & 1) {
        const [x0, y0] = startRef.current
        setDraft([
          [x0, y0],
          [p[0], y0],
          [p[0], p[1]],
          [x0, p[1]],
        ])
      }
    }
    const up = () => {
      if (tool === 'roi-rect' && startRef.current) {
        setDraft((d) => {
          const w = Math.abs(d[2][0] - d[0][0])
          const h = Math.abs(d[2][1] - d[0][1])
          if (w > 3 && h > 3) queueMicrotask(() => commit(d))
          else startRef.current = null
          return w > 3 && h > 3 ? d : []
        })
      }
    }
    const dbl = (e: MouseEvent) => {
      if (tool !== 'roi-poly') return
      e.stopPropagation()
      setDraft((d) => {
        if (d.length >= 3) queueMicrotask(() => commit(d))
        return d
      })
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && tool === 'roi-poly') setDraft((d) => (d.length >= 3 ? (queueMicrotask(() => commit(d)), d) : d))
      if (e.key === 'Escape') {
        setDraft([])
        startRef.current = null
      }
    }
    el.addEventListener('pointerdown', down, true)
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('dblclick', dbl, true)
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down, true)
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('dblclick', dbl, true)
      window.removeEventListener('keydown', key)
    }
  }, [tool, store, viewerRef, commit])

  const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ')
  const m = roi?.metrics
  return (
    <>
      <svg className={s.roiSvg}>
        <g ref={g}>
          {roi && <polygon className={s.roiPoly} points={pts(roi.polygon)} />}
          {draft.length > 0 && (
            <polyline
              className={s.roiPoly}
              points={pts(tool === 'roi-poly' && cursor ? [...draft, cursor] : draft)}
              style={{ fill: tool === 'roi-rect' ? 'rgba(189,147,249,0.1)' : 'none' }}
            />
          )}
          {tool === 'roi-poly' &&
            draft.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.5 / store.getState().zoom} fill={i === 0 ? '#bd93f9' : '#f1f1ec'} />)}
        </g>
      </svg>
      <AnimatePresence>
        {roi && (
          // outer div owns the position (written imperatively on pan/zoom);
          // the inner motion div owns the entrance animation's transform
          <div ref={card} key="roi-card" className={s.roiCard} style={{ padding: 0 }} onPointerDown={(e) => e.stopPropagation()}>
          <motion.div
            className={s.glass}
            style={{ padding: 12 }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          >
            <div className={s.roiHead}>
              <span className="eyebrow">ROI analysis</span>
              <button className="muted" onClick={() => useApp.setState({ roi: null })} style={{ fontSize: 13 }}>
                Clear <Kbd>Esc</Kbd>
              </button>
            </div>
            {roi.loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 13 }}>
                <span className={s.bar} /> measuring inside the region…
              </div>
            )}
            {roi.error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{roi.error}</div>}
            {m && (
              <div className={s.roiGrid}>
                <Stat k="area" v={area(m.area_px, um)} />
                <Stat k="foreground" v={`${(m.fg_ratio * 100).toFixed(1)}%`} />
                <Stat k="cells" v={String(m.cells)} />
                <Stat k="mean conf." v={m.mean_conf == null ? '—' : m.mean_conf.toFixed(2)} />
                <Stat k="neurites" v={String(m.neurites)} />
                <Stat k="length" v={len(m.neurite_length_px, um, 0)} />
                <Stat k="junctions" v={String(m.junctions)} />
                <Stat k="components" v={String(m.components)} />
                <Stat k="soma area" v={m.mean_soma_area_px == null ? '—' : area(m.mean_soma_area_px, um)} />
                <Stat k="circularity" v={m.mean_circularity == null ? '—' : m.mean_circularity.toFixed(2)} />
              </div>
            )}
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className={s.roiStat}>
    <span>{k}</span>
    <span>{v}</span>
  </div>
)
