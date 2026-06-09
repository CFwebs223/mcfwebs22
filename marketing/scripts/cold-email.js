#!/usr/bin/env node
/**
 * MCF Websites — Cold Email Outreach
 * Sends cold emails to leads from the email leads file.
 *
 * Setup (one-time):
 *   1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
 *   2. Create an App Password for "Mail"
 *   3. Add to .env: GMAIL_USER=feletchristopher@gmail.com  GMAIL_PASS=your-app-password
 *
 * Usage:
 *   node cold-email.js --stats         Show sent/unsent counts
 *   node cold-email.js --preview       Preview next 5 emails
 *   node cold-email.js --send          Send up to 50 emails today
 *   node cold-email.js --send --limit 10
 */

require('dotenv').config({ path: require('path').join(__dirname, '../leads/.env') });
const nodemailer = require('nodemailer');
const fs   = require('fs');
const path = require('path');

const EMAIL_LEADS_FILE = path.join(__dirname, '../leads/email-leads.json');
const EMAIL_TRACKER    = path.join(__dirname, '../leads/email-tracker.json');
const DAILY_LIMIT      = 50;
const MIN_DELAY        = 8000;
const MAX_DELAY        = 15000;

const GMAIL_USER = process.env.GMAIL_USER || 'feletchristopher@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || '';

// ── Email templates ────────────────────────────────────────────────────────────
const SUBJECTS = [
  (name) => `${name} — your competitors are getting found on Google. You're not.`,
  (name) => `Quick question for ${name}`,
  (name) => `I built a website for a business like ${name} last week`,
];

