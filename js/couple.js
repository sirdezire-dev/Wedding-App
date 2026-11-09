/*
 * Couple's page — who's staying with who, read from the Google Sheet.
 * Without a connected sheet it shows example answers so you can see how it works.
 */
(function () {
  'use strict';

  const W = window.WEDDING;
  const ENDPOINT = (W.responses && W.responses.endpoint) || '';
  const SHEET_URL = (W.responses && W.responses.sheetUrl) || '';
  const KEY = 'wedding-couple-pass';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—');
  const plural = (n, w, m = `${w}s`) => `${n} ${n === 1 ? w : m}`;

  let parties = [];
  let tab = 'together';
  let query = '';

  // ---------------------------------------------------------------- example data
  const EXAMPLE = [
    { 'Guest ID': 'g1', Names: 'Linda and Tom Smith', 'Party size': 2, 'Staying with other guests?': 'Yes', 'Staying with': 'the Jonas family', 'People staying together': 6, 'Place to stay': '4-bedroom home with hot tub', 'Type of place': 'Vacation home', Arrive: '2027-05-26', Leave: '2027-05-30', 'Arrival airport': 'SLC' },
    { 'Guest ID': 'g2', Names: 'Mark, Ruta and Ema Jonas', 'Party size': 3, 'Staying with other guests?': 'Yes', 'Staying with': 'Linda & Tom Smith, Aunt Rita', 'People staying together': 6, 'Place to stay': '4-bedroom home with hot tub', 'Type of place': 'Vacation home', Arrive: '2027-05-26', Leave: '2027-05-30', 'Arrival airport': 'SLC' },
    { 'Guest ID': 'g3', Names: 'Paulius Kazlauskas', 'Party size': 1, 'Staying with other guests?': 'Yes', 'Staying with': 'Sophie', 'People staying together': 2, 'Place to stay': 'Hyatt Place Moab', 'Type of place': 'Hotel', Arrive: '2027-05-27', Leave: '2027-05-30', 'Arrival airport': 'CNY' },
    { 'Guest ID': 'g4', Names: 'Sophie Turner', 'Party size': 1, 'Staying with other guests?': 'Yes', 'Staying with': 'Paulius', 'People staying together': 2, 'Place to stay': 'Hampton Inn Moab', 'Type of place': 'Hotel', Arrive: '2027-05-27', Leave: '2027-05-29', 'Arrival airport': 'GJT' },
    { 'Guest ID': 'g5', Names: 'Grandma Ona', 'Party size': 1, 'Staying with other guests?': 'No', 'Staying with': '', 'People staying together': 1, 'Place to stay': 'Hyatt Place Moab', 'Type of place': 'Hotel', Arrive: '2027-05-26', Leave: '2027-05-30', 'Arrival airport': 'CNY' },
    { 'Guest ID': 'g6', Names: 'Chris and Dana Lee', 'Party size': 2, 'Staying with other guests?': 'No', 'Staying with': '', 'People staying together': 2, 'Place to stay': '', 'Type of place': '', Arrive: '2027-05-27', Leave: '2027-05-30', 'Arrival airport': 'Driving' },
  ];

  // ---------------------------------------------------------------- names & grouping
  const TITLES = /\b(the|family|aunt|auntie|uncle|grandma|grandpa|granny|cousin|mr|mrs|ms|dr|and)\b/g;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\s'-]/gu, ' ').replace(TITLES, ' ').replace(/\s+/g, ' ').trim();

  /** "Mark, Ruta and Ema Jonas" -> ["mark jonas", "ruta jonas", "ema jonas"] */
  function people(namesText) {
    const parts = String(namesText || '').split(/,|&|\+|\/|\band\b|\bir\b/i).map(norm).filter(Boolean);
    const last = parts.length ? parts[parts.length - 1].split(' ') : [];
    const surname = last.length > 1 ? last[last.length - 1] : '';
    return parts.map((p) => (p.split(' ').length === 1 && surname ? `${p} ${surname}` : p));
  }
  const mentions = (withText) => String(withText || '').split(/,|&|\+|\/|\band\b|;/i).map(norm).filter(Boolean);

  function toParty(r) {
    return {
      id: r['Guest ID'],
      names: String(r.Names || '').trim(),
      size: Number(r['Party size']) || 1,
      together: String(r['Staying with other guests?']).toLowerCase() === 'yes',
      with: String(r['Staying with'] || '').trim(),
      groupSize: Number(r['People staying together']) || 0,
      stay: String(r['Place to stay'] || '').trim(),
      stayType: String(r['Type of place'] || '').trim(),
      arrive: r.Arrive,
      depart: r.Leave,
      airport: r['Arrival airport'] || '',
      updated: r['Last updated'] || '',
      people: people(r.Names),
    };
  }

  /** Does a mention ("jonas", "sophie", "linda smith") point at this party? */
  function matches(mention, party) {
    const m = mention.split(' ');
    return party.people.some((p) => {
      const w = p.split(' ');
      if (p === mention) return true;
      if (m.length === 1) return w[0] === m[0] || w[w.length - 1] === m[0];
      return w[0] === m[0] && w[w.length - 1] === m[m.length - 1];
    });
  }

  /** Join parties that name each other (or who share the same house) into groups. */
  function groupParties(list) {
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const join = (a, b) => (parent[find(a)] = find(b));
    const unknown = list.map(() => []);
    list.forEach((p, i) => {
      if (!p.together) return;
      mentions(p.with).forEach((m) => {
        const hits = list.map((q, j) => (j !== i && matches(m, q) ? j : -1)).filter((j) => j >= 0);
        if (hits.length) hits.forEach((j) => join(i, j));
        else unknown[i].push(m);
      });
    });
    // Two "sharing" parties in the same vacation home or Airbnb are almost certainly together.
    list.forEach((p, i) =>
      list.forEach((q, j) => {
        if (j > i && p.together && q.together && p.stay && p.stay === q.stay && !/hotel/i.test(p.stayType)) join(i, j);
      })
    );
    const groups = {};
    list.forEach((p, i) => (groups[find(i)] = groups[find(i)] || []).push({ ...p, unknown: unknown[i] }));
    return Object.values(groups);
  }

  // ---------------------------------------------------------------- views
  const filterOn = (p) => !query || p.names.toLowerCase().includes(query) || p.with.toLowerCase().includes(query) || p.stay.toLowerCase().includes(query);

  function partyLine(p, { showWith = true } = {}) {
    return `<li class="cp-party">
      <div class="cp-party-head"><b>${esc(p.names)}</b><span class="tag">${plural(p.size, 'person', 'people')}</span></div>
      <div class="muted">${p.stay ? esc(p.stay) : '<span class="fit bad">No place to stay chosen yet</span>'} · ${day(p.arrive)} – ${day(p.depart)}${p.airport ? ` · ${esc(p.airport === 'Driving' ? 'driving' : `flying into ${p.airport}`)}` : ''}</div>
      ${showWith && p.together ? `<div>Says they’re staying with: <i>${esc(p.with || '—')}</i></div>` : ''}
    </li>`;
  }

  function renderStats(groups) {
    const people = parties.reduce((s, p) => s + p.size, 0);
    const sharing = parties.filter((p) => p.together).reduce((s, p) => s + p.size, 0);
    const places = new Set(parties.map((p) => p.stay).filter(Boolean)).size;
    const noStay = parties.filter((p) => !p.stay).length;
    $('#cp-stats').innerHTML = [
      [parties.length, 'answers'],
      [people, 'people'],
      [sharing, 'sharing a place'],
      [groups.filter((g) => g.length > 1 || g[0].together).length, 'groups'],
      [places, 'places to stay'],
      [noStay, 'not chosen a place yet'],
    ].map(([n, l]) => `<div class="cp-stat"><b>${n}</b><span>${l}</span></div>`).join('');
  }

  function viewTogether(groups) {
    const shared = groups.filter((g) => g.length > 1 || g[0].together).filter((g) => g.some(filterOn));
    const solo = groups.filter((g) => g.length === 1 && !g[0].together).map((g) => g[0]).filter(filterOn);
    const card = (g, i) => {
      const total = g.reduce((s, p) => s + p.size, 0);
      const claimed = Math.max(...g.map((p) => p.groupSize || 0));
      const stays = [...new Set(g.map((p) => p.stay).filter(Boolean))];
      const missing = [...new Set(g.flatMap((p) => p.unknown))];
      const warn = [];
      if (stays.length > 1) warn.push(`They picked different places: ${stays.map(esc).join(' and ')}.`);
      if (g.some((p) => !p.stay)) warn.push('Not everyone has chosen a place yet.');
      if (claimed > total) warn.push(`They expect ${claimed} people, but only ${total} have answered so far.`);
      return `<article class="cp-group">
        <header class="cp-group-head">
          <h3>Group ${i + 1}: ${plural(total, 'person', 'people')}</h3>
          <p class="muted">${stays.length === 1 ? `Staying at <b>${esc(stays[0])}</b>` : stays.length ? 'Different places' : 'No place chosen yet'}</p>
        </header>
        <ul class="cp-list">${g.map((p) => partyLine(p)).join('')}</ul>
        ${missing.length ? `<p class="notice">Named but haven’t answered yet: <b>${missing.map((m) => esc(m.replace(/\b\w/g, (c) => c.toUpperCase()))).join(', ')}</b></p>` : ''}
        ${warn.map((w) => `<p class="notice warn">${w}</p>`).join('')}
      </article>`;
    };
    return `
      <h2 class="sub-h">Sharing with other guests</h2>
      ${shared.length ? shared.map(card).join('') : '<p class="muted">No one has said they’re sharing yet.</p>'}
      <h2 class="sub-h">Just their own party</h2>
      ${solo.length ? `<ul class="cp-list cp-card-list">${solo.map((p) => partyLine(p, { showWith: false })).join('')}</ul>` : '<p class="muted">No one yet.</p>'}`;
  }

  function viewPlaces() {
    const by = {};
    parties.filter(filterOn).forEach((p) => (by[p.stay || '—'] = by[p.stay || '—'] || []).push(p));
    const names = Object.keys(by).sort((a, b) => (a === '—') - (b === '—') || by[b].length - by[a].length);
    if (!names.length) return '<p class="muted">No answers match.</p>';
    return names
      .map((name) => {
        const list = by[name];
        const total = list.reduce((s, p) => s + p.size, 0);
        return `<article class="cp-group">
          <header class="cp-group-head"><h3>${name === '—' ? 'Haven’t chosen a place yet' : esc(name)}</h3>
            <p class="muted">${plural(total, 'person', 'people')} · ${plural(list.length, 'party', 'parties')}${list[0].stayType ? ` · ${esc(list[0].stayType)}` : ''}</p></header>
          <ul class="cp-list">${list.map((p) => partyLine(p)).join('')}</ul>
        </article>`;
      })
      .join('');
  }

  function viewAll() {
    const list = parties.filter(filterOn);
    if (!list.length) return '<p class="muted">No answers match.</p>';
    return `<div class="table-wrap"><table class="compare cp-table">
      <thead><tr><th>Names</th><th>People</th><th>Sharing?</th><th>Staying with</th><th>Place to stay</th><th>Dates</th><th>Arriving</th></tr></thead>
      <tbody>${list
        .map((p) => `<tr><td><b>${esc(p.names)}</b></td><td>${p.size}</td><td>${p.together ? 'Yes' : 'No'}</td><td>${esc(p.with || '—')}</td><td>${esc(p.stay || '—')}</td><td>${day(p.arrive)} – ${day(p.depart)}</td><td>${esc(p.airport || '—')}</td></tr>`)
        .join('')}</tbody></table></div>`;
  }

  function render() {
    const groups = groupParties(parties);
    renderStats(groups);
    document.querySelectorAll('[data-cp-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cpTab === tab)));
    $('#cp-view').innerHTML = !parties.length
      ? '<div class="empty">No answers yet. They’ll appear here as guests send their plans.</div>'
      : tab === 'together' ? viewTogether(groups) : tab === 'places' ? viewPlaces() : viewAll();
  }

  // ---------------------------------------------------------------- loading
  async function load(pass) {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(pass)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'error');
    return data.rows;
  }

  function showApp(rows, example) {
    parties = rows.map(toParty).filter((p) => p.names);
    $('#cp-login').hidden = true;
    $('#cp-app').hidden = false;
    $('#cp-banner').innerHTML = example
      ? `<div class="notice warn big">These are <b>example answers</b> so you can see how this page works. Connect your Google Sheet (see <code>google-apps-script/SETUP.md</code>) and your guests’ real answers will show here.</div>`
      : '';
    $('#cp-signout').hidden = !!example;
    $('#cp-refresh').hidden = !!example;
    if (SHEET_URL) {
      $('#cp-sheet').href = SHEET_URL;
      $('#cp-sheet').hidden = false;
    }
    render();
  }

  async function signIn(pass) {
    const msg = $('#cp-login-msg');
    msg.innerHTML = '<p class="muted">Loading…</p>';
    try {
      const rows = await load(pass);
      try { sessionStorage.setItem(KEY, pass); } catch (e) { /* private mode */ }
      msg.innerHTML = '';
      showApp(rows, false);
    } catch (e) {
      msg.innerHTML = /passcode/.test(e.message)
        ? '<p class="notice warn">That passcode didn’t work. Check the PASSCODE line in your Google Sheet’s script.</p>'
        : '<p class="notice warn">Couldn’t reach your Google Sheet. Check your internet connection, and that the script is deployed with access for “Anyone”.</p>';
      $('#cp-login').hidden = false;
      $('#cp-app').hidden = true;
    }
  }

  // ---------------------------------------------------------------- boot
  $('#cp-sub').textContent = `${W.couple} · ${W.venue.name}, ${W.venue.city}`;
  $('#cp-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = $('#cp-pass').value.trim();
    if (pass) signIn(pass);
  });
  $('#cp-search').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    render();
  });
  $('#cp-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cp-tab]');
    if (!b) return;
    tab = b.dataset.cpTab;
    render();
  });
  $('#cp-refresh').addEventListener('click', () => {
    let pass = '';
    try { pass = sessionStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
    if (pass) signIn(pass);
  });
  $('#cp-print').addEventListener('click', () => window.print());
  $('#cp-signout').addEventListener('click', () => {
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    parties = [];
    $('#cp-app').hidden = true;
    $('#cp-login').hidden = false;
    $('#cp-pass').value = '';
  });

  if (!ENDPOINT) {
    showApp(EXAMPLE, true);
  } else {
    let saved = '';
    try { saved = sessionStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
    if (saved) signIn(saved);
    else $('#cp-login').hidden = false;
  }

  // For tests
  window.__couple = { groupParties, toParty, people, mentions };
})();
