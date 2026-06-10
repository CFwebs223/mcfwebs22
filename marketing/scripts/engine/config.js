const path = require('path');

const ROOT        = path.join(__dirname, '../../leads');
const CHROME      = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

module.exports = {
  CHROME,
  LEADS_FILE:    path.join(ROOT, 'leads-SA-US-no-website-2026-05-31.md'),
  TRACKER_FILE:  path.join(ROOT, 'engine-tracker.json'),
  SESSION_1:     path.join(ROOT, 'sessions/wa-number-1'),  // primary number
  SESSION_2:     path.join(ROOT, 'sessions/wa-number-2'),  // second number
  SESSION_3:     path.join(ROOT, 'sessions/wa-number-3'),  // third number
  DAILY_LIMIT:   20,    // per number — 3 numbers = 60/day
  MIN_DELAY:     180000, // 3 min minimum between messages
  MAX_DELAY:     420000, // up to 7 min — human-like pacing
  FOLLOWUP_1_MS: 4  * 60 * 60 * 1000,  // 4 hours
  FOLLOWUP_2_MS: 24 * 60 * 60 * 1000,  // 24 hours (next day)
  FOLLOWUP_3_MS: 72 * 60 * 60 * 1000,  // 72 hours (3 days)
  SEND_HOUR:     8,
  BUSINESS_NAME: 'MCF Websites',
  CEO_PHONE:     '0753203477',
  CEO_WA:        '+27753203477',
};
