/* Attendance Tracker BD — fully offline.
   All state lives in localStorage under KEY. No network requests ever. */

/* ---------- Bunk math: ONE pure function, hand-verified ----------
   present: classes marked present
   total:   present + absent (cancelled classes are excluded by the caller)
   required: required percentage, 1..100
   Returns { pct, safeBunks, need, state }.
   - If above/at threshold, max extra absences b with p/(t+b) >= r
     is b <= (p - r*t)/r, so safeBunks = floor((p - r*t)/r).
     Hand check: p=8,t=10,r=0.75 -> (8-7.5)/0.75 = 0.666 -> 0 bunks. Correct:
     one more absence gives 8/11 = 72.7% < 75%.
   - Hand check: p=9,t=10,r=0.75 -> (9-7.5)/0.75 = 2 bunks. 9/12 = 75% ok,
     9/13 = 69.2% not ok. Correct.
   - If below threshold, consecutive presents x with (p+x)/(t+x) >= r
     -> x >= (r*t - p)/(1-r), so need = ceil((r*t - p)/(1-r)).
     Hand check: p=5,t=10,r=0.75 -> (7.5-5)/0.25 = 10. 15/20 = 75%. Correct.
   - required = 100 and below it is unrecoverable -> need = Infinity. */
function bunkInfo(present, total, required) {
  if (total === 0) return { pct: null, safeBunks: 0, need: 0, state: 'empty' };
  const r = required / 100;
  const pct = (present / total) * 100;
  if (pct >= required) {
    const bunks = Math.floor((present - r * total) / r);
    return {
      pct,
      safeBunks: Math.max(0, bunks),
      need: 0,
      state: pct - required >= 5 ? 'safe' : 'warning',
    };
  }
  if (required >= 100) return { pct, safeBunks: 0, need: Infinity, state: 'danger' };
  const need = Math.ceil((r * total - present) / (1 - r));
  return { pct, safeBunks: 0, need, state: 'danger' };
}

/* ---------- Store ---------- */
const KEY = 'att-bd-v1';
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { subjects: [], lang: 'en' };
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.subjects)) return { subjects: [], lang: 'en' };
    // sanitize: keep only well-formed subjects
    s.subjects = s.subjects.filter(
      (x) => x && typeof x.id === 'string' && typeof x.name === 'string' &&
        Number.isFinite(x.required) && Array.isArray(x.log)
    );
    s.subjects.forEach((x) => {
      x.required = Math.min(100, Math.max(1, x.required));
      x.log = x.log.filter((e) => e && (e.status === 'present' || e.status === 'absent' || e.status === 'cancelled'));
    });
    if (s.lang !== 'bn') s.lang = 'en';
    return s;
  } catch (e) {
    return { subjects: [], lang: 'en' };
  }
}
function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function uid() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function counts(sub) {
  let p = 0, a = 0, c = 0;
  sub.log.forEach((e) => {
    if (e.status === 'present') p++;
    else if (e.status === 'absent') a++;
    else c++;
  });
  return { present: p, absent: a, cancelled: c, total: p + a };
}

let state = loadState();
const $ = (id) => document.getElementById(id);

