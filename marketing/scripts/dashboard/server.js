#!/usr/bin/env node
/**
 * MCF Control Dashboard — port 4000
 * Access from phone: http://YOUR-MAC-IP:4000
 * Access remotely: use Tailscale or ngrok
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { execSync, spawn } = require('child_process');

const app  = express();
const PORT = process.env.DASH_PORT || 4000;

const LEADS_FILE    = path.join(__dirname, '../../leads/leads-SA-US-no-website-2026-05-31.md');
const TRACKER_FILE  = path.join(__dirname, '../../leads/engine-tracker.json');
const ENGINE_DIR    = path.join(__dirname, '../engine');
const LOCK_FILE     = path.join(__dirname, '../../../leads/engine.lock');
const GROUP_LOG     = path.join(__dirname, '../../leads/group-poster.log');
const SCRAPER_LOG   = path.join(__dirname, '../../leads/auto-scraper.log');
const GROUP_TRACKER = path.join(__dirname, '../../leads/group-tracker.json');
const TUNNEL_LOG    = path.join(__dirname, '../../leads/tunnel.log');

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_PHONE || process.env.TWILIO_PHONE_NUMBER;
const CALL_FWD_TO  = '+27753203477'; // Christopher

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Stats API ──────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  try {
    const tracker = fs.existsSync(TRACKER_FILE)
      ? JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'))
      : {};

    const vals       = Object.values(tracker);
    const today      = new Date().toISOString().slice(0, 10);
    const sentToday  = vals.filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
    const totalSent  = vals.filter(v => v.status === 'sent').length;
    const failed     = vals.filter(v => v.status === 'failed').length;
    const replied    = vals.filter(v => v.replied).length;
    const fu1        = vals.filter(v => v.followUp1Sent).length;
    const fu2        = vals.filter(v => v.followUp2Sent).length;
    const engineRunning = fs.existsSync(LOCK_FILE);

    // Lead counts
    let totalLeads = 0;
    if (fs.existsSync(LEADS_FILE)) {
      totalLeads = fs.readFileSync(LEADS_FILE, 'utf8')
        .split('\n')
        .filter(l => /^\|\s*[^-]/.test(l) && !l.includes('Business') && !l.includes('Phone')).length;
    }
    const unsent = totalLeads - totalSent - failed;

    // Recent replies
    const replies = Object.entries(tracker)
      .filter(([, v]) => v.replied)
      .map(([phone, v]) => ({ phone, name: v.name, repliedAt: v.repliedAt, city: v.city, category: v.category }))
      .sort((a, b) => new Date(b.repliedAt) - new Date(a.repliedAt))
      .slice(0, 10);

    // Groups posted today
    const groupTracker = fs.existsSync(GROUP_TRACKER)
      ? JSON.parse(fs.readFileSync(GROUP_TRACKER, 'utf8'))
      : {};
    const groupsToday = Object.values(groupTracker).filter(v => v.lastPosted?.startsWith(today)).length;

    res.json({
      engine: { running: engineRunning, sentToday, totalSent, failed, replied, fu1, fu2 },
      leads:  { total: totalLeads, unsent: Math.max(0, unsent), sent: totalSent, failed },
      groups: { postedToday: groupsToday },
      replies,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Recent activity ────────────────────────────────────────────────────────────
app.get('/api/activity', (req, res) => {
  try {
    const tracker = fs.existsSync(TRACKER_FILE)
      ? JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'))
      : {};

    const activity = Object.entries(tracker)
      .map(([phone, v]) => ({ phone, ...v }))
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
      .slice(0, 50);

    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Engine logs ───────────────────────────────────────────────────────────────
app.get('/api/logs/:type', (req, res) => {
  const files = {
    engine:  path.join(__dirname, '../../../leads/engine.log'),
    groups:  GROUP_LOG,
    scraper: SCRAPER_LOG,
  };
  const f = files[req.params.type];
  if (!f || !fs.existsSync(f)) return res.json({ lines: [] });

  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-100);
  res.json({ lines });
});

// ── Engine control ────────────────────────────────────────────────────────────
app.post('/api/engine/run-now', (req, res) => {
  try {
    const proc = spawn('node', [path.join(ENGINE_DIR, 'index.js'), '--now'], {
      detached: true, stdio: 'ignore',
      cwd: path.join(ENGINE_DIR, '../..'),
    });
    proc.unref();
    res.json({ ok: true, message: 'Engine started — sending now' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/engine/stop', (req, res) => {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch {}
      fs.unlinkSync(LOCK_FILE);
    }
    res.json({ ok: true, message: 'Engine stopped' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/poster/run-now', (req, res) => {
  try {
    const proc = spawn('node', [path.join(__dirname, '../group-poster.js')], {
      detached: true, stdio: 'ignore',
      cwd: path.join(__dirname, '../..'),
    });
    proc.unref();
    res.json({ ok: true, message: 'Group poster started' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/scraper/run-now', (req, res) => {
  try {
    const proc = spawn('node', [path.join(__dirname, '../auto-scraper.js')], {
      detached: true, stdio: 'ignore',
      cwd: path.join(__dirname, '../..'),
    });
    proc.unref();
    res.json({ ok: true, message: 'Scraper started' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Current tunnel URL ─────────────────────────────────────────────────────────
app.get('/api/tunnel-url', (req, res) => {
  try {
    if (!fs.existsSync(TUNNEL_LOG)) return res.json({ url: null });
    const lines = fs.readFileSync(TUNNEL_LOG, 'utf8').split('\n').filter(Boolean).reverse();
    const line  = lines.find(l => l.includes('lhr.life'));
    const match = line?.match(/https?:\/\/[a-z0-9\-]+\.lhr\.life/);
    res.json({ url: match ? match[0] : null });
  } catch { res.json({ url: null }); }
});

// ── Cold Call TwiML (Twilio posts here during outbound calls) ──────────────────
app.post('/cold/answer', (req, res) => {
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/cold/keypress" method="POST" timeout="8">
    <Say voice="Polly.Ayanda" language="en-ZA">
      Hello! Quick message from M C F Websites.
      I noticed your business doesn't have a website yet.
      Every day without one, customers are finding your competitors instead of you.
      We build professional websites starting from just 2500 rand, with no payment until you are completely happy.
      Press 1 to speak with Christopher directly.
      Press 2 to receive our details on WhatsApp.
      Press 3 to be removed from our list.
    </Say>
  </Gather>
  <Say voice="Polly.Ayanda" language="en-ZA">We didn't receive your input. Goodbye, and have a great day!</Say>
</Response>`);
});

app.post('/cold/keypress', (req, res) => {
  const digit  = req.body.Digits;
  const caller = req.body.To || req.body.Called || '';
  console.log(`📞 Cold call keypress ${digit} from ${caller}`);
  res.type('text/xml');

  if (digit === '1') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">Please hold, connecting you to Christopher now.</Say>
  <Dial callerId="${TWILIO_FROM}" timeout="30"><Number>${CALL_FWD_TO}</Number></Dial>
</Response>`);
  } else if (digit === '2') {
    if (caller) sendWhatsAppToLead(caller).catch(() => {});
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">
    Perfect! We have sent our details to your WhatsApp right now.
    Look out for a message from M C F Websites. Have a great day!
  </Say>
</Response>`);
  } else if (digit === '3') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">No problem, you have been removed. Have a great day!</Say>
</Response>`);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">Invalid option. Goodbye!</Say>
</Response>`);
  }
});

app.post('/cold/status', (req, res) => {
  const { To, CallStatus, CallDuration } = req.body;
  console.log(`📊 Cold call ${To} — ${CallStatus} (${CallDuration || 0}s)`);
  res.sendStatus(200);
});

async function sendWhatsAppToLead(toNumber) {
  try {
    const twilio = require('twilio')(TWILIO_SID, TWILIO_AUTH);
    let to = toNumber.replace(/\D/g, '');
    if (!to.startsWith('+')) to = '+' + to;
    await twilio.messages.create({
      from: 'whatsapp:+14155238886',
      to:   `whatsapp:${to}`,
      body: `Hi! You just requested our details via our call.\n\n*MCF WEBSITES*\n_Professional Web Design_\n\n✅ We build first — you pay only if you love it\n✅ From R2,500 once-off, no monthly fees\n\n📞 075 320 3477\n🌐 https://www.mcfwebs.agency\n\nReply YES to get started!`,
    });
    console.log(`📱 WhatsApp sent to ${to}`);
  } catch (err) {
    console.error(`❌ Cold call WhatsApp failed: ${err.message}`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📊 MCF Dashboard: http://localhost:${PORT}`);
  // Print local network IP for phone access
  try {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`   Phone access: http://${iface.address}:${PORT}\n`);
        }
      }
    }
  } catch {}
});
