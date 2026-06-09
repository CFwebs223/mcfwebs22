#!/usr/bin/env node
/**
 * MCF Websites — Lead Scraper
 *
 * Scrapes Yellow Pages SA for businesses without websites.
 * Appends new leads to the main leads file.
 *
 * Usage:
 *   node scripts/scrape-leads.js                  Scrape all categories
 *   node scripts/scrape-leads.js --category doctors
 *   node scripts/scrape-leads.js --dry             Preview only
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const CHROME     = '/Users/mcfwebs/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const LEADS_FILE = path.join(__dirname, '../leads/leads-SA-US-no-website-2026-05-31.md');
const DRY_RUN    = process.argv.includes('--dry');
const CATEGORY   = process.argv.includes('--category') ? process.argv[process.argv.indexOf('--category') + 1] : null;

// ── Categories to scrape ──────────────────────────────────────────────────────
const TARGETS = [
  { city: 'CAPE TOWN',     slug: 'dentists/cape-town',         category: 'dentists' },
  { city: 'CAPE TOWN',     slug: 'doctors-gps/cape-town',      category: 'doctors' },
  { city: 'CAPE TOWN',     slug: 'attorneys/cape-town',        category: 'lawyers' },
  { city: 'CAPE TOWN',     slug: 'physiotherapists/cape-town', category: 'physiotherapy' },
  { city: 'JOHANNESBURG',  slug: 'dentists/johannesburg',      category: 'dentists' },
  { city: 'JOHANNESBURG',  slug: 'doctors-gps/johannesburg',   category: 'doctors' },
  { city: 'JOHANNESBURG',  slug: 'attorneys/johannesburg',     category: 'lawyers' },
  { city: 'PRETORIA',      slug: 'dentists/pretoria',          category: 'dentists' },
  { city: 'PRETORIA',      slug: 'doctors-gps/pretoria',       category: 'doctors' },
  { city: 'DURBAN',        slug: 'dentists/durban',            category: 'dentists' },
  { city: 'DURBAN',        slug: 'doctors-gps/durban',         category: 'doctors' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalisePhone(raw) {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('270'))     p = '+27' + p.slice(3);
  else if (p.startsWith('27')) p = '+' + p;
  else if (p.startsWith('0'))  p = '+27' + p.slice(1);
  else if (!p.startsWith('+')) p = '+27' + p;
  return p.length >= 10 ? p : null;
}

async function scrapePage(browser, target, pageNum = 1) {
  const url = `https://www.yellowpages.co.za/find/${target.slug}?page=${pageNum}`;
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  const leads = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.listing, .business-listing, [class*="listing"]').forEach(el => {
        const name    = el.querySelector('h2, h3, .business-name, [class*="name"]')?.textContent?.trim();
        const phone   = el.querySelector('.phone, [class*="phone"], [href^="tel:"]')?.textContent?.trim()
                     || el.querySelector('[href^="tel:"]')?.getAttribute('href')?.replace('tel:', '');
        const website = el.querySelector('a[href*="http"]:not([href*="yellowpages"])')?.href;
        if (name && phone) items.push({ name, phone, website });
      });
      return items;
    });

    // Only keep leads without websites (or with poor/missing websites)
    for (const r of results) {
      if (r.website && r.website.includes('facebook.com')) {
        // Facebook "website" = no real site, include them
        const phone = normalisePhone(r.phone);
        if (phone) leads.push({ name: r.name, phone });
      } else if (!r.website) {
        const phone = normalisePhone(r.phone);
        if (phone) leads.push({ name: r.name, phone });
      }
    }
  } catch (err) {
    console.log(`  ⚠️  Page ${pageNum} failed: ${err.message}`);
  } finally {
    await page.close();
  }
  return leads;
}

function leadsToMarkdown(city, category, leads) {
  const header = `\n### ${city} — ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n| Business | Phone |\n|---|---|\n`;
  const rows   = leads.map(l => `| ${l.name} | ${l.phone} |`).join('\n');
  return header + rows + '\n';
}

async function main() {
  const targets = CATEGORY
    ? TARGETS.filter(t => t.category === CATEGORY)
    : TARGETS;

  console.log(`\n🔍 MCF LEAD SCRAPER`);
  console.log(`   Scraping ${targets.length} categories from Yellow Pages SA`);
  console.log(DRY_RUN ? '   (DRY RUN)\n' : '\n');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allNew = [];

  for (const target of targets) {
    process.stdout.write(`  📋 ${target.city} — ${target.category}...`);
    let leads = [];
    for (let p = 1; p <= 3; p++) {  // scrape up to 3 pages
      const page = await scrapePage(browser, target, p);
      leads = [...leads, ...page];
      if (page.length === 0) break;
      await sleep(2000);
    }
    console.log(` ${leads.length} leads found`);
    if (leads.length > 0) allNew.push({ ...target, leads });
  }

  await browser.close();

  if (allNew.length === 0) {
    console.log('\n⚠️  No leads found. Yellow Pages layout may have changed.');
    console.log('   Try running with --dry to see what pages are loading.');
    return;
  }

  const totalNew = allNew.reduce((s, t) => s + t.leads.length, 0);
  console.log(`\n✅ Total new leads found: ${totalNew}`);

  if (DRY_RUN) {
    allNew.forEach(t => {
      console.log(`\n  ${t.city} — ${t.category} (${t.leads.length}):`);
      t.leads.slice(0, 3).forEach(l => console.log(`    • ${l.name} — ${l.phone}`));
      if (t.leads.length > 3) console.log(`    ... and ${t.leads.length - 3} more`);
    });
    return;
  }

  // Append to leads file (before the TOTALS section)
  let content = fs.readFileSync(LEADS_FILE, 'utf8');
  const insertBefore = '\n\n## TOTALS';
  const idx = content.indexOf(insertBefore);

  let newSection = '\n\n## 🏥 PROFESSIONAL SERVICES (Doctors, Dentists, Lawyers)\n';
  allNew.forEach(t => { newSection += leadsToMarkdown(t.city, t.category, t.leads); });

  if (idx !== -1) {
    content = content.slice(0, idx) + newSection + content.slice(idx);
  } else {
    content += newSection;
  }

  fs.writeFileSync(LEADS_FILE, content);
  console.log(`\n📝 Appended ${totalNew} leads to ${path.basename(LEADS_FILE)}`);
  console.log('   Run the engine to start sending:\n   node marketing/scripts/engine/index.js --now\n');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
