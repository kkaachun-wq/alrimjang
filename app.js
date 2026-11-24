/* 나만의 알림장
 * 모든 데이터는 이 기기의 localStorage 에만 저장됩니다. 서버 전송 없음.
 * 개인정보를 코드·저장소에 남기지 않습니다.
 */
'use strict';

/* ── 항목 정의 ─────────────────────────────────── */
const CATS = [
  { id: 'todo',       name: '할일',       full: '할일',        emoji: '✅' },
  { id: 'travel',     name: '여행',       full: '여행정보',     emoji: '✈️' },
  { id: 'restaurant', name: '레스토랑',   full: '레스토랑정보', emoji: '🍽️' },
  { id: 'finance',    name: '경제·재무',  full: '경제재무정보', emoji: '💰' },
  { id: 'golf',       name: '골프',       full: '골프정보',     emoji: '⛳' },
  { id: 'shopping',   name: '쇼핑',       full: '쇼핑정보',     emoji: '🛍️' },
  { id: 'life',       name: '생활',       full: '기타 생활정보', emoji: '🏠' }
];
const CAT_BY_ID = Object.fromEntries(CATS.map(c => [c.id, c]));
const STORE_KEY = 'alrimjang.v1';
const DAY = 86400000;

const DEFAULT_SETTINGS = { remindMin: 0 };

/* ── 상태 ─────────────────────────────────────── */
let state = { items: [], settings: Object.assign({}, DEFAULT_SETTINGS) };
let ui = { cat: 'all', q: '', formCat: 'todo', editingId: null, scrollChips: false };

const $ = id => document.getElementById(id);
const listEl = $('list');
const emptyEl = $('empty');
const chipsEl = $('chips');

/* ── 저장소 ───────────────────────────────────── */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cat = CAT_BY_ID[raw.cat] ? raw.cat : 'life';
  const title = String(raw.title == null ? '' : raw.title).slice(0, 80).trim();
  if (!title) return null;
  const dueAt = Number.isFinite(raw.dueAt) && raw.dueAt > 0 ? raw.dueAt : null;
  return {
    id: String(raw.id || uid()),
    cat,
    title,
    body: String(raw.body == null ? '' : raw.body).slice(0, 4000),
    url: String(raw.url == null ? '' : raw.url).slice(0, 1000),
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => String(t).slice(0, 24)).filter(Boolean).slice(0, 12) : [],
    pinned: !!raw.pinned,
    done: !!raw.done,
    dueAt,
    dueTime: dueAt && raw.dueTime ? String(raw.dueTime).slice(0, 5) : null,
    notifiedAt: Number.isFinite(raw.notifiedAt) ? raw.notifiedAt : 0,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now()
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.items)) {
      state.items = data.items.map(normalizeItem).filter(Boolean);
    }
    if (data && data.settings && typeof data.settings === 'object') {
      const rm = Number(data.settings.remindMin);
      state.settings.remindMin = [0, 30, 60, 180].includes(rm) ? rm : 0;
    }
  } catch (err) {
    console.warn('저장된 기록을 읽지 못했습니다.', err);
  }
}

let saveTimer = null;
function save(immediate) {
  clearTimeout(saveTimer);
  const write = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, items: state.items, settings: state.settings }));
    } catch (err) {
      console.warn('저장하지 못했습니다.', err);
      toast('저장 공간이 가득 찼습니다. 백업 후 정리해 주세요.');
    }
  };
  if (immediate) write(); else saveTimer = setTimeout(write, 120);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── 유틸 ─────────────────────────────────────── */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return node;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function ymdLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function safeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw;
  try {
    const u = new URL(withProto);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch (e) { /* 무시 */ }
  return '';
}

function shortHost(href) {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    const path = decodeURIComponent(u.pathname + u.search);
    const short = path === '/' ? '' : path;
    return host + (short.length > 34 ? short.slice(0, 34) + '…' : short);
  } catch (e) { return href.slice(0, 40); }
}

