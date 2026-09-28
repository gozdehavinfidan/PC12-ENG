import type { Cell, Junction, Result } from '../api/types'

/** Grid-bucketed spatial index: hover hit-tests stay O(1) per pointer move. */
export class HitIndex {
  private cells = new Map<number, Cell[]>()
  private juncs = new Map<number, Junction[]>()
  private B = 64
  private cols: number

  constructor(r: Result) {
    this.cols = Math.ceil(r.width / this.B) + 1
    for (const c of r.cells) {
      const [x0, y0, x1, y1] = c.bbox
      for (let bx = Math.floor(x0 / this.B); bx <= Math.floor(x1 / this.B); bx++)
        for (let by = Math.floor(y0 / this.B); by <= Math.floor(y1 / this.B); by++) this.push(this.cells, bx, by, c)
    }
    for (const j of r.junctions) this.push(this.juncs, Math.floor(j.x / this.B), Math.floor(j.y / this.B), j)
  }

  private push<T>(m: Map<number, T[]>, bx: number, by: number, v: T) {
    const k = by * this.cols + bx
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(v)
  }

  cellAt(x: number, y: number, slack: number): Cell | null {
    let best: Cell | null = null
    let bd = Infinity
    const bx = Math.floor(x / this.B)
    const by = Math.floor(y / this.B)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const c of this.cells.get((by + dy) * this.cols + bx + dx) ?? []) {
          const [x0, y0, x1, y1] = c.bbox
          if (x < x0 - slack || x > x1 + slack || y < y0 - slack || y > y1 + slack) continue
          const d = Math.hypot(c.centroid[0] - x, c.centroid[1] - y)
          if (d < bd) {
            bd = d
            best = c
          }
        }
    return best
  }

  junctionAt(x: number, y: number, radius: number): Junction | null {
    let best: Junction | null = null
    let bd = radius
    const bx = Math.floor(x / this.B)
    const by = Math.floor(y / this.B)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of this.juncs.get((by + dy) * this.cols + bx + dx) ?? []) {
          const d = Math.hypot(j.x - x, j.y - y)
          if (d < bd) {
            bd = d
            best = j
          }
        }
    return best
  }
}
