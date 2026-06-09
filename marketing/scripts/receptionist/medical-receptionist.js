#!/usr/bin/env node
/**
 * MCF Websites — Medical Practice AI Receptionist
 *
 * A white-label AI phone receptionist for doctors & dentists.
 * MCF sells this as an add-on service to medical practices.
 *
 * Customise the CONFIG below per client, deploy to Render/Railway.
 *
 * Menu:
 *   Press 1 → Book an appointment
 *   Press 2 → Speak to the receptionist / nurse
 *   Press 3 → After-hours emergency
 *   Press 4 → Directions & hours
 *   Press 5 → Repeat menu
 */

require('dotenv').config();
const express       = require('express');
const twilio        = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

// ── Client config (customise per practice) ───────────────────────────────────
const CONFIG = {
  practiceName:   process.env.PRACTICE_NAME   || 'Cape Town Medical Centre',
  doctorName:     process.env.DOCTOR_NAME     || 'Dr Patel',
  receptionPhone: process.env.RECEPTION_PHONE || '+27215551234',   // practice landline/cell
  emergencyPhone: process.env.EMERGENCY_PHONE || '+27215551234',
  bookingUrl:     process.env.BOOKING_URL     || 'www.capetownmedical.co.za/book',
  address:        process.env.ADDRESS         || '45 Main Road, Cape Town, 8001',
  hours:          process.env.HOURS           || 'Monday to Friday, 8am to 5pm. Saturdays 8am to 1pm.',
  type:           process.env.PRACTICE_TYPE   || 'medical', // medical | dental | physio | legal
};

const VOICE_SA = { voice: 'Polly.Ayanda-Neural' }; // South African English
const VOICE_US = { voice: 'Polly.Joanna-Neural' }; // US English fallback
const VOICE    = VOICE_SA;

// ── Greeting script (type-specific) ──────────────────────────────────────────
function getGreeting() {
  const greetings = {
    medical: `Thank you for calling ${CONFIG.practiceName}, home of ${CONFIG.doctorName}.
Our receptionist will assist you shortly.
To book or confirm an appointment, press 1.
To speak to our receptionist or nursing staff, press 2.
For a medical emergency, press 3.
For our address, directions, and consulting hours, press 4.
To hear these options again, press 5.`,

    dental: `Thank you for calling ${CONFIG.practiceName}.
We're delighted to look after your smile.
To book or change your dental appointment, press 1.
To speak to our dental receptionist, press 2.
For a dental emergency or after-hours pain, press 3.
For our address, directions, and hours, press 4.
To hear these options again, press 5.`,

    physio: `Thank you for calling ${CONFIG.practiceName}.
To book or confirm your physiotherapy session, press 1.
To speak to our reception team, press 2.
For urgent assistance, press 3.
For our address, directions, and hours, press 4.
To hear these options again, press 5.`,

    legal: `Thank you for calling ${CONFIG.practiceName}.
To book a consultation with our attorneys, press 1.
To speak to a paralegal or secretary, press 2.
For urgent legal matters, press 3.
For our address, directions, and office hours, press 4.
To hear these options again, press 5.`,
  };
  return greetings[CONFIG.type] || greetings.medical;
}

function getBookingScript() {
  return `To book your appointment online, visit ${CONFIG.bookingUrl}.
You can also WhatsApp us and we'll confirm within minutes.
If you'd prefer to speak to someone directly, press 0 now and we'll answer immediately.
Otherwise, please call back during office hours: ${CONFIG.hours}.`;
}

function getHoursScript() {
  return `${CONFIG.practiceName} is located at ${CONFIG.address}.
Our consulting hours are: ${CONFIG.hours}.
Outside of these hours, please leave a message and we will call you back first thing.
For emergencies, press 3.`;
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID  || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN   || '';
const TWILIO_NUM   = process.env.TWILIO_PHONE_NUMBER || '';
const PORT         = process.env.PORT                || 3002;

function getClient() {
  if (!TWILIO_SID || !TWILIO_TOKEN) return null;
  return twilio(TWILIO_SID, TWILIO_TOKEN);
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/call', (req, res) => {
  const r = new VoiceResponse();
  const g = r.gather({ numDigits: '1', action: '/menu', timeout: 8 });
  g.say(VOICE, getGreeting());
  r.redirect('/call');
  res.type('text/xml').send(r.toString());
});

