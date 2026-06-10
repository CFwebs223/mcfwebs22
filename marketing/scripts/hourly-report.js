#!/usr/bin/env node
/**
 * MCF Hourly Report — runs every hour via PM2 cron
 * Sends a WhatsApp status report to Christopher + optional email
 */

require('dotenv').config({ path: require('path').join(__dirname, '../leads/.env') });
const fs   = require('fs');
const path = require('path');

const TRACKER_FILE  = path.join(__dirname, '../leads/engine-tracker.json');
const LEADS_FILE    = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const GROUP_TRACKER = path.join(__dirname, '../leads/group-tracker.json');
const CALL_TRACKER  = path.join(__dirname, '../leads/call-tracker.json');
const REPORT_FILE   = path.join(__dirname, '../leads/last-report.json');
const SESSION_1     = path.join(__dirname, '../leads/sessions/wa-number-1');
const CHRISTOPHER   = '+27753203477';

async function sendReport() {
  const tracker = fs.existsSync(TRACKER_FILE) ? JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')) : {};
  const vals    = Object.values(tracker);
  const today   = new Date().toISOString().slice(0, 10);
  const now     = new Date();
  const hour    = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  // Stats
  const sentToday   = vals.filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
  const totalSent   = vals.filter(v => v.status === 'sent').length;
  const replied     = vals.filter(v => v.replied).length;
  const repliedToday = vals.filter(v => v.repliedAt?.startsWith(today)).length;
  const failed      = vals.filter(v => v.status === 'failed').length;
  const fu1         = vals.filter(v => v.followUp1Sent).length;
  const callTracker = fs.existsSync(CALL_TRACKER) ? JSON.parse(fs.readFileSync(CALL_TRACKER, 'utf8')) : {};
  const callsToday  = Object.values(callTracker).filter(v => v.calledAt?.startsWith(today)).length;
  const groupCount  = fs.existsSync(GROUP_TRACKER)
    ? Object.values(JSON.parse(fs.readFileSync(GROUP_TRACKER, 'utf8'))).filter(v => v.lastPosted?.startsWith(today)).length
    : 0;

  let totalLeads = 0;
  try {
    totalLeads = fs.readFileSync(LEADS_FILE, 'utf8').split('\n')
      .filter(l => /^\|\s*[^-]/.test(l) && !l.includes('Business') && !l.includes('Phone')).length;
  } catch {}

  const unsent = Math.max(0, totalLeads - totalSent - failed);

  // Hot leads (replied but not yet called)
  const hot = vals.filter(v => v.replied && !v.converted).slice(0, 5);

  // Build message
  const lines = [
    `📊 *MCF LEADAPP — ${hour} Report*`,
    ``,
    `✅ Sent today: *${sentToday}*`,
    `💬 Replies today: *${repliedToday}* (${replied} total)`,
    `📞 Calls made today: *${callsToday}*`,
    `📢 Groups posted: *${groupCount}*`,
    ``,
    `📋 *Pipeline*`,
    `• Total leads: ${totalLeads}`,
    `• Remaining to contact: ${unsent}`,
    `• Follow-ups sent: ${fu1}`,
    `• Failed deliveries: ${failed}`,
  ];

  if (hot.length) {
    lines.push(``, `🔥 *HOT LEADS — Call These Now:*`);
    hot.forEach(v => {
      lines.push(`• ${v.name || 'Unknown'} | ${v.phone} | ${v.city || ''} | ${v.category || ''}`);
    });
    lines.push(``, `📱 Tap their number above to call directly.`);
  }

  lines.push(``, `_mcfwebs.agency | Christopher 075 320 3477_`);

  const msg = lines.join('\n');

  // Save report for LEADAPP display
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ msg, at: new Date().toISOString(), stats: { sentToday, replied, repliedToday, callsToday, groupCount, totalLeads, unsent } }));

  // Send via WhatsApp if session exists
  if (!fs.existsSync(path.join(SESSION_1, 'session'))) {
    console.log('[Report] No WA session — skipping WhatsApp delivery');
    console.log(msg);
    return;
  }

  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const CHROME = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_1 }),
      puppeteer: { headless: true, executablePath: CHROME, protocolTimeout: 60000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] },
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 90000);
      client.on('ready', async () => {
        clearTimeout(t);
        await client.sendMessage(CHRISTOPHER.replace('+', '') + '@c.us', msg);
        console.log(`[Report] ✅ Sent to Christopher at ${hour}`);
        await client.destroy();
        resolve();
      });
      client.on('auth_failure', () => reject(new Error('auth failed')));
      client.initialize();
    });
  } catch (err) {
    console.error('[Report] WA send failed:', err.message);
    console.log('[Report] Report content:\n' + msg);
  }

  // Also send via email if configured
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: `MCF LEADAPP ${hour} Report — ${sentToday} sent, ${repliedToday} replies`,
        text: msg.replace(/\*/g, '').replace(/_/g, ''),
      });
      console.log('[Report] ✅ Email sent');
    } catch (err) {
      console.error('[Report] Email failed:', err.message);
    }
  }
}

sendReport().catch(err => console.error('[Report] Fatal:', err.message));
