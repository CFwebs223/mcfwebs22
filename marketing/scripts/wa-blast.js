#!/usr/bin/env node
/**
 * MCF Websites — WhatsApp Blast (via your own number)
 * Uses Baileys to send from your real WhatsApp number.
 * Scan QR code once, stays connected.
 *
 * Usage:
 *   node wa-blast.js --preview        Show next 10 messages without sending
 *   node wa-blast.js --send           Send up to 50 messages today
 *   node wa-blast.js --send --limit 5 Send only 5
 *   node wa-blast.js --stats          Show sent/unsent counts
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs     = require('fs');
const path   = require('path');

const LEADS_FILE   = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const TRACKER_FILE = path.join(__dirname, '../leads/wa-blast-tracker.json');
const AUTH_FOLDER  = path.join(__dirname, '../leads/wa-session');
const LOCK_FILE    = path.join(__dirname, '../leads/wa-blast.lock');
const DAILY_LIMIT  = 50;   // max per day (anti-ban)
const MIN_DELAY    = 45000; // min ms between messages (45s)
const MAX_DELAY    = 90000; // max ms between messages (90s)

// ── Lock file — prevents duplicate runs ──────────────────────────────────────
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    try {
      process.kill(parseInt(pid), 0); // check if process is alive
      console.error(`\n❌ Already running (PID ${pid}). Stop it first with: kill ${pid}\n`);
      process.exit(1);
    } catch {
      // stale lock — process is dead, remove it
      fs.unlinkSync(LOCK_FILE);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

// ── Message variants (rotated randomly to avoid spam detection) ───────────────
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

*MCF WEBSITES* — 📞 075 320 3477`,
];

// ── Parse leads ───────────────────────────────────────────────────────────────
function parseLeads() {
  const content = fs.readFileSync(LEADS_FILE, 'utf8');
  const leads = [];
  let currentCity = '', currentCategory = '', isUS = false;

  for (const line of content.split('\n')) {
    if (line.includes('🇺🇸') || line.includes('UNITED STATES')) isUS = true;
    if (line.includes('🇿🇦') || line.includes('SOUTH AFRICA')) isUS = false;

    const headerMatch = line.match(/^###\s+(.+?)\s+—\s+(.+)/);
    if (headerMatch) {
      currentCity     = headerMatch[1].trim();
      currentCategory = headerMatch[2].trim().toLowerCase();
      continue;
    }

    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(\+?[\d\s\(\)\-]+)\s*\|/);
    if (rowMatch && rowMatch[1] !== 'Business' && rowMatch[2] !== 'Phone') {
      const name     = rowMatch[1].trim();
      const rawPhone = rowMatch[2].trim().replace(/\s/g, '');
      if (!rawPhone || rawPhone === '—' || name === '---') continue;

      let phone = rawPhone.replace(/[^\d+]/g, '');
      if (phone.startsWith('270')) phone = '+27' + phone.slice(3);
      else if (phone.startsWith('27'))  phone = '+' + phone;
      else if (phone.startsWith('0') && !isUS) phone = '+27' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = isUS ? '+1' + phone.slice(-10) : '+27' + phone;

      if (phone.length < 10) continue;

      leads.push({ name, phone, city: currentCity, category: currentCategory, country: isUS ? 'US' : 'SA' });
    }
  }
  return leads;
}

// ── Tracker ───────────────────────────────────────────────────────────────────
function loadTracker() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
}

function saveTracker(t) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2));
}

function todaySentCount(tracker) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(tracker).filter(v => v.sentAt && v.sentAt.startsWith(today) && v.status === 'sent').length;
}

function randomDelay() {
  return MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY));
}

function randomMessage(name) {
  const fn = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  return fn(name);
}

// ── WhatsApp connection ───────────────────────────────────────────────────────
async function connectWA() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_FOLDER }),
    puppeteer: {
      headless: true,
      executablePath: '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  return new Promise((resolve, reject) => {
    client.on('qr', (qr) => {
      console.log('\n📱 Scan this QR code with your WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nOpen WhatsApp → Menu (3 dots) → Linked Devices → Link a Device\n');
    });

    client.on('ready', () => {
      console.log('✅ WhatsApp connected!\n');
      resolve(client);
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Auth failed:', msg);
      reject(new Error('Auth failed'));
    });

    client.initialize();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args      = process.argv.slice(2);
  const doSend    = args.includes('--send');
  const doPreview = args.includes('--preview');
  const doStats   = args.includes('--stats');
  const limitIdx  = args.indexOf('--limit');
  const limit     = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : DAILY_LIMIT;
  const cityIdx   = args.indexOf('--city');
  const cityFilter = cityIdx !== -1 ? args[cityIdx + 1].toUpperCase() : null;
  const catIdx    = args.indexOf('--cat');
  const catFilter = catIdx !== -1 ? args[catIdx + 1].toLowerCase() : null;

  const allLeads = parseLeads();
  const tracker  = loadTracker();

  let leads = allLeads.filter(l => {
    if (cityFilter && !l.city.toUpperCase().includes(cityFilter)) return false;
    if (catFilter && !l.category.includes(catFilter)) return false;
    return true;
  });

  // Stats
  if (doStats) {
    const sent   = leads.filter(l => tracker[l.phone]?.status === 'sent').length;
    const unsent = leads.filter(l => !tracker[l.phone]).length;
    const failed = leads.filter(l => tracker[l.phone]?.status === 'failed').length;
    const sentToday = todaySentCount(tracker);
    console.log(`\n📊 WA BLAST STATS`);
    console.log(`   Total leads:  ${leads.length}`);
    console.log(`   Sent:         ${sent}`);
    console.log(`   Unsent:       ${unsent}`);
    console.log(`   Failed:       ${failed}`);
    console.log(`   Sent today:   ${sentToday} / ${DAILY_LIMIT}`);
    return;
  }

  // Preview
  if (doPreview) {
    const unsent = leads.filter(l => !tracker[l.phone]).slice(0, 10);
    console.log(`\n📋 PREVIEW — next ${unsent.length} messages:\n`);
    unsent.forEach((l, i) => {
      console.log(`[${i+1}] ${l.name} | ${l.phone}`);
      console.log(`\n${randomMessage(l.name)}\n`);
      console.log('─'.repeat(60));
    });
    return;
  }

  // Send
  if (doSend) {
    acquireLock();
    const alreadySentToday = todaySentCount(tracker);
    const remaining = Math.min(limit, DAILY_LIMIT - alreadySentToday);

    if (remaining <= 0) {
      console.log(`\n⚠️  Daily limit of ${DAILY_LIMIT} reached. Run again tomorrow.`);
      return;
    }

    const unsent = leads.filter(l => !tracker[l.phone]).slice(0, remaining);

    if (unsent.length === 0) {
      console.log('\n✅ All leads have been messaged!');
      return;
    }

    console.log(`\n🚀 Connecting to WhatsApp...`);
    const sock = await connectWA();

    console.log(`📤 Sending to ${unsent.length} leads (max ${remaining} today)`);
    console.log(`⏱️  ~${Math.round((unsent.length * 67) / 60)} minutes estimated\n`);

    let sent = 0, failed = 0;
    for (const lead of unsent) {
      try {
        const jid     = `${lead.phone.replace('+', '')}@c.us`;
        const message = randomMessage(lead.name);

        await sock.sendMessage(jid, message);

        tracker[lead.phone] = { name: lead.name, city: lead.city, category: lead.category, sentAt: new Date().toISOString(), status: 'sent' };
        saveTracker(tracker);
        sent++;
        console.log(`✅ [${sent}/${unsent.length}] ${lead.name} (${lead.phone})`);

        if (sent < unsent.length) {
          const wait = randomDelay();
          console.log(`   ⏳ Waiting ${Math.round(wait / 1000)}s...\n`);
          await delay(wait);
        }
      } catch (err) {
        failed++;
        tracker[lead.phone] = { name: lead.name, sentAt: new Date().toISOString(), status: 'failed', error: err.message };
        saveTracker(tracker);
        console.log(`❌ [FAILED] ${lead.name} — ${err.message}`);
      }
    }

    console.log(`\n✅ Done! Sent: ${sent} | Failed: ${failed}`);
    console.log(`   Run again tomorrow for the next batch.`);
    await sock.destroy();
    process.exit(0);
  }

  // Help
  console.log(`
MCF WhatsApp Blast (your own number)
=====================================

Commands:
  node wa-blast.js --preview           Show next 10 messages
  node wa-blast.js --stats             Show sent/unsent counts
  node wa-blast.js --send              Send up to ${DAILY_LIMIT} messages today
  node wa-blast.js --send --limit 10   Send only 10 today
  node wa-blast.js --send --city CT    Cape Town leads only
  node wa-blast.js --send --city JHB   Johannesburg leads only
  node wa-blast.js --send --cat pest   Pest control leads only

Anti-ban settings:
  Daily limit:  ${DAILY_LIMIT} messages/day
  Delay:        ${MIN_DELAY/1000}–${MAX_DELAY/1000} seconds between each message
  Messages:     3 variants rotated randomly

Total leads: ${allLeads.length}
`);
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
