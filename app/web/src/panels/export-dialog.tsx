import { Check, Copy, FileText, Image as ImageIcon, Table, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { urls } from '../api/client'
import { Button, IconButton } from '../components/ui'
import { useApp } from '../state/app'
import s from '../shell/shell.module.css'

/** Export dialog (s18 A15 / C2 / C3): CSV tables, text report, PNG of the current view. */
export function ExportDialog() {
  const open = useApp((st) => st.exportOpen)
  const selected = useApp((st) => st.selected)
  const screen = useApp((st) => st.screen)
  const compare = useApp((st) => st.compare)
  const id = screen === 'compare' ? compare.b : selected
  const name = useApp((st) => (id ? st.images[id]?.name : ''))
  const hasResult = useApp((st) => (id ? !!st.results[id] : false))
  const um = useApp((st) => (id ? st.umPerPx(id) : null))
  const [copied, setCopied] = useState(false)
  const close = () => useApp.setState({ exportOpen: false })

  const snapshot = () => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    const c = canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0]
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `${id ?? 'view'}_view.png`
    a.click()
  }
  const copySummary = async () => {
    if (!id) return
    const txt = await fetch(urls.export(id, 'report.txt')).then((r) => r.text())
    await navigator.clipboard.writeText(txt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const Item = ({ icon, title, desc, href, onClick }: { icon: React.ReactNode; title: string; desc: string; href?: string; onClick?: () => void }) => {
    const body = (
      <div
        style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 12px', borderRadius: 10, background: 'var(--bg-raised)', boxShadow: 'inset 0 0 0 1px var(--line-1)', cursor: 'pointer' }}
        onClick={onClick}
      >
        <span style={{ width: 36, height: 36, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 560, fontSize: 14 }}>{title}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {desc}
          </div>
        </div>
        <span className="mono muted" style={{ fontSize: 13 }}>
          download
        </span>
      </div>
    )
    return href ? (
      <a href={href} download style={{ color: 'inherit', textDecoration: 'none' }}>
        {body}
      </a>
    ) : (
      body
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={close}>
          <motion.div className={s.dialog} initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} onPointerDown={(e) => e.stopPropagation()}>
            <div className={s.dialogHead}>
              <div>
                <div className={s.dialogTitle}>Export results</div>
                <div className="mono muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {name || 'no image selected'}
                </div>
              </div>
              <IconButton tip="Close" onClick={close}>
                <X size={18} />
              </IconButton>
            </div>
            <div className={s.dialogBody} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!id || !hasResult ? (
                <div className="muted" style={{ fontSize: 13.5 }}>
                  Analyse an image first — exports are generated from its result.
                </div>
              ) : (
                <>
                  <Item icon={<Table size={19} />} title="Cells table (CSV)" desc="one row per soma: area, circularity, neurite length, branches, cell NTI, QC flag" href={urls.export(id, 'cells.csv')} />
                  <Item icon={<Table size={19} />} title="Neurite branches (CSV)" desc="one row per branch: length, tortuosity, orientation, junctions, tips" href={urls.export(id, 'neurites.csv')} />
                  <Item icon={<FileText size={19} />} title="Text report" desc="NTI with contributions, 4 parameter summaries (mean/median/std/CV), QC" href={urls.export(id, 'report.txt')} />
                  <Item icon={<ImageIcon size={19} />} title="Current view (PNG)" desc="exactly what the viewer shows, with the active layers" onClick={snapshot} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {um ? (
                        <>Lengths in pixels in the files; this image is calibrated at <span className="mono">{um.toFixed(4)}</span> µm/px.</>
                      ) : (
                        <>Uncalibrated image: all lengths and areas are exported in pixels.</>
                      )}
                    </span>
                    <Button size="sm" onClick={copySummary}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy report'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
