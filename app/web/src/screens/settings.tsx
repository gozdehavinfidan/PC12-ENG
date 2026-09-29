import { Cpu, Gauge, Keyboard, Palette, Ruler, ShieldCheck, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Health } from '../api/types'
import { Button, Dot, Kbd, Switch } from '../components/ui'
import { useApp } from '../state/app'
import { SHORTCUTS, ThemeToggle } from '../shell/shell'
import { useTheme, type ThemeMode } from '../state/theme'
import { Segmented } from '../components/ui'
import s from './screens.module.css'

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className={s.panelCard} style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>
      {children}
    </section>
  )
}

function ThemeMode() {
  const mode = useTheme((st) => st.mode)
  const setMode = useTheme((st) => st.setMode)
  return (
    <Segmented<ThemeMode>
      value={mode}
      onChange={setMode}
      options={[
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'system', label: 'System' },
      ]}
    />
  )
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px dashed var(--line-1)', fontSize: 13.5 }}>
    <span className="muted">{k}</span>
    <span className="mono" style={{ textAlign: 'right', minWidth: 0 }}>
      {v}
    </span>
  </div>
)

export function Settings() {
  const [h, setH] = useState<Health | null>(null)
  const backendUp = useApp((st) => st.backendUp)
  const prefs = useApp((st) => st.prefs)
  const selected = useApp((st) => st.selected)
  const meta = useApp((st) => (selected ? st.images[selected] : undefined))
  const [external, setExternal] = useState<number | null>(null)
  const [cal, setCal] = useState('')

  useEffect(() => {
    api.health().then(setH).catch(() => setH(null))
    // offline audit: count resources loaded from anywhere but this machine
    const n = performance.getEntriesByType('resource').filter((e) => {
      try {
        const u = new URL(e.name)
        return !['localhost', '127.0.0.1', ''].includes(u.hostname) && u.protocol !== 'data:' && u.protocol !== 'blob:'
      } catch {
        return false
      }
    }).length
    setExternal(n)
  }, [])

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Settings &amp; runtime</h1>
          <div className={s.pageSub}>IntelliCell runs entirely on this computer: React UI ↔ FastAPI on localhost ↔ pipeline workers (ONNX CPU when the model lands).</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        <Card icon={<Cpu size={18} />} title="Pipeline">
          <Row k="backend" v={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Dot color={backendUp ? 'var(--ok)' : 'var(--bad)'} /> {backendUp ? 'connected' : 'offline'}</span>} />
          <Row k="model version" v={h?.model.version ?? '—'} />
          <Row k="provider" v={h?.model.provider ?? '—'} />
          <Row k="runtime" v={h?.model.runtime ?? '—'} />
          <Row k="workers" v={h ? `${h.model.workers.interactive} interactive + ${h.model.workers.background} background` : '—'} />
          <Row k="warm-up" v={h?.model.warm_ms != null ? `${h.model.warm_ms} ms` : '—'} />
          <Row k="data folder" v={<span title={h?.data_dir} style={{ display: 'block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'right' }}>{h?.data_dir ?? '—'}</span>} />
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--warn)', background: 'color-mix(in oklab, var(--warn) 10%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--warn) 40%, transparent)' }}>
            <b>Mock pipeline.</b> Classical-CV placeholder until the trained model is exported to ONNX.
          </div>
        </Card>

        <Card icon={<WifiOff size={18} />} title="Offline guarantee">
          <Row k="external requests this session" v={external == null ? '—' : <span style={{ color: external === 0 ? 'var(--ok)' : 'var(--bad)' }}>{external}</span>} />
          <Row k="fonts" v="Geist + Geist Mono, bundled" />
          <Row k="3D engine / charts" v="three.js, d3 — bundled" />
          <Row k="inference" v="Python worker (never in the browser)" />
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
            No CDN, no telemetry, no API docs from the web — the whole app is a static bundle served from localhost.
          </p>
        </Card>

        <Card icon={<Ruler size={18} />} title="Calibration">
          <Row k="image" v={meta?.name ?? 'select an image in Analyze'} />
          <Row k="µm / px (CZI metadata)" v={meta?.um_per_px != null ? meta.um_per_px.toFixed(4) : 'unknown'} />
          <Row k="override" v={selected && prefs.calibration[selected] ? prefs.calibration[selected].toFixed(4) : 'none'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={cal}
              onChange={(e) => setCal(e.target.value)}
              placeholder="µm per pixel, e.g. 0.645"
              style={{ flex: 1, height: 30, padding: '0 10px', borderRadius: 8, background: 'var(--bg-canvas)', border: 0, boxShadow: 'inset 0 0 0 1px var(--line-2)', fontSize: 13.5, outline: 'none' }}
            />
            <Button
              size="sm"
              disabled={!selected || !(parseFloat(cal) > 0)}
              onClick={() => selected && useApp.setState((st) => ({ prefs: { ...st.prefs, calibration: { ...st.prefs.calibration, [selected]: parseFloat(cal) } } }))}
            >
              Apply
            </Button>
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10 }}>
            D5 is open: the metadata scale is shown as <b>[VERIFY]</b> until the department confirms the objective. Overrides only change display units, never the stored px values.
          </p>
        </Card>

        <Card icon={<Palette size={18} />} title="Appearance">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 10px' }}>
            <span style={{ fontSize: 13.5 }}>Theme</span>
            <ThemeMode />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 13.5 }}>Quick toggle</span>
            <ThemeToggle />
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Dark keeps the Dracula-family look of the imaging tools (QuPath, napari); light is for bright rooms and printed screenshots. The micrograph itself is never re-coloured, and the chart palette is validated for both surfaces. <b>Shift+D</b> toggles anywhere.
          </p>
        </Card>

        <Card icon={<Gauge size={18} />} title="Motion & accessibility">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontSize: 13.5 }}>Uncertainty flicker animation</span>
            <Switch on={prefs.flicker} onChange={(v) => useApp.setState((st) => ({ prefs: { ...st.prefs, flicker: v } }))} label="Flicker" />
          </div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
            The OS “reduce motion” setting is honoured everywhere: camera flights, counters, layer-stack and flicker become instant or static. Status colours always come with an icon and a label.
          </p>
        </Card>

        <Card icon={<ShieldCheck size={18} />} title="Honest limits (shown in the UI)">
          <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>NTI is a placeholder formula until fitted — every number carries mock=1.</li>
            <li>Condition distances are descriptive; batch drift can dominate; no p-values.</li>
            <li>Similarity uses morphometric feature vectors — no learned embedding.</li>
            <li>3D is a 2.5D intensity relief of a 2D field, not a Z-stack.</li>
            <li>Only classical filters (CLAHE, contrast, unsharp, gamma) — no GAN enhancement.</li>
          </ul>
        </Card>

        <Card icon={<Keyboard size={18} />} title="Keyboard">
          {SHORTCUTS.slice(0, 10).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5 }}>
              <span className="muted">{k}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {v.map((x) => (
                  <Kbd key={x}>{x}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
