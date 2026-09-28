import { Html, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Box, Info, PanelRightClose, PanelRightOpen, Pause, Play, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { urls } from '../api/client'
import type { Junction, Neurite, Result } from '../api/types'
import { Polar } from '../charts/charts'
import { Badge, Button, IconButton, Section, Segmented, Slider, Switch } from '../components/ui'
import { decodeImage } from '../engine/worker-client'
import { len } from '../lib/format'
import { useApp } from '../state/app'
import { useTheme } from '../state/theme'
import ps from '../panels/panels.module.css'
import sh from '../shell/shell.module.css'
import s from './screens.module.css'

type ColorBy = 'length' | 'tortuosity' | 'orientation'
type Focus = 'network' | 'field'

interface SceneOpts {
  colorBy: ColorBy
  focus: Focus
  relief: number
  slide: boolean
  somata: boolean
  autoRotate: boolean
  mode3d: boolean
}

// sequential ramps, stepped for their background: on dark, low = dark / high =
// glowing near-white; on white the direction flips so every branch keeps contrast
const RAMPS = {
  dark: ['#16324f', '#1f6fa8', '#39b6e0', '#8be9fd', '#e8fcff'].map((h) => new THREE.Color(h)),
  light: ['#8fd3ea', '#3fa6d6', '#1f73c7', '#1a4f99', '#122e63'].map((h) => new THREE.Color(h)),
}
let RAMP = RAMPS.dark
function ramp(t: number, out = new THREE.Color()) {
  const x = Math.max(0, Math.min(0.9999, t)) * (RAMP.length - 1)
  const i = Math.floor(x)
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i)
}
const SCENE = {
  dark: { bg: '#0b0c11', slab: '#1a1c28', ground: '#0b0c11', boost: 1.25, bloom: true, lightness: 0.62 },
  light: { bg: '#eef0f5', slab: '#ffffff', ground: '#dfe2ea', boost: 1, bloom: false, lightness: 0.45 },
}
let CYCLIC_L = 0.62
function cyclic(deg: number, out = new THREE.Color()) {
  return out.setHSL(((deg % 180) / 180) * 0.85, 0.75, CYCLIC_L)
}

/** relief height (px) from the micrograph intensity: an honest 2.5D, not a Z-stack */
function makeHeight(pixels: Uint8ClampedArray | null, w: number, h: number) {
  // normalise by the 99th percentile so dim fluorescence still gives a readable relief
  let norm = 255
  if (pixels) {
    const hist = new Uint32Array(256)
    for (let i = 0; i < pixels.length; i += 4 * 37) hist[Math.max(pixels[i], pixels[i + 1], pixels[i + 2])]++
    const total = hist.reduce((a, b) => a + b, 0)
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= total * 0.995) {
        norm = Math.max(8, v)
        break
      }
    }
  }
  return (x: number, y: number) => {
    if (!pixels) return 0
    const xi = Math.max(0, Math.min(w - 1, Math.round(x)))
    const yi = Math.max(0, Math.min(h - 1, Math.round(y)))
    let acc = 0
    let n = 0
    for (let dy = -2; dy <= 2; dy += 2)
      for (let dx = -2; dx <= 2; dx += 2) {
        const xx = Math.max(0, Math.min(w - 1, xi + dx))
        const yy = Math.max(0, Math.min(h - 1, yi + dy))
        const k = (yy * w + xx) * 4
        acc += Math.max(pixels[k], pixels[k + 1], pixels[k + 2])
        n++
      }
    return Math.min(1.4, acc / n / norm)
  }
}

interface Built {
  geom: THREE.BufferGeometry
  ranges: { start: number; end: number; id: string }[]
  center: THREE.Vector3
  radius: number
  branches: Neurite[]
  junctions: Junction[]
}

