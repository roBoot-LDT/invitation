import { CONTENT } from './content.js';
import { initRsvp } from './rsvp.js';
import { initGate } from './gate.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const NO_SMOOTH = new URLSearchParams(location.search).has('nosmooth'); // debug: camera follows scroll instantly
// Models start downloading immediately (in parallel with the 3D engine), while the guest looks at the envelope.
for (const m of [CONTENT.columnModel, CONTENT.colosseumModel]) {
  if (!m?.src) continue;
  const link = document.createElement('link');
  Object.assign(link, { rel: 'preload', as: 'fetch', href: m.src, crossOrigin: 'anonymous' });
  document.head.append(link);
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ---------- guest ----------
async function loadGuest() {
  const slug = new URLSearchParams(location.search).get('g');
  if (!slug) return { guest: null, answers: [] };
  try {
    const res = await fetch(`/api/guest/${encodeURIComponent(slug)}`);
    if (!res.ok) return { guest: null, answers: [] };
    return await res.json();
  } catch {
    return { guest: null, answers: [] };
  }
}

// ---------- intro ----------
function renderIntro(guest) {
  const { couple, intro, photos, dateLabel } = CONTENT;
  $('bride').textContent = couple.bride;
  $('groom').textContent = couple.groom;
  $('date').textContent = dateLabel;
  $('greeting').textContent = guest?.greeting || intro.defaultGreeting;
  $('greeting-text').textContent = intro.text.replace('{you}', guest?.plural ? 'вас' : 'тебя');
  $('hint').textContent = intro.hint;
  $('footer-names').textContent = `${couple.bride} & ${couple.groom} · ${dateLabel}`;
  $('music-credit').textContent = [CONTENT.musicCredit, CONTENT.columnModel?.credit, CONTENT.colosseumModel?.credit, CONTENT.statueModel?.credit].filter(Boolean).join(' · ');

  const use = (id, cls) => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  photos.slice(0, 2).forEach((ph, i) => {
    // Museum frame: gilded moulding → bead ring → bevelled lip → cream mat → photo, plus carved ornaments
    const frame = el('div', 'frame', `
      <div class="frame-beads"></div>
      <div class="frame-lip"><div class="frame-mat"></div></div>
      ${use('orn-corner', 'orn tl')}${use('orn-corner', 'orn tr')}${use('orn-corner', 'orn bl')}${use('orn-corner', 'orn br')}
      ${use('orn-crest', 'crest top')}${use('orn-crest', 'crest bottom')}`);
    const img = new Image();
    img.src = ph.src; img.alt = ph.alt || ''; img.loading = 'eager';
    frame.querySelector('.frame-mat').append(img);
    $(`photo-${i}`).append(frame, el('div', 'mist'));
  });
}

// ---------- countdown ----------
const countdownNodes = [];
let countdownListener = null; // the 3D scene subscribes to get the cloud digits updated
function tickCountdown() {
  let diff = Math.max(0, new Date(CONTENT.countdownTarget).getTime() - Date.now());
  const d = Math.floor(diff / 864e5); diff -= d * 864e5;
  const h = Math.floor(diff / 36e5); diff -= h * 36e5;
  const m = Math.floor(diff / 6e4); diff -= m * 6e4;
  const s = Math.floor(diff / 1e3);
  const parts = [
    [d, plural(d, 'день', 'дня', 'дней')],
    [String(h).padStart(2, '0'), plural(h, 'час', 'часа', 'часов')],
    [String(m).padStart(2, '0'), plural(m, 'минута', 'минуты', 'минут')],
    [String(s).padStart(2, '0'), plural(s, 'секунда', 'секунды', 'секунд')],
  ];
  countdownListener?.({
    days: { value: d, label: parts[0][1] },
    hours: { value: parts[1][0], label: parts[1][1] },
    minutes: { value: parts[2][0], label: parts[2][1] },
    seconds: { value: parts[3][0], label: parts[3][1] },
  });
  for (const node of countdownNodes) {
    node.querySelectorAll('div').forEach((cell, i) => {
      cell.querySelector('b').textContent = parts[i][0];
      cell.querySelector('span').textContent = parts[i][1];
    });
  }
}

// ---------- tag content ----------
const LEAF_RULE = `<svg class="leaf-rule" viewBox="0 0 120 14" aria-hidden="true"><path d="M2 7 C 30 0, 50 14, 80 6 S 110 6, 118 7" fill="none" stroke="#6b4f2a" stroke-width="1.4"/><path d="M38 6 q 6 -8 12 -2 q -6 6 -12 2z M78 6 q 6 -8 12 -2 q -6 6 -12 2z" fill="#7fa23a"/><g fill="#5a2e5e"><circle cx="60" cy="9" r="2.4"/><circle cx="64" cy="10" r="2.4"/><circle cx="62" cy="13" r="2"/></g></svg>`;

function buildCard(stop) {
  const card = el('div', 'tag-card');
  switch (stop.type) {
    case 'countdown': {
      card.innerHTML = `<h3>${esc(stop.title)}</h3>${LEAF_RULE}`;
      const cd = el('div', 'countdown', '<div><b></b><span></span></div>'.repeat(4));
      countdownNodes.push(cd);
      card.append(cd);
      break;
    }
    case 'event':
      card.innerHTML = `<div class="tag-time">${esc(stop.time)}</div><div class="tag-event-title"><mark>${esc(stop.title)}</mark></div>`;
      break;
    case 'schedule':
      card.innerHTML = `<h3>${esc(stop.title)}</h3>${LEAF_RULE}<ul class="schedule-list">${stop.items
        .map((it) => `<li><b>${esc(it.time)}</b> ${esc(it.title)}</li>`).join('')}</ul>`;
      break;
    case 'venue':
      card.innerHTML = `<h3>${esc(stop.title)}</h3>${LEAF_RULE}<p>${esc(stop.text)}</p><p class="address">${esc(stop.address)}</p>
        <a class="btn" href="${esc(stop.mapUrl)}" target="_blank" rel="noopener">На картах</a>`;
      break;
    case 'dresscode': {
      card.innerHTML = `<h3>${esc(stop.title)}</h3><p style="font-size:17px">${esc(stop.text)}</p>
        <div class="swatches">${stop.colors.map((c) => `<span style="background:${esc(c)}"></span>`).join('')}</div>
        <p class="dress-line"><b>Девушки:</b> ${esc(stop.women)}</p>
        <p class="dress-line"><b>Мужчины:</b> ${esc(stop.men)}</p>`;
      const grid = (imgs) => `<div class="look-grid">${imgs.map((src) => `<img src="${esc(src)}" alt="Пример образа" loading="lazy">`).join('')}</div>`;
      card.insertAdjacentHTML('beforeend', grid([...stop.womenImages, ...stop.menImages]));
      break;
    }
    case 'details': {
      const o = stop.organizer;
      const tg = o.telegram ? `<a class="btn ghost" href="https://t.me/${esc(o.telegram.replace(/^@/, ''))}" target="_blank" rel="noopener">Telegram</a>` : '';
      const tel = o.phone ? `<a class="btn ghost" href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}">${esc(o.phone)}</a>` : '';
      card.innerHTML = `<h3>${esc(stop.title)}</h3><ul class="details-list">${stop.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p style="margin:6px 0 0;font-size:17px">Организатор — ${esc(o.name)}:</p><div class="organizer">${tel}${tg}</div>`;
      break;
    }
  }
  return card;
}

function miniLabel(stop) { return stop.type === 'event' ? stop.time : stop.label; }

// ---------- music ----------
const audio = $('music');
const muteBtn = $('mute');
{
  const sources = [CONTENT.music].flat();
  const type = (src) => (src.endsWith('.ogg') ? 'audio/ogg; codecs="vorbis"' : src.endsWith('.mp3') ? 'audio/mpeg' : '');
  audio.src = sources.find((src) => audio.canPlayType(type(src))) || sources[0];
}
function setPlaying(on) {
  muteBtn.setAttribute('aria-pressed', String(on));
  muteBtn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
}
function playMusic() { audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
muteBtn.addEventListener('click', () => {
  if (audio.paused) playMusic();
  else { audio.pause(); setPlaying(false); }
});

// ---------- tags (3D mode) ----------
function buildTags() {
  const layer = $('tags');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('tag-string');
  layer.append(svg);
  return CONTENT.stops.map((stop) => {
    const node = el('div', 'tag hidden');
    const mini = el('div', 'tag-mini');
    mini.textContent = miniLabel(stop);
    const card = buildCard(stop);
    node.append(mini, card);
    layer.append(node);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3');
    svg.append(line, dot);
    // the schedule lives on the sundial (its own overlay), not in a hanging card
    return { node, mini, card, line, dot, active: false, size: null, skip: ['schedule', 'venue', 'dresscode', 'details'].includes(stop.type) };
  });
}

function layoutTags(tags, frame) {
  const W = document.documentElement.clientWidth || window.innerWidth, H = window.innerHeight, M = 16;
  tags.forEach((tag, i) => {
    const a = frame.anchors[i];
    if (tag.skip) {
      tag.node.classList.add('hidden');
      tag.line.style.display = tag.dot.style.display = 'none';
      return;
    }
    const isActive = i === frame.active;
    if (isActive !== tag.active) {
      tag.active = isActive;
      tag.node.classList.toggle('active', isActive);
      tag.size = null;
    }
    const show = isActive || (a.visible && frame.sky < 0.3 && !frame.final);
    tag.node.classList.toggle('hidden', !show);
    tag.line.style.display = tag.dot.style.display = show ? '' : 'none';
    if (!show) return;

    const box = isActive ? tag.card : tag.mini;
    if (!tag.size) tag.size = { w: box.offsetWidth, h: box.offsetHeight };
    const { w, h } = tag.size;
    let x, y, sx, sy;
    if (isActive && frame.portrait) {
      x = (W - w) / 2;
      y = H - h - M - 8;
      sx = Math.min(Math.max(a.x, x + 30), x + w - 30); sy = y;
    } else if (isActive) {
      x = a.x + 80;
      if (x + w > W - M) x = Math.max(M, a.x - 150 - w); // no room on the right: go left, clear of the grapes
      y = Math.min(Math.max(a.y - h * 0.3, M + 50), H - h - M);
      sx = x < a.x ? x + w : x; sy = Math.min(Math.max(a.y, y + 24), y + h - 24);
    } else {
      x = a.x + 26; y = a.y + 4;
      sx = x + 2; sy = y + h / 2;
    }
    tag.node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    tag.line.setAttribute('x1', a.x); tag.line.setAttribute('y1', a.y);
    tag.line.setAttribute('x2', sx); tag.line.setAttribute('y2', sy);
    tag.dot.setAttribute('cx', a.x); tag.dot.setAttribute('cy', a.y);
  });
}

// ---------- cloud countdown: unit labels under the 3D digits (the title itself is written in clouds) ----------
function buildCountdownOverlay() {
  const box = el('div', 'cd3d');
  $('tags').append(box);
  const labels = [];
  return (cd) => {
    box.classList.toggle('shown', cd.visible);
    if (!cd.visible) return;
    cd.labels.forEach((l, i) => {
      if (!labels[i]) { labels[i] = el('span', 'cd3d-label'); box.append(labels[i]); }
      labels[i].textContent = l.text;
      labels[i].style.transform = `translate3d(${Math.round(l.x)}px, ${Math.round(l.y)}px, 0) translate(-50%, 0)`;
      labels[i].hidden = false;
    });
    for (let i = cd.labels.length; i < labels.length; i++) labels[i].hidden = true;
  };
}

// ---------- venue signpost: a real link over the green «На картах» board (the title is the carved top board) ----------
function buildVenueOverlay() {
  const stop = CONTENT.stops.find((st) => st.type === 'venue');
  if (!stop) return () => {};
  const box = el('div', 'sched');
  const link = el('a', 'venue-link');
  link.href = stop.mapUrl; link.target = '_blank'; link.rel = 'noopener';
  link.setAttribute('aria-label', 'Открыть место торжества на Яндекс Картах');
  box.append(link);
  $('tags').append(box);
  return (v) => {
    box.classList.toggle('shown', !!v?.visible);
    link.style.display = v?.visible ? '' : 'none';
    if (!v?.visible) return;
    Object.assign(link.style, { left: `${v.map.left}px`, top: `${v.map.top}px`, width: `${v.map.width}px`, height: `${v.map.height}px` });
  };
}

// ---------- dress code ribbons: «Примеры образов» shuffles the looks card out from behind the tag ----------
function buildDressOverlay(scene) {
  const stop = CONTENT.stops.find((st) => st.type === 'dresscode');
  if (!stop) return () => {};
  const btn = el('button', 'venue-link');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Показать или скрыть примеры образов');
  btn.style.background = 'transparent'; btn.style.border = 'none';
  btn.addEventListener('click', () => scene.toggleLooks());
  $('tags').append(btn);
  // the open lookbook card: left / right half turns the page (tap or swipe), the corner mark closes it
  const place = (b, r) => Object.assign(b.style, { display: '', position: 'absolute', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const mkArea = (label, dir) => {
    const b = el('button', 'venue-link');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    Object.assign(b.style, { background: 'transparent', border: 'none', touchAction: 'pan-y', display: 'none' });
    let x0 = null;
    b.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    b.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      scene.stepLook(Math.abs(dx) > 30 ? (dx < 0 ? 1 : -1) : dir); // swipe left = next, as in a photo gallery
    });
    $('tags').append(b);
    return b;
  };
  const prev = mkArea('Предыдущий образ', -1), next = mkArea('Следующий образ', 1);
  const close = el('button', 'venue-link');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть примеры образов');
  Object.assign(close.style, { background: 'transparent', border: 'none', display: 'none' });
  close.addEventListener('click', () => scene.toggleLooks());
  $('tags').append(close);
  return (d) => {
    const showTag = d?.visible && !d.tagHidden;
    btn.style.display = showTag ? '' : 'none';
    if (showTag) Object.assign(btn.style, { position: 'absolute', left: `${d.button.left}px`, top: `${d.button.top}px`, width: `${d.button.width}px`, height: `${d.button.height}px` });
    const lb = d?.visible ? d.lookbook : null;
    if (lb) { place(prev, lb.prev); place(next, lb.next); place(close, lb.close); } else prev.style.display = next.style.display = close.style.display = 'none';
  };
}

// ---------- details chalkboard: real links over the chalk «позвонить» / «Telegram» buttons ----------
function buildDetailsOverlay() {
  const stop = CONTENT.stops.find((st) => st.type === 'details');
  if (!stop) return () => {};
  const o = stop.organizer;
  const mk = (href, label, external) => {
    const a = el('a', 'venue-link');
    a.href = href; a.setAttribute('aria-label', label);
    if (external) { a.target = '_blank'; a.rel = 'noopener'; }
    $('tags').append(a);
    return a;
  };
  const phone = mk(`tel:${o.phone.replace(/[^\d+]/g, '')}`, `Позвонить: ${o.name}`, false);
  const tg = mk(`https://t.me/${o.telegram.replace(/^@/, '')}`, `Написать ${o.name} в Telegram`, true);
  const place = (a, r, show) => {
    a.style.display = show ? '' : 'none';
    if (show) Object.assign(a.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  return (d) => {
    place(phone, d?.phone, !!d?.visible);
    place(tg, d?.telegram, !!d?.visible);
  };
}

// ---------- stage navigation: a little vine with a gold medallion per stage (right side; top on phones) ----------
const NAV_ICONS = {
  envelope: '<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 5 8 5.5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5.5-8 8.5s8 3.5 8 8.5"/>',
  schedule: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2"/>',
  venue: '<path d="M12 3v18"/><path d="M5.5 5.5h10.5l2.8 2.5-2.8 2.5H5.5z"/><path d="M18.5 13H8l-2.8 2.5L8 18h10.5z"/>',
  dresscode: '<path d="M12 11.5c-2.6-3.7-7.6-4.6-7.6-1.2 0 3.5 4.8 3.9 7.6 1.2zm0 0c2.6-3.7 7.6-4.6 7.6-1.2 0 3.5-4.8 3.9-7.6 1.2z"/><path d="M11 12.5l-2.4 7M13 12.5l2.4 7"/>',
  details: '<rect x="4" y="4.5" width="16" height="12" rx="1"/><path d="M7.5 8.5h6M7.5 12h8.5"/><path d="M8.5 20.5l1.6-4M15.5 20.5l-1.6-4"/>',
  tablet: '<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4.5"/>',
};

function buildStageNav(stages, onGo) {
  const navEl = el('nav', 'stage-nav');
  navEl.setAttribute('aria-label', 'Разделы приглашения');
  const track = el('div', 'stage-track');
  const fill = el('div', 'stage-fill');
  track.append(fill);
  const buttons = stages.map((st, i) => {
    const b = el('button', st.quiet ? 'stage-dot quiet' : 'stage-dot'); // quiet: no label under it on phones
    b.type = 'button';
    b.setAttribute('aria-label', st.label);
    b.innerHTML = `<svg class="stage-ico" viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[st.icon] || ''}</svg><span class="stage-label">${esc(st.label)}</span>`;
    b.addEventListener('click', () => onGo(i));
    track.append(b);
    // a small leaf on the stem between two medallions
    if (i < stages.length - 1) track.append(el('i', `nav-leaf ${i % 2 ? 'r' : 'l'}`));
    return b;
  });
  navEl.append(track);
  document.body.append(navEl);
  let current = -1;
  return (active) => {
    if (active === current) return;
    current = active;
    buttons.forEach((b, i) => {
      b.classList.toggle('passed', i < active);
      b.classList.toggle('active', i === active);
      if (i === active) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    navEl.style.setProperty('--progress', stages.length > 1 ? active / (stages.length - 1) : 0);
  };
}

// ---------- fallback (no WebGL) ----------
function renderFlat() {
  document.body.classList.add('no3d');
  const list = $('flat-stops');
  list.hidden = false;
  for (const stop of [CONTENT.countdown, ...CONTENT.stops]) {
    const node = el('div', 'tag active');
    node.append(buildCard(stop));
    list.append(node);
  }
}

// Each stop along the vine; the sundial gets more scroll room so its shadow can visit all marks.
const STOP_SPECS = CONTENT.stops.map((st) => {
  if (st.type === 'schedule') return { kind: 'dial', weight: 1.6, photo: st.photo, dial: { items: st.items, motto: st.motto, title: st.title } };
  if (st.type === 'venue') return { kind: 'sign', weight: 1, photo: st.photo, sign: st };
  if (st.type === 'dresscode') return { kind: 'ribbons', weight: 1, photo: st.photo, ribbons: st };
  if (st.type === 'details') return { kind: 'chalkboard', weight: 1, photo: st.photo, chalkboard: st };
  return { kind: 'vine', weight: 1 };
});
const STOPS_WEIGHT = 1 + STOP_SPECS.reduce((sum, st) => sum + st.weight, 0); // +1: the countdown stop
let stepperReady = null; // set once the 3D scene exists; called when the envelope has been opened

// ---------- stepping: one gesture moves exactly one point (stop, or one hour on the clock) ----------
// points(): scroll positions to stop at, ascending; the last one is the top of the questionnaire, below which
// the page scrolls normally.
function createStepper(points, { slowUntil = () => 0 } = {}) {
  let enabled = false, animating = false, lastWheel = 0, wheelAcc = 0, touchY = null, gestureUsed = false;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const easeSoft = (t) => 0.5 - Math.cos(Math.PI * t) / 2; // gentler start and stop, for the descent from the sky
  function scrollToY(target, duration, curve = ease) {
    const from = window.scrollY, dist = target - from;
    if (Math.abs(dist) < 1) return;
    animating = true;
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + dist * curve(k));
      if (k < 1) requestAnimationFrame(tick);
      else setTimeout(() => { animating = false; }, 120);
    };
    requestAnimationFrame(tick);
  }
  const current = () => { // index of the nearest point
    const pts = points(), y = window.scrollY;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p - y) < Math.abs(pts[best] - y)) best = i; });
    return best;
  };
  const inStepZone = (dir) => { // between the sky and the top of the questionnaire (or leaving it upwards)
    const pts = points(), rsvpTop = pts[pts.length - 1], y = window.scrollY;
    return y < rsvpTop - 4 || (dir < 0 && y <= rsvpTop + 4);
  };
  function step(dir) {
    const pts = points();
    const to = Math.min(pts.length - 1, Math.max(0, current() + dir));
    const dist = Math.abs(pts[to] - window.scrollY);
    // the two steps from the sky down to the column glide slowly, so there's time to look around Rome
    if (Math.max(pts[to], window.scrollY) <= slowUntil() + 2) scrollToY(pts[to], 2800, easeSoft);
    else scrollToY(pts[to], Math.min(1300, 650 + dist * 0.25));
  }
  const goTo = (y) => scrollToY(y, Math.min(1500, 700 + Math.abs(y - window.scrollY) * 0.15));

  window.addEventListener('wheel', (e) => {
    if (!enabled || e.ctrlKey) return;
    const dir = Math.sign(e.deltaY);
    if (!dir || !inStepZone(dir)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 220) { wheelAcc = 0; gestureUsed = false; } // a pause ends the gesture (trackpad inertia included)
    lastWheel = now;
    if (animating || gestureUsed) return;
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 25) { gestureUsed = true; step(dir); }
  }, { passive: false });
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!enabled || touchY === null) return;
    const dir = Math.sign(touchY - e.touches[0].clientY);
    if (dir && inStepZone(dir) && !e.target.closest?.('.rsvp-stage')) e.preventDefault(); // we move the page ourselves
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    if (!enabled || touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    const dir = Math.sign(dy);
    if (Math.abs(dy) > 28 && inStepZone(dir) && !animating) step(dir);
  });
  window.addEventListener('keydown', (e) => {
    if (!enabled || e.target.closest?.('input, textarea, button, a')) return;
    const dir = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
    if (dir && inStepZone(dir)) { e.preventDefault(); if (!animating) step(dir); }
  });
  return { enable: () => { enabled = true; }, goTo };
}