const BODIES = [
  (name) => `Hi,

I was looking up ${name} online and noticed you don't have a website yet.

That means every time a potential customer Googles a service like yours, they find your competitors — not you.

I'm Christopher, CEO of MCF Websites. We build professional websites for small businesses across South Africa.

Here's what your website would do for you:
✅ Customers find you on Google when they search for your services
✅ Looks professional — more trust = more bookings
✅ Clients can WhatsApp or book you directly from the site
✅ Shows your services, prices & reviews all in one place

Here's my offer: I build your website FIRST. If you don't love it, you walk away and pay absolutely nothing.

Starting from R2,500 once-off. No monthly fees.

Reply to this email or WhatsApp me on 075 320 3477 to get started.

Best,
Christopher Felet
CEO — MCF Websites
📞 075 320 3477
🌐 https://www.mcfwebs.agency`,

  (name) => `Hi there,

Quick one — I noticed ${name} doesn't have a website yet, and I think that's costing you clients every day.

I'm Christopher from MCF Websites. We specialise in building websites for service businesses that actually get found on Google.

The part most agencies won't tell you: most of your local competitors don't have websites either. Whoever goes online first wins all those Google searches.

I build it first — you only pay if you love it. Starting from R2,500.

Worth a quick chat? Just reply or WhatsApp 075 320 3477.

Christopher
MCF Websites — https://www.mcfwebs.agency`,

  (name) => `Hi,

I help service businesses like ${name} get found online and win more clients through professional websites.

My offer is simple: I build your site first, you see it, and only pay if you love it. No upfront cost. No risk.

- Professional website from R2,500 once-off
- No monthly fees
- Google-ready from day one
- WhatsApp & booking button included

Interested? Reply or WhatsApp 075 320 3477.

Christopher Felet | MCF Websites
🌐 https://www.mcfwebs.agency`,
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function loadLeads() {
  if (!fs.existsSync(EMAIL_LEADS_FILE)) {
    fs.writeFileSync(EMAIL_LEADS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(EMAIL_LEADS_FILE, 'utf8'));
}

function loadTracker() {
  if (!fs.existsSync(EMAIL_TRACKER)) return {};
  return JSON.parse(fs.readFileSync(EMAIL_TRACKER, 'utf8'));
}

function saveTracker(t) {
  fs.writeFileSync(EMAIL_TRACKER, JSON.stringify(t, null, 2));
}

function todaySentCount(tracker) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(tracker).filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
}

function randomPick(arr, name) {
  return arr[Math.floor(Math.random() * arr.length)](name);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args      = process.argv.slice(2);
  const doSend    = args.includes('--send');
  const doPreview = args.includes('--preview');
  const doStats   = args.includes('--stats');
  const limitIdx  = args.indexOf('--limit');
  const limit     = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : DAILY_LIMIT;

  const leads   = loadLeads();
  const tracker = loadTracker();

  if (doStats) {
    const sent    = leads.filter(l => tracker[l.email]?.status === 'sent').length;
    const unsent  = leads.filter(l => !tracker[l.email]).length;
    const failed  = leads.filter(l => tracker[l.email]?.status === 'failed').length;
    const today   = todaySentCount(tracker);
    console.log(`\n📊 COLD EMAIL STATS`);
    console.log(`   Total leads:  ${leads.length}`);
    console.log(`   Sent:         ${sent}`);
    console.log(`   Unsent:       ${unsent}`);
    console.log(`   Failed:       ${failed}`);
    console.log(`   Sent today:   ${today} / ${DAILY_LIMIT}`);
    if (leads.length === 0) console.log(`\n   ⚠️  No email leads yet. Add entries to:\n   ${EMAIL_LEADS_FILE}`);
    return;
  }

  if (leads.length === 0) {
    console.log(`\n⚠️  No email leads found.`);
    console.log(`   Add leads to: ${EMAIL_LEADS_FILE}`);
    console.log(`   Format: [{"name":"Business Name","email":"owner@example.com","city":"Cape Town"}]`);
    return;
  }

  if (doPreview) {
    const unsent = leads.filter(l => !tracker[l.email]).slice(0, 5);
    console.log(`\n📋 PREVIEW — next ${unsent.length} emails:\n`);
    unsent.forEach((l, i) => {
      console.log(`[${i+1}] To: ${l.email} (${l.name})`);
      console.log(`Subject: ${randomPick(SUBJECTS, l.name)}`);
      console.log(`\n${randomPick(BODIES, l.name).slice(0, 200)}...\n`);
      console.log('─'.repeat(60));
    });
    return;
  }

  if (doSend) {
    if (!GMAIL_PASS) {
      console.error('\n❌ GMAIL_PASS not set. Add it to marketing/leads/.env');
      console.error('   See setup instructions at top of this file.\n');
      process.exit(1);
    }

    const sentToday = todaySentCount(tracker);
    const remaining = Math.min(limit, DAILY_LIMIT - sentToday);
    if (remaining <= 0) { console.log(`\n⚠️  Daily limit of ${DAILY_LIMIT} reached.`); return; }

    const unsent = leads.filter(l => !tracker[l.email]).slice(0, remaining);
    if (unsent.length === 0) { console.log('\n✅ All email leads have been contacted!'); return; }

    const transporter = createTransporter();
    console.log(`\n📧 Sending ${unsent.length} cold emails from ${GMAIL_USER}\n`);

    let sent = 0, failed = 0;
    for (const lead of unsent) {
      try {
        await transporter.sendMail({
          from: `"Christopher Felet — MCF Websites" <${GMAIL_USER}>`,
          to:   lead.email,
          subject: randomPick(SUBJECTS, lead.name),
          text:    randomPick(BODIES, lead.name),
        });
        tracker[lead.email] = { name: lead.name, sentAt: new Date().toISOString(), status: 'sent' };
        saveTracker(tracker);
        sent++;
        console.log(`✅ [${sent}/${unsent.length}] ${lead.name} <${lead.email}>`);
        if (sent < unsent.length) {
          const wait = MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY));
          await sleep(wait);
        }
      } catch (err) {
        failed++;
        tracker[lead.email] = { name: lead.name, sentAt: new Date().toISOString(), status: 'failed', error: err.message };
        saveTracker(tracker);
        console.log(`❌ ${lead.name} <${lead.email}> — ${err.message}`);
      }
    }
    console.log(`\n✅ Done. Sent: ${sent} | Failed: ${failed}`);
  }
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
