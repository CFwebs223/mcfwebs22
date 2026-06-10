const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { CHROME } = require('./config');
const tracker = require('./tracker');

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

  // ── Reply detection — only checks leads, never reads personal messages ────
  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    const phone = '+' + msg.from.replace('@c.us', '').replace(/\D/g, '');
    const t = tracker.load();
    if (!t[phone]) return; // not a lead — ignore completely

    const name = t[phone].name || 'there';

    if (!t[phone].replied) {
      tracker.markReplied(t, phone);
      console.log(`\n🎉 REPLY from ${name} (${phone}) on number ${number}!`);
    }

    // Send auto-reply once only — leads only, never personal messages
    if (!t[phone].autoReplied) {
      try {
        const reply =
          `Hi ${name}! 😊 Thanks for getting back to me.\n\n` +
          `KV or Christopher from *MCF Websites* will personally call you ` +
          `within the hour to chat about your website.\n\n` +
          `In the meantime, feel free to WhatsApp us directly:\n` +
          `📞 075 320 3477\n` +
          `🌐 https://www.mcfwebs.agency`;
        await client.sendMessage(msg.from, reply);
        const fresh = tracker.load();
        tracker.markAutoReplied(fresh, phone);
        console.log(`   ↩️  Auto-reply sent to ${name}`);
      } catch (err) {
        console.log(`   ⚠️  Auto-reply failed: ${err.message}`);
      }
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
