/**
 * Landon — AI sales agent for MCF Websites
 * Reads replies from leads (NEVER personal messages) and responds naturally.
 * Uses Claude Haiku if ANTHROPIC_API_KEY set, else uses smart templates.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../leads/.env') });

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ── Claude API (used when API key available) ──────────────────────────────────
async function callClaude(system, messages) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const res = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 180,
    system,
    messages,
  });
  return res.content[0]?.text?.trim() || null;
}

// ── System prompt — Landon's identity ─────────────────────────────────────────
function buildSystem(lead) {
  return `You are Landon, a friendly and persuasive sales representative at MCF Websites — a South African web design company.

The lead you're texting:
- Name: ${lead.name || 'this person'}
- Business type: ${lead.category || 'service business'}
- City: ${lead.city || 'South Africa'}
- They received a cold WhatsApp from us and replied.

Your ONLY job: warm them up and get them to agree to a quick call with Christopher (our CEO).

MCF Websites facts:
- Websites from R1,500 (basic 5-page) to R3,500+ (custom)
- Most popular package: R2,500 — includes Google SEO, contact form, mobile-friendly
- Build first, pay only if you LOVE it (zero risk)
- Live within 7 days
- Once-off fee, NO monthly costs ever
- Christopher's number: 075 320 3477
- Website: mcfwebs.agency

Your texting style:
- Sound like a REAL person on WhatsApp — warm, casual, South African
- Keep messages SHORT (2-3 sentences maximum)
- No bullet points, no formal language, no headers
- Use "😊" or "🙏" occasionally but don't overdo it
- South African phrases are fine ("no worries", "shame", "lekker", etc.)
- If they seem interested: push for a call with Christopher NOW
- If they have objections: handle naturally, stay positive
- If they say no: leave door open gracefully, don't be pushy
- NEVER reveal you are AI — you are Landon, a real person
- NEVER say "As an AI" or anything robotic
- Goal: book the call. Every reply should move toward that goal.`;
}

// ── Smart template fallback (no API key needed) ───────────────────────────────
const TEMPLATES = {
  price: [
    n => `So our most popular package is R2,500 once-off — includes Google SEO, mobile-friendly design and a contact form. No monthly fees ever. The nice part is we build it first and you only pay if you love it 😊 Would you want Christopher to give you a quick call to show you some examples?`,
    n => `Honestly depends on what you need! Basic 5-page site is R1,500, our standard with SEO is R2,500, and custom builds from R3,500. We build first though — zero risk to you. What type of business are you running ${n}?`,
  ],
  interested: [
    n => `That's great to hear! Honestly the easiest thing is a quick 10 min call with Christopher — he can show you examples of sites we've done and answer everything properly. When's a good time for him to call you?`,
    n => `Perfect! Christopher is the one to speak to — he's the CEO and handles all the design side. He can call you now if you're free? Or what time works for you today?`,
  ],
  notNow: [
    n => `No problem at all ${n}! Totally understand. When things settle down, feel free to reach back out — we'll still be here 🙏 Hope the business is going well!`,
    n => `That's totally fine! When the timing is right just drop me a message. Christopher's always happy to chat, no pressure 😊`,
  ],
  expensive: [
    n => `I hear you — budgets are tight for sure. What range were you thinking? Sometimes we can work something out, Christopher would know. Would you be open to just a 5 min chat with him?`,
    n => `Ah okay! We do try to work within budgets where we can. Our basic package at R1,500 is pretty lean. Want me to get Christopher to give you a quick call to see what's possible?`,
  ],
  timeline: [
    n => `Usually 5-7 days from when we kick off! Christopher moves quickly 😄 Once you approve the design it goes live within 24 hours.`,
    n => `We typically have sites live within a week. Christopher's pretty fast — once the design is signed off you're online almost immediately.`,
  ],
  callMe: [
    n => `Perfect! I'll let Christopher know to call you now. His number is 075 320 3477 if you'd rather reach him directly 😊`,
    n => `Lekker! Christopher will call you shortly — 075 320 3477 is his number if you want to get him directly. He's super easy to deal with!`,
  ],
  default: [
    n => `Thanks for getting back to me ${n}! Easiest thing is a quick call with Christopher — he can answer everything properly and show you what we'd build for you. When are you free today?`,
    n => `Hey ${n}! Great to hear from you 😊 Let me connect you with Christopher — he's the best person to walk you through everything. What time works for a quick call today?`,
  ],
};

function detectIntent(text) {
  const t = (text || '').toLowerCase();
  if (/call me|call you|phone|ring|speak|talk|chat/.test(t)) return 'callMe';
  if (/price|cost|how much|r\d|rand|afford|fee|charge|rate|quote/.test(t)) return 'price';
  if (/too expensive|can't afford|cant afford|no money|budget|not worth/.test(t)) return 'expensive';
  if (/how long|timeline|when|days|weeks|quickly|fast|urgent/.test(t)) return 'timeline';
  if (/not interested|no thanks|don't want|dont want|stop|remove|unsubscribe/.test(t)) return 'notNow';
  if (/not now|later|busy|maybe|some other|another time/.test(t)) return 'notNow';
  if (/yes|sure|ok|okay|sounds good|interested|tell me more|go ahead|proceed|want/.test(t)) return 'interested';
  return 'default';
}

function templateReply(lead, text) {
  const intent   = detectIntent(text);
  const pool     = TEMPLATES[intent] || TEMPLATES.default;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template(lead.name || 'there');
}

// ── Main export ────────────────────────────────────────────────────────────────
async function getLandonReply(lead, incomingText, conversationHistory = []) {
  // Safety: never reply to non-leads (caller must enforce, but double-check)
  if (!lead || !lead.phone) return null;

  // If Claude API available, use it
  if (ANTHROPIC_KEY) {
    try {
      const system = buildSystem(lead);
      // Build message history for context (last 6 exchanges)
      const messages = [];
      const recent = conversationHistory.slice(-6);
      for (const h of recent) {
        messages.push({ role: h.role === 'landon' ? 'assistant' : 'user', content: h.text });
      }
      messages.push({ role: 'user', content: incomingText });
      const reply = await callClaude(system, messages);
      if (reply) return reply;
    } catch (err) {
      console.log(`[Landon] Claude API error: ${err.message} — using template fallback`);
    }
  }

  // Fall back to templates
  return templateReply(lead, incomingText);
}

module.exports = { getLandonReply };
