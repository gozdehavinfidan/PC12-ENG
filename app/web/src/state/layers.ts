import { create } from 'zustand'

/** Everything is a layer (CLAUDE.md s5.2, napari/ilastik pattern). */
export type LayerId =
  | 'raw'
  | 'uncertainty'
  | 'soma'
  | 'neurite'
  | 'skeleton'
  | 'area'
  | 'junctions'
  | 'angles'
  | 'outliers'
  | 'labels'

export type Colormap = 'native' | 'gray' | 'green' | 'magma' | 'inverted'

export interface LayerState {
  id: LayerId
  name: string
  hint: string
  color: string
  visible: boolean
  opacity: number
  kind: 'image' | 'mask' | 'overlay' | 'dom'
}

export interface RawAdjust {
  colormap: Colormap
  level: number // window centre, 0..1
  width: number // window width, 0..1
  gamma: number
  contrast: number
  unsharp: number
  clahe: boolean
}

const DEFAULT_LAYERS: LayerState[] = [
  { id: 'raw', name: 'Micrograph', hint: 'Raw image · window/level, colormap, filters', color: '#9ea3c0', visible: true, opacity: 1, kind: 'image' },
  { id: 'uncertainty', name: 'Uncertainty', hint: 'Where the segmentation is least sure', color: '#6d8bff', visible: false, opacity: 0.85, kind: 'mask' },
  { id: 'soma', name: 'Soma mask', hint: 'Cell bodies · NTI parameter 4', color: '#ffb86c', visible: true, opacity: 0.8, kind: 'mask' },
  { id: 'neurite', name: 'Neurite mask', hint: 'Neurites · NTI parameter 1', color: '#8be9fd', visible: true, opacity: 0.7, kind: 'mask' },
  { id: 'skeleton', name: 'Skeleton', hint: 'Centre-lines used for length', color: '#f1f1ec', visible: false, opacity: 0.9, kind: 'mask' },
  { id: 'area', name: 'Soma area class', hint: 'Small / medium / large (per-image tertiles)', color: '#50fa7b', visible: false, opacity: 0.85, kind: 'overlay' },
  { id: 'junctions', name: 'Junctions & tips', hint: 'Branch points · NTI parameter 2', color: '#ff79c6', visible: true, opacity: 1, kind: 'overlay' },
  { id: 'angles', name: 'Branch angles', hint: 'Direction arrows at junctions · NTI parameter 3', color: '#f1fa8c', visible: false, opacity: 0.95, kind: 'overlay' },
  { id: 'outliers', name: 'QC outliers', hint: 'Robust median+MAD flag — not a toxicity call', color: '#ff5555', visible: true, opacity: 1, kind: 'overlay' },
  { id: 'labels', name: 'Cell numbers', hint: 'Numbered somata', color: '#f1f1ec', visible: true, opacity: 1, kind: 'dom' },
]

interface LayersStore {
  layers: LayerState[]
  solo: LayerId | null
  raw: RawAdjust
  toggle: (id: LayerId) => void
  setOpacity: (id: LayerId, v: number) => void
  setSolo: (id: LayerId | null) => void
  move: (from: number, to: number) => void
  setRaw: (patch: Partial<RawAdjust>) => void
  resetRaw: () => void
  isVisible: (id: LayerId) => boolean
}

const DEFAULT_RAW: RawAdjust = { colormap: 'native', level: 0.5, width: 1, gamma: 1, contrast: 1, unsharp: 0, clahe: false }

export const useLayers = create<LayersStore>((set, get) => ({
  layers: DEFAULT_LAYERS,
  solo: null,
  raw: DEFAULT_RAW,
  toggle: (id) => set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)), solo: s.solo === id ? null : s.solo })),
  setOpacity: (id, v) => set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, opacity: v } : l)) })),
  setSolo: (id) => set((s) => ({ solo: s.solo === id ? null : id })),
  move: (from, to) =>
    set((s) => {
      const next = [...s.layers]
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      return { layers: next }
    }),
  setRaw: (patch) => set((s) => ({ raw: { ...s.raw, ...patch } })),
  resetRaw: () => set({ raw: DEFAULT_RAW }),
  isVisible: (id) => {
    const s = get()
    if (s.solo) return s.solo === id || id === 'raw'
    return !!s.layers.find((l) => l.id === id)?.visible
  },
}))

/** effective visibility honouring solo (raw stays as context under a solo layer) */
export function effectiveVisible(layers: LayerState[], solo: LayerId | null, id: LayerId) {
  if (solo) return solo === id || (id === 'raw' && solo !== 'raw')
  return !!layers.find((l) => l.id === id)?.visible
}
