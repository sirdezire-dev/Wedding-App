/**
 * Wedding travel planner — guest answers store.
 * Paste this into your Google Sheet: Extensions → Apps Script.
 * See SETUP.md in this folder for the 5-minute setup.
 */

// Choose a passcode for the couple's "Who's staying with who" page. Keep it private.
const PASSCODE = 'CHANGE-THIS-PASSCODE';

const SHEET_NAME = 'Guest answers';
const HEADERS = [
  'Guest ID', 'Last updated', 'Names', 'Party size', 'Staying with other guests?', 'Staying with',
  'People staying together', 'Place to stay', 'Type of place', 'Arrive', 'Leave',
  'Getting there', 'Arrival airport', 'Car or shuttle', 'Booked so far', 'Group ID', 'Group name',
];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Use the "Guest answers" tab, or the first tab if it already has our headings.
  const first = ss.getSheets()[0];
  const sh = ss.getSheetByName(SHEET_NAME) ||
    (first && first.getRange(1, 1).getValue() === HEADERS[0] ? first : ss.insertSheet(SHEET_NAME));
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

/** Keep text short and stop anything that looks like a spreadsheet formula. */
function clean_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Guests' answers arrive here. One row per guest; sending again updates their row. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d || !d.id || !d.names) return json_({ ok: false, error: 'missing name' });
    const row = [
      clean_(d.id, 60), new Date(), clean_(d.names), Number(d.partySize) || 1, d.together ? 'Yes' : 'No',
      clean_(d.with), Number(d.groupSize) || Number(d.partySize) || 1, clean_(d.stay), clean_(d.stayType, 40),
      clean_(d.arrive, 10), clean_(d.depart, 10), clean_(d.travel), clean_(d.airport, 20), clean_(d.car), clean_(d.booked),
      clean_(d.groupId, 60), clean_(d.groupName, 80),
    ];
    const sh = sheet_();
    const n = sh.getLastRow() - 1;
    const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map((r) => r[0]) : [];
    const i = ids.indexOf(row[0]);
    if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** The couple's page reads the answers here — only with the passcode. */
function doGet(e) {
  // Guests can see the list of groups (name, head count, place) so they can join one. No personal details.
  if (e && e.parameter && e.parameter.action === 'groups') return json_({ ok: true, groups: groups_() });
  if (!e || !e.parameter || e.parameter.key !== PASSCODE) return json_({ ok: false, error: 'wrong passcode' });
  const values = sheet_().getDataRange().getValues();
  const headers = values.shift();
  const rows = values.map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]));
    return o;
  });
  return json_({ ok: true, rows: rows });
}

/** Groups guests have created: id, name, how many people so far, and where they're staying. */
function groups_() {
  const values = sheet_().getDataRange().getValues();
  const headers = values.shift() || [];
  const col = (name) => headers.indexOf(name);
  const gId = col('Group ID'), gName = col('Group name'), size = col('Party size'), stay = col('Place to stay'), upd = col('Last updated');
  if (gId < 0) return [];
  const byId = {};
  values.forEach((r) => {
    const id = r[gId];
    if (!id) return;
    const g = byId[id] || (byId[id] = { id: String(id), name: String(r[gName] || 'Group'), people: 0, parties: 0, stays: {}, updated: 0 });
    const t = r[upd] instanceof Date ? r[upd].getTime() : 0;
    if (t > g.updated) g.updated = t;
    g.people += Number(r[size]) || 1;
    g.parties += 1;
    if (r[stay]) g.stays[r[stay]] = (g.stays[r[stay]] || 0) + 1;
  });
  return Object.keys(byId).map((k) => {
    const g = byId[k];
    const stays = Object.keys(g.stays).sort((a, b) => g.stays[b] - g.stays[a]);
    return { id: g.id, name: g.name, people: g.people, parties: g.parties, stay: stays[0] || '', updated: g.updated };
  }).sort((a, b) => b.updated - a.updated || a.name.localeCompare(b.name)); // most recently active first
}
