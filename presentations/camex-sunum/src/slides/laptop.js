/**
 * CAMEX slide — 3D MacBook with full ksenia-k opening animation, showing the
 * four CAMEX screens (Analyze → Compare → Review → Similarity).
 * Adapted from the 2242 template (src/slides/12-doctor-panel/main.js).
 *
 * Source: https://codepen.io/ksenia-k/pen/gOEgyaj
 * Source mirror (gist): https://gist.github.com/hendricksonweib/91cb05491317e9e7341aac10ec980d9d
 *
 * Adaptations from the original pen:
 *   - Mounts inside the slide's #laptop-stage container (not full window).
 *   - No GUI controls, no webcam capture (those were demo-only affordances).
 *   - Screen image URL configurable via SCREEN_IMAGE_URL — currently the
 *     ksenia dog placeholder; user will swap to a DiaSAGE site screenshot.
 *   - Animation re-triggers when slide 10 enters view.
 *
 * Everything else (laptop appear, lid open, screen wake, content scroll,
 * floating bob) matches the original pen frame-for-frame.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =====================================================================
// CONFIG — CAMEX screenshots shown on the laptop screen.
// =====================================================================
// Dört ekran görüntüsü KENDİLİĞİNDEN dönmez: hangi görüntünün ekranda olduğu
// generic step controller'ın (index.html) adım durumudur ve yalnızca
// sunucunun İleri/Geri komutuyla değişir (window.deckApplyDoctorPanelStep).
// Sıra, sağdaki panel-orb kartlarıyla birebirdir: Analyze → Compare → Review → Similarity.
// Eksik bir görüntü (henüz eklenmemiş ekran) çökme yapmaz: ekran düz koyu kalır.
// Each image is "cover-fit" into the 16:10 screen aspect (centered +
// cropped to fill) — taller-than-16:10 images are cropped top/bottom,
// wider ones are cropped left/right.
const SCREEN_IMAGE_URLS = [
  'assets/figures/ui_analyze.png',
  'assets/figures/ui_compare.png',
  'assets/figures/ui_review.png',
  'assets/figures/ui_similarity.png',
];
const LAPTOP_GLB_URL    = 'assets/models/mac-noUv.glb';  // vendored locally (was ksenia-k.com) → works offline
const SCREEN_SIZE       = [29.4, 20];
// CanvasTexture resolution backing the screen plane.
// Sized close to the source images' native pixel dimensions (~1720×1000
// across the three doctor-*.png screens) so drawImage runs ~1:1 instead
// of upscaling 2.2× — that upscale was the cause of the blurry UI on
// the laptop screen. Bonus: GPU texture upload is now 4× smaller
// (9 MB vs 36 MB), which also speeds up the slide-10 first render.
const SCREEN_CANVAS_W   = 1920;
const SCREEN_CANVAS_H   = 1200;

(async function bootstrap() {
  const container = document.getElementById('laptop-stage');
  if (!container) return;

  const deck = document.querySelector('deck-stage');
  if (!deck) return;

  // Only direct children: nested <section>s inside slide 13 must not shift
  // the index this is compared against (deck.index counts slides only).
  const sections = Array.from(deck.querySelectorAll(':scope > section'));
  const slideIndex = sections.findIndex(
    (s) => s.getAttribute('data-label') === 'CAMEX'
  );
  if (slideIndex < 0) return;

  // ---- Three.js scene ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight || 1,
    10,
    1000
  );
  // Two camera framings, animated WIDE→CLOSE in the GSAP timeline:
  //   • CAM_WIDE  — the whole laptop is visible while it slides up and the lid
  //     swings open, so the OPENING reads clearly (user: "biraz uzaktan, bütün
  //     laptop görünecek şekilde başlayacak — bu branch'in en başındaki gibi").
  //     This mirrors the branch's original framing (pos 0,1,42 / look 0,-1,-10),
  //     re-tuned for the laptop's current rest pose (macGroup.y = -6).
  //   • CAM_CLOSE — once the laptop is fully open, the camera dollies in to the
  //     WEB SCREEN: raised to the open-lid screen height and pulled close so the
  //     screen fills the frame and the keyboard base reads as "cut off" (still
  //     clearly a laptop — hinge + rear of the base stay visible, not a tablet).
  // lookAt is driven EVERY FRAME from camTarget (see tick()), so the focus point
  // can be tweened too. Both framings tuned empirically via Playwright.
  const CAM_WIDE  = { pos: [0, 4, 46], look: [0, 2.5, -10] };
  const CAM_CLOSE = { pos: [0, 4.8, 19], look: [0, 4.8, -10] };
  const camTarget = new THREE.Vector3(CAM_WIDE.look[0], CAM_WIDE.look[1], CAM_WIDE.look[2]);
  camera.position.set(CAM_WIDE.pos[0], CAM_WIDE.pos[1], CAM_WIDE.pos[2]);
  camera.lookAt(camTarget);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',  // request the discrete GPU when available
  });
  // SRGB color space for correct gamma — perceived contrast (and thus
  // perceived sharpness) goes up because edges between dark/light show
  // their full luminance delta.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Render at DPR=1 (cap 1). Measured: at cap 2 the slide-10 frame
  // budget burned 30-40 ms steadily after the first 250 ms of the
  // mainTl animation, holding at 33 fps. At cap 1 the fragment shader
  // workload drops 4× on Retina, comfortably restoring 60 fps. The
  // visual difference is invisible at projection / 1080p viewing —
  // antialias:true still smooths sub-pixel bezel edges, and the screen
  // texture is rendered from a 1920×1200 canvas anyway so its sharpness
  // is bounded by the texture, not the render resolution.
  renderer.setPixelRatio(1);
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  container.appendChild(renderer.domElement);

  // WebGL context-loss resilience: a GPU driver hiccup, tab backgrounding, or a
  // switchable-graphics handoff can drop the context mid-presentation. Without
  // handling, render() throws and the laptop freezes/blanks. We pause rendering
  // on loss and resume on restore (Three.js re-uploads GPU resources itself).
  let glLost = false;
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLost = true; }, false);
  renderer.domElement.addEventListener('webglcontextrestored', () => { glLost = false; }, false);

  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const lightHolder = new THREE.Group();
  scene.add(lightHolder);

  const keyLight = new THREE.PointLight(0xfff5e1, 0.8);
  keyLight.position.set(0, 5, 50);
  lightHolder.add(keyLight);

  const macGroup = new THREE.Group();
  macGroup.position.z = -10;
  scene.add(macGroup);

  const lidGroup = new THREE.Group();
  macGroup.add(lidGroup);

  const bottomGroup = new THREE.Group();
  macGroup.add(bottomGroup);

  // ---- Materials ----
  const textLoader = new THREE.TextureLoader();

  // CanvasTexture-backed screen so the laptop displays a single 16:10
  // surface regardless of source image aspect ratio. Cover-fit draw
  // semantics + we bump the texture version aggressively to force
  // re-upload to GPU each frame the canvas content changes.
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = SCREEN_CANVAS_W;
  screenCanvas.height = SCREEN_CANVAS_H;
  const screenCtx = screenCanvas.getContext('2d');
  // imageSmoothingQuality stays at the browser default ('low' / fast
  // bilinear). Reason: redrawScreen() actually runs EVERY FRAME during
  // the ~800ms crossfade phase, doing 2 drawImage calls per frame.
  // 'high' (Lanczos-like multi-tap) costs ~5-10 ms per call, blowing
  // the 16.7 ms frame budget. Bilinear is ~1 ms per call and looks
  // good enough now that the canvas is sized close to source pixels
  // (1920×1200 vs 1720×986 — minimal scaling needed anyway).
  screenCtx.fillStyle = '#000000';
  screenCtx.fillRect(0, 0, SCREEN_CANVAS_W, SCREEN_CANVAS_H);

  const screenImageTexture = new THREE.CanvasTexture(screenCanvas);
  screenImageTexture.flipY = false;
  screenImageTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  screenImageTexture.colorSpace = THREE.SRGBColorSpace;
  // Linear filtering with NO mipmaps — mipmap regeneration on every
  // canvas change was causing the texture to lag behind the cycle.
  // At our display size the texture is barely minified anyway so
  // dropping mipmaps doesn't visibly hurt sharpness.
  screenImageTexture.minFilter = THREE.LinearFilter;
  screenImageTexture.magFilter = THREE.LinearFilter;
  screenImageTexture.generateMipmaps = false;

  const screenImages = SCREEN_IMAGE_URLS.map(url => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    return img;
  });

  // Top portion of the canvas that gets occluded by the GLB's screen-frame
  // bezel mesh once the lid opens. Measured empirically via gl.readPixels:
  // the bezel covers ~5.2% of the plane top edge (the bezel mesh extends
  // higher than the plane top in world Y due to its 3D shape). 8% is used
  // as a safety margin so headers stay clear of the bezel even if camera
  // framing shifts slightly (e.g. resize).
  const TOP_SAFE_MARGIN = 0.08;
  // Bottom occlusion is smaller and less critical (laptop chin), but we
  // give it a small reserve too so cards near image bottom aren't half-cut.
  const BOTTOM_SAFE_MARGIN = 0.04;

  function drawImageCover(img, alpha) {
    if (!img.complete || !img.naturalWidth) return false;
    const cw = SCREEN_CANVAS_W;
    const ch = SCREEN_CANVAS_H;
    // Safe rect: the canvas region that actually appears on the visible
    // screen face (excluding bezel-occluded top + chin-occluded bottom).
    const safeTop = Math.round(ch * TOP_SAFE_MARGIN);
    const safeH   = ch - safeTop - Math.round(ch * BOTTOM_SAFE_MARGIN);
    const ar = img.naturalWidth / img.naturalHeight;
    const target = cw / safeH;
    let dw, dh;
    if (ar > target) { dh = safeH; dw = safeH * ar; }
    else             { dw = cw;    dh = cw / ar; }
    // Top-anchor inside the safe rect — guarantees the image's TOP edge
    // (where headers like DiaSAGE nav bar / "Dr. Gözde Havin Fidan" /
    // "Güncel glukoz" card live) lands at the visible top of the screen,
    // never hidden behind the bezel. Horizontally centered as before.
    // The screen plane's rotation.x = Math.PI + flipY=false combination
    // is a NO-OP (two flips cancel), so canvas y=0 = screen top.
    const dx = (cw - dw) / 2;
    const dy = safeTop;
    screenCtx.globalAlpha = alpha;
    screenCtx.drawImage(img, dx, dy, dw, dh);
    screenCtx.globalAlpha = 1;
    return true;
  }

  let currentIdx = 0;

  // Notify the slide's HTML (the .panel-orb cards on the right side)
  // whenever the currently displayed screen image changes, so the
  // matching orb can light up. Dispatched on the top-level window so
  // any sibling script in index.html can listen without coupling.
  function emitPanelChange(idx) {
    try {
      window.dispatchEvent(new CustomEvent('panelchange', { detail: { index: idx } }));
    } catch (e) {}
  }

  function redrawScreen() {
    // Dark app background: a screen whose image is missing reads as a blank app window.
    screenCtx.fillStyle = '#16171d';
    screenCtx.fillRect(0, 0, SCREEN_CANVAS_W, SCREEN_CANVAS_H);
    drawImageCover(screenImages[currentIdx], 1);
    screenImageTexture.needsUpdate = true;
  }

  // Ekran + orb durumunun TEK sahibi generic step controller'dır (index.html).
  // step 0 → Analyze bekleme ekranı (orb vurgusu yok); step 1..4 → sırasıyla
  // Analyze / Compare / Review / Similarity ekranı + eşleşen orb. Olay YAYMAZ (deck-localstep'i
  // controller'ın setStep'i yayar); panelchange yalnızca orb vurgusu içindir.
  window.deckApplyDoctorPanelStep = (step) => {
    step = parseInt(step, 10) || 0;
    const idx = step <= 0 ? 0 : Math.min(step - 1, screenImages.length - 1);
    currentIdx = idx;
    if (imagesReady) redrawScreen();
    emitPanelChange(step <= 0 ? -1 : idx);
  };

  let imagesReady = false;
  Promise.all(screenImages.map(img => new Promise(res => {
    if (img.complete && img.naturalWidth > 0) { res(); return; }
    img.addEventListener('load', () => res(), { once: true });
    img.addEventListener('error', () => res(), { once: true });
  }))).then(() => {
    imagesReady = true;
    // Geç çözülen görüntüler: controller'ın o ana dek uyguladığı adım neyse
    // (currentIdx) onu çiz — yarış olmaz.
    redrawScreen();
  });

  // Keyboard overlay PNG (alpha-masked white letters on black plane).
  // Mipmap generation was producing a single-frame jank when the texture
  // finished loading mid-animation (GPU has to generate every mip level
  // synchronously on upload). The keyboard plane is rendered at a near-
  // grazing angle but at a fixed scale, so linear minification without
  // mips is visually indistinguishable here.
  const keyboardTexture = textLoader.load(
    'assets/textures/keyboard-overlay.png',  // vendored locally (was ksenia-k.com) → works offline
    (tex) => {
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
    },
    undefined,
    // Don't fail silently: if the keyboard overlay can't load the keys are just
    // a featureless slab — log it rather than leaving no trace.
    (err) => console.warn('[camex-laptop] keyboard overlay texture failed to load:', err)
  );

  // MeshLambertMaterial (diffuse-only) instead of MeshStandardMaterial
  // (full metallic-roughness PBR with Fresnel + GGX BRDF). Measured:
  // PBR material across the laptop's 5-6 large meshes burned 20-30 ms
  // of fragment-shader time per frame, dragging slide 10 to 33 fps.
  // Lambert's diffuse-only lighting is 3-4× cheaper, restores 60 fps,
  // and the visual difference is invisible at projection distance
  // (we don't see specular highlights on a laptop body from 2+ meters).
  const darkPlasticMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  const cameraMaterial   = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const baseMetalMaterial = new THREE.MeshLambertMaterial({ color: 0xcecfd3 });
  const logoMaterial      = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const keyboardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    alphaMap: keyboardTexture,
    transparent: true,
  });
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: screenImageTexture,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
  });

  // ---- Load GLB ----
  let mainTl;

  new GLTFLoader().load(
    LAPTOP_GLB_URL,
    (glb) => {
      parseModel(glb);
      addScreen();
      addKeyboard();
      buildTimelines();

      if (deck.index === slideIndex) {
        mainTl.play(0);
      }
    },
    undefined,
    (err) => console.error('[camex-laptop] Failed to load laptop GLB:', err)
  );

  function parseModel(glb) {
    [...glb.scene.children].forEach((child) => {
      if (child.name === '_top') {
        lidGroup.add(child);
        [...child.children].forEach((mesh) => {
          if (mesh.name === 'lid') mesh.material = baseMetalMaterial;
          else if (mesh.name === 'logo') mesh.material = logoMaterial;
          else if (mesh.name === 'screen-frame') mesh.material = darkPlasticMaterial;
          else if (mesh.name === 'camera') mesh.material = cameraMaterial;
        });
      } else if (child.name === '_bottom') {
        bottomGroup.add(child);
        [...child.children].forEach((mesh) => {
          if (mesh.name === 'base') mesh.material = baseMetalMaterial;
          else if (mesh.name === 'legs') mesh.material = darkPlasticMaterial;
          else if (mesh.name === 'keyboard') mesh.material = darkPlasticMaterial;
          else if (mesh.name === 'inner') mesh.material = darkPlasticMaterial;
        });
      }
    });
  }

  let screenMesh, screenLight;

  function addScreen() {
    screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SCREEN_SIZE[0], SCREEN_SIZE[1]),
      screenMaterial
    );
    screenMesh.position.set(0, 10.5, -0.11);
    screenMesh.rotation.set(Math.PI, 0, 0);
    lidGroup.add(screenMesh);

    // Was: THREE.RectAreaLight — its LTC (Linearly Transformed Cosines)
    // shader path costs 3-5× a comparable PointLight per affected
    // fragment, and (since RectAreaLightUniformsLib.init() was never
    // called) we were paying that cost without even getting correct
    // visuals. PointLight gives a similar "screen wakes up" glow on the
    // lid/keyboard at a fraction of the GPU cost — and matches the rest
    // of the rig (keyLight is also a PointLight).
    screenLight = new THREE.PointLight(0xffffff, 0, 60, 2);
    screenLight.position.set(0, 10.5, 2);
    lidGroup.add(screenLight);

    // Backside cap — keeps the lid back from showing through the screen
    // plane when the lid is at oblique angles.
    const darkScreen = screenMesh.clone();
    darkScreen.position.set(0, 10.5, -0.111);
    darkScreen.rotation.set(Math.PI, Math.PI, 0);
    darkScreen.material = darkPlasticMaterial;
    lidGroup.add(darkScreen);
  }

  function addKeyboard() {
    // Overlay plane that draws the keyboard letter labels on top of the
    // GLB's authored keyboard surface. Without this the keys read as a
    // featureless dark slab. Plane size + position match ksenia's pen.
    const keyboardKeys = new THREE.Mesh(
      new THREE.PlaneGeometry(27.7, 11.6),
      keyboardMaterial
    );
    keyboardKeys.rotation.set(-0.5 * Math.PI, 0, 0);
    keyboardKeys.position.set(0, 0.045, 7.21);
    bottomGroup.add(keyboardKeys);
  }

  // ---- GSAP timeline (flat, single mainTl, no nested .to(timeline, {progress})) ----
  // Nested-timeline driving via `.to(subTl, {progress: 1})` proved unreliable
  // in this project (sub-timelines stayed at progress 0 even though the
  // master tween animated). Flat structure: each beat tweens object props
  // DIRECTLY at an explicit time label. Same visual flow as ksenia's pen.
  function buildTimelines() {
    // Set initial pose so play(0) is reproducible.
    // Initial rotation y=0 (no side spin during appearance) so the laptop
    // settles facing straight forward at the camera. Initial rotation x
    // still swings forward (closed lid faces user during slide-in).
    macGroup.rotation.set(0.5 * Math.PI, 0, 0);
    macGroup.position.set(0, -50, -10);
    lidGroup.rotation.set(0.5 * Math.PI, 0, 0);
    lidGroup.position.set(0, 0, 0.5);
    screenMaterial.opacity = 0;
    screenLight.intensity = 0;
    // Camera starts WIDE (whole laptop in frame); the timeline dollies it into
    // CAM_CLOSE after the lid finishes opening. Reset here so play(0) replays
    // the wide→close move on every slide re-entry.
    camera.position.set(CAM_WIDE.pos[0], CAM_WIDE.pos[1], CAM_WIDE.pos[2]);
    camTarget.set(CAM_WIDE.look[0], CAM_WIDE.look[1], CAM_WIDE.look[2]);
    // CanvasTexture has no offset.y to reset — the screen image is owned
    // independently by the step controller (deckApplyDoctorPanelStep).

    mainTl = gsap.timeline({ paused: true });

    // ----- 0.0–2.0s : laptop slides up & rotates into FRONT-FACING pose -----
    // Final rotation y = 0 (was -0.1π) so the laptop points its keyboard
    // face directly at the viewer, not turned to the side. Per user:
    // "su anda bilgisyar sola donuk ben duz ekrana donuk olsun istiyorum".
    mainTl.to(macGroup.rotation, {
      x: 0,            // D4: no forward lean → screen sits perfectly upright (straight, face-on)
      y: 0,
      duration: 2.0,
      ease: 'power2.out',
    }, 0);
    // Final y = -6 (was -3). Lowered further to clear the lid top from
    // the canvas top edge — at -3 the open lid was clipping above the
    // screen. Each -1 unit drop ≈ 28px shift down in the rendered canvas
    // at this camera distance (z=42, FOV 40°).
    mainTl.to(macGroup.position, {
      y: -6,
      duration: 1.0,
      ease: 'power2.out',
    }, 0);

    // ----- 0.5–3.0s : lid swings open to VERTICAL (90° to keyboard) -----
    // x=0 is the GLB's authored open pose. Empirical bbox sampling
    // confirmed the lid_y_top peaks at this rotation (=0.75 unit), i.e.
    // the lid is closest to perpendicular-with-base here. User asked for
    // exactly 90° to the keyboard — this matches.
    mainTl.to(lidGroup.position, {
      z: 0,
      duration: 0.75,
      ease: 'power1.out',
    }, 0.5);
    mainTl.to(lidGroup.rotation, {
      x: 0,
      duration: 2.5,
      ease: 'sine.inOut',
    }, 0.5);

    // ----- 2.7s : screen wakes (opacity + RectAreaLight) -----
    // The screen content (DiaSAGE site screenshots) is already drawn into
    // the CanvasTexture and cycling crossfades through them. Fading the
    // material's opacity 0→1 here makes the screen "turn on" once the lid
    // is most of the way open, without affecting the underlying cycle.
    mainTl.to(screenMaterial, {
      opacity: 1,
      duration: 0.4,
    }, 2.7);
    mainTl.to(screenLight, {
      intensity: 1.5,
      duration: 0.4,
    }, 2.7);

    // ----- 3.2–4.9s : dolly camera WIDE → CLOSE (zoom into the screen) -----
    // Starts only AFTER the lid is fully open (lid finishes ≈3.0s) and the
    // screen has lit up (≈3.1s), so the viewer first sees the whole laptop
    // open, THEN the camera closes in on the web panel (user request). The
    // focus point (camTarget) and position tween together with a symmetric
    // ease so the move accelerates out of the open pose and settles gently on
    // the screen. ZOOM_END (ms) is reused to time the orb unfurl below.
    mainTl.to(camera.position, {
      x: CAM_CLOSE.pos[0], y: CAM_CLOSE.pos[1], z: CAM_CLOSE.pos[2],
      duration: 1.7,
      ease: 'power2.inOut',
    }, 3.2);
    mainTl.to(camTarget, {
      x: CAM_CLOSE.look[0], y: CAM_CLOSE.look[1], z: CAM_CLOSE.look[2],
      duration: 1.7,
      ease: 'power2.inOut',
    }, 3.2);

    // Zoom sonunda kendiliğinden çalışan pano/orb yan etkisi BİLEREK yok:
    // ekran ve orb durumunun tek sahibi generic step controller'dır
    // (deckApplyDoctorPanelStep). Sinematik yalnızca kozmetiktir.
  }

  // ---- Slide-change wiring ----
  // The whole pipeline (renderer.render, gsap screen ticker, lightHolder
  // quaternion sync) only runs while slide 10 is on screen. Off-slide cost
  // drops to zero — biggest perf win for slides 1-9 and 11-14.
  let lastIdx = -1;
  let isActive = false;
  let rafId = 0;

  function startRender() {
    if (isActive) return;
    isActive = true;
    if (!rafId) tick();
    // Ekran görüntüsü ve orb vurgusu burada DEĞİŞTİRİLMEZ: adım durumunun
    // sahibi generic step controller'dır; girişte hangi adımı uyguladıysa
    // (ileri = 0/KVKK, geriden = 3/Klinik) ekran onu gösterir.
  }

  function stopRender() {
    if (!isActive) return;
    isActive = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    // Dinlenme durumu: KVKK ekranı + orb vurgusu yok. Bir sonraki girişte
    // controller kendi adımını yeniden uygular (çift sahiplik yoktur; bu
    // yalnızca slayt görünmezken bayat kare kalmasın diyedir).
    currentIdx = 0;
    if (imagesReady) redrawScreen();
    emitPanelChange(-1);
  }

  deck.addEventListener('slidechange', (e) => {
    const idx = e.detail.index;
    if (idx === slideIndex && lastIdx !== idx) {
      startRender();
      if (mainTl) mainTl.play(0);
    } else if (idx !== slideIndex && lastIdx === slideIndex) {
      stopRender();
    }
    lastIdx = idx;
  });

  if (deck.index === slideIndex) startRender();

  // ---- Render loop + resize ----
  function updateSceneSize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', updateSceneSize);
  new ResizeObserver(updateSceneSize).observe(container);

  // DEBUG: expose to window for console inspection.
  window.__camexLaptop = { scene, camera, macGroup, lidGroup, bottomGroup, mainTl: () => mainTl };

  function tick() {
    if (!isActive) { rafId = 0; return; }
    rafId = requestAnimationFrame(tick);   // schedule first so a render throw can't kill the loop
    if (glLost) return;                    // GPU context dropped — skip render, resume on restore
    // Re-aim the camera each frame: camTarget is tweened during the WIDE→CLOSE
    // dolly, so lookAt must be recomputed here rather than set once at init.
    camera.lookAt(camTarget);
    lightHolder.quaternion.copy(camera.quaternion);
    try { renderer.render(scene, camera); } catch (e) { /* transient context-loss throw */ }
  }
})();
