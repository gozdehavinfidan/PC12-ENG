import { Microscope, Play, Search, Square, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { api, urls } from '../api/client'
import type { ImageMeta } from '../api/types'
import { ntiColor } from '../charts/charts'
import { Badge, Button, Dot, Ring, Segmented, Ticker } from '../components/ui'
import { useApp } from '../state/app'
import s from './screens.module.css'

const CONDITIONS = ['unassigned', 'control', 'treated', 'h2o2-100um', 'ngf', 'synthetic-control', 'synthetic-treated']

type Filter = 'all' | 'analysed' | 'pending' | 'warnings'

/** Cohort queue (s18 A10) — the carrier for the filmstrip cache and conditions. */
export function Batch() {
  const images = useApp((st) => st.images)
  const order = useApp((st) => st.order)
  const jobs = useApp((st) => st.jobs)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<{ k: keyof ImageMeta; dir: 1 | -1 }>({ k: 'name', dir: 1 })

  const active = useMemo(() => Object.values(jobs).filter((j) => j.state === 'running' || j.state === 'queued'), [jobs])
  const byImage = useMemo(() => {
    const m: Record<string, (typeof active)[number]> = {}
    for (const j of active) m[j.image_id] = j
    return m
  }, [active])
  const running = active.filter((j) => j.state === 'running')
  const lanes = [
    ...running.filter((j) => j.priority === 'interactive').slice(0, 2),
    ...Array(Math.max(0, 2 - running.filter((j) => j.priority === 'interactive').length)).fill(null),
    ...running.filter((j) => j.priority === 'background').slice(0, 2),
    ...Array(Math.max(0, 2 - running.filter((j) => j.priority === 'background').length)).fill(null),
  ]

  const list = order
    .map((id) => images[id])
    .filter(Boolean)
    .filter((m) => (!q || m.name.toLowerCase().includes(q.toLowerCase()) || (m.condition ?? '').includes(q.toLowerCase())))
    .filter((m) => (filter === 'analysed' ? m.has_result : filter === 'pending' ? !m.has_result : filter === 'warnings' ? (m.qc_warnings ?? 0) > 0 : true))
    .sort((a, b) => {
      const va = a[sort.k] ?? ''
      const vb = b[sort.k] ?? ''
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * sort.dir
    })

  const done = order.filter((id) => images[id]?.has_result)
  const ntis = done.map((id) => images[id].nti ?? 0)
  const meanNti = ntis.length ? ntis.reduce((a, b) => a + b, 0) / ntis.length : 0
  const warn = order.filter((id) => (images[id]?.qc_warnings ?? 0) > 0).length
  const th = (label: string, k: keyof ImageMeta) => (
    <th style={{ cursor: 'pointer', color: sort.k === k ? 'var(--text-1)' : undefined }} onClick={() => setSort((st) => ({ k, dir: st.k === k ? ((-st.dir) as 1 | -1) : 1 }))}>
      {label}
      {sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Batch &amp; cohort</h1>
          <div className={s.pageSub}>Every image is cached once and refreshed in the background — the app never waits for the cohort. Two interactive workers always stay free for the image you drop.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            onClick={() => {
              const pending = order.filter((id) => !images[id]?.has_result).slice(0, 8)
              pending.forEach((id) => void useApp.getState().analyze(id))
            }}
            disabled={order.every((id) => images[id]?.has_result)}
          >
            <Play size={15} /> Analyse pending
          </Button>
        </div>
      </div>

      <div className={s.kpis}>
        {[
          { k: 'Images', v: order.length, d: 0 },
          { k: 'Analysed', v: done.length, d: 0 },
          { k: 'Running / queued', v: active.length, d: 0 },
          { k: 'Mean NTI (mock)', v: meanNti, d: 2 },
          { k: 'QC warnings', v: warn, d: 0 },
        ].map((x, i) => (
          <motion.div key={x.k} className={s.kpi} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <span className="eyebrow">{x.k}</span>
            <b>
              <Ticker value={x.v} format={(v) => v.toFixed(x.d)} />
            </b>
          </motion.div>
        ))}
      </div>

      <div className={s.lanes}>
        {lanes.map((j, i) => (
          <div key={i} className={s.lane}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span className="eyebrow">{i < 2 ? 'Interactive' : 'Background'} worker {(i % 2) + 1}</span>
              <Dot color={j ? 'var(--ok)' : 'var(--text-4)'} pulse={!!j} />
            </div>
            <div className="mono" style={{ fontSize: 13.5, marginTop: 6, color: j ? 'var(--text-1)' : 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {j ? (images[j.image_id]?.name ?? j.image_id) : 'idle'}
            </div>
            <div className={s.laneBar}>
              <span style={{ width: `${(j?.progress ?? 0) * 100}%` }} />
            </div>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>
              {j ? `${j.stage ?? ''} ${j.tiles_total ? `· tile ${j.tiles_done}/${j.tiles_total}` : ''}` : '—'}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 8, background: 'var(--bg-canvas)', boxShadow: 'inset 0 0 0 1px var(--line-2)', width: 280, cursor: 'text' }}>
          <Search size={15} color="var(--text-3)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or condition" style={{ flex: 1, height: '100%', background: 'none', border: 0, outline: 'none', fontSize: 14 }} />
        </label>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${order.length}` },
            { value: 'analysed', label: 'Analysed' },
            { value: 'pending', label: 'Pending' },
            { value: 'warnings', label: 'QC warnings' },
          ]}
        />
        <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
          Conditions feed Compare and the Similarity group distances
        </span>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th style={{ width: 80 }} />
            {th('Image', 'name')}
            {th('Batch', 'batch')}
            {th('Condition', 'condition')}
            {th('Cells', 'cell_count')}
            {th('NTI', 'nti')}
            {th('QC', 'qc_warnings')}
            {th('Review', 'review')}
            <th>State</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((m) => {
            const j = byImage[m.id]
            return (
              <tr key={m.id}>
                <td>{m.pending ? <div className={s.tThumb} /> : <img className={s.tThumb} src={urls.thumb(m.id)} alt="" loading="lazy" />}</td>
                <td className="mono" style={{ fontSize: 13.5 }}>
                  {m.name}
                  {m.variant && (
                    <Badge style={{ marginLeft: 6, height: 18 }} tip="Processed variant of another acquisition (deblur / background subtraction…)">
                      variant
                    </Badge>
                  )}
                </td>
                <td className="mono muted" style={{ fontSize: 13 }}>
                  {m.batch ?? '—'}
                </td>
                <td>
                  <select
                    className={s.select}
                    value={m.condition ?? 'unassigned'}
                    onChange={(e) =>
                      api
                        .setCondition(m.id, e.target.value)
                        .then((meta) => useApp.setState((st) => ({ images: { ...st.images, [m.id]: meta } })))
                        .catch(() => undefined)
                    }
                  >
                    {[...new Set([...CONDITIONS, m.condition ?? 'unassigned'])].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="mono">{m.cell_count ?? '—'}</td>
                <td>
                  {m.nti != null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={s.miniBar}>
                        <span style={{ width: `${m.nti * 100}%`, background: ntiColor(m.nti) }} />
                      </div>
                      <span className="mono" style={{ fontSize: 13 }}>
                        {m.nti.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {(m.qc_warnings ?? 0) > 0 ? (
                    <span style={{ color: 'var(--warn)', fontSize: 13 }}>
                      <TriangleAlert size={14} style={{ verticalAlign: -2 }} /> {m.qc_warnings}
                    </span>
                  ) : m.has_result ? (
                    <span className="muted" style={{ fontSize: 13 }}>
                      ok
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="mono" style={{ fontSize: 13, color: m.review && m.review !== 'pending' ? 'var(--text-1)' : 'var(--text-4)' }}>
                  {m.review ?? '—'}
                </td>
                <td>
                  {j ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <Ring value={j.progress} size={18} /> {j.state === 'queued' ? 'queued' : `${Math.round(j.progress * 100)}%`}
                    </span>
                  ) : m.has_result ? (
                    <span style={{ fontSize: 13, color: 'var(--ok)' }}>● cached</span>
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>
                      {m.pending ? 'preparing' : 'not analysed'}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {j ? (
                    <Button size="sm" variant="danger" onClick={() => void useApp.getState().cancel(j.id)}>
                      <Square size={13} /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const app = useApp.getState()
                        app.setScreen('analyze')
                        app.select(m.id)
                      }}
                    >
                      <Microscope size={14} /> Open
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
