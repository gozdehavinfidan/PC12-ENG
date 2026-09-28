import type {
  GlobalEvent,
  Health,
  ImageMeta,
  JobEvent,
  JobSummary,
  Result,
  ReviewItem,
  RoiMetrics,
  Similarity,
} from './types'

// Same origin in production (FastAPI serves the static build); Vite proxies
// /api in development. Nothing ever leaves localhost.
const BASE = ''

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

export const api = {
  health: () => fetch(`${BASE}/api/health`).then(json<Health>),
  images: () => fetch(`${BASE}/api/images`).then(json<ImageMeta[]>),
  image: (id: string) => fetch(`${BASE}/api/images/${id}`).then(json<ImageMeta>),
  setCondition: (id: string, condition: string) =>
    fetch(`${BASE}/api/images/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ condition }),
    }).then(json<ImageMeta>),
  result: (id: string) => fetch(`${BASE}/api/results/${id}`).then(json<Result>),
  infer: (image_id: string) =>
    fetch(`${BASE}/api/infer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_id }),
    }).then(json<{ job_id: string; image_id: string }>),
  cancel: (jobId: string) =>
    fetch(`${BASE}/api/jobs/${jobId}`, { method: 'DELETE' }).then(json<{ cancelled: boolean }>),
  jobs: () => fetch(`${BASE}/api/jobs`).then(json<JobSummary[]>),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/api/upload`, { method: 'POST', body: fd }).then(json<ImageMeta>)
  },
  roi: (image_id: string, polygon: [number, number][]) =>
    fetch(`${BASE}/api/roi`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_id, polygon }),
    }).then(json<RoiMetrics>),
  similarity: () => fetch(`${BASE}/api/similarity`).then(json<Similarity>),
  reviewQueue: () => fetch(`${BASE}/api/review/queue`).then(json<ReviewItem[]>),
  label: (id: string) =>
    fetch(`${BASE}/api/label/${id}`).then(
      json<{ status: string; has_annotation: boolean; issues?: string[]; note?: string; saved?: string }>,
    ),
  saveLabel: (id: string, status: string, issues: string[], note: string, png?: Blob) => {
    const fd = new FormData()
    fd.append('status', status)
    fd.append('issues', JSON.stringify(issues))
    fd.append('note', note)
    if (png) fd.append('annotation', png, `${id}_seg.png`)
    return fetch(`${BASE}/api/label/${id}`, { method: 'POST', body: fd }).then(json<Record<string, unknown>>)
  },
}

export const urls = {
  raw: (id: string) => `${BASE}/api/images/${id}/raw.png`,
  thumb: (id: string) => `${BASE}/api/images/${id}/thumb.png`,
  clahe: (id: string) => `${BASE}/api/images/${id}/clahe.png`,
  layer: (id: string, name: 'masks' | 'skeleton' | 'labels', v = '') =>
    `${BASE}/api/layers/${id}/${name}.png${v ? `?v=${v}` : ''}`,
  export: (id: string, kind: 'cells.csv' | 'neurites.csv' | 'report.txt') => `${BASE}/api/export/${id}/${kind}`,
  annotation: (id: string) => `${BASE}/api/label/${id}/annotation.png?t=${Date.now()}`,
}

/** Subscribe to one job's SSE stream. Returns an unsubscribe function. */
export function subscribeJob(jobId: string, onEvent: (ev: JobEvent) => void): () => void {
  const es = new EventSource(`${BASE}/api/events?job_id=${encodeURIComponent(jobId)}`)
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data) as JobEvent
    onEvent(ev)
    if (ev.type === 'done' || ev.type === 'error' || ev.type === 'cancelled') es.close()
  }
  es.onerror = () => {
    // the server closes the stream after the terminal event; a real network
    // error leaves readyState CLOSED as well — the job store polls to recover
    if (es.readyState === EventSource.CLOSED) es.close()
  }
  return () => es.close()
}

/** Global feed: job lifecycle, image readiness, model warm-up. Auto-reconnects. */
export function subscribeGlobal(onEvent: (ev: GlobalEvent) => void, onStatus?: (up: boolean) => void) {
  let es: EventSource | null = null
  let stopped = false
  let retry = 500
  const open = () => {
    if (stopped) return
    es = new EventSource(`${BASE}/api/events`)
    es.onopen = () => {
      retry = 500
      onStatus?.(true)
    }
    es.onmessage = (m) => onEvent(JSON.parse(m.data) as GlobalEvent)
    es.onerror = () => {
      onStatus?.(false)
      es?.close()
      setTimeout(open, retry)
      retry = Math.min(retry * 2, 8000)
    }
  }
  open()
  return () => {
    stopped = true
    es?.close()
  }
}
