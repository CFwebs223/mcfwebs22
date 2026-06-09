#!/usr/bin/env node
/**
 * MCF LEADAPP — Permanent Mobile App
 * Deploy this to Render. URL never changes.
 * Mac pushes stats every 60s. App works from any phone anywhere.
 */

const express = require('express');
const app     = express();
const PORT    = process.env.PORT || 3003;
const SECRET  = process.env.RELAY_SECRET || 'mcf2026';
const APP_PASS = process.env.APP_PASSWORD || 'Antigravity4321';

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

let latestStats  = null;
let lastUpdate   = null;
const commandQueue = [];
const commandResults = {};

// ── Auth middleware for app access ────────────────────────────────────────────
function appAuth(req, res, next) {
  const token = req.headers['x-app-token'] || req.query.token;
  if (token === APP_PASS) return next();
  // Allow relay secret too (for Mac pusher)
  if (req.headers['x-relay-secret'] === SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Mac pushes stats here every 60s ──────────────────────────────────────────
app.post('/push', (req, res) => {
  if (req.headers['x-relay-secret'] !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  latestStats = req.body;
  lastUpdate  = new Date().toISOString();
  res.json({ ok: true });
});

// ── Mac polls for commands to execute ────────────────────────────────────────
app.get('/pending-command', (req, res) => {
  if (req.headers['x-relay-secret'] !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const cmd = commandQueue.shift() || null;
  res.json({ command: cmd });
});

// ── Mac reports command result ────────────────────────────────────────────────
app.post('/command-result', (req, res) => {
  if (req.headers['x-relay-secret'] !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const { id, result } = req.body;
  if (id) commandResults[id] = { result, at: new Date().toISOString() };
  res.json({ ok: true });
});

// ── App sends commands ────────────────────────────────────────────────────────
app.post('/command', appAuth, (req, res) => {
  const { action } = req.body;
  const allowed = ['run-engine','stop-engine','run-poster','run-scraper','run-calls'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'Unknown action' });
  const id = Date.now().toString();
  commandQueue.push({ id, action, queuedAt: new Date().toISOString() });
  res.json({ ok: true, id, message: `${action} queued — Mac will execute within 30s` });
});

// ── Stats API ─────────────────────────────────────────────────────────────────
app.get('/stats', appAuth, (req, res) => {
  if (!latestStats) return res.json({ error: 'Mac offline or starting up' });
  res.json({ ...latestStats, lastUpdate });
});

app.get('/health', (req, res) => res.json({ ok: true, hasData: !!latestStats }));

// ── PWA manifest ──────────────────────────────────────────────────────────────
app.get('/manifest.json', (req, res) => {
  res.json({
    name: 'MCF LEADAPP',
    short_name: 'LEADAPP',
    description: 'MCF Websites — Client Acquisition Control',
    start_url: '/?token=' + APP_PASS,
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#7c3aed',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]
  });
});

// ── App icon (generated SVG→PNG inline) ──────────────────────────────────────
app.get('/icon-192.png', (req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="38" fill="#7c3aed"/><text x="96" y="120" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="72" fill="white">M</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});
app.get('/icon-512.png', (req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="100" fill="#7c3aed"/><text x="256" y="320" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="200" fill="white">M</text></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// ── Full Mobile PWA ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const token = req.query.token || '';
  if (token !== APP_PASS) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MCF LEADAPP</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0f;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{background:#12121f;border:1px solid #2a2a3e;border-radius:20px;padding:40px;width:100%;max-width:360px;text-align:center}
h1{font-size:1.8rem;font-weight:900;color:#fff;margin-bottom:6px}.sub{color:#7c3aed;font-size:.9rem;margin-bottom:32px}
input{width:100%;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:10px;padding:14px 16px;color:#fff;font-size:1rem;margin-bottom:16px;outline:none}
input:focus{border-color:#7c3aed}
button{width:100%;background:#7c3aed;border:none;border-radius:10px;padding:14px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer}
.err{color:#f87171;font-size:.85rem;margin-top:12px}</style></head>
<body><div class="box"><h1>LEADAPP</h1><div class="sub">MCF Websites Control</div>
<form onsubmit="login(event)"><input type="password" id="pw" placeholder="Enter password" autofocus>
<button type="submit">Open App</button></form><div class="err" id="err"></div></div>
<script>function login(e){e.preventDefault();const p=document.getElementById('pw').value;
fetch('/stats?token='+encodeURIComponent(p)).then(r=>{if(r.status===401){document.getElementById('err').textContent='Wrong password';return;}
window.location.href='/?token='+encodeURIComponent(p);}).catch(()=>{document.getElementById('err').textContent='Error';});}</script>
</body></html>`);
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="LEADAPP">
<meta name="theme-color" content="#7c3aed">
<title>MCF LEADAPP</title>
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icon-192.png">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#0a0a0f;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}
#app{height:100vh;display:flex;flex-direction:column}
.hdr{background:linear-gradient(135deg,#1a1a2e,#16213e);padding:env(safe-area-inset-top,0) 16px 0;padding-top:calc(env(safe-area-inset-top,0px) + 12px);padding-bottom:12px;border-bottom:1px solid #2a2a3e;flex-shrink:0}
.hdr-row{display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:1.15rem;font-weight:800;color:#fff}.hdr h1 span{color:#a78bfa}
.badge{display:inline-flex;align-items:center;gap:6px;background:#12121f;border:1px solid #2a2a3e;border-radius:100px;padding:5px 12px;font-size:.72rem;font-weight:600}
.pulse{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite;flex-shrink:0}
.pulse.off{background:#ef4444;animation:none}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)}70%{box-shadow:0 0 0 8px rgba(74,222,128,0)}}
.content{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.tab-content{display:none;padding:16px;padding-bottom:100px}
.tab-content.active{display:block}
.nav{position:fixed;bottom:0;left:0;right:0;background:#12121f;border-top:1px solid #2a2a3e;display:flex;padding-bottom:env(safe-area-inset-bottom,0);z-index:100}
.nav-btn{flex:1;padding:12px 0 8px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;color:#6b7280;font-size:.65rem;font-weight:600;border:none;background:none;text-transform:uppercase;letter-spacing:.05em}
.nav-btn.active{color:#a78bfa}
.nav-btn svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.grid2{grid-template-columns:repeat(2,1fr)}
.card{background:#12121f;border:1px solid #1e1e2e;border-radius:12px;padding:14px}
.lbl{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px}
.val{font-size:1.9rem;font-weight:800;color:#fff;line-height:1}
.val.g{color:#4ade80}.val.y{color:#fbbf24}.val.b{color:#60a5fa}.val.r{color:#f87171}
.sub{font-size:.68rem;color:#6b7280;margin-top:4px}
.sec{background:#12121f;border:1px solid #1e1e2e;border-radius:12px;padding:14px;margin-bottom:12px}
.sec-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:10px;font-weight:700}
.reply-item{padding:10px 0;border-bottom:1px solid #1e1e2e}
.reply-item:last-child{border:none}
.reply-name{font-weight:700;color:#4ade80;font-size:.9rem}
.reply-det{font-size:.72rem;color:#6b7280;margin-top:2px}
.act-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #1e1e2e;font-size:.75rem}
.act-row:last-child{border:none}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dot.sent{background:#4ade80}.dot.failed{background:#f87171}.dot.replied{background:#fbbf24}
.btn{width:100%;padding:14px;border:none;border-radius:12px;font-size:.95rem;font-weight:700;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
.btn:active{opacity:.7}
.btn.green{background:#16a34a;color:#fff}
.btn.red{background:#dc2626;color:#fff}
.btn.purple{background:#7c3aed;color:#fff}
.btn.blue{background:#2563eb;color:#fff}
.btn.orange{background:#ea580c;color:#fff}
.btn.gray{background:#374151;color:#fff}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1f2937;border:1px solid #374151;border-radius:10px;padding:10px 20px;font-size:.85rem;color:#fff;z-index:999;opacity:0;transition:opacity .3s;white-space:nowrap}
.toast.show{opacity:1}
.upd{font-size:.65rem;color:#6b7280;text-align:center;padding:6px 0;margin-bottom:8px}
.lead-item{padding:10px;background:#12121f;border:1px solid #1e1e2e;border-radius:10px;margin-bottom:8px}
.lead-name{font-weight:700;font-size:.85rem;color:#fff}
.lead-det{font-size:.7rem;color:#6b7280;margin-top:2px}
.status-badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:.65rem;font-weight:700}
.s-sent{background:rgba(74,222,128,.15);color:#4ade80}
.s-replied{background:rgba(251,191,36,.15);color:#fbbf24}
.s-failed{background:rgba(248,113,113,.15);color:#f87171}
.s-pending{background:rgba(96,165,250,.15);color:#60a5fa}
.call-btn{background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.75rem;font-weight:700;cursor:pointer;margin-top:6px}
.section-hdr{font-size:1rem;font-weight:800;color:#fff;margin-bottom:12px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e1e2e;font-size:.82rem}
.info-row:last-child{border:none}
.info-key{color:#6b7280}
.info-val{color:#fff;font-weight:600;text-align:right}
.install-bar{background:linear-gradient(90deg,#7c3aed,#4f46e5);border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}
.install-txt{font-size:.82rem;font-weight:700;color:#fff}
.install-sub{font-size:.68rem;color:#c4b5fd;margin-top:2px}
.install-ico{font-size:1.5rem}
</style>
</head>
<body>
<div id="app">
  <div class="hdr">
    <div class="hdr-row">
      <h1>MCF <span>LEADAPP</span></h1>
      <div class="badge"><span class="pulse off" id="dot"></span><span id="btext">Loading...</span></div>
    </div>
  </div>
  <div class="content">
    <!-- HOME TAB -->
    <div class="tab-content active" id="tab-home">
      <div class="install-bar" onclick="installApp()" id="install-bar" style="display:none">
        <div><div class="install-txt">Add to Home Screen</div><div class="install-sub">Tap to install as app</div></div>
        <div class="install-ico">📱</div>
      </div>
      <div class="upd" id="upd">Loading...</div>
      <div class="grid">
        <div class="card"><div class="lbl">Sent Today</div><div class="val g" id="st">—</div></div>
        <div class="card"><div class="lbl">Total Sent</div><div class="val b" id="ts">—</div></div>
        <div class="card"><div class="lbl">🎉 Replies</div><div class="val y" id="rep">—</div></div>
      </div>
      <div class="grid grid2">
        <div class="card"><div class="lbl">Leads Left</div><div class="val" id="uns">—</div><div class="sub" id="tot"></div></div>
        <div class="card"><div class="lbl">Groups Today</div><div class="val b" id="grp">—</div></div>
        <div class="card"><div class="lbl">Follow-up 1</div><div class="val" id="fu1">—</div></div>
        <div class="card"><div class="lbl">Follow-up 2</div><div class="val" id="fu2">—</div></div>
      </div>
      <div class="sec" id="reply-sec" style="display:none">
        <div class="sec-title">🎉 Replies — Call These People Now!</div>
        <div id="reply-list"></div>
      </div>
      <div class="sec">
        <div class="sec-title">Recent Activity</div>
        <div id="act-list"></div>
      </div>
    </div>

    <!-- LEADS TAB -->
    <div class="tab-content" id="tab-leads">
      <div class="section-hdr">Leads Database</div>
      <div id="leads-stats" style="margin-bottom:14px"></div>
      <div id="leads-list"></div>
    </div>

    <!-- REPLIES TAB -->
    <div class="tab-content" id="tab-replies">
      <div class="section-hdr">🎉 Hot Leads — Call Them!</div>
      <div id="replies-full"></div>
    </div>

    <!-- CONTROL TAB -->
    <div class="tab-content" id="tab-control">
      <div class="section-hdr">System Control</div>
      <button class="btn green" onclick="cmd('run-engine')">▶️ Run WhatsApp Blast Now</button>
      <button class="btn red" onclick="cmd('stop-engine')">⏹ Stop Engine</button>
      <button class="btn purple" onclick="cmd('run-poster')">📢 Post to Facebook Groups Now</button>
      <button class="btn orange" onclick="cmd('run-calls')">📞 Run Cold Calls Now</button>
      <button class="btn blue" onclick="cmd('run-scraper')">🔍 Scrape New Leads Now</button>
      <div class="sec" style="margin-top:16px">
        <div class="sec-title">Business Info</div>
        <div class="info-row"><span class="info-key">Business</span><span class="info-val">MCF Websites</span></div>
        <div class="info-row"><span class="info-key">Christopher</span><span class="info-val"><a href="tel:0753203477" style="color:#60a5fa">075 320 3477</a></span></div>
        <div class="info-row"><span class="info-key">KV</span><span class="info-val"><a href="tel:0615442591" style="color:#60a5fa">061 544 2591</a></span></div>
        <div class="info-row"><span class="info-key">Website</span><span class="info-val"><a href="https://mcfwebs.agency" style="color:#60a5fa">mcfwebs.agency</a></span></div>
        <div class="info-row"><span class="info-key">Receptionist</span><span class="info-val"><a href="https://mcf-receptionist.onrender.com" style="color:#60a5fa">Open</a></span></div>
      </div>
      <div class="sec">
        <div class="sec-title">Process Status</div>
        <div id="proc-list"></div>
      </div>
    </div>
  </div>
  <nav class="nav">
    <button class="nav-btn active" onclick="showTab('home',this)">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Home
    </button>
    <button class="nav-btn" onclick="showTab('leads',this)">
      <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Leads
    </button>
    <button class="nav-btn" onclick="showTab('replies',this)">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Replies
    </button>
    <button class="nav-btn" onclick="showTab('control',this)">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>Control
    </button>
  </nav>
</div>
<div class="toast" id="toast"></div>

<script>
const TOKEN = '${APP_PASS}';
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  document.getElementById('install-bar').style.display = 'flex';
});

function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; document.getElementById('install-bar').style.display = 'none'; }
}

function showTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'leads') renderLeads();
  if (name === 'replies') renderReplies();
  if (name === 'control') renderControl();
}

function toast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = ok ? '#4ade80' : '#f87171';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function cmd(action) {
  toast('Sending command...', true);
  try {
    const r = await fetch('/command?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-token': TOKEN },
      body: JSON.stringify({ action })
    });
    const d = await r.json();
    toast(d.message || 'Done!', true);
  } catch { toast('Failed to send command', false); }
}

let data = null;

async function load() {
  try {
    const r = await fetch('/stats?token=' + TOKEN, { headers: { 'x-app-token': TOKEN } });
    if (r.status === 401) { window.location.href = '/'; return; }
    data = await r.json();
    if (data.error) { document.getElementById('btext').textContent = 'Mac offline'; return; }
    render(data);
  } catch(e) { document.getElementById('btext').textContent = 'Connection error'; }
}

function render(d) {
  const e = d.engine || {}, l = d.leads || {}, g = d.groups || {};
  document.getElementById('dot').className = 'pulse' + (e.running ? '' : ' off');
  document.getElementById('btext').textContent = e.running ? 'Engine running' : 'Engine stopped';
  document.getElementById('st').textContent = e.sentToday ?? '—';
  document.getElementById('ts').textContent = e.totalSent ?? '—';
  document.getElementById('rep').textContent = e.replied ?? '—';
  document.getElementById('fu1').textContent = e.fu1 ?? '—';
  document.getElementById('fu2').textContent = e.fu2 ?? '—';
  document.getElementById('uns').textContent = l.unsent ?? '—';
  document.getElementById('tot').textContent = 'of ' + (l.total ?? '?') + ' total';
  document.getElementById('grp').textContent = g.postedToday ?? '—';
  document.getElementById('upd').textContent = 'Updated: ' + new Date(d.lastUpdate || Date.now()).toLocaleTimeString();

  if (d.replies && d.replies.length) {
    document.getElementById('reply-sec').style.display = 'block';
    document.getElementById('reply-list').innerHTML = d.replies.slice(0,5).map(r =>
      '<div class="reply-item"><div class="reply-name">🎉 ' + (r.name||r.phone) + '</div>' +
      '<div class="reply-det">' + r.phone + ' · ' + (r.category||'') + ' · ' + (r.city||'') + '</div>' +
      '<a href="tel:' + r.phone + '" class="call-btn">📞 Call Now</a></div>'
    ).join('');
  }

  if (d.activity) {
    document.getElementById('act-list').innerHTML = d.activity.slice(0,20).map(a =>
      '<div class="act-row"><div class="dot ' + (a.replied?'replied':a.status) + '"></div>' +
      '<div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (a.name||a.phone) + '</div>' +
      '<div style="font-size:.68rem;color:#6b7280">' + (a.sentAt ? new Date(a.sentAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '') + '</div></div>'
    ).join('');
  }
}

function renderLeads() {
  if (!data) return;
  const l = data.leads || {};
  const a = data.activity || [];
  document.getElementById('leads-stats').innerHTML =
    '<div class="grid"><div class="card"><div class="lbl">Total</div><div class="val">' + (l.total||0) + '</div></div>' +
    '<div class="card"><div class="lbl">Unsent</div><div class="val b">' + (l.unsent||0) + '</div></div>' +
    '<div class="card"><div class="lbl">Sent</div><div class="val g">' + (l.sent||0) + '</div></div></div>';
  document.getElementById('leads-list').innerHTML = a.slice(0,50).map(a => {
    const st = a.replied ? 's-replied' : a.status === 'sent' ? 's-sent' : a.status === 'failed' ? 's-failed' : 's-pending';
    const sl = a.replied ? '🎉 Replied' : a.status === 'sent' ? '✅ Sent' : a.status === 'failed' ? '❌ Failed' : a.status;
    return '<div class="lead-item"><div style="display:flex;justify-content:space-between;align-items:start">' +
      '<div class="lead-name">' + (a.name||a.phone) + '</div>' +
      '<span class="status-badge ' + st + '">' + sl + '</span></div>' +
      '<div class="lead-det">' + (a.phone||'') + ' · ' + (a.city||'') + ' · ' + (a.category||'') + '</div></div>';
  }).join('') || '<p style="color:#6b7280;text-align:center;padding:20px">No leads yet</p>';
}

function renderReplies() {
  if (!data) return;
  const replies = data.replies || [];
  document.getElementById('replies-full').innerHTML = replies.length ? replies.map(r =>
    '<div class="sec"><div class="reply-name" style="font-size:1.1rem;margin-bottom:4px">🎉 ' + (r.name||r.phone) + '</div>' +
    '<div class="info-row"><span class="info-key">Phone</span><span class="info-val"><a href="tel:' + r.phone + '" style="color:#60a5fa">' + r.phone + '</a></span></div>' +
    '<div class="info-row"><span class="info-key">City</span><span class="info-val">' + (r.city||'—') + '</span></div>' +
    '<div class="info-row"><span class="info-key">Category</span><span class="info-val">' + (r.category||'—') + '</span></div>' +
    '<div class="info-row"><span class="info-key">Replied</span><span class="info-val">' + (r.repliedAt ? new Date(r.repliedAt).toLocaleString() : 'Yes') + '</span></div>' +
    '<a href="tel:' + r.phone + '" class="call-btn" style="display:inline-block;margin-top:4px;text-decoration:none">📞 Call Now</a>' +
    '<a href="https://wa.me/' + r.phone.replace('+','') + '" class="call-btn" style="background:#16a34a;display:inline-block;margin-top:4px;margin-left:8px;text-decoration:none">💬 WhatsApp</a>' +
    '</div>'
  ).join('') : '<div style="text-align:center;color:#6b7280;padding:40px"><div style="font-size:2rem;margin-bottom:8px">🎯</div><div>No replies yet — keep sending!</div></div>';
}

function renderControl() {
  if (!data) return;
  const procs = data.processes || [];
  if (procs.length) {
    document.getElementById('proc-list').innerHTML = procs.map(p =>
      '<div class="info-row"><span class="info-key">' + p.name + '</span>' +
      '<span class="info-val" style="color:' + (p.status==='online'?'#4ade80':'#f87171') + '">' + p.status + '</span></div>'
    ).join('');
  }
}

load();
setInterval(load, 30000);
</script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => console.log('MCF LEADAPP running on port ' + PORT));
