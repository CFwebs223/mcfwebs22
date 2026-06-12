#!/usr/bin/env node
/**
 * MCF LEADAPP — Permanent Mobile App
 * Deploy this to Render. URL never changes.
 * Mac pushes stats every 60s. App works from any phone anywhere.
 */

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { maxHttpBufferSize: 8e6, cors: { origin: '*' } });
const PORT         = process.env.PORT || 3003;
const SECRET       = process.env.RELAY_SECRET || 'mcf2026';
const APP_PASS     = process.env.APP_PASSWORD || 'Antigravity4321';
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER || '+17406854315';
const ALERT_TO     = process.env.REPORT_PHONE || '+27753203477';

// ── Watchdog: alert Christopher via SMS if Mac goes offline ──────────────────
let lastAlertSent = 0;
const MAC_OFFLINE_MS    = 10 * 60 * 1000;  // alert if no push in 10 min
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;  // max 1 alert per hour

function sendTwilioAlert(message) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return;
  const body = `From=${encodeURIComponent(TWILIO_FROM)}&To=${encodeURIComponent(ALERT_TO)}&Body=${encodeURIComponent(message)}`;
  const https = require('https');
  const req = https.request({
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'Content-Length': Buffer.byteLength(body),
    },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.write(body);
  req.end();
  console.log(`[Watchdog] Alert sent to ${ALERT_TO}: ${message.slice(0, 60)}`);
}

// Check every 3 minutes if Mac has gone silent
setInterval(() => {
  if (!lastUpdate) return;
  const silentMs = Date.now() - new Date(lastUpdate).getTime();
  const cooldownOk = (Date.now() - lastAlertSent) > ALERT_COOLDOWN_MS;
  if (silentMs > MAC_OFFLINE_MS && cooldownOk) {
    lastAlertSent = Date.now();
    const mins = Math.round(silentMs / 60000);
    sendTwilioAlert(`⚠️ MCF LEADAPP ALERT: Mac has been offline for ${mins} minutes. WhatsApp blasting is paused. Check your Mac. - LEADAPP Watchdog`);
  }
}, 3 * 60 * 1000);

// ── WAVE: persistent data ─────────────────────────────────────────────────────
const WAVE_DATA = '/tmp/wave-data.json';
let wdb = { users: {}, rooms: {} };
try { wdb = JSON.parse(fs.readFileSync(WAVE_DATA, 'utf8')); } catch {}
function waveSave() { try { fs.writeFileSync(WAVE_DATA, JSON.stringify(wdb)); } catch {} }
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(map) {
  let c;
  do { c = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''); }
  while (map[c]);
  return c;
}

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
  const allowed = ['run-engine','stop-engine','run-poster','run-scraper','run-calls','run-instagram','run-linkedin','run-wa-status','run-followups','run-report','restart-all','status'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'Unknown action' });
  const id = Date.now().toString();
  commandQueue.push({ id, action, queuedAt: new Date().toISOString() });
  res.json({ ok: true, id, message: `${action} queued — Mac will execute within 30s` });
});

// ── Mac reports a problem — relay sends SMS to Christopher ───────────────────
app.post('/alert', (req, res) => {
  if (req.headers['x-relay-secret'] !== SECRET) return res.status(401).end();
  const { alert } = req.body;
  if (alert) sendTwilioAlert(alert);
  res.json({ ok: true });
});

// ── Stats API ─────────────────────────────────────────────────────────────────
app.get('/stats', appAuth, (req, res) => {
  if (!latestStats) return res.json({ error: 'Mac offline or starting up' });
  res.json({ ...latestStats, lastUpdate });
});

app.get('/health', (req, res) => res.json({ ok: true, hasData: !!latestStats }));

app.get('/debug', appAuth, (req, res) => {
  res.json({
    hasData:    !!latestStats,
    lastUpdate,
    silentMs:   lastUpdate ? Date.now() - new Date(lastUpdate).getTime() : null,
    queueLen:   commandQueue.length,
    engine:     latestStats?.engine || null,
    processes:  latestStats?.processes?.map(p => `${p.name}:${p.status}`) || [],
  });
});

// ── Twilio cold call TwiML webhooks (permanent URL, no tunnel needed) ─────────
const CALL_FWD = process.env.CALL_FWD_NUMBER || '+27753203477'; // Christopher

