#!/usr/bin/env node
/**
 * LEADAPP Obsidian Sync
 * Runs every 5 minutes via PM2.
 * Writes the entire project state into the LEADAPP Obsidian vault so you can
 * open Obsidian, click LEADAPP, and see everything — stats, leads, logs, scripts.
 */

const fs   = require('fs');
const path = require('path');

const VAULT    = '/Users/mcfwebs/Documents/LEADAPP';
const ROOT     = '/Users/mcfwebs/MCFwbes/marketing';
const LEADS_F  = `${ROOT}/leads/leads-SA-US-no-website-2026-05-31.md`;
const TRACKER  = `${ROOT}/leads/engine-tracker.json`;
const GROUP_T  = `${ROOT}/leads/group-tracker.json`;
const TUNNEL_L = `${ROOT}/leads/tunnel.log`;
const LOCK_F   = `${ROOT}/leads/engine.lock`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function write(file, content) {
  const full = path.join(VAULT, file);
  const dir  = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function readTail(file, lines = 100) {
  if (!fs.existsSync(file)) return '_(no log yet)_';
  const all = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return all.slice(-lines).join('\n');
}

function tunnelUrl() {
  try {
    const lines = fs.readFileSync(TUNNEL_L, 'utf8').split('\n').filter(Boolean).reverse();
    const line  = lines.find(l => l.includes('lhr.life'));
    return line?.match(/https?:\/\/[a-z0-9\-]+\.lhr\.life/)?.[0] || null;
  } catch { return null; }
}

function now() { return new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }); }

// ── Sync functions ────────────────────────────────────────────────────────────

function syncDashboard(tracker, groupTracker) {
  const vals     = Object.values(tracker);
  const today    = new Date().toISOString().slice(0, 10);
  const sent     = vals.filter(v => v.status === 'sent').length;
  const sentToday= vals.filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
  const failed   = vals.filter(v => v.status === 'failed').length;
  const replied  = vals.filter(v => v.replied).length;
  const autoRep  = vals.filter(v => v.autoReplied).length;
  const fu1      = vals.filter(v => v.followUp1Sent).length;
  const fu2      = vals.filter(v => v.followUp2Sent).length;
  const running  = fs.existsSync(LOCK_F);
  const groupsToday = Object.values(groupTracker).filter(v => v.lastPosted?.startsWith(today)).length;
  const url      = tunnelUrl();

  let totalLeads = 0;
  if (fs.existsSync(LEADS_F)) {
    totalLeads = fs.readFileSync(LEADS_F, 'utf8').split('\n')
      .filter(l => /^\|\s*[^-]/.test(l) && !l.includes('Business') && !l.includes('Phone')).length;
  }
  const unsent = Math.max(0, totalLeads - sent - failed);

  const replies = Object.entries(tracker)
    .filter(([, v]) => v.replied)
    .sort((a, b) => new Date(b[1].repliedAt) - new Date(a[1].repliedAt))
    .slice(0, 20);

  const replyTable = replies.length
    ? replies.map(([phone, v]) =>
        `| ${v.name || phone} | ${phone} | ${v.city || ''} | ${v.category || ''} | ${v.repliedAt ? new Date(v.repliedAt).toLocaleString() : ''} |`
      ).join('\n')
    : '_No replies yet_';

  write('📊 Dashboard.md', `# 📊 LEADAPP Dashboard
> **Last sync:** ${now()}  |  **Engine:** ${running ? '🟢 Running' : '🔴 Stopped'}

---

## 🌐 Remote Access
${url ? `**Dashboard URL (phone):** [${url}](${url})` : '_Tunnel not connected — check mcf-tunnel in PM2_'}
**Permanent stats:** [mcf-stats-relay.onrender.com](https://mcf-stats-relay.onrender.com)

---

## 📈 Today's Stats
| Metric | Value |
|---|---|
| Sent today | **${sentToday}** |
| Total sent | **${sent}** |
| Leads left | **${unsent}** of ${totalLeads} |
| Replied | **${replied} 🎉** |
| Auto-replied | ${autoRep} |
| Follow-up 1 | ${fu1} |
| Follow-up 2 | ${fu2} |
| Failed (not on WA) | ${failed} |
| Groups posted today | ${groupsToday} |

---

## 🎉 Replies — Call These People!
| Name | Phone | City | Category | Replied At |
|---|---|---|---|---|
${replyTable}

---

## ⚙️ System Processes (PM2)
Run \`pm2 status\` to check live. All should be **online**:
- **mcf-engine** — WhatsApp outreach (daily 8am + follow-ups every 30min)
- **mcf-dashboard** — Local dashboard on port 4000
- **mcf-tunnel** — Remote access tunnel (updates URL above)
- **mcf-pusher** — Pushes stats to Render every 60s
- **mcf-group-poster** — Facebook groups every 30min
- **mcf-scraper** — New leads every 6h
- **mcf-cold-calls** — Phone calls Mon–Fri 9am
- **mcf-keep-awake** — Prevents Mac sleep
- **mcf-obsidian-sync** — Updates this vault every 5min

---

## 📞 Business Info
| | |
|---|---|
| Business | MCF Websites |
| CEO | KV — 0615442591 |
| CFO | Christopher — 0753203477 |
| Website | [mcfwebs.agency](https://www.mcfwebs.agency) |
| Email | feletchristopher@gmail.com |
| Render | [mcf-receptionist.onrender.com](https://mcf-receptionist.onrender.com) |
`);
}

