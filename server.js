// Wedding invitation server: static site + guest lookup + RSVP storage (SQLite) + admin panel.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const compression = require('compression');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const DATA_DIR = path.join(__dirname, 'data');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');
const DB_FILE = path.join(DATA_DIR, 'rsvp.sqlite');

const DRINKS = ['Шампанское', 'Вино красное', 'Вино белое', 'Водка', 'Виски', 'Коньяк', 'Что-то безалкогольное'];

if (ADMIN_PASSWORD === 'change-me') {
  console.warn('[warn] ADMIN_PASSWORD is not set — using the default "change-me". Set it before deploying.');
}

// ---------- guests ----------
// Re-read on every request so you can edit guests.json without restarting the server.
function loadGuests() {
  try {
    return JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8'));
  } catch (err) {
    console.error('[error] cannot read guests.json:', err.message);
    return {};
  }
}

function publicGuest(slug, g) {
  const members = Array.isArray(g.members) ? g.members : [];
  return {
    slug,
    greeting: g.greeting || (members.length > 1 ? 'Дорогие гости!' : 'Дорогой гость!'),
    members,
    // "вы" for couples/families, or when "formal": true is set for a single guest
    plural: members.length > 1 || g.formal === true,
  };
}

// ---------- database ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT,            -- guest link id; NULL for responses from the generic link
    name        TEXT NOT NULL,
    attending   INTEGER NOT NULL, -- 1 = придёт, 0 = не придёт
    drinks      TEXT NOT NULL DEFAULT '[]',
    allergy     TEXT NOT NULL DEFAULT '',
    transfer    INTEGER,          -- 1 / 0 / NULL (not asked because not attending)
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS responses_slug_name ON responses(slug, name) WHERE slug IS NOT NULL;
`);

const upsertForGuest = db.prepare(`
  INSERT INTO responses (slug, name, attending, drinks, allergy, transfer, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug, name) WHERE slug IS NOT NULL DO UPDATE SET
    attending = excluded.attending, drinks = excluded.drinks, allergy = excluded.allergy,
    transfer = excluded.transfer, updated_at = excluded.updated_at
`);
const insertAnonymous = db.prepare(`
  INSERT INTO responses (slug, name, attending, drinks, allergy, transfer, created_at, updated_at)
  VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
