import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { urls } from '../api/client'
import { tileBus, useApp } from '../state/app'
import { effectiveVisible, useLayers, type LayerId } from '../state/layers'
import { useTheme } from '../state/theme'
import type { ViewportStore } from '../state/viewport'
import { ImageAssets } from './assets'
import { createLayerMaterial, hexToVec3, MODE } from './layer-material'
import { decodeImage, decodeTile, drawOverlays } from './worker-client'

export interface StackAnim {
  t: number // 0 = flat 2D, 1 = exploded stack
  target: number
  yaw: number // user orbit offsets in stack mode (radians)
  pitch: number
  hover: LayerId | null
}

const CMAP = { native: 0, gray: 1, green: 2, magma: 3, inverted: 4 } as const
const FOV = 35
const MESH_LAYERS: LayerId[] = ['raw', 'uncertainty', 'soma', 'neurite', 'skeleton', 'area', 'junctions', 'angles', 'outliers']

const now = () => performance.now() / 1000

/**
 * Perspective camera that is exactly top-down in 2D mode (a fronto-parallel
 * plane under a perspective camera projects orthographically, so 1 image px =
 * zoom screen px), and tilts/orbits as the stack explodes. One camera for both
 * modes is what makes the 2D -> "layer by layer" transition a continuous move.
 */
function CameraRig({ store, anim, depth, onAnimating }: { store: ViewportStore; anim: MutableRefObject<StackAnim>; depth: number; onAnimating: (b: boolean) => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const target = useMemo(() => new THREE.Vector3(), [])
  const moving = useRef(false)

  useEffect(() => store.subscribe(() => invalidate()), [store, invalidate])

  useFrame((_, dt) => {
    const a = anim.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const k = reduce ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 5.5)
    a.t += (a.target - a.t) * k
    if (Math.abs(a.target - a.t) < 0.0008) a.t = a.target
    const isMoving = a.t !== a.target
    if (isMoving !== moving.current) {
      moving.current = isMoving
      onAnimating(isMoving)
    }
    const v = store.getState()
    const t = a.t
    const e = t * t * (3 - 2 * t) // smoothstep easing for the camera path
    const half = THREE.MathUtils.degToRad(FOV / 2)
    const d = size.height / v.zoom / 2 / Math.tan(half)
    const zMid = depth * e * 0.5
    target.set(v.cx, -v.cy, zMid)
    const pitch = e * (0.98 + a.pitch)
    const yaw = e * (-0.52 + a.yaw)
    const dist = d * (1 + 0.95 * e)
    camera.position.set(
      target.x + dist * Math.sin(pitch) * Math.sin(yaw),
      target.y - dist * Math.sin(pitch) * Math.cos(yaw),
      target.z + dist * Math.cos(pitch),
    )
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.near = Math.max(0.5, dist * 0.02)
    camera.far = dist * 6 + depth * 4 + 10
    camera.fov = FOV
    camera.updateProjectionMatrix()
    if (isMoving) invalidate()
  })
  return null
}

