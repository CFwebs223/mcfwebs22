/**
 * Landon — MCF Websites AI Sales Agent
 * Responds to WhatsApp lead replies as a real SA human.
 * Goal: qualify the lead and book a call with Christopher (075 320 3477)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../leads/.env') });

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;

const MCF_FACTS = `
MCF Websites — South African web design agency.
Owner/Sales: Christopher (075 320 3477) | KV (061 544 2591)
Website: mcfwebs.agency | Email: websitesmcf@gmail.com

PACKAGES (once-off, NO monthly fees):
- Starter R2,500: 3-5 pages, Google SEO, WhatsApp button, mobile-friendly, live in 5 days
- Business R4,500: Starter + booking system, gallery, Google Maps
- Premium R7,500: Business + full online store, payment gateway

GUARANTEE: Build first — client approves — then pays. Zero risk.
PAYMENT: 50% deposit, 50% on approval. EFT/PayShap/card.
TURNAROUND: 5 working days from deposit.
INCLUDED: Domain + hosting first year (R1,200/yr after).

CREDIBILITY: 50+ SA businesses helped. Plumber in Joburg got 8 new jobs month 1. CT salon doubled bookings in 6 weeks.
`;

function buildSystem(lead) {
  const name = lead.name || 'there';
  const city = lead.city ? ` in ${lead.city}` : '';
  const cat  = lead.category ? ` (${lead.category})` : '';

  return `You are Landon, a friendly South African sales agent for MCF Websites. You reply to WhatsApp messages from business owners who were contacted about getting a website.

Lead: ${name}${city}${cat}

${MCF_FACTS}

PERSONALITY: Warm, direct, confident. South African — occasionally use "lekker", "cheers", "hey". Keep messages SHORT (2-4 sentences max). 1-2 emojis max. Never pushy. You're helping them, not begging.

GOAL: Get them to agree to a 5-minute call with Christopher (075 320 3477) OR confirm interest for follow-up.

OBJECTION HANDLING:
- Too expensive: ROI (1 client pays for it), zero-risk guarantee, ask their budget
- Not ready/later: Gentle urgency (competitors going online now), ask when to revisit
- Not interested: Politely acknowledge, leave door open, say goodbye warmly
- What's included: 3-bullet summary, push for call
- Send more info: Brief, then push for call

CALL TO ACTION (choose one):
- "Want me to get Christopher to give you a quick call? 5 min, no pressure."
- "Christopher can walk you through it in 5 minutes — what time works?"
- "Should I have Christopher call you to show you examples?"

RULES: Never reveal you're AI. Max 80 words per reply. Only discuss MCF Websites / websites for their business.`;
}

async function callClaude(system, messages) {
  const https = require('https');
  const body  = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 180,
    system,
    messages,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || null); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function templateReply(lead, text) {
  const t = (text || '').toLowerCase();
  const n = lead.name || 'there';

  if (/\b(yes|interested|sure|ok|okay|how much|price|cost|tell me|what.?s included|sounds good|let.?s|want one|book|when|how long|go ahead)\b/.test(t)) {
    return [
      `Lekker! 🙌 Christopher will call you shortly to walk you through it — takes 5 min. His number is 075 320 3477 if you want to reach him first. Site goes live within 5 days of your go-ahead!`,
      `Great to hear! 😊 Starter from R2,500 once-off — no monthly fees, we build first so zero risk. Christopher can go through examples with you in 5 min — want him to call?`,
      `Awesome! 🙏 Christopher handles all the details — he'll show you exactly what we'd build for ${n}. Quick call? 📞 075 320 3477`,
    ][Math.floor(Math.random() * 3)];
  }

  if (/\b(expensive|too much|can.?t afford|no money|cheap|cheaper|discount|lower|budget)\b/.test(t)) {
    return [
      `I hear you 😊 One extra client per month pays for it — most get 5-10 new enquiries weekly. And you only pay when you love it. What's your budget? Christopher can work with you. 📞 075 320 3477`,
      `Fair enough! R2,500 upfront but no monthly fees ever — and we build first so zero risk. If even 1 new client finds you on Google, it's paid for. Want Christopher to chat about options? 😊`,
    ][Math.floor(Math.random() * 2)];
  }

  if (/\b(later|not now|busy|another time|maybe|not yet|next month|not ready)\b/.test(t)) {
    return `No worries at all! 😊 Offer stands whenever you're ready — R2,500 once-off, zero risk, we build first. Christopher is on 075 320 3477. Wishing ${n} all the best in the meantime! 🙏`;
  }

  if (/\b(no thanks|not interested|stop|remove|don.?t contact|leave me|unsubscribe)\b/.test(t)) {
    return `Absolutely, sorry to disturb you! 🙏 Won't message again. Wishing you and ${n} all the best! — MCF Websites`;
  }

  if (/\b(include|feature|pages|seo|google|hosting|domain|what do|what will)\b/.test(t)) {
    return `Great question! Every site includes: ✅ Professional design ✅ Google SEO ✅ WhatsApp button ✅ Mobile-friendly ✅ Hosting & domain (year 1). No monthly fees. Christopher can walk you through it in 5 min — want him to call? 📞 075 320 3477`;
  }

  return [
    `Thanks for getting back! 😊 Christopher can answer everything and show examples in a quick 5-min call. Want me to have him reach out? 📞 075 320 3477`,
    `Hey! Glad you replied 🙏 Christopher is best placed to walk you through this — he can show you what we'd build for ${n} in under 5 minutes. Want him to call?`,
    `Hi! Christopher handles all the details — quick 5-min call and you'll have all the info you need. Shall I have him reach out? 📞 075 320 3477`,
  ][Math.floor(Math.random() * 3)];
}

async function getLandonReply(lead, incomingText, conversationHistory = []) {
  if (!lead || !lead.phone) return null;

  if (ANTHROPIC_KEY) {
    try {
      const system   = buildSystem(lead);
      const messages = [
        ...conversationHistory.map(m => ({ role: m.role === 'landon' ? 'assistant' : 'user', content: m.text || '' })),
        { role: 'user', content: incomingText },
      ];
      const reply = await callClaude(system, messages);
      if (reply) return reply;
    } catch (err) {
      console.log(`[Landon] Claude error: ${err.message} — using template`);
    }
  }

  return templateReply(lead, incomingText);
}

module.exports = { getLandonReply };
