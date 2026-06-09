const fs   = require('fs');
const path = require('path');
const { LEADS_FILE, TRACKER_FILE } = require('./config');

function parseLeads() {
  const content = fs.readFileSync(LEADS_FILE, 'utf8');
  const leads = [];
  let currentCity = '', currentCategory = '', isUS = false;

  for (const line of content.split('\n')) {
    if (line.includes('🇺🇸') || line.includes('UNITED STATES')) isUS = true;
    if (line.includes('🇿🇦') || line.includes('SOUTH AFRICA'))  isUS = false;

    const headerMatch = line.match(/^###\s+(.+?)\s+—\s+(.+)/);
    if (headerMatch) {
      currentCity     = headerMatch[1].trim();
      currentCategory = headerMatch[2].trim().toLowerCase();
      continue;
    }

    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(\+?[\d\s\(\)\-]+)\s*\|/);
    if (rowMatch && rowMatch[1] !== 'Business' && rowMatch[2] !== 'Phone') {
      const name     = rowMatch[1].trim();
      const rawPhone = rowMatch[2].trim().replace(/\s/g, '');
      if (!rawPhone || rawPhone === '—' || name === '---') continue;

      let phone = rawPhone.replace(/[^\d+]/g, '');
      if (phone.startsWith('270'))             phone = '+27' + phone.slice(3);
      else if (phone.startsWith('27'))         phone = '+' + phone;
      else if (phone.startsWith('0') && !isUS) phone = '+27' + phone.slice(1);
      else if (!phone.startsWith('+'))         phone = isUS ? '+1' + phone.slice(-10) : '+27' + phone;

      if (phone.length < 10) continue;
      leads.push({ name, phone, city: currentCity, category: currentCategory, country: isUS ? 'US' : 'SA' });
    }
  }
  return leads;
}

function getUnsent(limit = 50) {
  const allLeads = parseLeads();
  const t = JSON.parse(fs.existsSync(TRACKER_FILE) ? fs.readFileSync(TRACKER_FILE, 'utf8') : '{}');
  return allLeads.filter(l => !t[l.phone]).slice(0, limit);
}

function getStats() {
  const allLeads = parseLeads();
  const t = JSON.parse(fs.existsSync(TRACKER_FILE) ? fs.readFileSync(TRACKER_FILE, 'utf8') : '{}');
  return {
    total:   allLeads.length,
    unsent:  allLeads.filter(l => !t[l.phone]).length,
    sent:    allLeads.filter(l => t[l.phone]?.status === 'sent').length,
    failed:  allLeads.filter(l => t[l.phone]?.status === 'failed').length,
    replied: Object.values(t).filter(v => v.replied).length,
  };
}

module.exports = { parseLeads, getUnsent, getStats };