function syncLeadsDB(tracker) {
  const entries = Object.entries(tracker)
    .sort((a, b) => new Date(b[1].sentAt || 0) - new Date(a[1].sentAt || 0));

  const rows = entries.map(([phone, v]) => {
    const status = v.replied ? '🎉 Replied' : v.autoReplied ? '↩️ Auto-replied' : v.status === 'sent' ? '✅ Sent' : '❌ Failed';
    return `| ${v.name || phone} | ${phone} | ${v.city || ''} | ${v.category || ''} | ${status} | ${v.sentAt ? new Date(v.sentAt).toLocaleDateString() : ''} |`;
  }).join('\n');

  write('👥 Leads Database.md', `# 👥 Leads Database
> **Total tracked:** ${entries.length}  |  **Last sync:** ${now()}

| Name | Phone | City | Category | Status | Sent |
|---|---|---|---|---|---|
${rows || '_No leads tracked yet_'}
`);
}

function syncActivityLog(tracker) {
  const recent = Object.entries(tracker)
    .filter(([, v]) => v.sentAt)
    .sort((a, b) => new Date(b[1].sentAt) - new Date(a[1].sentAt))
    .slice(0, 200);

  const lines = recent.map(([phone, v]) => {
    const events = [];
    if (v.sentAt)          events.push(`**Sent** ${new Date(v.sentAt).toLocaleString()}`);
    if (v.followUp1Sent)   events.push(`Follow-up 1 sent`);
    if (v.followUp2Sent)   events.push(`Follow-up 2 sent`);
    if (v.replied)         events.push(`🎉 **REPLIED** ${v.repliedAt ? new Date(v.repliedAt).toLocaleString() : ''}`);
    if (v.autoReplied)     events.push(`↩️ Auto-replied`);
    return `### ${v.name || phone} (${phone})\n- ${events.join('\n- ')}\n`;
  }).join('\n');

  write('📱 Activity Log.md', `# 📱 Activity Log
> **Last sync:** ${now()}

${lines || '_No activity yet_'}
`);
}

function syncReplies(tracker) {
  const replies = Object.entries(tracker)
    .filter(([, v]) => v.replied)
    .sort((a, b) => new Date(b[1].repliedAt) - new Date(a[1].repliedAt));

  const content = replies.length === 0
    ? '# 🎉 Replies\n\n_No replies yet — keep sending!_\n'
    : `# 🎉 Replies — ${replies.length} Lead(s) Interested!\n> **Last sync:** ${now()}\n\n` +
      replies.map(([phone, v]) => `## ${v.name || phone}
- **Phone:** ${phone}
- **City:** ${v.city || 'Unknown'}
- **Category:** ${v.category || 'Unknown'}
- **Sent:** ${v.sentAt ? new Date(v.sentAt).toLocaleString() : 'Unknown'}
- **Replied:** ${v.repliedAt ? new Date(v.repliedAt).toLocaleString() : 'Yes'}
- **Auto-replied sent:** ${v.autoReplied ? '✅ Yes' : '❌ No'}
- **Via number:** ${v.sentBy || 1}

> 📞 **Call this person NOW** — they're interested!
`).join('\n---\n\n');

  write('🎉 Replies.md', content);
}

function syncLogs() {
  const logFiles = {
    'engine':      `${ROOT}/leads/engine.log`,
    'cold-calls':  `${ROOT}/leads/cold-calls.log`,
    'group-poster':`${ROOT}/leads/group-poster.log`,
    'scraper':     `${ROOT}/leads/auto-scraper.log`,
    'tunnel':      `${ROOT}/leads/tunnel.log`,
    'pusher':      `${ROOT}/leads/pusher.log`,
  };

  for (const [name, file] of Object.entries(logFiles)) {
    const tail = readTail(file, 200);
    write(`Logs/${name}.md`, `# ${name} Log\n> Last 200 lines — synced ${now()}\n\n\`\`\`\n${tail}\n\`\`\`\n`);
  }
}

