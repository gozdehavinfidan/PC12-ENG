// Preprocessing contract (server/preproc.py + /api/preproc*). The schema comes
// from the server, so the Preprocess screen renders whatever filters it lists.

export type FieldKind = 'select' | 'number' | 'bool'
export type ParamValue = string | number | boolean
export type Params = Record<string, Record<string, ParamValue>>

export interface SchemaField {
  key: string
  label: string
  kind: FieldKind
  default: ParamValue
  options?: [string, string][]
  min?: number
  max?: number
  step?: number
  show?: Record<string, ParamValue[]>
  help?: string
  doc?: string
  docs?: Record<string, string>
}

export interface SchemaSection {
  id: string
  title: string
  doc: string | null
  help: string
  fields: SchemaField[]
}

export interface Preset {
  name: string
  builtin: boolean
  params: Params
}

export interface PreprocState {
  preset: string
  params: Params
  hash: string
  version: string
  schema: SchemaSection[]
  defaults: Params
  presets: Preset[]
  stale: number
}

export interface Hist {
  lo: number
  hi: number
  counts: number[]
  threshold: number
  low?: number | null
  local?: boolean
}

export interface PreviewEvent {
  type: 'preview'
  mode: 'preview' | 'try_all'
  roi: [number, number, number, number]
  image_size: [number, number]
  warnings: string[]
  raw: string
  filtered: string
  overlay?: string
  uncertainty?: string
  hist?: { soma: Hist; neurite: Hist }
  stats?: {
    soma_count: number
    soma_px: number
    neurite_px: number
    skeleton_px: number
    fg_ratio: number
    um_per_px: number | null
  }
  grid?: { method: string; threshold: number | null; error: string | null; png?: string; fg_ratio?: number }[]
  ms: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) msg = String(body.detail)
    } catch {
      /* not json */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

const post = (url: string, body: unknown, method = 'POST') =>
  fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const preprocApi = {
  get: () => fetch('/api/preproc').then(json<PreprocState>),
  apply: (preset: string, params: Params) =>
    post('/api/preproc', { preset, params }, 'PUT').then(json<{ preset: string; params: Params; hash: string; version: string; stale: number }>),
  savePreset: (name: string, params: Params) => post('/api/preproc/presets', { name, params }).then(json<Preset>),
  deletePreset: (name: string) =>
    fetch(`/api/preproc/presets/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(json<{ deleted: boolean }>),
  preview: (image_id: string, params: Params, roi: number[] | null, mode: 'preview' | 'try_all') =>
    post('/api/preproc/preview', { image_id, params, roi, mode }).then(json<{ job_id: string }>),
  reanalyse: (scope: 'stale' | 'pending' | 'all') => post('/api/reanalyse', { scope }).then(json<{ queued: number }>),
}

/** One preview job: resolves with its preview event, rejects on error/cancel. */
export function awaitPreview(jobId: string, signal: AbortSignal): Promise<PreviewEvent> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/events?job_id=${encodeURIComponent(jobId)}`)
    let got: PreviewEvent | null = null
    const stop = () => es.close()
    signal.addEventListener('abort', () => {
      stop()
      reject(new DOMException('superseded', 'AbortError'))
    })
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data)
      if (ev.type === 'preview') got = ev as PreviewEvent
      else if (ev.type === 'done') {
        stop()
        if (got) resolve(got)
        else reject(new Error('preview finished without output'))
      } else if (ev.type === 'error') {
        stop()
        reject(new Error(ev.message))
      } else if (ev.type === 'cancelled') {
        stop()
        reject(new DOMException('superseded', 'AbortError'))
      }
    }
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED && !got) reject(new Error('preview stream closed'))
    }
  })
}

/** Is a field visible given its section's current values? */
export function visible(f: SchemaField, sec: Record<string, ParamValue>): boolean {
  if (!f.show) return true
  return Object.entries(f.show).every(([k, vals]) => vals.includes(sec[k]))
}

export const clone = (p: Params): Params => JSON.parse(JSON.stringify(p))
export const same = (a: Params | null, b: Params | null) => JSON.stringify(a) === JSON.stringify(b)
