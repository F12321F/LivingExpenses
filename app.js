'use strict';

/* ========== 資料層 ========== */
const STORAGE_KEY = 'livingExpenses.v1';

const DEFAULT_CATEGORIES = [
  ['expense', '早餐', '🍳', '#fb923c'],
  ['expense', '午餐', '🍱', '#f97316'],
  ['expense', '晚餐', '🍜', '#ea580c'],
  ['expense', '交通', '🚌', '#3b82f6'],
  ['expense', '購物', '🛍️', '#ec4899'],
  ['expense', '服裝', '👕', '#0ea5e9'],
  ['expense', '居住', '🏠', '#8b5cf6'],
  ['expense', '水電瓦斯', '💡', '#eab308'],
  ['expense', '通訊網路', '📱', '#06b6d4'],
  ['expense', '娛樂', '🎮', '#a855f7'],
  ['expense', '醫療', '💊', '#ef4444'],
  ['expense', '中醫', '🌿', '#16a34a'],
  ['expense', '教育', '📚', '#0ea5e9'],
  ['expense', '日用品', '🧻', '#84cc16'],
  ['expense', '保險', '🛡️', '#64748b'],
  ['expense', '其他', '📦', '#94a3b8'],
  ['income', '薪資', '💼', '#16a34a'],
  ['income', '獎金', '🎁', '#22c55e'],
  ['income', '投資', '📈', '#14b8a6'],
  ['income', '兼職', '🧑‍💻', '#0ea5e9'],
  ['income', '其他', '💰', '#84cc16'],
].map(([type, name, icon, color], i) => ({ id: 'c' + (i + 1), type, name, icon, color }));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.transactions) && Array.isArray(s.categories)) return s;
    }
  } catch (e) { /* 忽略，使用預設 */ }
  return { transactions: [], categories: DEFAULT_CATEGORIES.map(c => ({ ...c })) };
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('儲存失敗：瀏覽器儲存空間不可用');
  }
}

const catById = id => state.categories.find(c => c.id === id)
  || { id, name: '未分類', icon: '❔', color: '#94a3b8', type: 'expense' };

/** 新增分類，成功回傳新分類，失敗回傳 null */
function addCategory(type, name, icon, color) {
  name = name.trim().slice(0, 10);
  if (!name) { toast('請輸入分類名稱'); return null; }
  if (state.categories.some(c => c.type === type && c.name === name)) { toast('已有同名分類'); return null; }
  const cat = { id: 'c' + uid(), type, name, icon: icon.trim() || '🏷️', color };
  state.categories.push(cat);
  save();
  toast(`已新增分類「${name}」`);
  return cat;
}

/** 刪除分類；有紀錄時移到同類型的「其他」(或第一個分類)。回傳是否刪除 */
function deleteCategory(id) {
  const c = state.categories.find(x => x.id === id);
  if (!c) return false;
  if (state.categories.filter(x => x.type === c.type).length <= 1) { toast('至少需保留一個分類'); return false; }
  const used = state.transactions.filter(t => t.categoryId === id);
  if (used.length) {
    const fallback = state.categories.find(x => x.type === c.type && x.id !== id && x.name === '其他')
      || state.categories.find(x => x.type === c.type && x.id !== id);
    if (!confirm(`「${c.name}」有 ${used.length} 筆紀錄，刪除後將移到「${fallback.name}」。確定刪除？`)) return false;
    used.forEach(t => { t.categoryId = fallback.id; });
  } else if (!confirm(`刪除分類「${c.name}」？`)) return false;
  state.categories = state.categories.filter(x => x.id !== id);
  save();
  toast(`已刪除分類「${c.name}」`);
  return true;
}

/* ========== 工具 ========== */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const nf = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
const money = n => '$' + nf.format(Math.round(n * 100) / 100);
const shortMoney = n => {
  const a = Math.abs(n);
  if (a >= 1e8) return nf.format(+(n / 1e8).toFixed(1)) + '億';
  if (a >= 1e4) return nf.format(+(n / 1e4).toFixed(1)) + '萬';
  return nf.format(Math.round(n));
};
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

