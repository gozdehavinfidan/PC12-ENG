import { Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Button, IconButton, Section, Slider, Switch } from '../components/ui'
import { useApp } from '../state/app'
import { effectiveVisible, useLayers, type Colormap, type LayerId } from '../state/layers'
import s from './panels.module.css'

export function LayersPanel() {
  const layers = useLayers((st) => st.layers)
  const solo = useLayers((st) => st.solo)
  const raw = useLayers((st) => st.raw)
  const { toggle, setOpacity, setSolo, move, setRaw, resetRaw } = useLayers.getState()
  const stack = useApp((st) => st.stack)
  const stackDepth = useApp((st) => st.stackDepth)
  const [open, setOpen] = useState<LayerId | null>('raw')
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  // panel lists top layer first (like napari / Photoshop); draw order is the reverse
  const display = [...layers].map((l, i) => ({ l, i })).reverse()

  return (
    <>
      <Section
        title={`Layers · ${layers.filter((l) => effectiveVisible(layers, solo, l.id)).length}/${layers.length} visible`}
        action={
          solo ? (
            <Button size="sm" variant="ghost" onClick={() => setSolo(null)}>
              Clear solo
            </Button>
          ) : undefined
        }
        flush
      >
        <div className={s.layerList}>
          {display.map(({ l, i }) => {
            const vis = effectiveVisible(layers, solo, l.id)
            const keyN = i + 1
            return (
              <div
                key={l.id}
                className={s.layer}
                data-open={open === l.id}
                data-hidden={!vis}
                data-dragover={over === i && dragFrom !== null && dragFrom !== i}
                draggable
                onDragStart={(e) => {
                  setDragFrom(i)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(i)
                }}
                onDragEnd={() => {
                  setDragFrom(null)
                  setOver(null)
                }}
                onDrop={() => {
                  if (dragFrom !== null && dragFrom !== i) move(dragFrom, i)
                  setDragFrom(null)
                  setOver(null)
                }}
              >
                <div className={s.layerRow}>
                  <span className={s.grip} title="Drag to reorder">
                    <GripVertical size={14} />
                  </span>
                  <span className={s.swatch} style={{ background: l.id === 'raw' ? 'linear-gradient(135deg,#1b3a22,#50fa7b)' : l.color }} />
                  <button className={s.layerName} onClick={() => setOpen(open === l.id ? null : l.id)} title={l.hint}>
                    <b>
                      {l.name}
                      {solo === l.id && <span className={s.soloTag}>SOLO</span>}
                    </b>
                    <span>{l.hint}</span>
                  </button>
                  <span className={s.keyHint}>{keyN <= 9 ? keyN : ''}</span>
                  <IconButton
                    small
                    tip={`${vis ? 'Hide' : 'Show'} · Alt+click = solo`}
                    side="left"
                    onClick={(e) => (e.altKey ? setSolo(l.id) : toggle(l.id))}
                    active={vis}
                  >
                    {vis ? <Eye size={16} /> : <EyeOff size={16} />}
                  </IconButton>
                </div>
                <AnimatePresence initial={false}>
                  {open === l.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }} style={{ overflow: 'hidden' }}>
                      <div className={s.layerBody}>
                        <Slider label="Opacity" value={l.opacity} min={0} max={1} onChange={(v) => setOpacity(l.id, v)} format={(v) => `${Math.round(v * 100)}%`} onReset={() => setOpacity(l.id, 1)} />
                        {l.id === 'raw' && (
                          <>
                            <div className={s.row}>
                              <span>Colormap</span>
                            </div>
                            <div className={s.chips} role="radiogroup" aria-label="Colormap">
                              {(
                                [
                                  ['native', 'Native', 'linear-gradient(90deg,#08140a,#50fa7b)'],
                                  ['gray', 'Gray', 'linear-gradient(90deg,#000,#fff)'],
                                  ['green', 'GFP', 'linear-gradient(90deg,#000,#40ff5a)'],
                                  ['magma', 'Magma', 'linear-gradient(90deg,#000004,#b63679,#fcfdbf)'],
                                  ['inverted', 'Inverted', 'linear-gradient(90deg,#fff,#000)'],
                                ] as [Colormap, string, string][]
                              ).map(([v, label, grad]) => (
                                <button key={v} role="radio" aria-checked={raw.colormap === v} data-on={raw.colormap === v} className={s.chip} onClick={() => setRaw({ colormap: v })}>
                                  <i style={{ background: grad }} />
                                  {label}
                                </button>
                              ))}
                            </div>
                            <Slider label="Level (right-drag ↔)" value={raw.level} min={0} max={1} onChange={(v) => setRaw({ level: v })} format={(v) => v.toFixed(3)} onReset={() => setRaw({ level: 0.5 })} />
                            <Slider label="Width (right-drag ↕)" value={raw.width} min={0.02} max={2} onChange={(v) => setRaw({ width: v })} format={(v) => v.toFixed(3)} onReset={() => setRaw({ width: 1 })} />
                            <Slider label="Gamma" value={raw.gamma} min={0.3} max={3} onChange={(v) => setRaw({ gamma: v })} onReset={() => setRaw({ gamma: 1 })} />
                            <Slider label="Contrast" value={raw.contrast} min={0.5} max={3} onChange={(v) => setRaw({ contrast: v })} onReset={() => setRaw({ contrast: 1 })} />
                            <Slider label="Unsharp mask" value={raw.unsharp} min={0} max={3} onChange={(v) => setRaw({ unsharp: v })} onReset={() => setRaw({ unsharp: 0 })} />
                            <div className={s.row}>
                              <span title="Contrast-limited adaptive histogram equalisation, computed by the backend (classical filter — no GAN)">CLAHE (server-side)</span>
                              <Switch on={raw.clahe} onChange={(v) => setRaw({ clahe: v })} label="CLAHE" />
                            </div>
                            <Button size="sm" variant="ghost" onClick={resetRaw} style={{ alignSelf: 'flex-start' }}>
                              <RotateCcw size={14} /> Reset display  ·  0
                            </Button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Layer stack">
        <div className={s.row} style={{ marginBottom: 10 }}>
          <span>Explode visible layers into 3D sheets</span>
          <Switch on={stack} onChange={(v) => useApp.setState({ stack: v })} label="Layer stack" />
        </div>
        <Slider label="Sheet spacing" value={stackDepth} min={0.3} max={2} onChange={(v) => useApp.setState({ stackDepth: v })} format={(v) => `${v.toFixed(1)}×`} onReset={() => useApp.setState({ stackDepth: 1 })} />
        <p className="muted" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
          Drag to orbit · hover a sheet to highlight it · click a sheet to solo it. Press <b>S</b> to fold back to 2D.
        </p>
      </Section>
    </>
  )
}
