#!/usr/bin/env node
/**
 * MCF Websites — Cold Call Outreach
 * Dials leads via Twilio, plays TTS message, press 1 = forward, press 2 = WhatsApp.
 *
 * FIRST: start the webhook server in a separate terminal:
 *   TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx node cold-call-server.js
 *
 * THEN run this script:
 *   TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx WEBHOOK_BASE=https://your-tunnel-url node cold-call-outreach.js --send --limit 20
 *
 * Options:
 *   --send              Dial all uncalled leads
 *   --limit N           Only dial N leads
 *   --city CT           Filter by city
 *   --cat pest          Filter by category
 *   --stats             Show called/uncalled counts
 *   --preview           Show first 10 numbers without calling
 */

const fs   = require('fs');
const path = require('path');

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const CALLER_ID    = process.env.TWILIO_PHONE || process.env.TWILIO_PHONE_NUMBER;
const LEADS_FILE   = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const TUNNEL_LOG   = path.join(__dirname, '../leads/tunnel.log');
const CALL_TRACKER = path.join(__dirname, '../leads/call-tracker.json');
const DELAY_MS     = 8000; // 8 seconds between calls

// Use permanent Render relay for webhooks — no tunnel needed
const WEBHOOK_BASE = process.env.WEBHOOK_BASE || 'https://mcf-stats-relay.onrender.com';

// ── Parse leads (reuse same parser as whatsapp script) ───────────────────────
function parseLeads() {
  const content = fs.readFileSync(LEADS_FILE, 'utf8');
  const leads = [];
  let currentCity = '', currentCategory = '', isUS = false;

  for (const line of content.split('\n')) {
    if (line.includes('🇺🇸') || line.includes('UNITED STATES')) isUS = true;
    if (line.includes('🇿🇦') || line.includes('SOUTH AFRICA')) isUS = false;

    const headerMatch = line.match(/^###\s+(.+?)\s+—\s+(.+)/);
    if (headerMatch) {
      currentCity = headerMatch[1].trim();
      currentCategory = headerMatch[2].trim().toLowerCase();
      continue;
    }

    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(\+?[\d\s\(\)\-]+)\s*\|/);
    if (rowMatch && rowMatch[1] !== 'Business' && rowMatch[2] !== 'Phone') {
      const name = rowMatch[1].trim();
      const rawPhone = rowMatch[2].trim().replace(/\s/g, '');
      if (!rawPhone || rawPhone === '—') continue;

      let phone = rawPhone;
      if (phone.startsWith('27-') || phone.startsWith('27 ')) {
        phone = '+' + phone.replace(/-/g, '');
      } else if (phone.startsWith('0') && !isUS) {
        phone = '+27' + phone.slice(1);
      } else if (!phone.startsWith('+')) {
        phone = isUS ? '+1' + phone.replace(/\D/g, '').slice(-10) : '+27' + phone.replace(/\D/g, '');
      }
      phone = phone.replace(/[^\d+]/g, '');
      if (phone.length < 10) continue;

      leads.push({ name, phone, city: currentCity, category: currentCategory, country: isUS ? 'US' : 'SA' });
    }
  }
  return leads;
}

function loadTracker() {
  if (!fs.existsSync(CALL_TRACKER)) return {};
  return JSON.parse(fs.readFileSync(CALL_TRACKER, 'utf8'));
}

function saveTracker(tracker) {
  fs.writeFileSync(CALL_TRACKER, JSON.stringify(tracker, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const args       = process.argv.slice(2);
  const doSend     = args.includes('--send');
  const doPreview  = args.includes('--preview');
  const doStats    = args.includes('--stats');
  const limitIdx   = args.indexOf('--limit');
  const limit      = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
  const cityIdx    = args.indexOf('--city');
  const cityFilter = cityIdx !== -1 ? args[cityIdx + 1].toUpperCase() : null;
  const catIdx     = args.indexOf('--cat');
  const catFilter  = catIdx !== -1 ? args[catIdx + 1].toLowerCase() : null;

  const allLeads = parseLeads();
  const tracker  = loadTracker();

  let leads = allLeads.filter(l => {
    if (cityFilter && !l.city.toUpperCase().includes(cityFilter)) return false;
    if (catFilter && !l.category.includes(catFilter)) return false;
    return true;
  });

  if (doStats) {
    const called   = leads.filter(l => tracker[l.phone]);
    const uncalled = leads.filter(l => !tracker[l.phone]);
    console.log(`\n📊 CALL STATS`);
    console.log(`   Total: ${leads.length} | Called: ${called.length} | Uncalled: ${uncalled.length}`);
    const answered = Object.values(tracker).filter(v => v.status === 'completed').length;
    const noAnswer = Object.values(tracker).filter(v => v.status === 'no-answer').length;
    console.log(`   Answered: ${answered} | No answer: ${noAnswer}`);
    return;
  }

  if (doPreview) {
    const uncalled = leads.filter(l => !tracker[l.phone]).slice(0, 10);
    console.log(`\n📋 PREVIEW — first ${uncalled.length} numbers to call:\n`);
    uncalled.forEach((l, i) => console.log(`[${i+1}] ${l.name} | ${l.phone} | ${l.city}`));
    return;
  }

  if (doSend) {
    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      console.error('\n❌ Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.\n');
      process.exit(1);
    }

    const client   = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    const uncalled = leads.filter(l => !tracker[l.phone]).slice(0, limit);

    console.log(`\n📞 Dialing ${uncalled.length} leads...`);
    console.log(`   Webhook: ${WEBHOOK_BASE}`);
    console.log(`   Caller ID: ${CALLER_ID}\n`);

    let dialed = 0, failed = 0;
    for (const lead of uncalled) {
      try {
        const call = await client.calls.create({
          to:              lead.phone,
          from:            CALLER_ID,
          url:             `${WEBHOOK_BASE}/cold/answer`,
          statusCallback:  `${WEBHOOK_BASE}/cold/status`,
          statusCallbackMethod: 'POST',
          machineDetection: 'Enable', // skip voicemail
        });

        tracker[lead.phone] = { name: lead.name, city: lead.city, calledAt: new Date().toISOString(), callSid: call.sid, status: 'dialed' };
        saveTracker(tracker);
        dialed++;
        console.log(`📞 [${dialed}/${uncalled.length}] ${lead.name} (${lead.phone})`);
        await sleep(DELAY_MS);
      } catch (err) {
        failed++;
        tracker[lead.phone] = { name: lead.name, calledAt: new Date().toISOString(), status: 'failed', error: err.message };
        saveTracker(tracker);
        console.log(`❌ [FAILED] ${lead.name} (${lead.phone}) — ${err.message}`);
      }
    }

    console.log(`\n✅ Done. Dialed: ${dialed} | Failed: ${failed}`);
    return;
  }

  // Default: help
  console.log(`
MCF Cold Call Outreach
======================

STEP 1 — Start the webhook server (keep it running):
  TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx node cold-call-server.js

STEP 2 — In a new terminal, start dialing:
  TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx \\
  WEBHOOK_BASE=https://mcfwebs-calls.loca.lt \\
  node cold-call-outreach.js --send --limit 20

Options:
  --send              Dial all uncalled leads
  --limit N           Only dial N leads
  --city CT / JHB     Filter by city
  --cat pest / clean  Filter by category
  --stats             Show call stats
  --preview           Preview numbers without calling

Total leads: ${allLeads.length}
`);
}

main().catch(err => { console.error(err); process.exit(1); });
