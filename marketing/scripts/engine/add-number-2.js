#!/usr/bin/env node
/**
 * Links WhatsApp number 2.
 * Run in a REAL terminal (not Claude Code):
 *   node marketing/scripts/engine/add-number-2.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs     = require('fs');
const path   = require('path');

const SESSION = path.join(__dirname, '../../leads/sessions/wa-number-2');
const CHROME  = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// Always start fresh — delete any leftover partial session
if (fs.existsSync(SESSION)) {
  fs.rmSync(SESSION, { recursive: true, force: true });
  console.log('🗑️  Cleared old partial session\n');
}

console.log('━'.repeat(50));
console.log('  LINKING WHATSAPP NUMBER 2');
console.log('━'.repeat(50));
console.log('1. Open WhatsApp on your SECOND phone');
console.log('2. Tap Menu (⋮ or Settings) → Linked Devices');
console.log('3. Tap "Link a Device"');
console.log('4. Scan the QR code that appears below\n');
console.log('Connecting to WhatsApp... (may take 15–30 seconds)\n');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION }),
  puppeteer: {
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', (qr) => {
  console.clear();
  console.log('━'.repeat(50));
  console.log('  SCAN THIS QR CODE WITH YOUR SECOND PHONE');
  console.log('━'.repeat(50) + '\n');
  qrcode.generate(qr, { small: true });
  console.log('\n  WhatsApp → Linked Devices → Link a Device → Scan\n');
  console.log('  Waiting for scan... (QR refreshes every 20s)\n');
});

client.on('authenticated', () => {
  console.log('\n✅ QR scanned — saving session...');
});

client.on('ready', async () => {
  const info = client.info;
  console.log('\n🎉 SUCCESS! WhatsApp number 2 linked!');
  console.log(`   Phone: ${info?.wid?.user || 'connected'}`);
  console.log('   The engine will now send via BOTH numbers automatically.');
  console.log('   You can close this terminal.\n');
  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('\n❌ Auth failed:', msg);
  console.error('   Delete marketing/leads/sessions/wa-number-2 and try again.\n');
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.error('\n⚠️  Disconnected:', reason);
  process.exit(1);
});

client.initialize();

// Timeout after 5 minutes
setTimeout(() => {
  console.log('\n⏰ Timeout — QR not scanned within 5 minutes.');
  console.log('   Run the script again to get a fresh QR code.\n');
  process.exit(1);
}, 5 * 60 * 1000);
