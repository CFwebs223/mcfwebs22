#!/usr/bin/env node
/**
 * MCF Websites — AI Phone Receptionist
 * Answers 24/7, gives pricing, transfers to CEO or CFO, takes messages.
 *
 * Menu:
 *   Press 1 → Packages & pricing
 *   Press 2 → Transfer to CEO KV     (0615442591)
 *   Press 3 → Transfer to CFO Christopher (0753203477)
 *   Press 4 → Leave a voicemail / callback request
 */

require('dotenv').config();
const express  = require('express');
const { RestClient } = require('@signalwire/compatibility-api');

const VoiceResponse = RestClient.LaML.VoiceResponse;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const SW_PROJECT_ID = process.env.SW_PROJECT_ID || '';
const SW_API_TOKEN  = process.env.SW_API_TOKEN  || '';
const SW_SPACE_URL  = process.env.SW_SPACE_URL  || ''; // e.g. yourspace.signalwire.com
const SW_PHONE      = process.env.SW_PHONE      || ''; // your SignalWire number e.g. +12345678900
const PORT          = process.env.PORT          || 3001;

function getClient() {
  if (!SW_PROJECT_ID || !SW_API_TOKEN || !SW_SPACE_URL) return null;
  return RestClient(SW_PROJECT_ID, SW_API_TOKEN, { signalwireSpaceUrl: SW_SPACE_URL });
}

// ── Team numbers ───────────────────────────────────────────────────────────────
const CEO_KV       = '+27615442591'; // KV — CEO
const CFO_CHRIS    = '+27753203477'; // Christopher — CFO

const VOICE = { voice: 'Polly.Joanna-Neural' };

// ── Scripts ────────────────────────────────────────────────────────────────────
const GREETING = `Welcome to MCF Websites — South Africa's premium web design agency.
We build professional websites that get your business found on Google and bring in more clients.

For our packages and pricing, press 1.
To speak with our CEO, K V, press 2.
To speak with our CFO, Christopher, press 3.
To leave your name and number for a callback, press 4.`;

const PRICING = `Here are our three packages.

The Starter package is R 2,500 once-off — no monthly fees.
You get a professional 3 to 5 page website, full Google SEO setup, and a WhatsApp button so clients can reach you instantly.

The Business package is R 4,500 and includes up to 8 pages, an online booking system, photo gallery, and Google Maps integration.

The Premium package is R 7,500 and includes a full online store with payment gateway and unlimited products.

All packages include our risk-free guarantee. We build your website first — you only pay if you love it. Zero risk to you.

To speak with our CEO, K V, press 2.
To speak with our CFO, Christopher, press 3.
Or WhatsApp us directly on 0 7 5 3 2 0 3 4 7 7.`;

// ── Routes ─────────────────────────────────────────────────────────────────────

// Initial greeting
app.post('/call', (req, res) => {
  const r = new VoiceResponse();
  const g = r.gather({ numDigits: '1', action: '/menu', timeout: 7 });
  g.say(VOICE, GREETING);
  // No input — transfer to CFO by default
  r.say(VOICE, "Connecting you to our team now. Please hold.");
  r.dial({ callerId: SW_PHONE, timeout: 20, action: '/no-answer' }, CFO_CHRIS);
  res.type('text/xml').send(r.toString());
});

// Menu handler
app.post('/menu', (req, res) => {
  const digit  = req.body.Digits;
  const caller = req.body.From || 'Unknown';
  const r      = new VoiceResponse();

  if (digit === '1') {
    // Pricing
    r.say(VOICE, PRICING);
    const g = r.gather({ numDigits: '1', action: '/menu', timeout: 7 });
    g.say(VOICE, 'Press 2 for CEO K V, press 3 for CFO Christopher, or press 4 to leave a message.');

  } else if (digit === '2') {
    // CEO KV
    r.say(VOICE, 'Connecting you to our CEO, K V. Please hold.');
    notifyTeam(caller, 'KV', CEO_KV);
    r.dial({ callerId: SW_PHONE, timeout: 20, action: '/no-answer-kv' }, CEO_KV);

  } else if (digit === '3') {
    // CFO Christopher
    r.say(VOICE, 'Connecting you to our CFO, Christopher. Please hold.');
    notifyTeam(caller, 'Christopher', CFO_CHRIS);
    r.dial({ callerId: SW_PHONE, timeout: 20, action: '/no-answer-chris' }, CFO_CHRIS);

  } else if (digit === '4') {
    // Voicemail
    r.say(VOICE, 'Please say your name and the best number to reach you after the tone. You have 20 seconds.');
    r.record({ maxLength: 20, action: '/recording', transcribe: true, transcribeCallback: '/transcript' });

  } else {
    r.redirect('/call');
  }

  res.type('text/xml').send(r.toString());
});