function buildTubes(r: Result, focus: Focus, colorBy: ColorBy, height: (x: number, y: number) => number, relief: number, boost = 1.25): Built | null {
  let branches = r.neurites
  let net = 0
  if (focus === 'network') {
    const count = new Map<number, number>()
    for (const b of r.neurites) if (b.network) count.set(b.network, (count.get(b.network) ?? 0) + b.length_px)
    net = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
    if (net) branches = r.neurites.filter((b) => b.network === net)
  }
  if (!branches.length) return null
  const ids = new Set(branches.map((b) => b.id))
  const junctions = r.junctions.filter((j) => j.branch_ids.some((id) => ids.has(id)))
  const maxLen = Math.max(...branches.map((b) => b.length_px))
  const maxTort = Math.min(3, Math.max(...branches.map((b) => b.tortuosity)))
  const geoms: THREE.BufferGeometry[] = []
  const ranges: Built['ranges'] = []
  let offset = 0
  const box = new THREE.Box3()
  const c = new THREE.Color()
  for (const b of branches) {
    const pts = b.polyline.map(([x, y]) => new THREE.Vector3(x, -y, height(x, y) * relief + 2))
    if (pts.length < 2) continue
    for (const p of pts) box.expandByPoint(p)
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const seg = Math.min(64, Math.max(4, pts.length * 2))
    const g = new THREE.TubeGeometry(curve, seg, 1.5, 6, false)
    const t = colorBy === 'length' ? Math.sqrt(b.length_px / maxLen) : colorBy === 'tortuosity' ? (Math.min(3, b.tortuosity) - 1) / Math.max(0.01, maxTort - 1) : 0
    if (colorBy === 'orientation') cyclic(b.orientation_deg, c)
    else ramp(t, c)
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([c.r * boost, c.g * boost, c.b * boost], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geoms.push(g)
    ranges.push({ start: offset, end: offset + n, id: b.id })
    offset += n
  }
  const geom = mergeGeometries(geoms, false)!
  geoms.forEach((g) => g.dispose())
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  return { geom, ranges, center: sphere.center, radius: Math.max(60, sphere.radius), branches, junctions }
}

function Somata({ r, height, relief, focusNet, onPick }: { r: Result; height: (x: number, y: number) => number; relief: number; focusNet: number | null; onPick: (id: number) => void }) {
  const geoms = useMemo(() => {
    return r.cells
      .filter((c) => c.contour.length >= 3 && (focusNet == null || c.network === focusNet))
      .map((c) => {
        const shape = new THREE.Shape(c.contour.map(([x, y]) => new THREE.Vector2(x - c.centroid[0], -(y - c.centroid[1]))))
        const depth = Math.max(3, Math.sqrt(c.area_px) * 0.55)
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: Math.min(3, Math.sqrt(c.area_px) * 0.18), bevelSegments: 6, curveSegments: 12 })
        return { c, g, z: height(c.centroid[0], c.centroid[1]) * relief }
      })
  }, [r, height, relief, focusNet])
  useEffect(() => () => geoms.forEach((x) => x.g.dispose()), [geoms])
  return (
    <>
      {geoms.map(({ c, g, z }) => (
        <mesh
          key={c.id}
          geometry={g}
          position={[c.centroid[0], -c.centroid[1], z]}
          onClick={(e) => {
            e.stopPropagation()
            onPick(c.id)
          }}
        >
          <meshPhysicalMaterial color={c.outlier ? '#ff6b6b' : '#ffb86c'} emissive={c.outlier ? '#ff3b3b' : '#ff8a2a'} emissiveIntensity={0.35} roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.25} />
        </mesh>
      ))}
    </>
  )
}

function Slide({ tex, w, h, visible, slab }: { tex: THREE.Texture | null; w: number; h: number; visible: boolean; slab: string }) {
  if (!tex || !visible) return null
  return (
    <group>
      <mesh position={[w / 2, -h / 2, -1]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[w / 2, -h / 2, -7]}>
        <boxGeometry args={[w + 40, h + 40, 10]} />
        <meshPhysicalMaterial color={slab} roughness={0.15} transmission={0} transparent opacity={0.55} metalness={0.1} />
      </mesh>
    </group>
  )
}

