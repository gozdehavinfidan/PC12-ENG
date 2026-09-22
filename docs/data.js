/* ===========================================================================
   PC12 ENG400 — DASHBOARD DATA  (single source of truth for project STATE)
   ===========================================================================

   EDIT THIS FILE ONCE A WEEK. You do not need to touch any other file.

   Weekly routine (2 minutes):
     1) meta.currentWeek  -> this week's number
     2) meta.updated      -> today's date, "YYYY-MM-DD"
     3) status / pct of the tasks that moved
     4) append one line to the END of log[]  (NOT the top!)

   RULES (follow these or git will fight you):
     * Keep every task on ONE line. Git merges line by line, so Berke editing
       T1.3 and Gozde editing T2.1 at the same time will NOT conflict.
     * Append to the END of log[] and decisions[]. app.js reverses them for
       display. Prepending conflicts every single week.
     * Do NOT put reasoning here — reasoning lives in DECISIONS.md. This file
       holds "state" only: what, who, which week, what percent.

   status values:  "todo" | "doing" | "review" | "done" | "blocked"
   owner  values:  "ML" (Gozde) | "BM" (Berke) | "EK" (both)
   w              :  [startWeek, endWeek]  |  null = not scheduled

   NOTE: this is JavaScript, not JSON. Comments are allowed and a trailing
   comma is fine. That is a deliberate choice (see DECISIONS.md D7).
   =========================================================================== */

