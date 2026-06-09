// All message templates — initial + follow-ups per category

const INITIAL = {
  // Generic (used for most categories)
  default: [
    (name) => `Good news and bad news 😄

Bad news: I Googled *${name}* and couldn't find a website — customers searching for you right now are going straight to your competitor.

Good news: that's exactly what I fix.

I'm Christopher, CEO of *MCF Websites* — we build professional websites for service businesses like yours.

✅ Customers find you on Google
✅ Looks professional = more trust = more bookings
✅ Clients can WhatsApp or book you directly
✅ Show your services, prices & reviews

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
✅ I build it first — you only pay if you love it

Worth a quick chat?
📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,
  ],

  // Medical / Dental / Professional
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
  ],

  // Legal
  legal: [
    (name) => `Hi,

I noticed *${name}* doesn't have a website — which means potential clients searching for legal help in your area are finding other attorneys instead.

I'm Christopher from *MCF Websites*. We build professional websites for law firms and attorneys:
✅ Clients find you on Google
✅ Show your practice areas & credentials
✅ Online consultation booking
✅ Professional credibility that converts visitors to clients

*I build it first — you only pay if you're satisfied.*

📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,
  ],
};

const FOLLOWUP_1 = [
  (name) => `Hi again! 😊 Just checking if you saw my message about getting *${name}* online.

Happy to answer any questions — no pressure at all!

📞 075 320 3477`,

  (name) => `Hey! Following up on my earlier message about a website for *${name}*.

If you're curious what it could look like, just reply *YES* and I'll send you examples. Free, no commitment 👍`,
];

const FOLLOWUP_2 = [
  (name) => `Last message from me, I promise! 😄

If *${name}* ever needs a professional website — I'm here. I build it first, you pay nothing if you're not happy.

R2,500 once-off. No monthly fees.

📞 075 320 3477 | 🌐 https://www.mcfwebs.agency`,
];

function getInitial(name, category = '') {
  const cat = category.toLowerCase();
  let pool;
  if (['doctor','dentist','medical','health','physio','optom','vet','clinic'].some(c => cat.includes(c))) {
    pool = INITIAL.medical;
  } else if (['lawyer','attorney','legal','law'].some(c => cat.includes(c))) {
    pool = INITIAL.legal;
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