function sumBy(list) {
  let income = 0, expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount; else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

function summaryHTML({ income, expense, balance }, extra = {}) {
  const item = (label, value, cls, sub) =>
    `<div class="item"><div class="label">${label}</div><div class="value ${cls}">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
  return item('收入', money(income), 'income-c', extra.income)
    + item('支出', money(expense), 'expense-c', extra.expense)
    + item('結餘', (balance < 0 ? '-' : '') + money(Math.abs(balance)), balance < 0 ? 'expense-c' : '', extra.balance);
}

/* ========== 導覽 ========== */
const TITLES = { records: '記帳', stats: '統計', settings: '設定' };
let currentView = 'records';

function showView(name) {
  currentView = name;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  $('#viewTitle').textContent = TITLES[name];
  $('#fab').classList.toggle('hidden', name === 'settings');
  render();
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

function render() {
  if (currentView === 'records') renderRecords();
  else if (currentView === 'stats') renderStats();
  else renderSettings();
}

/* ========== 記帳明細 ========== */
const now = new Date();
const recCursor = { y: now.getFullYear(), m: now.getMonth() }; // m: 0-11

function monthKey(y, m) { return `${y}-${pad(m + 1)}`; }

function renderCategoryFilter() {
  const sel = $('#filterCategory');
  const type = $('#filterType').value;
  const prev = sel.value;
  const cats = state.categories.filter(c => type === 'all' || c.type === type);
  sel.innerHTML = '<option value="all">所有分類</option>' + cats.map(c =>
    `<option value="${c.id}">${esc(c.icon)} ${esc(c.name)}${type === 'all' ? (c.type === 'income' ? '（收）' : '（支）') : ''}</option>`).join('');
  sel.value = cats.some(c => c.id === prev) ? prev : 'all';
}

function renderRecords() {
  const key = monthKey(recCursor.y, recCursor.m);
  $('#recordsPeriod').textContent = `${recCursor.y} 年 ${recCursor.m + 1} 月`;
  renderCategoryFilter();

  const monthTx = state.transactions.filter(t => t.date.startsWith(key));
  $('#recordsSummary').innerHTML = summaryHTML(sumBy(monthTx));

  const fType = $('#filterType').value;
  const fCat = $('#filterCategory').value;
  const fText = $('#filterText').value.trim().toLowerCase();
  const list = monthTx
    .filter(t => (fType === 'all' || t.type === fType)
      && (fCat === 'all' || t.categoryId === fCat)
      && (!fText || (t.note || '').toLowerCase().includes(fText) || catById(t.categoryId).name.toLowerCase().includes(fText)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

  const box = $('#recordList');
  if (!list.length) {
    box.innerHTML = `<div class="empty"><div class="big">🧾</div>${monthTx.length ? '沒有符合條件的紀錄' : '這個月還沒有紀錄<br>點右下角「＋」開始記帳'}</div>`;
    return;
  }

  const groups = new Map();
  for (const t of list) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  let html = '';
  for (const [date, items] of groups) {
    const d = new Date(date + 'T00:00:00');
    const s = sumBy(items);
    const parts = [];
    if (s.income) parts.push(`收 ${money(s.income)}`);
    if (s.expense) parts.push(`支 ${money(s.expense)}`);
    html += `<div class="day-group"><div class="day-head"><span>${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）${date === today() ? '・今天' : ''}</span><span>${parts.join('　')}</span></div><div class="day-card">`;
    for (const t of items) {
      const c = catById(t.categoryId);
      html += `<button class="tx" data-id="${t.id}">
        <span class="tx-icon" style="background:${c.color}22">${esc(c.icon)}</span>
        <span class="tx-main"><div class="tx-cat">${esc(c.name)}</div>${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}</span>
        <span class="tx-amt ${t.type === 'income' ? 'income-c' : 'expense-c'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</span>
      </button>`;
    }
    html += '</div></div>';
  }
  box.innerHTML = html;
}

$('#recordList').addEventListener('click', e => {
  const b = e.target.closest('.tx');
  if (b) openTx(state.transactions.find(t => t.id === b.dataset.id));
});
$('#filterType').addEventListener('change', renderRecords);
$('#filterCategory').addEventListener('change', renderRecords);
$('#filterText').addEventListener('input', renderRecords);

/* ========== 統計 ========== */
const stats = {
  range: 'month',
  y: now.getFullYear(),
  m: now.getMonth(),
  from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
  to: today(),
  catType: 'expense',
};

$$('[data-nav]').forEach(b => b.addEventListener('click', () => {
  const step = +b.dataset.step;
  if (b.dataset.nav === 'records') {
    const d = new Date(recCursor.y, recCursor.m + step, 1);
    recCursor.y = d.getFullYear(); recCursor.m = d.getMonth();
    renderRecords();
  } else {
    if (stats.range === 'month') {
      const d = new Date(stats.y, stats.m + step, 1);
      stats.y = d.getFullYear(); stats.m = d.getMonth();
    } else if (stats.range === 'year') {
      stats.y += step;
    }
    renderStats();
  }
}));

$('#statsRange').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  stats.range = b.dataset.range;
  $$('#statsRange button').forEach(x => x.classList.toggle('on', x === b));
  renderStats();
});
$('#catType').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  stats.catType = b.dataset.type;
  $$('#catType button').forEach(x => x.classList.toggle('on', x === b));
  renderStats();
});
$('#rangeFrom').addEventListener('change', e => { stats.from = e.target.value; renderStats(); });
$('#rangeTo').addEventListener('change', e => { stats.to = e.target.value; renderStats(); });

function statsBounds() {
  const r = stats.range;
  if (r === 'month') {
    const last = new Date(stats.y, stats.m + 1, 0).getDate();
    return { from: `${monthKey(stats.y, stats.m)}-01`, to: `${monthKey(stats.y, stats.m)}-${pad(last)}`, label: `${stats.y} 年 ${stats.m + 1} 月` };
  }
  if (r === 'year') return { from: `${stats.y}-01-01`, to: `${stats.y}-12-31`, label: `${stats.y} 年` };
  if (r === 'all') {
    const dates = state.transactions.map(t => t.date).sort();
    return { from: dates[0] || today(), to: dates[dates.length - 1] || today(), label: '全部期間' };
  }
  let { from, to } = stats;
  if (from > to) [from, to] = [to, from];
  return { from, to, label: `${from} ~ ${to}` };
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1;
}

function renderStats() {
  const { from, to, label } = statsBounds();
  $('#statsPeriod').textContent = label;
  $('#statsNav').querySelectorAll('button').forEach(b => b.classList.toggle('hidden', stats.range === 'all' || stats.range === 'custom'));
  $('#statsNav').classList.toggle('hidden', stats.range === 'custom');
  $('#customRange').classList.toggle('hidden', stats.range !== 'custom');
  $('#rangeFrom').value = stats.from;
  $('#rangeTo').value = stats.to;

  const list = state.transactions.filter(t => t.date >= from && t.date <= to);
  const s = sumBy(list);
  // 日平均：期間若包含未來日期，只算到今天
  const effTo = to > today() && from <= today() ? today() : to;
  const days = Math.max(1, daysBetween(from, effTo));
  const rate = s.income > 0 ? Math.round((s.balance / s.income) * 100) : null;
  $('#statsSummary').innerHTML = summaryHTML(s, {
    income: `${list.filter(t => t.type === 'income').length} 筆`,
    expense: `日均 ${money(s.expense / days)}`,
    balance: rate === null ? '—' : `儲蓄率 ${rate}%`,
  });

  renderTrend(list, from, to);
  renderCategoryStats(list);
}

function renderTrend(list, from, to) {
  // 決定分組：月份檢視 → 每日；其他 → 若跨度 ≤ 62 天按日，否則按月
  const span = daysBetween(from, to);
  const byDay = stats.range === 'month' || span <= 62;
  const buckets = [];
  if (byDay) {
    const d = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (d <= end) {
      buckets.push({ key: ymd(d), label: String(d.getDate()), income: 0, expense: 0 });
      d.setDate(d.getDate() + 1);
    }
  } else {
    let y = +from.slice(0, 4), m = +from.slice(5, 7) - 1;
    const ey = +to.slice(0, 4), em = +to.slice(5, 7) - 1;
    const multiYear = y !== ey;
    while (y < ey || (y === ey && m <= em)) {
      buckets.push({ key: monthKey(y, m), label: multiYear ? `${String(y).slice(2)}/${m + 1}` : `${m + 1}月`, income: 0, expense: 0 });
      if (++m > 11) { m = 0; y++; }
    }
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const t of list) {
    const i = idx.get(byDay ? t.date : t.date.slice(0, 7));
    if (i !== undefined) buckets[i][t.type] += t.amount;
  }
  $('#trendTitle').textContent = byDay ? '每日收支' : '每月收支';

  const box = $('#trendChart');
  if (!list.length) { box.innerHTML = '<div class="empty">此期間沒有資料</div>'; return; }

  const max = Math.max(1, ...buckets.flatMap(b => [b.income, b.expense]));
  const H = 180, top = 10, bottom = 22, left = 40;
  const slot = Math.max(byDay ? 8 : 18, Math.floor(((box.clientWidth || 600) - left - 12) / buckets.length));
  const W = left + slot * buckets.length + 12;
  const ch = H - top - bottom;
  const bw = Math.max(3, Math.floor(slot * 0.36));
  const y = v => top + ch - (v / max) * ch;
  const labelEvery = Math.ceil(buckets.length / Math.floor((W - left) / 26));

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="收支趨勢圖">`;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    svg += `<line class="grid" x1="${left}" x2="${W}" y1="${yy}" y2="${yy}"/><text x="${left - 4}" y="${yy + 3}" text-anchor="end">${shortMoney(v)}</text>`;
  }
  buckets.forEach((b, i) => {
    const x = left + i * slot + slot / 2;
    const tip = `${b.key}  收入 ${money(b.income)}  支出 ${money(b.expense)}`;
    if (b.income) svg += `<rect class="bar-i" x="${x - bw - 1}" y="${y(b.income)}" width="${bw}" height="${top + ch - y(b.income)}" rx="2"><title>${tip}</title></rect>`;
    if (b.expense) svg += `<rect class="bar-e" x="${x + 1}" y="${y(b.expense)}" width="${bw}" height="${top + ch - y(b.expense)}" rx="2"><title>${tip}</title></rect>`;
    if (i % labelEvery === 0) svg += `<text x="${x}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
  });
  box.innerHTML = svg + '</svg>';
}

function renderCategoryStats(list) {
  const type = stats.catType;
  const items = list.filter(t => t.type === type);
  const total = items.reduce((a, t) => a + t.amount, 0);
  const map = new Map();
  for (const t of items) {
    const e = map.get(t.categoryId) || { amount: 0, count: 0 };
    e.amount += t.amount; e.count++;
    map.set(t.categoryId, e);
  }
  const rows = [...map].map(([id, v]) => ({ cat: catById(id), ...v })).sort((a, b) => b.amount - a.amount);

  // 環形圖
  const R = 70, r = 46, C = 90;
  let svg = `<svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="分類比例圖">`;
  if (!total) {
    svg += `<circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="var(--line)" stroke-width="${R - r}"/>`;
  } else if (rows.length === 1) {
    svg += `<circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${rows[0].cat.color}" stroke-width="${R - r}"/>`;
  } else {
    let a0 = -Math.PI / 2;
    for (const row of rows) {
      const a1 = a0 + (row.amount / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, ang) => `${C + rad * Math.cos(ang)} ${C + rad * Math.sin(ang)}`;
      svg += `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" fill="${row.cat.color}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(row.cat.name)} ${money(row.amount)}</title></path>`;
      a0 = a1;
    }
  }
  svg += `<text class="c1" x="${C}" y="${C - 6}" text-anchor="middle">${type === 'income' ? '總收入' : '總支出'}</text>`;
  svg += `<text class="c2" x="${C}" y="${C + 16}" text-anchor="middle">${shortMoney(total)}</text></svg>`;
  $('#donut').innerHTML = svg;

  $('#catList').innerHTML = rows.length ? rows.map(row => {
    const pct = (row.amount / total) * 100;
    return `<div class="cat-row">
      <span class="tx-icon" style="background:${row.cat.color}22">${esc(row.cat.icon)}</span>
      <div><div class="cat-name"><span>${esc(row.cat.name)}</span><small>${pct.toFixed(1)}%</small></div>
      <div class="bar"><i style="width:${pct}%;background:${row.cat.color}"></i></div></div>
      <div class="cat-amt">${money(row.amount)}<small>${row.count} 筆</small></div>
    </div>`;
  }).join('') : `<div class="empty">此期間沒有${type === 'income' ? '收入' : '支出'}紀錄</div>`;
}

window.addEventListener('resize', () => { if (currentView === 'stats') renderStats(); });

/* ========== 新增 / 編輯 ========== */
const dlg = $('#txDialog');
let editing = null; // 編輯中的交易 id
let txType = 'expense';
let txCat = null;

let catEditing = false;

function renderTxCats() {
  const cats = state.categories.filter(c => c.type === txType);
  if (!cats.some(c => c.id === txCat)) txCat = cats[0]?.id || null;
  const grid = $('#txCats');
  grid.classList.toggle('editing', catEditing);
  grid.innerHTML = cats.map(c =>
    `<button type="button" class="cat-pick ${c.id === txCat && !catEditing ? 'on' : ''}" data-id="${c.id}" ${catEditing ? `aria-label="刪除 ${esc(c.name)}"` : ''}>
      <span class="e">${esc(c.icon)}</span>${esc(c.name)}${catEditing ? '<span class="x" aria-hidden="true">✕</span>' : ''}
    </button>`).join('')
    + `<button type="button" class="cat-pick add" data-add="1"><span class="e">＋</span>新增分類</button>`;
  $('#catEditToggle').textContent = catEditing ? '完成' : '編輯分類';
}

function setCatEditing(on) {
  catEditing = on;
  if (on) $('#catNew').classList.add('hidden');
  renderTxCats();
}

function showCatNew() {
  setCatEditing(false);
  $('#catNew').classList.remove('hidden');
  $('#qcName').focus();
}

function quickAddCategory() {
  const cat = addCategory(txType, $('#qcName').value, $('#qcIcon').value, $('#qcColor').value);
  if (!cat) return;
  txCat = cat.id;
  $('#qcName').value = ''; $('#qcIcon').value = '';
  $('#catNew').classList.add('hidden');
  renderTxCats();
}

function setTxType(type) {
  txType = type;
  $$('#txType button').forEach(b => b.classList.toggle('on', b.dataset.type === type));
  renderTxCats();
}

function openTx(tx) {
  editing = tx ? tx.id : null;
  txCat = tx ? tx.categoryId : null;
  catEditing = false;
  $('#catNew').classList.add('hidden');
  setTxType(tx ? tx.type : 'expense');
  $('#txAmount').value = tx ? tx.amount : '';
  // 新增時：在記帳頁瀏覽其他月份，預設日期落在該月
  let defDate = today();
  if (!tx && currentView === 'records' && !defDate.startsWith(monthKey(recCursor.y, recCursor.m))) {
    defDate = `${monthKey(recCursor.y, recCursor.m)}-01`;
  }
  $('#txDate').value = tx ? tx.date : defDate;
  $('#txNote').value = tx ? tx.note || '' : '';
  $('#txDelete').classList.toggle('hidden', !tx);
  dlg.showModal();
  if (!tx) setTimeout(() => $('#txAmount').focus(), 50);
}

$('#fab').addEventListener('click', () => openTx(null));
$('#txType').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTxType(b.dataset.type); });
$('#catEditToggle').addEventListener('click', () => setCatEditing(!catEditing));
$('#qcAdd').addEventListener('click', quickAddCategory);
$('#qcName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); quickAddCategory(); } });
$('#txCats').addEventListener('click', e => {
  const b = e.target.closest('.cat-pick');
  if (!b) return;
  if (b.dataset.add) { showCatNew(); return; }
  if (catEditing) {
    if (deleteCategory(b.dataset.id)) renderTxCats();
    return;
  }
  txCat = b.dataset.id;
  $$('#txCats .cat-pick').forEach(x => x.classList.toggle('on', x === b));
});
$('#txCancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', render);
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

$('#txForm').addEventListener('submit', e => {
  e.preventDefault();
  if (catEditing) setCatEditing(false);
  const amount = Math.round(parseFloat($('#txAmount').value) * 100) / 100;
  if (!(amount > 0)) { toast('請輸入正確金額'); return; }
  if (!txCat) { toast('請選擇分類'); return; }
  const date = $('#txDate').value || today();
  const data = { type: txType, amount, categoryId: txCat, date, note: $('#txNote').value.trim() };
  if (editing) {
    Object.assign(state.transactions.find(t => t.id === editing), data);
    toast('已更新');
  } else {
    state.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
    toast(`已記錄 ${txType === 'income' ? '收入' : '支出'} ${money(amount)}`);
  }
  save();
  dlg.close();
  // 跳到該筆的月份
  if (currentView === 'records') { recCursor.y = +date.slice(0, 4); recCursor.m = +date.slice(5, 7) - 1; }
  render();
});

$('#txDelete').addEventListener('click', () => {
  if (!editing || !confirm('確定刪除這筆紀錄？')) return;
  state.transactions = state.transactions.filter(t => t.id !== editing);
  save();
  dlg.close();
  toast('已刪除');
  render();
});

/* ========== 設定：分類管理 ========== */
let manageType = 'expense';
$('#manageType').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  manageType = b.dataset.type;
  $$('#manageType button').forEach(x => x.classList.toggle('on', x === b));
  renderSettings();
});

