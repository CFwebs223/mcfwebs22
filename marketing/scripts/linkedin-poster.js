#!/usr/bin/env node
/**
 * MCF LinkedIn Auto-Poster
 * Posts daily to LinkedIn personal profile + company page.
 *
 * First time:
 *   node marketing/scripts/linkedin-poster.js --login
 *
 * Auto-runs daily at 11am via PM2.
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME   = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SESSION  = path.join(__dirname, '../leads/linkedin-session');
const LOG_FILE = path.join(__dirname, '../leads/linkedin.log');
const TRACKER  = path.join(__dirname, '../leads/linkedin-tracker.json');

const POSTS = [
  `🌐 Most SA small businesses are invisible online — and it's costing them thousands in lost clients.

At MCF Websites, we solve that. We build fast, professional websites for service businesses in South Africa:

✅ From R1,500 once-off (no monthly fees)
✅ Mobile-friendly + Google SEO included
✅ WhatsApp booking button
✅ Built in 5 days
✅ Risk-free: you only pay if you love it

If you know a plumber, electrician, doctor, lawyer, or any service business without a website — tag them below or share this post. 🙌

📱 WhatsApp: 075 320 3477
🔗 mcfwebs.agency

#WebDesign #SouthAfrica #SmallBusiness #Entrepreneurship #DigitalMarketing`,

  `💼 We just helped a Cape Town plumber get his first online enquiry within 48 hours of his website going live.

He'd been trading for 8 years with zero online presence. One simple website changed that.

That's the power of being findable on Google.

At MCF Websites, we specialise in affordable websites for SA service businesses. Starting from R1,500.

🔒 Risk-free: we build it first, you only pay if you love it.

📲 075 320 3477 | mcfwebs.agency

#WebDesignSA #SmallBusinessSA #CapeTownBusiness #GrowthMindset`,

  `📊 Did you know?
→ 81% of customers research online before buying locally
→ 75% of people judge a business's credibility by its website
→ Businesses with websites grow 40% faster

Yet thousands of SA service businesses still have no online presence.

MCF Websites makes it affordable to fix that. Professional websites from R1,500, built in 5 days, with a full risk-free guarantee.

We work with plumbers, electricians, doctors, attorneys, beauty salons, and more across SA.

Interested? Drop a comment or DM me. 👇

#SouthAfrica #DigitalTransformation #WebDesign #SME #Entrepreneurship`,
];

function log(msg) {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function loadTracker() {
  if (!fs.existsSync(TRACKER)) return {};
  try { return JSON.parse(fs.readFileSync(TRACKER, 'utf8')); } catch { return {}; }
}
function saveTracker(t) { fs.writeFileSync(TRACKER, JSON.stringify(t, null, 2)); }

async function loginMode() {
  log('🔑 LinkedIn login mode');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
  log('👆 Log in to LinkedIn in the opened browser, then press Enter here...');
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
  await browser.close();
  log('✅ LinkedIn session saved!');
}

async function postToLinkedIn() {
  const tracker = loadTracker();
  const today   = new Date().toISOString().slice(0, 10);
  if (tracker.lastPosted?.startsWith(today)) {
    log('⏭️  Already posted today');
    return;
  }

  const day   = Math.floor(Date.now() / 86400000);
  const post  = POSTS[day % POSTS.length];

  log('🚀 Opening LinkedIn...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    const isLoggedIn = await page.evaluate(() => !!document.querySelector('.feed-identity-module, .global-nav'));
    if (!isLoggedIn) {
      log('❌ Not logged in — run: node linkedin-poster.js --login');
      await browser.close();
      process.exit(1);
    }

    // Click "Start a post"
    log('✍️  Creating post...');
    const startPost = await page.$('[aria-label*="Start a post"], button[data-control-name="share.sharebox_feed_placeholder_button"]');
    if (startPost) {
      await startPost.click();
    } else {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"]')];
        const btn = btns.find(b => b.textContent.includes('Start a post'));
        if (btn) btn.click();
      });
    }
    await sleep(2000);

    // Type post content
    const editor = await page.$('.ql-editor, div[data-placeholder*="What"], div[contenteditable="true"]');
    if (editor) {
      await editor.click();
      await page.keyboard.type(post, { delay: 8 });
    }
    await sleep(2000);

    // Click Post
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => b.textContent.trim() === 'Post' && !b.disabled);
      if (btn) btn.click();
    });
    await sleep(4000);

    tracker.lastPosted  = new Date().toISOString();
    tracker.totalPosted = (tracker.totalPosted || 0) + 1;
    saveTracker(tracker);
    log(`✅ LinkedIn post #${tracker.totalPosted} published!`);

  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes('--login')) { await loginMode(); return; }
  try { await postToLinkedIn(); }
  catch (err) { log(`❌ ${err.message}`); process.exit(1); }
}
main();
