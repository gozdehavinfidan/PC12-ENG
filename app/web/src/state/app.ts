import { create } from 'zustand'
import { api, subscribeGlobal, subscribeJob } from '../api/client'
import type { GlobalEvent, Health, ImageMeta, JobEvent, JobSummary, Result, RoiMetrics, StageCode } from '../api/types'

export type Screen = 'analyze' | 'preprocess' | 'compare' | 'similarity' | 'review' | 'batch' | 'settings'
export type InspectorTab = 'layers' | 'objects' | 'metrics' | 'qc'
export type Tool = 'pan' | 'roi-rect' | 'roi-poly'

export interface StageState {
  state: 'pending' | 'running' | 'done'
  ms?: number
  label?: string
}

export interface LiveJob {
  jobId: string
  imageId: string
  state: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  stages: Record<StageCode, StageState>
  tilesDone: number
  tilesTotal: number
  running: { cells: number; neurite_px: number }
  startedAt: number
  finishedMs?: number
  error?: string
  size?: { w: number; h: number; tile: number }
}

export interface ModelInfo {
  state: 'warming' | 'ready' | 'offline'
  warm_ms: number | null
  version: string
  provider: string
  preset: string
  runtime: string
  workers: { interactive: number; background: number }
}

export interface Toast {
  id: number
  tone: 'info' | 'ok' | 'warn' | 'bad'
  title: string
  body?: string
  action?: { label: string; run: () => void }
}

export interface Roi {
  imageId: string
  polygon: [number, number][]
  metrics?: RoiMetrics
  loading?: boolean
  error?: string
}

type TileListener = (ev: Extract<JobEvent, { type: 'tile' }>) => void

// Tile stream fan-out lives outside React state: tiles are pixels for the GPU,
// not UI state, and must not trigger re-renders.
const tileListeners = new Map<string, Set<TileListener>>()
const tileHistory = new Map<string, Extract<JobEvent, { type: 'tile' }>[]>()

export const tileBus = {
  on(imageId: string, fn: TileListener, replay = true) {
    if (!tileListeners.has(imageId)) tileListeners.set(imageId, new Set())
    tileListeners.get(imageId)!.add(fn)
    if (replay) for (const ev of tileHistory.get(imageId) ?? []) fn(ev)
    return () => tileListeners.get(imageId)?.delete(fn)
  },
  emit(imageId: string, ev: Extract<JobEvent, { type: 'tile' }>) {
    if (!tileHistory.has(imageId)) tileHistory.set(imageId, [])
    tileHistory.get(imageId)!.push(ev)
    tileListeners.get(imageId)?.forEach((fn) => fn(ev))
  },
  clear(imageId: string) {
    tileHistory.delete(imageId)
  },
}

const STAGES: StageCode[] = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']
const freshStages = () =>
  Object.fromEntries(STAGES.map((s) => [s, { state: 'pending' } as StageState])) as Record<StageCode, StageState>

interface AppStore {
  screen: Screen
  images: Record<string, ImageMeta>
  order: string[]
  selected: string | null
  compare: { a: string | null; b: string | null; mode: 'split' | 'swipe'; split: number }
  jobs: Record<string, JobSummary>
  live: Record<string, LiveJob>
  results: Record<string, Result>
  resultVersion: Record<string, number>
  model: ModelInfo
  runtime: { dataDir: string; images: number }
  imageErrors: Record<string, string>
  backendUp: boolean
  inspectorOpen: boolean
  inspectorTab: InspectorTab
  filmstripOpen: boolean
  stack: boolean
  stackDepth: number
  tool: Tool
  roi: Roi | null
  selectedCell: number | null
  hoverCell: number | null
  toasts: Toast[]
  paletteOpen: boolean
  helpOpen: boolean
  exportOpen: boolean
  prefs: { flicker: boolean; calibration: Record<string, number> }

  setScreen: (s: Screen) => void
  select: (id: string | null) => void
  setCompare: (patch: Partial<AppStore['compare']>) => void
  set: (patch: Partial<AppStore>) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  loadResult: (id: string, force?: boolean) => Promise<Result | null>
  analyze: (id: string) => Promise<void>
  cancel: (jobId: string) => Promise<void>
  queueBackground: (ids: string[]) => Promise<void>
  upload: (file: File) => Promise<void>
  umPerPx: (id: string) => number | null
  setCalibration: (id: string, umPerPx: number | null) => void
}