// KV didn't answer
app.post('/no-answer-kv', (req, res) => {
  const r = new VoiceResponse();
  r.say(VOICE, 'K V is unavailable right now. Let me connect you to Christopher.');
  r.dial({ callerId: SW_PHONE, timeout: 20, action: '/no-answer' }, CFO_CHRIS);
  res.type('text/xml').send(r.toString());
});

// Christopher didn't answer
app.post('/no-answer-chris', (req, res) => {
  const r = new VoiceResponse();
  r.say(VOICE, 'Christopher is unavailable right now. Let me connect you to K V.');
  r.dial({ callerId: SW_PHONE, timeout: 20, action: '/no-answer' }, CEO_KV);
  res.type('text/xml').send(r.toString());
});

// Both unavailable — take message
app.post('/no-answer', (req, res) => {
  const r = new VoiceResponse();
  r.say(VOICE, 'Our team is unavailable right now. Please leave your name and number after the tone and we will call you right back.');
  r.record({ maxLength: 20, action: '/recording', transcribe: true, transcribeCallback: '/transcript' });
  res.type('text/xml').send(r.toString());
});

// Recording saved
app.post('/recording', async (req, res) => {
  const caller = req.body.From || 'Unknown';
  const r = new VoiceResponse();
  r.say(VOICE, 'Thank you! Someone from MCF Websites will call you back shortly. You can also WhatsApp us on 0 7 5 3 2 0 3 4 7 7. Have a great day!');
  r.hangup();
  await notifyBoth(caller, 'voicemail');
  res.type('text/xml').send(r.toString());
});

// Transcription ready
app.post('/transcript', async (req, res) => {
  const caller     = req.body.From || 'Unknown';
  const transcript = req.body.TranscriptionText || '(no transcript)';
  await notifyBoth(caller, 'transcript', transcript);
  res.sendStatus(200);
});

// ── Notifications ──────────────────────────────────────────────────────────────

async function notifyTeam(caller, name, number) {
  if (!SW_PROJECT_ID) return;
  const msg = `📞 *INCOMING CALL for ${name}*\nCaller: ${caller}\nConnecting now — get ready! 💰`;
  await sendWA(number, msg);
}

async function notifyBoth(caller, type, extra = '') {
  if (!SW_PROJECT_ID) return;
  const msgs = {
    voicemail:  `📞 *VOICEMAIL — New Lead!*\nCaller: ${caller}\nThey left a message. Check Twilio console for the recording.\nhttps://console.twilio.com 🔥`,
    transcript: `📝 *VOICEMAIL TRANSCRIPT*\nCaller: ${caller}\n\n"${extra}"\n\nCall them back! 💰`,
  };
  await Promise.all([
    sendWA(CEO_KV,    msgs[type]),
    sendWA(CFO_CHRIS, msgs[type]),
  ]);
}

async function sendWA(to, body) {
  const c = getClient();
  if (!c || !SW_PHONE) return;
  try {
    await c.messages.create({
      from: SW_PHONE,
      to,
      body,
    });
  } catch (err) {
    console.error(`SMS notify failed (${to}):`, err.message);
  }
}

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('MCF Websites Receptionist ✅ Online'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📞 MCF Receptionist running on port ${PORT}`);
  console.log(`   Project ID: ${SW_PROJECT_ID ? '✅' : '❌ MISSING'}`);
  console.log(`   API Token:  ${SW_API_TOKEN  ? '✅' : '❌ MISSING'}`);
  console.log(`   Space URL:  ${SW_SPACE_URL  || '❌ MISSING'}`);
  console.log(`   Number:     ${SW_PHONE      || '❌ MISSING'}\n`);
});