app.post('/cold/answer', (req, res) => {
  res.setHeader('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="/cold/keypress" numDigits="1" timeout="8">
    <Say voice="Polly.Ayanda-Neural" language="en-ZA">
      Hi! This is a quick call from M C F Websites.
      We build professional websites for businesses like yours, starting from R 2500 once-off.
      No monthly fees. We build it first — you only pay if you love it.
      Press 1 to speak with Christopher now.
      Press 2 to receive details on WhatsApp.
      Press 3 to be removed from our list.
    </Say>
  </Gather>
  <Say voice="Polly.Ayanda-Neural" language="en-ZA">No problem! Have a great day.</Say>
</Response>`);
});

app.post('/cold/keypress', (req, res) => {
  const digit = req.body.Digits;
  res.setHeader('Content-Type', 'text/xml');
  if (digit === '1') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda-Neural" language="en-ZA">Connecting you now. One moment please.</Say>
  <Dial callerId="${CALL_FWD}">${CALL_FWD}</Dial>
</Response>`);
  } else if (digit === '2') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda-Neural" language="en-ZA">Perfect! We'll send you the details on WhatsApp now. Have a great day!</Say>
</Response>`);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda-Neural" language="en-ZA">No problem. You won't hear from us again. Have a wonderful day!</Say>
</Response>`);
  }
});

