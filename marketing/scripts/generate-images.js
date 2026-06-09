#!/usr/bin/env node
/**
 * Generates branded marketing images for Instagram, LinkedIn, WhatsApp Status.
 * Uses Puppeteer to render HTML → PNG (no extra dependencies).
 * Run once to create images, or add --regen to refresh them.
 *
 *   node marketing/scripts/generate-images.js
 */

const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const CHROME  = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT_DIR = path.join(__dirname, '../images');

const DESIGNS = [
  {
    file: 'mcf-promo-1.png',
    html: `
<div style="width:1080px;height:1080px;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:80px;box-sizing:border-box">
  <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:60px;text-align:center;width:100%;box-sizing:border-box">
    <div style="font-size:56px;font-weight:900;color:#fff;margin-bottom:8px">MCF WEBSITES</div>
    <div style="font-size:24px;color:#a78bfa;margin-bottom:48px;letter-spacing:4px">WEB DESIGN · SOUTH AFRICA</div>
    <div style="font-size:40px;font-weight:700;color:#fff;margin-bottom:32px;line-height:1.3">No website = <span style="color:#f97316">losing clients</span><br>every single day</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:48px">
      <div style="background:rgba(167,139,250,0.15);border-radius:12px;padding:20px;color:#fff;font-size:20px">✅ From R1,500</div>
      <div style="background:rgba(167,139,250,0.15);border-radius:12px;padding:20px;color:#fff;font-size:20px">✅ 5-day turnaround</div>
      <div style="background:rgba(167,139,250,0.15);border-radius:12px;padding:20px;color:#fff;font-size:20px">✅ Risk-free guarantee</div>
      <div style="background:rgba(167,139,250,0.15);border-radius:12px;padding:20px;color:#fff;font-size:20px">✅ Google SEO included</div>
    </div>
    <div style="background:#f97316;border-radius:100px;padding:20px 48px;display:inline-block;font-size:28px;font-weight:700;color:#fff">WhatsApp 075 320 3477</div>
    <div style="color:#a78bfa;font-size:20px;margin-top:20px">www.mcfwebs.agency</div>
  </div>
</div>`,
  },
  {
    file: 'mcf-promo-2.png',
    html: `
<div style="width:1080px;height:1080px;background:linear-gradient(135deg,#064e3b,#065f46,#047857);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:80px;box-sizing:border-box">
  <div style="text-align:center">
    <div style="font-size:80px;margin-bottom:24px">💼</div>
    <div style="font-size:54px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:24px">SA Small Business Owners<br><span style="color:#6ee7b7">— this is for you</span></div>
    <div style="font-size:26px;color:#d1fae5;margin-bottom:48px;line-height:1.6">Your customers are Googling you right now.<br>If they can't find you, they call your competitor.</div>
    <div style="background:rgba(255,255,255,0.15);border-radius:20px;padding:40px;margin-bottom:40px">
      <div style="font-size:72px;font-weight:900;color:#fff">R1,500</div>
      <div style="font-size:24px;color:#6ee7b7">Professional website · Once-off · No monthly fees</div>
    </div>
    <div style="font-size:28px;color:#fff;font-weight:700">📱 075 320 3477 · mcfwebs.agency</div>
    <div style="font-size:20px;color:#6ee7b7;margin-top:12px">We build first. You only pay if you love it. ✅</div>
  </div>
</div>`,
  },
  {
    file: 'mcf-promo-3.png',
    html: `
<div style="width:1080px;height:1080px;background:#1e1b4b;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:60px;box-sizing:border-box">
  <div style="text-align:center">
    <div style="font-size:28px;color:#818cf8;letter-spacing:6px;margin-bottom:16px">MCF WEBSITES</div>
    <div style="font-size:64px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:32px">We Build Websites<br>That <span style="background:linear-gradient(90deg,#f97316,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Win Clients</span></div>
    <div style="border-top:1px solid rgba(255,255,255,0.15);border-bottom:1px solid rgba(255,255,255,0.15);padding:32px 0;margin-bottom:40px">
      <div style="font-size:22px;color:#c7d2fe;line-height:2">🔧 Plumbers · Electricians · Painters<br>🏥 Doctors · Dentists · Lawyers<br>🌿 Cleaners · Gardeners · Tradesmen</div>
    </div>
    <div style="display:flex;gap:20px;justify-content:center;margin-bottom:40px">
      <div style="background:rgba(99,102,241,0.3);border:1px solid #6366f1;border-radius:12px;padding:16px 24px;color:#fff;font-size:20px">💰 From R1,500</div>
      <div style="background:rgba(99,102,241,0.3);border:1px solid #6366f1;border-radius:12px;padding:16px 24px;color:#fff;font-size:20px">⚡ 5 Days</div>
      <div style="background:rgba(99,102,241,0.3);border:1px solid #6366f1;border-radius:12px;padding:16px 24px;color:#fff;font-size:20px">🔒 Risk-Free</div>
    </div>
    <div style="font-size:30px;font-weight:700;color:#f97316">📲 WhatsApp: 075 320 3477</div>
    <div style="font-size:20px;color:#818cf8;margin-top:12px">mcfwebs.agency</div>
  </div>
</div>`,
  },
  {
    file: 'mcf-story.png',
    width: 1080,
    height: 1920,
    html: `
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#0f0c29 0%,#302b63 50%,#24243e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:80px;box-sizing:border-box">
  <div style="text-align:center;width:100%">
    <div style="font-size:36px;color:#a78bfa;letter-spacing:6px;margin-bottom:32px">MCF WEBSITES</div>
    <div style="font-size:80px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:40px">Get Your<br>Business<br><span style="color:#f97316">Online</span><br>Today</div>
    <div style="background:rgba(255,255,255,0.08);border-radius:24px;padding:48px;margin-bottom:48px">
      <div style="font-size:28px;color:#e2e8f0;line-height:2.2">✅ Professional website<br>✅ Google SEO setup<br>✅ Mobile-friendly<br>✅ WhatsApp button<br>✅ Done in 5 days<br>✅ Risk-free guarantee</div>
    </div>
    <div style="background:#f97316;border-radius:100px;padding:28px 60px;display:inline-block;margin-bottom:32px">
      <div style="font-size:36px;font-weight:900;color:#fff">From R1,500</div>
    </div>
    <div style="font-size:32px;color:#fff;font-weight:700;margin-bottom:16px">📱 075 320 3477</div>
    <div style="font-size:24px;color:#a78bfa">www.mcfwebs.agency</div>
  </div>
</div>`,
  },
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const regen = process.argv.includes('--regen');
  const needed = DESIGNS.filter(d => regen || !fs.existsSync(path.join(OUT_DIR, d.file)));
  if (needed.length === 0) {
    console.log('✅ All images already generated. Use --regen to recreate.');
    return;
  }

  console.log(`\n🎨 Generating ${needed.length} marketing image(s)...`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const design of needed) {
      const page  = await browser.newPage();
      const w     = design.width  || 1080;
      const h     = design.height || 1080;
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden">${design.html}</body></html>`);
      const outPath = path.join(OUT_DIR, design.file);
      await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
      await page.close();
      console.log(`  ✅ ${design.file}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✅ Images saved to marketing/images/\n`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
