import { BarChart3, Boxes, Layers, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useApp, type InspectorTab } from '../state/app'
import type { ViewportStore } from '../state/viewport'
import s from '../shell/shell.module.css'
import { LayersPanel } from './layers-panel'
import { MetricsPanel } from './metrics-panel'
import { ObjectsPanel } from './objects-panel'
import { QCPanel } from './qc-panel'

const TABS: { id: InspectorTab; label: string; icon: typeof Layers }[] = [
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'objects', label: 'Objects', icon: Boxes },
  { id: 'qc', label: 'QC', icon: ShieldCheck },
]

export function Inspector({ imageId, store }: { imageId: string | null; store: ViewportStore }) {
  const tab = useApp((st) => st.inspectorTab)
  const open = useApp((st) => st.inspectorOpen)
  const result = useApp((st) => (imageId ? st.results[imageId] : undefined))
  const warn = result?.qc.warnings.length ?? 0
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          className={s.inspector}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
          style={{ overflow: 'hidden' }}
          aria-label="Inspector"
        >
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className={s.tabs} role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={s.tab} data-on={tab === t.id} onClick={() => useApp.setState({ inspectorTab: t.id })}>
                  {t.label}
                  {t.id === 'qc' && warn > 0 && (
                    <span className={s.tabCount} style={{ color: 'var(--warn)' }}>
                      {warn}
                    </span>
                  )}
                  {tab === t.id && <motion.span layoutId="insp-tab" className={s.tabLine} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                </button>
              ))}
            </div>
            <div className={s.inspectorBody}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                  style={{ height: tab === 'objects' ? '100%' : undefined }}
                >
                  {tab === 'metrics' && <MetricsPanel imageId={imageId} />}
                  {tab === 'layers' && <LayersPanel />}
                  {tab === 'objects' && <ObjectsPanel imageId={imageId} store={store} />}
                  {tab === 'qc' && <QCPanel imageId={imageId} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