/* ---------- i18n helpers ---------- */
function t(key) {
  let s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
  for (let i = 1; i < arguments.length; i++) {
    s = s.split('{' + (i - 1) + '}').join(String(arguments[i]));
  }
  return s;
}
function fmtNum(n, decimals) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = decimals !== undefined ? n.toFixed(decimals) : String(Math.round(n));
  if (state.lang === 'bn') {
    const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return s.replace(/[0-9]/g, (d) => bn[+d]).replace('.', '।');
  }
  return s;
}
function fmtDate(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(state.lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch (e) {
    return iso;
  }
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Rendering ---------- */
function render() {
  document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  document.title = t('appTitle');
  $('appTitle').textContent = t('appTitle');
  $('appSub').textContent = t('appSub');
  $('langBtn').textContent = state.lang === 'bn' ? 'EN' : 'বাং';
  $('addTitle').textContent = t('addSubject');
  $('nameInput').placeholder = t('namePh');
  $('reqLabel').textContent = t('reqPct');
  $('addBtn').textContent = t('add');
  $('overallTitle').textContent = t('overall');
  $('dataTitle').textContent = t('data');
  $('sampleBtn').textContent = t('sample');
  $('exportBtn').textContent = t('export');
  $('importBtn').textContent = t('import');
  $('clearBtn').textContent = t('clear');
  $('errAdd').textContent = '';

  // overall
  let p = 0, tot = 0;
  state.subjects.forEach((s) => { const c = counts(s); p += c.present; tot += c.total; });
  const ov = tot === 0 ? null : (p / tot) * 100;
  $('overallPct').textContent = ov === null ? '—' : fmtNum(ov, 1) + '%';
  $('overallDetail').textContent = ov === null ? t('noData') :
    t('classesCount', fmtNum(tot), fmtNum(p));

  // subjects
  const wrap = $('subjects');
  wrap.innerHTML = '';
  if (state.subjects.length === 0) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.id = 'emptyState';
    d.textContent = t('empty');
    wrap.appendChild(d);
  }
  state.subjects.forEach((s) => wrap.appendChild(subjectCard(s)));
}

function subjectCard(s) {
  const c = counts(s);
  const info = bunkInfo(c.present, c.total, s.required);
  const card = document.createElement('section');
  card.className = 'card subject';
  card.dataset.id = s.id;

  const pctTxt = info.pct === null ? '—' : fmtNum(info.pct, 1) + '%';

  let advice;
  if (info.state === 'empty') advice = `<p class="advice neutral">${esc(t('noMarks'))}</p>`;
  else if (info.state === 'safe') advice = `<p class="advice safe">${esc(t('bunks', fmtNum(info.safeBunks), fmtNum(s.required)))}</p>`;
  else if (info.state === 'warning') advice = `<p class="advice warning">${esc(t('edge', fmtNum(info.safeBunks), fmtNum(s.required)))}</p>`;
  else if (info.need === Infinity) advice = `<p class="advice danger">${esc(t('unrecoverable'))}</p>`;
  else advice = `<p class="advice danger">${esc(t('recover', fmtNum(info.need)))}</p>`;

  const logRows = s.log.length === 0
    ? `<p class="muted">${esc(t('noMarks'))}</p>`
    : '<ul class="log">' + s.log.map((e, i) => {
      const cls = e.status === 'present' ? 'lg-p' : e.status === 'absent' ? 'lg-a' : 'lg-c';
      return `<li><span class="dot ${cls}"></span>${esc(fmtDate(e.date))} — ${esc(t(e.status))}` +
        ` <button class="link delLog" data-i="${i}">${esc(t('del'))}</button></li>`;
    }).join('') + '</ul>';

  card.innerHTML = `
    <div class="subHead">
      <div>
        <h3>${esc(s.name)}</h3>
        <p class="muted">${esc(t('reqIs', fmtNum(s.required)))} · ${esc(t('classesCount', fmtNum(c.total), fmtNum(c.present)))}</p>
      </div>
      <div class="pct state-${info.state}">${esc(pctTxt)}</div>
    </div>
    <div class="bar"><div class="fill state-${info.state}" style="width:${info.pct === null ? 0 : Math.min(100, info.pct)}%"></div></div>
    ${advice}
    <div class="markRow">
      <button class="btn ok markBtn" data-act="present">${esc(t('present'))}</button>
      <button class="btn bad markBtn" data-act="absent">${esc(t('absent'))}</button>
      <button class="btn ghost markBtn" data-act="cancelled">${esc(t('cancelled'))}</button>
    </div>
    <div class="subTools">
      <label>${esc(t('reqPct'))} <input type="number" class="reqEdit" min="1" max="100" value="${s.required}"></label>
      <button class="link delSub">${esc(t('delSubject'))}</button>
    </div>
    <details class="logWrap"><summary>${esc(t('log'))} (${fmtNum(s.log.length)})</summary>${logRows}</details>`;

  card.querySelectorAll('.markBtn').forEach((b) => {
    b.addEventListener('click', () => {
      const today = new Date();
      const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      s.log.unshift({ date: iso, status: b.dataset.act });
      saveState(); render();
    });
  });
  card.querySelector('.reqEdit').addEventListener('change', (e) => {
    const v = Math.round(Number(e.target.value));
    if (!Number.isFinite(v) || v < 1 || v > 100) { render(); return; }
    s.required = v; saveState(); render();
  });
  card.querySelector('.delSub').addEventListener('click', () => {
    if (!confirm(t('confirmDelSub'))) return;
    state.subjects = state.subjects.filter((x) => x.id !== s.id);
    saveState(); render();
  });
  card.querySelectorAll('.delLog').forEach((b) => {
    b.addEventListener('click', () => {
      s.log.splice(Number(b.dataset.i), 1);
      saveState(); render();
    });
  });
  return card;
}

/* ---------- Actions ---------- */
function showErr(msg) {
  const e = $('errAdd');
  e.textContent = msg;
}

document.addEventListener('DOMContentLoaded', () => {
  $('addBtn').addEventListener('click', () => {
    const name = $('nameInput').value.trim();
    const req = Math.round(Number($('reqInput').value));
    if (!name) { showErr(t('errName')); return; }
    if (state.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) { showErr(t('errDup')); return; }
    if (!Number.isFinite(req) || req < 1 || req > 100) { showErr(t('errReq')); return; }
    state.subjects.push({ id: uid(), name, required: req, log: [] });
    $('nameInput').value = '';
    saveState(); render();
  });
  $('langBtn').addEventListener('click', () => {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    saveState(); render();
  });
  $('sampleBtn').addEventListener('click', () => {
    if (state.subjects.length && !confirm(t('confirmSample'))) return;
    state.subjects = sampleData();
    saveState(); render();
  });
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('importBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!s || !Array.isArray(s.subjects)) throw new Error('bad');
        state = s;
        state.subjects = state.subjects.filter((x) => x && typeof x.id === 'string');
        if (state.lang !== 'bn') state.lang = 'en';
        saveState(); render();
      } catch (err) {
        alert(t('errImport'));
      }
      e.target.value = '';
    };
    r.readAsText(f);
  });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm(t('confirmClear'))) return;
    state = { subjects: [], lang: state.lang };
    saveState(); render();
  });
  render();
});

function sampleData() {
  const mk = (name, required, marks) => {
    const s = { id: uid(), name, required, log: [] };
    const days = marks.length;
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      s.log.unshift({ date: iso, status: marks[i] });
    }
    return s;
  };
  return [
    mk('Data Structures', 75, ['present', 'present', 'absent', 'present', 'present', 'present', 'cancelled', 'present', 'absent', 'present']),
    mk('Computer Architecture', 75, ['present', 'absent', 'absent', 'present', 'present']),
    mk('English', 80, ['present', 'present', 'present', 'present']),
  ];
}
