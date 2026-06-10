// All message templates — initial + follow-ups per category

const INITIAL = {
  default: [
    (name) => `Good news and bad news 😄

Bad news: I Googled *${name}* and couldn't find a website — customers searching for you right now are going straight to your competitor.

Good news: that's exactly what I fix.

I'm Christopher from *MCF Websites* — we build professional websites for service businesses like yours.

✅ Customers find you on Google
✅ Looks professional = more trust = more bookings
✅ Clients WhatsApp or book you directly
✅ Your services, prices & reviews all in one place

*I build it first. If you don't love it, you pay nothing.*

Starting from R2,500 once-off. No monthly fees.

📞 075 320 3477
🌐 https://www.mcfwebs.agency`,

    (name) => `Hi! Quick one 👋

I was looking up businesses in your area and noticed *${name}* doesn't have a website yet.

That's actually a big opportunity — most of your local competitors don't either. Whoever goes online first wins.

I'm Christopher from *MCF Websites*.
✅ Professional website from R2,500 once-off
✅ Customers find you on Google
✅ No monthly fees
✅ Build first — pay only if you love it

Worth a quick chat?
📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,

    (name) => `Hey! 😊

Just a heads up — I searched for *${name}* online and couldn't find a website.

I know running a business keeps you busy, so let me handle the online side completely.

*MCF Websites* — we build, host, and manage your site from R2,500.
No monthly fees. No tech headaches.

Reply with *INTERESTED* and I'll show you what we'd build for you, for free. No commitment 👍

📞 075 320 3477`,

    (name) => `Hi there,

I noticed *${name}* doesn't have a website — meaning anyone who Googles your service in your area finds someone else, not you.

I'm KV from MCF Websites. We solve this:
→ Professional site live within 7 days
→ Shows up on Google searches
→ Customers can contact / book you directly
→ R2,500 once-off, no monthly costs

I'll design it first for free — you only pay when you're happy.

Interested? WhatsApp me back 🙏`,

    (name) => `Quick question for *${name}* 🙋

How are new customers finding you right now?

If the answer is "word of mouth" — you're missing 70% of potential customers who search Google first.

A website changes that. I'm Christopher from *MCF Websites* and I can have yours live within a week.

💰 R2,500 once-off
📱 Mobile-friendly
🔍 Google SEO included
✅ Build first, pay later

Any questions? Just reply here 👇`,

    (name) => `Hi! 👋

I build websites for businesses across South Africa and I noticed *${name}* doesn't have one yet.

I won't waste your time — here's the deal:

I build your site. You check it out. If you don't love it, I delete it and you owe nothing.

If you do love it: R2,500 once-off, no monthly fees, goes live same day.

Sound fair? 😊

📞 075 320 3477 — Christopher, MCF Websites`,
  ],

  medical: [
    (name) => `Hi! 👋

I noticed *${name}* doesn't have a professional website yet.

For a medical practice, your website is often the first impression patients get — and right now they can't find you online at all.

I'm Christopher from *MCF Websites*. We build websites for practices like yours:
✅ Patients find you on Google
✅ Online appointment booking
✅ Show your services, doctors & hours
✅ Professional = more patient trust

*Risk-free: I build it first, you only pay if you love it.*

Starting from R3,500.

📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,

    (name) => `Good day,

I was researching healthcare providers in your area and noticed *${name}* doesn't appear in online searches.

Most patients today Google for a doctor or specialist before calling. Without a website, they find your competition instead.

I'm Christopher from MCF Websites — we build professional medical practice websites:
→ Appointment booking form
→ Doctor profiles & credentials
→ Services & medical aid info
→ Ranks on Google locally

R3,500 once-off. I build first, you approve before paying.

📞 075 320 3477`,
  ],

  legal: [
    (name) => `Hi,

I noticed *${name}* doesn't have a website — which means potential clients searching for legal help in your area are finding other attorneys instead.

I'm Christopher from *MCF Websites*. We build professional websites for law firms:
✅ Clients find you on Google
✅ Practice areas & credentials
✅ Online consultation booking
✅ Professional credibility that converts

*I build it first — you only pay if you're satisfied.*

📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,
  ],

  construction: [
    (name) => `Hi! 👷

I noticed *${name}* doesn't have a website showing off your work.

In construction, before a client calls — they Google you. Without a website, they call someone else.

I'm Christopher from *MCF Websites*:
✅ Show your projects & photos
✅ Clients request quotes directly
✅ Google shows you first locally
✅ R2,500 once-off, no monthly fees

Build first, pay later — no risk to you.

📞 075 320 3477`,
  ],
};

const FOLLOWUP_1 = [
  (name) => `Hi again 😊 Just checking if you saw my message about getting *${name}* online.

Happy to answer any questions — no pressure at all!

📞 075 320 3477`,

  (name) => `Hey! Following up on my message about a website for *${name}*.

If you're curious what it could look like, just reply *YES* and I'll send you examples. Free, no commitment 👍`,

  (name) => `Hi! Just a quick follow-up 🙏

Still happy to build a website for *${name}* — no upfront cost, you only pay if you love it.

Worth a 2-minute chat? 📞 075 320 3477`,
];

const FOLLOWUP_2 = [
  (name) => `Last message from me, I promise! 😄

If *${name}* ever needs a professional website — I'm here. I build it first, you pay nothing if you're not happy.

R2,500 once-off. No monthly fees.

📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,

  (name) => `Final message — just leaving the door open 🙏

When *${name}* is ready to go online: R2,500, 7 days, zero risk.

📞 075 320 3477 — Christopher, MCF Websites`,
];

function getInitial(name, category = '') {
  const cat = category.toLowerCase();
  let pool;
  if (['doctor','dentist','medical','health','physio','optom','vet','clinic','pharmacy'].some(c => cat.includes(c))) {
    pool = [...INITIAL.medical, ...INITIAL.default];
  } else if (['lawyer','attorney','legal','law'].some(c => cat.includes(c))) {
    pool = [...INITIAL.legal, ...INITIAL.default];
  } else if (['builder','contractor','plumber','electrician','construct','roofer','painter'].some(c => cat.includes(c))) {
    pool = [...INITIAL.construction, ...INITIAL.default];
  } else {
    pool = INITIAL.default;
  }
  return pool[Math.floor(Math.random() * pool.length)](name);
}

function getFollowup1(name) {
  return FOLLOWUP_1[Math.floor(Math.random() * FOLLOWUP_1.length)](name);
}

function getFollowup2(name) {
  return FOLLOWUP_2[Math.floor(Math.random() * FOLLOWUP_2.length)](name);
}

module.exports = { getInitial, getFollowup1, getFollowup2 };
