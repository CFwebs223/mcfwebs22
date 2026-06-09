#!/usr/bin/env node
/**
 * Remote tunnel using localhost.run (SSH-based, no install needed)
 * URL is logged to marketing/leads/tunnel.log
 * PM2 auto-restarts if it drops
 */
const { spawn }   = require('child_process');
const fs          = require('fs');
const path        = require('path');
const LOG         = path.join(__dirname, '../leads/tunnel.log');

function log(msg) {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG, line + '\n'); } catch {}
}

log('Starting remote tunnel via localhost.run...');

const proc = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-R', '80:localhost:4000',
  'nokey@localhost.run',
], { stdio: ['ignore', 'pipe', 'pipe'] });

proc.stdout.on('data', (data) => {
  const text = data.toString();
  // localhost.run prints the URL in its output
  const match = text.match(/https?:\/\/[a-z0-9\-]+\.lhr\.life/);
  if (match) {
    log(`🌐 YOUR DASHBOARD URL: ${match[0]}`);
    log(`   Open this on your phone from ANYWHERE!`);
  } else if (text.trim()) {
    process.stdout.write(text);
  }
});

proc.stderr.on('data', (data) => {
  const text = data.toString();
  const match = text.match(/https?:\/\/[a-z0-9\-]+\.lhr\.life/);
  if (match) {
    log(`🌐 YOUR DASHBOARD URL: ${match[0]}`);
    log(`   Open this on your phone from ANYWHERE!`);
  }
});

proc.on('close', (code) => {
  log(`Tunnel closed (${code}) — restarting in 10s...`);
  process.exit(1); // PM2 restarts with delay
});

proc.on('error', (err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
