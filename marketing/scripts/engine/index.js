#!/usr/bin/env node
/**
 * MCF Websites — Client Acquisition Engine
 *
 * Runs every day at 8am:
 *   • 2 WhatsApp numbers × 50 messages = 100 leads/day
 *   • Auto follow-up at 2h if no reply
 *   • Auto follow-up at 5h if still no reply
 *   • Detects replies (leads only — never reads personal messages)
 *   • Notifies you the moment a lead replies
 *
 * Usage:
 *   node engine/index.js              Start (runs daily at 8am)
 *   node engine/index.js --now        Run blast immediately
 *   node engine/index.js --followups  Run follow-ups right now
 *   node engine/index.js --stats      Show all stats
 *   node engine/index.js --stop       Stop the engine
 */

const fs   = require('fs');
const path = require('path');
const cfg  = require('./config');
const msgs = require('./messages');
const trk  = require('./tracker');
const { parseLeads, getUnsent } = require('./leads');
const { createClient, connect, send, sleep, randomDelay } = require('./wa-client');

const LOCK_FILE = path.join(__dirname, '../../leads/engine.lock');

// ── Helpers ────────────────────────────────────────────────────────────────────
function msUntilHour(h) {
  const now = new Date(), next = new Date();
  next.setHours(h, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next - now;
}

// ── Send batch on one client ───────────────────────────────────────────────────
async function sendBatch(client, leads, trackerRef, sentByNum, sessionPath) {
  let currentClient = client;
  let sent = 0, failed = 0;
  for (const lead of leads) {
    let retried = false;
    while (true) {
      try {
        const message = msgs.getInitial(lead.name, lead.category);
        await send(currentClient, lead.phone, message);
        trk.markSent(trackerRef, lead, sentByNum);
        sent++;
        console.log(`  ✅ [${sent}/${leads.length}] ${lead.name}`);
        if (sent < leads.length) {
          const wait = randomDelay(cfg.MIN_DELAY, cfg.MAX_DELAY);
          console.log(`     ⏳ ${Math.round(wait/1000)}s...`);
          await sleep(wait);
        }
        break;
      } catch (err) {
        const isFrameCrash = err.message && (
          err.message.includes('detached Frame') ||
          err.message.includes('Session closed') ||
          err.message.includes('Execution context was destroyed')
        );
        if (!retried && isFrameCrash) {
          console.log('  ⚠️  Connection dropped, reconnecting...');
          try { await currentClient.destroy(); } catch {}
          await sleep(5000);
          const newClient = createClient(sessionPath, sentByNum);
          currentClient = await connect(newClient);
          retried = true;
          continue;
        }
        failed++;
        trk.markFailed(trackerRef, lead, err.message);
        console.log(`  ❌ ${lead.name} — ${err.message}`);
        break;
      }
    }
  }
  return { sent, failed, client: currentClient };
}

// ── Follow-up sender ───────────────────────────────────────────────────────────
async function runFollowups(client, clientNum = 1) {
  const t   = trk.load();
  const fu1 = trk.needsFollowup1(t);
  const fu2 = trk.needsFollowup2(t);
  const fu3 = trk.needsFollowup3(t);

  console.log(`\n📬 Follow-ups due: ${fu1.length} (4h) + ${fu2.length} (24h) + ${fu3.length} (72h)`);

  for (const lead of fu1) {
    try {
      await send(client, lead.phone, msgs.getFollowup1(lead.name));
      trk.markFollowup1(trk.load(), lead.phone);
      console.log(`  ✅ Follow-up 1 → ${lead.name}`);
      await sleep(randomDelay(20000, 45000));
    } catch (err) { console.log(`  ❌ FU1 failed → ${lead.name}: ${err.message}`); }
  }

  for (const lead of fu2) {
    try {
      await send(client, lead.phone, msgs.getFollowup2(lead.name));
      trk.markFollowup2(trk.load(), lead.phone);
      console.log(`  ✅ Follow-up 2 → ${lead.name}`);
      await sleep(randomDelay(20000, 45000));
    } catch (err) { console.log(`  ❌ FU2 failed → ${lead.name}: ${err.message}`); }
  }

  for (const lead of fu3) {
    try {
      await send(client, lead.phone, msgs.getFollowup3(lead.name));
      trk.markFollowup3(trk.load(), lead.phone);
      console.log(`  ✅ Follow-up 3 → ${lead.name}`);
      await sleep(randomDelay(20000, 45000));
    } catch (err) { console.log(`  ❌ FU3 failed → ${lead.name}: ${err.message}`); }
  }
}

// ── Daily run ──────────────────────────────────────────────────────────────────
async function dailyRun() {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🚀 MCF CLIENT ENGINE — ${new Date().toLocaleString()}`);
  console.log('═'.repeat(55));

  const allLeads = parseLeads();
  const t        = trk.load();
  const unsent   = allLeads.filter(l => {
    const e = t[l.phone];
    if (!e) return true;                                             // never contacted
    if (e.status !== 'failed') return false;                        // sent/replied — skip
    if (e.error?.includes('Not on WhatsApp')) return false;         // permanent skip
    if (e.error?.includes('No LID')) return false;                  // permanent skip
    return true;                                                     // retry other failures
  });
  const sentToday = trk.todaySentCount(t);

  if (unsent.length === 0) {
    console.log('\n✅ All leads contacted! Nothing to send.\n');
    return;
  }

  const sentToday2 = trk.todaySentCount(trk.load());
  const numNumbers = [cfg.SESSION_1, cfg.SESSION_2, cfg.SESSION_3].filter(s => fs.existsSync(s)).length || 1;
  const remaining2 = (cfg.DAILY_LIMIT * numNumbers) - sentToday2;

  const batch = unsent.slice(0, Math.min(remaining2, unsent.length));
  const third = Math.ceil(batch.length / 3);
  const batch1 = batch.slice(0, third);
  const batch2 = batch.slice(third, third * 2);
  const batch3 = batch.slice(third * 2);

  console.log(`\n📤 Sending to ${batch.length} leads (${batch1.length}/#1, ${batch2.length}/#2, ${batch3.length}/#3)\n`);

  // Connect number 1
  console.log('📱 Connecting WhatsApp number 1...');
  const client1 = createClient(cfg.SESSION_1, 1);
  let wa1       = await connect(client1);
  console.log('✅ Number 1 connected!\n');

  const t1 = trk.load();
  const r1 = await sendBatch(wa1, batch1, t1, 1, cfg.SESSION_1);
  wa1 = r1.client;

  // Connect number 2 (only if session exists)
  if (batch2.length > 0 && fs.existsSync(cfg.SESSION_2)) {
    console.log('\n📱 Connecting WhatsApp number 2...');
    const client2 = createClient(cfg.SESSION_2, 2);
    try {
      let wa2 = await connect(client2);
      console.log('✅ Number 2 connected!\n');
      const t2 = trk.load();
      const r2 = await sendBatch(wa2, batch2, t2, 2, cfg.SESSION_2);
      wa2 = r2.client;
      console.log(`\n📊 Number 2: Sent ${r2.sent} | Failed ${r2.failed}`);
      await wa2.destroy();
    } catch (err) {
      console.log(`⚠️  Number 2 not available: ${err.message} — sending via number 1`);
      const t2f = trk.load();
      const r2f = await sendBatch(wa1, batch2, t2f, 1, cfg.SESSION_1);
      wa1 = r2f.client;
    }
  } else if (batch2.length > 0) {
    const t2 = trk.load();
    const r2  = await sendBatch(wa1, batch2, t2, 1, cfg.SESSION_1);
    wa1 = r2.client;
  }

  // Connect number 3 (only if session exists)
  if (batch3.length > 0 && fs.existsSync(cfg.SESSION_3)) {
    console.log('\n📱 Connecting WhatsApp number 3...');
    const client3 = createClient(cfg.SESSION_3, 3);
    try {
      let wa3 = await connect(client3);
      console.log('✅ Number 3 connected!\n');
      const t3 = trk.load();
      const r3 = await sendBatch(wa3, batch3, t3, 3, cfg.SESSION_3);
      wa3 = r3.client;
      console.log(`\n📊 Number 3: Sent ${r3.sent} | Failed ${r3.failed}`);
      await wa3.destroy();
    } catch (err) {
      console.log(`⚠️  Number 3 not available: ${err.message} — sending via number 1`);
      const t3f = trk.load();
      const r3f = await sendBatch(wa1, batch3, t3f, 1, cfg.SESSION_1);
      wa1 = r3f.client;
    }
  } else if (batch3.length > 0) {
    const t3 = trk.load();
    const r3  = await sendBatch(wa1, batch3, t3, 1, cfg.SESSION_1);
    wa1 = r3.client;
  }

  // Run follow-ups
  await runFollowups(wa1, 1);

  await wa1.destroy();

  // Final stats
  const final = trk.stats(trk.load());
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`📊 RESULTS`);
  console.log(`   Sent total:    ${final.sent}`);
  console.log(`   Replied:       ${final.replied}`);
  console.log(`   Follow-ups 1:  ${final.followup1}`);
  console.log(`   Follow-ups 2:  ${final.followup2}`);
  console.log(`   Remaining:     ${allLeads.filter(l => !trk.load()[l.phone]).length}`);
  console.log('═'.repeat(55) + '\n');
}

// ── Follow-up only run (every 30 min) ─────────────────────────────────────────
async function followupRun() {
  const t = trk.load();
  const fu1 = trk.needsFollowup1(t);
  const fu2 = trk.needsFollowup2(t);
  if (fu1.length === 0 && fu2.length === 0) return;

  console.log(`\n⏰ Follow-up check: ${fu1.length + fu2.length} due`);
  const client1 = createClient(cfg.SESSION_1, 1);
  const wa1     = await connect(client1);
  await runFollowups(wa1, 1);
  await wa1.destroy();
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--stop')) {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      try { process.kill(parseInt(pid), 'SIGTERM'); console.log(`✅ Stopped (PID ${pid})`); }
      catch { console.log('Not running.'); }
      fs.unlinkSync(LOCK_FILE);
    } else { console.log('Engine not running.'); }
    return;
  }

  if (args.includes('--stats')) {
    const t = trk.load();
    const s = trk.stats(t);
    const l = require('./leads').getStats();
    console.log(`\n📊 MCF CLIENT ENGINE STATS`);
    console.log(`   Total leads:    ${l.total}`);
    console.log(`   Unsent:         ${l.unsent}`);
    console.log(`   Sent:           ${s.sent}`);
    console.log(`   Failed:         ${l.failed}`);
    console.log(`   Replied:        ${s.replied} 🎉`);
    console.log(`   Follow-ups 1:   ${s.followup1}`);
    console.log(`   Follow-ups 2:   ${s.followup2}`);
    console.log(`   Sent today:     ${s.sentToday}`);
    return;
  }

  if (args.includes('--now')) { await dailyRun(); return; }
  if (args.includes('--followups')) {
    const client = createClient(cfg.SESSION_1, 1);
    const wa     = await connect(client);
    await runFollowups(wa);
    await wa.destroy();
    return;
  }

  // ── Scheduler mode ────────────────────────────────────────────────────────
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    try { process.kill(parseInt(pid), 0); console.error(`❌ Already running (PID ${pid}). Run: node engine/index.js --stop`); process.exit(1); } catch {}
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT',  () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  console.log('\n🚀 MCF CLIENT ACQUISITION ENGINE STARTED');
  console.log('   100 messages/day (2 numbers × 50)');
  console.log('   Auto follow-up at 2h and 5h');
  console.log('   Replies detected automatically');
  console.log('   Runs every day at 8am\n');
  console.log('   Stop: node engine/index.js --stop\n');

  // Run immediately if before 8am and haven't run today
  const now = new Date();
  const sentToday = trk.todaySentCount(trk.load());
  if (sentToday < cfg.DAILY_LIMIT) {
    await dailyRun();
  }

  // 8am daily blast + 30-min follow-up check loop
  const dailySchedule = async () => {
    const ms   = msUntilHour(cfg.SEND_HOUR);
    const next = new Date(Date.now() + ms);
    console.log(`\n⏰ Next blast: ${next.toLocaleString()}`);
    await sleep(ms);
    await dailyRun();
    dailySchedule();
  };

  const followupSchedule = async () => {
    await sleep(30 * 60 * 1000); // every 30 min
    try { await followupRun(); } catch {}
    followupSchedule();
  };

  dailySchedule();
  followupSchedule();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
