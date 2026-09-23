/* PC12 ENG401 dashboard — rendering + interaction.
   Plain classic script: no modules, no build step.
   Works from file:// (double-click) and from GitHub Pages.

   DATA MODEL (llm-wiki/DECISIONS.md D11):
     data.js  = immutable BASELINE (window.PC12_DATA)
     data.txt = APPEND-ONLY event log; live state = baseline + events in order.
   Every event carries an id, so a retry after a lost-but-successful write can
   neither duplicate nor lose it. The outbox is never cleared until a re-read of
   the committed remote file actually contains those ids. */
(function () {
  'use strict';

  /* ---------------- 0) FAILSAFE ---------------- */
  function fatal(msg) {
    var d = document.createElement('div');
    d.className = 'fatal';
    d.innerHTML = '<b>Dashboard failed to load</b>' + msg;
    document.body.insertBefore(d, document.body.firstChild);
  }
  window.addEventListener('error', function (e) {
    fatal('Error: ' + e.message + (e.lineno ? '\n\nLine: ' + e.lineno : ''));
  });

  var D = window.PC12_DATA;
  if (!D) { fatal('data.js did not load, or window.PC12_DATA is undefined.'); return; }

  /* ---------------- 1) helpers ---------------- */
  // esc() is a SECURITY control here, not formatting: note bodies and task titles
  // come from data.txt and are injected into the DOM. Never bypass it.
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var TOTAL = (D.meta && D.meta.totalWeeks) || 15;
  // ---------- current week, derived from the calendar ----------
  // The ENG401 class is on THURSDAY, so a week is only "over" once its Thursday
  // is over: week N+1 begins on the FRIDAY after week N's Thursday, at 00:00.
  // Anchored on meta.w1Thursday, the single calendar fact in data.js.
  //
  // Local midnight, not UTC, on purpose: at 01:00 in Istanbul (UTC+3) on a
  // Friday it is still Thursday in UTC, so a UTC comparison would report the
  // previous week for the first three hours of every new week.
  // Day count via Math.round so a one-hour clock shift can never slip a day.
  var badAnchor = false;
  function computeWeek() {
    badAnchor = false;
    var fallback = (D.meta && D.meta.currentWeek) || 1;
    var max = (D.meta && D.meta.totalWeeks) || 15;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((D.meta && D.meta.w1Thursday) || '');
    if (!m) { badAnchor = true; return fallback; }
    // The regex only checks SHAPE. "2026-02-31" matches it, and the Date
    // constructor silently rolls day 31 of February over to March 4 - so the
    // whole semester would quietly shift by four days with nothing to see.
    // Round-trip the parts back out of the Date and require them to survive.
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var anchor = new Date(y, mo, d);
    if (anchor.getFullYear() !== y || anchor.getMonth() !== mo || anchor.getDate() !== d) {
      badAnchor = true; return fallback;
    }
    // The field is named w1Thursday and every week boundary below is derived
    // from "the Thursday class is over". An anchor on another weekday means
    // the value was misunderstood, and computing from it would produce a
    // plausible-looking but wrong calendar - the worst failure mode here.
    if (anchor.getDay() !== 4) { badAnchor = true; return fallback; }
    // Day+1 rolls the month/year over by itself, so no calendar arithmetic here.
    var w2start = new Date(y, mo, d + 1);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((today - w2start) / 86400000);
    if (days < 0) return 1;                       // still inside W1
    return Math.max(1, Math.min(max, 2 + Math.floor(days / 7)));
  }
  var NOW = computeWeek();

  var STATUS = {
    todo:    { label: 'Upcoming',    color: '#a9b2ad' },  // grey   - not begun
    doing:   { label: 'In progress', color: '#e5b32b' },  // yellow - being worked
    review:  { label: 'In review',   color: '#ee9445' },  // orange - waiting on us
    done:    { label: 'Done',        color: '#3fae7c' },  // green  - finished
    blocked: { label: 'Blocked',     color: '#e0706c' }   // red    - stuck
  };
  var STATUS_ORDER = ['todo', 'doing', 'review', 'done'];
  // Kisi renkleri: Gozde yumusak mor, Berke yumusak mavi.
  // EK (ortak gorev) tek bir renk degil, ikisinin gradyani -> ownerBg().
  var OWNER_COLOR = { ML: '#b8a4e3', BM: '#7fc4dd', EK: '#b8a4e3' };
  var OWNER_SOFT  = { ML: '#efe9fa', BM: '#e2f2f8', EK: '#e8eef7' };
  function ownerBg(code) {
    if (code === 'EK') return 'linear-gradient(120deg,' + OWNER_COLOR.ML + ',' + OWNER_COLOR.BM + ')';
    return OWNER_COLOR[code] || '#ddd';
  }
  function ownerSoftBg(code) {
    if (code === 'EK') return 'linear-gradient(120deg,' + OWNER_SOFT.ML + ' 0%,' + OWNER_SOFT.BM + ' 100%)';
    return OWNER_SOFT[code] || 'var(--panel)';
  }
  // Fallback palette only. The real colour lives on the package itself in
  // data.js, so adding or renumbering a work package cannot leave a stale
  // entry behind in a second table over here.
  var IP_COLOR = { IP0:'#cbd5e1', IP1:'#5eb8c9', IP2:'#7dd3a0', IP3:'#c7d96b',
                   IP4:'#b8a4e3', IP5:'#f2b880', IP6:'#f0a6a6', IP7:'#d8d8d8' };
  var ALIAS = (D.meta && D.meta.taskAliases) || {};
  function ipColor(id) {
    var l = D.ips || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id && l[i].color) return l[i].color;
    return IP_COLOR[id] || '#ddd';
  }

  function weekMeta(w) {
    var l = D.weeks || [];
    for (var i = 0; i < l.length; i++) if (l[i].w === w) return l[i];
    return { w: w, type: 'work' };
  }
  function person(code) {
    var p = D.people || [];
    for (var i = 0; i < p.length; i++) if (p[i].code === code) return p[i];
    return { code: code, name: code, short: code, initials: code };
  }
  function weekColW() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--wk-w');
    var n = parseFloat(v); return isNaN(n) ? 58 : n;
  }

  function avatarHTML(code, size) {
    var p = person(code), ring = OWNER_COLOR[code] || '#ddd';
    if (code === 'EK') {
      return '<span class="avs" title="Team">' +
             avatarHTML('ML', size || 'sm') + avatarHTML('BM', size || 'sm') + '</span>';
    }
    var cls = 'av' + (size ? ' ' + size : '');
    var ring2 = 'box-shadow:0 0 0 2px ' + ring + ',0 0 0 4px var(--panel)';
    if (p.avatar) {
      // The initials sit UNDER the photo and the photo removes itself if it
      // fails to load. data.js tells the reader to drop berke.jpg into assets/
      // and says "Nothing else changes" - but a wrong path used to leave an
      // empty circle with no name, which is worse than the placeholder it
      // replaced. onerror is a static string with no interpolated data, so it
      // adds no injection surface.
      return '<span class="' + cls + '" style="' + ring2 + '" title="' + esc(p.name) + '">' +
             '<i class="ini">' + esc(p.initials || code) + '</i>' +
             '<img src="' + esc(p.avatar) + '" alt="' + esc(p.name) +
             '" loading="lazy" onerror="this.remove()"></span>';
    }
    return '<span class="' + cls + ' ph" style="' + ring2 + ';background:' + ring + '33" ' +
           'title="' + esc(p.name) + '">' + esc(p.initials || code) + '</span>';
  }
  function whoHTML(code, size) {
    return '<span class="who">' + avatarHTML(code, size) +
           '<span class="nm">' + esc(person(code).short) + '</span></span>';
  }

  /* ---------------- 2) EVENT LOG (data.txt) ---------------- */
  function encVal(v) { return String(v == null ? '' : v).replace(/\r?\n/g, ' ').replace(/\|/g, '%7C'); }
  function decVal(v) { return String(v == null ? '' : v).replace(/%7C/g, '|'); }

  function hash8(s) {                    // legacy 5-field lines derive an id
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function newId() {
    var a = new Uint8Array(4);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < 4; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  var badLines = 0, dupLines = 0, orphanLines = 0;
  var ACTORS  = /^(ML|BM)$/;
  var ACTIONS = /^(status|pct|join|leave|note|task|del|msg|read|risk|riskfix|riskopen|dec|decst)$/;
  var TS_RE   = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  var ID_RE   = /^[0-9a-f]{8}$/;

  // The FILE ORDER is the authoritative order: it is established by the
  // compare-and-swap append, so it already records who actually won a race.
  // Sorting by the client timestamp would let a skewed browser clock override
  // that and hand "last write wins" to an earlier append. So: never sort.
  function parseLog(text) {
    badLines = 0;
    var out = [];
    (text || '').split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t || t.charAt(0) === '#') return;
      var f = line.split('|');
      if (f.length < 5 || f.length > 6) { badLines++; return; }
      var ev = { ts: f[0].trim(), actor: f[1].trim(), action: f[2].trim(),
                 target: f[3].trim(), value: decVal(f[4]), id: (f[5] || '').trim() };
      // Legacy id synthesis applies ONLY to a genuine 5-field line. A 6-field
      // line with a blank id is corruption, not legacy: hashing it would let a
      // record that lost its id re-apply as a brand new event and break the
      // idempotency guarantee. Let it fail ID_RE below.
      if (f.length === 5) ev.id = hash8(line);
      if (!TS_RE.test(ev.ts))       { badLines++; return; }
      if (!ACTORS.test(ev.actor))   { badLines++; return; }
      if (!ACTIONS.test(ev.action)) { badLines++; return; }
      if (!ev.target)               { badLines++; return; }
      if (!ID_RE.test(ev.id))       { badLines++; return; }
      out.push(ev);
    });
    return out;
  }
  function serialize(ev) {
    return [ev.ts, ev.actor, ev.action, ev.target, encVal(ev.value), ev.id].join('|');
  }

  // Live state = baseline + events. Rebuilt on every load and every change, so
  // what is on screen is always exactly what the persisted log says (P8).
  function buildState(events) {
    var st = { tasks: (D.tasks || []).map(function (t) {
      return { id:t.id, ip:t.ip, title:t.title, owner:t.owner, w:t.w ? t.w.slice() : null,
               status:t.status, pct:t.pct || 0, ms:t.ms || null, note:t.note || null, notes:[] };
    }) };
    st.msgs = [];
    // Risks and decisions start from whatever data.js ships (currently nothing -
    // the team writes their own) and are then built up by events, exactly like
    // tasks. Keeping them in the same append-only log means "who raised this"
    // and "who closed it" are recorded facts, not something to remember.
    st.risks = (D.risks || []).map(function (r) {
      return { id:r.id, text:r.text, p:r.p, i:r.i, owner:r.owner, mit:r.mit || '',
               status:r.status || 'open', by:null, ts:null, fixBy:null, fixTs:null, fix:'' };
    });
    st.decisions = (D.decisions || []).map(function (d) {
      return { id:d.id, title:d.title, w:d.w, status:d.status || 'open', by:null, ts:null };
    });
    var byRisk = {}, byDec = {};
    st.risks.forEach(function (r) { byRisk[r.id] = r; });
    st.decisions.forEach(function (d) { byDec[d.id] = d; });
    var by = {}; st.tasks.forEach(function (t) { by[t.id] = t; });
    var seen = {}, readIds = {};
    dupLines = 0; orphanLines = 0;
    events.forEach(function (ev) {
      if (seen[ev.id]) { dupLines++; return; }   // idempotent, but surfaced (I3)
      seen[ev.id] = 1;
      // Messages are handled BEFORE the task lookup: their TARGET is a person
      // code (msg) or another event's id (read), never a task id, so falling
      // through to `if (!t) return` would silently drop every one of them.
      if (ev.action === 'msg') {
        // TARGET = recipient, VALUE = text. The event's own id doubles as the
        // message id, which is what a later 'read' event points at - no second
        // identifier to keep in sync, and idempotency comes for free.
        st.msgs.push({ id: ev.id, from: ev.actor, to: ev.target, ts: ev.ts, text: ev.value });
        return;
      }
      if (ev.action === 'read') { readIds[ev.target] = 1; return; }
      if (ev.action === 'risk') {
        if (byRisk[ev.target]) return;                     // first write wins
        var rp = String(ev.value).split(';');
        var nr = { id: ev.target, text: rp[0] || '(untitled risk)',
                   p: Math.max(1, Math.min(3, parseInt(rp[1], 10) || 2)),
                   i: Math.max(1, Math.min(3, parseInt(rp[2], 10) || 2)),
                   owner: rp[3] || ev.actor, mit: rp[4] || '',
                   status: 'open', by: ev.actor, ts: ev.ts, fixBy: null, fixTs: null, fix: '' };
        st.risks.push(nr); byRisk[nr.id] = nr;
        return;
      }
      if (ev.action === 'riskfix' || ev.action === 'riskopen') {
        var rr = byRisk[ev.target];
        if (!rr) { orphanLines++; return; }
        if (ev.action === 'riskfix') {
          rr.status = 'resolved'; rr.fix = ev.value; rr.fixBy = ev.actor; rr.fixTs = ev.ts;
        } else {
          rr.status = 'open'; rr.fix = ''; rr.fixBy = null; rr.fixTs = null;
        }
        return;
      }
      if (ev.action === 'dec') {
        if (byDec[ev.target]) return;
        var dp = String(ev.value).split(';');
        var nd = { id: ev.target, title: dp[0] || '(untitled decision)',
                   w: parseInt(dp[1], 10) || NOW, status: dp[2] || 'open',
                   by: ev.actor, ts: ev.ts };
        st.decisions.push(nd); byDec[nd.id] = nd;
        return;
      }
      if (ev.action === 'decst') {
        var dd = byDec[ev.target];
        if (!dd) { orphanLines++; return; }
        if (/^(open|proposed|accepted|rejected)$/.test(ev.value)) dd.status = ev.value;
        return;
      }
      // Resolve a legacy id BEFORE the lookup, never INSTEAD of it: being in
      // the alias map is not proof the mapped task exists. Map, then look up;
      // a miss falls through to the orphan counter below exactly as an
      // unmapped unknown id would.
      var tgt = (ALIAS[ev.target] || ev.target);
      var t = by[tgt];
      if (ev.action === 'task') {
        if (t) return;                       // mapped or direct hit: no duplicate
        // An ALIASED id that misses is a stale alias, and creating here would
        // resurrect a task the WBS deliberately removed - under the LEGACY id,
        // because the branch below builds from ev.target. That silently
        // reintroduces a renumbered-away row AND suppresses the orphan
        // diagnostic, which is exactly the guarantee the alias map was added
        // to preserve. Count it and stop. An UNALIASED unknown id still
        // creates: that is how a task added from the UI comes into existence.
        if (ALIAS[ev.target]) { orphanLines++; return; }
        var p = String(ev.value).split(';');
        var nt = { id: ev.target, ip: p[0] || 'IP0', title: p[1] || '(untitled)',
                   owner: p[2] || ev.actor,
                   w: (p[3] && p[4]) ? [parseInt(p[3], 10), parseInt(p[4], 10)] : null,
                   status: 'todo', pct: 0, ms: null, note: null, notes: [], added: true };
        st.tasks.push(nt); by[nt.id] = nt;
        return;
      }
      // A well-formed event aimed at a task that no longer exists. This happens
      // when the WBS is renumbered: the line stays valid and stays in the file,
      // but it has nothing to apply to. Counting it means a renumbering shows
      // up as a visible number instead of a note that quietly stopped rendering.
      if (!t) { orphanLines++; return; }
      if (ev.action === 'status') {
        if (STATUS[ev.value]) { t.status = ev.value; if (ev.value === 'done') t.pct = 100; }
      } else if (ev.action === 'pct') {
        var n = parseInt(ev.value, 10);
        if (!isNaN(n)) { t.pct = Math.max(0, Math.min(100, n)); if (t.status === 'todo' && t.pct > 0) t.status = 'doing'; }
      } else if (ev.action === 'join') {
        if (t.owner !== ev.actor && t.owner !== 'EK') t.owner = 'EK';   // idempotent
      } else if (ev.action === 'leave') {
        // Only meaningful on a SHARED task: the leaver steps off, the other
        // person keeps it. There is deliberately no "unassigned" state, so a
        // sole owner cannot leave - that would orphan the task, and a task
        // nobody owns is how work disappears. The drawer does not offer the
        // button in that case; an event that arrives anyway is a no-op.
        if (t.owner === 'EK') t.owner = (ev.actor === 'ML' ? 'BM' : 'ML');
      } else if (ev.action === 'note') {
        t.notes.push({ by: ev.actor, ts: ev.ts, text: ev.value });
      } else if (ev.action === 'del') {
        t.hidden = true;
      }
    });
    st.tasks = st.tasks.filter(function (t) { return !t.hidden; });
    // Dismissals are applied after the loop rather than inline. A 'read' is
    // always written after its 'msg' by the same browser, but the log is the
    // merge of two people's appends, so nothing in the format guarantees that
    // order survives. Collecting the ids first makes the result independent of
    // it: an out-of-order 'read' still hides its message instead of vanishing.
    st.msgs = st.msgs.filter(function (m) { return !readIds[m.id]; });
    return st;
  }

  /* ---------------- 3) SYNC STATE (6 states) ---------------- */
  var SYNC = 'LOCAL_ONLY';
  var SYNC_TEXT = {
    LOCAL_ONLY:    ['warn', 'Local only'],
    SYNCED:        ['ok',   'Saved'],
    PENDING:       ['warn', 'Unsaved changes'],
    SYNCING:       ['warn', 'Saving...'],
    AUTH_REQUIRED: ['warn', 'Token required'],
    ERROR:         ['bad',  'Save failed']
  };
  var syncDetail = '';
  function setSync(s, detail) { SYNC = s; syncDetail = detail || ''; renderSyncBox(); }

  var remoteEvents = [], outbox = [], token = null, ME = 'ML';

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function loadOutbox() { try { outbox = JSON.parse(lsGet('pc12.outbox', '[]')) || []; } catch (e) { outbox = []; } }
  function saveOutbox() { lsSet('pc12.outbox', JSON.stringify(outbox)); }

  var STATE = { tasks: [] };
  function recompute() { STATE = buildState(remoteEvents.concat(outbox)); }
  function tasksOf(ip) { return STATE.tasks.filter(function (t) { return t.ip === ip; }); }
  function taskById(id) { for (var i = 0; i < STATE.tasks.length; i++) if (STATE.tasks[i].id === id) return STATE.tasks[i]; return null; }

  function addEvent(action, target, value) {
    var ev = { ts: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), actor: ME,
               action: action, target: target, value: value == null ? '' : String(value), id: newId() };
    outbox.push(ev); saveOutbox(); recompute();
    if (SYNC !== 'LOCAL_ONLY') SYNC = 'PENDING';
    render();
    return ev;
  }

  /* ---------------- 4) GITHUB WRITE PATH (token memory-only) ---------------- */
  function repoCfg() {
    var url = (D.meta && D.meta.repoUrl) || '';
    var m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, ''),
             branch: (D.meta && D.meta.branch) || 'main',
             path: (D.meta && D.meta.dataPath) || 'docs/data.txt' };
  }
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function b64dec(b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function ghHeaders() {
    return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
             'X-GitHub-Api-Version': '2022-11-28' };
  }
  function ghGet(cfg) {
    var u = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' +
            cfg.path + '?ref=' + encodeURIComponent(cfg.branch) + '&t=' + Date.now();
    return fetch(u, { headers: ghHeaders(), cache: 'no-store' }).then(function (r) {
      if (!r.ok) return { ok: false, status: r.status };
      return r.json().then(function (j) {
        return { ok: true, sha: j.sha, text: j.content ? b64dec(j.content) : '' };
      });
    });
  }
  function ghPut(cfg, text, sha, n) {
    var u = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + cfg.path;
    return fetch(u, { method: 'PUT', headers: ghHeaders(),
      body: JSON.stringify({ message: 'dashboard: ' + ME + ' ' + n + ' olay',
                             content: b64enc(text), sha: sha, branch: cfg.branch })
    }).then(function (r) { return { ok: r.ok, status: r.status }; });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // GET -> append only ids the remote lacks -> conditional PUT -> on conflict,
  // bounded randomized backoff (a single retry loses events when two people save
  // at once). The outbox survives until a re-read proves the ids landed.
  function pushOutbox() {
    var cfg = repoCfg();
    if (!cfg) { setSync('ERROR', 'meta.repoUrl is empty in data.js'); return Promise.resolve(); }
    if (!token) { setSync('AUTH_REQUIRED'); return Promise.resolve(); }
    if (!outbox.length) { setSync('SYNCED'); return Promise.resolve(); }
    setSync('SYNCING');
    var attempt = 0;

    function finish(text) {
      var ok = {}; parseLog(text).forEach(function (e) { ok[e.id] = 1; });
      var missing = outbox.filter(function (e) { return !ok[e.id]; });
      remoteEvents = parseLog(text);
      outbox = missing; saveOutbox(); recompute();
      setSync(missing.length ? 'PENDING' : 'SYNCED'); render();
    }

    function round() {
      return ghGet(cfg).then(function (cur) {
        if (!cur.ok) {
          if (cur.status === 401 || cur.status === 403) { setSync('AUTH_REQUIRED', 'Token invalid or unauthorized'); return; }
          setSync('ERROR', 'Could not read from GitHub (' + cur.status + ')'); return;
        }
        var have = {}; parseLog(cur.text).forEach(function (e) { have[e.id] = 1; });
        var add = outbox.filter(function (e) { return !have[e.id]; });
        if (!add.length) { finish(cur.text); return; }      // already committed earlier
        var body = cur.text + (cur.text === '' || /\n$/.test(cur.text) ? '' : '\n') +
                   add.map(serialize).join('\n') + '\n';
        return ghPut(cfg, body, cur.sha, add.length).then(function (res) {
          if (res.ok) {
            return ghGet(cfg).then(function (chk) {          // verify before clearing
              if (!chk.ok) { setSync('PENDING', 'Written but could not verify'); return; }
              finish(chk.text);
            });
          }
          if (res.status === 401 || res.status === 403) { setSync('AUTH_REQUIRED', 'Token unauthorized'); return; }
          if (res.status === 409 || res.status === 422) {
            attempt++;
            if (attempt >= 5) { setSync('PENDING', 'Conflict persisted, try again'); return; }
            return sleep(300 * Math.pow(2, attempt) + Math.random() * 400).then(round);
          }
          setSync('ERROR', 'GitHub write failed (' + res.status + ')');
        });
      }).catch(function (e) { setSync('ERROR', String((e && e.message) || e)); });
    }
    return round();
  }

  function loadRemote() {
    // file:// blocks this by CORS -> LOCAL_ONLY. Never a silent failure.
    return fetch('data.txt?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (txt) {
      remoteEvents = parseLog(txt);
      setSync(outbox.length ? 'PENDING' : 'SYNCED');
    }).catch(function (err) {
      // file:// genuinely cannot read a sibling file -> LOCAL_ONLY.
      // Over HTTP the same catch means the network or the server failed, which
      // is recoverable and must NOT be reported as "you opened the file locally".
      remoteEvents = [];
      if (location.protocol === 'file:') setSync('LOCAL_ONLY');
      else setSync('ERROR', 'Could not read data.txt: ' + String((err && err.message) || err));
    });
  }

  /* ---------------- 5) VIEWS ---------------- */
  function pctDone() {
    if (!STATE.tasks.length) return 0;
    var s = 0; STATE.tasks.forEach(function (t) { s += (t.status === 'done' ? 100 : (t.pct || 0)); });
    return Math.round(s / STATE.tasks.length);
  }
  function doneCount() { return STATE.tasks.filter(function (t) { return t.status === 'done'; }).length; }

  function kpiCard(k, v, pct) {
    return '<div class="card kpi"><div class="v">' + esc(v) + '</div><div class="k">' + esc(k) + '</div>' +
      (pct === null ? '' : '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>') + '</div>';
  }

  /* Task status gauge - a half-circle, in the style the user referenced.
     Three things make it read where a full ring did not:
       1. 180 degrees instead of 360, so every slice gets twice the arc for
          the same share of the data;
       2. round caps and a real gap, so neighbouring slices never merge;
       3. UPCOMING is drawn as radial ticks rather than a solid fill. In the
          reference that hatched band is the "not yet" portion, and here it
          literally is - not-started work. A hatched area recedes, so the
          coloured slices finally carry the eye instead of being swamped by a
          grey block that was 89% of the chart.
     A floor still applies to the coloured slices (a 1-task status is 3.6% =
     6.4 degrees, which is a nub), so the arc is a shape cue and the exact
     counts live in the legend and in each slice's tooltip. */
  // Every present slice gets BASE_SHARE of the half circle, and the remainder
  // is handed out in proportion. The earlier version clamped thin slices to a
  // flat floor, which had a worse failure than being small: Done (2 tasks) and
  // In progress (1 task) both hit the floor and came out at exactly the same
  // 14.4 degrees, so the chart asserted they were equal. base+proportional
  // keeps the order intact (24.2 vs 19.3 degrees today) and still sums to 1.
  var BASE_SHARE = 0.08;
  function polar(cx, cy, r, deg) {
    var a = deg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function arcD(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
           ' A' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' +
           p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function statusRing() {
    var order = ['done', 'review', 'doing', 'todo', 'blocked'];
    var counts = {}, present = [];
    order.forEach(function (k) {
      var n = STATE.tasks.filter(function (t) { return t.status === k; }).length;
      counts[k] = n;
      if (n) present.push(k);
    });
    var total = STATE.tasks.length || 1;

    // base = a visible minimum for every status that exists; the rest of the
    // circle is split in proportion, so bigger is always drawn bigger.
    var base = Math.min(BASE_SHARE, 0.9 / present.length);   // never overflow
    var rest = 1 - base * present.length;
    var share = {};
    present.forEach(function (k) { share[k] = base + (counts[k] / total) * rest; });

    // Reference proportion is a chunky ring: stroke about a third of the
    // radius. 24/80 lands there, and the larger radius buys back the arc
    // length the thicker round caps eat.
    var W = 204, H = 114, CX = W / 2, CY = 100, R = 80, SW = 24;
    // 4.5 degrees, not 2.6: at radius 58 the old gap was 2.6px, which the two
    // round caps simply swallowed, so two adjacent thin slices read as one
    // pill. The gap has to clear the caps, not just exist.
    var A0 = 180, SWEEP = 180, GAP = present.length > 1 ? 4.5 : 0;
    var parts = '', cursor = A0;

    present.forEach(function (k) {
      var span = SWEEP * share[k];
      var a0 = cursor + GAP / 2, a1 = cursor + span - GAP / 2;
      if (a1 <= a0) a1 = a0 + 0.6;            // a gap must never erase a slice
      var tip = '<title>' + esc(STATUS[k].label) + ': ' + counts[k] + ' of ' + total + '</title>';

      if (k === 'todo') {
        // Radial ticks: the "not yet" band. Spaced by angle so the density
        // stays even however wide the band is.
        var ticks = '', step = 2.6;
        for (var a = a0 + 0.8; a <= a1 - 0.8; a += step) {
          var i0 = polar(CX, CY, R - SW / 2 + 2, a), i1 = polar(CX, CY, R + SW / 2 - 2, a);
          ticks += '<line x1="' + i0[0].toFixed(2) + '" y1="' + i0[1].toFixed(2) +
                   '" x2="' + i1[0].toFixed(2) + '" y2="' + i1[1].toFixed(2) + '"></line>';
        }
        parts += '<g class="hatch">' + tip +
                 '<path d="' + arcD(CX, CY, R, a0, a1) + '" class="hatch-bed" ' +
                 'stroke-width="' + SW + '"></path>' + ticks + '</g>';
      } else {
        parts += '<path class="seg" d="' + arcD(CX, CY, R, a0, a1) + '" fill="none" stroke="' +
                 STATUS[k].color + '" stroke-width="' + SW + '" stroke-linecap="round">' +
                 tip + '</path>';
      }
      cursor += span;
    });

    var leg = present.map(function (k) {
      return '<span class="' + (k === 'todo' ? 'is-todo' : '') + '">' +
             '<i style="background:' + STATUS[k].color + '"></i>' +
             esc(STATUS[k].label) + '<b>' + counts[k] + '</b></span>';
    }).join('');

    return '<div class="ring-wrap">' +
      '<div class="gauge"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
        '" role="img" aria-label="Task status breakdown">' + parts + '</svg>' +
        '<div class="gauge-mid"><b>' + doneCount() + '<span>/' + STATE.tasks.length + '</span></b>' +
        '<em>done</em></div></div>' +
      '<div class="st-leg">' + leg + '</div></div>';
  }


  // One set of week columns drawn behind ALL rows -> continuous vertical bands.
  function weekCols(withLabels) {
    var out = '';
    for (var w = 1; w <= TOTAL; w++) {
      var t = weekMeta(w).type;
      var cls = t !== 'work' ? ' class="' + t + '"' : '';
      out += '<i' + cls + '>' + (withLabels ? '<b>W' + w + '</b>' : '') + '</i>';
    }
    return '<div class="cols" style="--n:' + TOTAL + '">' + out + '</div>';
  }
  function ipPeople(ts) {
    var set = {};
    ts.forEach(function (t) { if (t.owner === 'EK') { set.ML = 1; set.BM = 1; } else { set[t.owner] = 1; } });
    return ['ML', 'BM'].filter(function (c) { return set[c]; });
  }

  /* ---- timeline avatar intro -------------------------------------------
     On the FIRST render the avatar sits at the start of its bar and the real
     position is parked in data-x; a rAF pass then writes it, which turns the
     existing CSS `transition: left` into a visible walk along the bar, so the
     page load itself shows how far each work package has come.
     On every LATER render (a status change, a view switch) the final position
     is written straight into the markup: re-walking on every click would be
     noise rather than feedback, and it would also fight the short transition
     that already animates a genuine progress change. */
  /* The same walk runs on two charts - the overview's package timeline and the
     full Gantt - so the "already played" state is kept PER CHART. One shared
     flag would let the overview's intro (the landing view) mark the Gantt as
     done before anyone had opened it, and the Gantt would never animate.
     `edge` is how far the marker must stay from the bar's rounded ends: half
     the avatar's width plus a little, so a 0% or 100% task stays inside. */
  var INTROS = {
    '.mini-tl': { sel: '.mini-tl .seg .avs[data-x]', done: false, timer: null },
    '.gantt2':  { sel: '.gantt2 .g-bar .g-av[data-x]', done: false, timer: null }
  };
  function avatarMarker(pct, i, host, cls, edge) {
    host = host || '.mini-tl'; cls = cls || 'avs'; edge = edge || 24;
    var pos = 'clamp(' + edge + 'px,' + pct + '%,calc(100% - ' + edge + 'px))';
    if (INTROS[host].done) return '<span class="' + cls + '" style="left:' + pos + '">';
    // 90ms per row: the packages resolve top-to-bottom instead of all at once,
    // which reads as a sequence rather than a twitch.
    return '<span class="' + cls + '" style="left:' + edge + 'px;transition-delay:' + (i * 90) +
           'ms" data-x="' + pos + '">';
  }
  function playTimelineIntro() {
    Object.keys(INTROS).forEach(playIntro);
  }
  function playIntro(hostSel) {
    var st = INTROS[hostSel];
    if (st.done) return;
    var els = all(st.sel);
    if (!els.length) return;            // this chart is not the current view yet
    // The longest stagger, not els.length * 90: on the Gantt every task of one
    // package shares that package's delay, so the element count overstates it.
    var maxDelay = els.reduce(function (m, el) {
      return Math.max(m, parseInt(el.style.transitionDelay, 10) || 0); }, 0);
    // The flag is raised when the walk FINISHES, not when it starts. Startup
    // renders twice - once immediately, once when loadRemote() resolves - and
    // the second render replaces innerHTML, destroying mid-flight elements.
    // Marking "done" up front made that second render emit final positions, so
    // the animation was built, wiped ~50ms later, and never seen. Re-arming on
    // every render until the timer fires makes the last render the one that
    // actually plays, which is also the one holding the true data.
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(function () { st.done = true; }, 1150 + maxDelay + 120);
    var host = $(hostSel);
    var reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      clearTimeout(st.timer); st.done = true;
      els.forEach(function (el) {
        el.style.transitionDelay = '0ms';
        el.style.left = el.getAttribute('data-x');
      });
      return;
    }
    if (host) host.classList.add('tl-intro');
    // TWO frames, not one. The first lets the browser commit `left:24px` as the
    // starting computed value; setting the target inside the same frame would
    // collapse both into a single style recalculation and the transition would
    // never fire - the avatars would simply appear at the end.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        els.forEach(function (el) { el.style.left = el.getAttribute('data-x'); });
      });
    });
  }

  function miniTimeline() {
    var head = '<div class="head"><div></div><div class="hcols">' + weekCols(true) + '</div></div>';
    var rows = (D.ips || []).map(function (ip, i) {
      var ts = tasksOf(ip.id).filter(function (t) { return t.w; });
      if (!ts.length) return '';                  // unscheduled package -> no row
      var a = Math.min.apply(null, ts.map(function (t) { return t.w[0]; }));
      var b = Math.max.apply(null, ts.map(function (t) { return t.w[1]; }));
      var left = ((a - 1) / TOTAL) * 100, width = ((b - a + 1) / TOTAL) * 100;
      var pct = Math.round(ts.reduce(function (n, t) {
        return n + (t.status === 'done' ? 100 : (t.pct || 0)); }, 0) / ts.length);
      var who = ipPeople(ts).map(function (c) { return avatarHTML(c, 'sm'); }).join('');
      // ips[].desc was added with the WBS rebuild and had no read path - a
      // write-only field is the same defect class as the unrendered task note.
      // The row label is where a reader already hovers to see the full name.
      var nmTitle = esc(ip.label) + (ip.desc ? ' — ' + esc(ip.desc) : '');
      return '<div class="row"><button type="button" class="nm" data-pkg="' + esc(ip.id) +
        '" title="' + nmTitle + '">' + esc(ip.label) + '</button>' +
        '<div class="track"><div class="seg" title="' + esc(ip.label) + ' W' + a + '-W' + b + ' · ' + pct + '%" ' +
          'style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;background:' + ipColor(ip.id) + '">' +
          '<i class="fill" style="width:' + pct + '%"></i>' +
          // Avatars sit AT the progress point, not centred: 0% -> start of the
          // bar, 100% -> its end. clamp() keeps them inside the rounded ends so
          // a 0% or 100% task does not hang off the edge.
          avatarMarker(pct, i) + who + '</span></div></div></div>';
    }).join('');
    var key = '<div class="tl-key">' +
      '<span><i class="k sunum"></i>Presentation week</span>' +
      '<span><i class="k vize"></i>Midterm — no work</span>' +
      '<span><i class="k final"></i>Final</span></div>';
    return '<div class="scroll-x"><div class="mini-tl">' + head +
           '<div class="body">' + weekCols(false) + '<div class="rows">' + rows + '</div></div>' +
           '</div></div>' + key;
  }

  function miniBoard() {
    return '<div class="mini-board">' + STATUS_ORDER.map(function (k) {
      var items = STATE.tasks.filter(function (t) { return t.status === k; });
      var cards = items.slice(0, 3).map(function (t) {
        var pct = t.status === 'done' ? 100 : (t.pct || 0);
        return '<div class="mc" data-task="' + esc(t.id) + '" style="background:' + ownerSoftBg(t.owner) +
          ';border-color:' + (OWNER_COLOR[t.owner] || '#ddd') + '66"><div class="tt">' + esc(t.title) + '</div>' +
          '<div class="bt">' + avatarHTML(t.owner, 'sm') +
          '<div class="pb"><i style="width:' + pct + '%;background:' + ownerBg(t.owner) + '"></i></div>' +
          '<span class="pv">' + pct + '%</span></div></div>';
      }).join('') || '<div class="more">-</div>';
      var extra = items.length > 3
        ? '<div class="more link" data-goboard="1">+' + (items.length - 3) + ' more - see all</div>' : '';
      return '<div class="mcol" style="--c:' + STATUS[k].color + '"><h5>' + STATUS[k].label +
        '<span>' + items.length + '</span></h5>' + cards + extra + '</div>';
    }).join('') + '</div>';
  }

  /* LAST UPDATES - the activity feed.
     data.txt already records WHO did WHAT to WHICH task and WHEN; until now the
     only thing rendered from it was the resulting state, so the history was
     invisible. This turns each event into one sentence. Read straight off the
     raw events (not STATE), because STATE is the collapsed result - "set to
     60%, then 80%" is one number there and two updates here. */
  function relTime(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var mins = Math.round((Date.now() - t) / 60000);
    // A future timestamp is not "just now". Events carry the WRITER's clock, so
    // a couple of minutes of skew is normal and still reads as just now, but a
    // genuinely future stamp (a machine set wrong, or a hand-written line) must
    // say so rather than claim the change happened a moment ago.
    if (mins < -2)   return 'dated ' + iso.slice(0, 10);
    if (mins < 1)    return 'just now';
    if (mins < 60)   return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24)    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    if (days === 1)  return 'yesterday';
    if (days < 30)   return days + ' days ago';
    return iso.slice(0, 10);
  }
  // Task titles come from STATE so a renamed task reads under its CURRENT name;
  // if the id no longer resolves we show the bare id rather than inventing one.
  function taskLabel(id) {
    var t = taskById(ALIAS[id] || id);
    return t ? t.title : id;
  }
  function clip(str, n) {
    var t = String(str);
    return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : t;
  }
  function activityHTML(ev) {
    var mine = ev.actor === ME;
    var who = mine ? 'You' : esc(person(ev.actor).short || ev.actor);
    var tgt = '<b>' + esc(taskLabel(ev.target)) + '</b>';
    var t = taskById(ALIAS[ev.target] || ev.target);
    // "for you" only when it is genuinely assigned to the reader - the shared
    // owner EK counts, since the task is then partly theirs.
    var forYou = t && (t.owner === ME || t.owner === 'EK') && !mine ? ' <i>for you</i>' : '';
    switch (ev.action) {
      case 'status':
        if (ev.value === 'done')  return who + ' marked ' + tgt + ' as <b>completed</b>';
        if (ev.value === 'todo')  return who + ' moved ' + tgt + ' back to <b>Upcoming</b>';
        return who + ' moved ' + tgt + ' to <b>' +
               esc((STATUS[ev.value] || {}).label || ev.value) + '</b>';
      case 'pct':
        return who + ' set ' + tgt + ' to <b>' + esc(ev.value) + '%</b>';
      case 'join':
        return who + ' joined ' + tgt + ' \u2014 it is now shared';
      case 'leave':
        return who + ' left ' + tgt;
      case 'risk':
        return who + ' raised a risk: <b>' + esc(String(ev.value).split(';')[0]) + '</b>';
      case 'riskfix':
        return who + ' resolved risk <b>' + esc(ev.target) + '</b>' +
               (ev.value ? ': \u201c' + esc(clip(ev.value, 80)) + '\u201d' : '');
      case 'riskopen':
        return who + ' reopened risk <b>' + esc(ev.target) + '</b>';
      case 'dec':
        return who + ' recorded a decision: <b>' + esc(String(ev.value).split(';')[0]) + '</b>';
      case 'decst':
        return who + ' marked <b>' + esc(ev.target) + '</b> as <b>' + esc(ev.value) + '</b>';
      case 'note':
        // Clipped here, shown in full on the task itself. An untrimmed note is
        // often several lines and buries every other update under one entry.
        var n = String(ev.value);
        if (n.length > 96) n = n.slice(0, 95).replace(/\s+\S*$/, '') + '\u2026';
        return who + ' left a note on ' + tgt + ': \u201c' + esc(n) + '\u201d';
      case 'task':
        return who + ' created ' + tgt + forYou;
      case 'del':
        return who + ' removed ' + tgt;
      case 'msg':
        return who + ' sent a message to ' +
               esc(person(ev.target).short || ev.target);
      default:
        return '';
    }
  }
  function lastUpdates() {
    // 'read' is excluded: dismissing your own notification is not news for the
    // other person, and it would double every message with a second line.
    var evs = remoteEvents.concat(outbox).filter(function (e) { return e.action !== 'read'; });
    var rows = evs.slice().reverse().slice(0, 14).map(function (ev) {
      var txt = activityHTML(ev);
      if (!txt) return '';
      return '<li class="up"><span class="av-w">' + avatarHTML(ev.actor, 'sm') + '</span>' +
             '<span class="up-t">' + txt + '</span>' +
             '<span class="up-w">' + esc(relTime(ev.ts)) + '</span></li>';
    }).join('');

    // data.js `log[]` is deliberately NOT rendered (user's call). It stays in
    // the file as a written archive of W1, but nothing reads it - so the
    // weekly routine no longer tells anyone to append to it. If it is ever
    // wanted back, it is one block here, not lost data.
    if (!rows) return '<p class="empty">No activity yet. Changes you make on the board appear here.</p>';
    return '<ul class="updates">' + rows + '</ul>';
  }

  function nextSunum() {
    var s = (D.sunum || []).slice().sort(function (a, b) { return a.w - b.w; });
    for (var i = 0; i < s.length; i++) if (s[i].w >= NOW) return s[i];
    return null;
  }

  function renderOverview() {
    var ns = nextSunum();
    var sw = (D.weeks || []).filter(function (x) { return x.type === 'sunum'; }).map(function (x) { return x.w; });
    var remaining = sw.filter(function (w) { return w >= NOW; }).length;

    var kpi = kpiCard('Week', NOW + ' / ' + TOTAL, Math.round(NOW / TOTAL * 100)) +
      kpiCard('Overall progress', pctDone() + '%', pctDone()) +
      kpiCard('Presentations left', String(remaining), Math.round((sw.length - remaining) / (sw.length || 1) * 100)) +
      // The status breakdown now lives in the top row instead of a separate card.
      '<div class="card stat-tile"><h3>Task status</h3>' + statusRing() + '</div>';

    var nsHtml = ns ? ('<div class="card sunum-next">' +
        '<div class="wk">Next presentation &middot; Week ' + ns.w + (ns.ms ? ' &middot; ' + ns.ms : '') + '</div>' +
        '<h4>' + esc(ns.demo) + '</h4>' +
        '<div class="claim">&ldquo;' + esc(ns.claim) + '&rdquo;</div>' +
        '<div class="meta"><span style="display:inline-flex;align-items:center;gap:8px"><b>Speaker:</b>' + whoHTML(ns.speaker) + '</span>' +
        '<span><b>Fallback:</b> ' + esc(ns.fallback) + '</span></div></div>')
      : '<div class="card"><h3>Sunum</h3><p class="empty">No presentations left.</p></div>';

    // Timeline gets the FULL width: at 1.35fr it was still scrolling on a
    // laptop, which was the user's actual complaint about it being too small.
    return '<div class="grid g4">' + kpi + '</div>' +
      '<div class="card panel-lime" style="margin-top:16px"><h3>Project timeline</h3>' + miniTimeline() + '</div>' +
      '<div class="card" style="margin-top:16px"><h3>Task board</h3>' + miniBoard() + '</div>' +
      '<div style="margin-top:16px">' + nsHtml + '</div>' +
      '<div class="card" style="margin-top:16px"><h3>Last updates</h3>' +
        lastUpdates() + '</div>';
  }

  function renderGantt() {
    // Week header. Every week shows only its number; the special weeks are
    // told apart by their header colour, decoded by the legend under the
    // chart (same pattern as the overview timeline). The current week is
    // marked here and by a band below.
    var head = '';
    for (var w = 1; w <= TOTAL; w++) {
      var m = weekMeta(w);
      head += '<div class="wk ' + m.type + (w === NOW ? ' now' : '') + '">' +
              '<b>W' + w + '</b></div>';
    }

    // One band per week behind the rows, plus a line on the current week.
    var bands = '';
    for (var b = 1; b <= TOTAL; b++) {
      var bm = weekMeta(b);
      bands += '<i class="' + bm.type + (b === NOW ? ' now' : '') + '"></i>';
    }

    var rows = '';
    (D.ips || []).forEach(function (ip, ipi) {
      var list = tasksOf(ip.id);
      if (!list.length) return;
      // Everything belonging to one work package goes inside ONE element, so a
      // soft card can be drawn behind the package header AND its task rows at
      // once. Before this, group and task rows were flat siblings and the only
      // cue for "which bars belong to WP3" was the label column - useless once
      // you had scrolled right and were reading bars against the week bands.
      var block = '<div class="g-row g-group">' +
        '<div class="g-side"><button type="button" class="ip-btn" data-pkg="' + esc(ip.id) + '">' +
          esc(ip.label) + '</button></div>' +
        '<div class="g-track"></div></div>';

      list.forEach(function (t) {
        var bar = '';
        if (t.w) {
          var left = ((t.w[0] - 1) / TOTAL) * 100, width = ((t.w[1] - t.w[0] + 1) / TOTAL) * 100;
          var pct = t.status === 'done' ? 100 : (t.pct || 0);
          bar = '<button type="button" class="g-bar st-' + esc(t.status) + '" data-task="' + esc(t.id) + '" ' +
            'style="left:' + left.toFixed(3) + '%;width:' + width.toFixed(3) + '%;background:' + ownerBg(t.owner) + '" ' +
            'title="' + esc(t.id + ' · ' + t.title + ' — W' + t.w[0] +
              (t.w[1] !== t.w[0] ? '-W' + t.w[1] : '') + ' · ' + pct + '%') + '">' +
            // The progress fill was styled in the CSS but never rendered, so a
            // task at 70% looked identical to one at 0%.
            '<i class="g-fill" style="width:' + pct + '%"></i>' +
            // Avatar rides the progress point, exactly like the overview chart
            // (same marker + intro code). The % label travels with it, on the
            // side that has room: right of the avatar in the first half of the
            // bar, left of it in the second, so it never runs off the bar's end.
            // Team tasks draw two overlapped avatars, hence the wider edge.
            avatarMarker(pct, ipi, '.gantt2', 'g-av' + (pct >= 55 ? ' flip' : ''),
                         t.owner === 'EK' ? 21 : 15) +
              avatarHTML(t.owner, 'sm') +
              '<span class="g-pc">' + pct + '%</span></span></button>';
        } else {
          bar = '<span class="g-none">no dates yet</span>';
        }
        block += '<div class="g-row">' +
          '<div class="g-side"><button type="button" class="g-name" data-task="' + esc(t.id) + '">' +
            '<span class="g-id">' + esc(t.id) + '</span>' + esc(t.title) + '</button></div>' +
          '<div class="g-track">' + bar + '</div></div>';
      });

      // The tints are the package colour at ~8% and ~20% alpha. 8-digit hex
      // rather than color-mix(): ipColor() always returns a 6-digit hex, and
      // plain hex needs no support caveat on an offline, file:// -opened page.
      var c = ipColor(ip.id);
      rows += '<div class="g-pkg" style="--ipt:' + esc(c) + '14;--ipe:' + esc(c) + '33">' +
        block + '</div>';
    });

    var key = '<div class="tl-key">' +
      '<span><i class="k sunum"></i>Presentation week</span>' +
      '<span><i class="k vize"></i>Midterm — no work planned</span>' +
      '<span><i class="k final"></i>Final week</span>' +
      '<span><i class="k nowk"></i>This week (W' + NOW + ')</span></div>';

    return '<div class="card">' +
      '<div class="scroll-x"><div class="gantt2" style="--n:' + TOTAL + '">' +
        '<div class="g-row g-head"><div class="g-side"></div>' +
          '<div class="g-track"><div class="g-weeks">' + head + '</div></div></div>' +
        '<div class="g-body"><div class="g-bands"><div class="g-side"></div>' +
          '<div class="g-track"><div class="g-cols">' + bands + '</div></div></div>' +
          rows + '</div>' +
      '</div></div>' + key + '</div>';
  }

  function renderBoard() {
    var cols = STATUS_ORDER.concat(['blocked']).map(function (c) {
      var items = STATE.tasks.filter(function (t) { return t.status === c; });
      var cards = items.map(function (t) {
        return '<div class="tcard own-' + esc(t.owner) + '" draggable="true" data-task="' + esc(t.id) + '" ' +
          'style="background:' + ownerSoftBg(t.owner) + ';border-color:' + (OWNER_COLOR[t.owner] || '#ddd') + '66">' +
          '<div class="id">' + esc(t.id) + (t.ms ? ' &middot; ' + esc(t.ms) : '') + '</div>' +
          '<div class="t">' + esc(t.title) + '</div>' +
          '<div class="f">' + avatarHTML(t.owner, 'sm') +
            (t.w ? '<span>W' + t.w[0] + (t.w[1] !== t.w[0] ? '-' + t.w[1] : '') + '</span>' : '<span>no date</span>') +
            '<span>' + (t.status === 'done' ? 100 : (t.pct || 0)) + '%</span>' +
            (t.notes.length ? '<span class="nb" title="notes">' + t.notes.length + ' notes</span>' : '') + '</div>' +
          // The planning note (t.note) is not repeated on the card: it made the
          // cards long and uneven. It is shown in the task drawer on click.
          '</div>';
      }).join('') || '<div class="empty">-</div>';
      return '<div class="col" data-col="' + c + '" style="--c:' + STATUS[c].color + '">' +
        '<h4>' + STATUS[c].label +
        '<span>' + items.length + '<button class="addcol" data-add="' + c + '" title="Add a task to this column">+</button></span>' +
        '</h4>' + cards + '</div>';
    }).join('');
    return '<div class="exportbar"><button class="btn" id="addTaskBtn">+ Add task</button></div>' +
      '<div class="board">' + cols + '</div>';
  }

  function renderSunum() {
    var ns = nextSunum();
    return '<div class="sunum-list">' + (D.sunum || []).slice().sort(function (a, b) { return a.w - b.w; }).map(function (s) {
      var cls = 'card sunum-card' + (ns && s.w === ns.w ? ' is-next' : (s.w < NOW ? ' is-past' : ''));
      return '<div class="' + cls + '"><div class="hd"><b>Week ' + s.w + '</b>' +
        (s.ms ? '<span class="st proposed">' + esc(s.ms) + '</span>' : '') +
        '<span style="display:inline-flex;align-items:center;gap:8px;color:var(--ink-3)">Speaker:' + whoHTML(s.speaker) + '</span>' +
        (ns && s.w === ns.w ? '<span class="st accepted">NEXT</span>' : '') + '</div>' +
        '<dl><dt>On screen</dt><dd>' + esc(s.demo) + '</dd>' +
        '<dt>Claim</dt><dd class="claim-t">&ldquo;' + esc(s.claim) + '&rdquo;</dd>' +
        '<dt>Fallback</dt><dd class="fb">' + esc(s.fallback) + '</dd></dl></div>';
    }).join('') + '</div>';
  }

  // data.js instructs the reader to paste run results into results[], but the
  // Results card was hard-coded to "No runs yet" - so a pasted run rendered as
  // nothing and the page actively lied about having no numbers. num() prints a
  // dash for null rather than 0 or NaN: a metric that was not measured must not
  // be indistinguishable from one measured as zero.
  function runsTable() {
    var rs = D.results || [];
    if (!rs.length) return '<p class="empty">No runs yet. We do not invent numbers.</p>';
    var num = function (v) { return (v === null || v === undefined || v === '') ? '&ndash;' : esc(String(v)); };
    var rows = rs.slice().reverse().map(function (r) {
      return '<tr><td><b>' + esc(r.run || '?') + '</b><br><span style="color:var(--ink-3)">' +
        esc(r.model || '') + '</span></td>' +
        '<td>' + num(r.dscCell) + '</td><td>' + num(r.dscNeurite) + '</td>' +
        '<td>' + num(r.clDice) + '</td><td>' + num(r.folds) + '</td>' +
        '<td>' + esc(r.note || '') + '</td></tr>';
    }).join('');
    return '<div class="scroll-x"><table class="plain"><thead><tr><th>Run / model</th>' +
      '<th>DSC cell</th><th>DSC neurite</th><th>clDice</th><th>Folds</th><th>Note</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function sevWord(p, i) { var v = (p || 0) * (i || 0); return v >= 9 ? 'high' : v >= 4 ? 'medium' : 'low'; }

  /* Risks and decisions are written BY THE TEAM, from here. They used to be a
     static list in data.js that nobody could change without editing a file,
     which meant in practice they were never changed at all. Now one person
     raises a risk and the other can resolve it, and both acts are recorded in
     the same append-only log as everything else - so the register answers
     "who raised this, who closed it, and when" without anyone remembering. */
  function riskCard(r) {
    var open = r.status !== 'resolved';
    return '<button type="button" class="rk' + (open ? '' : ' done') + '" data-risk="' + esc(r.id) + '">' +
      '<span class="rk-top"><b class="rk-id">' + esc(r.id) + '</b>' +
        '<span class="sev ' + sevWord(r.p, r.i).charAt(0) + '">' + sevWord(r.p, r.i) + '</span>' +
        (open ? '' : '<span class="rk-ok">resolved</span>') +
        '<span class="rk-who">' + avatarHTML(r.owner, 'sm') + '</span></span>' +
      '<span class="rk-text">' + esc(r.text) + '</span>' +
      (r.mit ? '<span class="rk-mit">' + esc(r.mit) + '</span>' : '') +
      (!open && r.fix ? '<span class="rk-fix">' + esc(person(r.fixBy).short) + ': ' + esc(r.fix) + '</span>' : '') +
      '</button>';
  }

  function renderRisks() {
    var rs = (STATE.risks || []).slice();
    var openR = rs.filter(function (r) { return r.status !== 'resolved'; });
    var doneR = rs.filter(function (r) { return r.status === 'resolved'; });
    var risks = openR.concat(doneR).map(riskCard).join('') ||
      '<p class="empty big">No risks yet.<br><span>Raise one when something could derail the project ' +
      '\u2014 the other person can resolve it later, and both are recorded.</span></p>';

    var ds = (STATE.decisions || []).slice().sort(function (a, b) { return (a.w || 0) - (b.w || 0); });
    var dec = ds.map(function (d) {
      return '<button type="button" class="dc" data-dec="' + esc(d.id) + '">' +
        '<span class="dc-id">' + esc(d.id) + '</span>' +
        '<span class="dc-t">' + esc(d.title) + '</span>' +
        '<span class="dc-w">W' + esc(String(d.w)) + '</span>' +
        '<span class="st ' + esc(d.status) + '">' + esc(d.status) + '</span></button>';
    }).join('') ||
      '<p class="empty big">No decisions yet.<br><span>Record one when you settle something ' +
      'the project depends on, so W15 can explain why.</span></p>';

    return '<div class="card"><h3 class="has-add">Risk register' +
        '<button class="btn sm hd-add" id="addRiskBtn">+ Add risk</button></h3>' +
        '<div class="rk-list">' + risks + '</div></div>' +
      '<div class="grid g2" style="margin-top:16px;align-items:start">' +
      '<div class="card"><h3 class="has-add">Decisions' +
        '<button class="btn sm hd-add" id="addDecBtn">+ Add</button></h3>' +
        '<div class="dc-list">' + dec + '</div></div>' +
      '<div class="card"><h3>Results</h3>' + runsTable() + '</div></div>';
  }

  /* ---- risk drawer: read it, resolve it, or reopen it ---- */
  function openRisk(id) {
    var r = null;
    (STATE.risks || []).forEach(function (x) { if (x.id === id) r = x; });
    if (!r) return;
    var open = r.status !== 'resolved';
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><div><div class="id">Risk ' + esc(r.id) + ' &middot; ' +
        esc(sevWord(r.p, r.i)) + (r.by ? ' &middot; raised by ' + esc(person(r.by).short) : '') + '</div>' +
      '<h4>' + esc(r.text) + '</h4></div><button class="x" id="dwClose">&times;</button></div>' +
      (r.mit ? '<div class="dw-sec"><label>Planned mitigation</label><p class="gate">' + esc(r.mit) + '</p></div>' : '') +
      '<div class="dw-sec"><label>Owner</label><div class="who-row">' + whoHTML(r.owner) + '</div></div>' +
      (open
        ? '<div class="dw-sec"><label>Resolve it</label>' +
          '<p class="hint" style="margin:0 0 8px">Say how it was dealt with \u2014 that note is what the other person reads.</p>' +
          '<div class="row-add"><input type="text" id="rkFix" maxlength="240" placeholder="How was it resolved?">' +
          '<button class="btn sm" id="rkFixBtn">Resolve</button></div></div>'
        : '<div class="dw-sec"><label>Resolved by ' + esc(person(r.fixBy).short) + '</label>' +
          '<p class="gate">' + esc(r.fix || '(no note)') + '</p>' +
          '<button class="btn ghost sm" id="rkOpenBtn" style="margin-top:10px">Reopen</button></div>') +
      '</div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    if ($('#rkFixBtn')) $('#rkFixBtn').onclick = function () {
      addEvent('riskfix', r.id, $('#rkFix').value.trim()); openRisk(r.id);
    };
    if ($('#rkFix')) $('#rkFix').onkeydown = function (e) { if (e.key === 'Enter') $('#rkFixBtn').click(); };
    if ($('#rkOpenBtn')) $('#rkOpenBtn').onclick = function () { addEvent('riskopen', r.id, ''); openRisk(r.id); };
  }

  function openAddRisk() {
    var ppl = (D.people || []).map(function (p) {
      return '<option value="' + esc(p.code) + '"' + (p.code === ME ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
    var lvl = function (id, label) {
      return '<div><label>' + label + '</label><select id="' + id + '">' +
        '<option value="1">1 \u2014 low</option><option value="2" selected>2 \u2014 medium</option>' +
        '<option value="3">3 \u2014 high</option></select></div>';
    };
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><h4>Raise a risk</h4><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><label>What could go wrong?</label>' +
        '<input type="text" id="rkText" maxlength="200" placeholder="e.g. the new image batch arrives after W9"></div>' +
      '<div class="dw-sec two">' + lvl('rkP', 'How likely?') + lvl('rkI', 'How bad?') + '</div>' +
      '<div class="dw-sec"><label>Who watches it</label><select id="rkOwner">' + ppl + '</select></div>' +
      '<div class="dw-sec"><label>Plan, if you have one <span class="opt">optional</span></label>' +
        '<input type="text" id="rkMit" maxlength="240" placeholder="What would we do about it?"></div>' +
      '<div class="dw-sec"><button class="btn" id="rkSave">Add risk</button></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    $('#rkSave').onclick = function () {
      var t = $('#rkText').value.trim(); if (!t) { $('#rkText').focus(); return; }
      // ';' is the field separator inside VALUE, so it cannot survive in text.
      var clean = function (v) { return v.replace(/;/g, ','); };
      addEvent('risk', 'R' + newId().slice(0, 4).toUpperCase(),
        [clean(t), $('#rkP').value, $('#rkI').value, $('#rkOwner').value, clean($('#rkMit').value.trim())].join(';'));
      closeDrawer();
    };
    $('#rkText').focus();
  }

  /* ---- decision drawer ---- */
  var DEC_ST = ['open', 'proposed', 'accepted', 'rejected'];
  function openDecision(id) {
    var d = null;
    (STATE.decisions || []).forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    var btns = DEC_ST.map(function (k) {
      return '<button class="sbtn dst' + (d.status === k ? ' on' : '') + '" data-st="' + k + '">' + k + '</button>';
    }).join('');
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><div><div class="id">Decision ' + esc(d.id) + ' &middot; W' + esc(String(d.w)) +
        (d.by ? ' &middot; by ' + esc(person(d.by).short) : '') + '</div>' +
      '<h4>' + esc(d.title) + '</h4></div><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><label>Status</label><div class="sbtns">' + btns + '</div></div>' +
      '<div class="dw-sec"><p class="hint" style="margin:0">The reasoning belongs in ' +
        '<b>llm-wiki/DECISIONS.md</b>; this is the index.</p></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    all('#drawer .dst').forEach(function (b) {
      b.onclick = function () { addEvent('decst', d.id, b.getAttribute('data-st')); openDecision(d.id); };
    });
  }

  function openAddDecision() {
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><h4>Record a decision</h4><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><label>What did you decide?</label>' +
        '<input type="text" id="dcT" maxlength="160" placeholder="e.g. units are micrometres, not pixels"></div>' +
      '<div class="dw-sec two"><div><label>Week</label>' +
        '<input type="number" id="dcW" min="1" max="' + TOTAL + '" value="' + NOW + '"></div>' +
        '<div><label>Status</label><select id="dcS">' +
        DEC_ST.map(function (k) { return '<option value="' + k + '"' + (k === 'proposed' ? ' selected' : '') + '>' + k + '</option>'; }).join('') +
        '</select></div></div>' +
      '<div class="dw-sec"><button class="btn" id="dcSave">Add decision</button></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    $('#dcSave').onclick = function () {
      var t = $('#dcT').value.trim(); if (!t) { $('#dcT').focus(); return; }
      addEvent('dec', 'D' + newId().slice(0, 4).toUpperCase(),
        [t.replace(/;/g, ','), parseInt($('#dcW').value, 10) || NOW, $('#dcS').value].join(';'));
      closeDrawer();
    };
    $('#dcT').focus();
  }

  /* ---------------- 6) INTERACTIONS ---------------- */
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').innerHTML = ''; }

  /* Work-package detail panel. The timeline used to be a dead end: the label
     carried a title attribute nobody hovers and the desc field had no reader at
     all. Clicking a package now shows what it actually covers, its real span
     and progress derived from its tasks, and every task in it as a link into
     the task drawer - so the timeline becomes a way in rather than a picture. */
  function openPkg(ipId) {
    var ip = null, l = D.ips || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === ipId) ip = l[i];
    if (!ip) return;
    var ts = tasksOf(ipId);
    var sched = ts.filter(function (t) { return t.w; });
    var span = sched.length
      ? 'W' + Math.min.apply(null, sched.map(function (t) { return t.w[0]; })) +
        ' \u2013 W' + Math.max.apply(null, sched.map(function (t) { return t.w[1]; }))
      : 'not scheduled';
    // Same average the timeline bar uses, so the number here can never disagree
    // with the bar the user just clicked.
    var pct = ts.length ? Math.round(ts.reduce(function (n, t) {
      return n + (t.status === 'done' ? 100 : (t.pct || 0)); }, 0) / ts.length) : 0;
    var byStatus = {};
    ts.forEach(function (t) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    var counts = STATUS_ORDER.filter(function (k) { return byStatus[k]; }).map(function (k) {
      return '<span class="pill"><i style="background:' + STATUS[k].color + '"></i>' +
             esc(STATUS[k].label) + ' ' + byStatus[k] + '</span>';
    }).join('');

    var rows = ts.map(function (t) {
      var tp = t.status === 'done' ? 100 : (t.pct || 0);
      return '<li><button type="button" class="pkg-task" data-task="' + esc(t.id) + '">' +
        '<span class="tid">' + esc(t.id) + '</span>' +
        '<span class="ttl">' + esc(t.title) + '</span>' +
        '<span class="tw">' + (t.w ? 'W' + t.w[0] + (t.w[1] !== t.w[0] ? '-' + t.w[1] : '') : '\u2013') + '</span>' +
        whoHTML(t.owner) +
        '<span class="tpc" style="--c:' + STATUS[t.status].color + '">' + tp + '%</span>' +
        '</button></li>';
    }).join('') || '<li class="empty">No tasks in this package.</li>';

    $('#drawer').innerHTML =
      '<div class="dw-back"></div><div class="dw">' +
        '<div class="dw-hd"><div><div class="id">Work package &middot; ' + esc(span) + '</div>' +
        '<h4>' + esc(ip.label) + '</h4></div><button class="x" id="dwClose">&times;</button></div>' +
        (ip.desc ? '<div class="dw-sec"><p class="pkg-desc">' + esc(ip.desc) + '</p></div>' : '') +
        '<div class="dw-sec"><label>Progress <b>' + pct + '%</b></label>' +
          '<div class="pb lg"><i style="width:' + pct + '%;background:' + ipColor(ip.id) + '"></i></div>' +
          '<div class="pills">' + counts + '</div></div>' +
        '<div class="dw-sec"><label>Tasks (' + ts.length + ')</label>' +
          '<ul class="pkg-tasks">' + rows + '</ul></div>' +
      '</div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    all('#drawer .pkg-task').forEach(function (b) {
      b.onclick = function () { openTask(b.getAttribute('data-task')); };
    });
  }

  function openTask(id) {
    var t = taskById(id); if (!t) return;
    var pct = t.status === 'done' ? 100 : (t.pct || 0);
    var statusBtns = STATUS_ORDER.concat(['blocked']).map(function (k) {
      return '<button class="sbtn' + (t.status === k ? ' on' : '') + '" data-status="' + k + '" ' +
             'style="--c:' + STATUS[k].color + '">' + STATUS[k].label + '</button>';
    }).join('');
    var notes = t.notes.map(function (n) {
      return '<li><span class="w">' + esc(person(n.by).short) + '</span><span>' + esc(n.text) + '</span></li>';
    }).join('') || '<li class="empty">No notes.</li>';
    var joined = t.owner === 'EK' || t.owner === ME;
    var shared = t.owner === 'EK';
    var gate = null;
    (D.milestones || []).forEach(function (m) { if (m.id === t.ms) gate = m.gate; });
    $('#drawer').innerHTML =
      '<div class="dw-back"></div><div class="dw">' +
        '<div class="dw-hd"><div><div class="id">' + esc(t.id) + (t.ms ? ' &middot; ' + esc(t.ms) : '') + '</div>' +
        '<h4>' + esc(t.title) + '</h4></div><button class="x" id="dwClose">&times;</button></div>' +
        // The milestone this task feeds. milestones[].gate had exactly one
        // reader (the Milestones card) and that card is gone, so the gate text
        // moves here, where it is more useful anyway: you see what your task
        // has to make true, on the task itself.
        (gate ? '<div class="dw-sec"><label>Milestone ' + esc(t.ms) + '</label>' +
                '<p class="gate">' + esc(gate) + '</p></div>' : '') +
        // The planning note from data.js. Without this the field was write-only:
        // every warning we put on a task (critical path, patch leakage, the
        // WP5.2 dependency anomaly, the W14-15 integration timing) existed in
        // the data and reached no human. A note no view renders is silence.
        (t.note ? '<div class="dw-sec"><div class="dw-note">' + esc(t.note) + '</div></div>' : '') +
        '<div class="dw-sec"><label>Status</label><div class="sbtns">' + statusBtns + '</div></div>' +
        '<div class="dw-sec"><label>Progress <b id="pctOut">' + pct + '%</b></label>' +
          '<input type="range" id="pctRange" min="0" max="100" step="5" value="' + pct + '"></div>' +
        '<div class="dw-sec"><label>Assigned to</label><div class="who-row">' + whoHTML(t.owner) +
          // Three states, not two. Leaving is only offered on a SHARED task,
          // because a sole owner stepping off would leave nobody on it - so
          // that case says why instead of hiding a dead button.
          (!joined  ? '<button class="btn sm" id="joinBtn">Add me</button>'
           : shared ? '<button class="btn ghost sm" id="leaveBtn">Leave task</button>'
                    : '<span class="hint">Only you are on this task</span>') +
          '</div></div>' +
        '<div class="dw-sec"><label>Notes</label><ul class="log sm">' + notes + '</ul>' +
          '<div class="row-add"><input type="text" id="noteIn" maxlength="300" placeholder="Write a note..."><button class="btn sm" id="noteBtn">Add</button></div></div>' +
      '</div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    all('#drawer .sbtn').forEach(function (b) {
      b.onclick = function () { addEvent('status', t.id, b.getAttribute('data-status')); openTask(t.id); };
    });
    var rng = $('#pctRange');
    rng.oninput = function () { $('#pctOut').textContent = rng.value + '%'; };
    rng.onchange = function () { addEvent('pct', t.id, rng.value); openTask(t.id); };
    if ($('#joinBtn')) $('#joinBtn').onclick = function () { addEvent('join', t.id, ''); openTask(t.id); };
    if ($('#leaveBtn')) $('#leaveBtn').onclick = function () { addEvent('leave', t.id, ''); openTask(t.id); };
    $('#noteBtn').onclick = function () {
      var v = $('#noteIn').value.trim(); if (!v) return;
      addEvent('note', t.id, v); openTask(t.id);
    };
    $('#noteIn').onkeydown = function (e) { if (e.key === 'Enter') $('#noteBtn').click(); };
  }

  function openAddTask(initialStatus) {
    var ips = (D.ips || []).map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.label) + '</option>'; }).join('');
    var ppl = (D.people || []).map(function (p) { return '<option value="' + esc(p.code) + '"' + (p.code === ME ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><h4>New task</h4><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><label>Title</label><input type="text" id="ntTitle" maxlength="120" placeholder="What needs doing?"></div>' +
      '<div class="dw-sec"><label>Work package</label><select id="ntIp">' + ips + '</select></div>' +
      '<div class="dw-sec"><label>Owner</label><select id="ntOwner">' + ppl + '</select></div>' +
      '<div class="dw-sec two"><div><label>Start week</label><input type="number" id="ntA" min="1" max="' + TOTAL + '" value="' + NOW + '"></div>' +
        '<div><label>End week</label><input type="number" id="ntB" min="1" max="' + TOTAL + '" value="' + NOW + '"></div></div>' +
      '<div class="dw-sec"><button class="btn" id="ntSave">Add</button></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    $('#ntSave').onclick = function () {
      var title = $('#ntTitle').value.trim(); if (!title) { $('#ntTitle').focus(); return; }
      var a = parseInt($('#ntA').value, 10) || NOW, b = parseInt($('#ntB').value, 10) || a;
      if (b < a) b = a;
      var id = 'Y' + newId().slice(0, 4).toUpperCase();
      addEvent('task', id, [$('#ntIp').value, title.replace(/;/g, ','), $('#ntOwner').value, a, b].join(';'));
      // yeni gorev varsayilan olarak 'todo' dogar; baska bir sutuna eklendiyse
      // durumunu ikinci bir olayla tasiyoruz (olay gunlugu boyle calisiyor)
      if (initialStatus && initialStatus !== 'todo') addEvent('status', id, initialStatus);
      closeDrawer();
    };
    $('#ntTitle').focus();
  }

  /* ---------------- 7) SIDEBAR BOXES ---------------- */
  function renderMeBox() {
    var box = $('#meBox'); if (!box) return;
    box.innerHTML = '<div class="mini-label">Me</div><div class="me-row">' +
      (D.people || []).filter(function (p) { return p.code !== 'EK'; }).map(function (p) {
        return '<button class="me' + (ME === p.code ? ' on' : '') + '" data-me="' + esc(p.code) + '" title="' + esc(p.name) + '">' +
               avatarHTML(p.code, 'sm') + '<span>' + esc(p.short) + '</span></button>';
      }).join('') + '</div>';
    all('#meBox .me').forEach(function (b) {
      b.onclick = function () { ME = b.getAttribute('data-me'); lsSet('pc12.me', ME); renderMeBox(); render(); };
    });
  }

  /* Notifications: a direct line between the two of us, stored in exactly the
     same append-only log as everything else. Marking one read does not delete
     the line - it appends a 'read' event - so the conversation stays auditable
     and a dismissal can never race a write and lose the original message. */
  function renderMsgBox() {
    var box = $('#msgBox'); if (!box) return;
    var other = ME === 'ML' ? 'BM' : 'ML';
    var mine = (STATE.msgs || []).filter(function (m) { return m.to === ME; });
    var items = mine.slice().reverse().map(function (m) {
      return '<li class="msg">' +
        '<div class="msg-h">' + avatarHTML(m.from, 'sm') +
          '<span class="msg-t">' + esc(m.ts.slice(5, 16).replace('T', ' ')) + '</span>' +
          '<button class="msg-x" type="button" data-read="' + esc(m.id) +
            '" title="Mark as read">&#10005;</button>' +
        '</div><p>' + esc(m.text) + '</p></li>';
    }).join('') || '<li class="empty">No new messages.</li>';
    box.innerHTML =
      '<div class="mini-label">Notifications' +
        (mine.length ? ' <b class="badge">' + mine.length + '</b>' : '') + '</div>' +
      '<ul class="msgs">' + items + '</ul>' +
      '<div class="msg-new">' +
        '<input id="msgText" type="text" maxlength="240" placeholder="Message to ' +
          esc(person(other).short || other) + '">' +
        '<button id="msgSend" type="button">Send</button></div>';
    all('#msgBox .msg-x').forEach(function (b) {
      b.onclick = function () { addEvent('read', b.getAttribute('data-read'), ''); };
    });
    var inp = $('#msgText');
    function send() {
      var v = (inp.value || '').trim();
      if (!v) return;
      addEvent('msg', other, v);   // re-renders, which also clears the input
    }
    if ($('#msgSend')) $('#msgSend').onclick = send;
    if (inp) inp.onkeydown = function (e) { if (e.key === 'Enter') send(); };
  }

  // meta.updated is instructed "UPDATE EVERY WEEK" in two places in data.js and
  // had no read path at all, so a maintainer could follow the routine exactly
  // and see the page change in no way - the same silent no-op contract as the
  // unrendered results[]. This is the staleness banner from the original
  // design, finally built. Same round-trip date validation as the week anchor:
  // an unparseable value must read as "unknown", never as a confident number.
  function freshnessHTML() {
    var raw = (D.meta && D.meta.updated) || '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return '<span class="d">meta.updated is not a YYYY-MM-DD date</span>';
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var u = new Date(y, mo, d);
    if (u.getFullYear() !== y || u.getMonth() !== mo || u.getDate() !== d) {
      return '<span class="d">meta.updated is not a real date: ' + esc(raw) + '</span>';
    }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((today - u) / 86400000);
    // A future date is a typo, not freshness - say so instead of showing a
    // negative age or silently rounding it to "today".
    var age = days < 0 ? 'dated in the future' :
              days === 0 ? 'today' :
              days === 1 ? 'yesterday' : days + ' days ago';
    // 10 days is one presentation cycle plus slack: past that the dashboard is
    // probably being read as current when it is not.
    var cls = (days < 0 || days > 10) ? ' stale' : '';
    return '<span class="fresh' + cls + '">Updated ' + esc(raw) + ' &middot; ' + age + '</span>';
  }

  function renderSyncBox() {
    var box = $('#syncBox'); if (!box) return;
    var st = SYNC_TEXT[SYNC] || ['warn', SYNC];
    var n = outbox.length, actions = '';
    if (SYNC === 'LOCAL_ONLY') {
      actions = '<div class="hint">Opened from a file, so nothing is shared. Open it from the GitHub Pages URL.</div>';
    } else if (SYNC === 'ERROR') {
      actions = '<button class="btn sm w" id="retryBtn">Retry</button>';
      if (n && !token) actions += '<button class="btn ghost sm w" id="tokBtn">Enter token</button>';
      else if (n) actions += '<button class="btn ghost sm w" id="saveBtn">Save</button>';
    } else if (SYNC === 'AUTH_REQUIRED' || (n && !token)) {
      actions = '<button class="btn sm w" id="tokBtn">Enter token & save</button>';
    } else if (n) {
      actions = '<button class="btn sm w" id="saveBtn">' + n + ' changes to save</button>';
    }
    if (n) actions += '<button class="btn ghost sm w" id="copyBtn">Copy lines</button>';
    box.innerHTML = '<div class="sync ' + st[0] + '"><b>' + esc(st[1]) + '</b>' +
      (n ? '<span>' + n + ' pending</span>' : '') +
      (syncDetail ? '<span class="d">' + esc(syncDetail) + '</span>' : '') +
      (badLines ? '<span class="d">' + badLines + ' malformed lines skipped</span>' : '') +
      (dupLines ? '<span class="d">' + dupLines + ' duplicate line applied once</span>' : '') +
      (orphanLines ? '<span class="d">' + orphanLines + ' line(s) point at a task that no longer exists</span>' : '') +
      (badAnchor ? '<span class="d">meta.w1Thursday is not a valid Thursday - week frozen at meta.currentWeek</span>' : '') +
      freshnessHTML() +
      '</div>' + actions;
    if ($('#retryBtn')) $('#retryBtn').onclick = function () {
      setSync('SYNCING');
      loadRemote().then(function () { recompute(); render(); });
    };
    if ($('#saveBtn')) $('#saveBtn').onclick = function () { pushOutbox(); };
    if ($('#tokBtn')) $('#tokBtn').onclick = askToken;
    if ($('#copyBtn')) $('#copyBtn').onclick = copyLines;
  }

  function askToken() {
    var cfg = repoCfg();
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><h4>GitHub token</h4><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><p class="hint">Token <b>only while this tab is open</b> bellekte tutulur. ' +
      'It is never stored, never committed, and is gone when you close the tab. That is a deliberate security choice.</p>' +
      '<p class="hint">GitHub &rarr; Settings &rarr; Developer settings &rarr; Fine-grained tokens. ' +
      'Only for <b>' + esc(cfg ? cfg.owner + '/' + cfg.repo : 'this repository') + '</b> with permission <b>Contents: Read and write</b>.</p>' +
      '<input type="password" id="tokIn" autocomplete="current-password" placeholder="github_pat_..."></div>' +
      '<div class="dw-sec"><button class="btn" id="tokSave">Save & push</button></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    $('#tokSave').onclick = function () {
      var v = $('#tokIn').value.trim(); if (!v) return;
      token = v;                       // memory only - never localStorage
      closeDrawer(); pushOutbox();
    };
    $('#tokIn').focus();
  }

  function copyLines() {
    var txt = outbox.map(serialize).join('\n');
    var cfg = repoCfg();
    var url = cfg ? 'https://github.com/' + cfg.owner + '/' + cfg.repo + '/edit/' + cfg.branch + '/' + cfg.path : '';
    function done(ok) {
      var b = $('#copyBtn'); if (b) b.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(renderSyncBox, 2500);
      if (ok && url) window.open(url, '_blank', 'noopener');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
    } else { done(false); }
  }

  /* ---------------- 8) ROUTING ---------------- */
  var VIEWS = {
    overview: { title: 'Overview', render: renderOverview },
    gantt:    { title: 'Timeline', render: renderGantt },
    board:    { title: 'Task board', render: renderBoard },
    sunum:    { title: 'Presentations', render: renderSunum },
    risk:     { title: 'Risks & decisions', render: renderRisks }
  };
  function current() { var h = (location.hash || '').replace('#', ''); return VIEWS[h] ? h : 'overview'; }

  function render() {
    var k = current(), v = VIEWS[k];
    $('#viewTitle').textContent = v.title;
    $('#view').innerHTML = v.render();
    all('.nav button').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-v') === k ? 'true' : 'false');
    });
    all('[data-pkg]').forEach(function (el) {
      el.onclick = function () { openPkg(el.getAttribute('data-pkg')); };
    });
    all('[data-task]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        // The guard exists so a control INSIDE a card (an input, a nested
        // action button) does not also open the task. But some task elements
        // ARE buttons themselves - the Gantt bars, the Gantt task names, the
        // status tiles - and a blanket "any button cancels" silently killed
        // their click. This has now been the same bug three times, so the
        // rule is stated once, properly: a control cancels only when it is a
        // DIFFERENT element than the task target.
        var ctl = e.target.closest('input,select,button');
        if (ctl && ctl !== el) return;
        openTask(el.getAttribute('data-task'));
      });
    });
    if ($('#addTaskBtn')) $('#addTaskBtn').onclick = function () { openAddTask('todo'); };
    if ($('#addRiskBtn')) $('#addRiskBtn').onclick = openAddRisk;
    if ($('#addDecBtn')) $('#addDecBtn').onclick = openAddDecision;
    all('[data-risk]').forEach(function (b) { b.onclick = function () { openRisk(b.getAttribute('data-risk')); }; });
    all('[data-dec]').forEach(function (b) { b.onclick = function () { openDecision(b.getAttribute('data-dec')); }; });
    all('.addcol').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openAddTask(b.getAttribute('data-add')); };
    });
    all('[data-goboard]').forEach(function (el) {
      el.onclick = function () { location.hash = 'board'; };
    });
    if (k === 'board') wireDrag();
    playTimelineIntro();
    renderMsgBox();
    renderSyncBox();
  }

  function wireDrag() {
    var dragId = null;
    all('.tcard').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        dragId = el.getAttribute('data-task'); el.classList.add('drag');
        try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
      });
      el.addEventListener('dragend', function () { el.classList.remove('drag'); dragId = null; });
    });
    all('.col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over');
        var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        var target = col.getAttribute('data-col');
        if (!id || !STATUS[target]) return;
        var t = taskById(id); if (!t || t.status === target) return;
        addEvent('status', id, target);
      });
    });
  }

  function boot() {
    $('#projName').textContent = (D.meta && D.meta.project) || 'Proje';
    $('#projSub').textContent = (D.meta && D.meta.course) || '';
    ME = lsGet('pc12.me', 'ML'); if (ME !== 'ML' && ME !== 'BM') ME = 'ML';
    loadOutbox();
    all('.nav button').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = b.getAttribute('data-v'); });
    });
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    // kenar cubugu ac/kapat - tercih taraycida hatirlanir
    var st = $('#sideToggle');
    if (st) {
      if (lsGet('pc12.side', 'open') === 'closed') document.body.classList.add('side-collapsed');
      st.addEventListener('click', function () {
        var closed = document.body.classList.toggle('side-collapsed');
        lsSet('pc12.side', closed ? 'closed' : 'open');
      });
    }
    renderMeBox();
    recompute(); render();
    loadRemote().then(function () { recompute(); render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
