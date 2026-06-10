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

// ── 200+ SA Facebook groups ────────────────────────────────────────────────────
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
  'https://www.facebook.com/groups/capeflats.community',
  'https://www.facebook.com/groups/southernsuburbs.ct',
  'https://www.facebook.com/groups/northernsuburbs.capetown',
  'https://www.facebook.com/groups/tableviewbiznetwork',
  'https://www.facebook.com/groups/stellenboschbusiness',
  'https://www.facebook.com/groups/paarlbusiness',
  'https://www.facebook.com/groups/georgebusiness',
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
  'https://www.facebook.com/groups/randburg.business',
  'https://www.facebook.com/groups/roodepoort.business',
  'https://www.facebook.com/groups/midrand.business',
  'https://www.facebook.com/groups/centurionbiz',
  'https://www.facebook.com/groups/eastrand.business',
  'https://www.facebook.com/groups/westrand.entrepreneurs',
  'https://www.facebook.com/groups/fourways.business',
  'https://www.facebook.com/groups/alberton.business',
  'https://www.facebook.com/groups/germiston.business',
  // Pretoria
  'https://www.facebook.com/groups/pretoriabusiness',
  'https://www.facebook.com/groups/pretoriabusinessnetwork',
  'https://www.facebook.com/groups/tshwanebusiness',
  'https://www.facebook.com/groups/pretoriaentrepreneurs',
  'https://www.facebook.com/groups/pretoriaservices',
  'https://www.facebook.com/groups/pretoria.north.business',
  'https://www.facebook.com/groups/lynnwood.business',
  // Durban / KZN
  'https://www.facebook.com/groups/durbanbusiness',
  'https://www.facebook.com/groups/kznbusiness',
  'https://www.facebook.com/groups/durbanbusinessnetwork',
  'https://www.facebook.com/groups/durbanservices',
  'https://www.facebook.com/groups/kznentrepreneurs',
  'https://www.facebook.com/groups/umhlanga.business',
  'https://www.facebook.com/groups/pinetown.business',
  'https://www.facebook.com/groups/westville.business',
  'https://www.facebook.com/groups/pietermaritzburg.biz',
  'https://www.facebook.com/groups/newcastle.kzn.business',
  // Port Elizabeth / Gqeberha
  'https://www.facebook.com/groups/portgelizabethbusiness',
  'https://www.facebook.com/groups/gqeberhaforbusiness',
  'https://www.facebook.com/groups/peentrepreneurs',
  'https://www.facebook.com/groups/easternCapebusiness',
  // East London / Bloemfontein
  'https://www.facebook.com/groups/eastlondonbusiness',
  'https://www.facebook.com/groups/bloemfonteinthebusiness',
  'https://www.facebook.com/groups/freestatebusiness',
  'https://www.facebook.com/groups/eastlondon.entrepreneurs',
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
  'https://www.facebook.com/groups/sabizconnect',
  'https://www.facebook.com/groups/smesouthafrica',
  'https://www.facebook.com/groups/southafricaSMEs',
  'https://www.facebook.com/groups/safemaleentrepreneurs',
  'https://www.facebook.com/groups/saentrepreneurswomen',
  'https://www.facebook.com/groups/youngentrepreneurssa',
  'https://www.facebook.com/groups/blackentrepreneurssa',
  'https://www.facebook.com/groups/startupgrindsa',
  'https://www.facebook.com/groups/entrepreneurssa',
  'https://www.facebook.com/groups/southafricastartups',
  'https://www.facebook.com/groups/womenentrepreneurssa',
  'https://www.facebook.com/groups/sabusinesswomen',
  'https://www.facebook.com/groups/bwasa',
  'https://www.facebook.com/groups/indianentrepreneurssa',
  'https://www.facebook.com/groups/safranchise',
  // Trade-specific
  'https://www.facebook.com/groups/saplumbers',
  'https://www.facebook.com/groups/saelectricians',
  'https://www.facebook.com/groups/sacleaners',
  'https://www.facebook.com/groups/sapaintersdecorators',
  'https://www.facebook.com/groups/saroofers',
  'https://www.facebook.com/groups/sacarpentry',
  'https://www.facebook.com/groups/salandscaping',
  'https://www.facebook.com/groups/sapestcontrol',
  'https://www.facebook.com/groups/samovers',
  'https://www.facebook.com/groups/salocksmiths',
  'https://www.facebook.com/groups/saaircon',
  'https://www.facebook.com/groups/sapoolservices',
  'https://www.facebook.com/groups/saseecurity',
  'https://www.facebook.com/groups/sa.handyman.services',
  // Home improvement
  'https://www.facebook.com/groups/sahomeimprovement',
  'https://www.facebook.com/groups/southafricarenovations',
  'https://www.facebook.com/groups/homeimprovementcapetown',
  'https://www.facebook.com/groups/homeimprovementjoburg',
  'https://www.facebook.com/groups/sarenovationcontractors',
  'https://www.facebook.com/groups/diy.south.africa',
  'https://www.facebook.com/groups/sa.building.construction',
  // Restaurants/food
  'https://www.facebook.com/groups/sarestaurants',
  'https://www.facebook.com/groups/cafes.sa',
  'https://www.facebook.com/groups/caterers.south.africa',
  'https://www.facebook.com/groups/bakers.sa',
  'https://www.facebook.com/groups/food.businesses.sa',
  // Beauty/health
  'https://www.facebook.com/groups/sa.beauty.professionals',
  'https://www.facebook.com/groups/hairsalons.sa',
  'https://www.facebook.com/groups/nailtech.south.africa',
  'https://www.facebook.com/groups/spa.wellness.sa',
  'https://www.facebook.com/groups/sa.fitness.gym.owners',
  // Automotive
  'https://www.facebook.com/groups/sa.mechanics',
  'https://www.facebook.com/groups/panel.beaters.sa',
  'https://www.facebook.com/groups/auto.business.sa',
  'https://www.facebook.com/groups/capetowntraders',
  'https://www.facebook.com/groups/sabuyselltrade',
  'https://www.facebook.com/groups/southafricamarketplace',
  // Digital / web
  'https://www.facebook.com/groups/sawebdesign',
  'https://www.facebook.com/groups/southafricadigital',
  'https://www.facebook.com/groups/safreelancedesigners',
  'https://www.facebook.com/groups/southafricait',
  'https://www.facebook.com/groups/satechbusiness',
  // Community / buy & sell
  'https://www.facebook.com/groups/cape.town.community.noticeboard',
  'https://www.facebook.com/groups/johannesburg.community',
  'https://www.facebook.com/groups/pretoria.community.board',
  'https://www.facebook.com/groups/durban.community.board',
  'https://www.facebook.com/groups/south.africa.noticeboard',
  'https://www.facebook.com/groups/sa.buy.sell.services',
  'https://www.facebook.com/groups/sa.community.marketplace',
  'https://www.facebook.com/groups/ct.buy.sell.swap',
  'https://www.facebook.com/groups/jhb.buy.sell.swap',
  // Professional services
  'https://www.facebook.com/groups/sa.accountants.bookkeepers',
  'https://www.facebook.com/groups/sa.photographers',
  'https://www.facebook.com/groups/sa.event.planners',
  'https://www.facebook.com/groups/sa.tutors.teachers',
  'https://www.facebook.com/groups/sa.estate.agents',
  'https://www.facebook.com/groups/sa.attorneys.network',
  'https://www.facebook.com/groups/sa.doctors.network',
  'https://www.facebook.com/groups/sa.dentists',
  'https://www.facebook.com/groups/sa.veterinarians',
  'https://www.facebook.com/groups/sa.driving.schools',
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
  `🚨 SA small business owners — READ THIS:

Every day your business doesn't have a website, potential clients Google your service, find your competitor's website, and call THEM instead of you.

This is happening right now.

MCF Websites fixes this:
✅ Professional website live in 5 days
✅ Shows up on Google searches
✅ WhatsApp button — leads go straight to your phone
✅ R2,500 once-off — ZERO monthly fees

🔒 *We build it first. You approve. Then you pay. Zero risk.*

Drop a 💬 below or WhatsApp 075 320 3477
🌐 mcfwebs.agency`,

  `💰 How much business are you losing without a website?

Quick math:
• 100 people Google your service in your city this month
• 80% click on websites
• You have no website → 80 potential clients go to your competitor

*That's happening every month.*

MCF Websites puts you on Google for R2,500 once-off.
→ No monthly fees
→ Built in 5 days
→ You pay ONLY when you love it

Tag a business owner who needs this 👇
📞 075 320 3477 | mcfwebs.agency`,

  `👋 Hey SA entrepreneurs and business owners!

If you offer a service but don't have a website — you're leaving money on the table every single day.

*MCF Websites* — we build websites for:
🔧 Plumbers, electricians, builders, painters
💇 Salons, barbershops, spas, nail techs
🏥 Doctors, dentists, physios, vets
🍽️ Restaurants, cafes, caterers, bakeries
🚗 Mechanics, panel beaters, car wash
📸 Photographers, event planners, tutors
And ANY other service business!

*From R2,500 once-off. Live in 5 days. Zero risk.*

WhatsApp now: 075 320 3477
🌐 mcfwebs.agency`,

  `🏆 *Case study: How we helped a Cape Town plumber double his bookings*

He'd been trading for 8 years. Zero online presence. Getting maybe 2-3 new clients a month from word of mouth.

We built him a 5-page website with Google SEO. Cost him R2,500 once-off.

Month 1: 8 new enquiries from Google.
Month 2: 12 enquiries.
Now he's fully booked and turning work away.

*One website. R2,500. Changed his business.*

Could this be you? WhatsApp 075 320 3477
🌐 mcfwebs.agency | We build first — you pay when you love it`,

  `📣 ATTENTION: Service businesses in South Africa

Here's why you're losing clients to competitors every day:

❌ They Google you → nothing comes up
❌ No website = no trust = no call
❌ Your competitor has a website → they get the call

Here's the fix:
✅ MCF Websites builds you a professional site in 5 days
✅ Google SEO so you show up locally
✅ WhatsApp button — instant client contact
✅ R2,500 once-off — no monthly fees EVER
✅ We build first — you pay only when happy

🔥 *Limited spots this month — building for 10 new businesses*

WhatsApp 075 320 3477 or comment below 👇
🌐 mcfwebs.agency`,

  `💡 The #1 reason SA businesses don't grow in 2026:

*They're invisible online.*

If I Google your business right now and can't find a website — you're invisible to every potential customer searching for your service.

MCF Websites solves this:
→ Professional website (5 pages, mobile-friendly)
→ Google SEO (local search optimised)
→ WhatsApp + booking button
→ Live in 5 working days
→ R2,500 once-off — no monthly fees
→ *Build first, pay later — zero risk*

DM me or WhatsApp 075 320 3477 🙏
🌐 mcfwebs.agency

Share this with someone who needs it! 👇`,

  `🌐 *WHO NEEDS A WEBSITE?* — Tag them below 👇

✅ Plumber without a website
✅ Electrician not on Google
✅ Salon with only Instagram
✅ Restaurant with no online menu
✅ Mechanic relying only on word of mouth
✅ Doctor/dentist not found online
✅ ANY business losing clients to competitors

MCF Websites — SA's most affordable professional web design
*R2,500 once-off | 5 days | Zero risk | No monthly fees*

We build first. You approve. Then you pay.

📞 075 320 3477 | 🌐 mcfwebs.agency`,

  `🔥 Stop losing clients to businesses with websites.

The truth: 87% of consumers research online before buying or booking any service. If you're not online, they don't find you.

*MCF Websites — professional sites for SA service businesses:*

🔨 Starter: R2,500 (3-5 pages + SEO + WhatsApp)
💼 Business: R4,500 (+ booking system + gallery)
🛒 Premium: R7,500 (+ online store + payments)

All packages:
✅ Mobile-friendly
✅ Google Maps listing
✅ Domain + hosting first year included
✅ Built in 5 days
✅ *You approve before you pay*

WhatsApp 075 320 3477 📱
🌐 mcfwebs.agency`,
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
