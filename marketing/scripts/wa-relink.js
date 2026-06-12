#!/usr/bin/env node
/**
 * WhatsApp Re-Link — run this when WhatsApp needs re-scanning
 * Usage: node marketing/scripts/wa-relink.js
 * Then scan the QR code that appears in the terminal.
 * Once connected it saves the session and exits automatically.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../leads/.env') });

const path = require('path');
const { createClient } = require('./engine/wa-client');

const SESSION_PATH = path.join(__dirname, '../leads/wa-session');

console.log('\n🔗 MCF WhatsApp Re-Link');
console.log('═══════════════════════════════');
console.log('This will connect your WhatsApp to LEADAPP.\n');
console.log('Steps:');
console.log('1. Open WhatsApp on your phone');
console.log('2. Tap ⋮ Menu → Linked Devices → Link a Device');
console.log('3. Scan the QR code that appears below\n');
console.log('Starting Chrome... (takes 10-20 seconds)\n');

const client = createClient(SESSION_PATH, 1);

client.on('loading_screen', (pct) => {
  if (pct === 100) process.stdout.write('\r✅ WhatsApp loading... 100%\n');
  else process.stdout.write(`\rLoading WhatsApp... ${pct}%`);
});

client.on('authenticated', () => {
  console.log('\n✅ Authenticated! Session saved.');
});

client.on('ready', () => {
  console.log('✅ WhatsApp connected and ready!');
  console.log('\n📱 Your WhatsApp is now linked to LEADAPP.');
  console.log('Run: pm2 restart mcf-engine\n');
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('\n❌ Auth failed:', msg);
  console.log('Try again — make sure you scan within 60 seconds of the QR appearing.');
  process.exit(1);
});

client.initialize();

// Timeout if nothing happens in 3 minutes
setTimeout(() => {
  console.log('\n⏰ Timed out. Run this script again and scan faster.');
  process.exit(1);
}, 3 * 60 * 1000);