/* ── 날짜 표시 ────────────────────────────────── */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dueParts(item) {
  if (!item.dueAt) return null;
  const d = new Date(item.dueAt);
  if (isNaN(d.getTime())) return null;
  const today0 = startOfDay(new Date());
  const day0 = startOfDay(d);
  const diff = Math.round((day0 - today0) / DAY);
  const time = item.dueTime ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '';
  let datePart;
  if (diff === 0) datePart = '오늘';
  else if (diff === 1) datePart = '내일';
  else if (diff === -1) datePart = '어제';
  else if (diff < 0) datePart = `${d.getMonth() + 1}/${d.getDate()}`;
  else if (diff <= 7) datePart = `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
  else datePart = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const text = time ? `${datePart} ${time}` : datePart;
  let cls = '';
  if (item.done) cls = 'done-badge';
  else if (diff < 0 || (diff === 0 && time && d.getTime() < Date.now())) cls = 'overdue';
  else if (diff === 0) cls = 'today';
  else if (diff <= 3) cls = 'soon';
  return { text, cls, diff };
}

function dueLabelLong(item) {
  const p = dueParts(item);
  if (!p) return '';
  return p.cls === 'overdue' ? `마감 지남 · ${p.text}` : p.text;
}

/* ── 정렬 / 필터 ──────────────────────────────── */
function sortItems(items) {
  return items.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.cat === 'todo' && b.cat === 'todo' && a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.dueAt || Infinity;
    const bd = b.dueAt || Infinity;
    if (a.cat === 'todo' && b.cat === 'todo' && ad !== bd) return ad - bd;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function matches(item, q) {
  if (!q) return true;
  const cat = CAT_BY_ID[item.cat];
  const hay = [
    item.title, item.body, item.url, item.tags.join(' '), cat ? cat.name : '', cat ? cat.full : ''
  ].join(' ').toLowerCase().replace(/\s+/g, ' ');
  return q.split(/\s+/).every(word => hay.includes(word));
}

function visibleItems() {
  const q = ui.q.trim().toLowerCase();
  const filtered = state.items.filter(it =>
    (ui.cat === 'all' || it.cat === ui.cat) && matches(it, q)
  );
  return sortItems(filtered);
}

/* ── 렌더 ─────────────────────────────────────── */
function renderChips() {
  const frag = document.createDocumentFragment();
  const total = state.items.length;
  const makeChip = (id, label, emoji, count) => {
    const btn = el('button', {
      type: 'button', class: 'chip', role: 'tab',
      'aria-selected': ui.cat === id ? 'true' : 'false',
      'data-cat': id
    }, [
      el('span', { class: 'chip-emoji', 'aria-hidden': 'true', text: emoji }),
      el('span', { text: label }),
      count > 0 ? el('span', { class: 'chip-count', text: String(count) }) : null
    ]);
    if (ui.cat === id) btn.setAttribute('aria-selected', 'true');
    return btn;
  };

  frag.appendChild(makeChip('all', '전체', '📋', total));
  CATS.forEach(c => {
    let count = state.items.filter(it => it.cat === c.id).length;
    if (c.id === 'todo') count = state.items.filter(it => it.cat === 'todo' && !it.done).length;
    frag.appendChild(makeChip(c.id, c.name, c.emoji, count));
  });

  chipsEl.replaceChildren(frag);
  if (ui.scrollChips) {
    ui.scrollChips = false;
    const active = chipsEl.querySelector('[aria-selected="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

function buildCard(item) {
  const cat = CAT_BY_ID[item.cat];
  const card = el('article', {
    class: 'card' + (item.pinned ? ' pinned' : '') + (item.done ? ' done' : ''),
    'data-id': item.id
  });

  const top = el('div', { class: 'card-top' });

  if (item.cat === 'todo') {
    top.appendChild(el('button', {
      type: 'button', class: 'check', role: 'checkbox',
      'aria-checked': item.done ? 'true' : 'false',
      'aria-label': (item.done ? '완료 취소: ' : '완료 표시: ') + item.title,
      'data-act': 'toggle', text: '✓'
    }));
  }

  top.appendChild(el('h3', { class: 'card-title', text: item.title }));

  top.appendChild(el('button', {
    type: 'button', class: 'pin-btn',
    'aria-pressed': item.pinned ? 'true' : 'false',
    'aria-label': item.pinned ? '고정 해제' : '맨 위에 고정',
    'data-act': 'pin', text: '📌'
  }));

  card.appendChild(top);

  if (item.body) card.appendChild(el('p', { class: 'card-body', text: item.body }));

  const href = safeUrl(item.url);
  if (href) {
    card.appendChild(el('a', {
      class: 'card-link', href, target: '_blank', rel: 'noopener noreferrer'
    }, [el('span', { 'aria-hidden': 'true', text: '🔗' }), el('span', { class: 'link-host', text: shortHost(href) })]));
  }

  if (item.tags.length) {
    card.appendChild(el('div', { class: 'tags' },
      item.tags.map(t => el('span', { class: 'tag', text: '#' + t }))));
  }

  const foot = el('div', { class: 'card-foot' });
  const parts = dueParts(item);
  if (parts) {
    foot.appendChild(el('span', { class: 'due-badge ' + parts.cls }, [
      el('span', { class: 'due-ico', 'aria-hidden': 'true', text: item.done ? '✓' : '⏰' }),
      el('span', { text: item.done ? '마감 ' + parts.text : dueLabelLong(item) })
    ]));
  }
  foot.appendChild(el('span', { class: 'cat-label' }, [
    el('span', { 'aria-hidden': 'true', text: cat.emoji }),
    el('span', { text: cat.name })
  ]));

  foot.appendChild(el('div', { class: 'card-actions' }, [
    el('button', { type: 'button', 'data-act': 'edit', text: '수정', 'aria-label': item.title + ' 수정' }),
    el('button', { type: 'button', class: 'del', 'data-act': 'delete', text: '삭제', 'aria-label': item.title + ' 삭제' })
  ]));

  card.appendChild(foot);
  return card;
}

function render() {
  renderChips();
  const items = visibleItems();
  listEl.replaceChildren();
  items.forEach(it => listEl.appendChild(buildCard(it)));

  const isEmpty = items.length === 0;
  emptyEl.hidden = !isEmpty;
  if (isEmpty) {
    const q = ui.q.trim();
    if (q) {
      $('emptyTitle').textContent = '검색 결과가 없습니다';
      $('emptyDesc').textContent = `‘${q}’와 맞는 항목을 찾지 못했습니다. 다른 낱말로 찾아보세요.`;
    } else if (ui.cat !== 'all') {
      const c = CAT_BY_ID[ui.cat];
      $('emptyTitle').textContent = `${c.name} 항목이 비어 있습니다`;
      $('emptyDesc').textContent = `${c.emoji} ${c.full}을(를) ＋ 버튼으로 추가해 보세요.`;
    } else {
      $('emptyTitle').textContent = '아직 적어 둔 것이 없습니다';
      $('emptyDesc').textContent = '아래 ＋ 버튼을 눌러 첫 번째 항목을 추가해 보세요.';
    }
  }
  updateTodayLabel();
  $('statCount').textContent = String(state.items.length);
}

function updateTodayLabel() {
  const now = new Date();
  const left = state.items.filter(it => it.cat === 'todo' && !it.done).length;
  const base = `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일`;
  $('todayLabel').textContent = left > 0 ? `${base} · 남은 할일 ${left}개` : base;
}

/* ── 토스트 ───────────────────────────────────── */
let toastTimer = null;
function toast(message, actionLabel, action, ms) {
  const t = $('toast');
  t.replaceChildren(el('span', { text: message }));
  if (actionLabel && action) {
    t.appendChild(el('button', { type: 'button', text: actionLabel, onclick: () => { hideToast(); action(); } }));
  }
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, ms || (actionLabel ? 6000 : 2400));
}
function hideToast() {
  const t = $('toast');
  t.classList.remove('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 220);
}

/* ── 확인 창 ──────────────────────────────────── */
let confirmResolve = null;
function askConfirm(message, okLabel) {
  return new Promise(resolve => {
    $('confirmText').textContent = message;
    $('confirmYes').textContent = okLabel || '삭제';
    $('confirm').hidden = false;
    confirmResolve = resolve;
  });
}
function closeConfirm(value) {
  $('confirm').hidden = true;
  const r = confirmResolve;
  confirmResolve = null;
  if (r) r(value);
}

/* ── 시트 열기/닫기 ───────────────────────────── */
let openSheetEl = null;

function showBackdrop() {
  const b = $('backdrop');
  b.hidden = false;
  requestAnimationFrame(() => b.classList.add('show'));
  document.body.classList.add('no-scroll');
}
function hideBackdrop() {
  const b = $('backdrop');
  b.classList.remove('show');
  setTimeout(() => { if (!openSheetEl) b.hidden = true; }, 240);
  document.body.classList.remove('no-scroll');
}

function openSheet(sheet) {
  openSheetEl = sheet;
  sheet.hidden = false;
  showBackdrop();
  requestAnimationFrame(() => sheet.classList.add('open'));
  sheet.querySelector('.sheet-body')?.scrollTo(0, 0);
}

function closeSheet(sheet) {
  if (!sheet) return;
  sheet.classList.remove('open');
  openSheetEl = null;
  hideBackdrop();
  setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 300);
}

/* ── 항목 폼 ──────────────────────────────────── */
function renderCatPicker() {
  const picker = $('catPicker');
  picker.replaceChildren();
  CATS.forEach(c => {
    picker.appendChild(el('button', {
      type: 'button', class: 'cat-opt', role: 'radio',
      'aria-checked': ui.formCat === c.id ? 'true' : 'false',
      'data-cat': c.id,
      onclick: () => setFormCat(c.id)
    }, [el('span', { 'aria-hidden': 'true', text: c.emoji }), el('span', { text: c.name })]));
  });
}

function setFormCat(id) {
  ui.formCat = id;
  renderCatPicker();
  $('dueField').hidden = id !== 'todo';
  updateCalActions();
}

function openItemEditor(id) {
  const item = id ? state.items.find(it => it.id === id) : null;
  ui.editingId = item ? item.id : null;
  ui.formCat = item ? item.cat : (ui.cat === 'all' ? 'todo' : ui.cat);

  $('sheetTitle').textContent = item ? '항목 수정' : '새로 추가';
  $('f_id').value = item ? item.id : '';
  $('f_title').value = item ? item.title : '';
  $('f_body').value = item ? item.body : '';
  $('f_url').value = item ? item.url : '';
  $('f_tags').value = item ? item.tags.join(', ') : '';
  $('f_pinned').checked = item ? item.pinned : false;

  if (item && item.dueAt) {
    const d = new Date(item.dueAt);
    $('f_dueDate').value = ymdLocal(d);
    $('f_dueTime').value = item.dueTime || '';
  } else {
    $('f_dueDate').value = '';
    $('f_dueTime').value = '';
  }

  renderCatPicker();
  $('dueField').hidden = ui.formCat !== 'todo';
  $('btnDelete').hidden = !item;
  updateCalActions();
  updateNotifyHint();
  openSheet($('editSheet'));

  if (!item) setTimeout(() => $('f_title').focus(), 320);
}

function formDueAt() {
  const dateVal = $('f_dueDate').value;
  if (!dateVal) return null;
  const [y, m, d] = dateVal.split('-').map(Number);
  const timeVal = $('f_dueTime').value;
  let hh = 0, mm = 0;
  if (timeVal && /^\d{1,2}:\d{2}/.test(timeVal)) {
    hh = Number(timeVal.split(':')[0]);
    mm = Number(timeVal.split(':')[1]);
  }
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}

function formValues() {
  return {
    cat: ui.formCat,
    title: $('f_title').value.trim(),
    body: $('f_body').value.trim(),
    url: $('f_url').value.trim(),
    tags: $('f_tags').value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 12),
    pinned: $('f_pinned').checked,
    dueAt: ui.formCat === 'todo' ? formDueAt() : null,
    dueTime: ui.formCat === 'todo' && $('f_dueDate').value && $('f_dueTime').value ? $('f_dueTime').value : null
  };
}

function updateCalActions() {
  const wrap = $('calActions');
  const v = formValues();
  if (ui.formCat === 'todo' && v.dueAt) {
    wrap.hidden = false;
    const start = v.dueAt;
    const end = start + (v.dueTime ? 3600000 : DAY);
    const title = v.title || '할일';
    const details = [v.body, v.url ? safeUrl(v.url) : ''].filter(Boolean).join('\n');
    const g = new URL('https://calendar.google.com/calendar/render');
    g.searchParams.set('action', 'TEMPLATE');
    g.searchParams.set('text', title);
    g.searchParams.set('dates', `${icsStamp(start)}/${icsStamp(end)}`);
    if (details) g.searchParams.set('details', details);
    $('linkGcal').href = g.toString();
  } else {
    wrap.hidden = true;
  }
}

function updateNotifyHint() {
  const hint = $('notifyHint');
  if (!('Notification' in window)) {
    hint.textContent = '이 브라우저는 알림을 지원하지 않습니다. 캘린더 알림 파일을 이용해 주세요.';
    return;
  }
  if (Notification.permission === 'granted') {
    hint.textContent = `알림이 켜져 있습니다. 앱을 열어 둔 동안 ${state.settings.remindMin ? state.settings.remindMin + '분 전에' : '마감 시간에'} 알려 드립니다.`;
  } else if (Notification.permission === 'denied') {
    hint.textContent = '브라우저 알림이 차단되어 있습니다. 설정 ☰ 에서 안내를 확인하거나 캘린더 알림 파일을 이용해 주세요.';
  } else {
    hint.textContent = '캘린더 알림 파일을 등록하면 앱을 닫아도 알림을 받을 수 있습니다.';
  }
}

function submitForm(event) {
  event.preventDefault();
  const v = formValues();
  if (!v.title) {
    $('f_title').focus();
    toast('제목을 적어 주세요');
    return;
  }
  const now = Date.now();

  if (ui.editingId) {
    const item = state.items.find(it => it.id === ui.editingId);
    if (!item) { closeSheet($('editSheet')); return; }
    const dueChanged = item.dueAt !== v.dueAt;
    Object.assign(item, v, { updatedAt: now, done: item.done });
    if (dueChanged) item.notifiedAt = 0;
    if (item.cat !== 'todo') { item.done = false; }
  } else {
    state.items.push(Object.assign({}, v, {
      id: uid(),
      done: false,
      notifiedAt: 0,
      createdAt: now,
      updatedAt: now
    }));
  }

  save(true);
  closeSheet($('editSheet'));
  render();
  checkReminders();
  toast('저장했습니다');
}

function deleteItem(id, withUndo) {
  const idx = state.items.findIndex(it => it.id === id);
  if (idx < 0) return;
  const removed = state.items[idx];
  state.items.splice(idx, 1);
  save(true);
  render();
  if (withUndo !== false) {
    toast('삭제했습니다', '되돌리기', () => {
      state.items.splice(Math.min(idx, state.items.length), 0, removed);
      save(true);
      render();
      toast('되돌렸습니다');
    });
  }
}

/* ── 캘린더(.ics) ─────────────────────────────── */
function icsStamp(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;
}
function icsDateOnly(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}
function icsText(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildIcs(v) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//alrimjang//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${uid()}@alrimjang`);
  lines.push(`DTSTAMP:${icsStamp(Date.now())}`);
  if (v.dueTime) {
    const end = v.dueAt + 3600000;
    lines.push(`DTSTART:${icsStamp(v.dueAt)}`);
    lines.push(`DTEND:${icsStamp(end)}`);
  } else {
    const start = new Date(v.dueAt);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
    lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(v.dueAt)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDateOnly(end)}`);
  }
  lines.push(`SUMMARY:${icsText(v.title || '할일')}`);
  const desc = [v.body, v.url ? safeUrl(v.url) : ''].filter(Boolean).join('\n');
  if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
  lines.push('TRANSP:OPAQUE');
  lines.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(v.title || '할일')}`, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function download(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

function exportIcs() {
  const v = formValues();
  if (!v.dueAt) { toast('먼저 마감 날짜를 정해 주세요'); return; }
  const d = new Date(v.dueAt);
  const fname = `alrimjang-${icsDateOnly(v.dueAt)}.ics`;
  download(buildIcs(v), fname, 'text/calendar;charset=utf-8');
  toast('캘린더 알림 파일을 저장했습니다');
}

/* ── 백업 ─────────────────────────────────────── */
function exportJson() {
  const now = new Date();
  const payload = {
    app: '나만의 알림장',
    version: 1,
    exportedAt: now.toISOString(),
    settings: { remindMin: state.settings.remindMin },
    items: state.items
  };
  download(JSON.stringify(payload, null, 2), `alrimjang-backup-${ymdLocal(now)}.json`, 'application/json');
  toast('백업 파일을 저장했습니다');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const incoming = (Array.isArray(data) ? data : data.items || []).map(normalizeItem).filter(Boolean);
      if (!incoming.length) { toast('불러올 항목이 없습니다'); return; }
      const ids = new Set(state.items.map(it => it.id));
      let added = 0;
      incoming.forEach(it => {
        if (ids.has(it.id)) return;
        state.items.push(it);
        ids.add(it.id);
        added++;
      });
      save(true);
      render();
      toast(added ? `${added}개 항목을 불러왔습니다` : '이미 있는 항목입니다');
    } catch (err) {
      console.warn(err);
      toast('파일을 읽지 못했습니다. 백업 파일인지 확인해 주세요.');
    }
  };
  reader.onerror = () => toast('파일을 열지 못했습니다');
  reader.readAsText(file);
}