window.PC12_DATA = {

  meta: {
    project:     "PC12 Cell Morphology — Automated Analysis",
    course:      "ENG400",
    subtitle:    "Image processing + deep learning for PC12 neuronal morphology",
    currentWeek: 1,              // <-- UPDATE EVERY WEEK
    updated:     "2026-09-22",   // <-- UPDATE EVERY WEEK (YYYY-MM-DD)
    totalWeeks:  15,
    repoUrl:     "https://github.com/gozdehavinfidan/PC12-ENG",
    branch:      "main",          // whichever branch Pages serves from
    dataPath:    "docs/data.txt", // path of the event log inside the repo
    wikiPath:    "llm-wiki",
  },

  // avatar: path to a square photo, or null -> initials are shown instead.
  // When Berke's photo arrives: put a square-cropped berke.jpg in assets/ and
  // replace the null below with "assets/berke.jpg". Nothing else changes.
  people: [
    { code: "ML", name: "Gözde Havin Fidan", role: "Software / ML",          short: "Gözde", initials: "GH", avatar: "assets/gozde.jpg" },
    { code: "BM", name: "Berke Dinç",        role: "Biomedical / labeling",  short: "Berke", initials: "BD", avatar: null },
    { code: "EK", name: "Team (both)",       role: "Joint work",             short: "Team",  initials: "TM", avatar: null },
  ],

  // Only the SPECIAL weeks. Everything else counts as a normal working week.
  weeks: [
    { w: 2,  type: "sunum" },
    { w: 4,  type: "sunum" },
    { w: 6,  type: "sunum" },
    { w: 8,  type: "vize",  note: "Midterm week — no new scope, used as buffer" },
    { w: 9,  type: "sunum" },
    { w: 11, type: "sunum" },
    { w: 13, type: "sunum" },
    { w: 15, type: "final", note: "Final — everyone together, full integration" },
  ],

  ips: [
    { id: "IP0", label: "WP0 — Setup & Plan" },
    { id: "IP1", label: "WP1 — Data" },
    { id: "IP2", label: "WP2 — Segmentation" },
    { id: "IP3", label: "WP3 — Post-processing & Morphometry" },
    { id: "IP4", label: "WP4 — XAI" },
    { id: "IP5", label: "WP5 — Productization / App" },
    { id: "IP6", label: "WP6 — Improvement loop" },
    { id: "IP7", label: "WP7 — New dataset", optional: true },
  ],

  // --- TASKS — one per LINE -------------------------------------------------
  tasks: [
    { id:"T0.1", ip:"IP0", title:"Kickoff, repo, env, wiki",                       owner:"EK", w:[1,1],   status:"done",  pct:100, ms:"M1" },
    { id:"T0.2", ip:"IP0", title:"Literature + architecture research",             owner:"ML", w:[1,2],   status:"doing", pct:70,  ms:"M1" },
    { id:"T0.3", ip:"IP0", title:"Pipeline design + class scheme decision",        owner:"EK", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"T0.4", ip:"IP0", title:"Data inventory + labeling protocol",             owner:"BM", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"T0.5", ip:"IP0", title:"Project dashboard infrastructure",               owner:"ML", w:[1,2],   status:"done",  pct:100, ms:"M1" },

    { id:"T1.1", ip:"IP1", title:"Dataset inventory + data card (~70 images)",     owner:"BM", w:[2,3],   status:"doing", pct:30,  ms:"M2", note:"CRITICAL PATH. Who labeled these, under what protocol?" },
    { id:"T1.2", ip:"IP1", title:"Labeling protocol + tool choice",                owner:"BM", w:[2,3],   status:"todo",  pct:0,   ms:"M2", note:"Must be frozen BEFORE the new data arrives" },
    { id:"T1.3", ip:"IP1", title:"Pilot labeling + 10% double labeling",           owner:"EK", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"Annotator agreement = the ceiling on achievable DSC" },
    { id:"T1.4", ip:"IP1", title:"Preprocessing + augmentation + patch/fold split",owner:"ML", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"Split by IMAGE, THEN patch (leakage!)" },
    { id:"T1.5", ip:"IP1", title:"Remaining labeling",                             owner:"BM", w:[5,7],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T1.6", ip:"IP1", title:"Consistency check + freeze the dataset",         owner:"BM", w:[9,9],   status:"todo",  pct:0,   ms:"M4" },

    { id:"T2.1", ip:"IP2", title:"Training pipeline setup + first run",            owner:"ML", w:[4,5],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T2.2", ip:"IP2", title:"Baseline: Cellpose-SAM zero-shot + classical",   owner:"ML", w:[5,5],   status:"todo",  pct:0,   ms:"M3", note:"Run early — the answer can change the plan" },
    { id:"T2.3", ip:"IP2", title:"Pilot model (pretrained encoder + U-Net)",       owner:"ML", w:[5,6],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T2.4", ip:"IP2", title:"Segmentation tuning (balance, resolution, HP)",  owner:"ML", w:[7,7],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T2.5", ip:"IP2", title:"Full-data training + 5-fold CV comparison",      owner:"ML", w:[9,9],   status:"todo",  pct:0,   ms:"M4", note:"The architecture decision is made HERE (D8)" },

    { id:"T3.1", ip:"IP3", title:"Post-process module (components / instances)",   owner:"ML", w:[9,10],  status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.2", ip:"IP3", title:"Feature extraction (skan: skeleton -> graph)",   owner:"ML", w:[10,11], status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.3", ip:"IP3", title:"Morphometry unit tests",                         owner:"ML", w:[11,11], status:"todo",  pct:0,   ms:"M5" },
    { id:"T3.4", ip:"IP3", title:"Evaluation + error analysis + Bland-Altman",     owner:"EK", w:[11,11], status:"todo",  pct:0,   ms:"M5" },

    { id:"T4.1", ip:"IP4", title:"XAI spike (method choice + pilot run)",          owner:"ML", w:[6,6],   status:"todo",  pct:0,   ms:"M3" },
    { id:"T4.2", ip:"IP4", title:"Error interpretation with XAI",                  owner:"ML", w:[9,9],   status:"todo",  pct:0,   ms:"M4" },
    { id:"T4.3", ip:"IP4", title:"XAI visualization layer",                        owner:"ML", w:[12,12], status:"todo",  pct:0,   ms:"M6" },
    { id:"T4.4", ip:"IP4", title:"XAI validation (cross-check vs error analysis)", owner:"ML", w:[13,13], status:"todo",  pct:0,   ms:"M6" },

    { id:"T5.1", ip:"IP5", title:"Desktop app skeleton (mock data)",               owner:"ML", w:[10,11], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.2", ip:"IP5", title:"Report module (template + generator)",           owner:"ML", w:[12,13], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.3", ip:"IP5", title:"Pipeline <-> UI integration + ONNX/offline",     owner:"ML", w:[13,14], status:"todo",  pct:0,   ms:"M6" },
    { id:"T5.4", ip:"IP5", title:"End-to-end test & bug fixing",                   owner:"EK", w:[14,15], status:"todo",  pct:0,   ms:"FIN" },
    { id:"T5.5", ip:"IP5", title:"Final demo & presentation prep",                 owner:"EK", w:[15,15], status:"todo",  pct:0,   ms:"FIN" },

    { id:"T6.1", ip:"IP6", title:"Error -> model/feature revision cycle",          owner:"ML", w:[12,14], status:"todo",  pct:0,   ms:"M6" },

    { id:"T7.1", ip:"IP7", title:"Receive the new dataset (~2 weeks out)",         owner:"BM", w:null,    status:"todo",  pct:0,   ms:null, note:"Date unknown — fill in w when it arrives" },
    { id:"T7.2", ip:"IP7", title:"Label the new data (SAME protocol)",             owner:"EK", w:null,    status:"todo",  pct:0,   ms:null },
    { id:"T7.3", ip:"IP7", title:"Old/new comparison + fine-tune",                 owner:"ML", w:null,    status:"todo",  pct:0,   ms:null, note:"The untouched test set comes from here" },
  ],

  milestones: [
    { id:"M1",  w:2,  gate:"Plan locked · repo+env · data plan · dashboard live" },
    { id:"M2",  w:4,  gate:"Pilot data labeled · preprocessing runs end-to-end · data card written" },
    { id:"M3",  w:6,  gate:"Pilot model trained · baseline run · XAI spike done" },
    { id:"MID", w:8,  gate:"Midterm check: metrics reviewed, plan adjusted" },
    { id:"M4",  w:9,  gate:"Full-data model · best architecture chosen by 5-fold CV" },
    { id:"M5",  w:11, gate:"Morphometric features · error analysis · agreement with human measurement" },
    { id:"M6",  w:13, gate:"App wired to the real pipeline · ONNX/offline · XAI layer" },
    { id:"FIN", w:15, gate:"Works end-to-end offline · report generated · demo ready" },
  ],

  // --- PRESENTATION WEEKS — the reason this dashboard exists ----------------
  // "claim" = the ONE sentence we defend that day. It is what separates a
  // presentation from a status update.
  sunum: [
    { w:2,  ms:"M1", speaker:"EK",
      demo:"This dashboard live + llm-wiki + pipeline diagram + class scheme + small-data strategy",
      claim:"We did not copy the TÜSEB proposal. We identified its real constraint (~70 labeled images) and redesigned the approach around it.",
      fallback:"Slides generated from the wiki markdown", ready:true },

    { w:4,  ms:"M2", speaker:"BM",
      demo:"Filled data card (70 images) + labeling protocol + annotator agreement score + before/after preprocessing + new-data status",
      claim:"Our labels are consistent enough to train on — and the number that proves it is also the ceiling on any DSC we can honestly report.",
      fallback:"Protocol + agreement measured on 5 images", ready:false },

    { w:6,  ms:"M3", speaker:"ML",
      demo:"End-to-end training: patch pipeline -> pretrained U-Net -> prediction -> overlay; loss curves; first fold DSC; Cellpose-SAM zero-shot comparison",
      claim:"The pipeline is real and reproducible, and we already know whether a foundation model beats training our own.",
      fallback:"Deliberate overfit on 3 images — proves the pipeline is wired correctly", ready:false },

    { w:9,  ms:"M4", speaker:"ML",
      demo:"5-fold CV mean ± std comparison table · chosen architecture and why · morphometry v1 (skeleton->graph) vs Berke's hand measurements",
      claim:"We chose this architecture because cross-validation says so, not because it is fashionable — and our measurements agree with a human's.",
      fallback:"Comparison table only; morphometry on 3 images", ready:false },

    { w:11, ms:"M5", speaker:"ML",
      demo:"Results including the new data · error analysis (touching cells, faint neurites, out-of-focus fields) · Seg-Grad-CAM overlays",
      claim:"We know where our model fails and we can show you what it is looking at when it does.",
      fallback:"Error analysis without XAI — the failure taxonomy is the valuable half", ready:false },

    { w:13, ms:"M6", speaker:"ML",
      demo:"The app: load a real microscopy image -> full pipeline -> overlay + measured features -> export report",
      claim:"A researcher with no machine-learning knowledge can analyse an image and get a report, offline.",
      fallback:"CLI demo driving the real pipeline + UI shell on mock data (say clearly which half is real)", ready:false },
  ],

  risks: [
    { id:"R1", text:"Dataset is small (~70 images)",                         p:3, i:3, owner:"EK", status:"open",
      mit:"Pretrained encoder + patch-based training + 5-fold CV + foundation-model baseline (15-SMALL-DATA-STRATEGY)" },
    { id:"R2", text:"The existing 70 labels may follow a different protocol", p:2, i:3, owner:"BM", status:"open",
      mit:"Ask in T1.1. If they differ: either re-label or match their protocol. Finding out in W6 costs weeks." },
    { id:"R3", text:"Training too slow / compute limits",                     p:1, i:2, owner:"ML", status:"open",
      mit:"Resolved by D12 (A5000 24GB + A6000 48GB). Compute is no longer the binding constraint; labeled data still is." },
    { id:"R4", text:"Patch leakage -> meaningless but high DSC",              p:2, i:3, owner:"ML", status:"open",
      mit:"Split by image (ideally by well), THEN patch. Assert that fold image-id sets are disjoint." },
    { id:"R5", text:"New data is late or never arrives",                      p:2, i:2, owner:"BM", status:"open",
      mit:"WP7 is optional. The existing 70 images are a valid project on their own; new data is a bonus generalization story." },
    { id:"R6", text:"Overlapping / touching cells -> counting error",         p:3, i:2, owner:"ML", status:"open",
      mit:"Instance segmentation (Cellpose-SAM) or watershed; report what cannot be separated instead of hiding it." },
    { id:"R7", text:"12-REFERENCES.md unverified — fabricated-citation risk",  p:3, i:3, owner:"EK", status:"open",
      mit:"Verify every entry before it enters the report. Until then cite ONLY from 14-REFERENCES-VERIFIED.md." },
  ],

  // Index only — the reasoning lives in DECISIONS.md.
  decisions: [
    { id:"D0",  title:"Class scheme: background / cell_body / neurite",        w:2,  status:"accepted" },
    { id:"D1",  title:"Primary model: U-Net family (pretrained encoder)",      w:2,  status:"proposed" },
    { id:"D2",  title:"Neurite geometry: skeleton + graph (skan)",             w:5,  status:"proposed" },
    { id:"D3",  title:"Instance separation depth",                             w:9,  status:"proposed" },
    { id:"D4",  title:"Application framework",                                 w:10, status:"open" },
    { id:"D5",  title:"Units (µm vs px)",                                      w:3,  status:"open" },
    { id:"D6",  title:"Rotation augmentation vs the angle metric",             w:4,  status:"proposed" },
    { id:"D7",  title:"Dashboard = static data.js (not data.json)",            w:1,  status:"accepted" },
    { id:"D8",  title:"No assigned architecture track; decided at W9 by CV",   w:1,  status:"accepted" },
    { id:"D9",  title:"Small-data strategy (pretraining + patches + 5-fold CV)",w:1,  status:"accepted" },
    { id:"D10", title:"New data batch ≈ W3 — WP7 is now a commitment",         w:1,  status:"accepted" },
    { id:"D11", title:"Dashboard database: data.txt event log + in-memory token", w:1, status:"accepted" },
    { id:"D12", title:"Compute confirmed: A5000 24GB + A6000 48GB",            w:1,  status:"accepted" },
  ],

  // Run results — pasted in BY HAND. If there is no number, leave it null.
  // Never invent one.
  results: [
    // { run:"2026-10-20-unet-r34", model:"U-Net + ResNet34", dscCell:null, dscNeurite:null, clDice:null, folds:5, note:"" },
  ],

  // --- LOG — OLDEST FIRST. Append at the END; app.js reverses for display. ---
  log: [
    { w:1, text:"llm-wiki created; the TÜSEB NeuroMind base project decoded." },
    { w:1, text:"Data reality learned: ~70 labeled images, a new batch in ~2 weeks. 15-SMALL-DATA-STRATEGY written (D9)." },
    { w:1, text:"06-DATA: 5-fold CV replaces the 70/15/15 split; patch-leakage rule added." },
    { w:1, text:"07-METRICS: clDice/Betti added; all results as mean ± std; the unreachable neurite DSC ≥0.90 target corrected." },
    { w:1, text:"Gantt xlsx reviewed: presentation weeks W2/4/6/9/11/13, W8 midterm, W15 final confirmed. A1–A3 now CONFIRMED." },
    { w:1, text:"Other groups' architecture tracks found in the xlsx (A1 nnU-Net, A2 DS-UNet+clDice, A3 ViT-UNet) → D8: we are unassigned." },
    { w:1, text:"13-SUNUM-PLAN written: per presentation week, a demo + the ONE claim to defend + a fallback." },
    { w:1, text:"14-REFERENCES-VERIFIED written: 11 live-verified sources. 12-REFERENCES is still UNVERIFIED (R7)." },
    { w:1, text:"03-SEMESTER-PLAN frozen as the baseline; its ASCII Gantt deleted (it contradicted the WBS table)." },
    { w:1, text:"Dashboard built (docs/). Weekly updates now happen in this file only (D7)." },
    { w:1, text:"Dashboard made interactive: data.txt append-only event log, saved via the GitHub API (D11). Reviewed with Codex; 4 defects found and fixed." },
    { w:1, text:"D12: compute confirmed (A5000 24GB + A6000 48GB) — A6 resolved, nnU-Net is back on the table." },
    { w:1, text:"Repo published: github.com/gozdehavinfidan/PC12-ENG. UI switched to English." },
  ],

};
