import { create } from 'zustand'
import {
  awaitPreview,
  clone,
  preprocApi,
  same,
  type ParamValue,
  type Params,
  type PreprocState,
  type PreviewEvent,
} from '../api/preproc'
import { useApp } from './app'

export type PreviewMode = 'preview' | 'try_all'

interface PreprocStore {
  server: PreprocState | null
  draft: Params | null
  presetName: string
  loadError: string | null
  /** region per image (x, y, w, h in image px); null = centre crop */
  roi: Record<string, [number, number, number, number] | null>
  roiSize: number
  preview: PreviewEvent | null
  tryAll: PreviewEvent | null
  busy: PreviewMode | null
  error: string | null
  applying: boolean

  load: () => Promise<void>
  set: (section: string, key: string, value: ParamValue) => void
  usePreset: (name: string) => void
  reset: () => void
  setRoi: (imageId: string, roi: [number, number, number, number] | null) => void
  setRoiSize: (n: number) => void
  request: (imageId: string, mode: PreviewMode) => void
  apply: () => Promise<void>
  savePreset: (name: string) => Promise<void>
  deletePreset: (name: string) => Promise<void>
}

const ctrl: Record<PreviewMode, AbortController | null> = { preview: null, try_all: null }
const timer: Record<PreviewMode, ReturnType<typeof setTimeout> | undefined> = { preview: undefined, try_all: undefined }

export const usePreproc = create<PreprocStore>((set, get) => ({
  server: null,
  draft: null,
  presetName: 'default',
  loadError: null,
  roi: {},
  roiSize: 1024,
  preview: null,
  tryAll: null,
  busy: null,
  error: null,
  applying: false,

  load: async () => {
    try {
      const st = await preprocApi.get()
      set((s) => ({
        server: st,
        loadError: null,
        // keep an unsaved draft across screen switches
        draft: s.draft ?? clone(st.params),
        presetName: s.draft ? s.presetName : st.preset,
      }))
    } catch (e) {
      set({ loadError: (e as Error).message })
    }
  },

  set: (section, key, value) =>
    set((s) => {
      if (!s.draft) return s
      const d = clone(s.draft)
      d[section] = { ...d[section], [key]: value }
      return { draft: d }
    }),

  usePreset: (name) => {
    const p = get().server?.presets.find((x) => x.name === name)
    if (p) set({ draft: clone(p.params), presetName: p.name })
  },

  reset: () => {
    const st = get().server
    if (st) set({ draft: clone(st.defaults), presetName: 'default' })
  },

  setRoi: (imageId, roi) => set((s) => ({ roi: { ...s.roi, [imageId]: roi } })),
  setRoiSize: (n) => set({ roiSize: n }),

  /** Debounced: the newest request supersedes older ones client- and server-side. */
  request: (imageId, mode) => {
    clearTimeout(timer[mode])
    timer[mode] = setTimeout(async () => {
      const { draft, roi, roiSize } = get()
      if (!draft) return
      ctrl[mode]?.abort()
      const c = new AbortController()
      ctrl[mode] = c
      set({ busy: mode, error: null })
      const meta = useApp.getState().images[imageId]
      let r = roi[imageId] ?? null
      if (!r && meta?.width && meta?.height) {
        const w = Math.min(roiSize, meta.width)
        const h = Math.min(roiSize, meta.height)
        r = [Math.round((meta.width - w) / 2), Math.round((meta.height - h) / 2), w, h]
      }
      try {
        const { job_id } = await preprocApi.preview(imageId, draft, r, mode)
        const ev = await awaitPreview(job_id, c.signal)
        if (ctrl[mode] !== c) return
        set(mode === 'preview' ? { preview: ev, busy: null } : { tryAll: ev, busy: null })
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ctrl[mode] !== c) return
        set({ busy: null, error: (e as Error).message })
      }
    }, 260)
  },

  apply: async () => {
    const { draft, presetName, server } = get()
    if (!draft || !server) return
    set({ applying: true })
    try {
      const name = server.presets.some((p) => p.name === presetName && same(p.params, draft)) ? presetName : 'custom'
      const r = await preprocApi.apply(name, draft)
      set({ server: { ...server, preset: r.preset, params: r.params, hash: r.hash, version: r.version, stale: r.stale }, presetName: r.preset })
      useApp.getState().toast({
        tone: 'ok',
        title: `Pipeline updated · preset “${r.preset}”`,
        body: r.stale
          ? `${r.stale} analysed image${r.stale === 1 ? ' was' : 's were'} made with older settings.`
          : 'Every later analysis uses these filters and thresholds.',
        action: r.stale
          ? {
              label: `Re-analyse ${r.stale}`,
              run: () =>
                preprocApi
                  .reanalyse('stale')
                  .then((q) => useApp.getState().toast({ tone: 'info', title: `${q.queued} images queued`, body: 'Background workers; the UI stays live.' })),
            }
          : undefined,
      })
    } catch (e) {
      useApp.getState().toast({ tone: 'bad', title: 'Could not apply settings', body: (e as Error).message })
    } finally {
      set({ applying: false })
    }
  },

  savePreset: async (name) => {
    const { draft } = get()
    if (!draft) return
    try {
      const p = await preprocApi.savePreset(name, draft)
      await get().load()
      set({ presetName: p.name })
      useApp.getState().toast({ tone: 'ok', title: `Preset “${p.name}” saved` })
    } catch (e) {
      useApp.getState().toast({ tone: 'bad', title: 'Could not save preset', body: (e as Error).message })
    }
  },

  deletePreset: async (name) => {
    try {
      await preprocApi.deletePreset(name)
      await get().load()
      if (get().presetName === name) set({ presetName: 'custom' })
    } catch (e) {
      useApp.getState().toast({ tone: 'bad', title: 'Could not delete preset', body: (e as Error).message })
    }
  },
}))