/* ── 알림 ─────────────────────────────────────── */
function askNotifyPermission() {
  if (!('Notification' in window)) {
    toast('이 브라우저는 알림을 지원하지 않습니다');
    return;
  }
  if (Notification.permission === 'granted') {
    toast('알림이 이미 켜져 있습니다');
    updateNotifyButton();
    return;
  }
  if (Notification.permission === 'denied') {
    toast('크롬 설정에서 이 사이트 알림을 허용해 주세요');
    updateNotifyButton();
    return;
  }
  Notification.requestPermission().then(p => {
    updateNotifyButton();
    updateNotifyHint();
    toast(p === 'granted' ? '알림을 켰습니다' : '알림이 허용되지 않았습니다');
    if (p === 'granted') checkReminders();
  }).catch(() => toast('알림을 켜지 못했습니다'));
}

function updateNotifyButton() {
  const btn = $('btnNotify');
  if (!('Notification' in window)) {
    btn.textContent = '🔕 이 브라우저는 알림 미지원';
    btn.disabled = true;
    return;
  }
  if (Notification.permission === 'granted') btn.textContent = '🔔 브라우저 알림 켜짐';
  else if (Notification.permission === 'denied') btn.textContent = '🔕 알림 차단됨 · 브라우저 설정에서 허용';
  else btn.textContent = '🔔 브라우저 알림 켜기';
}

