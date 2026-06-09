#!/usr/bin/env node
/**
 * WhatsApp Bulk Outreach — MCF Websites
 * Uses Twilio WhatsApp API to send personalised messages to leads.
 *
 * Setup:
 *   npm install twilio
 *   Set env vars (see README at bottom) or create .env file
 *
 * Usage:
 *   node whatsapp-outreach.js --preview          # Show messages without sending
 *   node whatsapp-outreach.js --send             # Send to all unsent leads
 *   node whatsapp-outreach.js --send --limit 10  # Send to first 10 unsent leads
 *   node whatsapp-outreach.js --send --city CT   # Send to Cape Town only
 *   node whatsapp-outreach.js --send --cat pest  # Send to pest control only
 *   node whatsapp-outreach.js --stats            # Show sent/unsent counts
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER   = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default
const LEADS_FILE    = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const TRACKER_FILE  = path.join(__dirname, '../leads/outreach-tracker.json');
const DELAY_MS      = 3000; // 3 seconds between messages (avoids spam flags)

// ── Master message template (used for all categories) ────────────────────────
const buildMessage = (name) =>
`Good news and bad news. 😄

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
🌐 https://mcfwebsites.lovable.app/

Services: Business Websites · Landing Pages · E-Commerce · AI Integrations · Redesigns`;

// ── Message templates by category ────────────────────────────────────────────
const TEMPLATES = {
  plumber:      (name) => buildMessage(name),
  cleaner:      (name) => buildMessage(name),
  painter:      (name) => buildMessage(name),
  roofer:       (name) => buildMessage(name),
  pest:         (name) => buildMessage(name),
  gardening:    (name) => buildMessage(name),
  carwash:      (name) => buildMessage(name),
  carpentry:    (name) => buildMessage(name),
  tiling:       (name) => buildMessage(name),
  handyman:     (name) => buildMessage(name),
  aircon:       (name) => buildMessage(name),
  pool:         (name) => buildMessage(name),
  removals:     (name) => buildMessage(name),
  roofing:      (name) => buildMessage(name),
  waterproofing:(name) => buildMessage(name),
  treefelling:  (name) => buildMessage(name),
  petsitting:   (name) => buildMessage(name),
  towing:       (name) => buildMessage(name),
  electrician:  (name) => buildMessage(name),
  us:           (name) => buildMessage(name),
  default:      (name) => buildMessage(name),
};

// ── Parse leads from markdown ─────────────────────────────────────────────────
function parseLeads() {
  const content = fs.readFileSync(LEADS_FILE, 'utf8');
  const leads = [];
  let currentCity = '';
  let currentCategory = '';
  let isUS = false;

  for (const line of content.split('\n')) {
    // Detect country
    if (line.includes('🇺🇸') || line.includes('UNITED STATES')) isUS = true;
    if (line.includes('🇿🇦') || line.includes('SOUTH AFRICA')) isUS = false;

    // Detect city + category from headers like "### CAPE TOWN — Plumbers"
    const headerMatch = line.match(/^###\s+(.+?)\s+—\s+(.+)/);
    if (headerMatch) {
      currentCity = headerMatch[1].trim();
      currentCategory = headerMatch[2].trim().toLowerCase();
      continue;
    }

    // Detect table rows: | Business Name | Phone |
    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(\+?[\d\s\(\)\-]+)\s*\|/);
    if (rowMatch && rowMatch[1] !== 'Business' && rowMatch[2] !== 'Phone') {
      const name = rowMatch[1].trim();
      const rawPhone = rowMatch[2].trim().replace(/\s/g, '');
      if (!rawPhone || rawPhone === '—') continue;

      // Normalise phone to E.164
      let phone = rawPhone;
      if (phone.startsWith('27-') || phone.startsWith('27 ')) {
        phone = '+' + phone.replace(/-/g, '');
      } else if (phone.startsWith('0') && !isUS) {
        phone = '+27' + phone.slice(1);
      } else if (!phone.startsWith('+')) {
        phone = isUS ? '+1' + phone.replace(/\D/g, '').slice(-10) : '+27' + phone.replace(/\D/g, '');
      }
      phone = phone.replace(/[^\d+]/g, '');

      // Pick template key
      let templateKey = 'default';
      if (isUS) templateKey = 'us';
      else if (currentCategory.includes('plumb')) templateKey = 'plumber';
      else if (currentCategory.includes('clean')) templateKey = 'cleaner';
      else if (currentCategory.includes('paint')) templateKey = 'painter';
      else if (currentCategory.includes('pest')) templateKey = 'pest';
      else if (currentCategory.includes('garden') || currentCategory.includes('landscape')) templateKey = 'gardening';
      else if (currentCategory.includes('car wash') || currentCategory.includes('detailing') || currentCategory.includes('detailing')) templateKey = 'carwash';
      else if (currentCategory.includes('carpent') || currentCategory.includes('joinery')) templateKey = 'carpentry';
      else if (currentCategory.includes('tiling')) templateKey = 'tiling';
      else if (currentCategory.includes('handyman')) templateKey = 'handyman';
      else if (currentCategory.includes('air') || currentCategory.includes('hvac') || currentCategory.includes('aircon')) templateKey = 'aircon';
      else if (currentCategory.includes('pool')) templateKey = 'pool';
      else if (currentCategory.includes('removal')) templateKey = 'removals';
      else if (currentCategory.includes('roof')) templateKey = 'roofing';
      else if (currentCategory.includes('waterproof')) templateKey = 'waterproofing';
      else if (currentCategory.includes('tree')) templateKey = 'treefelling';
      else if (currentCategory.includes('pet')) templateKey = 'petsitting';
      else if (currentCategory.includes('towing') || currentCategory.includes('recovery')) templateKey = 'towing';
      else if (currentCategory.includes('electric')) templateKey = 'electrician';

      leads.push({
        name,
        phone,
        city: currentCity,
        category: currentCategory,
        country: isUS ? 'US' : 'SA',
        templateKey,
        message: TEMPLATES[templateKey](name),
      });
    }
  }

  return leads;
}

// ── Tracker (persists sent state) ─────────────────────────────────────────────
function loadTracker() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
}

function saveTracker(tracker) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

// ── Send via Twilio ───────────────────────────────────────────────────────────
async function sendMessage(client, to, body) {
  return client.messages.create({
    from: FROM_NUMBER,
    to: `whatsapp:${to}`,
    body,
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doSend    = args.includes('--send');
  const doPreview = args.includes('--preview');
  const doStats   = args.includes('--stats');
  const limitIdx  = args.indexOf('--limit');
  const limit     = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
  const cityIdx   = args.indexOf('--city');
  const cityFilter = cityIdx !== -1 ? args[cityIdx + 1].toUpperCase() : null;
  const catIdx    = args.indexOf('--cat');
  const catFilter = catIdx !== -1 ? args[catIdx + 1].toLowerCase() : null;

  const allLeads = parseLeads();
  const tracker  = loadTracker();

  // Apply filters
  let leads = allLeads.filter(l => {
    if (cityFilter && !l.city.toUpperCase().includes(cityFilter)) return false;
    if (catFilter && !l.category.includes(catFilter)) return false;
    return true;
  });

  // Stats
  if (doStats) {
    const sent   = leads.filter(l => tracker[l.phone]);
    const unsent = leads.filter(l => !tracker[l.phone]);
    console.log(`\n📊 OUTREACH STATS`);
    console.log(`   Total leads (filtered): ${leads.length}`);
    console.log(`   Sent:   ${sent.length}`);
    console.log(`   Unsent: ${unsent.length}`);
    const byCat = {};
    unsent.forEach(l => { byCat[l.category] = (byCat[l.category] || 0) + 1; });
    console.log(`\n   Unsent by category:`);
    Object.entries(byCat).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`     ${v}x ${k}`));
    return;
  }

  // Preview
  if (doPreview) {
    const unsent = leads.filter(l => !tracker[l.phone]).slice(0, Math.min(limit, 10));
    console.log(`\n📋 PREVIEW — first ${unsent.length} unsent messages:\n`);
    unsent.forEach((l, i) => {
      console.log(`[${i+1}] ${l.name} | ${l.phone} | ${l.city} | ${l.category}`);
      console.log(`     "${l.message}"\n`);
    });
    return;
  }

  // Send
  if (doSend) {
    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      console.error('\n❌ Missing Twilio credentials.');
      console.error('   Set these environment variables:');
      console.error('   export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx');
      console.error('   export TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx');
      console.error('   export TWILIO_WHATSAPP_FROM=whatsapp:+1xxxxxxxxxx\n');
      process.exit(1);
    }

    const twilio = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    const unsent = leads.filter(l => !tracker[l.phone]).slice(0, limit);

    console.log(`\n🚀 Sending to ${unsent.length} leads...\n`);

    let sent = 0, failed = 0;
    for (const lead of unsent) {
      try {
        await sendMessage(twilio, lead.phone, lead.message);
        tracker[lead.phone] = { name: lead.name, city: lead.city, category: lead.category, sentAt: new Date().toISOString(), status: 'sent' };
        saveTracker(tracker);
        sent++;
        console.log(`✅ [${sent}/${unsent.length}] ${lead.name} (${lead.phone})`);
        await sleep(DELAY_MS);
      } catch (err) {
        failed++;
        tracker[lead.phone] = { name: lead.name, sentAt: new Date().toISOString(), status: 'failed', error: err.message };
        saveTracker(tracker);
        console.log(`❌ [FAILED] ${lead.name} (${lead.phone}) — ${err.message}`);
      }
    }

    console.log(`\n✅ Done. Sent: ${sent} | Failed: ${failed}`);
    console.log(`   Tracker saved to: ${TRACKER_FILE}`);
    return;
  }

  // Default: show help
  console.log(`
MCF WhatsApp Outreach Tool
==========================

Commands:
  node whatsapp-outreach.js --preview              Show first 10 messages (no sending)
  node whatsapp-outreach.js --stats                Show sent/unsent counts
  node whatsapp-outreach.js --send                 Send to ALL unsent leads
  node whatsapp-outreach.js --send --limit 20      Send to first 20 unsent leads
  node whatsapp-outreach.js --send --city CT       Send to Cape Town leads only
  node whatsapp-outreach.js --send --city JHB      Send to Johannesburg leads only
  node whatsapp-outreach.js --send --cat pest      Send to pest control leads only
  node whatsapp-outreach.js --send --city CT --cat clean --limit 5

Required env vars:
  TWILIO_ACCOUNT_SID      Your Twilio Account SID
  TWILIO_AUTH_TOKEN       Your Twilio Auth Token
  TWILIO_WHATSAPP_FROM    Your WhatsApp sender (e.g. whatsapp:+27xxxxxxxxx)

Total leads in file: ${allLeads.length}
`);
}

main().catch(err => { console.error(err); process.exit(1); });
