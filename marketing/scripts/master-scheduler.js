#!/usr/bin/env node
/**
 * MCF Websites — Master Daily Scheduler
 * Runs every day at 8am:
 *   1. WhatsApp blast  (50 messages)
 *   2. Cold calls      (20 calls via Twilio — needs verified numbers)
 *   3. Cold emails     (50 emails via Gmail — needs email leads)
 *
 * Usage:
 *   node master-scheduler.js          Start (runs all 3 at 8am daily)
 *   node master-scheduler.js --now    Run all 3 right now (test)
 *   node master-scheduler.js --stop   Stop the scheduler
 */

require('dotenv').config({ path: require('path').join(__dirname, '../leads/.env') });
const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const LOCK_FILE = path.join(__dirname, '../leads/master-scheduler.lock');
const SEND_HOUR = 8; // 8am daily
const SCRIPTS   = path.join(__dirname);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function msUntilNextRun() {
  const now  = new Date();
  const next = new Date();
  next.setHours(SEND_HOUR, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  return next - now;
}

function runScript(script, args = []) {
  return new Promise((resolve) => {
    console.log(`\n▶️  Running ${script} ${args.join(' ')}`);
    const proc = spawn('node', [path.join(SCRIPTS, script), ...args], {
      stdio: 'inherit',
      env: { ...process.env },
    });
    proc.on('close', (code) => {
      console.log(`   ${script} finished (exit ${code})`);
      resolve(code);
    });
  });
}

async function runAllTasks() {
  const now = new Date().toLocaleString();
  console.log(`\n${'='.repeat(55)}`);
  console.log(`🚀 MCF DAILY OUTREACH — ${now}`);
  console.log('='.repeat(55));

  // 1. WhatsApp blast
  console.log('\n📱 TASK 1/3 — WhatsApp Messages');
  await runScript('wa-blast.js', ['--send', '--limit', '50']);

  // Small gap between tasks
  await sleep(5000);

  // 2. Cold calls (needs Twilio with SA geo permissions + verified numbers)
  console.log('\n📞 TASK 2/3 — Cold Calls');
  await runScript('cold-call-outreach.js', ['--send', '--limit', '20']);

  // Small gap between tasks
  await sleep(5000);

  // 3. Cold emails
  console.log('\n📧 TASK 3/3 — Cold Emails');
  await runScript('cold-email.js', ['--send', '--limit', '50']);

  console.log(`\n${'='.repeat(55)}`);
  console.log(`✅ All tasks done for ${new Date().toLocaleDateString()}`);
  console.log('='.repeat(55));
}

async function main() {
  // --stop
  if (process.argv.includes('--stop')) {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      try { process.kill(parseInt(pid), 'SIGTERM'); console.log(`✅ Stopped scheduler (PID ${pid})`); }
      catch { console.log('Scheduler not running.'); }
      fs.unlinkSync(LOCK_FILE);
    } else { console.log('Scheduler not running.'); }
    return;
  }

  // --now (run immediately, no scheduling)
  if (process.argv.includes('--now')) {
    await runAllTasks();
    return;
  }

  // Check for duplicate
  if (fs.existsSync(LOCK_FILE)) {
    const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
    try { process.kill(parseInt(pid), 0); console.error(`\n❌ Already running (PID ${pid}). Run: node master-scheduler.js --stop\n`); process.exit(1); } catch {}
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid));
  const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  console.log('\n🚀 MCF Websites — Master Daily Scheduler');
  console.log('   Runs WhatsApp + Cold Calls + Cold Emails every day at 8am\n');
  console.log('   Stop anytime: node master-scheduler.js --stop\n');

  // Run immediately if before 8am today's batch hasn't gone yet
  const now = new Date();
  if (now.getHours() < SEND_HOUR) {
    console.log('   Starting today\'s run now (before 8am)...');
    await runAllTasks();
  }

  // Schedule loop
  const schedule = async () => {
    const ms   = msUntilNextRun();
    const next = new Date(Date.now() + ms);
    console.log(`\n⏰ Next run: ${next.toLocaleString()} (${Math.round(ms / 3600000)}h from now)`);
    await sleep(ms);
    await runAllTasks();
    schedule();
  };

  schedule();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
