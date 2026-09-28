import { Check, FolderOpen, Play, RotateCcw, Sparkles, Square, Upload } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { StageCode } from '../api/types'
import { Button, Kbd, Ring } from '../components/ui'
import { Viewer } from '../engine/viewer'
import { Inspector } from '../panels/inspector'
import { useApp } from '../state/app'
import { viewports } from '../state/viewport'
import s from './screens.module.css'

const STAGES: { code: StageCode; label: string }[] = [
  { code: 'S0', label: 'Decode' },
  { code: 'S1', label: 'Normalise' },
  { code: 'S2', label: 'Segment' },
  { code: 'S3', label: 'Skeleton' },
  { code: 'S4', label: 'Measure' },
  { code: 'S5', label: 'NTI' },
]

/** U1 "Watch it think": the SSE progress stream, staged. */
function StageStepper({ imageId }: { imageId: string }) {
  const live = useApp((st) => st.live[imageId])
  const result = useApp((st) => st.results[imageId])
  const timer = useRef<HTMLSpanElement>(null)
  const [showDone, setShowDone] = useState(false)
  const streaming = !!live && (live.state === 'queued' || live.state === 'running')

  useEffect(() => {
    if (!streaming || !live) return
    let raf = 0
    const tick = () => {
      if (timer.current) timer.current.textContent = `${((performance.now() - live.startedAt) / 1000).toFixed(1)} s`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [streaming, live])

  useEffect(() => {
    if (live?.state === 'done') {
      setShowDone(true)
      const t = setTimeout(() => setShowDone(false), 5000)
      return () => clearTimeout(t)
    }
  }, [live?.state, live?.jobId])

  return (
    <AnimatePresence mode="wait">
      {streaming && live ? (
        <motion.div key="stepper" className={s.stepper} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
          {live.state === 'queued' && <span className={s.step} data-state="running"><span className={s.spin} /> Queued — waiting for a free worker</span>}
          {live.state === 'running' &&
            STAGES.map((st, i) => {
              const state = live.stages[st.code]?.state ?? 'pending'
              return (
                <div key={st.code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span className={s.stepLink} />}
                  <span className={s.step} data-state={state}>
                    {state === 'done' ? (
                      <Check size={14} color="var(--ok)" />
                    ) : state === 'running' ? (
                      st.code === 'S2' && live.tilesTotal ? (
                        <Ring value={live.tilesDone / live.tilesTotal} size={16} stroke={2} />
                      ) : (
                        <span className={s.spin} />
                      )
                    ) : (
                      <span className={s.pendingDot} />
                    )}
                    <span className={s.stepCode}>{st.code}</span>
                    {st.label}
                    {st.code === 'S2' && state === 'running' && live.tilesTotal > 0 && (
                      <span className={s.stepMs}>
                        {live.tilesDone}/{live.tilesTotal}
                      </span>
                    )}
                    {state === 'done' && live.stages[st.code].ms != null && <span className={s.stepMs}>{live.stages[st.code].ms} ms</span>}
                  </span>
                </div>
              )
            })}
          <span ref={timer} className={s.timer}>
            0.0 s
          </span>
          <Button size="sm" variant="danger" onClick={() => void useApp.getState().cancel(live.jobId)} tip="Cancel job  ·  Ctrl+." side="bottom">
            <Square size={13} fill="currentColor" /> Cancel
          </Button>
        </motion.div>
      ) : showDone && live?.finishedMs ? (
        <motion.div key="done" className={s.resultPill} initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
          <Sparkles size={16} color="var(--accent)" />
          <span>
            Analysed in <b className="mono">{(live.finishedMs / 1000).toFixed(1)} s</b> · {result?.summary.cell_count ?? 0} cells · NTI <b className="mono">{result?.nti.score == null ? 'n/a' : result.nti.score.toFixed(2)}</b>
          </span>
          <Button size="sm" variant="ghost" onClick={() => void useApp.getState().analyze(imageId)}>
            <RotateCcw size={14} /> Re-run
          </Button>
        </motion.div>
      ) : result ? (
        <motion.div key="cached" className={s.resultPill} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <span className="mono" style={{ fontSize: 13 }}>
            cached · {result.model_version}
          </span>
          <Button size="sm" onClick={() => void useApp.getState().analyze(imageId)} tip="Re-run and watch the tiles stream  ·  R" side="bottom">
            <Play size={13} /> Watch it think
          </Button>
        </motion.div>
      ) : (
        <motion.div key="cta" className={s.resultPill} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <span>Not analysed yet</span>
          <Button size="sm" variant="primary" onClick={() => void useApp.getState().analyze(imageId)}>
            <Play size={13} /> Run analysis · R
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function NeuronArt() {
  const reduce = useReducedMotion()
  const paths = [
    'M100 62 C 120 50, 140 30, 176 18',
    'M100 62 C 130 70, 150 90, 190 96',
    'M100 62 C 80 40, 60 30, 26 16',
    'M100 62 C 70 80, 50 96, 14 108',
    'M140 34 C 150 44, 158 50, 170 58',
    'M58 30 C 50 44, 44 52, 30 60',
    'M150 88 C 158 76, 166 70, 178 66',
  ]
  return (
    <svg className={s.dropArt} viewBox="0 0 200 120" fill="none">
      <defs>
        <linearGradient id="na" x1="0" x2="1">
          <stop offset="0" stopColor="#8be9fd" />
          <stop offset="1" stopColor="#bd93f9" />
        </linearGradient>
        <radialGradient id="ns">
          <stop offset="0" stopColor="#ffe2bd" />
          <stop offset="1" stopColor="#ffb86c" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glow)" stroke="url(#na)" strokeWidth="1.6" strokeLinecap="round">
        {paths.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.2 + i * 0.12, ease: [0.2, 0, 0, 1], repeat: reduce ? 0 : Infinity, repeatType: 'reverse', repeatDelay: 2.4 }}
          />
        ))}
      </g>
      {[
        [176, 18],
        [190, 96],
        [26, 16],
        [14, 108],
      ].map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={2.4} fill="#50fa7b" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4 + i * 0.1 }} />
      ))}
      {/* pulse via transform, not the r attribute (animating r leaves it undefined for a frame) */}
      <motion.circle cx={100} cy={62} r={9} fill="url(#ns)" filter="url(#glow)" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={{ duration: 2.6, repeat: Infinity }} />
    </svg>
  )
}