function syncScripts() {
  const scriptFiles = [
    ['engine/index.js',    'Scripts/engine-index.md',    'Engine — Main Controller'],
    ['engine/wa-client.js','Scripts/wa-client.md',       'Engine — WhatsApp Client'],
    ['engine/config.js',   'Scripts/config.md',          'Engine — Config'],
    ['engine/messages.js', 'Scripts/messages.md',        'Engine — Message Templates'],
    ['engine/tracker.js',  'Scripts/tracker.md',         'Engine — Lead Tracker'],
    ['group-poster.js',    'Scripts/group-poster.md',    'Facebook Group Poster'],
    ['auto-scraper.js',    'Scripts/auto-scraper.md',    'Auto Lead Scraper'],
    ['instagram-poster.js','Scripts/instagram-poster.md','Instagram Poster'],
    ['linkedin-poster.js', 'Scripts/linkedin-poster.md', 'LinkedIn Poster'],
    ['wa-status-poster.js','Scripts/wa-status-poster.md','WhatsApp Status Poster'],
    ['cold-call-outreach.js','Scripts/cold-calls.md',    'Cold Call Outreach'],
    ['tunnel.js',          'Scripts/tunnel.md',          'SSH Tunnel'],
    ['dashboard/server.js','Scripts/dashboard.md',       'Control Dashboard'],
    ['remote/stats-pusher.js','Scripts/stats-pusher.md', 'Stats Pusher'],
    ['remote/relay-server.js','Scripts/relay-server.md', 'Render Relay Server'],
    ['ecosystem.config.js','Scripts/ecosystem.md',       'PM2 Ecosystem Config'],
  ];

  for (const [src, dest, title] of scriptFiles) {
    const srcPath = `${ROOT}/scripts/${src}`;
    const altPath = `${ROOT}/${src}`;
    const filePath = fs.existsSync(srcPath) ? srcPath : fs.existsSync(altPath) ? altPath : null;
    if (!filePath) continue;
    const code = fs.readFileSync(filePath, 'utf8');
    write(dest, `# ${title}\n> Source: \`${filePath}\`  |  Synced: ${now()}\n\n\`\`\`javascript\n${code}\n\`\`\`\n`);
  }
}

function syncProjectNotes() {
  write('💡 Project Notes.md', `# 💡 LEADAPP — Project Notes

## What This System Does
MCF Websites is a web design agency (Christopher + KV) targeting SA/US small businesses.
This system automatically:
1. **Finds leads** — scrapes Yellow Pages SA every 6h (doctors, plumbers, dentists, etc.)
2. **Sends WhatsApp** — 150 messages/day via 3 numbers (8am daily)
3. **Follows up** — automatically at 2h and 5h if no reply
4. **Auto-replies** — when a lead responds, sends a warm holding message instantly
5. **Cold calls** — Twilio outbound calls Mon–Fri 9am (30 calls/day)
6. **Posts on Facebook** — 80+ SA business groups every 30min
7. **Posts on Instagram** — daily branded post at 10am
8. **Posts on LinkedIn** — daily at 11am
9. **Posts on WA Status** — daily at 9am
10. **Scrapes more leads** — continuously finds new numbers every 6h

## Credentials
Stored in \`marketing/leads/.env\` — never committed to git.
| Service | Detail |
|---|---|
| Gmail | websitesmcf@gmail.com |
| Render Relay | https://mcf-stats-relay.onrender.com |
| AI Receptionist | https://mcf-receptionist.onrender.com |

## WhatsApp Numbers
- **Number 1** — Primary (session: \`marketing/leads/sessions/wa-number-1\`)
- **Number 2** — Add via: \`node marketing/scripts/engine/add-number-2.js\`
- **Number 3** — Add via: \`node marketing/scripts/engine/add-number-3.js\`

## CRITICAL RULES
- ⛔ **NEVER message 0829291282** (Vinesh Murugan — Christopher's dad at FirstRand Group Tax)
- ✅ Auto-replies only go to leads in the tracker — personal messages are NEVER read

## Key File Paths
\`\`\`
/Users/mcfwebs/MCFwbes/
├── marketing/
│   ├── ecosystem.config.js       ← PM2 process manager config
│   ├── leads/
│   │   ├── leads-SA-US-no-website-2026-05-31.md  ← 595 leads
│   │   ├── engine-tracker.json   ← who was contacted + status
│   │   ├── sessions/             ← WhatsApp sessions (wa-number-1, 2, 3)
│   │   └── *.log                 ← all process logs
│   └── scripts/
│       ├── engine/               ← WhatsApp blast engine
│       ├── dashboard/            ← web dashboard (port 4000)
│       ├── remote/               ← Render relay + stats pusher
│       └── receptionist/         ← AI receptionist (Render)
\`\`\`

## PM2 Commands
\`\`\`bash
pm2 status              # see all processes
pm2 logs mcf-engine     # engine logs
pm2 restart all         # restart everything
pm2 reload marketing/ecosystem.config.js --update-env  # reload config
\`\`\`

## Running When Mac Is Off
The system requires the Mac to be on.
To run 24/7 even when Mac is off → deploy to cloud VPS.
See: \`Scripts/cloud-deploy.md\`
`);
}

