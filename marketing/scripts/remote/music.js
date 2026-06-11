/**
 * MCF Music Drop — Countdown, Early Access & Fan Dashboard
 * Mounted on /music by relay-server.js
 */

const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const router  = express.Router();

const DATA_FILE = '/tmp/music-data.json';
const CHARS     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(existing) {
  let c;
  do { c = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''); }
  while (existing[c]);
  return c;
}

let db = {
  config: {
    artistName:      'Your Name',
    trackName:       'Untitled Track',
    albumName:       '',
    releaseDate:     new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    coverUrl:        '',
    streamUrl:       '',
    downloadEnabled: false,
    downloadUrl:     '',
    description:     'Something big is dropping. Get early access.',
    genre:           '',
  },
  waitlist:    [],
  codes:       {},
  suggestions: [],
};
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch {}
function save() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); } catch {} }

const APP_PASS = process.env.APP_PASSWORD || 'Antigravity4321';

// ── Auth middleware for admin ─────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (token === APP_PASS) return next();
  const auth = Buffer.from((req.headers.authorization || '').replace('Basic ', ''), 'base64').toString();
  if (auth.split(':')[1] === APP_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="MCF Music Admin"');
  res.status(401).send('Unauthorized');
}

// ── Public: countdown page ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { artistName, trackName, albumName, releaseDate, coverUrl, description, genre } = db.config;
  const releaseMs = new Date(releaseDate).getTime();
  const released  = Date.now() >= releaseMs;
  res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${artistName} — ${trackName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#fff;font-family:'Segoe UI',sans-serif;min-height:100vh;
  background:linear-gradient(135deg,#0a0a0f 0%,#12001f 50%,#0a0a0f 100%)}
.hero{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
.cover{width:220px;height:220px;border-radius:16px;object-fit:cover;box-shadow:0 0 60px rgba(180,0,255,.4);margin-bottom:2rem;background:linear-gradient(135deg,#3a0066,#0066cc)}
.cover-placeholder{width:220px;height:220px;border-radius:16px;background:linear-gradient(135deg,#3a0066,#0066cc);display:flex;align-items:center;justify-content:center;font-size:4rem;margin-bottom:2rem;box-shadow:0 0 60px rgba(180,0,255,.4)}
.artist{font-size:.9rem;letter-spacing:.3em;text-transform:uppercase;color:#b060ff;margin-bottom:.5rem}
h1{font-size:2.4rem;font-weight:700;margin-bottom:.5rem;background:linear-gradient(90deg,#fff,#b060ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.genre{font-size:.8rem;color:#666;margin-bottom:1.5rem;letter-spacing:.2em;text-transform:uppercase}
.desc{color:#aaa;max-width:500px;line-height:1.6;margin-bottom:2.5rem}
.countdown{display:flex;gap:1.5rem;margin-bottom:3rem;flex-wrap:wrap;justify-content:center}
.unit{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(180,0,255,.3);border-radius:12px;padding:1rem 1.5rem;min-width:80px}
.unit span.n{font-size:2.5rem;font-weight:700;color:#b060ff}
.unit span.l{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#666;margin-top:.25rem}
.released-banner{font-size:1.5rem;color:#b060ff;letter-spacing:.1em;margin-bottom:2rem;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.section{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:2rem;width:100%;max-width:480px;margin-bottom:1.5rem}
.section h2{font-size:1rem;letter-spacing:.2em;text-transform:uppercase;color:#b060ff;margin-bottom:1.5rem}
input,textarea{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:.75rem 1rem;color:#fff;font-size:.95rem;margin-bottom:.75rem;outline:none;transition:.2s}
input:focus,textarea:focus{border-color:#b060ff}
btn,.btn{display:block;width:100%;padding:.9rem;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;transition:.2s;letter-spacing:.05em}
.btn-primary{background:linear-gradient(135deg,#7700cc,#0066ff);color:#fff}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(120,0,200,.4)}
.btn-outline{background:transparent;border:1px solid rgba(180,0,255,.5);color:#b060ff}
.btn-outline:hover{background:rgba(180,0,255,.1)}
.toggle{cursor:pointer;color:#b060ff;font-size:.9rem;margin-top:.5rem;display:block}
#codeForm{display:none;margin-top:1rem}
.msg{padding:.75rem;border-radius:8px;margin-top:.75rem;font-size:.9rem}
.msg.ok{background:rgba(0,200,100,.15);border:1px solid rgba(0,200,100,.3);color:#4ef0a0}
.msg.err{background:rgba(255,50,50,.15);border:1px solid rgba(255,50,50,.3);color:#ff8080}
footer{position:fixed;bottom:1rem;right:1rem;font-size:.75rem;color:#333}
</style></head><body>
<div class="hero">
  ${coverUrl ? `<img class="cover" src="${coverUrl}" alt="Cover">` : `<div class="cover-placeholder">🎵</div>`}
  <div class="artist">${artistName}</div>
  <h1>${trackName}${albumName ? ` — ${albumName}` : ''}</h1>
  ${genre ? `<div class="genre">${genre}</div>` : ''}
  <p class="desc">${description}</p>

  ${released ? `<div class="released-banner">🎶 OUT NOW 🎶</div>` : `
  <div class="countdown" id="cd">
    <div class="unit"><span class="n" id="cd-d">--</span><span class="l">Days</span></div>
    <div class="unit"><span class="n" id="cd-h">--</span><span class="l">Hours</span></div>
    <div class="unit"><span class="n" id="cd-m">--</span><span class="l">Mins</span></div>
    <div class="unit"><span class="n" id="cd-s">--</span><span class="l">Secs</span></div>
  </div>`}

  <div class="section">
    <h2>🎤 Get Early Access</h2>
    <form id="wlForm">
      <input type="text" id="wlName" placeholder="Your name" required>
      <input type="email" id="wlEmail" placeholder="Email address" required>
      <input type="tel" id="wlPhone" placeholder="Phone (optional)">
      <button class="btn btn-primary" type="submit">Join the Waitlist</button>
    </form>
    <div id="wlMsg"></div>
    <span class="toggle" onclick="document.getElementById('codeForm').style.display=document.getElementById('codeForm').style.display==='none'?'block':'none'">Already have a code? ↓</span>
    <div id="codeForm">
      <input type="text" id="codeInput" placeholder="Enter your access code" style="text-transform:uppercase;letter-spacing:.2em;text-align:center">
      <button class="btn btn-outline" onclick="verifyCode()">Unlock Early Access</button>
      <div id="codeMsg"></div>
    </div>
  </div>
</div>
<footer>MCF Music</footer>
<script>
const release = new Date('${releaseDate}').getTime();
function tick() {
  const diff = release - Date.now();
  if (diff <= 0) { document.getElementById('cd')?.remove(); return; }
  const d = Math.floor(diff/86400000), h = Math.floor(diff%86400000/3600000),
        m = Math.floor(diff%3600000/60000), s = Math.floor(diff%60000/1000);
  document.getElementById('cd-d').textContent = String(d).padStart(2,'0');
  document.getElementById('cd-h').textContent = String(h).padStart(2,'0');
  document.getElementById('cd-m').textContent = String(m).padStart(2,'0');
  document.getElementById('cd-s').textContent = String(s).padStart(2,'0');
}
setInterval(tick, 1000); tick();

document.getElementById('wlForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const r = await fetch('/music/join', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name: wlName.value, email: wlEmail.value, phone: wlPhone.value }) });
  const d = await r.json();
  const el = document.getElementById('wlMsg');
  el.className = 'msg ' + (d.ok ? 'ok' : 'err');
  el.textContent = d.ok ? "✅ You're on the list! We'll notify you first." : d.error;
  if (d.ok) document.getElementById('wlForm').style.display = 'none';
});

async function verifyCode() {
  const code = document.getElementById('codeInput').value.toUpperCase().trim();
  const r = await fetch('/music/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
  const d = await r.json();
  const el = document.getElementById('codeMsg');
  if (d.ok) { window.location.href = '/music/play?code=' + code; return; }
  el.className = 'msg err'; el.textContent = d.error;
}
</script></body></html>`);
});

// ── Public: listen / early access page ───────────────────────────────────────
router.get('/play', (req, res) => {
  const code = (req.query.code || '').toUpperCase().trim();
  if (!code || !db.codes[code]) return res.redirect('/music');
  const { artistName, trackName, albumName, coverUrl, streamUrl, downloadEnabled, downloadUrl } = db.config;
  const isYT = streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be');
  const isSC = streamUrl.includes('soundcloud.com');
  let ytId = '';
  if (isYT) { const m = streamUrl.match(/(?:v=|youtu\.be\/)([^&?]+)/); ytId = m ? m[1] : ''; }
  res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${artistName} — ${trackName} (Early Access)</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#fff;font-family:'Segoe UI',sans-serif;min-height:100vh;
  background:linear-gradient(135deg,#0a0a0f 0%,#12001f 50%,#0a0a0f 100%)}
.page{max-width:600px;margin:0 auto;padding:2rem}
.cover{width:200px;height:200px;border-radius:16px;object-fit:cover;box-shadow:0 0 60px rgba(180,0,255,.4);background:linear-gradient(135deg,#3a0066,#0066cc);display:flex;align-items:center;justify-content:center;font-size:3rem;margin:0 auto 1.5rem}
img.cover{display:block}
.artist{text-align:center;font-size:.85rem;letter-spacing:.3em;text-transform:uppercase;color:#b060ff;margin-bottom:.4rem}
h1{text-align:center;font-size:2rem;margin-bottom:2rem;background:linear-gradient(90deg,#fff,#b060ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.badge{display:inline-block;background:rgba(180,0,255,.2);border:1px solid rgba(180,0,255,.4);border-radius:20px;padding:.3rem .9rem;font-size:.75rem;letter-spacing:.15em;color:#b060ff;text-transform:uppercase;margin:0 auto 1.5rem;display:table}
.player-wrap{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
audio{width:100%;margin-bottom:.5rem}
iframe{width:100%;border:none;border-radius:8px}
.btn{display:block;width:100%;padding:.9rem;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;margin-bottom:.75rem;transition:.2s}
.btn-dl{background:linear-gradient(135deg,#7700cc,#0066ff);color:#fff}
.btn-dl:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(120,0,200,.4)}
.section{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
h2{font-size:.9rem;letter-spacing:.2em;text-transform:uppercase;color:#b060ff;margin-bottom:1rem}
input,textarea{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:.75rem 1rem;color:#fff;font-size:.95rem;margin-bottom:.75rem;outline:none;transition:.2s}
input:focus,textarea:focus{border-color:#b060ff}
.btn-sub{background:rgba(180,0,255,.25);border:1px solid rgba(180,0,255,.4);color:#fff}
.btn-sub:hover{background:rgba(180,0,255,.4)}
.msg{padding:.75rem;border-radius:8px;margin-top:.5rem;font-size:.9rem}
.msg.ok{background:rgba(0,200,100,.15);border:1px solid rgba(0,200,100,.3);color:#4ef0a0}
.share{display:flex;gap:.75rem;flex-wrap:wrap}
.share a{flex:1;min-width:100px;padding:.6rem;border-radius:8px;text-align:center;text-decoration:none;font-size:.85rem;font-weight:600;border:1px solid rgba(255,255,255,.15);color:#fff;transition:.2s}
.share a:hover{background:rgba(255,255,255,.1)}
</style></head><body>
<div class="page">
  ${coverUrl ? `<img class="cover" src="${coverUrl}" alt="Cover">` : `<div class="cover">🎵</div>`}
  <div class="artist">${artistName}</div>
  <h1>${trackName}${albumName ? ` — ${albumName}` : ''}</h1>
  <div class="badge">🔒 Early Access</div>

  <div class="player-wrap">
    ${isYT && ytId ? `<iframe height="200" src="https://www.youtube.com/embed/${ytId}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>` :
      isSC ? `<iframe height="166" scrolling="no" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(streamUrl)}&auto_play=true&color=%23b060ff"></iframe>` :
      streamUrl ? `<audio controls autoplay src="${streamUrl}"></audio>` :
      `<p style="color:#666;text-align:center;padding:1rem">🎵 Track coming soon — check back closer to release.</p>`}
    ${downloadEnabled && downloadUrl ? `<a class="btn btn-dl" href="${downloadUrl}" download>⬇️ Download Track</a>` : ''}
  </div>

  <div class="section">
    <h2>💬 Send a Suggestion</h2>
    <input id="sgName" placeholder="Your name">
    <textarea id="sgMsg" rows="3" placeholder="What do you think? Feature requests, feedback, collabs..."></textarea>
    <button class="btn btn-sub" onclick="sendSuggestion()">Send to ${artistName}</button>
    <div id="sgRes"></div>
  </div>

  <div class="section">
    <h2>📲 Share</h2>
    <div class="share">
      <a href="https://wa.me/?text=${encodeURIComponent(`🎵 Check out ${artistName} - ${trackName} (early access) → ${req.protocol}://${req.get('host')}/music`)}" target="_blank">WhatsApp</a>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎶 Listening to ${artistName} - ${trackName} early access! 🔥`)}&url=${encodeURIComponent(`${req.protocol}://${req.get('host')}/music`)}" target="_blank">Twitter/X</a>
      <a href="https://www.instagram.com/" target="_blank">Instagram</a>
      <a href="https://www.tiktok.com/" target="_blank">TikTok</a>
    </div>
  </div>
</div>
<script>
async function sendSuggestion() {
  const name = document.getElementById('sgName').value.trim();
  const msg  = document.getElementById('sgMsg').value.trim();
  if (!msg) return;
  const r = await fetch('/music/suggest', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, message: msg, code: '${code}' }) });
  const d = await r.json();
  const el = document.getElementById('sgRes');
  el.className = 'msg ok';
  el.textContent = d.ok ? '✅ Sent! Thanks for the feedback.' : '❌ Could not send.';
  document.getElementById('sgMsg').value = '';
}
</script></body></html>`);
});

// ── Admin dashboard ───────────────────────────────────────────────────────────
router.get('/admin', adminAuth, (req, res) => {
  const { config, waitlist, codes, suggestions } = db;
  const codeList   = Object.entries(codes).map(([k, v]) => `<tr><td>${k}</td><td>${v.note||''}</td><td>${v.usedBy||'—'}</td><td>${v.usedAt ? new Date(v.usedAt).toLocaleString() : '—'}</td><td>${v.plays||0}</td></tr>`).join('');
  const waitRows   = waitlist.map(w => `<tr><td>${w.name}</td><td>${w.email}</td><td>${w.phone||'—'}</td><td>${new Date(w.joinedAt).toLocaleDateString()}</td></tr>`).join('');
  const sugRows    = suggestions.map(s => `<tr><td>${s.name||'Anon'}</td><td>${s.message}</td><td>${new Date(s.submittedAt).toLocaleString()}</td></tr>`).join('');
  const totalCodes = Object.keys(codes).length;
  const usedCodes  = Object.values(codes).filter(c => c.usedBy).length;

  res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCF Music Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e0e0e0;font-family:'Segoe UI',sans-serif}
.topbar{background:rgba(180,0,255,.15);border-bottom:1px solid rgba(180,0,255,.3);padding:.75rem 1.5rem;display:flex;align-items:center;gap:1rem}
.topbar h1{font-size:1.1rem;color:#b060ff;flex:1}
.topbar a{color:#777;font-size:.85rem;text-decoration:none}
.topbar a:hover{color:#b060ff}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;padding:1.5rem}
.stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:1.25rem}
.stat .n{font-size:2rem;font-weight:700;color:#b060ff}
.stat .l{font-size:.8rem;color:#777;text-transform:uppercase;letter-spacing:.1em;margin-top:.25rem}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:1.5rem;margin:0 1.5rem 1.5rem}
.card h2{font-size:.85rem;letter-spacing:.2em;text-transform:uppercase;color:#b060ff;margin-bottom:1.25rem}
label{display:block;font-size:.8rem;color:#888;margin-bottom:.3rem;margin-top:.75rem}
input,textarea,select{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:.65rem 1rem;color:#fff;font-size:.9rem;outline:none}
input:focus,textarea:focus{border-color:#b060ff}
.row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.btn{padding:.7rem 1.5rem;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;transition:.2s}
.btn-primary{background:linear-gradient(135deg,#7700cc,#0066ff);color:#fff;margin-top:1rem}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(120,0,200,.4)}
.btn-sm{padding:.5rem 1rem;font-size:.8rem;background:rgba(180,0,255,.2);border:1px solid rgba(180,0,255,.4);color:#b060ff;border-radius:6px}
.btn-sm:hover{background:rgba(180,0,255,.35)}
.btn-dl{background:rgba(0,150,50,.2);border:1px solid rgba(0,200,80,.3);color:#4ef0a0}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{color:#666;font-weight:600;text-align:left;padding:.5rem .75rem;border-bottom:1px solid rgba(255,255,255,.08)}
td{padding:.5rem .75rem;border-bottom:1px solid rgba(255,255,255,.05)}
.toggle-wrap{display:flex;align-items:center;gap:.75rem;margin-top:.75rem}
.toggle-wrap label{margin:0;color:#e0e0e0;font-size:.9rem}
.platform-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;margin-top:.5rem}
.platform{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border:1px solid rgba(255,255,255,.1);border-radius:10px;text-decoration:none;color:#e0e0e0;transition:.2s;font-size:.85rem}
.platform:hover{background:rgba(255,255,255,.06);border-color:#b060ff}
.platform .icon{font-size:1.4rem}
.msg{padding:.6rem;border-radius:6px;margin-top:.75rem;font-size:.85rem}
.msg.ok{background:rgba(0,200,100,.12);color:#4ef0a0}
.msg.err{background:rgba(255,50,50,.12);color:#ff8080}
</style></head><body>
<div class="topbar">
  <h1>🎵 MCF Music Admin</h1>
  <a href="/music" target="_blank">View Public Page ↗</a>
</div>

<div class="grid">
  <div class="stat"><div class="n">${waitlist.length}</div><div class="l">Waitlist Signups</div></div>
  <div class="stat"><div class="n">${totalCodes}</div><div class="l">Access Codes</div></div>
  <div class="stat"><div class="n">${usedCodes}</div><div class="l">Codes Activated</div></div>
  <div class="stat"><div class="n">${suggestions.length}</div><div class="l">Fan Suggestions</div></div>
</div>

<!-- Release Config -->
<div class="card">
  <h2>🎤 Release Config</h2>
  <div class="row">
    <div><label>Artist Name</label><input id="artistName" value="${config.artistName}"></div>
    <div><label>Track / Song Title</label><input id="trackName" value="${config.trackName}"></div>
  </div>
  <div class="row">
    <div><label>Album / EP (optional)</label><input id="albumName" value="${config.albumName}"></div>
    <div><label>Genre</label><input id="genre" value="${config.genre}" placeholder="Afrobeats, Hip-Hop, House..."></div>
  </div>
  <label>Release Date & Time</label>
  <input type="datetime-local" id="releaseDate" value="${config.releaseDate}">
  <label>Cover Art URL</label>
  <input id="coverUrl" value="${config.coverUrl}" placeholder="Paste image URL (Dropbox, Drive, Imgur...)">
  <label>Stream URL — YouTube, SoundCloud, or direct MP3 link</label>
  <input id="streamUrl" value="${config.streamUrl}" placeholder="https://youtu.be/... or https://soundcloud.com/... or direct .mp3 URL">
  <label>Description (shown on countdown page)</label>
  <textarea id="description" rows="2">${config.description}</textarea>
  <div class="toggle-wrap">
    <input type="checkbox" id="downloadEnabled" ${config.downloadEnabled ? 'checked' : ''} style="width:auto">
    <label for="downloadEnabled">Enable Download</label>
  </div>
  <div id="dlUrlWrap" style="${config.downloadEnabled ? '' : 'display:none'}">
    <label>Download URL</label>
    <input id="downloadUrl" value="${config.downloadUrl}" placeholder="Direct link to MP3/WAV file">
  </div>
  <button class="btn btn-primary" onclick="saveConfig()">💾 Save Config</button>
  <div id="cfgMsg"></div>
</div>

<!-- Access Codes -->
<div class="card">
  <h2>🔑 Access Codes</h2>
  <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap">
    <div><label>Generate how many?</label><input type="number" id="codeCount" value="10" min="1" max="500" style="width:100px"></div>
    <div><label>Label / Note (optional)</label><input id="codeNote" placeholder="e.g. VIP, press, fans" style="width:200px"></div>
    <button class="btn btn-sm" onclick="genCodes()">Generate</button>
    <a class="btn btn-sm btn-dl" href="/music/admin/export?token=${APP_PASS}" download="codes.csv">⬇ Export CSV</a>
  </div>
  <div id="genMsg"></div>
  <br>
  <table><thead><tr><th>Code</th><th>Label</th><th>Used By</th><th>Activated</th><th>Plays</th></tr></thead>
  <tbody id="codeTable">${codeList || '<tr><td colspan="5" style="color:#555;text-align:center">No codes yet</td></tr>'}</tbody></table>
</div>

<!-- Waitlist -->
<div class="card">
  <h2>📋 Waitlist (${waitlist.length})</h2>
  <a class="btn btn-sm btn-dl" href="/music/admin/export-waitlist?token=${APP_PASS}" download="waitlist.csv" style="margin-bottom:1rem;display:inline-block">⬇ Export Waitlist CSV</a>
  <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead>
  <tbody>${waitRows || '<tr><td colspan="4" style="color:#555;text-align:center">No signups yet</td></tr>'}</tbody></table>
</div>

<!-- Suggestions -->
<div class="card">
  <h2>💬 Fan Suggestions (${suggestions.length})</h2>
  <table><thead><tr><th>Name</th><th>Message</th><th>Time</th></tr></thead>
  <tbody>${sugRows || '<tr><td colspan="3" style="color:#555;text-align:center">No suggestions yet</td></tr>'}</tbody></table>
</div>

<!-- Distribution -->
<div class="card">
  <h2>🚀 Distribute Your Music</h2>
  <p style="color:#888;font-size:.85rem;margin-bottom:1rem">Use a distributor to publish to Spotify, Apple Music, TikTok etc. DistroKid is the fastest ($22/year, unlimited releases). Click to open each platform:</p>
  <div class="platform-grid">
    <a class="platform" href="https://distrokid.com" target="_blank"><span class="icon">🎵</span><div><div style="font-weight:600">DistroKid</div><div style="color:#888;font-size:.75rem">Best — $22/yr unlimited</div></div></a>
    <a class="platform" href="https://tunecore.com" target="_blank"><span class="icon">🎼</span><div><div style="font-weight:600">TuneCore</div><div style="color:#888;font-size:.75rem">Per-release pricing</div></div></a>
    <a class="platform" href="https://artists.spotify.com" target="_blank"><span class="icon">💚</span><div><div style="font-weight:600">Spotify for Artists</div><div style="color:#888;font-size:.75rem">Claim your artist profile</div></div></a>
    <a class="platform" href="https://music.apple.com/artist-portal" target="_blank"><span class="icon">🍎</span><div><div style="font-weight:600">Apple Music</div><div style="color:#888;font-size:.75rem">Artist portal</div></div></a>
    <a class="platform" href="https://soundon.tiktok.com" target="_blank"><span class="icon">🎵</span><div><div style="font-weight:600">TikTok SoundOn</div><div style="color:#888;font-size:.75rem">Direct TikTok upload</div></div></a>
    <a class="platform" href="https://studio.youtube.com" target="_blank"><span class="icon">📺</span><div><div style="font-weight:600">YouTube Music</div><div style="color:#888;font-size:.75rem">Upload via YouTube Studio</div></div></a>
    <a class="platform" href="https://soundcloud.com/upload" target="_blank"><span class="icon">🔶</span><div><div style="font-weight:600">SoundCloud</div><div style="color:#888;font-size:.75rem">Direct upload, free tier</div></div></a>
    <a class="platform" href="https://www.audiomack.com" target="_blank"><span class="icon">🎶</span><div><div style="font-weight:600">Audiomack</div><div style="color:#888;font-size:.75rem">Popular in Africa</div></div></a>
  </div>
  <p style="color:#555;font-size:.8rem;margin-top:1rem">⚡ Fastest workflow: Upload to DistroKid once → it distributes to Spotify, Apple Music, Deezer, TikTok, Amazon Music & 30+ more automatically within 24–48hrs.</p>
</div>

<script>
document.getElementById('downloadEnabled').addEventListener('change', function() {
  document.getElementById('dlUrlWrap').style.display = this.checked ? '' : 'none';
});

async function saveConfig() {
  const body = {
    artistName:      document.getElementById('artistName').value,
    trackName:       document.getElementById('trackName').value,
    albumName:       document.getElementById('albumName').value,
    genre:           document.getElementById('genre').value,
    releaseDate:     document.getElementById('releaseDate').value,
    coverUrl:        document.getElementById('coverUrl').value,
    streamUrl:       document.getElementById('streamUrl').value,
    description:     document.getElementById('description').value,
    downloadEnabled: document.getElementById('downloadEnabled').checked,
    downloadUrl:     document.getElementById('downloadUrl').value,
  };
  const r = await fetch('/music/admin/config?token=${APP_PASS}', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const d = await r.json();
  const el = document.getElementById('cfgMsg');
  el.className = 'msg ' + (d.ok ? 'ok' : 'err');
  el.textContent = d.ok ? '✅ Saved!' : '❌ Error saving';
}

async function genCodes() {
  const count = parseInt(document.getElementById('codeCount').value) || 10;
  const note  = document.getElementById('codeNote').value;
  const r = await fetch('/music/admin/codes?token=${APP_PASS}', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ count, note }) });
  const d = await r.json();
  const el = document.getElementById('genMsg');
  el.className = 'msg ok';
  el.textContent = '✅ Generated ' + d.codes.length + ' codes: ' + d.codes.slice(0,5).join(', ') + (d.codes.length > 5 ? '...' : '');
  setTimeout(() => location.reload(), 1500);
}
</script></body></html>`);
});

// ── API: join waitlist ────────────────────────────────────────────────────────
router.post('/join', (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.json({ ok: false, error: 'Name and email required' });
  if (db.waitlist.find(w => w.email === email)) return res.json({ ok: false, error: 'Already on the waitlist!' });
  db.waitlist.push({ name, email, phone: phone || '', joinedAt: new Date().toISOString() });
  save();
  res.json({ ok: true });
});

// ── API: verify access code ───────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const code = (req.body.code || '').toUpperCase().trim();
  if (!db.codes[code]) return res.json({ ok: false, error: 'Invalid code. Check spelling and try again.' });
  res.json({ ok: true });
});

// ── API: submit suggestion ────────────────────────────────────────────────────
router.post('/suggest', (req, res) => {
  const { name, message, code } = req.body;
  if (!message) return res.json({ ok: false });
  db.suggestions.push({ name: name || 'Anonymous', message, code: code || '', submittedAt: new Date().toISOString() });
  save();
  res.json({ ok: true });
});

// ── Admin: save config ────────────────────────────────────────────────────────
router.post('/admin/config', adminAuth, (req, res) => {
  db.config = { ...db.config, ...req.body };
  save();
  res.json({ ok: true });
});

// ── Admin: generate codes ─────────────────────────────────────────────────────
router.post('/admin/codes', adminAuth, (req, res) => {
  const count = Math.min(parseInt(req.body.count) || 10, 500);
  const note  = req.body.note || '';
  const generated = [];
  for (let i = 0; i < count; i++) {
    const code = genCode(db.codes);
    db.codes[code] = { note, usedBy: null, usedAt: null, plays: 0 };
    generated.push(code);
  }
  save();
  res.json({ ok: true, codes: generated });
});

// ── Admin: export codes CSV ───────────────────────────────────────────────────
router.get('/admin/export', adminAuth, (req, res) => {
  const rows = [['Code', 'Label', 'Used By', 'Activated', 'Plays']];
  for (const [k, v] of Object.entries(db.codes)) {
    rows.push([k, v.note || '', v.usedBy || '', v.usedAt || '', v.plays || 0]);
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="access-codes.csv"');
  res.send(rows.map(r => r.join(',')).join('\n'));
});

// ── Admin: export waitlist CSV ────────────────────────────────────────────────
router.get('/admin/export-waitlist', adminAuth, (req, res) => {
  const rows = [['Name', 'Email', 'Phone', 'Joined']];
  db.waitlist.forEach(w => rows.push([w.name, w.email, w.phone || '', w.joinedAt]));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="waitlist.csv"');
  res.send(rows.map(r => r.join(',')).join('\n'));
});

module.exports = router;
