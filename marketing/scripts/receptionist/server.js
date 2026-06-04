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
const express      = require('express');
const twilio       = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  PORT = 3001,
} = process.env;

// ── Team numbers ───────────────────────────────────────────────────────────────
const CEO_KV       = '+27615442591'; // KV — CEO
const CFO_CHRIS    = '+27753203477'; // Christopher — CFO

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const VOICE  = { voice: 'Polly.Joanna-Neural' };

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
  r.dial({ callerId: TWILIO_PHONE_NUMBER, timeout: 20, action: '/no-answer' }, CFO_CHRIS);
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
    r.dial({ callerId: TWILIO_PHONE_NUMBER, timeout: 20, action: '/no-answer-kv' }, CEO_KV);

  } else if (digit === '3') {
    // CFO Christopher
    r.say(VOICE, 'Connecting you to our CFO, Christopher. Please hold.');
    notifyTeam(caller, 'Christopher', CFO_CHRIS);
    r.dial({ callerId: TWILIO_PHONE_NUMBER, timeout: 20, action: '/no-answer-chris' }, CFO_CHRIS);

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
  r.dial({ callerId: TWILIO_PHONE_NUMBER, timeout: 20, action: '/no-answer' }, CFO_CHRIS);
  res.type('text/xml').send(r.toString());
});

// Christopher didn't answer
app.post('/no-answer-chris', (req, res) => {
  const r = new VoiceResponse();
  r.say(VOICE, 'Christopher is unavailable right now. Let me connect you to K V.');
  r.dial({ callerId: TWILIO_PHONE_NUMBER, timeout: 20, action: '/no-answer' }, CEO_KV);
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
  if (!TWILIO_ACCOUNT_SID) return;
  const msg = `📞 *INCOMING CALL for ${name}*\nCaller: ${caller}\nConnecting now — get ready! 💰`;
  await sendWA(number, msg);
}

async function notifyBoth(caller, type, extra = '') {
  if (!TWILIO_ACCOUNT_SID) return;
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
  try {
    const from = `whatsapp:${TWILIO_PHONE_NUMBER}`;
    const toWA = `whatsapp:+${to.replace(/\D/g, '')}`;
    await client.messages.create({ from, to: toWA, body });
  } catch (err) {
    console.error(`WA notify failed (${to}):`, err.message);
  }
}

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('MCF Websites Receptionist ✅ Online'));

app.listen(PORT, () => {
  console.log(`\n📞 MCF Receptionist running on http://localhost:${PORT}`);
  console.log(`   KV  (CEO):       ${CEO_KV}`);
  console.log(`   Christopher (CFO): ${CFO_CHRIS}`);
  console.log(`\n   Waiting for tunnel URL to point Twilio at...\n`);
});
