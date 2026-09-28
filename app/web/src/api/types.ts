// The single contract between backend and UI (CLAUDE.md s8, extended with the
// s18 KEEP fields). The backend produces exactly this; the UI only draws it.

export interface Cell {
  id: number
  area_px: number
  circularity: number
  eccentricity: number
  centroid: [number, number]
  bbox: [number, number, number, number] // x0, y0, x1, y1
  confidence: number
  category: 'small' | 'medium' | 'large'
  network: number
  contour: [number, number][]
  neurite_length_px: number
  branches: number
  nti: number
  outlier: boolean
  outlier_reasons?: string[]
}

export interface Neurite {
  id: string
  length_px: number
  tortuosity: number
  junctions: number
  endpoints: number
  orientation_deg: number
  network: number
  polyline: [number, number][]
  mean_intensity: number
  cell_id?: number | null
}

export interface Junction {
  id: string
  x: number
  y: number
  branch_ids: string[]
  directions_deg: number[]
  angles_deg: number[]
}

export interface Summary {
  n: number
  mean: number
  median: number
  std: number
  cv: number
  min: number
  max: number
  total: number
}

export interface QCWarning {
  code: string
  severity: 'warning' | 'serious' | 'critical'
  text: string
}

export interface QC {
  blur: number
  laplacian_var: number
  edge_density: number
  fg_ratio: number
  mean_conf: number
  low_conf_ratio: number
  components: number
  small_component_ratio: number
  warnings: QCWarning[]
}

export type ContribKey = 'neurite_length' | 'branching' | 'angle' | 'soma'

export interface NTI {
  score: number | null // null = no somata detected (index undefined)
  contrib: Record<ContribKey, number>
  inputs: {
    neurite_length_per_cell_px: number
    branches_per_cell: number
    angle_dispersion_deg: number
    mean_circularity: number
  }
  mock: boolean
}

export interface Result {
  image_id: string
  model_version: string
  mock: boolean
  width: number
  height: number
  um_per_px: number | null
  cells: Cell[]
  neurites: Neurite[]
  junctions: Junction[]
  endpoints: [number, number][]
  angles_deg: number[]
  nti: NTI
  qc: QC
  summary: {
    cell_count: number
    neurite_length_px: Summary
    branches_per_cell: Summary
    angle_deg: Summary
    soma_area_px: Summary
    soma_circularity: Summary
    tortuosity: Summary
    junction_count: number
    endpoint_count: number
    mean_uncertainty: number
  }
  timings_ms: Record<string, number>
}

export interface ImageMeta {
  id: string
  name: string
  width?: number
  height?: number
  um_per_px?: number | null
  acquired?: string | null
  batch?: string
  variant?: boolean
  condition?: string
  has_result?: boolean
  nti?: number
  cell_count?: number
  mean_uncertainty?: number
  qc_warnings?: number
  model_version?: string
  review?: ReviewStatus
  pending?: boolean
}

export type ReviewStatus = 'pending' | 'approved' | 'corrected' | 'issue'

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface JobSummary {
  id: string
  image_id: string
  priority: 'interactive' | 'background'
  state: JobState
  progress: number
  stage: string | null
  created: number
  started: number | null
  finished: number | null
  error: string | null
  tiles_done: number
  tiles_total: number
}

export type StageCode = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

// ---- SSE events of one job (/api/events?job_id=)
export type JobEvent =
  | { type: 'job'; job: JobSummary }
  | { type: 'started'; pid: number }
  | { type: 'stage'; stage: StageCode; label: string; state: 'running' | 'done'; ms?: number }
  | { type: 'meta'; width: number; height: number; um_per_px: number | null; tile: number }
  | {
      type: 'tile'
      i: number
      n: number
      x: number
      y: number
      w: number
      h: number
      png: string
      running: { cells: number; neurite_px: number }
    }
  | { type: 'result'; result: Result }
  | { type: 'done' }
  | { type: 'cancelled'; reason?: string }
  | { type: 'error'; message: string }

// ---- global feed (/api/events)
export type GlobalEvent =
  | { type: 'job'; job: JobSummary }
  | { type: 'image'; image: ImageMeta }
  | { type: 'image_error'; image_id: string; message: string }
  | { type: 'model'; state: 'warming' | 'ready'; warm_ms: number | null }

export interface Health {
  status: string
  mock: boolean
  model: {
    state: 'warming' | 'ready'
    version: string
    provider: string
    runtime: string
    warm_ms: number | null
    workers: { interactive: number; background: number }
  }
  data_dir: string
  images: number
}

export interface RoiMetrics {
  area_px: number
  fg_ratio: number
  soma_px: number
  neurite_px: number
  mean_conf: number | null
  components: number
  cells: number
  mean_soma_area_px: number | null
  mean_circularity: number | null
  neurites: number
  neurite_length_px: number
  junctions: number
  angles_deg: number[]
  mock: boolean
}

export interface SimCell {
  image_id: string
  cell_id: number
  bbox: [number, number, number, number]
  centroid: [number, number]
  batch: string
  condition: string
  outlier: boolean
  area_px: number
  circularity: number
  eccentricity: number
  neurite_length_px: number
  branches: number
  nti: number
  xy: [number, number]
  nn: [number, number][]
  robust_dist: number
}

export interface SimGroup {
  a: string
  b: string
  n_a: number
  n_b: number
  distance: number
  per_feature: Record<string, number>
}

export interface Similarity {
  cells: SimCell[]
  features: string[]
  method: string
  explained_variance?: number[]
  group_key?: 'condition' | 'batch'
  groups: SimGroup[]
  batches?: string[]
  conditions?: string[]
  mock: boolean
}

export interface ReviewItem {
  id: string
  name: string
  mean_uncertainty: number
  cell_count: number
  status: ReviewStatus
  model_version: string
}
