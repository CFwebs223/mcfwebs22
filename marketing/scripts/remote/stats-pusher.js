#!/usr/bin/env node
/**
 * MCF Stats Pusher — runs locally on Mac via PM2
 * Pushes engine stats to Render relay every 60s
 * Polls /pending-command every 30s and executes PM2 commands
 */

const fs     = require('fs');
const path   = require('path');
const http   = require('https');
const { execFile } = require('child_process');

const PM2 = process.env.PM2_BIN || '/Users/mcfwebs/.npm-global/bin/pm2';

const TRACKER_FILE   = path.join(__dirname, '../../leads/engine-tracker.json');
const LEADS_FILE     = path.join(__dirname, '../../leads/leads-SA-US-no-website-2026-05-31.md');
const GROUP_TRACKER  = path.join(__dirname, '../../leads/group-tracker.json');
const CALL_TRACKER   = path.join(__dirname, '../../leads/call-tracker.json');
const REPORT_FILE    = path.join(__dirname, '../../leads/last-report.json');
const LOCK_FILE      = path.join(__dirname, '../../../leads/engine.lock');
const TUNNEL_LOG     = path.join(__dirname, '../../leads/tunnel.log');

function getTunnelUrl() {
  try {
    const lines = fs.readFileSync(TUNNEL_LOG, 'utf8').split('\n').filter(Boolean).reverse();
    const line  = lines.find(l => l.includes('lhr.life'));
    const match = line?.match(/https?:\/\/[a-z0-9\-]+\.lhr\.life/);
    return match ? match[0] : null;
  } catch { return null; }
}

// ── Render URL — update this after deploying relay-server.js ──────────────────
const RELAY_URL    = process.env.RELAY_URL    || 'https://mcf-stats-relay.onrender.com';
const RELAY_SECRET = process.env.RELAY_SECRET || 'mcf2026';

function buildStats() {
  const tracker = fs.existsSync(TRACKER_FILE)
    ? JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'))
    : {};

  const vals      = Object.values(tracker);
  const today     = new Date().toISOString().slice(0, 10);
  const sentToday = vals.filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;

  let totalLeads = 0;
  if (fs.existsSync(LEADS_FILE)) {
    totalLeads = fs.readFileSync(LEADS_FILE, 'utf8')
      .split('\n')
      .filter(l => /^\|\s*[^-]/.test(l) && !l.includes('Business') && !l.includes('Phone')).length;
  }

  const totalSent     = vals.filter(v => v.status === 'sent').length;
  const failed        = vals.filter(v => v.status === 'failed').length;
  const replied       = vals.filter(v => v.replied).length;
  const repliedToday  = vals.filter(v => v.repliedAt?.startsWith(today)).length;
  const converted     = vals.filter(v => v.converted).length;
  const fu1           = vals.filter(v => v.followUp1Sent).length;
  const fu2           = vals.filter(v => v.followUp2Sent).length;
  const fu3           = vals.filter(v => v.followUp3Sent).length;
  const unsent        = Math.max(0, totalLeads - totalSent - failed);
  const running       = fs.existsSync(LOCK_FILE) ? 'blasting' : 'standby';

  const groupTracker = fs.existsSync(GROUP_TRACKER)
    ? JSON.parse(fs.readFileSync(GROUP_TRACKER, 'utf8')) : {};
  const groupsToday  = Object.values(groupTracker).filter(v => v.lastPosted?.startsWith(today)).length;

  const callTracker  = fs.existsSync(CALL_TRACKER)
    ? JSON.parse(fs.readFileSync(CALL_TRACKER, 'utf8')) : {};
  const callsToday   = Object.values(callTracker).filter(v => v.calledAt?.startsWith(today)).length;

  const replies = Object.entries(tracker)
    .filter(([, v]) => v.replied)
    .map(([phone, v]) => ({ phone, name: v.name, repliedAt: v.repliedAt, city: v.city, category: v.category, converted: v.converted }))
    .sort((a, b) => new Date(b.repliedAt) - new Date(a.repliedAt))
    .slice(0, 20);

  const activity = Object.entries(tracker)
    .map(([phone, v]) => ({ phone, ...v }))
    .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
    .slice(0, 50);

  // Get hot leads (replied, not converted)
  const hotLeads = Object.entries(tracker)
    .filter(([, v]) => v.replied && !v.converted)
    .map(([phone, v]) => ({ phone, name: v.name, city: v.city, category: v.category, repliedAt: v.repliedAt }))
    .sort((a, b) => new Date(b.repliedAt) - new Date(a.repliedAt))
    .slice(0, 10);

  // Last hourly report
  let lastReport = null;
  try { lastReport = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8')); } catch {}

  return {
    engine:     { running, sentToday, totalSent, failed, replied, repliedToday, converted, fu1, fu2, fu3 },
    leads:      { total: totalLeads, unsent, sent: totalSent, failed },
    groups:     { postedToday: groupsToday, total: Object.keys(groupTracker).length },
    calls:      { today: callsToday },
    tunnelUrl:  getTunnelUrl(),
    replies,
    activity,
    hotLeads,
    lastReport,
  };
}

function pushStats() {
  try {
    const stats = buildStats();
    const body  = JSON.stringify(stats);
    const url   = new URL(RELAY_URL + '/push');

    const options = {
      hostname: url.hostname,
      port:     443,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(body),
        'x-relay-secret':  RELAY_SECRET,
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Stats pushed (sent: ${stats.engine.sentToday} today, ${stats.engine.replied} replies)`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] ⚠️  Relay returned ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      console.log(`[${new Date().toLocaleTimeString()}] ❌ Push failed: ${err.message}`);
    });

    req.write(body);
    req.end();
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Error building stats: ${err.message}`);
  }
}

// ── Command executor ─────────────────────────────────────────────────────────
const PM2_CMDS = {
  'run-engine':       [PM2, ['restart', 'mcf-engine']],
  'stop-engine':      [PM2, ['stop',    'mcf-engine']],
  'run-poster':       [PM2, ['restart', 'mcf-group-poster']],
  'run-scraper':      [PM2, ['restart', 'mcf-scraper']],
  'run-calls':        [PM2, ['restart', 'mcf-cold-calls']],
  'run-instagram':    [PM2, ['restart', 'mcf-instagram']],
  'run-linkedin':     [PM2, ['restart', 'mcf-linkedin']],
  'run-wa-status':    [PM2, ['restart', 'mcf-wa-status']],
  'run-followups':    [PM2, ['restart', 'mcf-engine', '--', '--followups']],
  'run-report':       [PM2, ['restart', 'mcf-hourly-report']],
  'restart-all':      [PM2, ['restart', 'all']],
  'status':           [PM2, ['jlist']],
};

function pollCommands() {
  const url = new URL(RELAY_URL + '/pending-command');
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'GET',
    headers: { 'x-relay-secret': RELAY_SECRET },
  };

  const req = http.request(options, (res) => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', () => {
      try {
        const { command } = JSON.parse(raw);
        if (!command) return;
        console.log(`[${new Date().toLocaleTimeString()}] 📲 Command received: ${command.action}`);
        const spec = PM2_CMDS[command.action];
        if (!spec) return reportResult(command.id, 'Unknown command');
        execFile(spec[0], spec[1], (err, stdout) => {
          const result = err ? `ERROR: ${err.message}` : stdout.trim() || 'done';
          console.log(`[${new Date().toLocaleTimeString()}] ✅ ${command.action}: ${result.slice(0, 80)}`);
          reportResult(command.id, result);
        });
      } catch {}
    });
  });
  req.on('error', () => {});
  req.end();
}