function JunctionMarks({ junctions, height, relief, selected, onPick }: { junctions: Junction[]; height: (x: number, y: number) => number; relief: number; selected: string | null; onPick: (j: Junction) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const col = new THREE.Color()
    junctions.forEach((j, i) => {
      const sc = j.id === selected ? 2 : 1
      mat.makeScale(sc, sc, sc).setPosition(j.x, -j.y, height(j.x, j.y) * relief + 2)
      m.setMatrixAt(i, mat)
      m.setColorAt(i, col.set(j.id === selected ? '#ffffff' : '#ff79c6'))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [junctions, height, relief, selected])
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, junctions.length]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.instanceId != null) onPick(junctions[e.instanceId])
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <sphereGeometry args={[3.4, 16, 12]} />
      <meshStandardMaterial color="#ff79c6" emissive="#ff79c6" emissiveIntensity={1.2} toneMapped={false} />
    </instancedMesh>
  )
}

function AngleArcs({ j, z }: { j: Junction; z: number }) {
  const R = 26
  const dirs = j.directions_deg
  const pts = (a0: number, a1: number, r: number) => {
    let d = (a1 - a0 + 360) % 360
    if (dirs.length === 2) d = Math.min(d, 360 - d) === d ? d : -(360 - d)
    const out: [number, number, number][] = []
    for (let k = 0; k <= 24; k++) {
      const a = ((a0 + (d * k) / 24) * Math.PI) / 180
      out.push([j.x + Math.cos(a) * r, -j.y + Math.sin(a) * r, z + 3])
    }
    return out
  }
  return (
    <group>
      {dirs.map((d, i) => {
        const a = (d * Math.PI) / 180
        return <Line key={`r${i}`} points={[[j.x, -j.y, z + 3], [j.x + Math.cos(a) * R * 1.7, -j.y + Math.sin(a) * R * 1.7, z + 3]]} color="#f1fa8c" lineWidth={2} toneMapped={false} />
      })}
      {j.angles_deg.map((ang, i) => {
        const a0 = dirs[i]
        const a1 = dirs[(i + 1) % dirs.length]
        const p = pts(a0, a1, R + (i % 2) * 7)
        const mid = p[12]
        return (
          <group key={`a${i}`}>
            <Line points={p} color="#f1fa8c" lineWidth={1.4} transparent opacity={0.8} toneMapped={false} />
            <Html position={mid} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
              <div className="stack-label" style={{ opacity: 1, ['--c' as string]: '#f1fa8c', fontFamily: 'var(--font-mono)' }}>
                {ang.toFixed(0)}°
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function Rig({ built, opts, controls, resetKey }: { built: Built; opts: SceneOpts; controls: React.RefObject<OrbitImpl | null>; resetKey: number }) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera
  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), active: true })
  useEffect(() => {
    const c = built.center
    const d = built.radius * 2.3
    if (opts.mode3d) goal.current.pos.set(c.x + d * 0.35, c.y - d * 0.75, c.z + d * 0.62)
    else goal.current.pos.set(c.x, c.y - 0.001, c.z + d * 1.05)
    goal.current.target.copy(c)
    goal.current.active = true
  }, [built, opts.mode3d, resetKey])
  useFrame((_, dt) => {
    const g = goal.current
    const ctl = controls.current
    if (!g.active || !ctl) return
    const k = 1 - Math.exp(-dt * 3.2)
    camera.position.lerp(g.pos, k)
    ctl.target.lerp(g.target, k)
    camera.near = built.radius * 0.02
    camera.far = built.radius * 30
    camera.updateProjectionMatrix()
    if (camera.position.distanceTo(g.pos) < built.radius * 0.004) g.active = false
  })
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __cam: camera, __ctl: controls, __built: built, __goal: goal })
  })
  useEffect(() => {
    const ctl = controls.current
    if (!ctl) return
    const stop = () => (goal.current.active = false)
    ctl.addEventListener('start', stop)
    return () => ctl.removeEventListener('start', stop)
  }, [controls])
  return null
}

