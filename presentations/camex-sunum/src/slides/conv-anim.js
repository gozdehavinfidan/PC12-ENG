// "How the network reads the image": sliding 256×256 window over the preprocessed
// image, then a 3×3 kernel sliding over a magnified part of the selected window.
// Driven by the generic step controller through window.deckApplyConvStep(step):
//   0 — preprocessed input only
//   1 — the 256 px window visits every position (step 224 px, 32 px overlap)
//   2 — one window is selected; a 3×3 kernel slides over its pixels and fills an output map
//   3 — same as 2 (summary cards are revealed by the controller)
(() => {
  const SRC = 'assets/figures/pc12_preprocessed.png';
  const TILE = 256, STEP = 224;
  const KERNEL = [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]];   // example: an edge/line detector
  const ZOOM_N = 12;                                            // magnified region: 12 × 12 pixels

  const imgCanvas = document.getElementById('conv-image');
  const zoomCanvas = document.getElementById('conv-zoom');
  if (!imgCanvas || !zoomCanvas) return;
  const section = imgCanvas.closest('section');
  const ictx = imgCanvas.getContext('2d');
  const zctx = zoomCanvas.getContext('2d');

  let img = null, W = 0, H = 0, pix = null;        // source image + gray values
  let windows = [], selected = 0, zoomOrigin = [0, 0];
  let step = 0, active = false, t0 = performance.now();

  const load = new Image();
  load.onload = () => {
    img = load; W = img.width; H = img.height;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d'); octx.drawImage(img, 0, 0);
    const d = octx.getImageData(0, 0, W, H).data;
    pix = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) pix[i] = d[i * 4] / 255;
    // window positions exactly as in predict_tiles(): range(0, H-256+1, 224) ∪ {H-256}
    const pos = (n) => { const s = new Set(); for (let v = 0; v <= n - TILE; v += STEP) s.add(v); s.add(Math.max(0, n - TILE)); return [...s].sort((a, b) => a - b); };
    pos(H).forEach((y) => pos(W).forEach((x) => windows.push([x, y])));
    selected = pickWindow();
    zoomOrigin = pickZoom(windows[selected]);
    draw(performance.now());
  };
  load.src = SRC;

  const g = (x, y) => pix[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];

  function pickWindow() {           // the window with the most structure (highest mean)
    let best = 0, bv = -1;
    windows.forEach(([x, y], i) => {
      let s = 0;
      for (let yy = y; yy < y + TILE; yy += 4) for (let xx = x; xx < x + TILE; xx += 4) s += g(xx, yy);
      if (s > bv) { bv = s; best = i; }
    });
    return best;
  }
  function pickZoom([wx, wy]) {     // the 12 × 12 region with the highest contrast inside the window
    let best = [wx + 100, wy + 100], bv = -1;
    for (let y = wy + 8; y < wy + TILE - ZOOM_N - 8; y += 6) for (let x = wx + 8; x < wx + TILE - ZOOM_N - 8; x += 6) {
      let m = 0, m2 = 0;
      for (let j = 0; j < ZOOM_N; j++) for (let i = 0; i < ZOOM_N; i++) { const v = g(x + i, y + j); m += v; m2 += v * v; }
      const n = ZOOM_N * ZOOM_N, mean = m / n, sd = m2 / n - mean ** 2;
      const score = mean > 0.45 ? -1 : sd;      // a thin bright line on dark ground, not a soma
      if (score > bv) { bv = score; best = [x, y]; }
    }
    return best;
  }

  // ---------- drawing ----------
  function drawImagePanel(now) {
    const cw = imgCanvas.width, ch = imgCanvas.height;
    const s = Math.min(cw / W, ch / H), ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;
    ictx.fillStyle = '#0B0F14'; ictx.fillRect(0, 0, cw, ch);
    ictx.imageSmoothingEnabled = true;
    ictx.drawImage(img, ox, oy, W * s, H * s);
    const rect = (x, y, w, h) => [ox + x * s, oy + y * s, w * s, h * s];

    if (step >= 1) {
      let cur;
      if (step === 1) {               // visit every window, 1.1 s each, loop
        const k = Math.floor(Math.max(0, now - t0) / 1100) % windows.length;
        cur = k;
        for (let i = 0; i < k; i++) {  // visited windows: light tint, overlaps get darker
          ictx.fillStyle = 'rgba(37, 99, 235, 0.10)';
          ictx.fillRect(...rect(windows[i][0], windows[i][1], TILE, TILE));
        }
      } else {
        cur = selected;
      }
      const [x, y] = windows[cur];
      ictx.fillStyle = 'rgba(232, 163, 23, 0.16)';
      ictx.fillRect(...rect(x, y, TILE, TILE));
      ictx.lineWidth = 4; ictx.strokeStyle = '#E8A317';
      ictx.strokeRect(...rect(x, y, TILE, TILE));
      ictx.font = '700 22px Manrope, sans-serif'; ictx.fillStyle = '#E8A317';
      const [rx, ry] = rect(x, y, TILE, TILE);
      ictx.fillText(`window ${cur + 1} / ${windows.length} · 256 × 256`, rx + 10, ry + 30);
      if (step >= 2) {               // where the magnified region sits
        ictx.lineWidth = 3; ictx.strokeStyle = '#22D3EE';
        ictx.strokeRect(...rect(zoomOrigin[0], zoomOrigin[1], ZOOM_N, ZOOM_N));
      }
    }
    ictx.font = '600 20px Manrope, sans-serif'; ictx.fillStyle = 'rgba(255,255,255,0.75)';
    ictx.fillText(`preprocessed input · ${W} × ${H} px`, 18, ch - 18);
  }

  function drawZoomPanel(now) {
    const cw = zoomCanvas.width, ch = zoomCanvas.height;
    zctx.clearRect(0, 0, cw, ch);
    const [wx, wy] = windows[step >= 2 ? selected : (step === 1 ? Math.floor(Math.max(0, now - t0) / 1100) % windows.length : selected)];
    // (a) the window itself
    const P = 300;
    zctx.drawImage(img, wx, wy, TILE, TILE, 0, 0, P, P);
    zctx.lineWidth = 4; zctx.strokeStyle = '#E8A317'; zctx.strokeRect(2, 2, P - 4, P - 4);
    label('network input · 256 × 256', 0, P + 30, '#0E1A33');
    if (step < 2) { label('→ one window at a time', 330, 150, '#5B6781'); return; }

    // zoom marker inside the window
    const zs = P / TILE;
    zctx.lineWidth = 3; zctx.strokeStyle = '#22D3EE';
    zctx.strokeRect((zoomOrigin[0] - wx) * zs, (zoomOrigin[1] - wy) * zs, ZOOM_N * zs, ZOOM_N * zs);

    // (b) kernel weights
    const KX = 380, KY = 40, KC = 58;
    label('3 × 3 kernel (weights)', KX, KY - 12, '#0E1A33');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      // symbolic weights w1..w9: the values are learned, so none are shown
      zctx.fillStyle = '#DCE7FB';
      zctx.fillRect(KX + i * KC, KY + j * KC, KC - 4, KC - 4);
      const cx = KX + i * KC + (KC - 4) / 2 - 6, cy = KY + j * KC + 36;
      zctx.fillStyle = '#0E1A33'; zctx.textAlign = 'center';
      zctx.font = 'italic 700 26px Manrope, sans-serif'; zctx.fillText('w', cx, cy);
      zctx.font = '700 15px Manrope, sans-serif'; zctx.fillText(String(j * 3 + i + 1), cx + 14, cy + 6);
      zctx.textAlign = 'left';
    }
    label('learned in training', KX, KY + 3 * KC + 22, '#5B6781');

    // (c) magnified pixels with the sliding kernel, (d) output map filling up
    const C = 24, GX = 0, GY = 396, OUT = ZOOM_N - 2, OX = 340, OY = GY + C;
    const k = Math.floor(Math.max(0, now - t0) / 260) % (OUT * OUT);
    const kr = Math.floor(k / OUT), kc = k % OUT;
    zctx.fillStyle = '#3A4458';
    zctx.fillRect(GX - 2, GY - 2, ZOOM_N * C + 3, ZOOM_N * C + 3);
    zctx.fillRect(OX - 2, OY - 2, OUT * C + 3, OUT * C + 3);
    for (let j = 0; j < ZOOM_N; j++) for (let i = 0; i < ZOOM_N; i++) {
      const v = Math.round(g(zoomOrigin[0] + i, zoomOrigin[1] + j) * 255);
      zctx.fillStyle = `rgb(${v},${v},${v})`;
      zctx.fillRect(GX + i * C, GY + j * C, C - 1, C - 1);
    }
    zctx.lineWidth = 4; zctx.strokeStyle = '#F59E0B';
    zctx.strokeRect(GX + kc * C - 1, GY + kr * C - 1, 3 * C + 1, 3 * C + 1);
    label('pixels (zoom)', GX, GY - 12, '#0E1A33');

    for (let n = 0; n <= k; n++) {
      const r = Math.floor(n / OUT), c = n % OUT;
      let acc = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) acc += KERNEL[j][i] * g(zoomOrigin[0] + c + i, zoomOrigin[1] + r + j);
      const v = Math.round(Math.max(0, Math.min(1, 0.5 + acc * 0.6)) * 255);
      zctx.fillStyle = `rgb(${v},${v},${v})`;
      zctx.fillRect(OX + c * C, OY + r * C, C - 1, C - 1);
    }
    zctx.lineWidth = 4; zctx.strokeStyle = '#F59E0B';
    zctx.strokeRect(OX + kc * C - 1, OY + kr * C - 1, C + 1, C + 1);
    label('feature map', OX, GY - 12, '#0E1A33');
    zctx.font = '300 44px Manrope, sans-serif'; zctx.fillStyle = '#A3ADC2';
    zctx.fillText('→', ZOOM_N * C + 10, GY + ZOOM_N * C / 2 + 14);
    label('9 pixels × 9 weights → 1 value', 0, GY + ZOOM_N * C + 34, '#5B6781');
  }

  function label(text, x, y, color) {
    zctx.font = '700 23px Manrope, sans-serif'; zctx.fillStyle = color; zctx.fillText(text, x, y);
  }

  function draw(now) {
    if (!img) return;
    drawImagePanel(now);
    drawZoomPanel(now);
  }
  function loop(now) {
    if (!active) return;
    draw(now);
    requestAnimationFrame(loop);
  }

  window.deckApplyConvStep = (n) => { step = n; t0 = performance.now(); draw(t0); };

  const deck = document.querySelector('deck-stage');
  const setActive = (on) => {
    if (on && !active) { active = true; t0 = performance.now(); requestAnimationFrame(loop); }
    if (!on) active = false;
  };
  if (deck) deck.addEventListener('slidechange', (e) => setActive(e.detail && e.detail.slide === section));
  if (section && section.hasAttribute('data-deck-active')) setActive(true);
})();