export function LayerScene({
  imageId,
  store,
  anim,
  labelsInStack = true,
  onAssets,
  onAnimating,
  forceLayers,
}: {
  imageId: string
  store: ViewportStore
  anim: MutableRefObject<StackAnim>
  labelsInStack?: boolean
  onAssets?: (a: ImageAssets) => void
  onAnimating: (b: boolean) => void
  forceLayers?: LayerId[]
}) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const result = useApp((s) => s.results[imageId])
  const version = useApp((s) => s.resultVersion[imageId] ?? 0)
  const live = useApp((s) => s.live[imageId])
  const meta = useApp((s) => s.images[imageId])
  const flicker = useApp((s) => s.prefs.flicker)
  const stackDepth = useApp((s) => s.stackDepth)
  const layers = useLayers((s) => s.layers)
  const solo = useLayers((s) => s.solo)
  const raw = useLayers((s) => s.raw)
  const sheetColor = useTheme((s) => (s.theme === 'light' ? '#ffffff' : '#1c1e2b'))

  const W = result?.width ?? live?.size?.w ?? meta?.width ?? 1920
  const H = result?.height ?? live?.size?.h ?? meta?.height ?? 1080

  const assets = useMemo(() => new ImageAssets(), [imageId])
  const materials = useMemo(() => {
    const m = {} as Record<LayerId | 'scan', THREE.ShaderMaterial>
    m.raw = createLayerMaterial(MODE.raw)
    m.uncertainty = createLayerMaterial(MODE.uncertainty)
    m.soma = createLayerMaterial(MODE.mask)
    m.neurite = createLayerMaterial(MODE.mask)
    m.skeleton = createLayerMaterial(MODE.mask)
    m.area = createLayerMaterial(MODE.overlay)
    m.junctions = createLayerMaterial(MODE.overlay)
    m.angles = createLayerMaterial(MODE.overlay)
    m.outliers = createLayerMaterial(MODE.overlay)
    m.scan = createLayerMaterial(MODE.scan)
    m.soma.uniforms.uChannel.value = 0
    m.neurite.uniforms.uChannel.value = 1
    m.skeleton.uniforms.uChannel.value = 0
    m.skeleton.uniforms.uFill.value = 1
    m.soma.uniforms.uFill.value = 0.42
    m.neurite.uniforms.uFill.value = 0.55
    return m
  }, [])
  const fade = useRef({ masks: 1, overlays: 1 })
  const liveFlag = useRef(0)
  const currentTile = useRef(new THREE.Vector2(-1, -1))

  useEffect(() => {
    onAssets?.(assets)
    return () => assets.dispose()
  }, [assets, onAssets])

  // ---------------- raw image (decoded in a worker, with pixels for readout)
  useEffect(() => {
    let alive = true
    decodeImage(raw.clahe ? urls.clahe(imageId) : urls.raw(imageId), !raw.clahe)
      .then((d) => {
        if (!alive) return d.bitmap.close()
        assets.setRaw(d.bitmap, d.data ?? undefined, () => {
          materials.raw.uniforms.uTex.value = assets.raw
          invalidate()
        })
        materials.raw.uniforms.uSize.value.set(d.w, d.h)
        const s = store.getState()
        if (s.imgW !== d.w || s.imgH !== d.h) store.setState({ imgW: d.w, imgH: d.h })
        invalidate()
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [imageId, raw.clahe, assets, materials, store, invalidate])

  // ---------------- masks + overlays from a finished result
  const streaming = live && (live.state === 'queued' || live.state === 'running')
  useEffect(() => {
    if (!result || streaming) return
    let alive = true
    const myGen = assets.gen
    assets.ensureMasks(result.width, result.height)
    const liveJustFinished = live?.state === 'done'
    // overlays go to the worker one idle slot later: cloning thousands of
    // junctions/endpoints must not share a task with the React commit
    const idle = new Promise<void>((r) => setTimeout(r, 30))
    Promise.all([decodeImage(urls.layer(imageId, 'masks', String(version))), decodeImage(urls.layer(imageId, 'skeleton', String(version))), idle.then(() => drawOverlays(result))])
      .then(([m, sk, ov]) => {
        if (!alive || myGen !== assets.gen) {
          m.bitmap.close()
          sk.bitmap.close()
          Object.values(ov.overlays).forEach((b) => b.close())
          return
        }
        assets.pasteLater(m.bitmap)
        assets.setSkeleton(sk.bitmap)
        for (const [k, b] of Object.entries(ov.overlays)) assets.setOverlay(k as keyof typeof ov.overlays, b)
        if (!liveJustFinished) fade.current.masks = 0 // entrance fade for cached results
        fade.current.overlays = 0
        setTimeout(() => {
          liveFlag.current = 0
          invalidate()
        }, liveJustFinished ? 700 : 0)
        invalidate()
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, version, !!result, streaming])

  // ---------------- live tile stream (CLAUDE.md s4.4)
  useEffect(() => {
    if (!streaming || !live) return
    const w = live.size?.w ?? meta?.width ?? W
    const h = live.size?.h ?? meta?.height ?? H
    const myGen = assets.newGeneration() // drops queued uploads of the previous result/job
    assets.ensureMasks(w, h)
    assets.clearMasks()
    assets.ensureGrid(w, h, live.size?.tile ?? 256)
    assets.resetGrid()
    Object.values(assets.overlays).forEach((t) => t?.dispose())
    assets.overlays = {}
    assets.skeleton?.dispose()
    assets.skeleton = null
    liveFlag.current = 1
    fade.current.masks = 1
    currentTile.current.set(0, 0)
    let chain = Promise.resolve()
    const off = tileBus.on(imageId, (ev) => {
      // keep tiles in order: decode in parallel, upload sequentially
      const dec = decodeTile(ev.png)
      chain = chain.then(() =>
        dec
          .then((d) => {
            if (myGen !== assets.gen) return d.bitmap.close() // tile of a superseded job
            assets.ensureMasks(w, h)
            assets.paste(gl, d.bitmap, ev.x, ev.y)
            assets.markTile(ev.x, ev.y, now())
            const next = ev.i + 1
            const cols = Math.ceil(w / (live.size?.tile ?? 256))
            currentTile.current.set(next < ev.n ? next % cols : -1, next < ev.n ? Math.floor(next / cols) : -1)
            invalidate()
          })
          .catch(() => undefined),
      )
    })
    return () => {
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, live?.jobId, streaming, live?.size?.w])

  // ---------------- uniforms that follow React state
  useEffect(() => {
    const u = materials.raw.uniforms
    u.uCmap.value = CMAP[raw.colormap]
    u.uLevel.value = raw.level
    u.uWidth.value = raw.width
    u.uGamma.value = raw.gamma
    u.uContrast.value = raw.contrast
    u.uUnsharp.value = raw.unsharp
    invalidate()
  }, [raw, materials, invalidate])

  useEffect(() => {
    for (const l of layers) {
      const m = materials[l.id as LayerId]
      if (!m) continue
      m.uniforms.uOpacity.value = l.opacity
      m.uniforms.uColor.value = hexToVec3(l.id === 'uncertainty' ? '#6d8bff' : l.color)
    }
    materials.uncertainty.uniforms.uFlicker.value = flicker && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0
    invalidate()
  }, [layers, materials, flicker, invalidate])

  // ---------------- per-frame: clock, fades, textures, stack depths
  const meshes = useRef<Partial<Record<LayerId, THREE.Mesh>>>({})
  const sheets = useRef<Partial<Record<LayerId, THREE.Mesh>>>({})
  const visibleIds = MESH_LAYERS.filter((id) => (forceLayers ? forceLayers.includes(id) && (id === 'raw' || id === 'uncertainty' || effectiveVisible(layers, null, id)) : effectiveVisible(layers, solo, id))).sort(
    (a, b) => layers.findIndex((l) => l.id === a) - layers.findIndex((l) => l.id === b),
  )
  const gap = Math.max(W, H) * 0.075 * stackDepth
  const depth = gap * Math.max(visibleIds.length - 1, 1)

  useFrame((_, dt) => {
    // drain at most one full-size texture upload per frame
    const job = assets.pending.shift()
    if (job) {
      job(gl)
      invalidate()
    }
    const t = now()
    const f = fade.current
    const k = 1 - Math.exp(-dt * 7)
    f.masks += (1 - f.masks) * k
    f.overlays += (1 - f.overlays) * k
    const animating = f.masks < 0.995 || f.overlays < 0.995
    const tex = {
      raw: assets.raw,
      uncertainty: assets.masks,
      soma: assets.masks,
      neurite: assets.masks,
      skeleton: assets.skeleton,
      area: assets.overlays.area ?? null,
      junctions: assets.overlays.junctions ?? null,
      angles: assets.overlays.angles ?? null,
      outliers: assets.overlays.outliers ?? null,
    } as Record<LayerId, THREE.Texture | null>
    const zoom = store.getState().zoom
    assets.setRawMag(zoom > 3)
    const e = anim.current.t * anim.current.t * (3 - 2 * anim.current.t)
    for (const id of MESH_LAYERS) {
      const m = materials[id]
      const u = m.uniforms
      u.uTime.value = t
      u.uTex.value = tex[id]
      u.uLive.value = liveFlag.current
      u.uTileAge.value = assets.tileAge
      u.uGrid.value.set(assets.grid.cols, assets.grid.rows)
      u.uTilePx.value = assets.grid.tile
      if (id !== 'raw') u.uSize.value.set(assets.w || W, assets.h || H)
      const base = layers.find((l) => l.id === id)?.opacity ?? 1
      const fadeMul = id === 'raw' ? 1 : ['area', 'junctions', 'angles', 'outliers', 'skeleton'].includes(id) ? f.overlays : f.masks
      u.uOpacity.value = base * fadeMul
      u.uHighlight.value = anim.current.hover === id ? e : 0
      const mesh = meshes.current[id]
      if (mesh) {
        const idx = visibleIds.indexOf(id)
        mesh.position.z = idx * gap * e
        mesh.visible = idx >= 0 && !!tex[id]
      }
      const sheet = sheets.current[id]
      if (sheet) {
        const idx = visibleIds.indexOf(id)
        sheet.position.z = idx * gap * e - 0.5
        sheet.visible = e > 0.01 && idx > 0
        ;(sheet.material as THREE.MeshBasicMaterial).opacity = 0.42 * e * (anim.current.hover === id ? 1.6 : 1)
      }
    }
    const sc = materials.scan.uniforms
    sc.uTime.value = t
    sc.uLive.value = streaming ? 1 : 0
    sc.uTileAge.value = assets.tileAge
    sc.uGrid.value.set(assets.grid.cols, assets.grid.rows)
    sc.uTilePx.value = assets.grid.tile
    sc.uSize.value.set(assets.w || W, assets.h || H)
    sc.uCurrent.value.copy(currentTile.current)
    if (animating) invalidate()
  })

  const layerName = (id: LayerId) => layers.find((l) => l.id === id)?.name ?? id
  const layerColor = (id: LayerId) => layers.find((l) => l.id === id)?.color ?? '#fff'
  const stackOn = useApp((s) => s.stack)
  const frame = useMemo(
    () =>
      [
        [0, 0, 0],
        [W, 0, 0],
        [W, -H, 0],
        [0, -H, 0],
        [0, 0, 0],
      ] as [number, number, number][],
    [W, H],
  )

  return (
    <>
      <CameraRig store={store} anim={anim} depth={depth} onAnimating={onAnimating} />
      {MESH_LAYERS.map((id, i) => {
        const order = layers.findIndex((l) => l.id === id)
        return (
          <group key={id}>
            <mesh
              ref={(m) => {
                sheets.current[id] = m ?? undefined
              }}
              position={[W / 2, -H / 2, 0]}
              renderOrder={order * 2}
              visible={false}
            >
              <planeGeometry args={[W, H]} />
              <meshBasicMaterial color={sheetColor} transparent opacity={0} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh
              ref={(m) => {
                meshes.current[id] = m ?? undefined
              }}
              position={[W / 2, -H / 2, 0]}
              renderOrder={order * 2 + 1}
              material={materials[id]}
              onPointerOver={
                stackOn
                  ? (e) => {
                      e.stopPropagation()
                      anim.current.hover = id
                      invalidate()
                    }
                  : undefined
              }
              onPointerOut={
                stackOn
                  ? () => {
                      if (anim.current.hover === id) anim.current.hover = null
                      invalidate()
                    }
                  : undefined
              }
              onClick={
                stackOn
                  ? (e) => {
                      e.stopPropagation()
                      useLayers.getState().setSolo(id)
                    }
                  : undefined
              }
            >
              <planeGeometry args={[W, H]} />
            </mesh>
            {stackOn && labelsInStack && visibleIds.includes(id) && (
              <StackLabel
                id={id}
                name={layerName(id)}
                color={layerColor(id)}
                index={visibleIds.indexOf(id)}
                gap={gap}
                W={W}
                H={H}
                anim={anim}
                frame={frame}
                key={`lbl-${id}-${i}`}
              />
            )}
          </group>
        )
      })}
      <mesh position={[W / 2, -H / 2, 0]} renderOrder={999} material={materials.scan} visible={!!streaming}>
        <planeGeometry args={[W, H]} />
      </mesh>
    </>
  )
}

function StackLabel({
  id,
  name,
  color,
  index,
  gap,
  W,
  H,
  anim,
  frame,
}: {
  id: LayerId
  name: string
  color: string
  index: number
  gap: number
  W: number
  H: number
  anim: MutableRefObject<StackAnim>
  frame: [number, number, number][]
}) {
  const g = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  useFrame(() => {
    const t = anim.current.t
    const e = t * t * (3 - 2 * t)
    if (g.current) g.current.position.z = index * gap * e
    if (el.current) {
      el.current.style.opacity = String(Math.max(0, (e - 0.35) / 0.65))
      el.current.dataset.hover = String(anim.current.hover === id)
    }
  })
  return (
    <group ref={g}>
      <Line points={frame} color={color} lineWidth={1.2} transparent opacity={0.55} depthTest={false} renderOrder={1000} />
      <Html position={[W + 18, -H * 0.02, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={el} className="stack-label" style={{ ['--c' as string]: color }}>
          <span className="stack-label-dot" />
          <span className="stack-label-index num">{String(index + 1).padStart(2, '0')}</span>
          {name}
        </div>
      </Html>
    </group>
  )
}
