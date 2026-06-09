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
  DAILY_LIMIT:   50,   // per number (150 total with 3 numbers)
  MIN_DELAY:     45000,
  MAX_DELAY:     90000,
  FOLLOWUP_1_MS: 2  * 60 * 60 * 1000,  // 2 hours
  FOLLOWUP_2_MS: 5  * 60 * 60 * 1000,  // 5 hours
  SEND_HOUR:     8,
  BUSINESS_NAME: 'MCF Websites',
  CEO_PHONE:     '0753203477',
  CEO_WA:        '+27753203477',
};