function renderSettings() {
  const cats = state.categories.filter(c => c.type === manageType);
  const counts = {};
  for (const t of state.transactions) counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
  $('#catManage').innerHTML = cats.map((c, i) => `
    <div class="manage-row" data-id="${c.id}">
      <span class="tx-icon" style="background:${c.color}22">${esc(c.icon)}</span>
      <span class="name">${esc(c.name)} <span class="count">${counts[c.id] || 0} 筆</span></span>
      <button data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
      <button data-act="edit" aria-label="重新命名">✏️</button>
      <button data-act="del" aria-label="刪除">🗑️</button>
    </div>`).join('') || '<div class="hint">尚無分類</div>';
}

$('#catManage').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.closest('.manage-row').dataset.id;
  const c = state.categories.find(x => x.id === id);
  if (b.dataset.act === 'edit') {
    const name = prompt('分類名稱', c.name);
    if (name && name.trim()) c.name = name.trim().slice(0, 10);
    const icon = prompt('圖示（emoji）', c.icon);
    if (icon && icon.trim()) c.icon = icon.trim();
  } else if (b.dataset.act === 'del') {
    if (deleteCategory(id)) renderSettings();
    return;
  } else if (b.dataset.act === 'up') {
    const i = state.categories.indexOf(c);
    let j = i - 1;
    while (j >= 0 && state.categories[j].type !== c.type) j--;
    if (j >= 0) [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
  }
  save();
  renderSettings();
});