app.post('/menu', (req, res) => {
  const digit  = req.body.Digits;
  const caller = req.body.From || 'Unknown';
  const r      = new VoiceResponse();

  if (digit === '1') {
    r.say(VOICE, getBookingScript());
    r.pause({ length: 1 });
    const g = r.gather({ numDigits: '1', action: '/menu', timeout: 6 });
    g.say(VOICE, 'Press 2 to speak to reception, or press 4 for our address and hours.');

  } else if (digit === '2') {
    notifyReception(caller);
    r.say(VOICE, `Connecting you to our reception team now. Please hold while we transfer your call.`);
    const d = r.dial({ timeout: 25, action: '/no-answer' });
    d.number(CONFIG.receptionPhone);

  } else if (digit === '3') {
    r.say(VOICE, `For a medical emergency please call 1 0 1 1, or go to your nearest emergency room.
If this is an after-hours emergency for ${CONFIG.practiceName}, we are connecting you now.`);
    const d = r.dial({ timeout: 20, action: '/no-answer' });
    d.number(CONFIG.emergencyPhone);

  } else if (digit === '4') {
    r.say(VOICE, getHoursScript());
    r.redirect('/call');

  } else {
    r.redirect('/call');
  }

  res.type('text/xml').send(r.toString());
});

app.post('/no-answer', (req, res) => {
  const caller = req.body.From || 'Unknown';
  const r      = new VoiceResponse();
  r.say(VOICE, `Our team is unavailable right now. Please leave your name and number after the tone and we will call you back within the hour.`);
  r.record({ maxLength: 30, action: '/recording', transcribe: true, transcribeCallback: '/transcript' });
  notifyMissedCall(caller);
  res.type('text/xml').send(r.toString());
});

app.post('/recording', (req, res) => {
  const r = new VoiceResponse();
  r.say(VOICE, `Thank you. We have received your message and will call you back shortly. For emergencies please call 10111. Goodbye!`);
  r.hangup();
  res.type('text/xml').send(r.toString());
});

app.post('/transcript', async (req, res) => {
  const caller     = req.body.From || 'Unknown';
  const transcript = req.body.TranscriptionText || '(no transcript)';
  const c = getClient();
  if (c && TWILIO_NUM) {
    try {
      await c.messages.create({
        from: TWILIO_NUM, to: CONFIG.receptionPhone,
        body: `📝 VOICEMAIL at ${CONFIG.practiceName}\nCaller: ${caller}\n"${transcript}"\nCall them back!`,
      });
    } catch {}
  }
  res.sendStatus(200);
});

// ── Notifications ─────────────────────────────────────────────────────────────
async function notifyReception(caller) {
  const c = getClient();
  if (!c || !TWILIO_NUM) return;
  try {
    await c.messages.create({
      from: TWILIO_NUM, to: CONFIG.receptionPhone,
      body: `📞 INCOMING CALL at ${CONFIG.practiceName}\nCaller: ${caller}\nPick up — transferring now!`,
    });
  } catch {}
}

async function notifyMissedCall(caller) {
  const c = getClient();
  if (!c || !TWILIO_NUM) return;
  try {
    await c.messages.create({
      from: TWILIO_NUM, to: CONFIG.receptionPhone,
      body: `📵 MISSED CALL at ${CONFIG.practiceName}\nCaller: ${caller}\nLeft a voicemail — call back ASAP.`,
    });
  } catch {}
}

app.get('/', (req, res) => res.send(`${CONFIG.practiceName} — AI Receptionist ✅ Online`));
app.get('/health', (req, res) => res.json({ status: 'ok', practice: CONFIG.practiceName }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📞 ${CONFIG.practiceName} Receptionist`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Type: ${CONFIG.type}`);
  console.log(`   Doctor/Name: ${CONFIG.doctorName}`);
  console.log(`   Reception: ${CONFIG.receptionPhone}\n`);
});
