import type { Result } from '../api/types'

// Two decode workers, round-robin: a tile burst never queues behind the
// overlay rasterisation of a large result.
type Pending = { resolve: (v: any) => void; reject: (e: Error) => void }

const workers: Worker[] = []
const pending = new Map<number, Pending>()
let seq = 1
let rr = 0

function pool() {
  if (!workers.length) {
    for (let i = 0; i < 2; i++) {
      const w = new Worker(new URL('../workers/decode.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e) => {
        const p = pending.get(e.data.id)
        if (!p) return
        pending.delete(e.data.id)
        if (e.data.ok) p.resolve(e.data)
        else p.reject(new Error(e.data.error))
      }
      workers.push(w)
    }
  }
  return workers[rr++ % workers.length]
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  const id = seq++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    pool().postMessage({ ...msg, id })
  })
}

export interface Decoded {
  bitmap: ImageBitmap
  w: number
  h: number
  data?: Uint8ClampedArray
}

export const decodeImage = (url: string, pixels = false) => call<Decoded>({ type: 'decode', url, pixels })
export const decodeTile = (b64: string) => call<Decoded>({ type: 'tile', b64 })
export const drawOverlays = (result: Result) =>
  call<{ overlays: Record<'area' | 'junctions' | 'angles' | 'outliers', ImageBitmap> }>({
    type: 'overlays',
    result: {
      cells: result.cells,
      junctions: result.junctions,
      endpoints: result.endpoints,
      width: result.width,
      height: result.height,
    },
  })
