/* ===========================================================================
   PC12 ENG401 — DASHBOARD DATA  (single source of truth for project STATE)
   ===========================================================================

   EDIT THIS FILE ONCE A WEEK. You do not need to touch any other file.

   Weekly routine (2 minutes):
     1) meta.updated      -> today's date, "YYYY-MM-DD" (shown in the sidebar;
                             the page goes amber past 10 days)
        meta.currentWeek is NOT edited any more - the week is derived from
        meta.w1Thursday. It is only the fallback for an invalid anchor.
     2) status / pct of the tasks that moved

   Everything else is recorded by the site itself: marking a task done, joining
   one, adding a note or a task all append a line to docs/data.txt, and the
   LAST UPDATES card on the dashboard reads that back. There is nothing to
   hand-write for the activity feed.

   RULES (follow these or git will fight you):
     * Keep every task on ONE line. Git merges line by line, so Berke editing
       WP1.3 and Gozde editing WP3.1 at the same time will NOT conflict.
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
    course:      "ENG401",
    subtitle:    "Morphology → NTI: the TÜSEB concept, our architecture",
    // The ENG401 class meets on THURSDAY, so a week counts as finished once
    // its Thursday is over -> the next week starts Friday 00:00 local time.
    // w1Thursday is the ONLY calendar date in this project; the current week is
    // computed from it, so currentWeek never has to be hand-edited again.
    // >>> If W1's Thursday is not 2026-09-24, fix THIS line and nothing else.
    w1Thursday:  "2026-09-24",
    currentWeek: 1,              // fallback only (used if w1Thursday is invalid)
    updated:     "2026-09-22",   // <-- UPDATE EVERY WEEK (YYYY-MM-DD)
    totalWeeks:  15,
    repoUrl:     "https://github.com/gozdehavinfidan/PC12-ENG",
    branch:      "main",          // whichever branch Pages serves from
    dataPath:    "docs/data.txt", // path of the event log inside the repo
    wikiPath:    "llm-wiki",

    // Legacy task ids -> their current id. data.txt is append-only, so an event
    // written against an old id can never be edited; this map is how a renamed
    // task keeps its history instead of stranding it. Membership here is NOT a
    // resolution: app.js maps the id and then LOOKS IT UP, so a stale alias
    // whose target has itself been removed still counts as an orphan.
    // Renumbered by D15 (WBS rebuilt from the course Gantt).
    taskAliases: {
      "T3.5": "WP4.5",                       // NTI module, renumbered by D15
      "T0.1": "WP0.1", "T0.2": "WP0.2",      // WP0 used the old T0.x scheme;
      "T0.3": "WP0.3", "T0.4": "WP0.4",      // renamed so every id on the
      "T0.5": "WP0.5",                       // board reads the same way
    },
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

  // --- WORK PACKAGES ------------------------------------------------------
  // Mirrors the updated course Gantt (PC12_Gantt_Chartt.xlsx, "Gantt Chart"
  // sheet). The chart covers W2-W15; WP0 is ours and covers W1-W2, which the
  // chart does not show. Colours live HERE, not in app.js.
  ips: [
    { id: "IP0", label: "WP0 \u2014 Project setup & planning", color:"#cbd5e1", desc:"Not in the course Gantt \u2014 ours. Weeks 1-2: repository and environment, the llm-wiki knowledge base, this dashboard, and the plan the rest of the project is measured against." },
    { id: "IP1", label: "WP1 \u2014 Re-annotation of the existing dataset", color:"#5eb8c9", desc:"The ~70 microscopy images we already hold. Audit their labels, re-annotate them under a single frozen protocol, then preprocess and split them into cross-validation folds. This package is the critical path: everything downstream inherits its label quality." },
    { id: "IP2", label: "WP2 \u2014 Annotation of the incoming dataset", color:"#79c4a8", desc:"The batch that arrives later in the semester. Annotated under the SAME protocol as WP1 \u2014 otherwise old and new data cannot be pooled or compared, and the generalisation claim collapses." },
    { id: "IP3", label: "WP3 \u2014 Segmentation model development", color:"#7dd3a0", desc:"Train a model to delineate cell bodies and neurites. Foundation-model baseline first, then the training pipeline, a pilot to validate the architecture, tuning, and full 5-fold training. The architecture decision is made at WP3.4 on cross-validation evidence, not in advance." },
    { id: "IP4", label: "WP4 \u2014 Morphometric analysis & validation", color:"#c7d96b", desc:"Convert segmentation masks into quantitative morphology: separate touching cells into instances, extract neurite length, count and branching angle from the skeleton graph, formulate the Neural Toxicity Index, and validate every number against manual measurement (Bland-Altman)." },
    { id: "IP5", label: "WP5 \u2014 Explainability (XAI) layer", color:"#b8a4e3", desc:"Attribution and uncertainty on top of the trained model, so a biologist can see WHY a prediction was made and when the model is unsure. Method selection and a prototype first, then the end-user layer and its validation." },
    { id: "IP6", label: "WP6 \u2014 Desktop application & delivery", color:"#f2b880", desc:"Package the pipeline into an application a researcher can run offline: interface, report generation, ONNX integration, end-to-end testing and the final demonstration. Integration lands in W14-W15, i.e. after the last presentation." },
  ],

  // --- TASKS \u2014 one per LINE ---------------------------------------------
  // IDs mirror the Gantt row numbers (WP3.2 here IS WP3.2 in the chart), so the
  // board and the chart can be read side by side without a lookup table.
  // Rows marked [+] are OURS, added on top of the chart; every other row is a
  // 1:1 copy of a chart row, weeks included.
  // Owner mapping from the chart: EEE -> ML (G\u00f6zde), TEAM -> EK, BME -> BM.
  tasks: [
    { id:"WP0.1", ip:"IP0", title:"Kickoff: repository, environment, knowledge base",                         owner:"EK", w:[1,1],   status:"done",  pct:100, ms:"M1" },
    { id:"WP0.2", ip:"IP0", title:"Literature review & architecture research",               owner:"ML", w:[1,2],   status:"doing", pct:70,  ms:"M1" },
    { id:"WP0.3", ip:"IP0", title:"Pipeline design & class scheme decision",          owner:"EK", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"WP0.4", ip:"IP0", title:"Data inventory & annotation protocol",               owner:"BM", w:[2,2],   status:"todo",  pct:0,   ms:"M1" },
    { id:"WP0.5", ip:"IP0", title:"Project dashboard infrastructure",                 owner:"ML", w:[1,2],   status:"done",  pct:100, ms:"M1" },

    { id:"WP1.1", ip:"IP1", title:"Dataset audit & re-annotation (~70 images)",     owner:"EK", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"CRITICAL PATH. Who labeled the ~70 images, under what protocol? ALSO O1: is there dose/timepoint metadata? NTI (WP4.5) depends on the answer." },
    { id:"WP1.2", ip:"IP1", title:"Preprocessing, augmentation & 5-fold split",       owner:"ML", w:[3,4],   status:"todo",  pct:0,   ms:"M2", note:"Split by IMAGE (ideally by well) and THEN patch. Patch-level leakage makes every DSC we report meaningless (R4)." },
    { id:"WP1.3", ip:"IP1", title:"[+] Inter-annotator agreement (10% double-annotated)",   owner:"EK", w:[4,4],   status:"todo",  pct:0,   ms:"M2", note:"Ours, not in the chart. The agreement score is the CEILING on any DSC we can honestly claim, and it is the W4 presentation claim." },

    { id:"WP2.1", ip:"IP2", title:"Annotation of the incoming batch (same protocol)",              owner:"EK", w:[9,10],  status:"todo",  pct:0,   ms:"M4", note:"Same protocol as WP1.1, frozen beforehand, or old and new data are not comparable." },
    { id:"WP2.2", ip:"IP2", title:"Preprocessing & augmentation of the new batch",                    owner:"EK", w:[10,11], status:"todo",  pct:0,   ms:"M5" },

    { id:"WP3.0", ip:"IP3", title:"[+] Foundation-model baseline (Cellpose-SAM, zero-shot)",owner:"ML", w:[5,5],   status:"todo",  pct:0,   ms:"M3", note:"Ours. Costs about a day and can beat a trained U-Net at n~70; running it late would mean training for weeks against an unknown bar." },
    { id:"WP3.1", ip:"IP3", title:"Training pipeline setup & first run",             owner:"ML", w:[5,5],   status:"todo",  pct:0,   ms:"M3" },
    { id:"WP3.2", ip:"IP3", title:"Pilot training & architecture validation",    owner:"ML", w:[6,6],   status:"todo",  pct:0,   ms:"M3", note:"The chart names DS-UNet here (track A2). Our architecture is our own (D8/D13); this row is the pilot-validation slot, not a commitment to theirs." },
    { id:"WP3.3", ip:"IP3", title:"Class-balance, resolution & hyperparameter tuning",owner:"ML", w:[7,7],  status:"todo",  pct:0,   ms:"M3" },
    { id:"WP3.4", ip:"IP3", title:"Full training on the existing dataset (5-fold CV)",           owner:"ML", w:[9,9],   status:"todo",  pct:0,   ms:"M4", note:"5-fold CV, mean +/- std. The architecture decision is made HERE (D8)." },
    { id:"WP3.5", ip:"IP3", title:"Retraining & re-evaluation on the expanded dataset",        owner:"ML", w:[10,11], status:"todo",  pct:0,   ms:"M5" },

    { id:"WP4.1", ip:"IP4", title:"Instance separation (post-processing)", owner:"ML", w:[9,10],  status:"todo",  pct:0,   ms:"M4" },
    { id:"WP4.2", ip:"IP4", title:"Morphometric feature extraction (skeleton \u2192 graph)",owner:"ML", w:[11,12], status:"todo", pct:0,   ms:"M5" },
    { id:"WP4.3", ip:"IP4", title:"Quantitative evaluation & error analysis",           owner:"ML", w:[12,12], status:"todo",  pct:0,   ms:"M5", note:"Bland-Altman against Berke's hand measurements; clDice/Betti for the neurites." },
    { id:"WP4.4", ip:"IP4", title:"Improvement loop (error analysis \u2192 model revision)",   owner:"ML", w:[13,13], status:"todo",  pct:0,   ms:"M6" },
    { id:"WP4.5", ip:"IP4", title:"[+] Neural Toxicity Index (NTI) formulation",     owner:"ML", w:[12,13], status:"todo",  pct:0,   ms:"M6", note:"Ours, from the TUSEB concept canon (D14). Linear base model; depth gated on O1, the metadata question in WP1.1." },

    { id:"WP5.1", ip:"IP5", title:"XAI method selection & prototype",                owner:"ML", w:[6,6],   status:"todo",  pct:0,   ms:"M3" },
    { id:"WP5.2", ip:"IP5", title:"End-user explainability layer & validation",      owner:"ML", w:[5,13],  status:"todo",  pct:0,   ms:"M6", note:"Weeks copied verbatim from the chart, which starts this at W5, one week BEFORE WP5.1 selects the method it is built on. Flagged here rather than silently corrected." },

    { id:"WP6.1", ip:"IP6", title:"Desktop application shell (mock data)",                    owner:"ML", w:[9,11],  status:"todo",  pct:0,   ms:"M5" },
    { id:"WP6.2", ip:"IP6", title:"Report generation module",            owner:"ML", w:[12,13], status:"todo",  pct:0,   ms:"M6" },
    { id:"WP6.3", ip:"IP6", title:"Pipeline\u2013UI integration & ONNX packaging",    owner:"ML", w:[14,15], status:"todo",  pct:0,   ms:"FIN", note:"Integration is W14-15 in the chart, i.e. AFTER the last presentation (W13). The W13 demo therefore shows the pieces, not a finished app." },
    { id:"WP6.4", ip:"IP6", title:"End-to-end testing & bug fixing",                 owner:"EK", w:[15,15], status:"todo",  pct:0,   ms:"FIN" },
    { id:"WP6.5", ip:"IP6", title:"Final demonstration & presentation",                  owner:"EK", w:[15,15], status:"todo",  pct:0,   ms:"FIN" },
  ],

  milestones: [
    { id:"M1",  w:2,  gate:"Plan locked · repo+env · data plan · dashboard live" },
    { id:"M2",  w:4,  gate:"Pilot data labeled · preprocessing runs end-to-end · data card written" },
    { id:"M3",  w:6,  gate:"Pilot model trained · baseline run · XAI spike done" },
    { id:"MID", w:8,  gate:"Midterm check: metrics reviewed, plan adjusted" },
    { id:"M4",  w:9,  gate:"Full-data model · architecture chosen by 5-fold CV · new-data labeling started · UI shell begun" },
    { id:"M5",  w:11, gate:"Expanded-data results · post-processing module done (WP4.1) · feature extraction STARTED (WP4.2 runs W11-W12) · UI shell on real output" },
    { id:"M6",  w:13, gate:"Improvement loop closed · report module generating · XAI layer validated · NTI computed" },
    { id:"FIN", w:15, gate:"Pipeline integrated with the UI (ONNX) · works offline end-to-end · report generated · demo ready" },
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
      demo:"5-fold CV mean ± std comparison table · chosen architecture and why · post-processing module (WP4.1): raw mask -> separated instances, with the cases it cannot separate shown honestly",
      claim:"We chose this architecture because cross-validation says so, not because it is fashionable — and we can already turn its output into countable cells.",
      fallback:"Comparison table only; instance separation on 3 images", ready:false,
      note:"Morphometry was moved OUT of this week: the chart schedules feature extraction (WP4.2) at W11-W12 and Bland-Altman evaluation (WP4.3) at W12. Promising measurements here would promise work that has not started." },

    { w:11, ms:"M5", speaker:"ML",
      demo:"Results including the new data (WP3.5 retrain on the expanded set) · first feature-extraction output (WP4.2, mid-package) · XAI overlays showing where the model looks",
      claim:"More data measurably moved the numbers, and we can already extract neurite geometry from the masks and show what the model attends to.",
      fallback:"Expanded-data comparison table + XAI overlays; feature extraction on 3 images", ready:false,
      note:"Systematic error analysis was moved OUT of this week: WP4.3 (metrics + error analysis, incl. Bland-Altman) is scheduled at W12. The failure taxonomy belongs to the W13 slot, where WP4.4 closes the improvement loop." },

    { w:13, ms:"M6", speaker:"ML",
      demo:"Closed improvement loop (error analysis -> model revision -> new numbers) · report generated from a real run · validated XAI layer · NTI computed for a dose series · UI shell showing real pipeline output",
      claim:"Every piece of the system works and produces a real report; what remains is wiring them into one executable, which the schedule puts in W14-15.",
      fallback:"CLI driving the real pipeline end to end, with the UI shell on mock data — stated clearly as two halves", ready:false },
  ],

  // --- RISKS \u2014 WRITTEN FROM THE DASHBOARD, NOT HERE -------------------
  // Empty on purpose. Use "+ Add risk" in Risks & decisions: one of you raises
  // it, the other can resolve it with a note, and both acts land in
  // docs/data.txt. Anything typed here instead would be a second source of
  // truth that the site cannot edit.
  // (The seven risks that used to sit here are in git history, commit a01a70d,
  //  if you want them back as a starting point.)
  risks: [],

  // --- DECISIONS \u2014 index only, also written from the dashboard --------
  // The REASONING lives in llm-wiki/DECISIONS.md. This list is just the index
  // the dashboard shows, and it is now filled in with "+ Add" rather than by
  // editing this file. D0-D15 remain in the wiki and in git history.
  decisions: [],

  // Run results — pasted in BY HAND. If there is no number, leave it null.
  // Never invent one.
  results: [
    // { run:"2026-10-20-unet-r34", model:"U-Net + ResNet34", dscCell:null, dscNeurite:null, clDice:null, folds:5, note:"" },
  ],

  // --- LOG — W1 ARCHIVE. NOT RENDERED ANYWHERE. -------------------------
  // Kept as a written record of how the project started, but the dashboard no
  // longer shows it: live activity comes from docs/data.txt via the LAST
  // UPDATES card. Do not append here expecting it to appear on the site.
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
    { w:1, text:"D15: work packages rebuilt from the updated course Gantt (PC12_Gantt_Chartt.xlsx). Task ids now mirror the chart rows (WP3.2 here = WP3.2 there). WP7 'date unknown' is gone: the new dataset is scheduled as WP2 at W9-W11." },
    { w:1, text:"Three rows added on top of the chart and marked [+]: WP1.3 annotator agreement, WP3.0 foundation-model baseline, WP4.5 NTI index. Each is required by our own strategy (small data) or by the concept canon (D14)." },
    { w:1, text:"Calendar consequence: ONNX/UI integration is W14-W15, i.e. AFTER the last presentation. The W13 claim was weakened from 'the app works' to 'every piece works, integration is next' — the old claim was no longer defensible." },
    { w:1, text:"Flagged, not fixed: the chart starts WP5.2 (full XAI layer) at W5, one week before WP5.1 selects the method. Weeks copied verbatim; note left on the task." },
    { w:1, text:"D14: concept canon = TÜSEB 2026 NTI application (bolumler); 2025 NeuroMind PDF demoted to reference. NTI added as a deliverable (now WP4.5, renumbered by D15); O1 open: does our data carry dose/timepoint metadata?" },
    { w:1, text:"KLAVUZ.html written: single-file, white-background project guide in Turkish — concept + TÜSEB report walkthrough + our design points, step by step (for a fresh EEE student)." },
  ],

};
