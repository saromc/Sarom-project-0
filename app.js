/* Personal Fitness Planner — all data stays in this browser (localStorage). */
(() => {
  'use strict';

  const STORAGE_KEY = 'fitnessPlanner.v1';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---------- State ----------
  const emptyState = () => ({
    version: 1,
    settings: { kcal: '', protein: '', carbs: '', fat: '', unit: 'kg' },
    food: [],
    gym: [],
    body: {},
    plan: {},
    planDone: {},
    notes: {},
  });

  let state = load();
  let currentDate = todayISO();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return Object.assign(emptyState(), JSON.parse(raw));
    } catch {
      return emptyState();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast('Could not save — browser storage is unavailable or full.');
    }
  }

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const num = (v) => (v === '' || v == null || isNaN(+v) ? 0 : +v);
  const fmt = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function todayISO() {
    const d = new Date();
    return toISO(d);
  }
  function toISO(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fromISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function prettyDate(iso) {
    return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }
  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  // ---------- Derived data ----------
  const foodFor = (date) => state.food.filter((f) => f.date === date);
  const gymFor = (date) => state.gym.filter((g) => g.date === date);
  function totalsFor(date) {
    return foodFor(date).reduce((t, f) => {
      t.kcal += num(f.kcal); t.protein += num(f.protein); t.carbs += num(f.carbs); t.fat += num(f.fat);
      return t;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }
  function volume(g) {
    return num(g.sets) * num(g.reps) * num(g.weight);
  }
  function planFor(date) {
    return state.plan[fromISO(date).getDay()] || { title: '', items: '' };
  }

  // ---------- Rendering ----------
  function renderAll() {
    $('#currentDate').value = currentDate;
    $$('.dateLabel').forEach((el) => (el.textContent = prettyDate(currentDate)));
    $$('.unitW').forEach((el) => (el.textContent = state.settings.unit));
    renderToday();
    renderFood();
    renderGym();
    renderPlan();
    renderBody();
    renderSettings();
  }

  function statTile(label, value, target, unit) {
    const hasTarget = num(target) > 0;
    const pct = hasTarget ? Math.min(100, (value / target) * 100) : 0;
    const over = hasTarget && value > target;
    return `<div class="stat">
      <div class="label">${label}</div>
      <div class="value">${fmt(value)}${unit}</div>
      <div class="sub">${hasTarget ? `of ${fmt(target)}${unit} · ${fmt(target - value)}${unit} left` : 'no target set'}</div>
      ${hasTarget ? `<div class="bar ${over ? 'over' : ''}"><span style="width:${pct}%"></span></div>` : ''}
    </div>`;
  }

  function renderToday() {
    const t = totalsFor(currentDate);
    const s = state.settings;
    const gym = gymFor(currentDate);
    const vol = gym.reduce((a, g) => a + volume(g), 0);
    const w = state.body[currentDate];
    $('#todayStats').innerHTML =
      statTile('Calories', t.kcal, s.kcal, '') +
      statTile('Protein', t.protein, s.protein, 'g') +
      statTile('Carbs', t.carbs, s.carbs, 'g') +
      statTile('Fat', t.fat, s.fat, 'g') +
      `<div class="stat"><div class="label">Training volume</div><div class="value">${fmt(vol)}</div><div class="sub">${s.unit} · ${gym.length} entr${gym.length === 1 ? 'y' : 'ies'}</div></div>` +
      `<div class="stat"><div class="label">Body weight</div><div class="value">${w ? fmt(w.weight, 1) : '—'}</div><div class="sub">${w ? s.unit : 'not logged'}</div></div>`;

    // Planned workout with checkboxes
    const p = planFor(currentDate);
    const items = p.items.split('\n').map((x) => x.trim()).filter(Boolean);
    const done = state.planDone[currentDate] || [];
    $('#todayPlan').innerHTML = (p.title ? `<p><strong>${esc(p.title)}</strong></p>` : '') +
      (items.length
        ? `<ul class="plain">${items.map((it, i) => `<li class="${done.includes(i) ? 'done' : ''}">
            <input type="checkbox" data-plan-idx="${i}" ${done.includes(i) ? 'checked' : ''}><span>${esc(it)}</span></li>`).join('')}</ul>`
        : `<p class="empty">Nothing planned for ${DAYS[fromISO(currentDate).getDay()]}. Add it in Weekly Plan.</p>`);

    $('#todayGym').innerHTML = gym.length
      ? `<ul class="plain">${gym.map((g) => `<li><span>${esc(g.exercise)} — ${describeSet(g)}</span></li>`).join('')}</ul>`
      : '<p class="empty">No gym entries yet.</p>';

    $('#dayNote').value = state.notes[currentDate] || '';

    // Calories chart (last 14 days ending at currentDate)
    const days = Array.from({ length: 14 }, (_, i) => addDays(currentDate, i - 13));
    barChart($('#calChart'), days.map((d) => ({ label: d.slice(5), value: totalsFor(d).kcal })), num(s.kcal));
  }

  function describeSet(g) {
    const parts = [];
    if (num(g.reps)) parts.push(`${num(g.sets) || 1}×${g.reps}`);
    if (num(g.weight)) parts.push(`@ ${g.weight} ${state.settings.unit}`);
    if (num(g.minutes)) parts.push(`${g.minutes} min`);
    return parts.join(' ') || '—';
  }

  function renderFood() {
    const items = foodFor(currentDate);
    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    if (!items.length) {
      $('#foodList').innerHTML = '<p class="empty">Nothing logged yet.</p>';
    } else {
      let rows = '';
      for (const meal of meals) {
        const m = items.filter((f) => f.meal === meal);
        if (!m.length) continue;
        const mt = m.reduce((a, f) => a + num(f.kcal), 0);
        rows += `<tr class="group"><td>${meal}</td><td class="num">${fmt(mt)}</td><td colspan="4"></td></tr>`;
        rows += m.map((f) => `<tr>
          <td>${esc(f.name)}</td><td class="num">${fmt(num(f.kcal))}</td><td class="num">${fmt(num(f.protein), 1)}</td>
          <td class="num">${fmt(num(f.carbs), 1)}</td><td class="num">${fmt(num(f.fat), 1)}</td>
          <td class="num"><button class="icon" data-del-food="${f.id}" title="Delete">✕</button></td></tr>`).join('');
      }
      const t = totalsFor(currentDate);
      rows += `<tr><th>Total</th><th class="num">${fmt(t.kcal)}</th><th class="num">${fmt(t.protein, 1)}</th><th class="num">${fmt(t.carbs, 1)}</th><th class="num">${fmt(t.fat, 1)}</th><th></th></tr>`;
      $('#foodList').innerHTML = `<table><thead><tr><th>Food</th><th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">F</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // Quick re-add chips: 10 most recent distinct foods
    const seen = new Set(), recent = [];
    for (let i = state.food.length - 1; i >= 0 && recent.length < 10; i--) {
      const f = state.food[i], key = f.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); recent.push(f); }
    }
    $('#foodQuick').innerHTML = recent.length
      ? '<span class="muted">Quick add:</span>' + recent.map((f) => `<button class="chip" data-quick-food="${f.id}">${esc(f.name)}</button>`).join('')
      : '';
  }

  function renderGym() {
    const items = gymFor(currentDate);
    $('#gymList').innerHTML = items.length
      ? `<table><thead><tr><th>Exercise</th><th class="num">Sets</th><th class="num">Reps</th><th class="num">Weight</th><th class="num">Min</th><th>Notes</th><th></th></tr></thead><tbody>
        ${items.map((g) => `<tr><td>${esc(g.exercise)}</td><td class="num">${esc(g.sets)}</td><td class="num">${esc(g.reps)}</td>
          <td class="num">${esc(g.weight)}</td><td class="num">${esc(g.minutes)}</td><td>${esc(g.notes)}</td>
          <td class="num"><button class="icon" data-dup-gym="${g.id}" title="Repeat">⧉</button><button class="icon" data-del-gym="${g.id}" title="Delete">✕</button></td></tr>`).join('')}
        </tbody></table>`
      : '<p class="empty">No exercises logged yet.</p>';

    const names = [...new Set(state.gym.map((g) => g.exercise))].sort((a, b) => a.localeCompare(b));
    $('#exerciseList').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');

    const sel = $('#historyExercise');
    const prev = sel.value;
    sel.innerHTML = names.length ? names.map((n) => `<option>${esc(n)}</option>`).join('') : '<option value="">No exercises yet</option>';
    if (names.includes(prev)) sel.value = prev;
    renderHistory();
  }

  function renderHistory() {
    const name = $('#historyExercise').value;
    const entries = state.gym.filter((g) => g.exercise === name);
    if (!name || !entries.length) {
      $('#historyChart').innerHTML = '';
      $('#historyTable').innerHTML = '';
      return;
    }
    // Per-day: heaviest weight used
    const byDate = {};
    for (const g of entries) {
      const d = (byDate[g.date] ||= { top: 0, vol: 0, sets: [] });
      d.top = Math.max(d.top, num(g.weight));
      d.vol += volume(g);
      d.sets.push(describeSet(g));
    }
    const dates = Object.keys(byDate).sort();
    lineChart($('#historyChart'), dates.map((d) => ({ label: d.slice(5), value: byDate[d].top })));
    $('#historyTable').innerHTML = `<table><thead><tr><th>Date</th><th class="num">Top weight</th><th class="num">Volume</th><th>Sets</th></tr></thead><tbody>
      ${dates.slice().reverse().map((d) => `<tr><td>${prettyDate(d)}</td><td class="num">${fmt(byDate[d].top, 1)}</td>
        <td class="num">${fmt(byDate[d].vol)}</td><td>${esc(byDate[d].sets.join(', '))}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderPlan() {
    const todayIdx = fromISO(currentDate).getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    const grid = $('#planGrid');
    // Avoid wiping the textarea the user is typing in
    if (grid.contains(document.activeElement)) return;
    grid.innerHTML = order.map((i) => {
      const p = state.plan[i] || { title: '', items: '' };
      return `<div class="plan-day ${i === todayIdx ? 'is-today' : ''}">
        <h3>${DAYS[i]}</h3>
        <input data-plan-day="${i}" data-field="title" placeholder="e.g. Push / Rest / Legs" value="${esc(p.title)}">
        <textarea data-plan-day="${i}" data-field="items" rows="5" placeholder="One exercise per line">${esc(p.items)}</textarea>
      </div>`;
    }).join('');
  }

  function renderBody() {
    const dates = Object.keys(state.body).sort();
    const cur = state.body[currentDate];
    const form = $('#bodyForm');
    form.weight.value = cur ? cur.weight : '';
    form.waist.value = cur && cur.waist ? cur.waist : '';
    lineChart($('#weightChart'), dates.slice(-60).map((d) => ({ label: d.slice(5), value: num(state.body[d].weight) })));
    $('#bodyList').innerHTML = dates.length
      ? `<table><thead><tr><th>Date</th><th class="num">Weight (${state.settings.unit})</th><th class="num">Waist (cm)</th><th></th></tr></thead><tbody>
        ${dates.slice().reverse().map((d) => `<tr><td>${prettyDate(d)}</td><td class="num">${fmt(num(state.body[d].weight), 1)}</td>
          <td class="num">${state.body[d].waist ? fmt(num(state.body[d].waist), 1) : ''}</td>
          <td class="num"><button class="icon" data-del-body="${d}" title="Delete">✕</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No measurements yet.</p>';
  }

  function renderSettings() {
    const f = $('#settingsForm');
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'unit']) f[k].value = state.settings[k] ?? '';
  }

  // ---------- Tiny SVG charts ----------
  function barChart(el, data, target) {
    const W = 600, H = 180, P = 22;
    const max = Math.max(1, target || 0, ...data.map((d) => d.value)) * 1.1;
    const bw = (W - P * 2) / data.length;
    const y = (v) => H - P - (v / max) * (H - P * 2);
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><line class="axis" x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/>`;
    data.forEach((d, i) => {
      const x = P + i * bw + 3;
      svg += `<rect class="barrect" x="${x}" y="${y(d.value)}" width="${bw - 6}" height="${H - P - y(d.value)}" rx="2"><title>${d.label}: ${fmt(d.value)}</title></rect>`;
      if (i % 2 === 0 || data.length <= 7) svg += `<text x="${x + (bw - 6) / 2}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    });
    if (target) svg += `<line class="target" x1="${P}" x2="${W - P}" y1="${y(target)}" y2="${y(target)}"><title>Target ${fmt(target)}</title></line>`;
    el.innerHTML = svg + '</svg>';
  }

  function lineChart(el, data) {
    data = data.filter((d) => d.value > 0);
    if (data.length < 2) {
      el.innerHTML = '<p class="empty">Log at least two days to see a trend.</p>';
      return;
    }
    const W = 600, H = 180, P = 28;
    const vals = data.map((d) => d.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
    const x = (i) => P + (i / (data.length - 1)) * (W - P * 2);
    const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - P * 2);
    const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
    let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><line class="axis" x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/>
      <text x="2" y="${y(hi - pad) + 4}">${fmt(hi - pad, 1)}</text><text x="2" y="${y(lo + pad) + 4}">${fmt(lo + pad, 1)}</text>
      <polyline class="line" points="${pts}"/>`;
    const step = Math.ceil(data.length / 8);
    data.forEach((d, i) => {
      svg += `<circle class="dot" cx="${x(i)}" cy="${y(d.value)}" r="3"><title>${d.label}: ${fmt(d.value, 1)}</title></circle>`;
      if (i % step === 0 || i === data.length - 1) svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    });
    el.innerHTML = svg + '</svg>';
  }

  // ---------- Events ----------
  function setDate(iso) {
    if (!iso) return;
    currentDate = iso;
    renderAll();
  }
  $('#prevDay').onclick = () => setDate(addDays(currentDate, -1));
  $('#nextDay').onclick = () => setDate(addDays(currentDate, 1));
  $('#todayBtn').onclick = () => setDate(todayISO());
  $('#currentDate').onchange = (e) => setDate(e.target.value);

  $$('.tab').forEach((btn) => btn.addEventListener('click', () => {
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
    try { localStorage.setItem(STORAGE_KEY + '.tab', btn.dataset.tab); } catch {}
  }));
  try {
    const lastTab = localStorage.getItem(STORAGE_KEY + '.tab');
    if (lastTab) $(`.tab[data-tab="${lastTab}"]`)?.click();
  } catch {}

  $('#foodForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    state.food.push({ id: uid(), date: currentDate, ...d });
    save();
    e.target.reset();
    e.target.meal.value = d.meal;
    renderAll();
    toast('Food added');
  });

  $('#gymForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    state.gym.push({ id: uid(), date: currentDate, ...d });
    save();
    // Keep exercise/weight filled so the next set is quick to log
    e.target.notes.value = '';
    renderAll();
    toast('Logged');
  });

  $('#bodyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(e.target);
    state.body[currentDate] = { weight: d.weight, waist: d.waist };
    save();
    renderAll();
    toast('Saved');
  });

  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.settings = { ...state.settings, ...formData(e.target) };
    save();
    renderAll();
    toast('Settings saved');
  });

  $('#dayNote').addEventListener('input', (e) => {
    if (e.target.value) state.notes[currentDate] = e.target.value;
    else delete state.notes[currentDate];
    save();
  });

  $('#planGrid').addEventListener('input', (e) => {
    const day = e.target.dataset.planDay;
    if (day == null) return;
    const p = (state.plan[day] ||= { title: '', items: '' });
    p[e.target.dataset.field] = e.target.value;
    save();
    renderToday();
  });

  $('#historyExercise').addEventListener('change', renderHistory);

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, input[type=checkbox]');
    if (!t) return;
    const ds = t.dataset;
    if (ds.delFood) {
      state.food = state.food.filter((f) => f.id !== ds.delFood);
    } else if (ds.quickFood) {
      const f = state.food.find((x) => x.id === ds.quickFood);
      const meal = $('#foodForm').meal.value;
      state.food.push({ ...f, id: uid(), date: currentDate, meal });
      toast(`Added ${f.name} to ${meal}`);
    } else if (ds.delGym) {
      state.gym = state.gym.filter((g) => g.id !== ds.delGym);
    } else if (ds.dupGym) {
      const g = state.gym.find((x) => x.id === ds.dupGym);
      state.gym.push({ ...g, id: uid(), date: currentDate });
    } else if (ds.delBody) {
      delete state.body[ds.delBody];
    } else if (ds.planIdx != null) {
      const idx = +ds.planIdx;
      const done = new Set(state.planDone[currentDate] || []);
      t.checked ? done.add(idx) : done.delete(idx);
      state.planDone[currentDate] = [...done];
    } else {
      return;
    }
    save();
    renderAll();
  });

  // ---------- Backup ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('#exportBtn').onclick = () =>
    download(`fitness-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), 'application/json');

  $('#exportCsvBtn').onclick = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const food = ['type,date,meal,name,kcal,protein,carbs,fat',
      ...state.food.map((f) => ['food', f.date, f.meal, f.name, f.kcal, f.protein, f.carbs, f.fat].map(q).join(','))];
    const gym = ['type,date,exercise,sets,reps,weight,minutes,notes',
      ...state.gym.map((g) => ['gym', g.date, g.exercise, g.sets, g.reps, g.weight, g.minutes, g.notes].map(q).join(','))];
    download(`fitness-log-${todayISO()}.csv`, food.join('\n') + '\n\n' + gym.join('\n'), 'text/csv');
  };

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.food) || !Array.isArray(data.gym)) throw new Error('bad file');
      if (!confirm('Replace all current data with this backup?')) return;
      state = Object.assign(emptyState(), data);
      save();
      renderAll();
      toast('Backup imported');
    } catch {
      toast('That file is not a valid backup.');
    } finally {
      e.target.value = '';
    }
  });

  $('#wipeBtn').onclick = () => {
    if (!confirm('Erase ALL data? Export a backup first if you want to keep it.')) return;
    state = emptyState();
    save();
    renderAll();
    toast('All data erased');
  };

  renderAll();
})();
