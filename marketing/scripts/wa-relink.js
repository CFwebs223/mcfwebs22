#!/usr/bin/env node
/**
 * WhatsApp QR Scanner — fresh link, no cached session
 * Run: node marketing/scripts/wa-relink.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path   = require('path');
const fs     = require('fs');

const NUM     = process.argv[2] === '2' ? 2 : 1;
const SESSION = path.join(__dirname, '../leads/sessions', `wa-number-${NUM}`);
const CHROME  = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// Wipe any stale session so we always get a fresh QR
if (fs.existsSync(SESSION)) {
  fs.rmSync(SESSION, { recursive: true, force: true });
}
fs.mkdirSync(SESSION, { recursive: true });

console.log('\n╔═══════════════════════════════════╗');
console.log(`║  WhatsApp Link — Number ${NUM}          ║`);
console.log('╚═══════════════════════════════════╝');
console.log('\n⏳ Starting Chrome... (15–30 seconds)\n');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION }),
  puppeteer: {
    headless: true,
    executablePath: CHROME,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-proxy-server',
      '--proxy-bypass-list=*',
      '--window-size=800,600',
    ],
  },
});

client.on('qr', (qr) => {
  console.clear();
  console.log('╔═══════════════════════════════════════════╗');
  console.log(`║  Scan with WhatsApp Number ${NUM}             ║`);
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  WhatsApp → ⋮ Menu → Linked Devices       ║');
  console.log('║  → Link a Device → scan below             ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  qrcode.generate(qr, { small: true });
  console.log('\n⏳ Waiting for scan... (60 seconds to expire)\n');
});

client.on('authenticated', () => {
  console.log('\n✅ Authenticated! Saving session...');
});

client.on('ready', () => {
  console.log(`✅ Number ${NUM} is connected and ready!`);
  if (NUM === 1) {
    console.log('\nNow connect Number 2:');
    console.log('  node marketing/scripts/wa-relink.js 2\n');
    console.log('Then start the engine:');
    console.log('  pm2 start mcf-engine\n');
  } else {
    console.log('\nBoth numbers linked! Start the engine:');
    console.log('  pm2 start mcf-engine\n');
  }
  process.exit(0);
});

client.on('auth_failure', () => {
  console.error('\n❌ Auth failed — run the script again and scan faster');
  process.exit(1);
});

client.on('disconnected', () => {
  console.error('\n❌ Disconnected — run the script again');
  process.exit(1);
});

client.initialize();

setTimeout(() => {
  console.log('\n⏰ Timed out after 3 minutes. Run the script again.');
  process.exit(1);
}, 3 * 60 * 1000);
