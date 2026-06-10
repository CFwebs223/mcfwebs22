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

// SA cities and categories — massive coverage
const CITIES = [
  'cape-town','johannesburg','pretoria','durban','port-elizabeth',
  'bloemfontein','east-london','nelspruit','polokwane','rustenburg',
  'kimberley','pietermaritzburg','george','stellenbosch','centurion',
  'sandton','randburg','roodepoort','paarl','witbank',
];
const CITY_LABELS = {
  'cape-town':'CAPE TOWN','johannesburg':'JOHANNESBURG','pretoria':'PRETORIA',
  'durban':'DURBAN','port-elizabeth':'PORT ELIZABETH','bloemfontein':'BLOEMFONTEIN',
  'east-london':'EAST LONDON','nelspruit':'NELSPRUIT','polokwane':'POLOKWANE',
  'rustenburg':'RUSTENBURG','kimberley':'KIMBERLEY','pietermaritzburg':'PIETERMARITZBURG',
  'george':'GEORGE','stellenbosch':'STELLENBOSCH','centurion':'CENTURION',
  'sandton':'SANDTON','randburg':'RANDBURG','roodepoort':'ROODEPOORT',
  'paarl':'PAARL','witbank':'WITBANK',
};
const CATEGORIES = [
  { slug: 'plumbers',               cat: 'Plumbers' },
  { slug: 'electricians',           cat: 'Electricians' },
  { slug: 'painters-decorators',    cat: 'Painters' },
  { slug: 'roofers',                cat: 'Roofers' },
  { slug: 'tilers',                 cat: 'Tilers' },
  { slug: 'carpenters',             cat: 'Carpenters' },
  { slug: 'pest-control',           cat: 'Pest Control' },
  { slug: 'cleaning-services',      cat: 'Cleaning' },
  { slug: 'security-companies',     cat: 'Security' },
  { slug: 'locksmiths',             cat: 'Locksmiths' },
  { slug: 'pool-services',          cat: 'Pool Services' },
  { slug: 'garden-services',        cat: 'Gardening' },
  { slug: 'movers',                 cat: 'Movers' },
  { slug: 'air-conditioning',       cat: 'Aircon' },
  { slug: 'solar-energy',           cat: 'Solar' },
  { slug: 'handyman',               cat: 'Handyman' },
  { slug: 'builders',               cat: 'Builders' },
  { slug: 'restaurants',            cat: 'Restaurants' },
  { slug: 'cafes',                  cat: 'Cafes' },
  { slug: 'takeaways',              cat: 'Takeaways' },
  { slug: 'catering',               cat: 'Catering' },
  { slug: 'bakeries',               cat: 'Bakeries' },
  { slug: 'butchers',               cat: 'Butchers' },
  { slug: 'hair-salons',            cat: 'Hair Salons' },
  { slug: 'barbershops',            cat: 'Barbershops' },
  { slug: 'beauty-salons',          cat: 'Beauty Salons' },
  { slug: 'nail-salons',            cat: 'Nail Salons' },
  { slug: 'spas',                   cat: 'Spas' },
  { slug: 'physiotherapists',       cat: 'Physiotherapy' },
  { slug: 'chiropractors',          cat: 'Chiropractors' },
  { slug: 'dentists',               cat: 'Dentists' },
  { slug: 'general-practitioners',  cat: 'Doctors' },
  { slug: 'optometrists',           cat: 'Optometrists' },
  { slug: 'veterinarians',          cat: 'Vets' },
  { slug: 'mechanics',              cat: 'Mechanics' },
  { slug: 'panel-beaters',          cat: 'Panel Beaters' },
  { slug: 'tyre-fitment',           cat: 'Tyres' },
  { slug: 'car-wash',               cat: 'Car Wash' },
  { slug: 'attorneys',              cat: 'Attorneys' },
  { slug: 'accountants',            cat: 'Accountants' },
  { slug: 'driving-schools',        cat: 'Driving Schools' },
  { slug: 'tutors',                 cat: 'Tutors' },
  { slug: 'gyms',                   cat: 'Gyms' },
  { slug: 'event-planners',         cat: 'Events' },
  { slug: 'photographers',          cat: 'Photographers' },
  { slug: 'florists',               cat: 'Florists' },
  { slug: 'pet-groomers',           cat: 'Pet Grooming' },
  { slug: 'estate-agents',          cat: 'Estate Agents' },
];

// Build full target list from all city × category combinations
const ALL_TARGETS = [];
for (const city of CITIES) {
  for (const cat of CATEGORIES) {
    ALL_TARGETS.push({ city: CITY_LABELS[city], slug: `${cat.slug}/${city}`, cat: cat.cat });
  }
}

// How many targets to scrape per run
const BATCH_SIZE = 8;

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
