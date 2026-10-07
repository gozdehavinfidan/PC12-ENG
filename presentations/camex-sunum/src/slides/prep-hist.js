// Preprocessing slide: intensity histogram of the slide-3 image after each step
// (data from tools/make_prep_steps.py, which runs the steps of ml/final_pipeline.py).
// Driven by the generic step controller through window.deckApplyPrepStep(step):
//   0 — empty axes
//   1 — bars grow: max(R, G, B) / 255, piled up near 0
//   2 — bars morph to the downscaled image: same shape, 9× fewer pixels
//   3 — P1 / P99.8 markers appear, then the axis is stretched so P1 → 0 and P99.8 → 1
// Every value eases toward the target of the current step, so stepping back reverses it.
(() => {
  const canvas = document.getElementById('prep-hist');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const CW = canvas.width, CH = canvas.height;
  const PAD = { l: 170, r: 40, t: 46, b: 64 };
  const PW = CW - PAD.l - PAD.r, PH = CH - PAD.t - PAD.b;
  const BAR = '#2F9E44', PILE = '#E8590C', MARK = '#2563EB', INK = '#0F172A', MUTED = '#64748B';

  let D = null;
  const cur = { grow: 0, morph: 0, mark: 0, stretch: 0 };
  const tgt = { grow: 0, morph: 0, mark: 0, stretch: 0 };
  let raf = 0, timer = 0;

  fetch('assets/figures/prep_hist.json').then((r) => r.json()).then((d) => { D = d; kick(); });

  const lg = (n) => Math.log10(n + 1);
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : Math.round(n / 1e3) + ' k');

  window.deckApplyPrepStep = (step) => {
    clearTimeout(timer);
    tgt.grow = step >= 1 ? 1 : 0;
    tgt.morph = step >= 2 ? 1 : 0;
    tgt.mark = step >= 3 ? 1 : 0;
    if (step >= 3) timer = setTimeout(() => { tgt.stretch = 1; kick(); }, 700);
    else tgt.stretch = 0;
    kick();
  };

  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick() {
    raf = 0;
    let moving = false;
    for (const k in cur) {
      const d = tgt[k] - cur[k];
      if (Math.abs(d) > 0.002) { cur[k] += d * 0.12; moving = true; } else cur[k] = tgt[k];
    }
    draw();
    if (moving) raf = requestAnimationFrame(tick);
  }

  function draw() {
    ctx.clearRect(0, 0, CW, CH);
    if (!D) return;
    const n = D.bins, a = D.p_lo, b = D.p_hi;
    const yMax = lg(Math.max(...D.s1)) * 1.05;
    const X = (v) => PAD.l + v * PW;
    const Y = (h) => PAD.t + PH - (h / yMax) * PH;
    // position of an intensity value under the current stretch
    const map = (v) => v + cur.stretch * (Math.min(1, Math.max(0, (v - a) / (b - a))) - v);

    // axes
    ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + PH); ctx.lineTo(PAD.l + PW, PAD.t + PH); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = '500 22px Manrope, system-ui, sans-serif'; ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => ctx.fillText(String(v), X(v), PAD.t + PH + 30));
    ctx.fillText('intensity', PAD.l + PW / 2, PAD.t + PH + 58);
    ctx.save(); ctx.translate(28, PAD.t + PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('pixels', 0, 0); ctx.restore();
    // y ticks: real pixel counts, one tick per factor of 10
    ctx.textAlign = 'right'; ctx.font = '500 19px Manrope, system-ui, sans-serif';
    for (let k = 0; k <= 6; k++) {
      const y = Y(Math.log10(10 ** k + 1));
      ctx.strokeStyle = '#EEF1F5'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l + 2, y); ctx.lineTo(PAD.l + PW, y); ctx.stroke();
      ctx.fillStyle = MUTED; ctx.fillText((10 ** k).toLocaleString('en-US').replace(/,/g, ' '), PAD.l - 10, y + 6);
    }

    // bars: log height, morphing from step 1 to step 2; x edges follow the stretch
    let pile = 0;
    ctx.fillStyle = BAR;
    for (let i = 0; i < n; i++) {
      const lo = i / n, hi = (i + 1) / n;
      const h = (lg(D.s1[i]) + cur.morph * (lg(D.s2[i]) - lg(D.s1[i]))) * cur.grow;
      if (h <= 0) continue;
      if (lo >= b) pile += D.s2[i];
      const x0 = X(map(lo)), x1 = X(map(hi));
      if (x1 - x0 < 0.5) continue;
      ctx.fillRect(x0 + 1, Y(h), Math.max(1, x1 - x0 - 2), PAD.t + PH - Y(h));
    }
    // pixels above P99.8 are clipped to 1
    if (cur.stretch > 0.02 && pile > 0) {
      const h = lg(pile) * cur.stretch, w = PW / n;
      ctx.fillStyle = PILE; ctx.fillRect(X(1) - w + 1, Y(h), w - 2, PAD.t + PH - Y(h));
      ctx.globalAlpha = cur.stretch; ctx.textAlign = 'right'; ctx.font = '700 20px Manrope, system-ui, sans-serif';
      ctx.fillText(`clipped to 1 · ${D.clipped_hi_pct} %`, X(1) - w - 8, Y(h) + 6); ctx.globalAlpha = 1;
    }

    // brightest pixel (before the stretch; it is clipped to 1 afterwards)
    const mAlpha = cur.grow * (1 - cur.stretch);
    if (mAlpha > 0.02) {
      // dashed line along the right edge of the last non-empty bar (the one holding the maximum)
      const mv = D.max1 + cur.morph * (D.max2 - D.max1);
      const i = Math.min(n - 1, Math.floor(mv * n));
      // its value is written under the axis, like the other ticks
      const x = X((i + 1) / n) + 2;
      ctx.globalAlpha = mAlpha; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + PH + 8); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = 'center'; ctx.font = '700 22px Manrope, system-ui, sans-serif';
      ctx.fillText(mv.toFixed(2), x, PAD.t + PH + 30); ctx.globalAlpha = 1;
    }

    // percentile markers
    if (cur.mark > 0.02) {
      ctx.globalAlpha = cur.mark; ctx.strokeStyle = MARK; ctx.fillStyle = MARK; ctx.lineWidth = 3; ctx.setLineDash([10, 7]);
      [[a, '1 % = ' + a.toFixed(2)], [b, '99.8 % = ' + b.toFixed(2)]].forEach(([v, t]) => {
        const x = X(map(v));
        ctx.beginPath(); ctx.moveTo(x, PAD.t - 6); ctx.lineTo(x, PAD.t + PH); ctx.stroke();
        ctx.textAlign = v < 0.05 ? 'left' : 'right'; ctx.font = '800 22px Manrope, system-ui, sans-serif';
        ctx.fillText(t, x + (v < 0.05 ? 10 : -10), PAD.t + 14);
      });
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // pixel count
    if (cur.grow > 0.02) {
      ctx.globalAlpha = cur.grow; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = '800 24px Manrope, system-ui, sans-serif';
      ctx.fillText('pixels: ' + fmt(D.n1 + cur.morph * (D.n2 - D.n1)), PAD.l + PW / 2, PAD.t - 14);
      ctx.globalAlpha = 1;
    }
  }
})();