`);
const selectBySlug = db.prepare('SELECT * FROM responses WHERE slug = ? ORDER BY id');
const selectAll = db.prepare('SELECT * FROM responses ORDER BY updated_at DESC');

function rowToAnswer(r) {
  return {
    name: r.name,
    attending: r.attending === 1,
    drinks: JSON.parse(r.drinks),
    allergy: r.allergy,
    transfer: r.transfer === null ? null : r.transfer === 1,
  };
}

// Validates one person's answer. Returns a clean object or throws a message for the guest.
function cleanAnswer(raw, fixedName) {
  const name = String(fixedName ?? raw?.name ?? '').trim().slice(0, 120);
  if (!name) throw new Error('Укажите имя и фамилию');
  if (typeof raw?.attending !== 'boolean') throw new Error(`${name}: отметьте, сможете ли вы прийти`);
  if (!raw.attending) return { name, attending: false, drinks: [], allergy: '', transfer: null };

  const drinks = Array.isArray(raw.drinks) ? raw.drinks.filter((d) => DRINKS.includes(d)) : [];
  if (drinks.length === 0) throw new Error(`${name}: выберите хотя бы один напиток`);
  if (typeof raw.transfer !== 'boolean') throw new Error(`${name}: ответьте про обратный трансфер`);
  const allergy = String(raw.allergy ?? '').trim().slice(0, 500);
  return { name, attending: true, drinks: [...new Set(drinks)], allergy, transfer: raw.transfer };
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
// gzip everything text-like, plus 3D models (their geometry compresses well); not audio/images (already compressed)
app.use(compression({
  filter: (req, res) => compression.filter(req, res) || /gltf|octet-stream/.test(String(res.getHeader('Content-Type'))),
}));
app.set('trust proxy', 'loopback'); // behind nginx: admin page shows https:// links
app.use(express.json({ limit: '20kb' }));

app.get('/api/guest/:slug', (req, res) => {
  const guests = loadGuests();
  const g = Object.hasOwn(guests, req.params.slug) ? guests[req.params.slug] : null;
  if (!g) return res.status(404).json({ error: 'not_found' });
  const answers = selectBySlug.all(req.params.slug).map(rowToAnswer);
  res.json({ guest: publicGuest(req.params.slug, g), answers });
});

app.post('/api/rsvp', (req, res) => {
  const now = new Date().toISOString();
  try {
    const { slug, answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > 10) throw new Error('Пустая анкета');

    if (slug) {
      const guests = loadGuests();
      const g = Object.hasOwn(guests, slug) ? guests[slug] : null;
      if (!g) throw new Error('Приглашение не найдено');
      const members = g.members || [];
      // Names come from the guest list, never from the client, so nobody can add extra people.
      const clean = members.map((m) => {
        const a = answers.find((x) => x?.name === m);
        if (!a) throw new Error(`${m}: заполните анкету`);
        return cleanAnswer(a, m);
      });
      db.exec('BEGIN');
      try {
        for (const a of clean) {
          upsertForGuest.run(slug, a.name, a.attending ? 1 : 0, JSON.stringify(a.drinks), a.allergy,
            a.transfer === null ? null : a.transfer ? 1 : 0, now, now);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } else {
      const a = cleanAnswer(answers[0]);
      insertAnonymous.run(a.name, a.attending ? 1 : 0, JSON.stringify(a.drinks), a.allergy,
        a.transfer === null ? null : a.transfer ? 1 : 0, now, now);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- admin ----------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const pass = Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':');
    const a = Buffer.from(pass);
    const b = Buffer.from(ADMIN_PASSWORD);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="admin", charset="UTF-8"').status(401).send('Нужен пароль');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yesNo = (v) => (v === null ? '—' : v ? 'Да' : 'Нет');

app.get('/admin', requireAdmin, (req, res) => {
  const rows = selectAll.all();
  const guests = loadGuests();
  const answeredNames = new Set(rows.filter((r) => r.slug).map((r) => `${r.slug}|${r.name}`));
  const base = `${req.protocol}://${req.get('host')}`;

  const coming = rows.filter((r) => r.attending === 1);
  const drinkCounts = DRINKS.map((d) => [d, coming.filter((r) => JSON.parse(r.drinks).includes(d)).length]);
  const totalInvited = Object.values(guests).reduce((n, g) => n + (g.members?.length || 0), 0);

  const guestRows = Object.entries(guests).map(([slug, g]) => {
    const pending = (g.members || []).filter((m) => !answeredNames.has(`${slug}|${m}`));
    return `<tr><td>${esc((g.members || []).join(', '))}</td><td><a href="/?g=${encodeURIComponent(slug)}">${esc(base)}/?g=${esc(slug)}</a></td>
      <td>${pending.length ? `<span class="warn">ждём: ${esc(pending.join(', '))}</span>` : '<span class="ok">ответили</span>'}</td></tr>`;
  }).join('');

  const answerRows = rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.slug || '(общая ссылка)')}</td>
    <td class="${r.attending ? 'ok' : 'warn'}">${r.attending ? 'Придёт' : 'Не придёт'}</td>
    <td>${esc(JSON.parse(r.drinks).join(', '))}</td><td>${esc(r.allergy)}</td><td>${yesNo(r.transfer === null ? null : r.transfer === 1)}</td>
    <td>${esc(new Date(r.updated_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }))}</td></tr>`).join('');

  res.send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ответы гостей</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#faf6ec;color:#3b2a14}
h1,h2{font-weight:600}table{border-collapse:collapse;width:100%;margin-bottom:32px;background:#fff}
td,th{border:1px solid #e3d7bc;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f1e8d4}
.ok{color:#3b6d11}.warn{color:#a3542d}.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.stat{background:#fff;border:1px solid #e3d7bc;border-radius:8px;padding:10px 16px}.stat b{display:block;font-size:22px}
a.btn{display:inline-block;padding:8px 14px;background:#6e7f3a;color:#fff;border-radius:6px;text-decoration:none}
.wrap{overflow-x:auto}</style></head><body>
<h1>Ответы гостей</h1>
<div class="stats">
  <div class="stat"><b>${coming.length}</b>придут</div>
  <div class="stat"><b>${rows.length - coming.length}</b>не придут</div>
  <div class="stat"><b>${totalInvited}</b>приглашено по списку</div>
  <div class="stat"><b>${coming.filter((r) => r.transfer === 1).length}</b>нужен трансфер</div>
  ${drinkCounts.map(([d, n]) => `<div class="stat"><b>${n}</b>${esc(d)}</div>`).join('')}
</div>
<p><a class="btn" href="/admin/export.csv">Скачать CSV (Excel)</a></p>
<h2>Ответы</h2><div class="wrap"><table><tr><th>Имя</th><th>Ссылка</th><th>Участие</th><th>Напитки</th><th>Аллергия</th><th>Трансфер</th><th>Обновлено</th></tr>${answerRows || '<tr><td colspan="7">Пока нет ответов</td></tr>'}</table></div>
<h2>Приглашения</h2><div class="wrap"><table><tr><th>Гости</th><th>Персональная ссылка</th><th>Статус</th></tr>${guestRows}</table></div>
</body></html>`);
});

app.get('/admin/export.csv', requireAdmin, (req, res) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Имя', 'Ссылка', 'Участие', 'Напитки', 'Аллергия', 'Трансфер', 'Обновлено'].map(cell).join(';')];
  for (const r of selectAll.all()) {
    lines.push([r.name, r.slug || '', r.attending ? 'Придёт' : 'Не придёт', JSON.parse(r.drinks).join(', '), r.allergy,
      yesNo(r.transfer === null ? null : r.transfer === 1), r.updated_at].map(cell).join(';'));
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="rsvp.csv"');
  res.send('﻿' + lines.join('\r\n')); // BOM so Excel opens Cyrillic correctly
});

// ---------- static ----------
const nm = (p) => path.join(__dirname, 'node_modules', p);
app.use('/vendor/three', express.static(nm('three'), { maxAge: '30d' }));
app.use('/vendor/fonts/cormorant', express.static(nm('@fontsource/cormorant-garamond'), { maxAge: '30d' }));
app.use('/vendor/fonts/prata', express.static(nm('@fontsource/prata'), { maxAge: '30d' }));
app.use('/vendor/fonts/eb-garamond', express.static(nm('@fontsource/eb-garamond'), { maxAge: '30d' }));
app.use('/vendor/fonts/great-vibes', express.static(nm('@fontsource/great-vibes'), { maxAge: '30d' }));
// Code and texts: no-cache = the browser revalidates (ETag), so guests always get the latest version after an update.
// Heavy media (models, music, photos): cached for a day, so a second visit loads almost nothing.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {
    const heavy = /[\\/]assets[\\/](models|music|photos|dresscode)[\\/]/.test(file); // works with \ and / paths
    res.set('Cache-Control', heavy ? 'public, max-age=86400' : 'no-cache');
  },
}));

app.listen(PORT, () => console.log(`Invitation running at http://localhost:${PORT}`));
