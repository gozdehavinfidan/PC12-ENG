/// <reference lib="webworker" />
// Decode + rasterise off the main thread (CLAUDE.md s4.7): fetching and
// decoding a 2048² PNG, turning a base64 tile into pixels, and drawing
// thousands of overlay primitives all happen here, so pan/zoom never stalls.
// Bitmaps are created vertically flipped (GL texture convention) and
// transferred, not copied.

import type { Result } from '../api/types'

type Req =
  | { type: 'decode'; id: number; url: string; pixels?: boolean }
  | { type: 'tile'; id: number; b64: string }
  | { type: 'overlays'; id: number; result: Pick<Result, 'cells' | 'junctions' | 'endpoints' | 'width' | 'height'> }

const ctx = self as unknown as DedicatedWorkerGlobalScope

async function decode(url: string, pixels: boolean) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  let data: Uint8ClampedArray | undefined
  if (pixels) {
    const up = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    const oc = new OffscreenCanvas(up.width, up.height)
    const c = oc.getContext('2d', { willReadFrequently: true })!
    c.drawImage(up, 0, 0)
    data = c.getImageData(0, 0, up.width, up.height).data
    up.close()
  }
  return { bitmap, w: bitmap.width, h: bitmap.height, data }
}

async function tile(b64: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  })
  return { bitmap, w: bitmap.width, h: bitmap.height }
}

const AREA_COLORS: Record<string, string> = { small: '#50fa7b', medium: '#f1fa8c', large: '#bd93f9' }

function flipped(w: number, h: number) {
  const oc = new OffscreenCanvas(w, h)
  const c = oc.getContext('2d')!
  c.translate(0, h)
  c.scale(1, -1)
  c.lineJoin = 'round'
  c.lineCap = 'round'
  return { oc, c }
}

function overlays(r: Pick<Result, 'cells' | 'junctions' | 'endpoints' | 'width' | 'height'>) {
  const { width: w, height: h } = r

  // soma area classes
  const a = flipped(w, h)
  for (const cell of r.cells) {
    if (cell.contour.length < 3) continue
    a.c.beginPath()
    cell.contour.forEach(([x, y], i) => (i ? a.c.lineTo(x, y) : a.c.moveTo(x, y)))
    a.c.closePath()
    a.c.fillStyle = AREA_COLORS[cell.category] + '99'
    a.c.fill()
    a.c.strokeStyle = AREA_COLORS[cell.category]
    a.c.lineWidth = 1.5
    a.c.stroke()
  }

  // junctions (rings) + tips (dots)
  const j = flipped(w, h)
  j.c.strokeStyle = '#ff79c6'
  j.c.lineWidth = 1.6
  for (const jn of r.junctions) {
    j.c.beginPath()
    j.c.arc(jn.x, jn.y, 4.2, 0, Math.PI * 2)
    j.c.stroke()
  }
  j.c.fillStyle = '#50fa7b'
  for (const [x, y] of r.endpoints) {
    j.c.beginPath()
    j.c.arc(x, y, 2.3, 0, Math.PI * 2)
    j.c.fill()
  }

  // branch angle arrows + arcs
  const g = flipped(w, h)
  g.c.strokeStyle = '#f1fa8c'
  g.c.fillStyle = '#f1fa8c'
  g.c.lineWidth = 1.4
  for (const jn of r.junctions) {
    const dirs = jn.directions_deg
    for (const d of dirs) {
      const rad = (d * Math.PI) / 180
      const ex = jn.x + Math.cos(rad) * 20
      const ey = jn.y - Math.sin(rad) * 20
      g.c.beginPath()
      g.c.moveTo(jn.x, jn.y)
      g.c.lineTo(ex, ey)
      g.c.stroke()
      const ah = 5
      const back = rad + Math.PI
      g.c.beginPath()
      g.c.moveTo(ex, ey)
      g.c.lineTo(ex + Math.cos(back - 0.45) * ah, ey - Math.sin(back - 0.45) * ah)
      g.c.lineTo(ex + Math.cos(back + 0.45) * ah, ey - Math.sin(back + 0.45) * ah)
      g.c.closePath()
      g.c.fill()
    }
    if (dirs.length >= 2) {
      g.c.save()
      g.c.globalAlpha = 0.55
      for (let k = 0; k < dirs.length; k++) {
        const a1 = (-dirs[k] * Math.PI) / 180
        const a2 = (-dirs[(k + 1) % dirs.length] * Math.PI) / 180
        g.c.beginPath()
        g.c.arc(jn.x, jn.y, 9 + (k % 2) * 2.5, a2, a1)
        g.c.stroke()
        if (dirs.length === 2) break
      }
      g.c.restore()
    }
  }

  // QC outliers: dashed red frame
  const o = flipped(w, h)
  o.c.strokeStyle = '#ff5555'
  o.c.lineWidth = 2
  o.c.setLineDash([6, 4])
  for (const cell of r.cells) {
    if (!cell.outlier) continue
    const [x0, y0, x1, y1] = cell.bbox
    o.c.strokeRect(x0 - 7, y0 - 7, x1 - x0 + 14, y1 - y0 + 14)
  }

  return {
    area: a.oc.transferToImageBitmap(),
    junctions: j.oc.transferToImageBitmap(),
    angles: g.oc.transferToImageBitmap(),
    outliers: o.oc.transferToImageBitmap(),
  }
}

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const m = e.data
  try {
    if (m.type === 'decode') {
      const out = await decode(m.url, !!m.pixels)
      const transfer: Transferable[] = [out.bitmap]
      if (out.data) transfer.push(out.data.buffer)
      ctx.postMessage({ id: m.id, ok: true, ...out }, transfer)
    } else if (m.type === 'tile') {
      const out = await tile(m.b64)
      ctx.postMessage({ id: m.id, ok: true, ...out }, [out.bitmap])
    } else if (m.type === 'overlays') {
      const out = overlays(m.result)
      ctx.postMessage({ id: m.id, ok: true, overlays: out }, Object.values(out))
    }
  } catch (err) {
    ctx.postMessage({ id: m.id, ok: false, error: String(err) })
  }
}
