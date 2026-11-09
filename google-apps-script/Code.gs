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
  'Getting there', 'Arrival airport', 'Car or shuttle', 'Booked so far',
];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
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
