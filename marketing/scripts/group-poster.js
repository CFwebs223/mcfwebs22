#!/usr/bin/env node
/**
 * MCF Group Poster — runs every 30 min via PM2 cron
 * Posts to one SA business group per run (rotates through 100+ groups)
 * Never posts to the same group twice in 23 hours
 */

const puppeteer  = require('puppeteer');
const fs         = require('fs');
const path       = require('path');

const CHROME    = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SESSION   = path.join(__dirname, '../leads/fb-session');
const TRACKER   = path.join(__dirname, '../leads/group-tracker.json');
const LOG_FILE  = path.join(__dirname, '../leads/group-poster.log');
const DRY_RUN   = process.argv.includes('--dry');

// ── 100+ SA Facebook groups (business/entrepreneurship focus) ─────────────────
const GROUPS = [
  // Cape Town
  'https://www.facebook.com/groups/capetownbusinessnetwork',
  'https://www.facebook.com/groups/capetownbusiness',
  'https://www.facebook.com/groups/capetownentrepreneurs',
  'https://www.facebook.com/groups/buyandsellinCapetown',
  'https://www.facebook.com/groups/capetownservices',
  'https://www.facebook.com/groups/ctsmallbusiness',
  'https://www.facebook.com/groups/capetownlocalbusiness',
  'https://www.facebook.com/groups/capetownfreelancers',
  'https://www.facebook.com/groups/westerncapebusiness',
  'https://www.facebook.com/groups/capetownhomeimprovement',
  'https://www.facebook.com/groups/capetowntradesmen',
  'https://www.facebook.com/groups/capetowncontractors',
  // Johannesburg
  'https://www.facebook.com/groups/joburgbusiness',
  'https://www.facebook.com/groups/johannesburgentrepreneurs',
  'https://www.facebook.com/groups/jhbsmallbusiness',
  'https://www.facebook.com/groups/joburgnetworking',
  'https://www.facebook.com/groups/gautengbusiness',
  'https://www.facebook.com/groups/johannesburgservices',
  'https://www.facebook.com/groups/joburgtradesmen',
  'https://www.facebook.com/groups/sandtonbusiness',
  'https://www.facebook.com/groups/sowetobusiness',
  // Nationwide SA
  'https://www.facebook.com/groups/saentrepreneurs',
  'https://www.facebook.com/groups/southafricasmallbusiness',
  'https://www.facebook.com/groups/sasmallbusiness',
  'https://www.facebook.com/groups/southafricabusiness',
  'https://www.facebook.com/groups/growsabusiness',
  'https://www.facebook.com/groups/sabusinessnetwork',
  'https://www.facebook.com/groups/saserviceproviders',
  'https://www.facebook.com/groups/safreeagents',
  'https://www.facebook.com/groups/southafricafreelancers',
  'https://www.facebook.com/groups/sadigitalmarketing',
  'https://www.facebook.com/groups/southafricaonlinebusiness',
  'https://www.facebook.com/groups/sacontractors',
  'https://www.facebook.com/groups/southafricahandyman',
  'https://www.facebook.com/groups/saplumbers',
  'https://www.facebook.com/groups/saelectricians',
  'https://www.facebook.com/groups/sapestcontrol',
  'https://www.facebook.com/groups/sacleaners',
  'https://www.facebook.com/groups/sapaintersdecorators',
  'https://www.facebook.com/groups/saroofers',
  'https://www.facebook.com/groups/sacarpentry',
  'https://www.facebook.com/groups/salandscaping',
  // Business/startup
  'https://www.facebook.com/groups/startupgrindsa',
  'https://www.facebook.com/groups/entrepreneurssa',
  'https://www.facebook.com/groups/southafricastartups',
  'https://www.facebook.com/groups/sabizconnect',
  'https://www.facebook.com/groups/smesouthafrica',
  'https://www.facebook.com/groups/southafricaSMEs',
  'https://www.facebook.com/groups/safemaleentrepreneurs',
  'https://www.facebook.com/groups/saentrepreneurswomen',
  'https://www.facebook.com/groups/youngentrepreneurssa',
  'https://www.facebook.com/groups/blackentrepreneurssa',
  // Durban / KZN
  'https://www.facebook.com/groups/durbanbusiness',
  'https://www.facebook.com/groups/kznbusiness',
  'https://www.facebook.com/groups/durbanbusinessnetwork',
  'https://www.facebook.com/groups/durbanservices',
  'https://www.facebook.com/groups/kznentrepreneurs',
  // Pretoria
  'https://www.facebook.com/groups/pretoriabusiness',
  'https://www.facebook.com/groups/pretoriabusinessnetwork',
  'https://www.facebook.com/groups/tshwanebusiness',
  // Port Elizabeth / Gqeberha
  'https://www.facebook.com/groups/portgelizabethbusiness',
  'https://www.facebook.com/groups/gqeberhaforbusiness',
  // East London / Bloemfontein
  'https://www.facebook.com/groups/eastlondonbusiness',
  'https://www.facebook.com/groups/bloemfonteinthebusiness',
  // Home improvement / renovation
  'https://www.facebook.com/groups/sahomeimprovement',
  'https://www.facebook.com/groups/southafricarenovations',
  'https://www.facebook.com/groups/homeimprovementcapetown',
  'https://www.facebook.com/groups/homeimprovementjoburg',
  'https://www.facebook.com/groups/sarenovationcontractors',
  // Digital/web
  'https://www.facebook.com/groups/sawebdesign',
  'https://www.facebook.com/groups/southafricadigital',
  'https://www.facebook.com/groups/safreelancedesigners',
  'https://www.facebook.com/groups/southafricait',
  'https://www.facebook.com/groups/satechbusiness',
  // Trade-specific
  'https://www.facebook.com/groups/capetowntraders',
  'https://www.facebook.com/groups/sabuyselltrade',
  'https://www.facebook.com/groups/southafricamarketplace',
  'https://www.facebook.com/groups/sabuyselltradeanymore',
];

