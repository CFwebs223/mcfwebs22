#!/usr/bin/env node
/**
 * MCF Websites — Gumtree SA Auto-Poster
 *
 * Posts a "Web Design Services" ad on Gumtree.co.za.
 * Gumtree allows 1 ad per category per day on free accounts.
 *
 * Usage:
 *   node scripts/gumtree-poster.js          Post/refresh today's ad
 *   node scripts/gumtree-poster.js --dry    Preview ad without posting
 */

const puppeteer  = require('puppeteer');
const fs         = require('fs');
const path       = require('path');

const CHROME     = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SESSION    = path.join(__dirname, '../leads/gumtree-session');
const TRACKER    = path.join(__dirname, '../leads/gumtree-tracker.json');
const DRY_RUN    = process.argv.includes('--dry');

const AD = {
  title:       'Professional Website Design for Small Businesses — From R1,500',
  price:       '1500',
  description: `Is your business missing out on clients because you don't have a website?

At MCF Websites, we build fast, professional websites for small businesses across South Africa — at a price that makes sense.

✅ STARTER — R1,500
• 3-5 page professional website
• Mobile-friendly & Google SEO
• WhatsApp call-to-action button
• Contact form

✅ BUSINESS — R4,500
• Up to 8 pages
• Online booking system
• Photo gallery & Google Maps
• Full social media integration

✅ PREMIUM — R7,500
• Full online store
• Payment gateway (PayFast/Yoco)
• Unlimited products
• Monthly support included

🔒 RISK-FREE GUARANTEE: We build your site first. You only pay if you love it.

We've built websites for plumbers, cleaners, painters, electricians, and many more service businesses across Cape Town, Johannesburg, and Pretoria.

📱 WhatsApp: 075 320 3477
🌐 www.mcfwebs.agency
📧 feletchristopher@gmail.com

Call or WhatsApp us today for a FREE consultation!`,
  category:    'computers-internet/web-design',
  location:    'Cape Town',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadTracker() {
  if (!fs.existsSync(TRACKER)) return {};
  try { return JSON.parse(fs.readFileSync(TRACKER, 'utf8')); } catch { return {}; }
}

function saveTracker(t) { fs.writeFileSync(TRACKER, JSON.stringify(t, null, 2)); }

function postedToday(t) {
  return t.lastPosted?.startsWith(new Date().toISOString().slice(0, 10));
}

async function main() {
  console.log('\n📋 MCF GUMTREE POSTER');
  const tracker = loadTracker();

  if (postedToday(tracker) && !DRY_RUN) {
    console.log('✅ Already posted on Gumtree today.\n');
    return;
  }

  console.log('\n📝 Ad preview:');
  console.log(`  Title: ${AD.title}`);
  console.log(`  Price: R${AD.price}`);
  console.log(`  Location: ${AD.location}\n`);

  if (DRY_RUN) {
    console.log('(DRY RUN — not posting)\n');
    return;
  }

  if (!fs.existsSync(SESSION)) fs.mkdirSync(SESSION, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  try {
    // Go to Gumtree login
    await page.goto('https://www.gumtree.co.za/a-login.html', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Check if logged in
    const loggedIn = await page.evaluate(() => !document.querySelector('#email'));
    if (!loggedIn) {
      console.log('\n⏳ Please log in to Gumtree in the browser window...');
      console.log('   Waiting up to 2 minutes...\n');
      await page.waitForFunction(() => !document.querySelector('#email'), { timeout: 120000 });
      console.log('✅ Logged in!\n');
    }

    // Navigate to post ad
    await page.goto('https://www.gumtree.co.za/p-post-ad.html', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Select category (Computers & Internet > Web Design)
    console.log('📂 Selecting category...');
    try {
      await page.click('[data-category*="computers"], [href*="computers-internet"]');
      await sleep(1000);
      await page.click('[data-category*="web-design"], [href*="web-design"]');
      await sleep(1000);
    } catch {
      console.log('  ⚠️  Category selection may need manual help — browser is open');
    }

    // Fill in title
    const titleInput = await page.$('#subject, [name="subject"], #ad-title');
    if (titleInput) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.type(AD.title);
    }
    await sleep(500);

    // Fill in description
    const descInput = await page.$('#description, [name="description"], textarea');
    if (descInput) {
      await descInput.click({ clickCount: 3 });
      await descInput.type(AD.description, { delay: 10 });
    }
    await sleep(500);

    // Fill in price
    const priceInput = await page.$('#price, [name="price"]');
    if (priceInput) {
      await priceInput.click({ clickCount: 3 });
      await priceInput.type(AD.price);
    }
    await sleep(500);

    console.log('\n⏳ Ad form filled. Review the browser and click "Post Ad" when ready.');
    console.log('   Waiting 5 minutes for you to submit...\n');
    await sleep(300000); // wait 5 min for manual submit

    tracker.lastPosted = new Date().toISOString();
    tracker.title      = AD.title;
    saveTracker(tracker);
    console.log('✅ Ad marked as posted!\n');

  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
