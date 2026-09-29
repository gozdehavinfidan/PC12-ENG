import { CircleAlert, CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { Section } from '../components/ui'
import { useApp } from '../state/app'
import s from './panels.module.css'

interface Rule {
  label: string
  value: number
  display: string
  threshold: number
  max: number
  good: 'above' | 'below'
  note: string
}

/** QC module kept from the previous app (s18 C1): metrics + warning rules. */
export function QCPanel({ imageId }: { imageId: string | null }) {
  const result = useApp((st) => (imageId ? st.results[imageId] : undefined))
  if (!result) return <div className={s.emptyPanel}>Quality control runs automatically with every analysis.</div>
  const q = result.qc
  const rules: Rule[] = [
    { label: 'Focus (sharpness)', value: q.blur, display: q.blur.toFixed(2), threshold: 0.35, max: 1, good: 'above', note: 'Laplacian variance, normalised' },
    { label: 'Mean confidence', value: q.mean_conf, display: q.mean_conf.toFixed(2), threshold: 0.75, max: 1, good: 'above', note: '1 − 0.6 × mean uncertainty on foreground' },
    { label: 'Low-confidence ratio', value: q.low_conf_ratio, display: `${(q.low_conf_ratio * 100).toFixed(1)}%`, threshold: 0.25, max: 0.6, good: 'below', note: 'foreground pixels with uncertainty > 0.5' },
    { label: 'Foreground coverage', value: q.fg_ratio, display: `${(q.fg_ratio * 100).toFixed(2)}%`, threshold: 0.002, max: Math.max(0.06, q.fg_ratio * 1.3), good: 'above', note: 'soma + neurite pixels / image' },
    { label: 'Small-component ratio', value: q.small_component_ratio, display: `${(q.small_component_ratio * 100).toFixed(0)}%`, threshold: 0.6, max: 1, good: 'below', note: `${q.components} connected components; < 40 px counts as small` },
    { label: 'Edge density', value: q.edge_density, display: q.edge_density.toFixed(4), threshold: 0, max: Math.max(0.01, q.edge_density * 1.5), good: 'above', note: 'Canny, σ = 2 (informational)' },
  ]
  const sevIcon = { warning: <TriangleAlert size={17} color="var(--warn)" />, serious: <CircleAlert size={17} color="var(--serious)" />, critical: <OctagonAlert size={17} color="var(--bad)" /> }
  const sevBg = { warning: 'rgba(245,185,58,0.08)', serious: 'rgba(236,131,90,0.1)', critical: 'rgba(255,92,108,0.1)' }
  return (
    <>
      <Section title="Warnings">
        <div className={s.warnList}>
          {q.warnings.length === 0 ? (
            <div className={s.warn} style={{ background: 'rgba(62,207,110,0.08)', boxShadow: 'inset 0 0 0 1px rgba(62,207,110,0.3)' }}>
              <CircleCheck size={17} color="var(--ok)" />
              <span>All quality rules pass for this image.</span>
            </div>
          ) : (
            q.warnings.map((w) => (
              <motion.div key={w.code} className={s.warn} style={{ background: sevBg[w.severity] }} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                {sevIcon[w.severity]}
                <span>
                  <b style={{ fontWeight: 560, textTransform: 'capitalize' }}>{w.severity}</b> — {w.text}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </Section>
      <Section title="Metrics & thresholds">
        {rules.map((r, i) => {
          const ok = r.threshold === 0 ? true : r.good === 'above' ? r.value >= r.threshold : r.value <= r.threshold
          return (
            <div className={s.qcRow} key={r.label}>
              <span className={s.qcLabel}>
                {ok ? <CircleCheck size={13} color="var(--ok)" style={{ verticalAlign: -1 }} /> : <TriangleAlert size={13} color="var(--warn)" style={{ verticalAlign: -1 }} />} {r.label}
              </span>
              <span className={s.qcVal}>{r.display}</span>
              <div className={s.qcBar}>
                <motion.div
                  className={s.qcFill}
                  style={{ background: ok ? 'var(--ok)' : 'var(--warn)', opacity: 0.8 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (r.value / r.max) * 100)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
                />
                {r.threshold > 0 && <span className={s.qcThr} style={{ left: `${Math.min(100, (r.threshold / r.max) * 100)}%` }} title={`threshold ${r.threshold}`} />}
              </div>
              <span className={s.qcNote}>{r.note}</span>
            </div>
          )
        })}
      </Section>
      <Section title="What QC flags mean">
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          QC flags describe image and segmentation quality. A red frame around a cell is a robust median + MAD outlier on soma area or circularity — it asks for a look, it is <b>not</b> a toxicity call.
        </p>
      </Section>
    </>
  )
}
