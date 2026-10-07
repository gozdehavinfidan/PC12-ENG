import {
  Activity,
  ChartScatter,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Columns2,
  Command,
  Info,
  Keyboard,
  ListChecks,
  Microscope,
  Moon,
  Sun,
  Search,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Dot, IconButton, Kbd, Ring } from '../components/ui'
import { timeAgo } from '../lib/format'
import { useApp, type Screen } from '../state/app'
import { useLayers } from '../state/layers'
import { useTheme } from '../state/theme'
import s from './shell.module.css'

export const NAV: { id: Screen; label: string; icon: typeof Microscope; hint: string }[] = [
  { id: 'analyze', label: 'Analyze', icon: Microscope, hint: 'Watch it think — live segmentation & NTI' },
  { id: 'preprocess', label: 'Preprocess', icon: SlidersHorizontal, hint: 'Preprocessing presets — screen filters before analysis' },
  { id: 'compare', label: 'Compare', icon: Columns2, hint: 'Before / after toxicity — synced views' },
  { id: 'similarity', label: 'Similarity', icon: ChartScatter, hint: 'Cell atlas — feature-space neighbours (descriptive)' },
  { id: 'review', label: 'Review', icon: ClipboardCheck, hint: 'Labeling workstation — uncertainty-ranked queue' },
  { id: 'batch', label: 'Batch', icon: ListChecks, hint: 'Cohort queue, jobs and conditions' },
]

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <radialGradient id="bm" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffd9a8" />
          <stop offset="1" stopColor="#ffb86c" />
        </radialGradient>
        <linearGradient id="bn" x1="0" x2="1">
          <stop offset="0" stopColor="#8be9fd" />
          <stop offset="1" stopColor="#bd93f9" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#bn)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 16 L27 8 M22 11.6 L25 15.5" />
        <path d="M16 16 L6 24 M10.5 20.4 L6.5 18" />
        <path d="M16 16 L22 27" />
        <path d="M16 16 L9 5" />
      </g>
      <circle cx="27" cy="8" r="1.3" fill="#50fa7b" />
      <circle cx="6" cy="24" r="1.3" fill="#50fa7b" />
      <circle cx="16" cy="16" r="4.6" fill="url(#bm)" />
    </svg>
  )
}

function Rail() {
  const screen = useApp((st) => st.screen)
  const setScreen = useApp((st) => st.setScreen)
  return (
    <nav className={s.rail} aria-label="Screens">
      <div className={s.brand} title="CAMEX — Cellular Analysis of Morphology with XAI for PC12">
        <BrandMark size={28} />
      </div>
      {NAV.map((n, i) => (
        <RailButton key={n.id} active={screen === n.id} onClick={() => setScreen(n.id)} tip={`${n.label} — ${n.hint}  ·  Alt+${i + 1}`} label={n.label}>
          <n.icon size={30} strokeWidth={1.8} />
        </RailButton>
      ))}
      <div className={s.railSpacer} />
      <RailButton active={screen === 'settings'} onClick={() => setScreen('settings')} tip={`Settings & runtime  ·  Alt+${NAV.length + 1}`} label="Settings">
        <Settings2 size={30} strokeWidth={1.7} />
      </RailButton>
    </nav>
  )
}

function RailButton({ active, onClick, tip, label, children }: { active: boolean; onClick: () => void; tip: string; label: string; children: ReactNode }) {
  return (
    <button className={s.navBtn} data-active={active} onClick={onClick} aria-label={tip} aria-current={active ? 'page' : undefined} title={tip}>
      {active && (
        <>
          <motion.span layoutId="nav-pill" className={s.navPill} transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
          <motion.span layoutId="nav-bar" className={s.navBar} transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
        </>
      )}
      {children}
      <span className={s.navLabel}>{label}</span>
    </button>
  )
}

function ModelBadge() {
  const model = useApp((st) => st.model)
  const color = model.state === 'ready' ? 'var(--ok)' : model.state === 'warming' ? 'var(--warn)' : 'var(--bad)'
  const label = model.state === 'ready' ? 'Ready' : model.state === 'warming' ? 'Warming up workers…' : 'Backend offline — reconnecting'
  return (
    <div
      className={s.modelBadge}
      title={`Pipeline ${model.version} · ${model.provider} · ${model.runtime}${model.warm_ms ? ` · workers warmed in ${model.warm_ms} ms` : ''}`}
    >
      <Dot color={color} pulse={model.state !== 'ready'} />
      <b>{label}</b>
    </div>
  )
}

