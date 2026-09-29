import * as THREE from 'three'

export type OverlayKey = 'area' | 'junctions' | 'angles' | 'outliers'

/**
 * GPU resources of one image in one viewer.
 *
 * The mask texture is allocated once at full size; each streamed 256² tile is
 * written into its rectangle with copyTextureToTexture (a texSubImage2D of that
 * tile only), so a tile costs ~256 KB of upload instead of re-sending the
 * whole 1920x1080 texture (CLAUDE.md s4.4). tileAge stores when each tile
 * arrived; the shader uses it for the reveal/flare animation.
 */
export class ImageAssets {
  /** full-size uploads wait here and are drained one per frame, so no single
   *  frame pays for ~100 MB of texture upload (s4.8: no long tasks) */
  pending: ((gl: THREE.WebGLRenderer) => void)[] = []
  /** bumped when a new job stream starts: uploads queued for an older
   *  generation are dropped instead of installing stale layers */
  gen = 0

  private enqueue(fn: (gl: THREE.WebGLRenderer) => void, cleanup?: () => void) {
    const g = this.gen
    this.pending.push((gl) => {
      if (g !== this.gen) return cleanup?.()
      fn(gl)
    })
  }

  newGeneration() {
    this.gen++
    this.pending = []
    return this.gen
  }
  raw: THREE.Texture | null = null
  rawPixels: Uint8ClampedArray | null = null
  rawW = 0
  rawH = 0
  masks: THREE.DataTexture | null = null
  skeleton: THREE.Texture | null = null
  overlays: Partial<Record<OverlayKey, THREE.Texture>> = {}
  tileAge: THREE.DataTexture
  grid = { cols: 1, rows: 1, tile: 256 }
  w = 0
  h = 0

  constructor() {
    this.tileAge = new THREE.DataTexture(new Float32Array([-1]), 1, 1, THREE.RedFormat, THREE.FloatType)
    this.tileAge.needsUpdate = true
  }

  setRaw(bitmap: ImageBitmap, pixels?: Uint8ClampedArray, onReady?: () => void) {
    const t = new THREE.Texture(bitmap)
    t.flipY = false
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.anisotropy = 4
    t.needsUpdate = true
    this.rawPixels = pixels ?? this.rawPixels
    this.rawW = bitmap.width
    this.rawH = bitmap.height
    this.pending.unshift((gl) => {
      gl.initTexture(t)
      this.raw?.dispose()
      this.raw = t
      onReady?.()
    })
  }

  setRawMag(nearest: boolean) {
    if (!this.raw) return
    const f = nearest ? THREE.NearestFilter : THREE.LinearFilter
    if (this.raw.magFilter !== f) {
      this.raw.magFilter = f
      this.raw.needsUpdate = true
    }
  }

  ensureMasks(w: number, h: number) {
    if (this.masks && this.w === w && this.h === h) return false
    this.masks?.dispose()
    const t = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.needsUpdate = true
    this.masks = t
    this.w = w
    this.h = h
    return true
  }

  clearMasks() {
    if (!this.masks) return
    ;(this.masks.image.data as Uint8Array).fill(0)
    this.masks.needsUpdate = true
  }

  ensureGrid(w: number, h: number, tile = 256) {
    const cols = Math.ceil(w / tile)
    const rows = Math.ceil(h / tile)
    if (this.grid.cols !== cols || this.grid.rows !== rows || this.grid.tile !== tile) {
      this.tileAge.dispose()
      this.tileAge = new THREE.DataTexture(new Float32Array(cols * rows).fill(-1), cols, rows, THREE.RedFormat, THREE.FloatType)
      this.tileAge.minFilter = THREE.NearestFilter
      this.tileAge.magFilter = THREE.NearestFilter
      this.tileAge.needsUpdate = true
      this.grid = { cols, rows, tile }
    }
  }

  resetGrid() {
    ;(this.tileAge.image.data as Float32Array).fill(-1)
    this.tileAge.needsUpdate = true
  }

  markTile(x: number, y: number, t: number) {
    const col = Math.floor(x / this.grid.tile)
    const row = Math.floor(y / this.grid.tile)
    ;(this.tileAge.image.data as Float32Array)[row * this.grid.cols + col] = t
    this.tileAge.needsUpdate = true
  }

  markAll(t: number) {
    ;(this.tileAge.image.data as Float32Array).fill(t)
    this.tileAge.needsUpdate = true
  }

  /** queue a full-size paste (drained one per frame) */
  pasteLater(bitmap: ImageBitmap) {
    // a full 2048² paste is ~80 ms of upload: split it into horizontal strips,
    // one strip per frame (texSubImage2D of a source sub-rectangle)
    const strips = Math.max(1, Math.ceil(bitmap.height / 256))
    const src = new THREE.Texture(bitmap)
    src.flipY = false
    for (let k = 0; k < strips; k++) {
      const y0 = Math.floor((k * bitmap.height) / strips)
      const y1 = Math.floor(((k + 1) * bitmap.height) / strips)
      const last = k === strips - 1
      this.enqueue(
        (gl) => {
          if (!this.masks) return
          gl.initTexture(this.masks)
          const region = new THREE.Box2(new THREE.Vector2(0, y0), new THREE.Vector2(bitmap.width, y1))
          gl.copyTextureToTexture(src, this.masks, region, new THREE.Vector2(0, y0))
          if (last) {
            src.dispose()
            bitmap.close()
          }
        },
        last ? () => bitmap.close() : undefined,
      )
    }
  }

  /** write a flipped bitmap into the mask texture at image position (x, y) */
  paste(gl: THREE.WebGLRenderer, bitmap: ImageBitmap, x: number, y: number) {
    if (!this.masks) return
    const src = new THREE.Texture(bitmap)
    src.flipY = false
    gl.copyTextureToTexture(src, this.masks, null, new THREE.Vector2(x, this.h - y - bitmap.height))
    src.dispose()
    bitmap.close()
  }

  setSkeleton(bitmap: ImageBitmap) {
    const t = new THREE.Texture(bitmap)
    t.flipY = false
    t.minFilter = THREE.NearestFilter
    t.magFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.needsUpdate = true
    this.enqueue(
      (gl) => {
        gl.initTexture(t)
        this.skeleton?.dispose()
        this.skeleton = t
      },
      () => t.dispose(),
    )
  }

  setOverlay(key: OverlayKey, bitmap: ImageBitmap) {
    const t = new THREE.Texture(bitmap)
    t.flipY = false
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
    this.enqueue(
      (gl) => {
        gl.initTexture(t)
        this.overlays[key]?.dispose()
        this.overlays[key] = t
      },
      () => t.dispose(),
    )
  }

  /** raw intensity at image px (0..1, brightest channel) for the readout */
  intensityAt(x: number, y: number) {
    if (!this.rawPixels) return null
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    if (xi < 0 || yi < 0 || xi >= this.rawW || yi >= this.rawH) return null
    const i = (yi * this.rawW + xi) * 4
    const p = this.rawPixels
    return Math.max(p[i], p[i + 1], p[i + 2]) / 255
  }

  dispose() {
    this.raw?.dispose()
    this.masks?.dispose()
    this.skeleton?.dispose()
    Object.values(this.overlays).forEach((t) => t?.dispose())
    this.tileAge.dispose()
  }
}
