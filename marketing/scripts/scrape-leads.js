#!/usr/bin/env node
/**
 * MCF Lead Scraper — finds SA service businesses without websites
 * Sources: Yellow Pages SA + Gumtree SA
 * Runs every 6 hours via PM2. Appends new unique leads to leads file.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../leads/.env') });
const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME     = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const LEADS_FILE = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const DRY_RUN    = process.argv.includes('--dry');
const MAX_BATCH  = parseInt(process.env.SCRAPE_BATCH || '100');

const delay = ms => new Promise(r => setTimeout(r, ms));
const rand  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const CITIES = [
  'cape-town','johannesburg','pretoria','durban','port-elizabeth',
  'bloemfontein','east-london','nelspruit','polokwane','rustenburg',
  'kimberley','pietermaritzburg','george','stellenbosch','centurion',
  'sandton','randburg','roodepoort','soweto','paarl',
];
const CITY_LABELS = {
  'cape-town':'CAPE TOWN','johannesburg':'JOHANNESBURG','pretoria':'PRETORIA',
  'durban':'DURBAN','port-elizabeth':'PORT ELIZABETH','bloemfontein':'BLOEMFONTEIN',
  'east-london':'EAST LONDON','nelspruit':'NELSPRUIT','polokwane':'POLOKWANE',
  'rustenburg':'RUSTENBURG','kimberley':'KIMBERLEY','pietermaritzburg':'PIETERMARITZBURG',
  'george':'GEORGE','stellenbosch':'STELLENBOSCH','centurion':'CENTURION',
  'sandton':'SANDTON','randburg':'RANDBURG','roodepoort':'ROODEPOORT',
  'soweto':'SOWETO','paarl':'PAARL',
};

const CATEGORIES = [
  {slug:'plumbers',category:'plumbers'},{slug:'electricians',category:'electricians'},
  {slug:'builders',category:'construction'},{slug:'painters-decorators',category:'painters'},
  {slug:'roofers',category:'roofers'},{slug:'tilers',category:'tilers'},
  {slug:'carpenters',category:'carpenters'},{slug:'pest-control',category:'pest control'},
  {slug:'cleaning-services',category:'cleaning'},{slug:'security-companies',category:'security'},
  {slug:'locksmiths',category:'locksmiths'},{slug:'pool-services',category:'pool services'},
  {slug:'garden-services',category:'gardening'},{slug:'movers',category:'movers'},
  {slug:'air-conditioning',category:'aircon'},
  {slug:'restaurants',category:'restaurants'},{slug:'cafes',category:'cafes'},
  {slug:'takeaways',category:'takeaways'},{slug:'catering',category:'catering'},
  {slug:'bakeries',category:'bakeries'},{slug:'butchers',category:'butchers'},
  {slug:'hair-salons',category:'hair salons'},{slug:'barbershops',category:'barbershops'},
  {slug:'beauty-salons',category:'beauty salons'},{slug:'nail-salons',category:'nail salons'},
  {slug:'spas',category:'spas'},{slug:'physiotherapists',category:'physiotherapy'},
  {slug:'chiropractors',category:'chiropractors'},{slug:'dentists',category:'dentists'},
  {slug:'doctors-gps',category:'doctors'},{slug:'optometrists',category:'optometrists'},
  {slug:'veterinarians',category:'vets'},
  {slug:'mechanics',category:'mechanics'},{slug:'panel-beaters',category:'panel beaters'},
  {slug:'tyre-fitment',category:'tyres'},{slug:'car-wash',category:'car wash'},
  {slug:'attorneys',category:'lawyers'},{slug:'accountants',category:'accountants'},
  {slug:'driving-schools',category:'driving schools'},{slug:'tutors',category:'tutoring'},
  {slug:'gyms',category:'gyms'},{slug:'event-planners',category:'events'},
  {slug:'photographers',category:'photographers'},{slug:'florists',category:'florists'},
  {slug:'pet-groomers',category:'pet grooming'},
];

function loadExistingPhones() {
  const phones = new Set();
  if (!fs.existsSync(LEADS_FILE)) return phones;
  for (const line of fs.readFileSync(LEADS_FILE,'utf8').split('\n')) {
    const m = line.match(/\+27\d{9}/g);
    if (m) m.forEach(p => phones.add(p));
  }
  return phones;
}

function normalisePhone(raw) {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g,'');
  if (p.startsWith('270'))     p = '+27' + p.slice(3);
  else if (p.startsWith('27')) p = '+' + p;
  else if (p.startsWith('0'))  p = '+27' + p.slice(1);
  else if (!p.startsWith('+')) p = '+27' + p;
  if (p.length < 12 || p.length > 13) return null;
  if (p === '+27829291282') return null; // NEVER
  return p;
}

async function scrapeYellowPages(browser, cat, city, existing) {
  const url  = `https://www.yellowpages.co.za/find/${cat.slug}/${city}`;
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  const leads = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(rand(1500,3000));
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.organic-listing, .listing-item, [class*="listing"]').forEach(el => {
        const name   = el.querySelector('h2,h3,[class*="name"]')?.textContent?.trim();
        const telEl  = el.querySelector('[href^="tel:"]');
        const phone  = telEl?.href?.replace('tel:','') || el.querySelector('[class*="phone"]')?.textContent?.trim();
        const hasWeb = !!(el.querySelector('[class*="website"],[href*="http"]:not([href*="yellowpages"])'));
        if (name && phone && !hasWeb) items.push({ name, phone });
      });
      return items;
    });
    for (const r of results) {
      const phone = normalisePhone(r.phone);
      if (phone && !existing.has(phone)) {
        existing.add(phone);
        leads.push({ name: r.name, phone, city: CITY_LABELS[city] || city, category: cat.category });
      }
    }
    if (leads.length) console.log(`  ✓ ${cat.slug}/${city}: ${leads.length} new`);
  } catch (e) {
    // Silent — scraping errors are normal
  } finally {
    await page.close().catch(()=>{});
  }
  return leads;
}

async function scrapeGumtree(browser, existing) {
  const page  = await browser.newPage();
  const leads = [];
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  try {
    await page.goto('https://www.gumtree.co.za/s-services/v1c9393', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(rand(2000,4000));
    const items = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('article,[class*="ad-listing"]').forEach(el => {
        const name  = el.querySelector('h2,[class*="title"]')?.textContent?.trim();
        const phone = el.querySelector('[href^="tel:"]')?.href?.replace('tel:','');
        if (name && phone) out.push({ name, phone });
      });
      return out;
    });
    for (const r of items) {
      const phone = normalisePhone(r.phone);
      if (phone && !existing.has(phone)) {
        existing.add(phone);
        leads.push({ name: r.name, phone, city: 'SOUTH AFRICA', category: 'services' });
      }
    }
  } catch {}
  await page.close().catch(()=>{});
  return leads;
}

function appendLeads(leads) {
  if (!leads.length) return 0;
  const byGroup = {};
  for (const l of leads) {
    const k = `${l.city}__${l.category}`;
    if (!byGroup[k]) byGroup[k] = { city: l.city, cat: l.category, items: [] };
    byGroup[k].items.push(l);
  }
  let md = '\n';
  for (const g of Object.values(byGroup)) {
    md += `\n### ${g.city} — ${g.cat}\n\n| Business | Phone |\n|---|---|\n`;
    for (const l of g.items) md += `| ${l.name.replace(/\|/g,'-')} | ${l.phone} |\n`;
  }
  const prev = fs.existsSync(LEADS_FILE) ? fs.readFileSync(LEADS_FILE,'utf8') : '';
  fs.writeFileSync(LEADS_FILE, prev + md);
  return leads.length;
}

async function main() {
  console.log(`\n🔍 MCF Scraper — ${new Date().toLocaleString('en-ZA')}`);
  const existing = loadExistingPhones();
  console.log(`   Known phones: ${existing.size}`);

  const browser = await puppeteer.launch({
    headless: true, executablePath: CHROME, protocolTimeout: 60000,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });

  const allLeads = [];
  // Random subset each run so we rotate through all cities/categories over time
  const cities = [...CITIES].sort(()=>Math.random()-.5).slice(0,5);
  const cats   = [...CATEGORIES].sort(()=>Math.random()-.5).slice(0,10);

  for (const city of cities) {
    for (const cat of cats) {
      if (allLeads.length >= MAX_BATCH) break;
      const leads = await scrapeYellowPages(browser, cat, city, existing);
      allLeads.push(...leads);
      await delay(rand(1500,4000));
    }
    if (allLeads.length >= MAX_BATCH) break;
  }

  if (allLeads.length < MAX_BATCH) {
    const gum = await scrapeGumtree(browser, existing);
    allLeads.push(...gum);
  }

  await browser.close();
  console.log(`\n📊 Found: ${allLeads.length} new leads`);

  if (DRY_RUN) {
    allLeads.slice(0,10).forEach(l => console.log(`  ${l.name} | ${l.phone} | ${l.city}`));
    return;
  }

  const n = appendLeads(allLeads);
  console.log(`✅ Added ${n} leads\n`);
}

main().catch(err => { console.error('Scraper:', err.message); process.exit(0); });