app.post('/cold/status', (req, res) => { res.sendStatus(204); });

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
html,body{height:100%;background:#080810;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden}
#app{height:100vh;display:flex;flex-direction:column}
.hdr{background:linear-gradient(135deg,#12122a 0%,#0d1a2e 100%);padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 14px;border-bottom:1px solid rgba(124,58,237,.25);flex-shrink:0}
.hdr-row{display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:1.2rem;font-weight:900;color:#fff;letter-spacing:-.02em}.hdr h1 span{color:#a78bfa}
.badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:100px;padding:5px 12px;font-size:.7rem;font-weight:600}
.pulse{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:pls 2s infinite;flex-shrink:0}
.pulse.off{background:#ef4444;animation:none}
@keyframes pls{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)}70%{box-shadow:0 0 0 7px rgba(74,222,128,0)}}
.content{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.tab-content{display:none;padding:14px 14px 100px}
.tab-content.active{display:block}
.nav{position:fixed;bottom:0;left:0;right:0;background:#0e0e1e;border-top:1px solid rgba(255,255,255,.07);display:flex;padding-bottom:env(safe-area-inset-bottom,0);z-index:100}
.nav-btn{flex:1;padding:10px 0 6px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;color:#4b5563;font-size:.6rem;font-weight:700;border:none;background:none;text-transform:uppercase;letter-spacing:.06em;transition:.15s}
.nav-btn.active{color:#a78bfa}
.nav-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:11px}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:11px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:13px 12px}
.lbl{font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:3px}
.val{font-size:2rem;font-weight:900;color:#fff;line-height:1.1}
.val.g{color:#4ade80}.val.y{color:#fbbf24}.val.b{color:#60a5fa}.val.r{color:#f87171}.val.p{color:#a78bfa}
.sub2{font-size:.62rem;color:#6b7280;margin-top:3px}
.sec{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px;margin-bottom:11px}
.sec-title{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:10px;font-weight:800;display:flex;align-items:center;gap:6px}
.alert-banner{background:linear-gradient(135deg,rgba(239,68,68,.15),rgba(239,68,68,.05));border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:12px;margin-bottom:11px;display:none}
.alert-txt{font-size:.82rem;font-weight:700;color:#fca5a5}
.alert-sub{font-size:.7rem;color:#f87171;margin-top:3px}
.reply-item{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.reply-item:last-child{border:none}
.reply-name{font-weight:800;color:#4ade80;font-size:.9rem}
.reply-det{font-size:.7rem;color:#6b7280;margin-top:2px}
.act-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.75rem}
.act-row:last-child{border:none}
.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dot.sent{background:#4ade80}.dot.failed{background:#f87171}.dot.replied{background:#fbbf24}
.btn{width:100%;padding:13px;border:none;border-radius:12px;font-size:.9rem;font-weight:800;cursor:pointer;margin-bottom:9px;display:flex;align-items:center;justify-content:center;gap:8px;transition:.15s;letter-spacing:.01em}
.btn:active{transform:scale(.98);opacity:.8}
.btn.green{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff}
.btn.red{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff}
.btn.purple{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff}
.btn.blue{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff}
.btn.orange{background:linear-gradient(135deg,#ea580c,#c2410c);color:#fff}
.btn.teal{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff}
.btn.gray{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#e0e0e0}
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px}
.btn-row .btn{margin-bottom:0}
.toast{position:fixed;top:calc(env(safe-area-inset-top,0px) + 16px);left:50%;transform:translateX(-50%);background:#1e1e35;border:1px solid rgba(124,58,237,.4);border-radius:10px;padding:10px 20px;font-size:.82rem;color:#fff;z-index:9999;opacity:0;transition:opacity .25s;white-space:nowrap;max-width:90vw}
.toast.show{opacity:1}
.upd{font-size:.6rem;color:#4b5563;text-align:center;padding:5px 0;margin-bottom:9px}
.lead-item{padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;margin-bottom:7px}
.lead-name{font-weight:700;font-size:.85rem;color:#fff}
.lead-det{font-size:.68rem;color:#6b7280;margin-top:2px}
.badge2{display:inline-block;padding:2px 8px;border-radius:100px;font-size:.6rem;font-weight:800}
.s-sent{background:rgba(74,222,128,.12);color:#4ade80}
.s-replied{background:rgba(251,191,36,.12);color:#fbbf24}
.s-failed{background:rgba(248,113,113,.12);color:#f87171}
.s-pending{background:rgba(96,165,250,.12);color:#60a5fa}
.call-btn{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.72rem;font-weight:800;cursor:pointer;margin-top:6px;text-decoration:none;display:inline-block}
.wa-btn{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:.72rem;font-weight:800;cursor:pointer;margin-top:6px;margin-left:6px;text-decoration:none;display:inline-block}
.sec-hdr{font-size:1rem;font-weight:900;color:#fff;margin-bottom:12px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.8rem}
.info-row:last-child{border:none}
.info-key{color:#6b7280;font-weight:500}
.info-val{color:#fff;font-weight:700;text-align:right}
.proc-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.75rem}
.proc-row:last-child{border:none}
.proc-name{color:#9ca3af;font-size:.72rem}
.proc-online{color:#4ade80;font-weight:700;font-size:.7rem}
.proc-stopped{color:#f87171;font-weight:700;font-size:.7rem}
.install-bar{background:linear-gradient(135deg,rgba(124,58,237,.3),rgba(79,70,229,.3));border:1px solid rgba(124,58,237,.4);border-radius:14px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}
.consulting-item{padding:10px 12px;background:rgba(167,139,250,.05);border:1px solid rgba(167,139,250,.15);border-radius:10px;margin-bottom:7px}
.consulting-name{font-weight:700;color:#a78bfa;font-size:.85rem}
.tab-badge{background:#ef4444;border-radius:50%;width:14px;height:14px;font-size:.55rem;font-weight:900;color:#fff;display:inline-flex;align-items:center;justify-content:center;margin-left:2px;position:relative;top:-1px}
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

    <!-- ── HOME TAB ─────────────────────────────────────────────── -->
    <div class="tab-content active" id="tab-home">
      <div class="install-bar" onclick="installApp()" id="install-bar" style="display:none">
        <div><div style="font-size:.82rem;font-weight:700;color:#fff">Add to Home Screen</div><div style="font-size:.65rem;color:#c4b5fd;margin-top:2px">Install as app for fast access</div></div>
        <div style="font-size:1.4rem">📱</div>
      </div>
      <div id="alert-box" class="alert-banner">
        <div class="alert-txt" id="alert-txt"></div>
        <div class="alert-sub" id="alert-sub"></div>
      </div>
      <div class="upd" id="upd">Connecting...</div>
      <div class="g3">
        <div class="card"><div class="lbl">Sent Today</div><div class="val g" id="st">—</div></div>
        <div class="card"><div class="lbl">Replies</div><div class="val y" id="rep">—</div><div class="sub2" id="rept"></div></div>
        <div class="card"><div class="lbl">Converted</div><div class="val p" id="conv">—</div></div>
      </div>
      <div class="g3">
        <div class="card"><div class="lbl">Total Sent</div><div class="val b" id="ts">—</div></div>
        <div class="card"><div class="lbl">Leads Left</div><div class="val" id="uns">—</div><div class="sub2" id="tot"></div></div>
        <div class="card"><div class="lbl">Groups</div><div class="val b" id="grp">—</div><div class="sub2">today</div></div>
      </div>
      <div class="g3">
        <div class="card"><div class="lbl">Follow-ups</div><div class="val" id="fu1">—</div><div class="sub2" id="fu1b"></div></div>
        <div class="card"><div class="lbl">FU3 Sent</div><div class="val" id="fu3">—</div></div>
        <div class="card"><div class="lbl">Calls</div><div class="val" id="calls">—</div><div class="sub2">today</div></div>
      </div>
      <div class="sec" id="hot-sec" style="display:none">
        <div class="sec-title">🔥 HOT LEADS — Call These Now!</div>
        <div id="hot-list"></div>
      </div>
      <div class="sec">
        <div class="sec-title">📋 Recent Activity</div>
        <div id="act-list"><div style="color:#4b5563;font-size:.8rem;text-align:center;padding:20px">No activity yet</div></div>
      </div>
    </div>

    <!-- ── REPLIES TAB ──────────────────────────────────────────── -->
    <div class="tab-content" id="tab-replies">
      <div class="sec-hdr">🎉 Replies — Call Them Now</div>
      <div id="replies-full"><div style="text-align:center;color:#6b7280;padding:40px"><div style="font-size:2.5rem;margin-bottom:8px">💬</div><div>No replies yet. Keep blasting!</div></div></div>
    </div>

    <!-- ── LEADS TAB ────────────────────────────────────────────── -->
    <div class="tab-content" id="tab-leads">
      <div class="sec-hdr">Leads Database</div>
      <div id="leads-stats" style="margin-bottom:12px"></div>
      <div id="leads-list"></div>
    </div>

    <!-- ── CONSULTING TAB ───────────────────────────────────────── -->
    <div class="tab-content" id="tab-consulting">
      <div class="sec-hdr">📈 Growth Consulting</div>
      <div class="sec">
        <div class="sec-title">Services We Offer</div>
        <div class="info-row"><span class="info-key">Strategy Session</span><span class="info-val" style="color:#a78bfa">R1,500</span></div>
        <div class="info-row"><span class="info-key">Growth Package</span><span class="info-val" style="color:#a78bfa">R4,500/mo</span></div>
        <div class="info-row"><span class="info-key">Full Partnership</span><span class="info-val" style="color:#a78bfa">R8,000/mo</span></div>
      </div>
      <div class="sec">
        <div class="sec-title">What's Included</div>
        <div style="font-size:.82rem;color:#9ca3af;line-height:1.7">
          ✅ Business audit — find where money is being lost<br>
          ✅ 90-day growth roadmap<br>
          ✅ Marketing strategy (WhatsApp, social, SEO)<br>
          ✅ Sales scripts + lead conversion system<br>
          ✅ Monthly accountability calls<br>
          ✅ Hands-on implementation support
        </div>
      </div>
      <div class="sec">
        <div class="sec-title">Quick Actions</div>
        <button class="btn purple" onclick="cmd('run-engine')">📲 Blast Consulting Offer via WhatsApp</button>
        <a href="https://mcfwebs.agency/consulting" target="_blank" class="btn blue" style="text-decoration:none">🌐 View Consulting Page</a>
        <a href="tel:0753203477" class="btn green" style="text-decoration:none">📞 Call Christopher</a>
      </div>
      <div class="sec">
        <div class="sec-title">Consulting Leads</div>
        <div id="consulting-leads"><div style="color:#6b7280;font-size:.82rem;text-align:center;padding:20px">Consulting leads will appear here when people reply to your consulting outreach</div></div>
      </div>
    </div>

    <!-- ── CONTROL TAB ──────────────────────────────────────────── -->
    <div class="tab-content" id="tab-control">
      <div class="sec-hdr">System Control</div>
      <div class="sec">
        <div class="sec-title">WhatsApp Engine</div>
        <div class="btn-row">
          <button class="btn green" onclick="cmd('run-engine')">▶️ Blast Now</button>
          <button class="btn red" onclick="cmd('stop-engine')">⏹ Stop</button>
        </div>
        <button class="btn gray" onclick="cmd('run-followups')">🔄 Run Follow-ups</button>
      </div>
      <div class="sec">
        <div class="sec-title">Social & Marketing</div>
        <button class="btn purple" onclick="cmd('run-poster')">📢 Post Facebook Groups</button>
        <div class="btn-row">
          <button class="btn purple" onclick="cmd('run-instagram')">📸 Instagram</button>
          <button class="btn green" onclick="cmd('run-wa-status')">📱 WA Status</button>
        </div>
      </div>
      <div class="sec">
        <div class="sec-title">Lead Generation</div>
        <div class="btn-row">
          <button class="btn blue" onclick="cmd('run-scraper')">🔍 Scrape Leads</button>
          <button class="btn orange" onclick="cmd('run-calls')">📞 Cold Calls</button>
        </div>
        <button class="btn teal" onclick="cmd('run-report')">📊 Send Report</button>
      </div>
      <div class="sec">
        <div class="sec-title">Process Status</div>
        <div id="proc-list"><div style="color:#6b7280;font-size:.75rem">Loading...</div></div>
      </div>
      <div class="sec">
        <div class="sec-title">Quick Links</div>
        <div class="info-row"><span class="info-key">Christopher</span><span class="info-val"><a href="tel:0753203477" style="color:#60a5fa">075 320 3477</a></span></div>
        <div class="info-row"><span class="info-key">KV</span><span class="info-val"><a href="tel:0615442591" style="color:#60a5fa">061 544 2591</a></span></div>
        <div class="info-row"><span class="info-key">Website</span><span class="info-val"><a href="https://mcfwebs.agency" style="color:#60a5fa">mcfwebs.agency</a></span></div>
        <div class="info-row"><span class="info-key">Music App</span><span class="info-val"><a href="/music" style="color:#b060ff">Open →</a></span></div>
        <div class="info-row"><span class="info-key">WAVE</span><span class="info-val"><a href="/wave" style="color:#60a5fa">Open →</a></span></div>
      </div>
      <button class="btn red" onclick="cmd('restart-all')" style="margin-top:4px">🔄 Restart All Processes</button>
    </div>
  </div>

  <nav class="nav">
    <button class="nav-btn active" onclick="showTab('home',this)">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Home
    </button>
    <button class="nav-btn" onclick="showTab('replies',this)" id="nav-replies">
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Replies
    </button>
    <button class="nav-btn" onclick="showTab('leads',this)">
      <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Leads
    </button>
    <button class="nav-btn" onclick="showTab('consulting',this)">
      <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Consult
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
let data = null;
let replyCount = 0;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
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
  if (name === 'consulting') renderConsulting();
}

function toast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.borderColor = ok ? '#4ade80' : '#f87171';
  el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3000);
}

async function cmd(action) {
  toast('Sending: ' + action + '...', true);
  try {
    const r = await fetch('/command?token=' + TOKEN, { method:'POST', headers:{'Content-Type':'application/json','x-app-token':TOKEN}, body: JSON.stringify({ action }) });
    const d = await r.json();
    toast(d.message || '✅ Done!', true);
  } catch { toast('❌ Failed to send command', false); }
}

async function load() {
  try {
    const r = await fetch('/stats?token=' + TOKEN, { headers: { 'x-app-token': TOKEN } });
    if (r.status === 401) { window.location.href = '/'; return; }
    data = await r.json();
    if (data.error) {
      document.getElementById('dot').className = 'pulse off';
      document.getElementById('btext').textContent = '⚠️ Mac offline';
      return;
    }
    render(data);
  } catch { document.getElementById('btext').textContent = 'Connection error'; }
}

function render(d) {
  const e = d.engine || {}, l = d.leads || {}, g = d.groups || {};
  const isBlasting = e.running === 'blasting';
  document.getElementById('dot').className = 'pulse' + (isBlasting ? '' : ' off');
  document.getElementById('btext').textContent = isBlasting ? '🔥 Blasting now' : '✅ Online';

  document.getElementById('st').textContent   = e.sentToday ?? '—';
  document.getElementById('rep').textContent  = e.replied ?? '—';
  document.getElementById('rept').textContent = 'today: ' + (e.repliedToday ?? '—');
  document.getElementById('conv').textContent = e.converted ?? '—';
  document.getElementById('fu1').textContent  = e.fu1 ?? '—';
  document.getElementById('fu1b').textContent = 'FU2: ' + (e.fu2 ?? '—');
  document.getElementById('fu3').textContent  = e.fu3 ?? '—';
  document.getElementById('ts').textContent   = e.totalSent ?? '—';
  document.getElementById('uns').textContent  = l.unsent ?? '—';
  document.getElementById('tot').textContent  = 'of ' + (l.total ?? '?');
  document.getElementById('grp').textContent  = g.postedToday ?? '—';
  document.getElementById('calls').textContent = d.calls?.today ?? '—';
  document.getElementById('upd').textContent  = '⟳ ' + new Date(d.lastUpdate || Date.now()).toLocaleTimeString();

  // Alert banner for issues
  const procs = d.processes || [];
  const broken = procs.filter(p => p.status !== 'online' && ['mcf-engine','mcf-pusher','mcf-receptionist'].includes(p.name));
  if (broken.length) {
    document.getElementById('alert-box').style.display = 'block';
    document.getElementById('alert-txt').textContent = '⚠️ ' + broken.length + ' critical process(es) stopped';
    document.getElementById('alert-sub').textContent = broken.map(p => p.name).join(', ');
  } else {
    document.getElementById('alert-box').style.display = 'none';
  }

  // Hot leads
  const hotLeads = d.hotLeads || [];
  if (hotLeads.length) {
    document.getElementById('hot-sec').style.display = 'block';
    document.getElementById('hot-list').innerHTML = hotLeads.map(r =>
      '<div class="reply-item"><div class="reply-name">🔥 ' + (r.name||r.phone) + '</div>' +
      '<div class="reply-det">' + r.phone + ' · ' + (r.category||'') + ' · ' + (r.city||'') + '</div>' +
      '<a href="tel:' + r.phone + '" class="call-btn">📞 Call</a>' +
      '<a href="https://wa.me/' + r.phone.replace('+','') + '" class="call-btn" style="margin-left:5px">💬 WA</a></div>'
    ).join('');
  }

  // Reply count badge
  const newReplies = (d.replies||[]).length;
  const navReplies = document.getElementById('nav-replies');
  if (newReplies > 0) {
    navReplies.innerHTML = navReplies.innerHTML.replace(/<span class="tab-badge">.*?<\/span>/,'') + '<span class="tab-badge">' + newReplies + '</span>';
  }

  // Activity
  if (d.activity && d.activity.length) {
    document.getElementById('act-list').innerHTML = d.activity.slice(0,25).map(a =>
      '<div class="act-row"><div class="dot ' + (a.replied?'replied':a.status||'sent') + '"></div>' +
      '<div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem">' + (a.name||a.phone) + '</div>' +
      '<div style="font-size:.63rem;color:#6b7280;flex-shrink:0">' + (a.sentAt ? new Date(a.sentAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '') + '</div></div>'
    ).join('');
  }
}

function renderReplies() {
  if (!data) return;
  const replies = data.replies || [];
  document.getElementById('replies-full').innerHTML = replies.length ? replies.map(r =>
    '<div class="sec" style="margin-bottom:10px">' +
    '<div class="reply-name" style="font-size:1rem;margin-bottom:8px">🎉 ' + (r.name||r.phone) + '</div>' +
    '<div class="info-row"><span class="info-key">Phone</span><span class="info-val"><a href="tel:' + r.phone + '" style="color:#60a5fa">' + r.phone + '</a></span></div>' +
    '<div class="info-row"><span class="info-key">City</span><span class="info-val">' + (r.city||'—') + '</span></div>' +
    '<div class="info-row"><span class="info-key">Business</span><span class="info-val">' + (r.category||'—') + '</span></div>' +
    '<div class="info-row"><span class="info-key">Replied</span><span class="info-val" style="color:#fbbf24">' + (r.repliedAt ? new Date(r.repliedAt).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Yes') + '</span></div>' +
    '<div style="margin-top:8px"><a href="tel:' + r.phone + '" class="call-btn">📞 Call</a>' +
    '<a href="https://wa.me/' + r.phone.replace('+','') + '" class="wa-btn">💬 WhatsApp</a></div></div>'
  ).join('') : '<div style="text-align:center;color:#6b7280;padding:40px"><div style="font-size:2.5rem;margin-bottom:8px">🎯</div><div>No replies yet — keep sending!</div></div>';
}

function renderLeads() {
  if (!data) return;
  const l = data.leads || {}, a = data.activity || [];
  document.getElementById('leads-stats').innerHTML =
    '<div class="g3">' +
    '<div class="card"><div class="lbl">Total</div><div class="val">' + (l.total||0) + '</div></div>' +
    '<div class="card"><div class="lbl">Unsent</div><div class="val b">' + (l.unsent||0) + '</div></div>' +
    '<div class="card"><div class="lbl">Sent</div><div class="val g">' + (l.sent||0) + '</div></div></div>';
  document.getElementById('leads-list').innerHTML = a.slice(0,80).map(a => {
    const st = a.replied?'s-replied':a.status==='sent'?'s-sent':a.status==='failed'?'s-failed':'s-pending';
    const sl = a.replied?'🎉 Replied':a.status==='sent'?'✅ Sent':a.status==='failed'?'❌ Failed':a.status||'Pending';
    return '<div class="lead-item"><div style="display:flex;justify-content:space-between;align-items:start;gap:6px">' +
      '<div class="lead-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (a.name||a.phone) + '</div>' +
      '<span class="badge2 ' + st + '" style="flex-shrink:0">' + sl + '</span></div>' +
      '<div class="lead-det">' + (a.phone||'') + (a.city?' · '+a.city:'') + (a.category?' · '+a.category:'') + '</div></div>';
  }).join('') || '<p style="color:#6b7280;text-align:center;padding:20px">No leads yet</p>';
}

function renderConsulting() {
  if (!data) return;
  const replies = (data.replies || []).filter(r => r.category && ['lawyer','attorney','accountant','mechanic','estate','physio','doctor'].some(c => (r.category||'').toLowerCase().includes(c)));
  document.getElementById('consulting-leads').innerHTML = replies.length ?
    replies.map(r => '<div class="consulting-item"><div class="consulting-name">📈 ' + (r.name||r.phone) + '</div>' +
      '<div class="lead-det">' + (r.phone||'') + ' · ' + (r.city||'') + ' · ' + (r.category||'') + '</div>' +
      '<a href="tel:' + r.phone + '" class="call-btn" style="margin-top:6px">📞 Pitch Consulting</a></div>').join('') :
    '<div style="color:#6b7280;font-size:.82rem;text-align:center;padding:20px">No consulting leads yet</div>';
}

function renderControl() {
  if (!data) return;
  const procs = data.processes || [];
  if (procs.length) {
    document.getElementById('proc-list').innerHTML = procs.map(p =>
      '<div class="proc-row"><span class="proc-name">' + p.name.replace('mcf-','') + '</span>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:.65rem;color:#4b5563">' + p.restarts + 'r</span>' +
      '<span class="' + (p.status==='online'?'proc-online':'proc-stopped') + '">' + (p.status==='online'?'● online':'● stopped') + '</span></div></div>'
    ).join('');
  }
}

load();
setInterval(load, 25000);
</script>
</body>
</html>`);
});

// ── WAVE: REST API ────────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { name, code } = req.body;
  if (code && wdb.users[code]) return res.json(wdb.users[code]);
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const u = { name: name.trim(), code: genCode(wdb.users), avatar: name.trim()[0].toUpperCase(), createdAt: Date.now() };
  wdb.users[u.code] = u;
  waveSave();
  res.json(u);
});

app.get('/api/lookup/:code', (req, res) => {
  const c = req.params.code.toUpperCase();
  if (wdb.users[c]) return res.json({ type: 'user', ...wdb.users[c] });
  if (wdb.rooms[c]) return res.json({ type: 'room', ...wdb.rooms[c], memberCount: wdb.rooms[c].members.length });
  res.status(404).json({ error: 'Not found' });
});

// ── WAVE: frontend ────────────────────────────────────────────────────────────
const WAVE_HTML = path.join(__dirname, 'wave.html');
app.get('/wave', (req, res) => res.sendFile(WAVE_HTML));
app.get('/wave/', (req, res) => res.sendFile(WAVE_HTML));

// ── WAVE: Socket.io ───────────────────────────────────────────────────────────
const waveOnline = {};

io.on('connection', (sock) => {
  let me = null;
  const myRooms = new Set();

  sock.on('auth', ({ code }) => {
    const user = wdb.users[code];
    if (!user) return sock.emit('error', 'Unknown code — please re-register');
    me = user;
    waveOnline[code] = sock.id;
    for (const [rc, room] of Object.entries(wdb.rooms)) {
      if (room.members.includes(code)) { sock.join(rc); myRooms.add(rc); }
    }
    const myRoomList = [...myRooms].map(rc => {
      const r = wdb.rooms[rc];
      return { ...r, messages: r.messages.slice(-60), memberDetails: r.members.map(c => wdb.users[c]).filter(Boolean) };
    });
    sock.emit('authed', { user, rooms: myRoomList });
    for (const rc of myRooms) sock.to(rc).emit('presence', { code, online: true });
  });

  sock.on('join', ({ code: target, roomName, create }) => {
    if (!me) return;
    target = (target || '').trim().toUpperCase();
    const emitJoined = (room) => {
      sock.join(room.code); myRooms.add(room.code);
      const memberDetails = room.members.map(c => wdb.users[c]).filter(Boolean);
      sock.emit('room-joined', { ...room, messages: room.messages.slice(-60), memberDetails });
    };
    if (target && wdb.users[target] && target !== me.code) {
      const dmCode = [me.code, target].sort().join('_');
      if (!wdb.rooms[dmCode]) { wdb.rooms[dmCode] = { code: dmCode, type: 'dm', members: [me.code, target], messages: [] }; waveSave(); }
      const room = wdb.rooms[dmCode];
      if (!room.members.includes(me.code)) { room.members.push(me.code); waveSave(); }
      emitJoined(room);
      const otherSock = waveOnline[target];
      if (otherSock) {
        const memberDetails = room.members.map(c => wdb.users[c]).filter(Boolean);
        io.to(otherSock).emit('room-joined', { ...room, messages: room.messages.slice(-60), memberDetails });
      }
      return;
    }
    if (target && wdb.rooms[target]) {
      const room = wdb.rooms[target];
      if (!room.members.includes(me.code)) { room.members.push(me.code); waveSave(); }
      emitJoined(room);
      const sys = { id: crypto.randomUUID(), type: 'sys', text: `${me.name} joined the room`, at: Date.now() };
      room.messages.push(sys); waveSave();
      sock.to(room.code).emit('sys', { roomCode: room.code, msg: sys });
      return;
    }
    if (create) {
      const rc = genCode(wdb.rooms);
      const room = { code: rc, type: 'group', name: (roomName || 'New Room').trim(), members: [me.code], messages: [] };
      wdb.rooms[rc] = room; waveSave();
      emitJoined(room);
      return;
    }
    sock.emit('join-error', target ? `"${target}" not found — check the code` : 'Enter a code or create a room');
  });

  sock.on('msg', ({ roomCode, text }) => {
    if (!me || !text?.trim()) return;
    const room = wdb.rooms[roomCode];
    if (!room?.members.includes(me.code)) return;
    const m = { id: crypto.randomUUID(), type: 'text', from: me.code, name: me.name, avatar: me.avatar, text: text.trim(), at: Date.now() };
    room.messages.push(m);
    if (room.messages.length > 400) room.messages = room.messages.slice(-400);
    waveSave();
    io.to(roomCode).emit('msg', { roomCode, msg: m });
  });

  sock.on('voice', ({ roomCode, audio, mimeType, duration }) => {
    if (!me || !audio) return;
    const room = wdb.rooms[roomCode];
    if (!room?.members.includes(me.code)) return;
    const m = { id: crypto.randomUUID(), type: 'voice', from: me.code, name: me.name, avatar: me.avatar, audio, mimeType: mimeType || 'audio/webm', duration: duration || 0, at: Date.now() };
    room.messages.push(m);
    if (room.messages.length > 400) room.messages = room.messages.slice(-400);
    waveSave();
    io.to(roomCode).emit('msg', { roomCode, msg: m });
  });

  sock.on('typing',    ({ roomCode, on })   => { if (me) sock.to(roomCode).emit('typing', { code: me.code, name: me.name, on }); });
  sock.on('ptt-start', ({ roomCode })       => { if (me) sock.to(roomCode).emit('ptt-start', { code: me.code, name: me.name, roomCode }); });
  sock.on('ptt-end',   ({ roomCode })       => { if (me) sock.to(roomCode).emit('ptt-end', { code: me.code, roomCode }); });

  sock.on('disconnect', () => {
    if (!me) return;
    delete waveOnline[me.code];
    for (const rc of myRooms) sock.to(rc).emit('presence', { code: me.code, online: false });
  });
});

// ── Music Drop app ────────────────────────────────────────────────────────────
const musicRouter = require('./music');
app.use('/music', musicRouter);

httpServer.listen(PORT, '0.0.0.0', () => console.log('MCF LEADAPP + WAVE + MUSIC running on port ' + PORT));