function Scene({ r, opts, pixels, tex, selBranch, selJunction, onBranch, onJunction, onCell, resetKey }: {
  r: Result
  opts: SceneOpts
  pixels: Uint8ClampedArray | null
  tex: THREE.Texture | null
  selBranch: string | null
  selJunction: Junction | null
  onBranch: (id: string | null) => void
  onJunction: (j: Junction | null) => void
  onCell: (id: number) => void
  resetKey: number
}) {
  const controls = useRef<OrbitImpl | null>(null)
  const theme = useTheme((st) => st.theme)
  const sc = SCENE[theme]
  RAMP = RAMPS[theme]
  CYCLIC_L = sc.lightness
  const height = useMemo(() => makeHeight(pixels, r.width, r.height), [pixels, r.width, r.height])
  // relief is built once; 2D <-> 3D is a GPU morph of the group's z-scale
  const relief = opts.relief * 60
  const flat = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = flat.current
    if (!g) return
    const target = opts.mode3d ? 1 : 0.02
    g.scale.z += (target - g.scale.z) * (1 - Math.exp(-dt * 4))
  })
  const built = useMemo(() => buildTubes(r, opts.focus, opts.colorBy, height, relief, sc.boost), [r, opts.focus, opts.colorBy, height, relief, sc.boost, theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), 6000)
    const ctl = controls.current
    const bump = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 6000)
    }
    ctl?.addEventListener('start', bump)
    return () => {
      clearTimeout(t)
      ctl?.removeEventListener('start', bump)
    }
  }, [built])
  useEffect(() => () => built?.geom.dispose(), [built])
  if (!built) return null
  const focusNet = opts.focus === 'network' ? (built.branches[0]?.network ?? null) : null
  const selJ = selJunction && built.junctions.find((j) => j.id === selJunction.id)
  return (
    <>
      <color attach="background" args={[sc.bg]} />
      <fog attach="fog" args={[sc.bg, built.radius * 3, built.radius * 9]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#bd93f9', sc.ground, 0.5]} />
      <directionalLight position={[built.center.x + 400, built.center.y - 600, 900]} intensity={1.6} color="#ffffff" />
      <pointLight position={[built.center.x - 300, built.center.y + 300, 250]} intensity={60000} color="#8be9fd" distance={2000} />
      <Slide tex={tex} w={r.width} h={r.height} visible={opts.slide} slab={sc.slab} />
      <group ref={flat}>
      <mesh
        geometry={built.geom}
        onClick={(e) => {
          e.stopPropagation()
          const idx = built.geom.index ? built.geom.index.getX((e.faceIndex ?? 0) * 3) : (e.faceIndex ?? 0) * 3
          const hit = built.ranges.find((q) => idx >= q.start && idx < q.end)
          onBranch(hit?.id ?? null)
          onJunction(null)
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      {selBranch && <BranchHighlight b={built.branches.find((b) => b.id === selBranch)} height={height} relief={relief} />}
      <JunctionMarks junctions={built.junctions} height={height} relief={relief} selected={selJ?.id ?? null} onPick={(j) => (onJunction(j), onBranch(null))} />
      {selJ && <AngleArcs j={selJ} z={height(selJ.x, selJ.y) * relief + 2} />}
      {opts.somata && <Somata r={r} height={height} relief={relief} focusNet={focusNet} onPick={onCell} />}
      </group>
      <OrbitControls ref={controls} enableDamping dampingFactor={0.08} autoRotate={opts.autoRotate && idle && opts.mode3d} autoRotateSpeed={0.45} makeDefault maxPolarAngle={Math.PI * 0.49} />
      <Rig built={built} opts={opts} controls={controls} resetKey={resetKey} />
      {/* bloom only on dark: on a white background every pixel is above the
          luminance threshold and the whole frame would glow */}
      {sc.bloom ? (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.75} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={4}>
          <Vignette eskil={false} offset={0.35} darkness={0.18} />
        </EffectComposer>
      )}
    </>
  )
}

function BranchHighlight({ b, height, relief }: { b?: Neurite; height: (x: number, y: number) => number; relief: number }) {
  const geom = useMemo(() => {
    if (!b || b.polyline.length < 2) return null
    const pts = b.polyline.map(([x, y]) => new THREE.Vector3(x, -y, height(x, y) * relief + 2))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), Math.min(96, pts.length * 3), 3, 8, false)
  }, [b, height, relief])
  useEffect(() => () => geom?.dispose(), [geom])
  if (!geom) return null
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color="#bd93f9" transparent opacity={0.55} toneMapped={false} />
    </mesh>
  )
}

