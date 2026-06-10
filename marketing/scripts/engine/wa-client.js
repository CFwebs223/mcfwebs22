const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { CHROME } = require('./config');
const tracker = require('./tracker');
const landon  = require('./landon-agent');

// Conversation history per phone (in-memory, reset on restart — good enough)
const convHistory = {};

function createClient(sessionPath, number = 1) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless:        true,
      executablePath:  CHROME,
      protocolTimeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--no-first-run',
      ],
    },
  });

  client.on('qr', (qr) => {
    console.log(`\n📱 Scan QR for WhatsApp number ${number}:\n`);
    qrcode.generate(qr, { small: true });
    console.log('\nWhatsApp → Menu → Linked Devices → Link a Device\n');
  });

  client.on('auth_failure', () => {
    console.error(`❌ Auth failed for number ${number}`);
  });

  client.on('disconnected', () => {
    console.log(`⚠️  Number ${number} disconnected. Reconnecting...`);
    client.initialize();
  });

  // ── Reply handler — ONLY leads, NEVER personal messages ─────────────────
  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    const phone = '+' + msg.from.replace('@c.us', '').replace(/\D/g, '');

    // ⛔ SECURITY: only respond to leads in tracker — personal messages NEVER touched
    const t = tracker.load();
    if (!t[phone]) return;

    const lead = { ...t[phone], phone };
    const text = msg.body || '';

    // Mark as replied (first time)
    if (!t[phone].replied) {
      tracker.markReplied(t, phone);
      console.log(`\n🎉 REPLY from ${lead.name || phone} on WA#${number}: "${text.slice(0,60)}"`);
    } else {
      console.log(`\n💬 Follow-up from ${lead.name || phone}: "${text.slice(0,60)}"`);
    }

    // Build conversation history for this lead
    if (!convHistory[phone]) convHistory[phone] = [];
    convHistory[phone].push({ role: 'user', text });
    // Keep last 10 exchanges
    if (convHistory[phone].length > 20) convHistory[phone] = convHistory[phone].slice(-20);

    // Random human-like delay before replying (3–12 seconds)
    const replyDelay = 3000 + Math.random() * 9000;
    await new Promise(r => setTimeout(r, replyDelay));

    try {
      const reply = await landon.getLandonReply(lead, text, convHistory[phone]);
      if (!reply) return;

      await client.sendMessage(msg.from, reply);

      // Record in history
      convHistory[phone].push({ role: 'landon', text: reply });

      // Mark auto-replied (first reply)
      if (!t[phone].autoReplied) {
        const fresh = tracker.load();
        tracker.markAutoReplied(fresh, phone);
      }

      console.log(`   💬 Landon replied: "${reply.slice(0,80)}..."`);
    } catch (err) {
      console.log(`   ⚠️  Landon reply failed: ${err.message}`);
    }
  });

  return client;
}

function connect(client) {
  return new Promise((resolve, reject) => {
    client.on('ready', () => resolve(client));
    client.on('auth_failure', reject);
    client.initialize();
  });
}

async function send(client, phone, message) {
  const jid = `${phone.replace('+', '')}@c.us`;
  const onWA = await client.isRegisteredUser(jid);
  if (!onWA) throw new Error('Not on WhatsApp');
  await client.sendMessage(jid, message);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomDelay(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

module.exports = { createClient, connect, send, sleep, randomDelay };