// ---------- boot ----------
async function boot() {
  const { guest, answers } = await loadGuest();
  renderIntro(guest);
  initRsvp(guest, answers);
  let scene = null;

  document.body.classList.add('locked');
  // The seal breaks, the envelope fades out and the sky intro (already in place underneath) is revealed.
  initGate({
    greeting: guest?.greeting || 'Дорогой гость!',
    onOpen: playMusic,
    onDone: () => {
      document.body.classList.remove('locked');
      stepperReady?.(); // from now on one swipe / wheel turn = one stop
    },
  });

  try {
    const { createScene } = await import('./scene.js');
    scene = createScene($('scene'), {
      stops: STOP_SPECS,
      columnModel: CONTENT.columnModel,
      colosseumModel: CONTENT.colosseumModel,
      statueModel: CONTENT.statueModel,
    });
  } catch (err) {
    console.warn('3D unavailable, using the flat layout:', err);
  }

  if (!scene) {
    renderFlat();
  } else {
    const tags = buildTags();
    const layoutCountdown3d = buildCountdownOverlay();
    const layoutVenue = buildVenueOverlay();
    const layoutDress = buildDressOverlay(scene);
    const layoutDetails = buildDetailsOverlay();
    countdownListener = (parts) => scene.setCountdown(parts);
    const track = $('track');
    let smoothP = 0, last = performance.now(), dirty = true, lastFrame = null;
    const photoEls = [$('photo-0'), $('photo-1')];
    const introFrames = () => photoEls.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, bottom: r.bottom, w: r.width, h: r.height };
    });
    // Scroll lengths in screen heights: a short descent from the sky, then one stretch per stop.
    const SCROLL = { hold: 0.15, descent: 1.1, perStop: 0.9, final: 0.8 };
    const cue = $('scroll-cue');
    let descentEndPx = 0, endPx = 1;
    const layoutScroll = () => {
      const vh = window.innerHeight, intro = track.offsetTop;
      descentEndPx = Math.max(SCROLL.descent * vh, intro * 0.85);
      const stopsPx = STOPS_WEIGHT * SCROLL.perStop * vh;
      endPx = descentEndPx + stopsPx + SCROLL.final * vh;
      track.style.height = `${Math.max(0, endPx + vh - intro)}px`;
      scene.setPhases({
        introEnd: (SCROLL.hold * vh) / endPx,
        descentEnd: descentEndPx / endPx,
        stopsEnd: (descentEndPx + stopsPx) / endPx,
      });
    };
    // Where each stage of the invitation starts (scroll px) and where a click on it should land.
    const STAGES = [
      { label: 'Приглашение', icon: 'envelope' },
      { label: 'До свадьбы', icon: 'hourglass' },
      ...CONTENT.stops.map((st) => ({ label: st.label || st.title, icon: st.type, quiet: st.type === 'schedule' })),
      { label: 'Анкета', icon: 'tablet' },
    ];
    // Step points: one per stop, and one per hour on the clock. Each swipe / wheel turn moves exactly one point.
    let snapPoints = [];
    const placeStages = () => {
      const vh = window.innerHeight, per = SCROLL.perStop * vh;
      STAGES[0].start = 0; STAGES[0].target = 0;
      let at = descentEndPx;
      const weights = [1, ...STOP_SPECS.map((st) => st.weight)];
      const snaps = [];
      weights.forEach((w, i) => {
        const spec = STOP_SPECS[i - 1];
        STAGES[i + 1].start = at;
        if (spec?.kind === 'dial') {
          // one snap per hour: the clock hand sits exactly on mark k at f = k/(n-1) · 0.8 · 0.92 (see scene.js)
          const n = spec.dial.items.length;
          for (let k = 0; k < n; k++) snaps.push(at + per * w * Math.max(0.02, (k / (n - 1)) * 0.8 * 0.92));
        } else snaps.push(at + per * w * 0.05);
        STAGES[i + 1].target = at + per * w * (spec?.kind === 'dial' ? 0.02 : 0.05);
        at += per * w;
      });
      const rsvpTop = $('rsvp').offsetTop;
      STAGES[STAGES.length - 1].start = rsvpTop - vh * 0.5;
      STAGES[STAGES.length - 1].target = rsvpTop;
      snapPoints = snaps.map(Math.round);
    };
    layoutScroll();
    placeStages();
    // the descent from the sky takes two steps: the first one pauses halfway, above the roofs of Rome
    const stepper = createStepper(() => [0, Math.round(descentEndPx * 0.5), ...snapPoints, STAGES[STAGES.length - 1].target],
      { slowUntil: () => snapPoints[0] ?? descentEndPx });
    stepperReady = stepper.enable;
    if (!document.body.classList.contains('locked')) stepper.enable();
    const nav = buildStageNav(STAGES, (i) => stepper.goTo(STAGES[i].target));
    const activeStage = () => {
      const y = window.scrollY + window.innerHeight * 0.05;
      let a = 0;
      STAGES.forEach((st, i) => { if (y >= st.start - 2) a = i; });
      return a;
    };
    const progress = () => Math.min(1, Math.max(0, window.scrollY / endPx));
    // The cue appears twice: in the sky («Листайте вниз» → to the column) and at the details board
    // («Анкета гостя» → down to the questionnaire).
    let cueMode = 'intro';
    const rsvpHead = document.getElementById('rsvp-stage');
    cue.addEventListener('click', () => {
      stepper.goTo(cueMode === 'rsvp' ? STAGES[STAGES.length - 1].target : STAGES[1].target);
    });
    const LAST_STOP = CONTENT.stops.length; // pose index of the details board
    window.addEventListener('resize', () => {
      layoutScroll();
      placeStages();
      scene.resize();
      tags.forEach((t) => { t.size = null; });
      dirty = true;
    });
    // ?fps shows a live frame-rate meter (to test smoothness on a real phone)
    const fpsBox = new URLSearchParams(location.search).has('fps') ? document.body.appendChild(el('div', 'fps-meter')) : null;
    let fpsFrames = 0, fpsSince = performance.now();
    const loop = (now) => {
      if (fpsBox) {
        fpsFrames++;
        if (now - fpsSince >= 500) {
          fpsBox.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsSince))} fps`;
          fpsFrames = 0; fpsSince = now;
        }
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = progress();
      const delta = target - smoothP;
      // the intro frames float (CSS animation), so keep redrawing their clouds while the intro is in view
      if (smoothP < 0.2) dirty = true;
      nav(activeStage());
      if (scene.takeNeedsRender()) dirty = true;
      const inIntro = window.scrollY < descentEndPx * 0.8;
      const atEnd = lastFrame && (lastFrame.active === LAST_STOP || lastFrame.final)
        && rsvpHead.getBoundingClientRect().top > window.innerHeight * 0.75; // questionnaire not in view yet
      const mode = inIntro ? 'intro' : atEnd ? 'rsvp' : null;
      if (mode && mode !== cueMode) {
        cueMode = mode;
        $('hint').textContent = mode === 'rsvp' ? 'Анкета гостя' : CONTENT.intro.hint;
        cue.setAttribute('aria-label', mode === 'rsvp' ? 'Перейти к анкете гостя' : 'Листайте вниз');
      }
      cue.classList.toggle('gone', !mode);
      if (Math.abs(delta) > 1e-5 || dirty) {
        smoothP = NO_SMOOTH ? target : smoothP + delta * (1 - Math.exp(-dt * 7));
        if (Math.abs(target - smoothP) < 1e-5) smoothP = target;
        const t0 = performance.now();
        const frame = scene.render(smoothP, introFrames());
        if (NO_SMOOTH) { const ms = performance.now() - t0; window.__renderMax = Math.max(window.__renderMax || 0, ms); }
        lastFrame = frame;
        // anchor/stop 0 is the countdown above the capital; grape tags start at 1
        layoutTags(tags, { ...frame, anchors: frame.anchors.slice(1), active: frame.active - 1 });
        layoutCountdown3d(frame.countdown);
        layoutVenue(frame.venue);
        layoutDress(frame.dress);
        layoutDetails(frame.details);
        if (NO_SMOOTH) window.__frame = { p: smoothP, active: frame.active, descentEndPx, endPx, stats: scene.stats() };
        dirty = !!frame.dress?.animating; // keep drawing while the ribbon tails flutter
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  tickCountdown();
  setInterval(tickCountdown, 1000);
}

boot();
