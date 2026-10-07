// UI readability audit (dev tool, not shipped).
// Usage: copy to app/static/audit.js, open http://127.0.0.1:8765/?debug and run in the console:
//   const m = await import("/audit.js"); await m.runAll()
// Reports: text < 12 px, clipped/overflowing text, click targets < 28 px,
// off-centre button labels, controls outside the window. Rebuild removes the copy.
// Temporary UI audit (not shipped: app/static is rebuilt by `vite build`).
export function audit() {
  const out = { tiny: [], overflow: [], smallTarget: [], offCenter: [], offscreen: [] }
  const vw = innerWidth
  const vh = innerHeight
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) return false
    let e = el
    while (e && e !== document.body) {
      const s = getComputedStyle(e)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false
      e = e.parentElement
    }
    return true
  }
  const label = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    const cls = (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName).replace(/_[a-z0-9]{5,}$/i, '')
    return `${el.tagName.toLowerCase()}.${cls} "${t}"`
  }
  const inCanvasOverlay = (el) => el.closest('canvas') || el.closest('[class*=hoverTip]')

  // 1) text below 12 px (HTML text + SVG text)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const n = walker.currentNode
    if (!n.textContent.trim()) continue
    const el = n.parentElement
    if (!el || seen.has(el) || !visible(el) || inCanvasOverlay(el)) continue
    seen.add(el)
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 11.95) out.tiny.push(`${label(el)} ${fs}px`)
  }

  // 2) text clipped / overflowing its box (ellipsis with a tooltip is allowed)
  for (const el of document.querySelectorAll('button, a, span, div, label, td, th, b, h1, p')) {
    if (!visible(el) || inCanvasOverlay(el)) continue
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
    if (!hasText) continue
    const s = getComputedStyle(el)
    const clipsX = el.scrollWidth > el.clientWidth + 1
    const clipsY = el.scrollHeight > el.clientHeight + 2 && s.overflowY !== 'visible' && s.overflowY !== 'auto'
    if (clipsX || clipsY) {
      const ellipsis = s.textOverflow === 'ellipsis'
      const titled = el.title || el.closest('[title]')
      if (!(ellipsis && titled) && s.overflowX !== 'auto' && s.overflowX !== 'scroll')
        out.overflow.push(`${label(el)} scroll ${el.scrollWidth}x${el.scrollHeight} > box ${el.clientWidth}x${el.clientHeight}${ellipsis ? ' (ellipsis, no title)' : ''}`)
    }
    // content wider than its parent box (e.g. a nowrap badge poking out of a card)
    const par = el.parentElement
    if (par && getComputedStyle(par).display !== 'inline' && !/(auto|scroll)/.test(getComputedStyle(par).overflowX)) {
      const a = el.getBoundingClientRect(), b = par.getBoundingClientRect()
      if (a.right > b.right + 2 || a.left < b.left - 2) out.overflow.push(`${label(el)} wider than parent ${label(par)} (${Math.round(a.width)} > ${Math.round(b.width)})`)
    }
    // text spilling out of an interactive parent
    const host = el.closest('button, [role=button], [role=tab], [role=radio], [role=switch]')
    if (host && host !== el) {
      const a = el.getBoundingClientRect()
      const b = host.getBoundingClientRect()
      if (a.right > b.right + 1 || a.left < b.left - 1 || a.bottom > b.bottom + 1 || a.top < b.top - 1)
        out.overflow.push(`${label(el)} spills out of ${label(host)}`)
    }
  }

  // 3) click targets smaller than 28 px, 4) off-centre single-line button text
  for (const el of document.querySelectorAll('button, [role=button], [role=tab], [role=radio], [role=switch], input, select, a[href]')) {
    if (!visible(el) || el.closest('[class*=thumb]') || el.closest('canvas')) continue
    const r = el.getBoundingClientRect()
    if ((r.height < 27.5 || r.width < 27.5) && el.type !== 'checkbox' && el.type !== 'range' && !el.hidden)
      out.smallTarget.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    if (el.tagName === 'BUTTON' && el.innerText.trim() && !el.innerText.includes('\n')) {
      const range = document.createRange()
      const tn = [...el.querySelectorAll('*'), el].flatMap((n) => [...n.childNodes]).filter((c) => c.nodeType === 3 && c.textContent.trim())
      if (!tn.length) continue
      range.setStartBefore(tn[0]); range.setEndAfter(tn[tn.length - 1])
      const tr = range.getBoundingClientRect()
      const dy = Math.abs(tr.top + tr.height / 2 - (r.top + r.height / 2))
      if (tr.height > 0 && tr.height < r.height && dy > 2.5) out.offCenter.push(`${label(el)} dy=${dy.toFixed(1)}`)
    }
    const scroller = (() => { let e = el.parentElement; while (e && e !== document.body) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return e; e = e.parentElement } return null })()
    if (!scroller && (r.right > vw + 1 || r.bottom > vh + 1)) out.offscreen.push(`${label(el)} at ${Math.round(r.right)},${Math.round(r.bottom)}`)
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])]
  return { counts: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), ...out }
}

export async function runAll() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const app = window.__ic.app
  const res = {}
  const run = async (name, fn, wait = 1500) => { await fn(); await sleep(wait); res[name] = audit() }
  await run('analyze-empty', () => { app.getState().setScreen('analyze'); app.getState().select(null) })
  await run('analyze-metrics', () => { app.getState().select('snap-9650'); app.setState({ inspectorTab: 'metrics' }) }, 3500)
  await run('analyze-live', () => app.getState().analyze('snap-9650'), 2500)
  await sleep(6000)
  await run('analyze-layers', () => app.setState({ inspectorTab: 'layers' }))
  await run('analyze-objects', () => app.setState({ inspectorTab: 'objects' }))
  await run('analyze-qc', () => app.setState({ inspectorTab: 'qc' }))
  await run('compare', () => { app.getState().setCompare({ a: 'snap-9631', b: 'snap-9650', mode: 'split' }); app.getState().setScreen('compare') }, 3500)
  await run('compare-drawer', () => document.querySelector('[class*=drawerHead]')?.click())
  await run('compare-swipe', () => app.getState().setCompare({ mode: 'swipe' }), 2000)
  app.getState().setCompare({ mode: 'split' })
  await run('preprocess', () => app.getState().setScreen('preprocess'), 3000)
  await run('similarity', () => app.getState().setScreen('similarity'), 4000)
  await run('review', () => app.getState().setScreen('review'), 4000)
  await run('batch', () => app.getState().setScreen('batch'), 2500)
  await run('settings', () => app.getState().setScreen('settings'))
  await run('tray', () => document.querySelector('[class*=trayBtn]')?.click(), 800)
  await run('palette', () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); app.setState({ paletteOpen: true }) }, 800)
  await run('help', () => app.setState({ paletteOpen: false, helpOpen: true }), 800)
  await run('export', () => { app.setState({ helpOpen: false }); app.getState().setScreen('analyze'); app.setState({ exportOpen: true }) }, 1500)
  app.setState({ exportOpen: false })
  const all = {}
  for (const [k, v] of Object.entries(res)) for (const cat of ['tiny', 'overflow', 'smallTarget', 'offCenter', 'offscreen']) for (const it of v[cat]) (all[cat + ' | ' + it] ||= []).push(k)
  return { size: innerWidth + 'x' + innerHeight, theme: document.documentElement.dataset.theme, issues: Object.entries(all).map(([k, v]) => `${k}  [${v.length > 3 ? v.length + ' screens' : v.join(',')}]`) }
}
