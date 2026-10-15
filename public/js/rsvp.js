// Guest questionnaire as Roman voting tablets: one question per wax tablet, turned like the pages of a
// hinged diptych; a summary at the end; then the stack slides into the envelope and gets sealed.
import { CONTENT } from './content.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

// small line icons drawn like stylus marks in the wax
const ICON = {
  yes: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  no: '<path d="M7 7l10 10M17 7L7 17"/>',
  'Шампанское': '<path d="M9.5 2h5l-.8 8.5a1.7 1.7 0 0 1-3.4 0z"/><path d="M12 12.2V20M8.5 21.5h7"/><path d="M14.5 3.2l2-1.4M15.8 5.2l2.3-.5" opacity=".7"/>',
  'Вино красное': '<path d="M7 3h10c0 5-2.2 8-5 8s-5-3-5-8z"/><path d="M7.4 6.5h9.2c-.4 2.8-2 4.5-4.6 4.5s-4.2-1.7-4.6-4.5z" fill="#8f2d3a" stroke="none"/><path d="M12 11v9M8.5 21.5h7"/>',
  'Вино белое': '<path d="M7 3h10c0 5-2.2 8-5 8s-5-3-5-8z"/><path d="M7.4 6.5h9.2c-.4 2.8-2 4.5-4.6 4.5s-4.2-1.7-4.6-4.5z" fill="#e9d48a" stroke="none"/><path d="M12 11v9M8.5 21.5h7"/>',
  'Водка': '<path d="M7.5 6h9l-1.6 14h-5.8z"/><path d="M8.3 12h7.4" opacity=".6"/>',
  'Виски': '<path d="M5.5 7h13l-1.3 13H6.8z"/><rect x="8.5" y="12" width="4" height="4" rx=".6" opacity=".7"/><path d="M6.3 12.5h11.4" opacity=".5"/>',
  'Коньяк': '<path d="M6 7.5c0 5.4 2.7 8 6 8s6-2.6 6-8c0-.9-.2-1.6-.5-2.3h-11C6.2 5.9 6 6.6 6 7.5z"/><path d="M12 15.5v4.5M8.5 21.5h7"/><path d="M6.6 10.5h10.8" opacity=".6"/>',
  'Что-то безалкогольное': '<path d="M7 7h10l-1.6 14H8.6z"/><path d="M13.5 2.5L12 11" /><circle cx="15.8" cy="7" r="2.2" opacity=".75"/>',
  allergy: '<path d="M12 3.5c3.8 3 5.8 6.1 5.8 9.6a5.8 5.8 0 0 1-11.6 0c0-3.5 2-6.6 5.8-9.6z"/><path d="M12 8.5v10M12 12.5l2.6-2.2M12 15.5l-2.6-2.2"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-3.9 3.6-6 7-6s6.2 2.1 7 6"/>',
  bus: '<rect x="4.5" y="4" width="15" height="13" rx="2.5"/><path d="M4.5 11h15M8 17v2.5M16 17v2.5"/><circle cx="8" cy="14.2" r=".9"/><circle cx="16" cy="14.2" r=".9"/>',
  noBus: '<path d="M5 12h14"/><path d="M8 8l-3 4 3 4" />',
};
const icon = (key) => (ICON[key] ? `<svg class="wax-ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[key]}</svg>` : '');