const POSTS = [
  `🌐 Does your business have a website that actually brings in clients?

At MCF Websites, we build fast, professional websites for small businesses in SA — designed to convert visitors into paying customers.

✅ Starter from R1,500 — 3 to 5 pages, Google SEO, WhatsApp button
✅ Business at R4,500 — booking system, gallery, maps
✅ Premium at R7,500 — full online store

🔒 Risk-free: We build first. You only pay if you love it.

📱 WhatsApp 075 320 3477 | www.mcfwebs.agency`,

  `💼 Small business owners — losing clients because you're not online?

Most customers Google a business before calling. No website = no client.

MCF Websites builds affordable, professional websites for SA service businesses:
🔧 Plumbers, electricians, painters, roofers
🏠 Cleaners, removals, handyman, pest control
🌿 Gardeners, car detailers, and more

From R1,500 | Done in 5 days | Risk-free guarantee
📱 WhatsApp: 075 320 3477 | 🌐 mcfwebs.agency`,

  `📱 Get your business found on Google — from R1,500

Hi SA business owners 👋 We're MCF Websites — we build websites for small businesses that need more clients.

What's included:
→ Professional mobile-friendly website
→ Google SEO setup (get found on Google)
→ WhatsApp & booking button
→ Done in 5 working days
→ You pay ONLY if you love it ✅

WhatsApp us now: 075 320 3477
www.mcfwebs.agency

Drop a 🙋 if you need a website or know someone who does!`,

  `🏆 MCF Websites — SA's most affordable web design

Are you a service business without a website? Here's what you're losing:
• New customers who search Google daily
• Credibility (people don't trust businesses without websites)
• Bookings while you sleep

We fix this for R1,500.

✅ Professional design
✅ Your own domain
✅ Mobile + Google optimised
✅ Built in 5 days
✅ Risk-free — pay only if you love it

WhatsApp 075 320 3477 or visit mcfwebs.agency 🚀`,

  `💡 ATTENTION: Plumbers, painters, cleaners, electricians in SA

Are your competitors getting more calls than you? It's probably because they have a website and you don't.

We build websites specifically for SA tradesmen and service businesses. Simple. Affordable. Effective.

📋 STARTER — R1,500
📋 BUSINESS — R4,500 (with online booking)
📋 PREMIUM — R7,500 (with online store)

No upfront risk — we build it first, you pay if you love it.

📱 WhatsApp 075 320 3477
🌐 www.mcfwebs.agency`,
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadTracker() {
  if (!fs.existsSync(TRACKER)) return {};
  try { return JSON.parse(fs.readFileSync(TRACKER, 'utf8')); } catch { return {}; }
}
function saveTracker(t) { fs.writeFileSync(TRACKER, JSON.stringify(t, null, 2)); }

function nextGroup(tracker) {
  const cutoff = Date.now() - 23 * 60 * 60 * 1000; // 23h ago
  for (const url of GROUPS) {
    const last = tracker[url]?.lastPosted;
    if (!last || new Date(last).getTime() < cutoff) return url;
  }
  return null; // all groups posted to today
}

function getPost() {
  const day = Math.floor(Date.now() / 86400000);
  return POSTS[day % POSTS.length];
}

async function postToGroup(page, url, postText) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(4000);

  // Try multiple selectors for the post box
  const selectors = [
    '[aria-label*="Write something"]',
    '[data-testid="status-attachment-mentions-input"]',
    '[contenteditable="true"][role="textbox"]',
    '[aria-placeholder*="Write"]',
  ];

  let clicked = false;
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 5000 });
      clicked = true;
      break;
    } catch {}
  }

  if (!clicked) {
    // Try clicking the "What's on your mind" style area
    const found = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[role="button"], [tabindex="0"]')];
      const box = els.find(e => e.getAttribute('aria-label')?.includes('Write') || e.textContent?.includes("What's on your mind"));
      if (box) { box.click(); return true; }
      return false;
    });
    if (!found) throw new Error('Post box not found');
    await sleep(1500);
  }

  await sleep(1500);
  await page.keyboard.type(postText, { delay: 15 });
  await sleep(2000);

  // Click Post button
  const posted = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="button"]')];
    const btn  = btns.find(b => {
      const txt = b.textContent?.trim();
      return txt === 'Post' || txt === 'Share' || txt === 'Share now';
    });
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!posted) throw new Error('Post button not found — check if the post box opened');
  await sleep(4000);
}

