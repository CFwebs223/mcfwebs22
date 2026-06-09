const fs = require('fs');
const { TRACKER_FILE } = require('./config');

function load() {
  if (!fs.existsSync(TRACKER_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); } catch { return {}; }
}

function save(t) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2));
}

function markSent(tracker, lead, sentBy = 1) {
  tracker[lead.phone] = {
    ...tracker[lead.phone],
    name:          lead.name,
    city:          lead.city,
    category:      lead.category,
    sentAt:        new Date().toISOString(),
    sentBy,
    status:        'sent',
    replied:       false,
    followUp1Sent: false,
    followUp2Sent: false,
  };
  save(tracker);
}

function markFailed(tracker, lead, error) {
  tracker[lead.phone] = { name: lead.name, sentAt: new Date().toISOString(), status: 'failed', error };
  save(tracker);
}

function markReplied(tracker, phone) {
  if (!tracker[phone]) return;
  tracker[phone].replied    = true;
  tracker[phone].repliedAt  = new Date().toISOString();
  save(tracker);
}

function markAutoReplied(tracker, phone) {
  if (!tracker[phone]) return;
  tracker[phone].autoReplied   = true;
  tracker[phone].autoRepliedAt = new Date().toISOString();
  save(tracker);
}

function markFollowup1(tracker, phone) {
  if (!tracker[phone]) return;
  tracker[phone].followUp1Sent   = true;
  tracker[phone].followUp1SentAt = new Date().toISOString();
  save(tracker);
}

function markFollowup2(tracker, phone) {
  if (!tracker[phone]) return;
  tracker[phone].followUp2Sent   = true;
  tracker[phone].followUp2SentAt = new Date().toISOString();
  save(tracker);
}

function todaySentCount(tracker) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(tracker).filter(v => v.sentAt?.startsWith(today) && v.status === 'sent').length;
}

function needsFollowup1(tracker, now = Date.now()) {
  const { FOLLOWUP_1_MS } = require('./config');
  return Object.entries(tracker).filter(([phone, v]) =>
    v.status === 'sent' && !v.replied && !v.followUp1Sent &&
    (now - new Date(v.sentAt).getTime()) >= FOLLOWUP_1_MS
  ).map(([phone, v]) => ({ phone, ...v }));
}

function needsFollowup2(tracker, now = Date.now()) {
  const { FOLLOWUP_2_MS } = require('./config');
  return Object.entries(tracker).filter(([phone, v]) =>
    v.status === 'sent' && !v.replied && v.followUp1Sent && !v.followUp2Sent &&
    (now - new Date(v.sentAt).getTime()) >= FOLLOWUP_2_MS
  ).map(([phone, v]) => ({ phone, ...v }));
}

function stats(tracker) {
  const vals = Object.values(tracker);
  return {
    total:    vals.length,
    sent:     vals.filter(v => v.status === 'sent').length,
    failed:   vals.filter(v => v.status === 'failed').length,
    replied:  vals.filter(v => v.replied).length,
    followup1: vals.filter(v => v.followUp1Sent).length,
    followup2: vals.filter(v => v.followUp2Sent).length,
    sentToday: todaySentCount(tracker),
  };
}

module.exports = { load, save, markSent, markFailed, markReplied, markAutoReplied, markFollowup1, markFollowup2, todaySentCount, needsFollowup1, needsFollowup2, stats };
