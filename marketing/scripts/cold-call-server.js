#!/usr/bin/env node
/**
 * MCF Websites — Cold Call Webhook Server
 * Serves TwiML to Twilio for auto-dialing leads.
 * Runs locally and is exposed via localtunnel.
 *
 * Usage:
 *   node cold-call-server.js
 *   (then in a second terminal) node cold-call-outreach.js --send --limit 20
 */

const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: false }));

const FORWARD_TO = '+27615442591'; // Christopher's number

// ── TwiML: main message played when call is answered ─────────────────────────
app.post('/answer', (req, res) => {
  const caller = req.body.To || '';
  console.log(`📞 Call answered: ${caller}`);

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/keypress" method="POST" timeout="8">
    <Say voice="Polly.Ayanda" language="en-ZA">
      Hello! Quick message from M C F Websites.
      I noticed your business doesn't have a website yet.
      Every day without one, customers are finding your competitors instead of you.
      We build professional websites for service businesses,
      starting from just 2500 rand — with no payment until you are completely happy.
      Press 1 to speak with Christopher directly.
      Press 2 to receive our details on WhatsApp.
      Or press 3 to be removed from our list.
    </Say>
  </Gather>
  <Say voice="Polly.Ayanda" language="en-ZA">We didn't receive your input. Goodbye, and have a great day!</Say>
</Response>`);
});

// ── TwiML: handle keypress ────────────────────────────────────────────────────
app.post('/keypress', (req, res) => {
  const digit = req.body.Digits;
  const caller = req.body.To || '';
  console.log(`🔢 ${caller} pressed ${digit}`);

  res.type('text/xml');

  if (digit === '1') {
    // Forward to Christopher
    console.log(`✅ Forwarding ${caller} to ${FORWARD_TO}`);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">Please hold, connecting you to Christopher now.</Say>
  <Dial callerId="${FORWARD_TO}" timeout="30">
    <Number>${FORWARD_TO}</Number>
  </Dial>
</Response>`);

  } else if (digit === '2') {
    // Send WhatsApp and say goodbye
    console.log(`📱 WhatsApp requested by ${caller}`);
    // Trigger WhatsApp send via webhook
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">
    Perfect! We have sent our details to your WhatsApp right now.
    Look out for a message from M C F Websites. Have a great day!
  </Say>
</Response>`);
    // Send WhatsApp async
    sendWhatsApp(caller);

  } else if (digit === '3') {
    console.log(`🚫 Opt-out: ${caller}`);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">
    No problem, you have been removed. Have a great day!
  </Say>
</Response>`);

  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Ayanda" language="en-ZA">Invalid option. Goodbye!</Say>
</Response>`);
  }
});

// ── Send WhatsApp when they press 2 ──────────────────────────────────────────
const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp(toNumber) {
  try {
    // Normalise number
    let to = toNumber.replace(/\D/g, '');
    if (!to.startsWith('+')) to = '+' + to;

    await twilio.messages.create({
      from: 'whatsapp:+14155238886',
      to: `whatsapp:${to}`,
      body: `Hi! You just requested our details via our call. Here's everything:

*MCF WEBSITES*
_Premium Web Design & Development_
"Modern websites that grow your business."

✅ We build it first — you pay nothing if you're not happy
✅ Starting from R2,500 once-off

📞 075 320 3477
🌐 https://mcfwebsites.lovable.app/

Services: Business Websites · Landing Pages · E-Commerce · AI Integrations · Redesigns

Reply YES to get started or ask any questions!`,
    });
    console.log(`📱 WhatsApp sent to ${to}`);
  } catch (err) {
    console.error(`❌ WhatsApp failed: ${err.message}`);
  }
}

// ── Status callback (logs call outcomes) ─────────────────────────────────────
app.post('/status', (req, res) => {
  const { To, CallStatus, CallDuration } = req.body;
  console.log(`📊 ${To} — ${CallStatus} (${CallDuration || 0}s)`);
  res.sendStatus(200);
});

// ── Start server + localtunnel ────────────────────────────────────────────────
const PORT = 3333;
app.listen(PORT, async () => {
  console.log(`\n🚀 Cold call server running on port ${PORT}`);
  try {
    const localtunnel = require('localtunnel');
    const tunnel = await localtunnel({ port: PORT, subdomain: 'mcfwebs-calls' });
    console.log(`🌐 Public URL: ${tunnel.url}`);
    console.log(`\n📋 Copy this URL into cold-call-outreach.js as WEBHOOK_BASE`);
    console.log(`   or run: WEBHOOK_BASE=${tunnel.url} node cold-call-outreach.js --send --limit 20\n`);

    tunnel.on('close', () => console.log('Tunnel closed.'));
  } catch (e) {
    // fallback: just show local URL
    console.log(`\n⚠️  localtunnel failed — use ngrok instead:`);
    console.log(`   npx ngrok http ${PORT}`);
    console.log(`   Then copy the https URL as WEBHOOK_BASE\n`);
  }
});