function reportResult(id, result) {
  const body = JSON.stringify({ id, result });
  const url  = new URL(RELAY_URL + '/command-result');
  const options = {
    hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-relay-secret': RELAY_SECRET },
  };
  const req = http.request(options, () => {});
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ── Process health monitor — alerts Render if a critical process crashes ───────
const CRITICAL = ['mcf-engine', 'mcf-pusher', 'mcf-receptionist'];
let lastStatuses = {};

function checkProcessHealth() {
  execFile(PM2, ['jlist'], (err, stdout) => {
    if (err) return;
    try {
      const procs = JSON.parse(stdout);
      for (const proc of procs) {
        if (!CRITICAL.includes(proc.name)) continue;
        const wasOnline = lastStatuses[proc.name];
        const isOnline  = proc.pm2_env?.status === 'online';
        if (wasOnline === true && !isOnline) {
          // Process just went down — report to Render for SMS alert
          reportAlert(`⚠️ MCF ALERT: ${proc.name} has CRASHED on your Mac. Attempting restart... Check LEADAPP.`);
          execFile(PM2, ['restart', proc.name], () => {});
        }
        lastStatuses[proc.name] = isOnline;
      }
    } catch {}
  });
}

function reportAlert(message) {
  const body = JSON.stringify({ alert: message });
  const url  = new URL(RELAY_URL + '/alert');
  const options = {
    hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-relay-secret': RELAY_SECRET },
  };
  const req = http.request(options, () => {});
  req.on('error', () => {});
  req.write(body);
  req.end();
  console.log(`[Alert] ${message.slice(0, 80)}`);
}

console.log(`\n📡 MCF Stats Pusher started`);
console.log(`   Pushing to: ${RELAY_URL}`);
console.log(`   Stats: every 60s | Commands: every 30s | Health: every 2min\n`);

pushStats();
pollCommands();
checkProcessHealth();
setInterval(pushStats, 60000);
setInterval(pollCommands, 30000);
setInterval(checkProcessHealth, 2 * 60 * 1000);
