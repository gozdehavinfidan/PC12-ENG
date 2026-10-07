import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { ExportDialog } from './panels/export-dialog'
import { Analyze, GlobalDrop } from './screens/analyze'
import { AppFrame, NAV } from './shell/shell'
import { Filmstrip } from './shell/filmstrip'
import s from './shell/shell.module.css'
import { startBackendSync, useApp, type Screen } from './state/app'
import { useLayers } from './state/layers'
import { useTheme } from './state/theme'
import { fit, flyTo, viewports } from './state/viewport'

// heavier screens load on first visit (three.js scene, atlas) — keeps first paint fast
const Compare = lazy(() => import('./screens/compare').then((m) => ({ default: m.Compare })))
const Preprocess = lazy(() => import('./screens/preprocess').then((m) => ({ default: m.Preprocess })))
const Similarity = lazy(() => import('./screens/similarity').then((m) => ({ default: m.Similarity })))
const Review = lazy(() => import('./screens/review').then((m) => ({ default: m.Review })))
const Batch = lazy(() => import('./screens/batch').then((m) => ({ default: m.Batch })))
const Settings = lazy(() => import('./screens/settings').then((m) => ({ default: m.Settings })))

const SCREENS: Record<Screen, React.ComponentType> = {
  analyze: Analyze,
  preprocess: Preprocess,
  compare: Compare,
  similarity: Similarity,
  review: Review,
  batch: Batch,
  settings: Settings,
}

// Alt+1..N for the rail screens, Alt+(N+1) for settings
const SWITCH_KEYS = new RegExp(`^[1-${NAV.length + 1}]$`)

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const app = useApp.getState()
      const k = e.key
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') {
        e.preventDefault()
        useApp.setState({ paletteOpen: !app.paletteOpen })
        return
      }
      if (app.paletteOpen || app.helpOpen || app.exportOpen) {
        if (k === 'Escape') useApp.setState({ paletteOpen: false, helpOpen: false, exportOpen: false })
        return
      }
      if (e.altKey && SWITCH_KEYS.test(k)) {
        e.preventDefault()
        const order: Screen[] = [...NAV.map((n) => n.id), 'settings']
        app.setScreen(order[Number(k) - 1])
        return
      }
      if ((e.ctrlKey || e.metaKey) && k === '.') {
        const id = app.selected
        const live = id ? app.live[id] : undefined
        if (live && (live.state === 'running' || live.state === 'queued')) void app.cancel(live.jobId)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.shiftKey && k.toLowerCase() === 'd') {
        useTheme.getState().toggle()
        return
      }
      if (app.screen === 'review') return // the workstation owns its own keys
      const store = app.screen === 'compare' ? viewports.compare : app.screen === 'preprocess' ? viewports.preprocess : viewports.main
      const inViewer = ['analyze', 'preprocess', 'compare'].includes(app.screen)
      if (/^[1-9]$/.test(k) && inViewer) {
        const l = useLayers.getState().layers[Number(k) - 1]
        if (l) useLayers.getState().toggle(l.id)
        return
      }
      switch (k) {
        case '?':
          useApp.setState({ helpOpen: true })
          break
        case 'Escape':
          if (app.roi) useApp.setState({ roi: null })
          else if (app.stack) useApp.setState({ stack: false })
          else if (app.tool !== 'pan') useApp.setState({ tool: 'pan' })
          else useApp.setState({ selectedCell: null })
          break
        case 'r':
        case 'R':
          if (app.selected && app.screen === 'analyze') void app.analyze(app.selected)
          break
        case 's':
        case 'S':
          if (inViewer) useApp.setState({ stack: !app.stack })
          break
        case 'f':
        case 'F':
          if (inViewer) {
            const v = store.getState()
            fit(store)
            const z = store.getState().zoom
            store.setState(v)
            flyTo(store, v.imgW / 2, v.imgH / 2, z, 420)
          }
          break
        case 'z':
        case 'Z':
          if (inViewer) flyTo(store, store.getState().cx, store.getState().cy, 1, 380)
          break
        case '0':
          useLayers.getState().setRaw({ level: 0.5, width: 1, gamma: 1, contrast: 1 })
          break
        case 'h':
        case 'H':
          useApp.setState({ tool: 'pan' })
          break
        case 'q':
        case 'Q':
          if (inViewer) useApp.setState({ tool: 'roi-rect', stack: false })
          break
        case 'p':
        case 'P':
          if (inViewer) useApp.setState({ tool: 'roi-poly', stack: false })
          break
        case 'i':
        case 'I':
          useApp.setState({ inspectorOpen: !app.inspectorOpen })
          break
        case 't':
        case 'T':
          useApp.setState({ filmstripOpen: !app.filmstripOpen })
          break
        case 'e':
        case 'E':
          useApp.setState({ exportOpen: true })
          break
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (app.screen !== 'analyze' && app.screen !== 'preprocess') break
          const ids = app.order
          const i = app.selected ? ids.indexOf(app.selected) : -1
          const next = ids[(i + (k === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length]
          if (next) app.select(next)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function ScreenFallback() {
  // lazy chunk loads from disk in a few ms; show progress, never a blank page
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 90, height: 3, borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), transparent)' }} /> preparing view…
      </span>
    </div>
  )
}

export default function App() {
  const screen = useApp((st) => st.screen)
  const film = useApp((st) => st.filmstripOpen)
  useShortcuts()
  useEffect(() => startBackendSync(), [])
  const Screen = SCREENS[screen]
  const showFilm = film && ['analyze', 'preprocess', 'compare'].includes(screen)
  return (
    <MotionConfig reducedMotion="user">
      <AppFrame>
        <main className={s.main}>
          <div className={s.stage}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screen}
                style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                <Suspense fallback={<ScreenFallback />}>
                  <Screen />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {showFilm && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'var(--filmstrip-h)' }} exit={{ height: 0 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} style={{ overflow: 'hidden' }}>
                <Filmstrip mode={screen === 'compare' ? 'compare' : 'select'} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <ExportDialog />
        <GlobalDrop />
      </AppFrame>
    </MotionConfig>
  )
}
