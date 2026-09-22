/* PC12 ENG400 dashboard — rendering + interaction.
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
    d.innerHTML = '<b>Dashboard yüklenemedi</b>' + msg;
    document.body.insertBefore(d, document.body.firstChild);
  }
  window.addEventListener('error', function (e) {
    fatal('Hata: ' + e.message + (e.lineno ? '\n\nSatır: ' + e.lineno : ''));
  });

  var D = window.PC12_DATA;
  if (!D) { fatal('data.js yüklenmedi veya window.PC12_DATA tanımlı değil.'); return; }

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
  var NOW = (D.meta && D.meta.currentWeek) || 1;

  var STATUS = {
    todo:    { label: 'Başlamadı',    color: '#dfe4da' },
    doing:   { label: 'Devam ediyor', color: '#c7d96b' },
    review:  { label: 'İncelemede',   color: '#5eb8c9' },
    done:    { label: 'Tamamlandı',   color: '#7dd3a0' },
    blocked: { label: 'Engellendi',   color: '#ef8b8b' }
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
  var IP_COLOR = { IP0:'#cbd5e1', IP1:'#5eb8c9', IP2:'#7dd3a0', IP3:'#c7d96b',
                   IP4:'#b8a4e3', IP5:'#f2b880', IP6:'#f0a6a6', IP7:'#d8d8d8' };
  function ipColor(id) { return IP_COLOR[id] || '#ddd'; }

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
      return '<span class="avs" title="Ekip">' +
             avatarHTML('ML', size || 'sm') + avatarHTML('BM', size || 'sm') + '</span>';
    }
    var cls = 'av' + (size ? ' ' + size : '');
    var ring2 = 'box-shadow:0 0 0 2px ' + ring + ',0 0 0 4px var(--panel)';
    if (p.avatar) {
      return '<span class="' + cls + '" style="' + ring2 + '" title="' + esc(p.name) + '">' +
             '<img src="' + esc(p.avatar) + '" alt="' + esc(p.name) + '" loading="lazy"></span>';
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

  var badLines = 0, dupLines = 0;
  var ACTORS  = /^(ML|BM)$/;
  var ACTIONS = /^(status|pct|join|note|task|del)$/;
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
    var by = {}; st.tasks.forEach(function (t) { by[t.id] = t; });
    var seen = {};
    dupLines = 0;
    events.forEach(function (ev) {
      if (seen[ev.id]) { dupLines++; return; }   // idempotent, but surfaced (I3)
      seen[ev.id] = 1;
      var t = by[ev.target];
      if (ev.action === 'task') {
        if (t) return;
        var p = String(ev.value).split(';');
        var nt = { id: ev.target, ip: p[0] || 'IP0', title: p[1] || '(başlıksız)',
                   owner: p[2] || ev.actor,
                   w: (p[3] && p[4]) ? [parseInt(p[3], 10), parseInt(p[4], 10)] : null,
                   status: 'todo', pct: 0, ms: null, note: null, notes: [], added: true };
        st.tasks.push(nt); by[nt.id] = nt;
        return;
      }
      if (!t) return;
      if (ev.action === 'status') {
        if (STATUS[ev.value]) { t.status = ev.value; if (ev.value === 'done') t.pct = 100; }
      } else if (ev.action === 'pct') {
        var n = parseInt(ev.value, 10);
        if (!isNaN(n)) { t.pct = Math.max(0, Math.min(100, n)); if (t.status === 'todo' && t.pct > 0) t.status = 'doing'; }
      } else if (ev.action === 'join') {
        if (t.owner !== ev.actor && t.owner !== 'EK') t.owner = 'EK';   // idempotent
      } else if (ev.action === 'note') {
        t.notes.push({ by: ev.actor, ts: ev.ts, text: ev.value });
      } else if (ev.action === 'del') {
        t.hidden = true;
      }
    });
    st.tasks = st.tasks.filter(function (t) { return !t.hidden; });
    return st;
  }

  /* ---------------- 3) SYNC STATE (6 states) ---------------- */
  var SYNC = 'LOCAL_ONLY';
  var SYNC_TEXT = {
    LOCAL_ONLY:    ['warn', 'Yerel mod'],
    SYNCED:        ['ok',   'Kayıtlı'],
    PENDING:       ['warn', 'Kaydedilmemiş değişiklik'],
    SYNCING:       ['warn', 'Kaydediliyor...'],
    AUTH_REQUIRED: ['warn', 'Token gerekli'],
    ERROR:         ['bad',  'Kaydedilemedi']
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
    if (!cfg) { setSync('ERROR', 'data.js içinde meta.repoUrl boş'); return Promise.resolve(); }
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
          if (cur.status === 401 || cur.status === 403) { setSync('AUTH_REQUIRED', 'Token geçersiz veya yetkisiz'); return; }
          setSync('ERROR', 'GitHub okunamadı (' + cur.status + ')'); return;
        }
        var have = {}; parseLog(cur.text).forEach(function (e) { have[e.id] = 1; });
        var add = outbox.filter(function (e) { return !have[e.id]; });
        if (!add.length) { finish(cur.text); return; }      // already committed earlier
        var body = cur.text + (cur.text === '' || /\n$/.test(cur.text) ? '' : '\n') +
                   add.map(serialize).join('\n') + '\n';
        return ghPut(cfg, body, cur.sha, add.length).then(function (res) {
          if (res.ok) {
            return ghGet(cfg).then(function (chk) {          // verify before clearing
              if (!chk.ok) { setSync('PENDING', 'Yazıldı ama doğrulanamadı'); return; }
              finish(chk.text);
            });
          }
          if (res.status === 401 || res.status === 403) { setSync('AUTH_REQUIRED', 'Token yetkisiz'); return; }
          if (res.status === 409 || res.status === 422) {
            attempt++;
            if (attempt >= 5) { setSync('PENDING', 'Çakışma sürdü, tekrar deneyin'); return; }
            return sleep(300 * Math.pow(2, attempt) + Math.random() * 400).then(round);
          }
          setSync('ERROR', 'GitHub yazamadı (' + res.status + ')');
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
      else setSync('ERROR', 'data.txt okunamadi: ' + String((err && err.message) || err));
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

  function donut() {
    var counts = {};
    STATE.tasks.forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; });
    var total = STATE.tasks.length || 1, C = 2 * Math.PI * 52, off = 0, segs = '', leg = '';
    ['done', 'review', 'doing', 'todo', 'blocked'].forEach(function (k) {
      var n = counts[k] || 0; if (!n) return;
      var len = C * (n / total);
      segs += '<circle cx="66" cy="66" r="52" fill="none" stroke="' + STATUS[k].color +
              '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
              '" stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
      off += len;
      leg += '<div><i style="background:' + STATUS[k].color + '"></i>' + STATUS[k].label +
             '<span class="n">' + n + '</span></div>';
    });
    return '<div class="donut-wrap"><div class="donut"><svg width="132" height="132" viewBox="0 0 132 132">' +
      '<circle cx="66" cy="66" r="52" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="18"></circle>' + segs +
      '</svg><div class="mid"><div><b>' + doneCount() + '/' + STATE.tasks.length + '</b><span>görev bitti</span></div></div></div>' +
      '<div class="legend">' + leg + '</div></div>';
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

  function miniTimeline() {
    var head = '<div class="head"><div></div><div class="hcols">' + weekCols(true) + '</div></div>';
    var rows = (D.ips || []).map(function (ip) {
      var ts = tasksOf(ip.id).filter(function (t) { return t.w; });
      if (!ts.length) return '';                  // unscheduled package -> no row
      var a = Math.min.apply(null, ts.map(function (t) { return t.w[0]; }));
      var b = Math.max.apply(null, ts.map(function (t) { return t.w[1]; }));
      var left = ((a - 1) / TOTAL) * 100, width = ((b - a + 1) / TOTAL) * 100;
      var pct = Math.round(ts.reduce(function (n, t) {
        return n + (t.status === 'done' ? 100 : (t.pct || 0)); }, 0) / ts.length);
      var who = ipPeople(ts).map(function (c) { return avatarHTML(c, 'sm'); }).join('');
      return '<div class="row"><div class="nm" title="' + esc(ip.label) + '">' + esc(ip.label) + '</div>' +
        '<div class="track"><div class="seg" title="' + esc(ip.label) + ' W' + a + '-W' + b + ' %' + pct + '" ' +
          'style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;background:' + ipColor(ip.id) + '">' +
          '<i class="fill" style="width:' + pct + '%"></i>' +
          '<span class="avs">' + who + '</span></div></div></div>';
    }).join('');
    var key = '<div class="tl-key">' +
      '<span><i class="k sunum"></i>Sunum haftası</span>' +
      '<span><i class="k vize"></i>Vize — çalışma yok</span>' +
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
          '<span class="pv">%' + pct + '</span></div></div>';
      }).join('') || '<div class="more">-</div>';
      var extra = items.length > 3 ? '<div class="more">+' + (items.length - 3) + ' tane daha</div>' : '';
      return '<div class="mcol"><h5>' + STATUS[k].label + '<span>' + items.length + '</span></h5>' + cards + extra + '</div>';
    }).join('') + '</div>';
  }

  function milestoneList() {
    return '<table class="plain"><tbody>' + (D.milestones || []).map(function (m) {
      var past = m.w < NOW, cur = m.w === NOW;
      return '<tr><td style="width:56px"><span class="st ' + (past ? 'accepted' : cur ? 'proposed' : 'open') + '">' +
        esc(m.id) + '</span></td><td style="width:54px;color:var(--ink-3)">W' + m.w + '</td><td>' + esc(m.gate) + '</td></tr>';
    }).join('') + '</tbody></table>';
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

    var kpi = kpiCard('Hafta', NOW + ' / ' + TOTAL, Math.round(NOW / TOTAL * 100)) +
      kpiCard('Genel ilerleme', pctDone() + '%', pctDone()) +
      kpiCard('Kalan sunum', String(remaining), Math.round((sw.length - remaining) / (sw.length || 1) * 100)) +
      // The status breakdown now lives in the top row instead of a separate card.
      '<div class="card panel-grad stat-tile"><h3>Görev durumu</h3>' + donut() + '</div>';

    var nsHtml = ns ? ('<div class="card sunum-next">' +
        '<div class="wk">Sıradaki sunum &middot; Hafta ' + ns.w + (ns.ms ? ' &middot; ' + ns.ms : '') + '</div>' +
        '<h4>' + esc(ns.demo) + '</h4>' +
        '<div class="claim">&ldquo;' + esc(ns.claim) + '&rdquo;</div>' +
        '<div class="meta"><span style="display:inline-flex;align-items:center;gap:8px"><b>Sunan:</b>' + whoHTML(ns.speaker) + '</span>' +
        '<span><b>Yedek plan:</b> ' + esc(ns.fallback) + '</span></div></div>')
      : '<div class="card"><h3>Sunum</h3><p class="empty">Planlanmış sunum kalmadı.</p></div>';

    var logs = (D.log || []).slice().reverse().slice(0, 12).map(function (l) {
      return '<li><span class="w">W' + l.w + '</span><span>' + esc(l.text) + '</span></li>';
    }).join('') || '<li class="empty">Henüz kayıt yok.</li>';

    // Timeline gets the FULL width: at 1.35fr it was still scrolling on a
    // laptop, which was the user's actual complaint about it being too small.
    return '<div class="grid g4">' + kpi + '</div>' +
      '<div class="card panel-lime" style="margin-top:16px"><h3>Proje zaman çizelgesi</h3>' + miniTimeline() + '</div>' +
      '<div class="card" style="margin-top:16px"><h3>Görev panosu</h3>' + miniBoard() + '</div>' +
      '<div style="margin-top:16px">' + nsHtml + '</div>' +
      '<div class="grid g2" style="margin-top:16px;align-items:start">' +
        '<div class="card"><h3>Kilometre taşları</h3>' + milestoneList() + '</div>' +
        '<div class="card"><h3>Son kayıtlar</h3><ul class="log">' + logs + '</ul></div></div>';
  }

  function renderGantt() {
    var WCOL = weekColW();
    var head = '<th class="lbl">Görev</th>';
    for (var w = 1; w <= TOTAL; w++) {
      var m = weekMeta(w);
      var tag = m.type === 'sunum' ? 'SUNUM' : m.type === 'vize' ? 'KAPALI' : m.type === 'final' ? 'FINAL' : '';
      head += '<th class="wk-h ' + m.type + '">W' + w + (tag ? '<small>' + tag + '</small>' : '<small>&nbsp;</small>') + '</th>';
    }
    var body = '';
    (D.ips || []).forEach(function (ip) {
      var rows = tasksOf(ip.id);
      if (!rows.length) return;
      body += '<tr class="ip-row"><td colspan="' + (TOTAL + 1) + '">' + esc(ip.label) + '</td></tr>';
      rows.forEach(function (t) {
        body += '<tr class="task" data-task="' + esc(t.id) + '"><td class="lbl">' + esc(t.id) + ' &middot; ' + esc(t.title) +
                (t.w ? '' : ' <span class="unsched">- tarih belirsiz</span>') + '</td>';
        for (var w2 = 1; w2 <= TOTAL; w2++) {
          var mm = weekMeta(w2), inner = '';
          if (t.w && w2 === t.w[0]) {
            var span = t.w[1] - t.w[0] + 1;
            var pct = t.status === 'done' ? 100 : (t.pct || 0);
            inner = '<div class="bar' + (t.status === 'done' ? ' done' : '') + '" style="background:' +
              ownerBg(t.owner) + ';right:' + (3 - (span - 1) * WCOL) + 'px" title="' +
              esc(t.id + ' ' + t.title + ' (%' + pct + ')') + '">' + esc(t.owner) + '</div>';
          }
          body += '<td class="cell' + (mm.type !== 'work' ? ' ' + mm.type : '') + '">' + inner + '</td>';
        }
        body += '</tr>';
      });
    });
    var legend = (D.people || []).map(function (p) {
      return '<span class="who">' + avatarHTML(p.code, 'sm') + '<span class="nm">' + esc(p.name) + '</span></span>';
    }).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');
    return '<div class="card"><h3>Zaman çizelgesi</h3><div class="tl-legend">' + legend + '</div>' +
      '<div class="scroll-x"><table class="gantt"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
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
            (t.w ? '<span>W' + t.w[0] + (t.w[1] !== t.w[0] ? '-' + t.w[1] : '') + '</span>' : '<span>tarih yok</span>') +
            '<span>%' + (t.status === 'done' ? 100 : (t.pct || 0)) + '</span>' +
            (t.notes.length ? '<span class="nb" title="not">' + t.notes.length + ' not</span>' : '') + '</div>' +
          (t.note ? '<div class="note">' + esc(t.note) + '</div>' : '') + '</div>';
      }).join('') || '<div class="empty">-</div>';
      return '<div class="col" data-col="' + c + '"><h4>' + STATUS[c].label + '<span>' + items.length + '</span></h4>' + cards + '</div>';
    }).join('');
    return '<div class="exportbar"><button class="btn" id="addTaskBtn">+ Görev ekle</button>' +
      '<span class="hint">Karta tıklayın: durum değiştirin, kendinizi ekleyin, not düşün. Sürüklemek de çalışır.</span></div>' +
      '<div class="board">' + cols + '</div>';
  }

  function renderSunum() {
    var ns = nextSunum();
    return '<div class="sunum-list">' + (D.sunum || []).slice().sort(function (a, b) { return a.w - b.w; }).map(function (s) {
      var cls = 'card sunum-card' + (ns && s.w === ns.w ? ' is-next' : (s.w < NOW ? ' is-past' : ''));
      return '<div class="' + cls + '"><div class="hd"><b>Hafta ' + s.w + '</b>' +
        (s.ms ? '<span class="st proposed">' + esc(s.ms) + '</span>' : '') +
        '<span style="display:inline-flex;align-items:center;gap:8px;color:var(--ink-3)">Sunan:' + whoHTML(s.speaker) + '</span>' +
        (ns && s.w === ns.w ? '<span class="st accepted">SIRADAKİ</span>' : '') + '</div>' +
        '<dl><dt>Ekranda</dt><dd>' + esc(s.demo) + '</dd>' +
        '<dt>İddia</dt><dd class="claim-t">&ldquo;' + esc(s.claim) + '&rdquo;</dd>' +
        '<dt>Yedek plan</dt><dd class="fb">' + esc(s.fallback) + '</dd></dl></div>';
    }).join('') + '</div>';
  }

  function renderRisks() {
    var sev = function (p, i) { var v = (p || 0) * (i || 0); return v >= 9 ? 'h' : v >= 4 ? 'm' : 'l'; };
    var sevT = function (p, i) { var v = (p || 0) * (i || 0); return v >= 9 ? 'yüksek' : v >= 4 ? 'orta' : 'düşük'; };
    var rows = (D.risks || []).map(function (r) {
      return '<tr><td><b>' + esc(r.id) + '</b></td><td>' + esc(r.text) + '</td>' +
        '<td><span class="sev ' + sev(r.p, r.i) + '">' + sevT(r.p, r.i) + '</span></td>' +
        '<td>' + avatarHTML(r.owner, 'sm') + '</td><td>' + esc(r.mit) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="empty">Kayıtlı risk yok.</td></tr>';
    var dec = (D.decisions || []).map(function (d) {
      return '<tr><td>' + esc(d.id) + ' - ' + esc(d.title) + '</td><td style="width:56px;color:var(--ink-3)">W' + d.w +
        '</td><td style="width:104px"><span class="st ' + esc(d.status) + '">' + esc(d.status) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="3" class="empty">-</td></tr>';
    return '<div class="card"><h3>Risk kaydı</h3><table class="plain"><thead><tr><th>#</th><th>Risk</th><th>Şiddet</th><th>Sahip</th><th>Azaltma</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="grid g2" style="margin-top:16px;align-items:start">' +
      '<div class="card"><h3>Kararlar</h3><table class="plain"><tbody>' + dec + '</tbody></table></div>' +
      '<div class="card"><h3>Sonuçlar</h3><p class="empty">Henüz koşu yok. Sayı uydurmuyoruz.</p></div></div>';
  }

  /* ---------------- 6) INTERACTIONS ---------------- */
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').innerHTML = ''; }

  function openTask(id) {
    var t = taskById(id); if (!t) return;
    var pct = t.status === 'done' ? 100 : (t.pct || 0);
    var statusBtns = STATUS_ORDER.concat(['blocked']).map(function (k) {
      return '<button class="sbtn' + (t.status === k ? ' on' : '') + '" data-status="' + k + '" ' +
             'style="--c:' + STATUS[k].color + '">' + STATUS[k].label + '</button>';
    }).join('');
    var notes = t.notes.map(function (n) {
      return '<li><span class="w">' + esc(person(n.by).short) + '</span><span>' + esc(n.text) + '</span></li>';
    }).join('') || '<li class="empty">Not yok.</li>';
    var joined = t.owner === 'EK' || t.owner === ME;
    $('#drawer').innerHTML =
      '<div class="dw-back"></div><div class="dw">' +
        '<div class="dw-hd"><div><div class="id">' + esc(t.id) + (t.ms ? ' &middot; ' + esc(t.ms) : '') + '</div>' +
        '<h4>' + esc(t.title) + '</h4></div><button class="x" id="dwClose">&times;</button></div>' +
        '<div class="dw-sec"><label>Durum</label><div class="sbtns">' + statusBtns + '</div></div>' +
        '<div class="dw-sec"><label>İlerleme <b id="pctOut">%' + pct + '</b></label>' +
          '<input type="range" id="pctRange" min="0" max="100" step="5" value="' + pct + '"></div>' +
        '<div class="dw-sec"><label>Kim yapıyor</label><div class="who-row">' + whoHTML(t.owner) +
          (joined ? '<span class="hint">Bu görevdesiniz</span>'
                  : '<button class="btn sm" id="joinBtn">Beni de ekle</button>') + '</div></div>' +
        '<div class="dw-sec"><label>Notlar</label><ul class="log sm">' + notes + '</ul>' +
          '<div class="row-add"><input type="text" id="noteIn" maxlength="300" placeholder="Not yazın..."><button class="btn sm" id="noteBtn">Ekle</button></div></div>' +
      '</div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    all('#drawer .sbtn').forEach(function (b) {
      b.onclick = function () { addEvent('status', t.id, b.getAttribute('data-status')); openTask(t.id); };
    });
    var rng = $('#pctRange');
    rng.oninput = function () { $('#pctOut').textContent = '%' + rng.value; };
    rng.onchange = function () { addEvent('pct', t.id, rng.value); openTask(t.id); };
    if ($('#joinBtn')) $('#joinBtn').onclick = function () { addEvent('join', t.id, ''); openTask(t.id); };
    $('#noteBtn').onclick = function () {
      var v = $('#noteIn').value.trim(); if (!v) return;
      addEvent('note', t.id, v); openTask(t.id);
    };
    $('#noteIn').onkeydown = function (e) { if (e.key === 'Enter') $('#noteBtn').click(); };
  }

  function openAddTask() {
    var ips = (D.ips || []).map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.label) + '</option>'; }).join('');
    var ppl = (D.people || []).map(function (p) { return '<option value="' + esc(p.code) + '"' + (p.code === ME ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
    $('#drawer').innerHTML = '<div class="dw-back"></div><div class="dw">' +
      '<div class="dw-hd"><h4>Yeni görev</h4><button class="x" id="dwClose">&times;</button></div>' +
      '<div class="dw-sec"><label>Başlık</label><input type="text" id="ntTitle" maxlength="120" placeholder="Ne yapılacak?"></div>' +
      '<div class="dw-sec"><label>İş paketi</label><select id="ntIp">' + ips + '</select></div>' +
      '<div class="dw-sec"><label>Kim</label><select id="ntOwner">' + ppl + '</select></div>' +
      '<div class="dw-sec two"><div><label>Başlangıç haftası</label><input type="number" id="ntA" min="1" max="' + TOTAL + '" value="' + NOW + '"></div>' +
        '<div><label>Bitiş haftası</label><input type="number" id="ntB" min="1" max="' + TOTAL + '" value="' + NOW + '"></div></div>' +
      '<div class="dw-sec"><button class="btn" id="ntSave">Ekle</button></div></div>';
    $('#drawer').classList.add('open');
    $('#dwClose').onclick = closeDrawer;
    $('#drawer').querySelector('.dw-back').onclick = closeDrawer;
    $('#ntSave').onclick = function () {
      var title = $('#ntTitle').value.trim(); if (!title) { $('#ntTitle').focus(); return; }
      var a = parseInt($('#ntA').value, 10) || NOW, b = parseInt($('#ntB').value, 10) || a;
      if (b < a) b = a;
      var id = 'Y' + newId().slice(0, 4).toUpperCase();
      addEvent('task', id, [$('#ntIp').value, title.replace(/;/g, ','), $('#ntOwner').value, a, b].join(';'));
      closeDrawer();
    };
    $('#ntTitle').focus();
  }

  /* ---------------- 7) SIDEBAR BOXES ---------------- */
  function renderMeBox() {
    var box = $('#meBox'); if (!box) return;
    box.innerHTML = '<div class="mini-label">Ben</div><div class="me-row">' +
      (D.people || []).filter(function (p) { return p.code !== 'EK'; }).map(function (p) {
        return '<button class="me' + (ME === p.code ? ' on' : '') + '" data-me="' + esc(p.code) + '" title="' + esc(p.name) + '">' +
               avatarHTML(p.code, 'sm') + '<span>' + esc(p.short) + '</span></button>';
      }).join('') + '</div>';
    all('#meBox .me').forEach(function (b) {
      b.onclick = function () { ME = b.getAttribute('data-me'); lsSet('pc12.me', ME); renderMeBox(); render(); };
    });
  }

  function renderSyncBox() {
    var box = $('#syncBox'); if (!box) return;
    var st = SYNC_TEXT[SYNC] || ['warn', SYNC];
    var n = outbox.length, actions = '';
    if (SYNC === 'LOCAL_ONLY') {
      actions = '<div class="hint">Dosyadan açtığınız için paylaşım yok. GitHub Pages adresinden açın.</div>';
    } else if (SYNC === 'ERROR') {
      actions = '<button class="btn sm w" id="retryBtn">Tekrar dene</button>';
      if (n && !token) actions += '<button class="btn ghost sm w" id="tokBtn">Token gir</button>';
      else if (n) actions += '<button class="btn ghost sm w" id="saveBtn">Kaydet</button>';
    } else if (SYNC === 'AUTH_REQUIRED' || (n && !token)) {
      actions = '<button class="btn sm w" id="tokBtn">Token gir ve kaydet</button>';
    } else if (n) {
      actions = '<button class="btn sm w" id="saveBtn">' + n + ' değişikliği kaydet</button>';
    }
    if (n) actions += '<button class="btn ghost sm w" id="copyBtn">Satırları kopyala</button>';
    box.innerHTML = '<div class="sync ' + st[0] + '"><b>' + esc(st[1]) + '</b>' +
      (n ? '<span>' + n + ' bekleyen</span>' : '') +
      (syncDetail ? '<span class="d">' + esc(syncDetail) + '</span>' : '') +
      (badLines ? '<span class="d">' + badLines + ' bozuk satır atlandı</span>' : '') +
      (dupLines ? '<span class="d">' + dupLines + ' tekrar eden satır bir kez uygulandı</span>' : '') +
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
      '<div class="dw-sec"><p class="hint">Token <b>yalnızca bu sekme açıkken</b> bellekte tutulur. ' +
      'Kaydedilmez, commit edilmez, sekmeyi kapatınca silinir. Bu bilinçli bir güvenlik tercihi.</p>' +
      '<p class="hint">GitHub &rarr; Settings &rarr; Developer settings &rarr; Fine-grained tokens. ' +
      'Sadece <b>' + esc(cfg ? cfg.owner + '/' + cfg.repo : 'bu depo') + '</b> için, izin: <b>Contents: Read and write</b>.</p>' +
      '<input type="password" id="tokIn" autocomplete="current-password" placeholder="github_pat_..."></div>' +
      '<div class="dw-sec"><button class="btn" id="tokSave">Kaydet ve gönder</button></div></div>';
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
      var b = $('#copyBtn'); if (b) b.textContent = ok ? 'Kopyalandı' : 'Kopyalanamadı';
      setTimeout(renderSyncBox, 2500);
      if (ok && url) window.open(url, '_blank', 'noopener');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
    } else { done(false); }
  }

  /* ---------------- 8) ROUTING ---------------- */
  var VIEWS = {
    overview: { title: 'Genel bakış', render: renderOverview },
    gantt:    { title: 'Zaman çizelgesi', render: renderGantt },
    board:    { title: 'Görev panosu', render: renderBoard },
    sunum:    { title: 'Sunum planı', render: renderSunum },
    risk:     { title: 'Risk & karar', render: renderRisks }
  };
  function current() { var h = (location.hash || '').replace('#', ''); return VIEWS[h] ? h : 'overview'; }

  function render() {
    var k = current(), v = VIEWS[k];
    $('#viewTitle').textContent = v.title;
    $('#view').innerHTML = v.render();
    all('.nav button').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-v') === k ? 'true' : 'false');
    });
    all('[data-task]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('input,button,select')) return;
        openTask(el.getAttribute('data-task'));
      });
    });
    if ($('#addTaskBtn')) $('#addTaskBtn').onclick = openAddTask;
    if (k === 'board') wireDrag();
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
    renderMeBox();
    recompute(); render();
    loadRemote().then(function () { recompute(); render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
