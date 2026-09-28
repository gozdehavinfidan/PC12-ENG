import { Download, FileText, Image as ImageIcon, Play, Table } from 'lucide-react'
import { motion } from 'motion/react'
import { urls } from '../api/client'
import type { Result, Summary } from '../api/types'
import { ContribBars, Histogram, NtiGauge, Polar, Spark } from '../charts/charts'
import { Badge, Button, Ticker } from '../components/ui'
import { areaUnit, areaVal, lenUnit, lenVal } from '../lib/format'
import { useApp } from '../state/app'
import s from './panels.module.css'

function Stats({ sum, conv = (v: number) => v, d = 1 }: { sum: Summary; conv?: (v: number) => number; d?: number }) {
  return (
    <div className={s.statGrid}>
      {(
        [
          ['mean', conv(sum.mean).toFixed(d)],
          ['median', conv(sum.median).toFixed(d)],
          ['std', conv(sum.std).toFixed(d)],
          ['CV', sum.cv.toFixed(2)],
        ] as const
      ).map(([k, v]) => (
        <div className={s.stat} key={k}>
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}

export function MetricsPanel({ imageId }: { imageId: string | null }) {
  const result = useApp((st) => (imageId ? st.results[imageId] : undefined))
  const live = useApp((st) => (imageId ? st.live[imageId] : undefined))
  const meta = useApp((st) => (imageId ? st.images[imageId] : undefined))
  const um = useApp((st) => (imageId ? st.umPerPx(imageId) : null))
  const streaming = !!live && (live.state === 'running' || live.state === 'queued')

  if (!imageId) return <div className={s.emptyPanel}>Pick an image from the filmstrip or drop a micrograph to see its measurements.</div>

  return (
    <div>
      <div className={s.hero}>
        <div className={s.heroTop}>
          <span className="eyebrow">Neural Toxicity Index</span>
          <Badge color="#f5b93a" tip="Placeholder formula until the TÜSEB NTI is fitted — shape is final, numbers are not">
            mock formula
          </Badge>
        </div>
        <div className={s.heroMain}>
          <div style={{ position: 'relative', width: 164, height: 128, flex: 'none' }}>
            <NtiGauge value={streaming ? null : (result?.nti.score ?? null)} live={streaming} size={164} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 52, textAlign: 'center' }}>
              {result && !streaming && result.nti.score != null ? (
                <Ticker value={result.nti.score} format={(v) => v.toFixed(2)} className={s.nti} />
              ) : (
                <span className={s.nti} style={{ color: 'var(--text-4)' }}>
                  {streaming ? '···' : result ? 'n/a' : '—'}
                </span>
              )}
            </div>
          </div>
          <div className={s.ntiScale} aria-label="NTI scale">
            <span>
              <i style={{ background: 'var(--div-neg)' }} />
              <b>0</b> healthy
            </span>
            <span>
              <i style={{ background: 'var(--div-mid)' }} />
              <b>0.5</b> reference
            </span>
            <span>
              <i style={{ background: 'var(--div-pos)' }} />
              <b>1</b> toxic
            </span>
          </div>
        </div>
        {result && !streaming && <ContribBars contrib={result.nti.contrib} />}
      </div>

      {streaming && live && (
        <motion.div className={s.liveBox} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>
            Measuring live · tile {live.tilesDone}/{live.tilesTotal || '…'}
          </div>
          <div className={s.liveGrid}>
            <div className={s.stat}>
              <span>somata found</span>
              <Ticker value={live.running.cells} className={s.big} />
            </div>
            <div className={s.stat}>
              <span>neurite ≈ {lenUnit(um)}</span>
              <Ticker value={lenVal(live.running.neurite_px, um)} className={s.big} />
            </div>
          </div>
        </motion.div>
      )}

      {!result && !streaming && (
        <div className={s.emptyPanel}>
          {meta?.pending ? 'Preparing this image on the server…' : 'This image has not been analysed yet.'}
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" onClick={() => void useApp.getState().analyze(imageId)}>
              <Play size={15} /> Run analysis · R
            </Button>
          </div>
        </div>
      )}

      {result && !streaming && <ParamCards result={result} um={um} />}

      {result && !streaming && (
        <div className={s.exportRow}>
          <Button size="sm" onClick={() => useApp.setState({ exportOpen: true })}>
            <Download size={14} /> Export…
          </Button>
          <a className="" href={urls.export(imageId, 'cells.csv')} download>
            <Button size="sm" variant="ghost" tabIndex={-1}>
              <Table size={14} /> cells.csv
            </Button>
          </a>
          <a href={urls.export(imageId, 'report.txt')} download>
            <Button size="sm" variant="ghost" tabIndex={-1}>
              <FileText size={14} /> report
            </Button>
          </a>
        </div>
      )}
    </div>
  )
}

function ParamCards({ result, um }: { result: Result; um: number | null }) {
  const sm = result.summary
  const card = (i: number, color: string, title: string, children: React.ReactNode) => (
    <motion.div className={s.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06, duration: 0.3, ease: [0.2, 0, 0, 1] }}>
      <div className={s.cardHead}>
        <span className={s.cardIdx} style={{ background: color }}>
          {i}
        </span>
        <span className={s.cardTitle}>{title}</span>
      </div>
      {children}
    </motion.div>
  )
  const perCell = sm.cell_count ? sm.neurite_length_px.total / sm.cell_count : 0
  return (
    <div className={s.cards}>
      {card(
        1,
        'var(--neurite)',
        'Neurite length',
        <>
          <div className={s.cardMain}>
            <div className={s.big}>
              <Ticker value={lenVal(perCell, um)} format={(v) => v.toFixed(0)} />
              <small>{lenUnit(um)} / cell</small>
            </div>
            <Spark values={result.neurites.map((b) => lenVal(b.length_px, um))} color="var(--neurite)" />
          </div>
          <div className={s.cardSub}>
            {sm.neurite_length_px.n} branches · total {lenVal(sm.neurite_length_px.total, um).toFixed(0)} {lenUnit(um)}
          </div>
          <Stats sum={sm.neurite_length_px} conv={(v) => lenVal(v, um)} d={1} />
        </>,
      )}
      {card(
        2,
        'var(--junction)',
        'Branching',
        <>
          <div className={s.cardMain}>
            <div className={s.big}>
              <Ticker value={sm.branches_per_cell.mean} format={(v) => v.toFixed(1)} />
              <small>branches / cell</small>
            </div>
            <Spark values={result.cells.map((c) => c.branches)} color="var(--junction)" />
          </div>
          <div className={s.cardSub}>
            {sm.junction_count} junctions · {sm.endpoint_count} tips
          </div>
          <Stats sum={sm.branches_per_cell} d={2} />
        </>,
      )}
      {card(
        3,
        'var(--prediction)',
        'Branch angle distribution',
        <>
          <div className={s.cardMain} style={{ alignItems: 'center' }}>
            <div>
              <div className={s.big}>
                <Ticker value={sm.angle_deg.median} format={(v) => v.toFixed(0)} />
                <small>° median</small>
              </div>
              <div className={s.cardSub} style={{ marginTop: 6 }}>
                spread {result.nti.inputs.angle_dispersion_deg.toFixed(0)}°
                <br />n = {sm.angle_deg.n} angles
              </div>
            </div>
            <Polar series={[{ label: 'orientation', color: 'var(--prediction)', values: result.neurites.map((b) => b.orientation_deg) }]} size={112} bins={12} />
          </div>
          <Stats sum={sm.angle_deg} d={0} />
        </>,
      )}
      {card(
        4,
        'var(--soma)',
        'Soma morphology',
        <>
          <div className={s.cardMain}>
            <div className={s.big}>
              <Ticker value={sm.cell_count} />
              <small>somata</small>
            </div>
          </div>
          <div className={s.cardSub}>
            circularity {sm.soma_circularity.mean.toFixed(2)} · {result.cells.filter((c) => c.outlier).length} QC outliers
          </div>
          <Histogram series={[{ label: 'area', color: '#d9772a', values: result.cells.map((c) => areaVal(c.area_px, um)) }]} width={266} height={90} bins={14} unit={areaUnit(um)} format={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))} />
          <Stats sum={sm.soma_area_px} conv={(v) => areaVal(v, um)} d={um ? 1 : 0} />
        </>,
      )}
    </div>
  )
}

export const ExportIcons = { ImageIcon }