$('#addCatForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!addCategory(manageType, $('#newCatName').value, $('#newCatIcon').value, $('#newCatColor').value)) return;
  e.target.reset();
  renderSettings();
});

/* ========== 匯出 / 匯入 ========== */
function download(name, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#exportCsv').addEventListener('click', () => {
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['日期', '類型', '分類', '金額', '備註']];
  [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(t =>
    rows.push([t.date, t.type === 'income' ? '收入' : '支出', catById(t.categoryId).name, t.amount, t.note || '']));
  download(`記帳_${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
});

$('#exportJson').addEventListener('click', () => {
  download(`記帳備份_${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
});

/**
 * 合併匯入：分類依「類型＋名稱」對應，沒有的就新增；相同 id 的紀錄會被更新而不重複新增。
 * 回傳 { added, updated, skipped, newCats }
 */
function mergeData(data) {
  const catMap = new Map(); // 檔案中的分類 id → 本機分類 id
  let newCats = 0;
  for (const c of data.categories || []) {
    if (!c || !c.name || !['income', 'expense'].includes(c.type)) continue;
    let local = state.categories.find(x => x.type === c.type && x.name === c.name);
    if (!local) {
      local = { id: 'c' + uid(), type: c.type, name: String(c.name).slice(0, 10), icon: c.icon || '🏷️', color: c.color || '#94a3b8' };
      state.categories.push(local);
      newCats++;
    }
    catMap.set(c.id, local.id);
  }
  const ids = new Set(state.transactions.map(t => t.id));
  let added = 0, updated = 0, skipped = 0;
  for (const t of data.transactions || []) {
    const amount = Number(t && t.amount);
    if (!t || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !['income', 'expense'].includes(t.type)) { skipped++; continue; }
    const id = t.id || uid();
    let categoryId = catMap.get(t.categoryId);
    if (!categoryId) {
      const fb = state.categories.find(x => x.type === t.type && x.name === '其他') || state.categories.find(x => x.type === t.type);
      categoryId = fb && fb.id;
    }
    const rec = { type: t.type, amount, categoryId, date: t.date, note: String(t.note || '').slice(0, 60) };
    if (ids.has(id)) {
      // 同一筆紀錄（相同 id）：用檔案內容更新，方便修正後重新匯入
      Object.assign(state.transactions.find(x => x.id === id), rec);
      updated++;
      continue;
    }
    state.transactions.push({ id, ...rec, createdAt: t.createdAt || Date.now() });
    ids.add(id);
    added++;
  }
  return { added, updated, skipped, newCats };
}

$('#mergeJson').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.transactions)) throw new Error('格式不符');
    const s = sumBy(data.transactions.map(t => ({ ...t, amount: Number(t.amount) || 0 })));
    if (!confirm(`檔案含 ${data.transactions.length} 筆紀錄（收入 ${money(s.income)}、支出 ${money(s.expense)}），要合併到目前資料嗎？`)) return;
    const r = mergeData(data);
    save();
    alert(`匯入完成：新增 ${r.added} 筆${r.updated ? `，更新 ${r.updated} 筆` : ''}${r.skipped ? `，略過 ${r.skipped} 筆（格式錯誤）` : ''}${r.newCats ? `，新增 ${r.newCats} 個分類` : ''}。`);
    render();
  } catch (err) {
    toast('匯入失敗：' + err.message);
  }
});

$('#importJson').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.transactions) || !Array.isArray(data.categories)) throw new Error('格式不符');
    if (!confirm(`備份含 ${data.transactions.length} 筆紀錄，還原會覆蓋目前資料，確定？`)) return;
    state = { transactions: data.transactions, categories: data.categories };
    save();
    toast('還原完成');
    render();
  } catch (err) {
    toast('還原失敗：' + err.message);
  }
});

$('#clearAll').addEventListener('click', () => {
  if (!confirm('確定清除所有紀錄與自訂分類？此動作無法復原。')) return;
  state = { transactions: [], categories: DEFAULT_CATEGORIES.map(c => ({ ...c })) };
  save();
  toast('已清除');
  render();
});

/* ========== 啟動 ========== */
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