async function main() {
  const tracker = loadTracker();
  const groupUrl = nextGroup(tracker);

  if (!groupUrl) {
    log('✅ All groups posted to in the last 23h. Nothing to do.');
    return;
  }

  const groupName = groupUrl.split('/groups/')[1] || groupUrl;
  const postText  = getPost();

  if (DRY_RUN) {
    log(`DRY RUN: Would post to ${groupName}`);
    console.log('\nPost:\n' + postText);
    return;
  }

  log(`📤 Posting to: ${groupName}`);

  if (!fs.existsSync(SESSION)) fs.mkdirSync(SESSION, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    // Check login state
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const notLoggedIn = await page.$('input[name="email"]');
    if (notLoggedIn) {
      log('❌ Not logged in to Facebook. Run: node scripts/group-poster.js --login');
      await browser.close();
      return;
    }

    await postToGroup(page, groupUrl, postText);

    tracker[groupUrl] = { lastPosted: new Date().toISOString() };
    saveTracker(tracker);
    log(`✅ Posted to ${groupName}`);

    // Stats
    const today   = new Date().toISOString().slice(0, 10);
    const todayCount = Object.values(tracker).filter(v => v.lastPosted?.startsWith(today)).length;
    log(`   Posts today: ${todayCount} | Groups remaining: ${GROUPS.length - todayCount}`);

  } catch (err) {
    log(`❌ Failed: ${err.message}`);
  } finally {
    await browser.close();
  }
}

// ── Facebook login helper (run with --login) ──────────────────────────────────
async function loginMode() {
  log('Opening Facebook for login...');
  if (!fs.existsSync(SESSION)) fs.mkdirSync(SESSION, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });

  log('⏳ Log in to Facebook in the browser window, then press ENTER here...');
  await new Promise(r => process.stdin.once('data', r));

  log('✅ Session saved! Close the browser.');
  await browser.close();
}

if (process.argv.includes('--login')) {
  loginMode().catch(err => { console.error(err.message); process.exit(1); });
} else {
  main().catch(err => { log(`❌ Fatal: ${err.message}`); process.exit(0); });
}
