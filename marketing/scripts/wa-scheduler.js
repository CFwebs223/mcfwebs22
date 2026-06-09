#!/usr/bin/env node
/**
 * MCF Websites — WhatsApp Daily Scheduler
 * Scan QR once → runs automatically every day at 9am.
 * Sends 50 messages/day until all leads are contacted.
 *
 * Usage:
 *   node wa-scheduler.js          Start scheduler (scan QR once)
 *   node wa-scheduler.js --stop   Stop the scheduler
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs     = require('fs');
const path   = require('path');

const LEADS_FILE   = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const TRACKER_FILE = path.join(__dirname, '../leads/wa-blast-tracker.json');
const AUTH_FOLDER  = path.join(__dirname, '../leads/wa-session');
const LOCK_FILE    = path.join(__dirname, '../leads/wa-scheduler.lock');
const DAILY_LIMIT  = 50;
const MIN_DELAY    = 45000;
const MAX_DELAY    = 90000;
const SEND_HOUR    = 8; // 8am daily

const MESSAGES = [
  (name) => `Good news and bad news 😄

Bad news: I Googled *${name}* and couldn't find a website — which means customers searching for you right now are going straight to your competitor.

Good news: that's exactly what I fix.

I'm Christopher, CEO of *MCF Websites* — we build professional websites for service businesses like yours.

Here's what your site would do:
✅ Customers find you on Google with all your reviews
✅ Looks professional = more trust = more bookings
✅ Clients can WhatsApp or book you directly from the site
✅ Show your services, prices & testimonials in one place

And here's my offer: *I build it first. If you don't love it, you walk away and pay absolutely nothing.*

*MCF WEBSITES*
_Premium Web Design & Development_
"Modern websites that grow your business."

📞 075 320 3477
🌐 https://www.mcfwebs.agency

Services: Business Websites · Landing Pages · E-Commerce · AI Integrations · Redesigns`,

  (name) => `Hi! Quick one 👋

I was looking up service businesses in your area and noticed *${name}* doesn't have a website yet.

That's actually an opportunity — most of your competitors don't either, so whoever gets online first wins.

I'm Christopher from *MCF Websites*. I build professional websites for service businesses:
✅ Customers find you on Google
✅ Book or WhatsApp you directly from the site
✅ Show your services, prices & reviews

*Best part: I build it first. You only pay if you love it.* Starting from R2,500.

Worth a quick chat?

📞 075 320 3477
🌐 https://www.mcfwebs.agency`,

  (name) => `Hey, sorry to bother you on WhatsApp 🙏

I'm Christopher — I build websites for small businesses. I noticed *${name}* doesn't have one yet and wanted to reach out because I think it could really help you get more clients.

What I offer:
• Professional website from R2,500 once-off
• No monthly fees
• I build it first — you pay nothing if you're not happy
• Customers can find you on Google & book directly

If you're interested reply *YES* and I'll send you examples of my work. If not, no worries at all! 😊

*MCF WEBSITES* — 📞 075 320 3477
🌐 https://www.mcfwebs.agency`,
];

function parseLeads() {
  const content = fs.readFileSync(LEADS_FILE, 'utf8');
  const leads = [];
  let currentCity = '', currentCategory = '', isUS = false;
  for (const line of content.split('\n')) {
    if (line.includes('🇺🇸') || line.includes('UNITED STATES')) isUS = true;
    if (line.includes('🇿🇦') || line.includes('SOUTH AFRICA')) isUS = false;
    const headerMatch = line.match(/^###\s+(.+?)\s+—\s+(.+)/);
    if (headerMatch) { currentCity = headerMatch[1].trim(); currentCategory = headerMatch[2].trim().toLowerCase(); continue; }
    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(\+?[\d\s\(\)\-]+)\s*\|/);
    if (rowMatch && rowMatch[1] !== 'Business' && rowMatch[2] !== 'Phone') {
      const name = rowMatch[1].trim();
      const rawPhone = rowMatch[2].trim().replace(/\s/g, '');
      if (!rawPhone || rawPhone === '—' || name === '---') continue;
      let phone = rawPhone.replace(/[^\d+]/g, '');
      if (phone.startsWith('270')) phone = '+27' + phone.slice(3);
      else if (phone.startsWith('27')) phone = '+' + phone;
      else if (phone.startsWith('0') && !isUS) phone = '+27' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = isUS ? '+1' + phone.slice(-10) : '+27' + phone;
      if (phone.length < 10) continue;
      leads.push({ name, phone, city: currentCity, category: currentCategory });
    }
  }
  return leads;
}

function loadTracker() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
}
function saveTracker(t) { fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2)); }
function todaySentCount(tracker) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(tracker).filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
}
function randomDelay() { return MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)); }
function randomMessage(name) { return MESSAGES[Math.floor(Math.random() * MESSAGES.length)](name); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function msUntilNextRun() {
  const now = new Date();
  const next = new Date();
  next.setHours(SEND_HOUR, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next - now;
}

async function sendBatch(client) {
  const tracker  = loadTracker();
  const allLeads = parseLeads();
  const unsent   = allLeads.filter(l => !tracker[l.phone]).slice(0, DAILY_LIMIT);

  if (unsent.length === 0) {
    console.log('✅ All leads contacted! Nothing to send today.');
    return;
  }

  console.log(`\n📤 [${new Date().toLocaleString()}] Sending to ${unsent.length} leads...\n`);
  let sent = 0, failed = 0;

  for (const lead of unsent) {
    try {
      const jid     = `${lead.phone.replace('+', '')}@c.us`;
      const message = randomMessage(lead.name);
      await client.sendMessage(jid, message);
      tracker[lead.phone] = { name: lead.name, city: lead.city, sentAt: new Date().toISOString(), status: 'sent' };
      saveTracker(tracker);
      sent++;
      console.log(`✅ [${sent}/${unsent.length}] ${lead.name}`);
      if (sent < unsent.length) {
        const wait = randomDelay();
        console.log(`   ⏳ ${Math.round(wait / 1000)}s...\n`);
        await sleep(wait);
      }
    } catch (err) {
      failed++;
      tracker[lead.phone] = { name: lead.name, sentAt: new Date().toISOString(), status: 'failed', error: err.message };
      saveTracker(tracker);
      console.log(`❌ ${lead.name} — ${err.message}`);
    }
  }
  console.log(`\n✅ Batch done. Sent: ${sent} | Failed: ${failed}`);
  const remaining = parseLeads().filter(l => !loadTracker()[l.phone]).length;
  console.log(`📊 Remaining leads: ${remaining}`);
}

async function main() {
  if (process.argv.includes('--stop')) {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      try { process.kill(parseInt(pid), 'SIGTERM'); console.log(`✅ Stopped scheduler (PID ${pid})`); }
      catch { console.log('Scheduler not running.'); }
      fs.unlinkSync(LOCK_FILE);
    } else { console.log('Scheduler not running.'); }
    return;
  }

  // Lock
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    try { process.kill(parseInt(pid), 0); console.error(`\n❌ Scheduler already running (PID ${pid}). Run: node wa-scheduler.js --stop\n`); process.exit(1); } catch {}
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(0); }); process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  // Connect WhatsApp
  console.log('\n🚀 MCF Websites — WhatsApp Daily Scheduler');
  console.log('   Scan QR once → sends 50 messages every day at 9am automatically\n');

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_FOLDER }),
    puppeteer: {
      headless: true,
      executablePath: '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    console.log('📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\nWhatsApp → Menu → Linked Devices → Link a Device\n');
  });

  client.on('ready', async () => {
    console.log('✅ WhatsApp connected! Scheduler is running.\n');

    // Check if already sent today
    const tracker = loadTracker();
    const sentToday = todaySentCount(tracker);

    if (sentToday < DAILY_LIMIT) {
      console.log(`📤 Sending today's batch now (${sentToday} already sent today)...`);
      await sendBatch(client);
    }

    // Schedule daily at 9am
    const schedule = async () => {
      const ms = msUntilNextRun();
      const next = new Date(Date.now() + ms);
      console.log(`\n⏰ Next batch scheduled for: ${next.toLocaleString()}`);
      console.log(`   (${Math.round(ms / 1000 / 60 / 60)} hours from now)\n`);
      await sleep(ms);
      await sendBatch(client);
      schedule(); // reschedule for next day
    };

    schedule();
  });

  client.on('auth_failure', () => { console.error('❌ Auth failed. Delete wa-session folder and try again.'); process.exit(1); });
  client.on('disconnected', () => { console.log('⚠️ WhatsApp disconnected. Reconnecting...'); client.initialize(); });

  client.initialize();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
