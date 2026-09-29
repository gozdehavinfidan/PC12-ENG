// Contract test: a recorded SSE stream from the real pipeline (synthetic image,
// safe to commit) must satisfy the event protocol the UI is built on
// (CLAUDE.md s4.1 / s8). Run: npm test
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { niceScale } from '../lib/format'
import type { JobEvent, Result } from './types'

const events: JobEvent[] = readFileSync(resolve(__dirname, '../../../fixtures/sse-synth-fixture.jsonl'), 'utf-8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))

describe('SSE job stream (fixture replay)', () => {
  it('runs S0..S5 in order, each running before done', () => {
    const stages = events.filter((e): e is Extract<JobEvent, { type: 'stage' }> => e.type === 'stage')
    const done = stages.filter((s) => s.state === 'done').map((s) => s.stage)
    expect(done).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'S5'])
    for (const code of done) {
      const iRun = stages.findIndex((s) => s.stage === code && s.state === 'running')
      const iDone = stages.findIndex((s) => s.stage === code && s.state === 'done')
      expect(iRun).toBeGreaterThanOrEqual(0)
      expect(iRun).toBeLessThan(iDone)
    }
  })

  it('announces the image size before the first tile', () => {
    const iMeta = events.findIndex((e) => e.type === 'meta')
    const iTile = events.findIndex((e) => e.type === 'tile')
    expect(iMeta).toBeGreaterThanOrEqual(0)
    expect(iMeta).toBeLessThan(iTile)
  })

  it('streams every tile exactly once, in order, covering the image', () => {
    const meta = events.find((e) => e.type === 'meta') as Extract<JobEvent, { type: 'meta' }>
    const tiles = events.filter((e): e is Extract<JobEvent, { type: 'tile' }> => e.type === 'tile')
    expect(tiles.map((t) => t.i)).toEqual(tiles.map((_, k) => k))
    expect(tiles.every((t) => t.n === tiles.length)).toBe(true)
    const area = tiles.reduce((a, t) => a + t.w * t.h, 0)
    expect(area).toBe(meta.width * meta.height)
    expect(tiles.every((t) => t.png.startsWith('iVBOR'))).toBe(true) // base64 PNG magic
  })

  it('ends with a s8-shaped result flagged mock, then done', () => {
    const last = events[events.length - 1]
    expect(last.type).toBe('done')
    const r = (events.find((e) => e.type === 'result') as { result: Result }).result
    expect(r.mock).toBe(true)
    for (const k of ['image_id', 'model_version', 'cells', 'neurites', 'angles_deg', 'nti', 'qc'] as const) expect(r).toHaveProperty(k)
    expect(Object.keys(r.nti.contrib).sort()).toEqual(['angle', 'branching', 'neurite_length', 'soma'])
    expect(r.nti.score).toBeGreaterThanOrEqual(0)
    expect(r.nti.score).toBeLessThanOrEqual(1)
    for (const c of r.cells) {
      expect(c.centroid).toHaveLength(2)
      expect(typeof c.outlier).toBe('boolean')
    }
    for (const n of r.neurites) expect(n.polyline.length).toBeGreaterThanOrEqual(2)
  })
})

describe('scale bar', () => {
  it('picks 1/2/5 x 10^n lengths near the target width', () => {
    for (const upp of [0.01, 0.37, 3.7, 12]) {
      const n = niceScale(upp, 100)
      const m = n.value / Math.pow(10, Math.floor(Math.log10(n.value)))
      expect([1, 2, 5]).toContain(Math.round(m))
      expect(n.px).toBeGreaterThan(40)
      expect(n.px).toBeLessThan(260)
    }
  })
})
