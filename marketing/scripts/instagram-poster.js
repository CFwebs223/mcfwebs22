#!/usr/bin/env node
/**
 * MCF Instagram Auto-Poster
 * Posts daily to MCF's Instagram feed with branded images + hashtags.
 *
 * First time (login):
 *   node marketing/scripts/instagram-poster.js --login
 *
 * Auto-runs daily at 10am via PM2.
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME    = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SESSION   = path.join(__dirname, '../leads/ig-session');
const LOG_FILE  = path.join(__dirname, '../leads/instagram.log');
const TRACKER   = path.join(__dirname, '../leads/ig-tracker.json');
const IMG_DIR   = path.join(__dirname, '../images');

const HASHTAGS = `#WebDesignSA #SouthAfricaBusiness #SmallBusinessSA #WebDesign #CapeTownBusiness #JoburgBusiness #SouthAfrica #MCFWebsites #AffordableWebsite #BusinessWebsite #SAEntrepreneur #GrowYourBusiness #DigitalMarketing #WebDevelopment #OnlineBusiness #SmallBizSA #BusinessGrowth #ProfessionalWebsite #GoogleSEO #WebsiteDesign`;

const CAPTIONS = [
  `🌐 Your business deserves to be found online.

At MCF Websites, we build fast, professional websites for SA small businesses — starting from just R1,500.

✅ Mobile-friendly design
✅ Google SEO setup
✅ WhatsApp booking button
✅ Done in 5 working days
✅ Risk-free: pay only if you love it

📱 WhatsApp: 075 320 3477
🔗 mcfwebs.agency

${HASHTAGS}`,

  `💼 Losing clients because you're not online? We fix that.

Plumbers, electricians, doctors, lawyers, beauty salons — if you serve clients, you need a website.

MCF Websites builds professional websites for SA service businesses:
→ Starter from R1,500
→ Business from R4,500 (with booking system)
→ Premium from R7,500 (with online store)

No upfront risk. Build first. Pay if you love it.

📲 075 320 3477 | mcfwebs.agency

${HASHTAGS}`,

  `🚀 5 reasons your SA business needs a website in 2026:

1️⃣ Customers Google businesses before calling
2️⃣ No website = no trust = no call
3️⃣ Your competitor already has one
4️⃣ A website works for you 24/7
5️⃣ R1,500 once-off pays for itself with 1 client

MCF Websites — SA's most affordable web design.
📱 WhatsApp 075 320 3477

${HASHTAGS}`,
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

function getImagePath() {
  const images = ['mcf-promo-1.png', 'mcf-promo-2.png', 'mcf-promo-3.png'];
  const day    = Math.floor(Date.now() / 86400000);
  const file   = images[day % images.length];
  return path.join(IMG_DIR, file);
}

function getCaption() {
  const day = Math.floor(Date.now() / 86400000);
  return CAPTIONS[day % CAPTIONS.length];
}

async function loginMode() {
  log('🔑 Instagram login mode — save session for auto-posting');
  const browser = await puppeteer.launch({
    headless: false, // show browser for manual login
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

  log('👆 Log in to Instagram in the browser that opened.');
  log('   Once logged in and on your feed, press Enter here...');

  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });

  await browser.close();
  log('✅ Instagram session saved! Auto-posting will now work.');
}

async function postToInstagram() {
  const tracker = loadTracker();
  const today   = new Date().toISOString().slice(0, 10);

  if (tracker.lastPosted?.startsWith(today)) {
    log('⏭️  Already posted today — skipping');
    return;
  }

  const imgPath = getImagePath();
  if (!fs.existsSync(imgPath)) {
    log(`❌ Image not found: ${imgPath} — run generate-images.js first`);
    process.exit(1);
  }

  const caption = getCaption();

  log('🚀 Opening Instagram...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    userDataDir: SESSION,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Check if logged in
    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name="username"]'));
    if (!isLoggedIn) {
      log('❌ Not logged in — run: node instagram-poster.js --login');
      await browser.close();
      process.exit(1);
    }

    // Click "New Post" button (the + icon or Create button)
    log('📸 Creating new post...');

    // Try the Create button in nav
    const createSelectors = [
      '[aria-label="New post"]',
      '[aria-label="Create"]',
      'svg[aria-label="New post"]',
    ];

    let clicked = false;
    for (const sel of createSelectors) {
      try {
        await page.click(sel, { timeout: 5000 });
        clicked = true;
        break;
      } catch {}
    }

    if (!clicked) {
      // Try finding via text
      await page.evaluate(() => {
        const items = [...document.querySelectorAll('span, div')];
        const btn = items.find(el => el.textContent.trim() === 'Create' || el.getAttribute('aria-label')?.includes('Create'));
        if (btn) btn.click();
      });
      await sleep(1000);
    }

    await sleep(2000);

    // Upload image
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      log('❌ Could not find file upload — Instagram UI may have changed');
      await browser.close();
      process.exit(1);
    }

    await fileInput.uploadFile(imgPath);
    log(`✅ Image uploaded: ${path.basename(imgPath)}`);
    await sleep(4000);

    // Click Next (may need to click twice)
    for (let i = 0; i < 3; i++) {
      try {
        const nextBtn = await page.$x('//button[text()="Next" or text()="next"]');
        if (nextBtn.length) { await nextBtn[0].click(); await sleep(2000); }
        else {
          await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button, div[role="button"]')];
            const next = btns.find(b => b.textContent.trim() === 'Next');
            if (next) next.click();
          });
          await sleep(2000);
        }
      } catch {}
    }

    // Add caption
    log('✍️  Adding caption...');
    const captionBox = await page.$('textarea, div[contenteditable="true"][aria-label*="caption"], div[contenteditable="true"][placeholder*="caption"]');
    if (captionBox) {
      await captionBox.click();
      await sleep(500);
      await page.keyboard.type(caption, { delay: 10 });
    }
    await sleep(2000);

    // Click Share
    log('📤 Sharing post...');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, div[role="button"]')];
      const share = btns.find(b => b.textContent.trim() === 'Share');
      if (share) share.click();
    });
    await sleep(5000);

    tracker.lastPosted = new Date().toISOString();
    tracker.totalPosted = (tracker.totalPosted || 0) + 1;
    saveTracker(tracker);
    log(`✅ Instagram post #${tracker.totalPosted} shared!`);

  } catch (err) {
    log(`❌ Error: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes('--login')) {
    await loginMode();
    return;
  }

  // Ensure images exist
  if (!fs.existsSync(getImagePath())) {
    log('🎨 Generating marketing images first...');
    const { execSync } = require('child_process');
    try { execSync('node ' + path.join(__dirname, 'generate-images.js'), { stdio: 'inherit' }); } catch {}
  }

  try {
    await postToInstagram();
  } catch (err) {
    log(`❌ Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