function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const lead = (state.settings.remindMin || 0) * 60000;
  let changed = false;
  state.items.forEach(it => {
    if (it.cat !== 'todo' || it.done || !it.dueAt) return;
    if (it.dueAt - lead > now) return;             // 아직 이릅니다
    if (now - it.dueAt > 12 * 3600000) return;     // 12시간 지난 것은 건너뜁니다
    if (it.notifiedAt && it.notifiedAt >= it.dueAt) return;
    it.notifiedAt = now;
    changed = true;
    try {
      const n = new Notification(lead ? '알림장 · 곧 마감' : '알림장 · 마감 시간', {
        body: it.title,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: it.id
      });
      n.onclick = () => { window.focus(); openItemEditor(it.id); };
    } catch (err) { console.warn(err); }
  });
  if (changed) save();
}

/* ── 이벤트 연결 ──────────────────────────────── */
function bind() {
  // 검색
  const search = $('searchInput');
  search.addEventListener('input', () => {
    ui.q = search.value;
    $('btnClearSearch').hidden = !search.value;
    render();
  });
  $('btnClearSearch').addEventListener('click', () => {
    search.value = '';
    ui.q = '';
    $('btnClearSearch').hidden = true;
    render();
    search.focus();
  });

  // 카테고리 칩
  chipsEl.addEventListener('click', e => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    ui.cat = chip.getAttribute('data-cat');
    ui.scrollChips = true;
    render();
  });

  // 목록 (이벤트 위임)
  listEl.addEventListener('click', async e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const actionBtn = e.target.closest('[data-act]');
    if (e.target.closest('a')) return;

    if (!actionBtn) { openItemEditor(id); return; }

    const act = actionBtn.getAttribute('data-act');
    const item = state.items.find(it => it.id === id);
    if (!item) return;

    if (act === 'toggle') {
      item.done = !item.done;
      item.updatedAt = Date.now();
      if (item.done) item.notifiedAt = item.dueAt || 0;
      save(true);
      render();
      if (item.done) toast('완료했습니다');
      return;
    }
    if (act === 'pin') {
      item.pinned = !item.pinned;
      item.updatedAt = Date.now();
      save(true);
      render();
      toast(item.pinned ? '맨 위에 고정했습니다' : '고정을 풀었습니다');
      return;
    }
    if (act === 'edit') { openItemEditor(id); return; }
    if (act === 'delete') {
      const ok = await askConfirm(`‘${item.title}’ 항목을 삭제할까요?\n삭제 후 잠시 동안 되돌릴 수 있습니다.`, '삭제');
      if (ok) deleteItem(id);
    }
  });

  // 추가 버튼
  $('fab').addEventListener('click', () => openItemEditor(null));

  // 폼
  $('itemForm').addEventListener('submit', submitForm);
  $('btnCloseSheet').addEventListener('click', () => closeSheet($('editSheet')));
  $('btnDelete').addEventListener('click', async () => {
    const id = ui.editingId;
    if (!id) return;
    const item = state.items.find(it => it.id === id);
    const ok = await askConfirm(`‘${item ? item.title : '이'} ’ 항목을 삭제할까요?`, '삭제');
    if (ok) { closeSheet($('editSheet')); deleteItem(id); }
  });

  ['f_title', 'f_body', 'f_url', 'f_dueDate', 'f_dueTime'].forEach(id => {
    $(id).addEventListener('input', updateCalActions);
    $(id).addEventListener('change', updateCalActions);
  });

  // 마감 빠른 선택
  $('dueQuick').addEventListener('click', e => {
    const btn = e.target.closest('[data-quick]');
    if (!btn) return;
    const q = btn.getAttribute('data-quick');
    if (q === 'clear') {
      $('f_dueDate').value = '';
      $('f_dueTime').value = '';
    } else {
      const d = new Date();
      if (q === 'tomorrow') d.setDate(d.getDate() + 1);
      if (q === 'week') d.setDate(d.getDate() + 7);
      $('f_dueDate').value = ymdLocal(d);
      if (!$('f_dueTime').value) $('f_dueTime').value = '09:00';
    }
    updateCalActions();
  });

  $('btnIcs').addEventListener('click', exportIcs);
  $('linkGcal').addEventListener('click', e => {
    if (!formValues().dueAt) { e.preventDefault(); toast('먼저 마감 날짜를 정해 주세요'); }
  });

  // 설정 시트
  $('btnMenu').addEventListener('click', () => {
    updateNotifyButton();
    updateNotifyHint();
    $('remindMin').value = String(state.settings.remindMin || 0);
    $('statCount').textContent = String(state.items.length);
    openSheet($('menuSheet'));
  });
  $('btnCloseMenu').addEventListener('click', () => closeSheet($('menuSheet')));
  $('btnNotify').addEventListener('click', askNotifyPermission);
  $('remindMin').addEventListener('change', e => {
    state.settings.remindMin = Number(e.target.value) || 0;
    save(true);
    updateNotifyHint();
  });
  $('btnExport').addEventListener('click', exportJson);
  $('importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importJson(f);
    e.target.value = '';
  });

  // 확인 창
  $('confirmYes').addEventListener('click', () => closeConfirm(true));
  $('confirmNo').addEventListener('click', () => closeConfirm(false));
  $('confirm').addEventListener('click', e => { if (e.target === $('confirm')) closeConfirm(false); });

  // 배경 / ESC
  $('backdrop').addEventListener('click', () => {
    if (openSheetEl === $('editSheet')) closeSheet($('editSheet'));
    else if (openSheetEl === $('menuSheet')) closeSheet($('menuSheet'));
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('confirm').hidden) { closeConfirm(false); return; }
    if (openSheetEl) closeSheet(openSheetEl);
  });

  // 화면이 다시 보일 때 목록·알림 갱신
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { render(); checkReminders(); }
  });
}

/* ── 앱 설치 안내 ─────────────────────────────── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $('btnInstall');
  if (btn) btn.hidden = false;
});
function setupInstall() {
  const btn = $('btnInstall');
  if (!btn) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      toast('크롬 ⋮ 메뉴에서 "홈 화면에 추가"를 골라 주세요', null, null, 4000);
      return;
    }
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') toast('홈 화면에 추가했습니다');
    } catch (e) { /* 무시 */ }
    deferredPrompt = null;
    btn.hidden = true;
  });
}

/* ── 시작 ─────────────────────────────────────── */
function init() {
  load();
  bind();
  render();
  setupInstall();
  updateNotifyButton();
  setInterval(() => { updateTodayLabel(); }, 60000);
  setInterval(checkReminders, 30000);
  setTimeout(checkReminders, 1500);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('서비스 워커 등록 실패', err));
    });
  }
}

init();