function JobTray() {
  const jobs = useApp((st) => st.jobs)
  const images = useApp((st) => st.images)
  const cancel = useApp((st) => st.cancel)
  const workers = useApp((st) => st.model.workers)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const list = useMemo(() => Object.values(jobs).sort((a, b) => b.created - a.created), [jobs])
  const active = list.filter((j) => j.state === 'running' || j.state === 'queued')
  const running = list.filter((j) => j.state === 'running')
  const avg = running.length ? running.reduce((a, j) => a + j.progress, 0) / running.length : 0

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  if (!active.length && !open) return null   // nothing is being analysed: nothing to show
  return (
    <div ref={ref}>
      <button
        className={s.trayBtn}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Images being analysed in the background. Click to see the list or cancel one."
      >
        {active.length ? <Ring value={avg} size={22} /> : <Activity size={20} />}
        <span>{active.length ? `Analysing images · ${active.length} left` : 'Analysis finished'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.tray}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className={s.trayHead}>
              <span style={{ fontWeight: 600 }}>Analysis queue</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {workers.interactive + workers.background} images are processed at a time; the rest wait their turn.
              </span>
            </div>
            <div className={s.trayList}>
              {list.length === 0 && <div className="muted" style={{ padding: 16, fontSize: 13.5 }}>No jobs yet.</div>}
              {list.slice(0, 60).map((j) => (
                <div key={j.id} className={s.jobRow}>
                  <span>
                    {j.state === 'running' ? (
                      <Ring value={j.progress} size={20} />
                    ) : j.state === 'queued' ? (
                      <Dot color="var(--text-4)" />
                    ) : j.state === 'done' ? (
                      <CircleCheck size={18} color="var(--ok)" />
                    ) : j.state === 'failed' ? (
                      <CircleAlert size={18} color="var(--bad)" />
                    ) : (
                      <X size={18} color="var(--text-3)" />
                    )}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className={s.jobName}>{images[j.image_id]?.name ?? j.image_id}</div>
                    <div className={s.jobMeta}>
                      <span>{j.priority === 'interactive' ? 'started by you' : 'automatic'}</span>
                      <span>{j.state === 'running' ? `${j.stage ?? ''} ${j.tiles_total ? `· tile ${j.tiles_done}/${j.tiles_total}` : ''}` : j.state}</span>
                      <span>{timeAgo(j.created)}</span>
                    </div>
                    {j.state === 'running' && (
                      <div className={s.jobBar}>
                        <span style={{ width: `${j.progress * 100}%` }} />
                      </div>
                    )}
                  </div>
                  {(j.state === 'running' || j.state === 'queued') && (
                    <Button size="sm" variant="danger" onClick={() => cancel(j.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Sliding dark / light toggle. The knob travels on a spring; colours
 *  cross-fade via the .theme-anim class set by the theme store. */
export function ThemeToggle() {
  const theme = useTheme((st) => st.theme)
  const toggle = useTheme((st) => st.toggle)
  const light = theme === 'light'
  return (
    <button
      role="switch"
      aria-checked={light}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      title={light ? 'Dark theme  ·  Shift+D' : 'Light theme  ·  Shift+D'}
      className={s.themeToggle}
      data-light={light}
      onClick={toggle}
    >
      <span className={s.themeIcon} data-on={!light}>
        <Moon size={19} />
      </span>
      <span className={s.themeIcon} data-on={light}>
        <Sun size={19} />
      </span>
      <motion.span className={s.themeKnob} layout transition={{ type: 'spring', stiffness: 520, damping: 34 }} style={{ left: light ? 'calc(50% + 1px)' : 3 }} />
    </button>
  )
}

function TopBar() {
  const screen = useApp((st) => st.screen)
  const selected = useApp((st) => st.selected)
  const images = useApp((st) => st.images)
  const compare = useApp((st) => st.compare)
  const nav = NAV.find((n) => n.id === screen)
  const crumb =
    screen === 'compare'
      ? compare.a && compare.b
        ? `${images[compare.a]?.name ?? compare.a}  ↔  ${images[compare.b]?.name ?? compare.b}`
        : null
      : ['analyze', 'preprocess', 'review'].includes(screen) && selected
        ? (images[selected]?.name ?? selected)
        : null
  return (
    <header className={s.topbar}>
      <div className={s.crumbs}>
        <span className={s.product} title="Cellular Analysis of Morphology with XAI for PC12">
          CA<em>MEX</em>
        </span>
        <span className={s.crumbSep}>/</span>
        <span className={s.crumb}>{nav?.label ?? 'Settings'}</span>
        {crumb && (
          <>
            <span className={s.crumbSep}>/</span>
            <span className={s.crumbImage} title={crumb}>
              {crumb}
            </span>
          </>
        )}
      </div>
      <div className={s.topSpacer} />
      <button className={s.search} onClick={() => useApp.setState({ paletteOpen: true })}>
        <Search size={20} />
        <span className={s.searchLabel}>Search &amp; commands</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <ModelBadge />
      <JobTray />
      <ThemeToggle />
      <IconButton tip="Keyboard shortcuts  ·  ?" onClick={() => useApp.setState({ helpOpen: true })}>
        <Keyboard size={22} />
      </IconButton>
    </header>
  )
}

function Toasts() {
  const toasts = useApp((st) => st.toasts)
  const dismiss = useApp((st) => st.dismiss)
  const icon = { info: <Info size={18} color="var(--accent)" />, ok: <CircleCheck size={18} color="var(--ok)" />, warn: <TriangleAlert size={18} color="var(--warn)" />, bad: <CircleAlert size={18} color="var(--bad)" /> }
  return (
    <div className={s.toasts} role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={s.toast}
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {icon[t.tone]}
            <div>
              <div className={s.toastTitle}>{t.title}</div>
              {t.body && <div className={s.toastBody}>{t.body}</div>}
              {t.action && (
                <Button
                  size="sm"
                  variant="primary"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    t.action!.run()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </Button>
              )}
            </div>
            <IconButton small tip="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={15} />
            </IconButton>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- palette
interface Cmd {
  id: string
  group: string
  label: string
  hint?: string
  icon?: ReactNode
  run: () => void
}

function useCommands(): Cmd[] {
  const images = useApp((st) => st.images)
  const order = useApp((st) => st.order)
  const layers = useLayers((st) => st.layers)
  return useMemo(() => {
    const app = useApp.getState()
    const cmds: Cmd[] = NAV.map((n, i) => ({
      id: `go-${n.id}`,
      group: 'Go to',
      label: n.label,
      hint: `Alt+${i + 1}`,
      icon: <n.icon size={17} />,
      run: () => app.setScreen(n.id),
    }))
    cmds.push({ id: 'go-settings', group: 'Go to', label: 'Settings', hint: `Alt+${NAV.length + 1}`, icon: <Settings2 size={17} />, run: () => app.setScreen('settings') })
    cmds.push(
      { id: 'run', group: 'Actions', label: 'Run analysis on current image', hint: 'R', icon: <Command size={17} />, run: () => { const id = useApp.getState().selected; if (id) void useApp.getState().analyze(id) } },
      { id: 'stack', group: 'Actions', label: 'Toggle layer stack (3D)', hint: 'S', run: () => useApp.setState((st) => ({ stack: !st.stack })) },
      { id: 'export', group: 'Actions', label: 'Export results…', hint: 'E', run: () => useApp.setState({ exportOpen: true }) },
      { id: 'inspector', group: 'Actions', label: 'Toggle inspector', hint: 'I', run: () => useApp.setState((st) => ({ inspectorOpen: !st.inspectorOpen })) },
      { id: 'film', group: 'Actions', label: 'Toggle filmstrip', hint: 'T', run: () => useApp.setState((st) => ({ filmstripOpen: !st.filmstripOpen })) },
      { id: 'roi', group: 'Actions', label: 'Draw rectangle ROI', hint: 'Q', run: () => useApp.setState({ tool: 'roi-rect' }) },
      { id: 'theme', group: 'Actions', label: 'Toggle light / dark theme', hint: 'Shift+D', icon: <Sun size={17} />, run: () => useTheme.getState().toggle() },
    )
    layers.forEach((l, i) =>
      cmds.push({ id: `layer-${l.id}`, group: 'Layers', label: `${l.visible ? 'Hide' : 'Show'} ${l.name}`, hint: i < 9 ? String(i + 1) : undefined, run: () => useLayers.getState().toggle(l.id) }),
    )
    order.forEach((id) => {
      const m = images[id]
      cmds.push({
        id: `img-${id}`,
        group: 'Images',
        label: m?.name ?? id,
        hint: m?.nti != null ? `NTI ${m.nti.toFixed(2)}` : m?.pending ? 'preparing' : 'not analysed',
        run: () => {
          const a = useApp.getState()
          if (a.screen === 'batch' || a.screen === 'settings' || a.screen === 'similarity') a.setScreen('analyze')
          a.select(id)
        },
      })
    })
    return cmds
  }, [images, order, layers])
}

function Palette() {
  const open = useApp((st) => st.paletteOpen)
  const cmds = useCommands()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return cmds.filter((c) => c.group !== 'Images').concat(cmds.filter((c) => c.group === 'Images').slice(0, 8))
    return cmds.filter((c) => (c.label + ' ' + c.group).toLowerCase().includes(t)).slice(0, 60)
  }, [q, cmds])
  useEffect(() => {
    setIdx(0)
  }, [q, open])
  const close = () => {
    useApp.setState({ paletteOpen: false })
    setQ('')
  }
  const run = (c: Cmd) => {
    close()
    c.run()
  }
  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={close}>
          <motion.div
            className={s.palette}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={s.paletteInput}>
              <Search size={18} color="var(--text-3)" />
              <input
                autoFocus
                placeholder="Type a command or image name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (setIdx((i) => Math.min(list.length - 1, i + 1)), e.preventDefault())
                  if (e.key === 'ArrowUp') (setIdx((i) => Math.max(0, i - 1)), e.preventDefault())
                  if (e.key === 'Enter' && list[idx]) run(list[idx])
                  if (e.key === 'Escape') close()
                }}
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className={s.paletteList}>
              {list.length === 0 && <div className="muted" style={{ padding: 18, fontSize: 13.5 }}>Nothing matches “{q}”.</div>}
              {list.map((c, i) => {
                const head = c.group !== lastGroup
                lastGroup = c.group
                return (
                  <div key={c.id}>
                    {head && <div className={s.paletteGroup}>{c.group}</div>}
                    <button className={s.paletteItem} data-active={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => run(c)}>
                      <span style={{ width: 16, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>{c.icon}</span>
                      <span>{c.label}</span>
                      {c.hint && <span className="mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>{c.hint}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className={s.paletteFoot}>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
              </span>
              <span>
                <Kbd>Enter</Kbd> run
              </span>
              <span style={{ marginLeft: 'auto' }}>{cmds.length} commands · all offline</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const SHORTCUTS: [string, string[]][] = [
  ['Command palette', ['Ctrl', 'K']],
  ['Switch screen', ['Alt', `1–${NAV.length + 1}`]],
  ['Run analysis', ['R']],
  ['Cancel running job', ['Ctrl', '.']],
  ['Toggle layer 1–9', ['1…9']],
  ['Solo a layer', ['Alt', 'click eye']],
  ['Layer stack (3D)', ['S']],
  ['Fit / 1:1 pixels', ['F', 'Z']],
  ['Pan', ['H', 'drag']],
  ['Window / level', ['right-drag']],
  ['Reset window / level', ['0']],
  ['Rectangle / polygon ROI', ['Q', 'P']],
  ['Previous / next image', ['←', '→']],
  ['Inspector / filmstrip', ['I', 'T']],
  ['Export results', ['E']],
  ['Light / dark theme', ['Shift', 'D']],
  ['Clear ROI / close', ['Esc']],
]

function Help() {
  const open = useApp((st) => st.helpOpen)
  const close = () => useApp.setState({ helpOpen: false })
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={close}>
          <motion.div className={s.dialog} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} onPointerDown={(e) => e.stopPropagation()} style={{ width: 640 }}>
            <div className={s.dialogHead}>
              <span className={s.dialogTitle}>Keyboard shortcuts</span>
              <IconButton tip="Close" onClick={close}>
                <X size={18} />
              </IconButton>
            </div>
            <div className={s.dialogBody}>
              <div className={s.shortcuts}>
                {SHORTCUTS.map(([k, v]) => (
                  <div className={s.shortcut} key={k}>
                    <span>{k}</span>
                    <span>
                      {v.map((x) => (
                        <Kbd key={x}>{x}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                Review workstation: <Kbd>B</Kbd> brush · <Kbd>E</Kbd> erase · <Kbd>[</Kbd> <Kbd>]</Kbd> size · <Kbd>Ctrl</Kbd>+click delete object · <Kbd>Alt</Kbd>+click merge ·{' '}
                <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo · <Kbd>A</Kbd> accept · <Kbd>J</Kbd>/<Kbd>K</Kbd> next/prev
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className={s.app}>
      <Rail />
      <TopBar />
      {children}
      <Toasts />
      <Palette />
      <Help />
    </div>
  )
}

export { s as shellStyles }