function EmptyState() {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const images = useApp((st) => st.images)
  const order = useApp((st) => st.order)
  const model = useApp((st) => st.model)
  const done = order.filter((id) => images[id]?.has_result)
  const sample = done.find((id) => (images[id]?.cell_count ?? 0) > 8) ?? done[0]
  return (
    <div className={s.empty}>
      <div className={s.emptyGrid} />
      <motion.div
        className={s.drop}
        data-over={over}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
      >
        <NeuronArt />
        <h1 className={s.dropTitle}>
          Drop a micrograph and <em>watch it think</em>
        </h1>
        <p className={s.dropSub}>
          Tiles stream in as the pipeline segments soma and neurites, uncertainty flickers where it hesitates, and the four NTI parameters count up live. Everything runs on this machine — no internet.
        </p>
        <div className={s.dropActions}>
          <Button variant="primary" onClick={() => input.current?.click()}>
            <Upload size={16} /> Choose micrograph
          </Button>
          <Button disabled={!sample} onClick={() => sample && useApp.getState().select(sample)}>
            <FolderOpen size={16} /> Open a cohort image
          </Button>
          <input
            ref={input}
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
        <div className={s.formats}>
          {['.czi', '.tif', '.png', '.jpg'].map((f) => (
            <span key={f} className={s.format}>
              {f}
            </span>
          ))}
        </div>
        <div className={s.emptyStats}>
          <div className={s.emptyStat}>
            <b>{order.length}</b>
            <span>images in cohort</span>
          </div>
          <div className={s.emptyStat}>
            <b>{done.length}</b>
            <span>analysed (cached)</span>
          </div>
          <div className={s.emptyStat}>
            <b style={{ color: model.state === 'ready' ? 'var(--ok)' : 'var(--warn)' }}>{model.state === 'ready' ? 'ready' : 'warming'}</b>
            <span>pipeline workers</span>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
          <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> search everything · <Kbd>?</Kbd> shortcuts
        </p>
      </motion.div>
    </div>
  )
}

export function GlobalDrop() {
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const overH = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) void useApp.getState().upload(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overH)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return (
    <AnimatePresence>
      {over && (
        <motion.div className={s.dropOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className={s.dropOverlayCard} initial={{ scale: 0.94 }} animate={{ scale: 1 }}>
            Drop to analyse
            <div className="muted" style={{ fontSize: 13.5, fontWeight: 400, marginTop: 6 }}>
              CZI · TIFF · PNG · JPG — processed in the background, the UI stays live
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Analyze() {
  const selected = useApp((st) => st.selected)
  return (
    <div className={s.stage}>
      {selected ? (
        <>
          <div className={s.viewerArea}>
            <Viewer key={selected} imageId={selected} store={viewports.main}>
              <StageStepper imageId={selected} />
            </Viewer>
          </div>
          <Inspector imageId={selected} store={viewports.main} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