const CAL_KEY = 'camex.calibration'
const OLD_CAL_KEY = 'intellicell.calibration'
function loadCalibration(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(CAL_KEY) ?? localStorage.getItem(OLD_CAL_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && v > 0)) as Record<string, number>
  } catch {
    return {}
  }
}
function saveCalibration(c: Record<string, number>) {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify(c))
  } catch {
    /* storage blocked: calibration stays for this session only */
  }
}

let toastId = 1
function omit<T>(o: Record<string, T>, k: string): Record<string, T> {
  if (!(k in o)) return o
  const { [k]: _drop, ...rest } = o
  return rest
}
let pendingSeq = 1
const inflight = new Map<string, Promise<Result | null>>()
const fetchGen = new Map<string, number>() // newest result request per image wins

export const useApp = create<AppStore>((set, get) => ({
  screen: 'analyze',
  images: {},
  order: [],
  selected: null,
  compare: { a: null, b: null, mode: 'split', split: 0.5 },
  jobs: {},
  live: {},
  results: {},
  resultVersion: {},
  model: { state: 'warming', warm_ms: null, version: '—', provider: '—', preset: '—', runtime: '—', workers: { interactive: 0, background: 0 } },
  runtime: { dataDir: '—', images: 0 },
  imageErrors: {},
  backendUp: false,
  inspectorOpen: true,
  inspectorTab: 'metrics',
  filmstripOpen: true,
  stack: false,
  stackDepth: 1,
  tool: 'pan',
  roi: null,
  selectedCell: null,
  hoverCell: null,
  toasts: [],
  paletteOpen: false,
  helpOpen: false,
  exportOpen: false,
  prefs: { flicker: false, calibration: loadCalibration() },

  setScreen: (screen) => set({ screen, tool: 'pan' }),
  select: (id) => {
    if (id === get().selected) return
    set({ selected: id, selectedCell: null, roi: null, stack: false })
    // only ask for a result the server has (no 404 noise for unanalysed images)
    if (id && get().images[id]?.has_result !== false) void get().loadResult(id)
  },
  setCompare: (patch) => {
    set((s) => ({ compare: { ...s.compare, ...patch } }))
    const { a, b } = get().compare
    if (a) void get().loadResult(a)
    if (b) void get().loadResult(b)
  },
  set: (patch) => set(patch),
  toast: (t) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => get().dismiss(id), t.action ? 15000 : t.tone === 'bad' ? 9000 : 5200)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  loadResult: async (id, force = false) => {
    const have = get().results[id]
    if (have && !force) return have
    if (!force && inflight.has(id)) return inflight.get(id)!
    const gen = (fetchGen.get(id) ?? 0) + 1
    fetchGen.set(id, gen)
    const p = api
      .result(id)
      .then((r) => {
        if (fetchGen.get(id) !== gen) return get().results[id] ?? r // a newer request superseded this one
        set((s) => ({ results: { ...s.results, [id]: r }, resultVersion: { ...s.resultVersion, [id]: (s.resultVersion[id] ?? 0) + 1 } }))
        return r
      })
      .catch(() => null)
      .finally(() => {
        if (fetchGen.get(id) === gen) inflight.delete(id)
      })
    inflight.set(id, p)
    return p
  },

  analyze: async (id) => {
    const prev = get().live[id]
    // claim the image immediately: events of the old job are rejected from now
    // on, so none of its tiles can refill the history while /infer is pending
    const claim = `pending-${pendingSeq++}`
    set((s) => ({ live: { ...s.live, [id]: { ...(prev ?? ({} as LiveJob)), jobId: claim, imageId: id, state: 'queued', stages: freshStages(), tilesDone: 0, tilesTotal: 0, running: { cells: 0, neurite_px: 0 }, startedAt: performance.now() } } }))
    tileBus.clear(id)
    let jobId: string
    try {
      jobId = (await api.infer(id)).job_id
    } catch (e) {
      set((s) => (s.live[id]?.jobId === claim ? { live: { ...s.live, [id]: { ...s.live[id], state: 'failed' } } } : {}))
      get().toast({ tone: 'bad', title: 'Could not start analysis', body: String((e as Error).message) })
      return
    }
    if (get().live[id]?.jobId !== claim) return // an even newer analyze() call took over
    tileBus.clear(id)
    if (prev && prev.state === 'running') {
      get().toast({ tone: 'info', title: 'Previous run superseded', body: 'A new analysis of the same image replaces the old job.' })
    }
    const live: LiveJob = {
      jobId,
      imageId: id,
      state: 'queued',
      stages: freshStages(),
      tilesDone: 0,
      tilesTotal: 0,
      running: { cells: 0, neurite_px: 0 },
      startedAt: performance.now(),
    }
    set((s) => ({ live: { ...s.live, [id]: live } }))
    const patch = (fn: (l: LiveJob) => Partial<LiveJob>) =>
      set((s) => {
        const cur = s.live[id]
        if (!cur || cur.jobId !== jobId) return {}
        return { live: { ...s.live, [id]: { ...cur, ...fn(cur) } } }
      })
    let lastResult: Result | null = null
    subscribeJob(jobId, (ev) => {
      const cur = get().live[id]
      if (!cur || cur.jobId !== jobId) return
      // after a terminal state, a reconnect replay must not rewind anything
      if (cur.state === 'done' || cur.state === 'failed' || cur.state === 'cancelled') return
      switch (ev.type) {
        case 'started':
          patch(() => ({ state: 'running' }))
          break
        case 'stage':
          patch((l) => ({ stages: { ...l.stages, [ev.stage]: { state: ev.state, ms: ev.ms, label: ev.label } } }))
          break
        case 'meta':
          patch(() => ({ size: { w: ev.width, h: ev.height, tile: ev.tile } }))
          break
        case 'tile':
          if (ev.i < cur.tilesDone) break // duplicate delivered by an SSE reconnect
          tileBus.emit(id, ev)
          patch(() => ({ tilesDone: ev.i + 1, tilesTotal: ev.n, running: ev.running }))
          break
        case 'result':
          // the 2 MB JSON parse already cost this task; render in the next one
          // so neither crosses the 50 ms long-task line on big fields
          lastResult = ev.result
          setTimeout(() => {
            if (get().live[id]?.jobId !== jobId) return // superseded before the commit
            set((s) => ({
              results: { ...s.results, [id]: ev.result },
              resultVersion: { ...s.resultVersion, [id]: (s.resultVersion[id] ?? 0) + 1 },
            }))
          })
          break
        case 'done': {
          const ms = performance.now() - cur.startedAt
          setTimeout(() => patch(() => ({ state: 'done', finishedMs: ms })), 16)
          const r = lastResult
          get().toast({
            tone: 'ok',
            title: `${get().images[id]?.name ?? id} analysed`,
            body: r ? `${r.summary.cell_count} cells · NTI ${r.nti.score == null ? 'n/a' : r.nti.score.toFixed(2)} · ${(ms / 1000).toFixed(1)} s` : undefined,
          })
          break
        }
        case 'cancelled':
          patch(() => ({ state: 'cancelled' }))
          if (ev.reason !== 'superseded') get().toast({ tone: 'warn', title: 'Analysis cancelled' })
          break
        case 'error':
          patch(() => ({ state: 'failed', error: ev.message }))
          get().toast({ tone: 'bad', title: 'Analysis failed', body: ev.message })
          break
      }
    })
  },

  cancel: async (jobId) => {
    await api.cancel(jobId).catch(() => undefined)
  },

  // Fire-and-forget batch queue: progress arrives over the global feed, so no
  // per-job EventSource is opened (browsers cap concurrent SSE connections).
  queueBackground: async (ids) => {
    const results = await Promise.allSettled(ids.map((id) => api.infer(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    get().toast(
      failed
        ? { tone: 'warn', title: `Queued ${ids.length - failed} of ${ids.length} images`, body: `${failed} could not be queued.` }
        : { tone: 'info', title: `Queued ${ids.length} image${ids.length === 1 ? '' : 's'}`, body: 'Running in the background — the app stays free.' },
    )
  },

  upload: async (file) => {
    get().toast({ tone: 'info', title: `Uploading ${file.name}`, body: 'Decoding on the server — the UI stays live.' })
    try {
      const meta = await api.upload(file)
      set((s) => ({
        images: { ...s.images, [meta.id]: meta },
        order: s.order.includes(meta.id) ? s.order : [...s.order, meta.id],
      }))
      set({ screen: 'analyze' })
      get().select(meta.id)
      await get().analyze(meta.id)
    } catch (e) {
      get().toast({ tone: 'bad', title: 'Upload failed', body: String((e as Error).message) })
    }
  },

  umPerPx: (id) => get().prefs.calibration[id] ?? get().images[id]?.um_per_px ?? null,

  setCalibration: (id, v) => {
    const cal = { ...get().prefs.calibration }
    if (v != null && v > 0) cal[id] = v
    else delete cal[id]
    saveCalibration(cal)
    set((s) => ({ prefs: { ...s.prefs, calibration: cal } }))
  },
}))

// ------------------------------------------------------------ bootstrapping
function applyHealth(h: Health) {
  useApp.setState({
    model: {
      state: h.model.state,
      warm_ms: h.model.warm_ms,
      version: h.model.version,
      provider: h.model.provider,
      preset: h.model.preset,
      runtime: h.model.runtime,
      workers: h.model.workers,
    },
    runtime: { dataDir: h.data_dir, images: h.images },
  })
}

export function startBackendSync() {
  const st = useApp.getState
  const refresh = () =>
    api
      .images()
      .then((list) => {
        const images: Record<string, ImageMeta> = {}
        for (const m of list) images[m.id] = m
        useApp.setState({ images, order: list.map((m) => m.id) })
        const s = st()
        if (!s.compare.a || !s.compare.b) {
          const done = list.filter((m) => m.has_result && !m.variant)
          if (done.length >= 2) s.setCompare({ a: s.compare.a ?? done[0].id, b: s.compare.b ?? done[Math.min(done.length - 1, 12)].id })
        }
      })
      .catch(() => undefined)
  api
    .health()
    .then(applyHealth)
    .catch(() => undefined)
  void refresh()
  api
    .jobs()
    .then((js) => useApp.setState({ jobs: Object.fromEntries(js.map((j) => [j.id, j])) }))
    .catch(() => undefined)

  return subscribeGlobal(
    (ev: GlobalEvent) => {
      if (ev.type === 'image_error') {
        useApp.setState((s) => ({ imageErrors: { ...s.imageErrors, [ev.image_id]: ev.message } }))
        const name = st().images[ev.image_id]?.name ?? ev.image_id
        st().toast({ tone: 'bad', title: `Could not prepare ${name}`, body: ev.message })
      }
      if (ev.type === 'model') useApp.setState((s) => ({ model: { ...s.model, state: ev.state, warm_ms: ev.warm_ms } }))
      if (ev.type === 'preproc') useApp.setState((s) => ({ model: { ...s.model, preset: ev.preset, version: ev.version } }))
      if (ev.type === 'job') useApp.setState((s) => ({ jobs: { ...s.jobs, [ev.job.id]: ev.job } }))
      if (ev.type === 'image' && ev.image) {
        const prev = st().images[ev.image.id]
        useApp.setState((s) => ({
          images: { ...s.images, [ev.image.id]: ev.image },
          imageErrors: omit(s.imageErrors, ev.image.id),
          order: s.order.includes(ev.image.id) ? s.order : [...s.order, ev.image.id],
        }))
        // a background job refreshed this image's result -> reload if shown
        if (ev.image.has_result && prev && st().results[ev.image.id] && !st().live[ev.image.id]) {
          if (prev.nti !== ev.image.nti) void st().loadResult(ev.image.id, true)
        }
      }
    },
    (up) => {
      const was = st().backendUp
      useApp.setState({ backendUp: up })
      if (up && !was) void refresh()
      if (!up) useApp.setState((s) => ({ model: { ...s.model, state: 'offline' } }))
      else api.health().then(applyHealth).catch(() => undefined)
    },
  )
}
