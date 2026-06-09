#!/usr/bin/env node
/**
 * WhatsApp Status Poster — posts MCF promo to WA status daily
 * Runs via PM2 at 9am every day.
 * Uses the same WhatsApp session as the engine (number 1).
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('fs');
const fs   = require('fs');

const CHROME   = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SESSION  = '/Users/mcfwebs/MCFwbes/marketing/leads/sessions/wa-number-1';
const IMG_DIR  = '/Users/mcfwebs/MCFwbes/marketing/images';
const LOG_FILE = '/Users/mcfwebs/MCFwbes/marketing/leads/wa-status.log';
const TRACKER  = '/Users/mcfwebs/MCFwbes/marketing/leads/wa-status-tracker.json';

const CAPTIONS = [
  `🌐 No website? You're losing customers every day.

MCF Websites builds affordable, professional websites for SA businesses.

✅ From R1,500 once-off
✅ Google SEO included
✅ Done in 5 days
✅ Risk-free — pay only if you love it

📱 WhatsApp 075 320 3477
www.mcfwebs.agency`,

  `💼 Every day without a website = clients going to your competitor.

MCF Websites — SA's most affordable web design.

Starting from R1,500. No monthly fees. Risk-free.

📲 Contact us: 075 320 3477 | mcfwebs.agency`,

  `📱 Attention SA business owners!

Is your business on Google? Can customers find you online?

If not — MCF Websites can fix that this week.

✅ Professional website from R1,500
✅ Mobile-friendly + Google SEO
✅ WhatsApp booking button
✅ We build first, you pay if you love it

Call/WhatsApp: 075 320 3477`,
];

function log(msg) {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function getImagePath() {
  const images = ['mcf-story.png', 'mcf-promo-1.png', 'mcf-promo-2.png', 'mcf-promo-3.png'];
  const day    = Math.floor(Date.now() / 86400000);
  const file   = images[day % images.length];
  const full   = `${IMG_DIR}/${file}`;
  return fs.existsSync(full) ? full : null;
}

function getCaption() {
  const day = Math.floor(Date.now() / 86400000);
  return CAPTIONS[day % CAPTIONS.length];
}

async function postStatus() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION }),
    puppeteer: {
      headless: true,
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  await new Promise((resolve, reject) => {
    client.on('ready', resolve);
    client.on('auth_failure', reject);
    client.on('qr', () => log('⚠️  QR needed — run engine first to authenticate'));
    client.initialize();
    setTimeout(() => reject(new Error('Connection timeout')), 60000);
  });

  log('✅ Connected to WhatsApp');

  const imgPath = getImagePath();
  const caption = getCaption();

  if (imgPath) {
    log(`📸 Posting status with image: ${imgPath}`);
    const media = MessageMedia.fromFilePath(imgPath);
    await client.sendMessage('status@broadcast', media, { caption });
  } else {
    log('📝 No image found — posting text status only');
    await client.sendMessage('status@broadcast', caption);
  }

  log('✅ WhatsApp Status posted!');

  // Save tracker
  const tracker = fs.existsSync(TRACKER) ? JSON.parse(fs.readFileSync(TRACKER, 'utf8')) : {};
  tracker.lastPosted = new Date().toISOString();
  tracker.totalPosted = (tracker.totalPosted || 0) + 1;
  fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));

  await client.destroy();
}

async function main() {
  log('🟢 WhatsApp Status Poster starting...');

  // Check if images exist, generate if not
  const img = getImagePath();
  if (!img) {
    log('🎨 No images found — generating them first...');
    const { execSync } = require('child_process');
    try {
      execSync('node /Users/mcfwebs/MCFwbes/marketing/scripts/generate-images.js', { stdio: 'inherit' });
    } catch (e) {
      log(`⚠️  Image generation failed: ${e.message}`);
    }
  }

  try {
    await postStatus();
  } catch (err) {
    log(`❌ Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