export function Neuron3D() {
  const selected = useApp((st) => st.selected)
  const order = useApp((st) => st.order)
  const images = useApp((st) => st.images)
  const imageId = selected ?? order.find((id) => images[id]?.has_result) ?? null
  const r = useApp((st) => (imageId ? st.results[imageId] : undefined))
  const um = useApp((st) => (imageId ? st.umPerPx(imageId) : null))
  const [opts, setOpts] = useState<SceneOpts>({ colorBy: 'length', focus: 'network', relief: 0.6, slide: true, somata: true, autoRotate: true, mode3d: true })
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const [selBranch, setSelBranch] = useState<string | null>(null)
  const [selJunction, setSelJunction] = useState<Junction | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [inspector, setInspector] = useState(true)

  useEffect(() => {
    if (imageId && !selected) useApp.getState().select(imageId)
    if (imageId) void useApp.getState().loadResult(imageId)
  }, [imageId, selected])

  useEffect(() => {
    if (!imageId) return
    let alive = true
    setPixels(null)
    setSelBranch(null)
    setSelJunction(null)
    decodeImage(urls.raw(imageId), true).then((d) => {
      if (!alive) return d.bitmap.close()
      const t = new THREE.Texture(d.bitmap)
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.needsUpdate = true
      setTex((old) => {
        old?.dispose()
        return t
      })
      setPixels(d.data ?? null)
    })
    return () => {
      alive = false
    }
  }, [imageId])

  const branch = r?.neurites.find((b) => b.id === selBranch)
  const set = (p: Partial<SceneOpts>) => setOpts((o) => ({ ...o, ...p }))

  return (
    <div className={s.stage}>
      <div className={s.viewerArea} style={{ background: 'var(--bg-canvas)' }}>
        {r ? (
          <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [960, -1600, 1400], near: 1, far: 50000, up: [0, 0, 1] }} gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }} onPointerMissed={() => (setSelBranch(null), setSelJunction(null))}>
            <Scene r={r} opts={opts} pixels={pixels} tex={tex} selBranch={selBranch} selJunction={selJunction} onBranch={setSelBranch} onJunction={setSelJunction} onCell={(id) => useApp.setState({ selectedCell: id })} resetKey={resetKey} />
          </Canvas>
        ) : (
          <div className={s.empty} style={{ height: '100%' }}>
            <div className="muted">{imageId ? 'Loading result…' : 'No analysed image yet — run one in Analyze.'}</div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, zIndex: 5 }}>
          <div className={s.resultPill} style={{ position: 'static', translate: 'none' }}>
            <Segmented
              value={opts.mode3d ? '3d' : '2d'}
              onChange={(v) => set({ mode3d: v === '3d' })}
              options={[
                { value: '2d', label: '2D', tip: 'Flatten onto the slide' },
                { value: '3d', label: '3D', tip: 'Relief + orbit' },
              ]}
            />
            <Segmented
              value={opts.focus}
              onChange={(v) => set({ focus: v })}
              options={[
                { value: 'network', label: 'Largest neuron' },
                { value: 'field', label: 'Whole field' },
              ]}
            />
            <IconButton small tip="Reset camera" onClick={() => setResetKey((k) => k + 1)}>
              <RotateCcw size={15} />
            </IconButton>
            <IconButton small tip={opts.autoRotate ? 'Stop idle rotation' : 'Idle rotation'} onClick={() => set({ autoRotate: !opts.autoRotate })}>
              {opts.autoRotate ? <Pause size={15} /> : <Play size={15} />}
            </IconButton>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5 }}>
          <Badge tip="PC12 fields are 2D: height is fluorescence intensity (2.5D relief), not a Z-stack">
            <Info size={13} /> 2.5D relief from intensity · not a Z-stack
          </Badge>
        </div>
        <div style={{ position: 'absolute', right: 12, bottom: 12, left: 'auto', top: 'auto', translate: 'none', zIndex: 5 }} className={s.resultPill}>
          <span className="muted" style={{ fontSize: 13 }}>
            drag = orbit · right-drag = pan · wheel = zoom · click tube / sphere to inspect
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {inspector && (
          <motion.aside className={sh.inspector} initial={{ width: 0 }} animate={{ width: 320 }} exit={{ width: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ width: 320, overflow: 'auto', height: '100%' }}>
              <Section title="Neuron room" action={<IconButton small tip="Hide panel" side="left" onClick={() => setInspector(false)}><PanelRightClose size={16} /></IconButton>}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                  {r ? (
                    <span className="mono">
                      {images[imageId!]?.name} · {r.neurites.length} branches · {r.junctions.length} junctions · {r.cells.length} somata
                    </span>
                  ) : (
                    '—'
                  )}
                </div>
                <div className={ps.row} style={{ marginBottom: 8 }}>
                  <span>Colour branches by</span>
                </div>
                <Segmented<ColorBy>
                  value={opts.colorBy}
                  onChange={(v) => set({ colorBy: v })}
                  options={[
                    { value: 'length', label: 'Length' },
                    { value: 'tortuosity', label: 'Tortuosity' },
                    { value: 'orientation', label: 'Orientation' },
                  ]}
                />
                <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: opts.colorBy === 'orientation' ? 'linear-gradient(90deg,hsl(0 75% 62%),hsl(77 75% 62%),hsl(153 75% 62%),hsl(230 75% 62%),hsl(306 75% 62%))' : (useTheme.getState().theme === 'light' ? 'linear-gradient(90deg,#8fd3ea,#3fa6d6,#1f73c7,#1a4f99,#122e63)' : 'linear-gradient(90deg,#16324f,#1f6fa8,#39b6e0,#8be9fd,#e8fcff)') }} />
                <div className={ps.row} style={{ fontSize: 12, marginTop: 4, color: 'var(--text-3)' }}>
                  <span>{opts.colorBy === 'orientation' ? '0°' : 'low'}</span>
                  <span>{opts.colorBy === 'orientation' ? '180°' : 'high'}</span>
                </div>
              </Section>
              <Section title="Scene">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Slider label="Relief height" value={opts.relief} min={0} max={1.5} onChange={(v) => set({ relief: v })} format={(v) => `${v.toFixed(2)}×`} onReset={() => set({ relief: 0.6 })} />
                  <div className={ps.row}>
                    <span>Micrograph slide</span>
                    <Switch on={opts.slide} onChange={(v) => set({ slide: v })} label="Slide" />
                  </div>
                  <div className={ps.row}>
                    <span>Soma surfaces</span>
                    <Switch on={opts.somata} onChange={(v) => set({ somata: v })} label="Somata" />
                  </div>
                </div>
              </Section>
              <Section title="Selection">
                <AnimatePresence mode="wait">
                  {branch ? (
                    <motion.div key={branch.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        Branch <span className="mono">{branch.id}</span>
                      </div>
                      <KV k="length" v={len(branch.length_px, um)} />
                      <KV k="tortuosity" v={branch.tortuosity.toFixed(2)} />
                      <KV k="orientation" v={`${branch.orientation_deg.toFixed(0)}°`} />
                      <KV k="junctions / tips" v={`${branch.junctions} / ${branch.endpoints}`} />
                      <KV k="attached cell" v={branch.cell_id ? `#${branch.cell_id}` : '—'} />
                    </motion.div>
                  ) : selJunction ? (
                    <motion.div key={selJunction.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>
                        Junction <span className="mono">{selJunction.id}</span>
                      </div>
                      <KV k="branches" v={String(selJunction.branch_ids.length)} />
                      <KV k="angles" v={selJunction.angles_deg.map((a) => `${a.toFixed(0)}°`).join(' · ')} />
                      <div style={{ display: 'grid', placeItems: 'center', marginTop: 8 }}>
                        <Polar series={[{ label: 'directions', color: '#ff79c6', values: selJunction.directions_deg }]} size={140} bins={24} span={360} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="none" className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Box size={16} style={{ verticalAlign: -2 }} /> Click a neurite tube to read its morphometry, or a pink junction sphere to see its branch angles drawn in place.
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {!inspector && (
        <div style={{ position: 'absolute', right: 12, top: 60, zIndex: 6 }}>
          <Button size="sm" onClick={() => setInspector(true)}>
            <PanelRightOpen size={15} /> Show panel
          </Button>
        </div>
      )}
    </div>
  )
}

const KV = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--line-1)', fontSize: 13.5 }}>
    <span className="muted">{k}</span>
    <span className="mono">{v}</span>
  </div>
)