function syncCloudDeploy() {
  write('Scripts/cloud-deploy.md', `# ☁️ Deploy to Cloud (Run When Mac Is Off)

## Cheapest Options
| Provider | Cost | Notes |
|---|---|---|
| **Oracle Cloud Always Free** | **FREE forever** | 1 OCPU, 1GB RAM — best choice |
| Hetzner CX11 | €3.29/month | Fast, reliable |
| DigitalOcean | $4/month | Easy UI |

---

## Option 1: Oracle Cloud (FREE)

### Step 1 — Create Account
1. Go to: https://www.oracle.com/cloud/free/
2. Sign up (credit card needed for verification but NOT charged)
3. Create an **Ubuntu 22.04** instance (Ampere ARM, Always Free)

### Step 2 — SSH Into Your VPS
\`\`\`bash
ssh -i your-key.pem ubuntu@YOUR-VPS-IP
\`\`\`

### Step 3 — Run This One-Line Setup Script
Copy and run on the VPS:
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/CFwebs223/mcfwebs22/main/deploy.sh | bash
\`\`\`

Or run the steps manually — see \`Scripts/vps-setup.md\`

---

## Option 2: Manual Setup (Any Ubuntu VPS)

### On the VPS, run:
\`\`\`bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome dependencies + Xvfb (virtual display for WhatsApp)
sudo apt-get install -y wget gnupg xvfb libgtk-3-0 libx11-xcb1 \\
  libnss3 libxss1 libasound2 libatk1.0-0 libatk-bridge2.0-0 \\
  libcups2 libdbus-1-3 libdrm2 libgbm1 libxcomposite1 libxdamage1 \\
  libxfixes3 libxrandr2 libxtst6

# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f -y

# Install PM2
sudo npm install -g pm2

# Copy project from Mac (run this ON YOUR MAC):
# scp -r /Users/mcfwebs/MCFwbes ubuntu@YOUR-VPS-IP:~/
# scp -r /Users/mcfwebs/MCFwbes/marketing/leads/sessions ubuntu@YOUR-VPS-IP:~/MCFwbes/marketing/leads/

# On VPS — install dependencies
cd ~/MCFwbes && npm install
cd marketing/scripts/dashboard && npm install
cd ../remote && npm install
cd ../../..

# Update Chrome path in config.js:
# Change CHROME to: '/usr/bin/google-chrome'

# Start everything
pm2 start marketing/ecosystem.config.js
pm2 save
pm2 startup
\`\`\`

### Copy WhatsApp Sessions (IMPORTANT)
Your WhatsApp is already authenticated on Mac.
Copy the session files to avoid re-scanning QR:
\`\`\`bash
# Run on Mac:
scp -r /Users/mcfwebs/MCFwbes/marketing/leads/sessions ubuntu@YOUR-VPS-IP:~/MCFwbes/marketing/leads/
\`\`\`

### Update Chrome Path on VPS
Edit \`marketing/scripts/engine/config.js\` on the VPS:
\`\`\`javascript
const CHROME = '/usr/bin/google-chrome';
\`\`\`

---

## After Deployment
- Everything runs on the VPS 24/7
- Mac can be off completely
- Access dashboard via the tunnel URL (always in Render relay page)
- WhatsApp sessions carry over — no re-scanning needed
`);
}

// ── Main sync ──────────────────────────────────────────────────────────────────
function sync() {
  try {
    const tracker      = readJSON(TRACKER);
    const groupTracker = readJSON(GROUP_T);

    syncDashboard(tracker, groupTracker);
    syncLeadsDB(tracker);
    syncActivityLog(tracker);
    syncReplies(tracker);
    syncLogs();
    syncScripts();
    syncProjectNotes();
    syncCloudDeploy();

    console.log(`[${now()}] ✅ LEADAPP vault synced (${Object.keys(tracker).length} leads tracked)`);
  } catch (err) {
    console.error(`[${now()}] ❌ Sync error: ${err.message}`);
  }
}

// Run immediately then every 5 minutes
sync();
setInterval(sync, 5 * 60 * 1000);