export function initRsvp(guest, previousAnswers) {
  const { rsvp } = CONTENT;
  const form = $('rsvp-form');
  const tablet = $('tablet');
  const pile = $('tablet-pile');
  const scene = $('env-scene');
  const thanks = $('env-thanks');

  // ---------- state ----------
  const named = !!guest?.members?.length; // personal link: names come from the guest list
  const people = (named ? guest.members : ['']).map((name) => {
    const prev = previousAnswers?.find((a) => a.name === name);
    return {
      name,
      attending: prev ? prev.attending : null,
      drinks: prev?.drinks ? [...prev.drinks] : [],
      allergy: prev?.allergy ?? '',
      transfer: prev ? prev.transfer : null,
    };
  });
  const multi = people.length > 1;

  // The tablets depend on the answers: "Не приду" skips the rest of that person's questions.
  const steps = () => {
    const list = [];
    if (!named) list.push({ kind: 'name', p: 0 });
    people.forEach((person, p) => {
      list.push({ kind: 'attend', p });
      if (person.attending) list.push({ kind: 'drinks', p }, { kind: 'allergy', p }, { kind: 'transfer', p });
    });
    list.push({ kind: 'summary' });
    return list;
  };
  let index = 0;

  // ---------- tablet content ----------
  const chip = (type, name, value, label, checked, ico) =>
    `<label class="wax-chip"><input type="${type}" name="${name}" value="${esc(value)}"${checked ? ' checked' : ''}>`
    + `<span>${ico ? icon(ico) : ''}<b>${esc(label)}</b></span></label>`;

  // frame furniture shared by every tablet: bronze plaque, carved deadline, corner brackets, hinge rings
  const furniture = () => `
    <div class="tablet-plaque"><span>${esc(rsvp.title)}</span></div>
    <div class="tablet-engrave">${esc(rsvp.deadline)}</div>
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <i class="hinge h1"></i><i class="hinge h2"></i>`;

  function progress(i, total) {
    const notches = Array.from({ length: total }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
    return `<div class="tablet-progress"><span>QUAESTIO ${ROMAN[i + 1] ?? i + 1}</span><div class="notches">${notches}</div></div>`;
  }
  const personLabel = (p) => (multi ? `<p class="tablet-person">${esc(people[p].name)}</p>` : '');

  function contentFor(i) {
    const list = steps();
    const st = list[i];
    const questions = list.length - 1;
    const person = people[st.p];
    if (st.kind === 'name') {
      return `${progress(i, questions)}
        <label class="tablet-q" for="q-name">Как вас зовут?</label>
        <div class="wax-field"><input class="wax-input" id="q-name" name="name" type="text" autocomplete="name" placeholder="Имя и фамилия" value="${esc(person.name)}"></div>`;
    }
    if (st.kind === 'attend') {
      return `${progress(i, questions)}${personLabel(st.p)}
        <fieldset><legend class="tablet-q">Сможете ли вы присутствовать на торжестве?</legend>
        <div class="wax-chips big">${chip('radio', 'attend', 'yes', 'Приду', person.attending === true, 'yes')}${chip('radio', 'attend', 'no', 'Не приду', person.attending === false, 'no')}</div></fieldset>`;
    }
    if (st.kind === 'drinks') {
      return `${progress(i, questions)}${personLabel(st.p)}
        <fieldset><legend class="tablet-q">Что будете пить?</legend>
        <p class="tablet-hint">Можно выбрать несколько</p>
        <div class="wax-chips grid">${rsvp.drinks.map((d) => chip('checkbox', 'drinks', d, d, person.drinks.includes(d), d)).join('')}</div></fieldset>`;
    }
    if (st.kind === 'allergy') {
      return `${progress(i, questions)}${personLabel(st.p)}
        <label class="tablet-q" for="q-allergy">Есть ли у вас аллергия на какие-то продукты?</label>
        <div class="wax-field"><input class="wax-input" id="q-allergy" name="allergy" type="text" placeholder="Например: орехи, цитрусовые" value="${esc(person.allergy)}"></div>
        <p class="tablet-hint">Если нет — просто нажмите «Дальше»</p>`;
    }
    if (st.kind === 'transfer') {
      return `${progress(i, questions)}${personLabel(st.p)}
        <fieldset><legend class="tablet-q">Нужен ли вам обратный трансфер?</legend>
        <div class="wax-chips big">${chip('radio', 'transfer', 'yes', 'Да, нужен', person.transfer === true, 'bus')}${chip('radio', 'transfer', 'no', 'Нет, не нужен', person.transfer === false, 'noBus')}</div></fieldset>`;
    }
    // summary: every line jumps back to its tablet
    const line = (p, kind, ico, text) => `<button type="button" class="sum-line" data-p="${p}" data-kind="${kind}">${icon(ico)}<span>${text}</span><em aria-hidden="true">✎</em></button>`;
    const blocks = people.map((pp, p) => {
      const rows = [line(p, 'attend', pp.attending ? 'yes' : 'no', pp.attending ? 'Придёт' : 'Не сможет прийти')];
      if (!named) rows.unshift(line(p, 'name', 'person', esc(pp.name)));
      if (pp.attending) {
        rows.push(line(p, 'drinks', pp.drinks[0], esc(pp.drinks.join(', '))));
        rows.push(line(p, 'allergy', 'allergy', `Аллергия: ${esc(pp.allergy || 'нет')}`));
        rows.push(line(p, 'transfer', pp.transfer ? 'bus' : 'noBus', pp.transfer ? 'Нужен трансфер' : 'Без трансфера'));
      }
      return `<div class="sum-person">${named ? `<p class="sum-name">${esc(pp.name)}</p>` : ''}${rows.join('')}</div>`;
    }).join('');
    return `<div class="tablet-progress"><span>SUMMA</span></div>
      <p class="tablet-q">Всё верно?</p>
      <div class="sum-list">${blocks}</div>`;
  }

  // Fills a tablet element with the content of step i.
  function fill(el, i) {
    const isSummary = steps()[i].kind === 'summary';
    el.innerHTML = `${furniture()}
      <div class="tablet-body">${contentFor(i)}</div>
      <p class="tablet-error" role="alert" hidden></p>
      <div class="tablet-nav">
        ${i > 0 ? '<button type="button" class="wax-back" data-act="back" aria-label="Назад">←</button>' : '<span></span>'}
        <button type="submit" class="wax-btn${isSummary ? ' send' : ''}">${isSummary ? 'Отправить' : 'Дальше'}</button>
      </div>`;
  }

  function wire() {
    tablet.querySelectorAll('.sum-line').forEach((b) => b.addEventListener('click', () => {
      const target = steps().findIndex((s) => s.kind === b.dataset.kind && (s.p === +b.dataset.p || s.kind === 'name'));
      if (target >= 0) go(target, -1);
    }));
    tablet.querySelector('[data-act="back"]')?.addEventListener('click', () => { save(); go(index - 1, -1); });
  }

  function renderPile() {
    const n = Math.min(4, index);
    while (pile.children.length < n) pile.append(document.createElement('i'));
    while (pile.children.length > n) pile.lastChild.remove();
  }

  function render() {
    index = Math.min(index, steps().length - 1);
    fill(tablet, index);
    wire();
    renderPile();
  }

  // ---------- reading + validating the current tablet ----------
  function save() {
    const st = steps()[index];
    const person = people[st.p];
    const val = (n) => form.querySelector(`#tablet input[name="${n}"]:checked`)?.value;
    if (st.kind === 'name') person.name = form.querySelector('#q-name').value.trim();
    if (st.kind === 'attend' && val('attend')) person.attending = val('attend') === 'yes';
    if (st.kind === 'drinks') person.drinks = [...form.querySelectorAll('#tablet input[name="drinks"]:checked')].map((b) => b.value);
    if (st.kind === 'allergy') person.allergy = form.querySelector('#q-allergy').value.trim();
    if (st.kind === 'transfer' && val('transfer')) person.transfer = val('transfer') === 'yes';
  }
  function validate() {
    const st = steps()[index];
    const person = people[st.p];
    if (st.kind === 'name' && !person.name) return 'Напишите, пожалуйста, ваше имя';
    if (st.kind === 'attend' && person.attending === null) return 'Выберите один из вариантов';
    if (st.kind === 'drinks' && !person.drinks.length) return 'Выберите хотя бы один напиток';
    if (st.kind === 'transfer' && person.transfer === null) return 'Выберите один из вариантов';
    return '';
  }
  function showError(msg) {
    const e = tablet.querySelector('.tablet-error');
    e.textContent = msg; e.hidden = !msg;
    if (msg) tablet.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' },
      { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], { duration: reduced() ? 0 : 380 });
  }

  // ---------- turning the tablets (hinged on the left, like a diptych) ----------
  let busy = false;
  async function go(to, dir = 1) {
    if (busy || to < 0) return;
    busy = true;
    const stack = tablet.parentElement;
    const leaf = tablet.cloneNode(true); // a copy of the tablet that physically turns away / comes back
    leaf.removeAttribute('id');
    leaf.classList.add('leaf');
    leaf.querySelectorAll('input, button').forEach((n) => { n.disabled = true; n.removeAttribute('id'); });
    const dur = reduced() ? 0 : 620;
    if (dir > 0) {
      // the current tablet turns away to the left and drops onto the pile; the next one is already underneath
      stack.append(leaf);
      index = to;
      render();
      tablet.animate([{ transform: 'scale(.965) translateY(6px)', filter: 'brightness(.8)' }, { transform: 'none', filter: 'none' }],
        { duration: dur * 0.9, easing: 'cubic-bezier(.2,.7,.2,1)' });
      await leaf.animate([
        { transform: 'rotateY(0deg)', opacity: 1, offset: 0 },
        { transform: 'rotateY(-62deg) translateZ(30px)', opacity: 1, offset: 0.55 },
        { transform: 'translateX(-38%) translateY(26px) rotateY(-92deg) rotateZ(-7deg) scale(.72)', opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).finished;
      pile.lastElementChild?.animate([{ transform: 'translateY(-14px) rotate(-11deg)' }, { transform: '' }], { duration: dur * 0.5, easing: 'cubic-bezier(.3,1.6,.5,1)', composite: 'add' });
    } else {
      // going back: the previous tablet comes off the pile and turns back into place over the current one
      index = to;
      fill(leaf, to);
      stack.append(leaf);
      await leaf.animate([
        { transform: 'translateX(-38%) translateY(26px) rotateY(-92deg) rotateZ(-7deg) scale(.72)', opacity: 0 },
        { transform: 'rotateY(-62deg) translateZ(30px)', opacity: 1, offset: 0.45 },
        { transform: 'rotateY(0deg)', opacity: 1 },
      ], { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).finished;
      render();
    }
    leaf.remove();
    tablet.querySelector('.wax-input')?.focus({ preventScroll: true });
    busy = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const st = steps()[index];
    if (st.kind !== 'summary') {
      save();
      const err = validate();
      if (err) { showError(err); return; }
      go(index + 1, 1);
      return;
    }
    await send();
  });
  form.addEventListener('change', () => { const e = tablet.querySelector('.tablet-error'); if (e) e.hidden = true; });

  // ---------- sending: stack → envelope → seal ----------
  async function send() {
    const btn = tablet.querySelector('.wax-btn');
    btn.disabled = true; btn.textContent = 'Отправляем…';
    try {
      const answers = people.map((p) => (p.attending
        ? { name: p.name, attending: true, drinks: p.drinks, allergy: p.allergy, transfer: p.transfer }
        : { name: p.name, attending: false }));
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: guest?.slug || null, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить ответ');
      await sealEnvelope(false);
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Отправить';
      showError(`${err.message}. Проверьте интернет и попробуйте ещё раз.`);
    }
  }

  async function sealEnvelope(instant) {
    const stage = $('rsvp-stage');
    // handwritten on the envelope, under the seal
    thanks.innerHTML = `<p class="ink-thanks">Спасибо!</p>
      <p class="ink-note">${instant ? 'ваш ответ уже у нас' : 'ваш ответ получен'}</p>
      <button type="button" class="ink-edit" data-act="edit">${named ? 'изменить ответы' : 'заполнить ещё раз'}</button>`;
    thanks.querySelector('[data-act="edit"]').addEventListener('click', reopen);
    scene.hidden = false;
    stage.classList.remove('sealed', 'sending');
    if (instant) { stage.classList.add('sending', 'sealed', 'instant'); return; }
    stage.classList.remove('instant');
    void stage.offsetWidth;
    stage.classList.add('sending');   // tablets shrink into a stack, envelope rises, stack slides in
    await wait(1500);
    stage.classList.add('sealed');    // flap folds down, seal drops, thank-you appears
    await wait(300);
    scene.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  }

  function reopen() {
    const stage = $('rsvp-stage');
    if (!named) { // generic link: a fresh questionnaire for the next guest
      Object.assign(people[0], { name: '', attending: null, drinks: [], allergy: '', transfer: null });
      index = 0;
    } else index = steps().length - 1; // straight to the summary with everything filled in
    stage.classList.remove('sending', 'sealed', 'instant');
    scene.hidden = true;
    render();
  }

  // a returning guest (personal link) sees their sealed envelope right away
  if (named && previousAnswers?.length) {
    index = steps().length - 1;
    render();
    sealEnvelope(true);
  } else render();
}
