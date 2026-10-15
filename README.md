# Свадебное приглашение · Аня & Максим

Interactive 3D invitation: sky → descent through clouds → camera spirals down a Roman column
wrapped in a grapevine (one grape-cluster tag per section) → guest questionnaire at the base.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000 (generic link) or http://localhost:3000/?g=petrovy (personal link).
Admin panel: http://localhost:3000/admin — any username, password from `ADMIN_PASSWORD` (default `change-me`).

## What to edit

| What | Where |
| --- | --- |
| All texts, times, venue, dress code, organizer contact | `public/js/content.js` |
| Guests and personal links | `data/guests.json` (no restart needed) |
| Couple photos | `public/assets/photos/` + paths in `content.js` |
| Small photo at each stop (cameos / polaroids) | `public/assets/photos/stop-schedule.jpg`, `stop-venue.jpg`, `stop-details.jpg` — a drawn placeholder shows until the file exists |
| Music | `public/assets/music/music.mp3` |
| Blender column | `public/assets/models/column.glb` (Y-up; auto-scaled and centred) |
| Dress-code example photos | `public/assets/dresscode/` (file names listed in `content.js`) |

### Guest list format

```json
{
  "petrovy": { "greeting": "Дорогие Иван и Мария!", "members": ["Иван Петров", "Мария Петрова"] },
  "anna":    { "greeting": "Дорогая Анна!", "members": ["Анна Смирнова"] },
  "babushka": { "greeting": "Дорогая бабушка!", "members": ["Галина Ивановна"], "formal": true }
}
```

- The key is the link: `https://your-site.ru/?g=petrovy`. Use latin letters, digits and dashes.
- One questionnaire block per person in `members`; nobody can add extra people.
- Couples and `"formal": true` guests are addressed as «вас», single guests as «тебя».
- Guests can reopen their link and change answers — the old answer is replaced.
- The admin panel lists every personal link and who hasn't answered yet; answers export to CSV for Excel.

## Optimising 3D models before use

Large models slow the first load. Shrink a `.glb` (WebP textures at 1024 px, compact geometry) while keeping
its meshes separate (the column code looks up the `PillarMain` mesh by name):

```bash
npx -y @gltf-transform/cli@4 optimize in.glb out.glb --compress quantize --texture-compress webp --texture-size 1024 --join false --flatten false --simplify false --instance false --palette false
```

The column went from 4.64 MB to 0.55 MB this way. The server also compresses code and models (Brotli/gzip)
and lets browsers cache models, music and photos for a day.

## Deploy to a VPS (Ubuntu)

```bash
# 1. Node.js 22.13+ (24 recommended) — node:sqlite is built in
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs nginx

# 2. Copy the project (without node_modules and data/rsvp.sqlite) to /opt/invitation, then:
cd /opt/invitation && npm ci --omit=dev
```

`/etc/systemd/system/invitation.service`:

```ini
[Unit]
Description=Wedding invitation
After=network.target

[Service]
WorkingDirectory=/opt/invitation
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Environment=ADMIN_PASSWORD=put-a-long-password-here
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data /opt/invitation/data
sudo systemctl enable --now invitation
```

nginx (`/etc/nginx/sites-available/invitation`), then `sudo certbot --nginx -d your-site.ru` for HTTPS:

```nginx
server {
  server_name your-site.ru;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Backups:** the answers live in one file, `data/rsvp.sqlite` — copy it occasionally, or just download the CSV from `/admin`.

## Debug

`?nosmooth` makes the camera follow the scroll instantly (useful for screenshots).
