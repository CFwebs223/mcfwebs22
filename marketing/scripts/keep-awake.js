#!/usr/bin/env node
/**
 * Keeps the Mac awake so PM2 processes run 24/7.
 * Uses caffeinate (macOS built-in) to prevent sleep.
 */
const { spawn } = require('child_process');

const proc = spawn('caffeinate', ['-i', '-s'], { stdio: 'inherit' });

proc.on('close', (code) => {
  console.log(`caffeinate exited (${code}), restarting...`);
  process.exit(1); // PM2 will restart
});

proc.on('error', (err) => {
  console.error(`caffeinate error: ${err.message}`);
  process.exit(1);
});

console.log(`[${new Date().toLocaleString()}] Mac keep-awake active (caffeinate PID ${proc.pid})`);
