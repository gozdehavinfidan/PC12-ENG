// Count-up numbers (as on the template's performance slide).
// <span data-count="0.823" data-dec="3" data-prefix="+">…</span> counts from 0 to the
// target when it becomes visible: inside a .frag when the step reveals it, otherwise
// when its slide becomes active.
(() => {
  const deck = document.querySelector('deck-stage');
  const nodes = Array.from(document.querySelectorAll('[data-count]'));
  if (!deck || !nodes.length) return;

  const fmt = (el, v) => {
    const dec = parseInt(el.dataset.dec || '0', 10);
    const pre = el.dataset.prefix || '';
    return pre + v.toFixed(dec);
  };
  const finalText = (el) => fmt(el, parseFloat(el.dataset.count));
  nodes.forEach((el) => { el.textContent = finalText(el); });

  function run(el) {
    const target = parseFloat(el.dataset.count);
    const t0 = performance.now(), dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(el, target * e);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = finalText(el);
    };
    requestAnimationFrame(tick);
  }

  // numbers inside a step-revealed element start when it is revealed
  nodes.forEach((el) => {
    const frag = el.closest('.frag');
    if (!frag) return;
    let was = frag.classList.contains('is-revealed');
    new MutationObserver(() => {
      const now = frag.classList.contains('is-revealed');
      if (now && !was) run(el);
      was = now;
    }).observe(frag, { attributes: true, attributeFilter: ['class'] });
  });

  // the others start when their slide is entered
  deck.addEventListener('slidechange', (e) => {
    const slide = e.detail && e.detail.slide;
    if (!slide) return;
    nodes.forEach((el) => { if (slide.contains(el) && !el.closest('.frag')) run(el); });
  });
})();
