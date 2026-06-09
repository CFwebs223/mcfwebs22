#!/usr/bin/env node
/**
 * MCF Auto Lead Scraper — runs every 6h via PM2 cron
 * Scrapes Yellow Pages SA for new businesses without websites
 * Deduplicates against existing leads, appends new ones only
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME     = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const LEADS_FILE = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const TRACKER    = path.join(__dirname, '../leads/scraper-tracker.json');
const LOG_FILE   = path.join(__dirname, '../leads/auto-scraper.log');
const DRY_RUN    = process.argv.includes('--dry');

// All categories to scrape — cycles through one batch per run
const ALL_TARGETS = [
  // Professional services (new)
  { city: 'CAPE TOWN',    slug: 'dentists/cape-town',           cat: 'Dentists' },
  { city: 'CAPE TOWN',    slug: 'general-practitioners/cape-town', cat: 'Doctors' },
  { city: 'CAPE TOWN',    slug: 'attorneys/cape-town',          cat: 'Attorneys' },
  { city: 'CAPE TOWN',    slug: 'physiotherapists/cape-town',   cat: 'Physiotherapists' },
  { city: 'CAPE TOWN',    slug: 'optometrists/cape-town',       cat: 'Optometrists' },
  { city: 'CAPE TOWN',    slug: 'veterinarians/cape-town',      cat: 'Vets' },
  { city: 'CAPE TOWN',    slug: 'accountants/cape-town',        cat: 'Accountants' },
  { city: 'CAPE TOWN',    slug: 'beauty-salons/cape-town',      cat: 'Beauty Salons' },
  { city: 'CAPE TOWN',    slug: 'hair-salons/cape-town',        cat: 'Hair Salons' },
  { city: 'CAPE TOWN',    slug: 'driving-schools/cape-town',    cat: 'Driving Schools' },
  { city: 'CAPE TOWN',    slug: 'tutoring/cape-town',           cat: 'Tutors' },
  { city: 'CAPE TOWN',    slug: 'catering/cape-town',           cat: 'Catering' },
  { city: 'CAPE TOWN',    slug: 'photography/cape-town',        cat: 'Photographers' },
  // JHB professional
  { city: 'JOHANNESBURG', slug: 'dentists/johannesburg',        cat: 'Dentists' },
  { city: 'JOHANNESBURG', slug: 'general-practitioners/johannesburg', cat: 'Doctors' },
  { city: 'JOHANNESBURG', slug: 'attorneys/johannesburg',       cat: 'Attorneys' },
  { city: 'JOHANNESBURG', slug: 'beauty-salons/johannesburg',   cat: 'Beauty Salons' },
  { city: 'JOHANNESBURG', slug: 'accountants/johannesburg',     cat: 'Accountants' },
  { city: 'JOHANNESBURG', slug: 'catering/johannesburg',        cat: 'Catering' },
  { city: 'JOHANNESBURG', slug: 'photography/johannesburg',     cat: 'Photographers' },
  // Pretoria
  { city: 'PRETORIA',     slug: 'dentists/pretoria',            cat: 'Dentists' },
  { city: 'PRETORIA',     slug: 'general-practitioners/pretoria', cat: 'Doctors' },
  { city: 'PRETORIA',     slug: 'beauty-salons/pretoria',       cat: 'Beauty Salons' },
  // Durban
  { city: 'DURBAN',       slug: 'dentists/durban',              cat: 'Dentists' },
  { city: 'DURBAN',       slug: 'general-practitioners/durban', cat: 'Doctors' },
  { city: 'DURBAN',       slug: 'beauty-salons/durban',         cat: 'Beauty Salons' },
  // More CT trades (fill gaps)
  { city: 'CAPE TOWN',    slug: 'solar-energy/cape-town',       cat: 'Solar Installers' },
  { city: 'CAPE TOWN',    slug: 'security-companies/cape-town', cat: 'Security' },
  { city: 'CAPE TOWN',    slug: 'gym-fitness/cape-town',        cat: 'Gyms' },
  { city: 'JOHANNESBURG', slug: 'solar-energy/johannesburg',    cat: 'Solar Installers' },
  { city: 'JOHANNESBURG', slug: 'security-companies/johannesburg', cat: 'Security' },
];

// How many targets to scrape per run (spread load across 6h cycles)
const BATCH_SIZE = 5;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  {
  const line = `[${new Date().toLocaleString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadTracker() {
  if (!fs.existsSync(TRACKER)) return { done: [], knownPhones: [] };
  try { return JSON.parse(fs.readFileSync(TRACKER, 'utf8')); } catch { return { done: [], knownPhones: [] }; }
}
function saveTracker(t) { fs.writeFileSync(TRACKER, JSON.stringify(t, null, 2)); }

function loadKnownPhones() {
  // Parse existing phones from leads file and tracker
  const phones = new Set();
  if (fs.existsSync(LEADS_FILE)) {
    const content = fs.readFileSync(LEADS_FILE, 'utf8');
    const re = /\|\s*(\+[\d]+)\s*\|/g;
    let m;
    while ((m = re.exec(content)) !== null) phones.add(m[1]);
  }
  return phones;
}

function normalisePhone(raw) {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('270'))     p = '+27' + p.slice(3);
  else if (p.startsWith('27')) p = '+' + p;
  else if (p.startsWith('0'))  p = '+27' + p.slice(1);
  else if (!p.startsWith('+')) p = '+27' + p;
  return p.length >= 11 ? p : null;
}

async function scrapePage(browser, target, page = 1) {
  const url  = `https://www.yellowpages.co.za/find/${target.slug}?page=${page}`;
  const tab  = await browser.newPage();
  await tab.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  const leads = [];

  try {
    await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const items = await tab.evaluate(() => {
      const results = [];
      // Try multiple selectors for Yellow Pages SA listings
      const listings = document.querySelectorAll(
        '.listing-item, .business-card, [class*="BusinessCard"], [class*="listing"], .result-item'
      );
      listings.forEach(el => {
        const name    = el.querySelector('h2, h3, .business-name, [class*="Name"], [class*="title"]')?.textContent?.trim();
        const phoneEl = el.querySelector('[href^="tel:"], .phone, [class*="phone"], [class*="Phone"]');
        const phone   = phoneEl?.getAttribute('href')?.replace('tel:', '') || phoneEl?.textContent?.trim();
        const website = el.querySelector('a[href^="http"]')?.href || '';
        const hasRealSite = website && !website.includes('yellowpages') && !website.includes('facebook.com');
        if (name && phone && !hasRealSite) results.push({ name, phone });
      });
      return results;
    });

    for (const i of items) {
      const p = normalisePhone(i.phone);
      if (p) leads.push({ name: i.name.replace(/[|]/g, ''), phone: p });
    }
  } catch (err) {
    log(`  ⚠️  ${target.city} ${target.cat} p${page}: ${err.message}`);
  } finally {
    await tab.close();
  }
  return leads;
}

async function main() {
  log('🔍 Auto-scraper starting...');
  const tracker    = loadTracker();
  const knownPhones = loadKnownPhones();

  // Pick next batch of targets that haven't been scraped today
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = tracker.doneToday || {};
  if (tracker.date !== today) {
    tracker.date     = today;
    tracker.doneToday = {};
  }

  const pending = ALL_TARGETS.filter(t => !tracker.doneToday[`${t.city}/${t.cat}`]);
  const batch   = pending.slice(0, BATCH_SIZE);

  if (batch.length === 0) {
    log('✅ All categories scraped today. Next run in 6h.');
    return;
  }

  log(`📋 Scraping ${batch.length} categories (${pending.length - batch.length} already done today)`);

  if (DRY_RUN) {
    batch.forEach(t => log(`  Would scrape: ${t.city} — ${t.cat}`));
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const newLeads = [];

  for (const target of batch) {
    process.stdout.write(`  📋 ${target.city} — ${target.cat}...`);
    let found = [];
    for (let pg = 1; pg <= 4; pg++) {
      const page = await scrapePage(browser, target, pg);
      // Deduplicate against known phones
      const fresh = page.filter(l => !knownPhones.has(l.phone));
      fresh.forEach(l => knownPhones.add(l.phone));
      found = [...found, ...fresh];
      if (page.length < 5) break;  // last page
      await sleep(1500);
    }
    console.log(` ${found.length} new`);
    if (found.length > 0) newLeads.push({ city: target.city, cat: target.cat, leads: found });
    tracker.doneToday[`${target.city}/${target.cat}`] = true;
    saveTracker(tracker);
    await sleep(2000);
  }

  await browser.close();

  if (newLeads.length === 0) {
    log('ℹ️  No new leads found this run (either no results or Yellow Pages structure changed)');
    return;
  }

  const total = newLeads.reduce((s, g) => s + g.leads.length, 0);
  log(`✅ Found ${total} new leads across ${newLeads.length} categories`);

  // Append to leads file
  let content  = fs.readFileSync(LEADS_FILE, 'utf8');
  let addition = `\n\n## 🆕 AUTO-SCRAPED LEADS — ${today}\n`;
  for (const g of newLeads) {
    addition += `\n### ${g.city} — ${g.cat}\n\n| Business | Phone |\n|---|---|\n`;
    addition += g.leads.map(l => `| ${l.name} | ${l.phone} |`).join('\n') + '\n';
  }

  // Insert before OUTREACH PRIORITY ORDER (or append at end)
  const insertIdx = content.indexOf('\n## OUTREACH');
  content = insertIdx !== -1
    ? content.slice(0, insertIdx) + addition + content.slice(insertIdx)
    : content + addition;

  fs.writeFileSync(LEADS_FILE, content);
  log(`📝 Added ${total} leads to leads file`);
}

main().catch(err => { log(`❌ Fatal: ${err.message}`); process.exit(0); });
