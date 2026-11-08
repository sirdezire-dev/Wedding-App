/*
 * Wedding Travel Planner — page behaviour.
 * Data: data/wedding.js, data/airports.js. Logic: js/planner.js, js/travel.js. Links: js/links.js.
 */
(function () {
  'use strict';

  const W = window.WEDDING;
  const P = window.Planner;
  const T = window.Travel;
  const L = window.Links;
  const STORE_KEY = 'wedding-travel-planner:v2';
  const STAY_TYPES = { hotel: 'Hotel', villa: 'Vacation home', airbnb: 'Airbnb' };
  const ARRIVALS = W.airports.map((a) => a.code);
  const AIRPORT = Object.fromEntries(W.airports.map((a) => [a.code, a]));
  // Airports so close to the venue that guests near them should just drive.
  const NOT_ORIGINS = window.AIRPORTS.filter((a) => T.miles(a, W.venue) < 150).map((a) => a.code);
  const GROUNDS = P.expandGround(W.cars, W.transfers, W.airports);
  const MAX_SAVED = 3;

  // ---------------------------------------------------------------- state
  const defaults = () => ({
    home: null, // { label, lat, lon }
    origins: [], // home airport codes
    trip: { arrive: W.suggestedArrive, depart: W.suggestedDepart, travelers: 2, groupSize: 2, budget: '' },
    caps: { travel: '', stay: '', ground: '' },
    sort: 'cheapest',
    showAll: false,
    showCount: 6,
    tab: 'travel',
    filters: { stops: 2, arrival: 'all', stayTypes: ['hotel', 'villa', 'airbnb'], stayType: 'all', groundAirport: '', easyOnly: false },
    selection: { travelId: null, stayId: null, groundId: null, activityIds: [] },
    booked: {},
    saved: [],
    custom: { flights: [], stays: [] },
    textSize: 'normal',
  });

  let state = load();
  let searchResults = null; // last address search results (not saved)

  function load() {
    const d = defaults();
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw) return d;
      return {
        ...d,
        ...raw,
        trip: { ...d.trip, ...raw.trip },
        caps: { ...d.caps, ...raw.caps },
        filters: { ...d.filters, ...raw.filters },
        selection: { ...d.selection, ...raw.selection },
        custom: { ...d.custom, ...raw.custom },
      };
    } catch (e) {
      return d;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — still works for this visit */
    }
  }

  // ---------------------------------------------------------------- helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: W.currency, maximumFractionDigits: 0 });
  const fmt = (n) => money.format(Math.round(n || 0));
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
  const niceDate = (iso, long) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  /** "about 3½ hours" */
  function hoursText(min) {
    if (min < 50) return `about ${Math.max(5, Math.round(min / 5) * 5)} minutes`;
    const halves = Math.round(min / 30);
    const whole = Math.floor(halves / 2);
    const half = halves % 2 ? '½' : '';
    return `about ${whole}${half} hour${whole === 1 && !half ? '' : 's'}`;
  }

  function cityOf(code) {
    const a = T.byCode[code];
    return a ? a.city.replace(/,.*$/, '') : code;
  }
  const airportLabel = (code) => `${cityOf(code)} (${code})`;

  function trip() {
    const t = state.trip;
    const travelers = Math.max(1, Number(t.travelers) || 1);
    return { ...t, travelers, groupSize: Math.max(Number(t.groupSize) || 1, travelers) };
  }
  const budget = () => P.budgetPlan(state.trip.budget, state.caps);

  // ---------------------------------------------------------------- data
  function travelOptions() {
    const t = trip();
    const out = [];
    const drive = T.driveOption(state.home, W.venue, t);
    if (drive) out.push(drive);
    out.push(...T.estimateFlights(state.home, state.origins, ARRIVALS));
    out.push(...state.custom.flights);
    return out;
  }
  const allStays = () => [...W.stays, ...state.custom.stays];
  const byId = (list, id) => list.find((x) => x.id === id) || null;

  function selected() {
    const s = state.selection;
    return {
      travel: byId(travelOptions(), s.travelId),
      stay: byId(allStays(), s.stayId),
      ground: byId(GROUNDS, s.groundId),
      activities: s.activityIds.map((id) => byId(W.activities, id)).filter(Boolean),
    };
  }

  function travelTitle(t) {
    if (!t) return '';
    if (t.kind === 'drive') return 'Drive your own car';
    if (t.stops === 0) return 'Direct flight';
    return `${P.stopsLabel(t.stops)}, changing planes in ${t.via.map(cityOf).join(' and ')}`;
  }
  function travelLine(t) {
    if (!t) return '';
    if (t.kind === 'drive') return `${t.miles.toLocaleString()} miles each way, ${hoursText(t.durationMinutes)} of driving${t.overnight ? ' (we’ve added a motel night each way)' : ''}`;
    return `${airportLabel(t.from)} to ${airportLabel(t.to)}`;
  }
  function groundTitle(g) {
    if (!g) return 'No car';
    return g.kind === 'car' ? `${g.name} from ${cityOf(g.airport)} airport` : g.name;
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function linkButtons(links, cls = '') {
    return links
      .map((l) => `<a class="btn ${cls}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span class="ext" aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span></a>`)
      .join('');
  }

  /** Does this option fit the part's limit and the whole-trip budget? */
  function fitNote(slot, item, cost) {
    const b = budget();
    const capKey = { travel: 'travel', stay: 'stay', ground: 'ground' }[slot];
    const cap = capKey ? b.caps[capKey] : null;
    if (cap != null && cost > cap) {
      const name = { travel: 'flight', stay: 'place-to-stay', ground: 'car' }[slot];
      return `<p class="fit bad">Over your ${name} limit of ${fmt(cap)}</p>`;
    }
    if (b.total == null) return '';
    const sel = selected();
    if (slot === 'activities') sel.activities = sel.activities.some((a) => a.id === item.id) ? sel.activities : [...sel.activities, item];
    else sel[slot] = item;
    const total = P.costBreakdown(sel, trip()).total;
    return total <= b.total
      ? `<p class="fit good">Fits your budget</p>`
      : `<p class="fit bad">Your trip would be ${fmt(total - b.total)} over budget</p>`;
  }

  // ---------------------------------------------------------------- header
  function renderHeader() {
    const start = niceDate(W.weekendStart, true);
    const end = new Date(`${W.weekendEnd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    $('#couple').textContent = W.couple;
    $('#hero-date').textContent = `${start} – ${end}`;
    $('#hero-venue').innerHTML = `<a href="${esc(L.venueMap(W.venue))}" target="_blank" rel="noopener">${esc(W.venue.name)}</a> · ${esc(W.venue.city)}, ${esc(W.venue.region)}`;
    const days = Math.ceil((new Date(`${W.date}T00:00:00`) - new Date()) / 86400000);
    $('#countdown').textContent = days > 0 ? `${days} days to go` : days === 0 ? 'Today’s the day!' : 'Thank you for celebrating with us';
    document.title = `${W.couple} · Travel Planner`;
    $('#when-lead').textContent = `The wedding weekend is ${niceDate(W.weekendStart, true)} to ${niceDate(W.weekendEnd, true)}. We suggest arriving ${niceDate(W.suggestedArrive, true)} and leaving ${niceDate(W.suggestedDepart, true)}.`;
    if (W.help) $('#footer-help').innerHTML = `Need a hand booking? Call ${esc(W.help.name)} at <a href="tel:${esc(W.help.phone)}">${esc(W.help.phone)}</a>.`;
  }

  function applyTextSize() {
    document.documentElement.classList.toggle('text-large', state.textSize === 'large');
    document.querySelectorAll('[data-text-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.textSize === state.textSize)));
  }

  // ---------------------------------------------------------------- step 1: home
  function renderHome() {
    const el = $('#home-results');
    if (searchResults) {
      if (!searchResults.length) {
        el.innerHTML = `<div class="notice warn">We couldn’t find that address. Try your town and state, or a ZIP code. Or pick your nearest airport below.</div>${airportPicker()}`;
        return;
      }
      el.innerHTML = `<p class="pick-title">Which one is you?</p>
        <ul class="pick-list">${searchResults
          .map((r, i) => `<li><button type="button" class="pick" data-action="pick-home" data-i="${i}">${esc(r.label)}</button></li>`)
          .join('')}</ul>`;
      return;
    }
    if (!state.home && !state.origins.length) {
      el.innerHTML = '';
      return;
    }
    const drive = T.driveOption(state.home, W.venue, trip());
    const distance = state.home ? Math.round(T.roadMiles(state.home, W.venue)) : null;
    el.innerHTML = `
      <div class="home-card">
        <div>
          <p class="label">Traveling from</p>
          <p class="home-name">${esc(state.home ? state.home.label : 'Your chosen airport')}</p>
          ${distance ? `<p class="muted">About ${distance.toLocaleString()} miles from the venue by road${drive ? ` — you could drive it in ${hoursText(drive.durationMinutes)}` : ''}.</p>` : ''}
        </div>
        <button type="button" class="btn" data-action="change-home">Change</button>
      </div>
      <p class="label" style="margin-top:18px">Your nearest airports — tap to include or leave out</p>
      <div class="chips">${nearbyAirports()
        .map(
          (a) => `<button type="button" class="chip" data-action="toggle-origin" data-code="${a.code}" aria-pressed="${state.origins.includes(a.code)}">
            ${esc(a.city)} (${a.code})${a.distance != null ? ` · ${Math.round(a.distance)} mi` : ''}</button>`
        )
        .join('')}</div>
      ${airportPicker(true)}`;
  }

  function nearbyAirports() {
    const list = state.home ? T.nearestAirports(state.home, NOT_ORIGINS, { limit: 3, maxMiles: 90 }) : [];
    state.origins.forEach((code) => {
      if (!list.some((a) => a.code === code) && T.byCode[code]) list.push({ ...T.byCode[code], distance: state.home ? T.miles(state.home, T.byCode[code]) : null });
    });
    return list;
  }

  function airportPicker(compact) {
    const options = window.AIRPORTS.filter((a) => !NOT_ORIGINS.includes(a.code))
      .sort((a, b) => a.city.localeCompare(b.city))
      .map((a) => `<option value="${a.code}">${esc(a.city)} (${a.code})</option>`)
      .join('');
    return `<details class="more" ${compact ? '' : 'open'}><summary>Fly from a different airport</summary>
      <label class="field"><span>Choose an airport</span>
        <select data-action="add-origin"><option value="">Choose…</option>${options}</select></label></details>`;
  }

  async function searchHome(q) {
    const el = $('#home-results');
    el.innerHTML = `<p class="muted">Searching…</p>`;
    searchResults = await T.geocode(q);
    if (searchResults.length === 1) return setHome(searchResults[0]);
    renderHome();
  }

  function setHome(place) {
    searchResults = null;
    state.home = { label: place.label, lat: place.lat, lon: place.lon };
    state.origins = T.nearestAirports(state.home, NOT_ORIGINS, { limit: 3, maxMiles: 90 }).map((a) => a.code);
    state.selection.travelId = null;
    state.selection.groundId = null;
    save();
    renderAll();
    toast('Found you! Your trip options are ready below.');
  }

  // ---------------------------------------------------------------- step 2: when
  function renderWhen() {
    const t = trip();
    $('#out-travelers').textContent = plural(t.travelers, 'person', 'people');
    $('#out-groupSize').textContent = plural(t.groupSize, 'person', 'people');
    const n = P.nights(t.arrive, t.depart);
    const notes = [];
    if (!n) notes.push(`<div class="notice warn">Please choose a leaving day after your arrival day.</div>`);
    else {
      notes.push(`<div class="notice">${plural(n, 'night')}: ${niceDate(t.arrive, true)} to ${niceDate(t.depart, true)}.</div>`);
      const missed = P.missedEvents(W.events, t);
      notes.push(
        missed.length
          ? `<div class="notice warn">With these dates you’d miss: ${missed.map((e) => `${esc(e.name)} on ${niceDate(e.date, true)}`).join(', ')}.</div>`
          : `<div class="notice good">You’ll be here for the whole wedding weekend.</div>`
      );
    }
    if (t.groupSize > t.travelers) notes.push(`<div class="notice">You’re sharing with ${plural(t.groupSize - t.travelers, 'other person', 'other people')}, so you pay ${Math.round((t.travelers / t.groupSize) * 100)}% of the place to stay and car.</div>`);
    $('#when-notes').innerHTML = notes.join('');
  }

  // ---------------------------------------------------------------- step 3: budget
  function renderBudgetNotes() {
    const b = budget();
    const notes = [];
    if (b.total == null) notes.push(`<div class="notice">No budget yet — we’ll show every option, cheapest first.</div>`);
    else if (b.fromCaps) notes.push(`<div class="notice">Your limits add up to <b>${fmt(b.capSum)}</b>, so that’s your total budget.</div>`);
    else {
      const parts = [['travel', 'flights'], ['stay', 'place to stay'], ['ground', 'car']].filter(([k]) => b.caps[k] != null);
      if (parts.length) {
        const rest = b.total - b.capSum;
        notes.push(
          b.capsOverTotal
            ? `<div class="notice warn">Your limits add up to ${fmt(b.capSum)}, which is more than your ${fmt(b.total)} total. We’ll keep the whole trip under ${fmt(b.total)}.</div>`
            : `<div class="notice">Your limits add up to ${fmt(b.capSum)} of your ${fmt(b.total)} total, which leaves ${fmt(rest)} for ${parts.length < 3 ? 'everything else' : 'things to do and meals'}.</div>`
        );
      } else notes.push(`<div class="notice">We’ll only show trips that cost ${fmt(b.total)} or less in total.</div>`);
    }
    $('#budget-notes').innerHTML = notes.join('');
  }

  // ---------------------------------------------------------------- step 4: options
  function packages(sort) {
    return P.buildPackages({
      travel: travelOptions(),
      stays: allStays(),
      grounds: GROUNDS,
      activities: state.filters.easyOnly ? W.activities.filter((a) => a.effort === 'Easy') : W.activities,
      trip: trip(),
      weddingDate: W.date,
      budget: budget(),
      airports: W.airports,
      sort,
    });
  }

  function renderOptions() {
    const el = $('#options');
    const t = trip();
    if (!travelOptions().length) {
      el.innerHTML = `<div class="empty">Start with <a href="#step-home">step 1</a> — tell us where you’re traveling from and your options will appear here.</div>`;
      return;
    }
    if (!P.nights(t.arrive, t.depart)) {
      el.innerHTML = `<div class="empty">Choose your travel dates in <a href="#step-when">step 2</a>.</div>`;
      return;
    }
    const b = budget();
    const res = packages(state.sort);
    const capNote = capRemovalNote(res.removedByCaps);

    if (!res.fits.length) {
      const closest = res.over.slice(0, 2);
      el.innerHTML = `
        <div class="notice warn big">Nothing fits ${fmt(b.total)} yet. The lowest-cost trip for your dates is <b>${fmt(closest[0] ? closest[0].total : 0)}</b>.</div>
        ${capNote}
        <p>Things that can help:</p>
        <ul class="tips"><li>Stay fewer nights</li><li>Fly with a stop or two (often cheaper)</li><li>Share a vacation home or car with other guests (step 2)</li><li>Raise or remove a limit in step 3</li></ul>
        ${closest.length ? `<h3 class="sub-h">The closest options</h3>${closest.map((p) => tripCard(p)).join('')}` : ''}`;
      return;
    }

    const picks = P.recommendations(res.fits);
    const summary = b.total == null
      ? `<p class="lead">Here are our three suggestions for ${plural(t.travelers, 'person', 'people')}, ${plural(P.nights(t.arrive, t.depart), 'night')}.</p>`
      : `<p class="lead"><b>${res.fits.length}</b> different trips fit your <b>${fmt(b.total)}</b> budget. Here are our three suggestions:</p>`;

    const all = state.showAll
      ? `<div class="all-head">
          <h3 class="sub-h">All ${res.fits.length} trips${b.total == null ? '' : ' that fit'}</h3>
          <label class="inline">Sort by
            <select data-action="sort">
              ${[['cheapest', 'Lowest price'], ['easiest', 'Easiest journey'], ['comfort', 'Best-reviewed stay'], ['closest', 'Closest to the venue'], ['mostFun', 'Most things to do']]
                .map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label></div>
        ${res.fits.slice(0, state.showCount).map((p) => tripCard(p)).join('')}
        ${res.fits.length > state.showCount ? `<button type="button" class="btn btn-wide" data-action="more">Show more trips</button>` : ''}
        <button type="button" class="btn btn-quiet" data-action="toggle-all">Hide the full list</button>`
      : `<button type="button" class="btn btn-wide" data-action="toggle-all">See all ${res.fits.length} trips${b.total == null ? '' : ' that fit my budget'}</button>`;

    el.innerHTML = `${summary}${capNote}<div class="picks">${picks.map((r) => tripCard(r.pkg, r)).join('')}</div>${all}`;
  }

  function capRemovalNote(removed) {
    const b = budget();
    const bits = [];
    if (removed.travel) bits.push(`${plural(removed.travel, 'way', 'ways')} of getting here (over ${fmt(b.caps.travel)})`);
    if (removed.stays) bits.push(`${plural(removed.stays, 'place', 'places')} to stay (over ${fmt(b.caps.stay)})`);
    if (removed.grounds) bits.push(`${plural(removed.grounds, 'car or shuttle', 'cars and shuttles')} (over ${fmt(b.caps.ground)})`);
    return bits.length ? `<p class="muted">Your limits are hiding ${bits.join(', ')}.</p>` : '';
  }

  function tripCard(p, rec) {
    const t = trip();
    const n = P.nights(t.arrive, t.depart);
    const tr = p.travel;
    const arrival = tr.kind === 'flight' ? AIRPORT[tr.to] : null;
    const extras = p.leftover == null
      ? ''
      : p.activityPlan.length
        ? `<p class="tc-extra">You’d have <b>${fmt(p.leftover)}</b> left. That’s enough for: ${p.activityPlan.map((a) => esc(a.name)).join(', ')}.</p>`
        : `<p class="tc-extra plain">You’d have <b>${fmt(p.leftover)}</b> left for meals and extras.</p>`;
    const isChosen = state.selection.travelId === tr.id && state.selection.stayId === p.stay.id && (state.selection.groundId || 'none') === (p.ground ? p.ground.id : 'none');
    return `
      <article class="trip-card ${rec ? 'is-pick' : ''} ${isChosen ? 'is-chosen' : ''}">
        <header class="tc-head">
          <div>
            ${rec ? `<p class="tc-label">${esc(rec.label)}</p><p class="tc-why">${esc(rec.why)}</p>` : ''}
          </div>
          <div class="tc-total"><span>${fmt(p.total)}</span><small>total for ${plural(t.travelers, 'person', 'people')}, ${plural(n, 'night')}</small></div>
        </header>
        <dl class="tc-parts">
          <div><dt>Getting there</dt><dd><b>${esc(travelTitle(tr))}</b><br/>${esc(travelLine(tr))}${tr.kind === 'flight' ? ` · ${hoursText(tr.durationMinutes)} of flying` : ''}</dd><dd class="amt">${fmt(p.cost.travel)}</dd></div>
          <div><dt>Staying at</dt><dd><b>${esc(p.stay.name)}</b><br/>${STAY_TYPES[p.stay.type]}${p.stay.rating ? ` · rated ${p.stay.rating} of 5` : ''}${p.stay.minutesToVenue != null ? ` · ${p.stay.minutesToVenue} min to the venue` : ''}</dd><dd class="amt">${fmt(p.cost.stay)}</dd></div>
          <div><dt>Getting around</dt><dd>${p.ground ? `<b>${esc(groundTitle(p.ground))}</b>${arrival ? `<br/>Then ${hoursText(arrival.minutesToVenue)} to the venue` : ''}` : tr.kind === 'drive' ? 'Your own car' : 'No car — you’ll need taxis or rides'}</dd><dd class="amt">${fmt(p.cost.ground)}</dd></div>
        </dl>
        <p class="tc-door">Door to venue: ${hoursText(p.doorMinutes)} each way</p>
        ${extras}
        <div class="tc-actions">
          <button type="button" class="btn btn-primary" data-action="use-package" data-id="${esc(p.id)}">${isChosen ? 'Chosen ✓' : 'Choose this trip'}</button>
          <button type="button" class="btn" data-action="save-package" data-id="${esc(p.id)}">Save to compare</button>
        </div>
      </article>`;
  }

  function findPackage(id) {
    const [tid, sid, gid] = id.split('|');
    return { travel: byId(travelOptions(), tid), stay: byId(allStays(), sid), ground: gid === 'none' ? null : byId(GROUNDS, gid) };
  }

  // ---------------------------------------------------------------- step 5: browse
  function renderTabs() {
    document.querySelectorAll('#tabs [data-tab]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === state.tab));
      b.tabIndex = b.dataset.tab === state.tab ? 0 : -1;
    });
  }

  function renderBrowse() {
    $('#browse').innerHTML = { travel: browseTravel, stays: browseStays, ground: browseGround, activities: browseActivities }[state.tab]();
  }

  function chips(action, options, isOn) {
    return `<div class="chips">${options
      .map(([v, label]) => `<button type="button" class="chip" data-action="${action}" data-val="${esc(v)}" aria-pressed="${isOn(v)}">${label}</button>`)
      .join('')}</div>`;
  }

  function choiceButton(slot, id, isSel, label = 'Choose') {
    return `<button type="button" class="btn ${isSel ? 'btn-chosen' : 'btn-primary'}" data-action="pick" data-slot="${slot}" data-id="${esc(id)}" aria-pressed="${isSel}">${isSel ? 'Chosen ✓' : label}</button>`;
  }

  function browseTravel() {
    const t = trip();
    const f = state.filters;
    const opts = travelOptions();
    if (!opts.length) return `<div class="empty">Tell us where you’re traveling from in <a href="#step-home">step 1</a> to see flights.</div>`;
    const list = opts
      .filter((o) => o.kind === 'drive' || (o.stops <= f.stops && (f.arrival === 'all' || o.to === f.arrival)))
      .sort((a, b) => (a.kind === 'drive' ? -1 : b.kind === 'drive' ? 1 : P.travelCost(a, t) - P.travelCost(b, t)));

    return `
      <div class="filters">
        <p class="label">How many stops?</p>
        ${chips('filter-stops', [[0, 'Direct only'], [1, 'Up to 1 stop'], [2, 'Any number']], (v) => Number(v) === f.stops)}
        <p class="label">Fly into</p>
        ${chips('filter-arrival', [['all', 'Any airport'], ...W.airports.map((a) => [a.code, `${esc(cityOf(a.code))} (${a.code})`])], (v) => v === f.arrival)}
        ${f.arrival !== 'all' ? `<p class="muted">${esc(AIRPORT[f.arrival].note)}</p>` : ''}
      </div>
      <div class="cards">${list.length ? list.map((o) => travelCard(o, t)).join('') : '<div class="empty">No flights match. Try allowing more stops.</div>'}</div>
      ${addOwnFlight()}`;
  }

  function travelCard(o, t) {
    const isSel = state.selection.travelId === o.id;
    const cost = P.travelCost(o, t);
    if (o.kind === 'drive') {
      return `
        <article class="card ${isSel ? 'is-chosen' : ''}">
          <div class="card-head"><h3>Drive your own car</h3><p class="price">${fmt(cost)}<small>fuel${o.overnight ? ' + motel' : ''}, round trip</small></p></div>
          <p>${esc(travelLine(o))}.</p>
          <p class="muted">No flights and no rental car needed. Fuel is estimated at 17¢ a mile.</p>
          ${fitNote('travel', o, cost)}
          <div class="card-actions">${choiceButton('travel', o.id, isSel)}${linkButtons(L.drive(state.home, W.venue))}</div>
        </article>`;
    }
    const arrival = AIRPORT[o.to];
    return `
      <article class="card ${isSel ? 'is-chosen' : ''}">
        <div class="card-head">
          <h3>${esc(travelTitle(o))}</h3>
          <p class="price">${fmt(cost)}<small>${fmt(o.price)} per person, round trip</small></p>
        </div>
        <p><b>${esc(travelLine(o))}</b></p>
        <p class="muted">${hoursText(o.durationMinutes)} of travel · usually ${esc(o.carriers)}${arrival ? ` · then ${hoursText(arrival.minutesToVenue)} by car to the venue` : ''}</p>
        ${o.custom ? '<p class="tag">Added by you</p>' : o.estimated ? '<p class="tag">Estimated price — check the live price</p>' : ''}
        ${fitNote('travel', o, cost)}
        <div class="card-actions">
          ${choiceButton('travel', o.id, isSel)}
          ${o.url && safeUrl(o.url) ? linkButtons([{ label: 'Book', url: o.url }]) : linkButtons(L.flight({ from: o.from, to: o.to, arrive: t.arrive, depart: t.depart, travelers: t.travelers, stops: o.stops }).slice(0, 1), '')}
          ${o.custom ? `<button type="button" class="btn btn-quiet" data-action="remove-custom" data-kind="flights" data-id="${esc(o.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  function addOwnFlight() {
    return `<details class="more add-own"><summary>Found a flight somewhere else? Add it here</summary>
      <form class="form-grid" data-add="flight">
        <label class="field"><span>Airline</span><input name="airline" required /></label>
        <label class="field"><span>From airport (3 letters)</span><input name="from" required maxlength="3" value="${esc(state.origins[0] || '')}" /></label>
        <label class="field"><span>To airport</span><select name="to">${W.airports.map((a) => `<option value="${a.code}">${esc(a.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Stops</span><select name="stops"><option value="0">Direct</option><option value="1">1 stop</option><option value="2">2 stops</option></select></label>
        <label class="field"><span>Hours of travel (one way)</span><input name="hours" type="number" step="0.5" min="0" required /></label>
        <label class="field"><span>Round-trip price per person</span><input name="price" type="number" min="0" required /></label>
        <label class="field"><span>Link (optional)</span><input name="url" type="url" placeholder="https://" /></label>
        <div class="field"><span>&nbsp;</span><button class="btn btn-primary" type="submit">Add this flight</button></div>
      </form></details>`;
  }

  function browseStays() {
    const t = trip();
    const f = state.filters;
    const list = allStays()
      .filter((s) => f.stayType === 'all' || s.type === f.stayType)
      .sort((a, b) => P.stayCost(a, t) - P.stayCost(b, t));
    return `
      <div class="filters">
        ${chips('filter-staytype', [['all', 'Everything'], ['hotel', 'Hotels'], ['villa', 'Vacation homes'], ['airbnb', 'Airbnbs']], (v) => v === f.stayType)}
      </div>
      <p class="muted">Prices are the total for your ${plural(P.nights(t.arrive, t.depart), 'night')}, including taxes and fees.</p>
      <div class="cards">${list.map((s) => stayCard(s, t)).join('')}</div>
      <div class="more-search"><p class="label">Search more places to stay in Moab</p><div class="btn-row">${linkButtons(L.staySearch({ place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize }))}</div></div>
      <details class="more add-own"><summary>Found a place somewhere else? Add it here</summary>
        <form class="form-grid" data-add="stay">
          <label class="field"><span>Name</span><input name="name" required /></label>
          <label class="field"><span>Type</span><select name="type">${Object.entries(STAY_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label class="field"><span>Price per night</span><input name="nightly" type="number" min="0" required /></label>
          <label class="field"><span>Sleeps how many</span><input name="maxGuests" type="number" min="1" value="2" required /></label>
          <label class="field"><span>Cleaning fee</span><input name="cleaningFee" type="number" min="0" value="0" /></label>
          <label class="field"><span>Link (optional)</span><input name="url" type="url" placeholder="https://" /></label>
          <div class="field"><span>&nbsp;</span><button class="btn btn-primary" type="submit">Add this place</button></div>
        </form></details>`;
  }

  function stayCard(s, t) {
    const isSel = state.selection.stayId === s.id;
    const cost = P.stayCost(s, t);
    const units = P.unitsNeeded(s, t);
    const unitWord = s.type === 'hotel' ? 'room' : 'home';
    return `
      <article class="card ${isSel ? 'is-chosen' : ''}">
        <div class="card-head">
          <h3>${esc(s.name)}</h3>
          <p class="price">${fmt(cost)}<small>${fmt(s.nightly)} a night${units > 1 ? ` × ${units} ${unitWord}s` : ''}</small></p>
        </div>
        <p class="muted">${STAY_TYPES[s.type]}${s.rating ? ` · rated ${s.rating} of 5` : ''}${s.minutesToVenue != null ? ` · ${s.minutesToVenue} minutes to the venue` : ''} · sleeps ${s.maxGuests} per ${unitWord}</p>
        ${(s.amenities || []).length ? `<p>${s.amenities.map(esc).join(' · ')}</p>` : ''}
        ${s.perk ? `<p class="perk">${esc(s.perk)}</p>` : ''}
        ${s.custom ? '<p class="tag">Added by you</p>' : ''}
        ${fitNote('stay', s, cost)}
        <div class="card-actions">
          ${choiceButton('stay', s.id, isSel)}
          ${linkButtons(L.stay(s, { place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize }).slice(0, 1))}
          ${s.custom ? `<button type="button" class="btn btn-quiet" data-action="remove-custom" data-kind="stays" data-id="${esc(s.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  function browseGround() {
    const t = trip();
    const sel = selected();
    const f = state.filters;
    if (sel.travel && sel.travel.kind === 'drive')
      return `<div class="notice good big">You’re driving your own car, so you don’t need a rental.</div>`;
    const airport = f.groundAirport || (sel.travel ? sel.travel.to : 'SLC');
    const list = GROUNDS.filter((g) => g.airport === airport).sort((a, b) => P.groundCost(a, t) - P.groundCost(b, t));
    return `
      <div class="filters">
        <p class="label">Pick up at</p>
        ${chips('filter-ground', W.airports.map((a) => [a.code, `${esc(cityOf(a.code))} (${a.code})`]), (v) => v === airport)}
        <p class="muted">${esc(AIRPORT[airport].note)} You’ll need a car to get around Moab and to reach the parks.</p>
      </div>
      <div class="cards">${list.map((g) => groundCard(g, t)).join('')}</div>
      <div class="more-search"><p class="label">Compare live rental prices at ${esc(airportLabel(airport))}</p><div class="btn-row">${linkButtons(L.car({ airport, arrive: t.arrive, depart: t.depart }))}</div></div>`;
  }

  function groundCard(g, t) {
    const isSel = state.selection.groundId === g.id;
    const cost = P.groundCost(g, t);
    const detail = g.kind === 'car'
      ? `${esc(g.example)} · seats ${g.seats} · about ${fmt(g.daily)} a day plus taxes`
      : g.pricing === 'perPerson' ? `${fmt(g.price)} per person, round trip` : `About ${fmt(g.price)} per vehicle, round trip · seats ${g.seats}`;
    return `
      <article class="card ${isSel ? 'is-chosen' : ''}">
        <div class="card-head"><h3>${esc(g.name)}</h3><p class="price">${fmt(cost)}<small>for your whole stay</small></p></div>
        <p class="muted">${detail}</p>
        ${g.note ? `<p class="perk">${esc(g.note)}</p>` : ''}
        ${fitNote('ground', g, cost)}
        <div class="card-actions">
          ${choiceButton('ground', g.id, isSel)}
          ${linkButtons(g.kind === 'car' ? L.car({ airport: g.airport, arrive: t.arrive, depart: t.depart }).slice(0, 1) : L.transfer(g, W.venue))}
        </div>
      </article>`;
  }

  function browseActivities() {
    const t = trip();
    const sel = selected();
    const b = budget();
    const hours = P.freeHours(t, W.date);
    const before = P.costBreakdown({ ...sel, activities: [] }, t).total;
    const left = b.total == null ? null : b.total - before;
    const acts = W.activities.filter((a) => !state.filters.easyOnly || a.effort === 'Easy');
    const plan = left != null && left > 0 ? P.bestActivityPlan(acts, t, left, hours) : [];
    const usedMoney = sel.activities.reduce((s, a) => s + P.activityCost(a, t), 0);
    const usedHours = sel.activities.reduce((s, a) => s + a.durationHours, 0);

    const intro = left == null
      ? `<p class="lead">You have about <b>${hours} free hours</b> outside the wedding events.</p>`
      : `<p class="lead">After getting here, your stay and your car, you have <b>${fmt(left)}</b> and about <b>${hours} free hours</b>${usedHours ? ` (${fmt(usedMoney)} and ${usedHours} hours already planned)` : ''}.</p>
         ${plan.length ? `<button type="button" class="btn btn-primary" data-action="use-plan">Add the ${plan.length} things I can afford</button>` : left <= 0 ? '<p class="muted">Your budget is used up — but the views are free!</p>' : ''}`;

    return `
      <div class="weekend">
        <h3 class="sub-h">The wedding weekend</h3>
        <ul class="schedule">${W.events.map((e) => `<li><span class="when">${niceDate(e.date, true)}, ${esc(e.time)}</span><span><b>${esc(e.name)}</b> — ${esc(e.place)}${e.everyone === false ? ' <i>(wedding party &amp; family)</i>' : ''}</span></li>`).join('')}</ul>
      </div>
      ${intro}
      <div class="filters">${chips('filter-easy', [['0', 'Show everything'], ['1', 'Easy only (little walking)']], (v) => (v === '1') === state.filters.easyOnly)}</div>
      <div class="cards">${acts.map((a) => activityCard(a, t, left == null ? null : left - usedMoney, hours - usedHours)).join('')}</div>
      <div class="more-search"><p class="label">More tours in Moab</p><div class="btn-row">${linkButtons(L.activitySearch(W.venue.searchName))}</div></div>`;
  }

  function activityCard(a, t, moneyLeft, hoursLeft) {
    const isSel = state.selection.activityIds.includes(a.id);
    const cost = P.activityCost(a, t);
    let fit = '';
    if (!isSel) {
      if (a.durationHours > hoursLeft) fit = `<p class="fit bad">Not enough free time left</p>`;
      else if (moneyLeft != null) fit = cost <= moneyLeft ? `<p class="fit good">Fits your budget</p>` : `<p class="fit bad">${fmt(cost - moneyLeft)} more than you have left</p>`;
    }
    return `
      <article class="card ${isSel ? 'is-chosen' : ''}">
        <div class="card-head"><h3>${esc(a.name)}</h3><p class="price">${fmt(cost)}<small>${fmt(a.price)} per person</small></p></div>
        <p class="muted">${esc(a.effort)} · ${a.durationHours} hours${a.rating ? ` · rated ${a.rating} of 5` : ''}</p>
        ${a.note ? `<p class="perk">${esc(a.note)}</p>` : ''}
        ${fit}
        <div class="card-actions">
          <button type="button" class="btn ${isSel ? 'btn-chosen' : 'btn-primary'}" data-action="toggle-activity" data-id="${esc(a.id)}" aria-pressed="${isSel}">${isSel ? 'Added ✓' : 'Add to my trip'}</button>
          ${safeUrl(a.url) ? linkButtons([{ label: 'More info', url: a.url }]) : ''}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- step 6: my trip
  function renderMyTrip() {
    const el = $('#mytrip');
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown(sel, t);
    const b = budget();
    const any = sel.travel || sel.stay || sel.ground || sel.activities.length;

    if (!any) {
      el.innerHTML = `<div class="empty">Choose a trip in step 4, or pick each part in step 5. Your plan and booking steps will appear here.</div>${compareTable()}`;
      return;
    }

    const row = (label, val, cap) => {
      const over = cap != null && val > cap;
      return `<tr><th scope="row">${label}</th><td>${fmt(val)}${cap != null ? ` <span class="${over ? 'fit bad' : 'muted'}">(limit ${fmt(cap)})</span>` : ''}</td></tr>`;
    };
    const left = b.total == null ? null : b.total - c.total;

    const steps = [];
    if (sel.travel) {
      steps.push(bookStep('travel', sel.travel.kind === 'drive' ? 'Plan your drive' : 'Book your flights',
        sel.travel.kind === 'drive'
          ? `${esc(travelLine(sel.travel))}.`
          : `<b>${esc(travelTitle(sel.travel))}</b>: ${esc(travelLine(sel.travel))}. Leave ${niceDate(t.arrive, true)}, come home ${niceDate(t.depart, true)}, ${plural(t.travelers, 'passenger')}.`,
        sel.travel.kind === 'drive'
          ? L.drive(state.home, W.venue)
          : sel.travel.url && safeUrl(sel.travel.url) ? [{ label: 'Book', url: sel.travel.url }] : L.flight({ from: sel.travel.from, to: sel.travel.to, arrive: t.arrive, depart: t.depart, travelers: t.travelers, stops: sel.travel.stops })));
    }
    if (sel.stay)
      steps.push(bookStep('stay', 'Book your place to stay', `<b>${esc(sel.stay.name)}</b>, ${niceDate(t.arrive, true)} to ${niceDate(t.depart, true)}.${sel.stay.perk ? ` ${esc(sel.stay.perk)}` : ''}`,
        L.stay(sel.stay, { place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize })));
    if (sel.ground)
      steps.push(bookStep('ground', sel.ground.kind === 'car' ? 'Reserve your car' : 'Book your ride', `<b>${esc(groundTitle(sel.ground))}</b>${sel.ground.kind === 'car' ? `, pick up ${niceDate(t.arrive, true)} and return ${niceDate(t.depart, true)}` : ''}.`,
        sel.ground.kind === 'car' ? L.car({ airport: sel.ground.airport, arrive: t.arrive, depart: t.depart }) : L.transfer(sel.ground, W.venue)));
    if (sel.activities.length)
      steps.push(bookStep('activities', 'Book things to do', sel.activities.map((a) => esc(a.name)).join(', ') + '.',
        [...sel.activities.filter((a) => safeUrl(a.url)).map((a) => ({ label: a.name, url: a.url })), ...L.activitySearch(W.venue.searchName)]));

    el.innerHTML = `
      <div class="mytrip">
        <div>
          <h3 class="sub-h">Your plan</h3>
          <ul class="schedule">
            <li><span class="when">${niceDate(t.arrive, true)}</span><span>${sel.travel ? `Travel: ${esc(travelTitle(sel.travel))}${sel.travel.kind === 'flight' ? ` from ${esc(airportLabel(sel.travel.from))} to ${esc(airportLabel(sel.travel.to))}` : ''}` : '<span class="muted">Getting there not chosen yet</span>'}</span></li>
            ${sel.ground ? `<li><span class="when">${niceDate(t.arrive, true)}</span><span>Pick up: ${esc(groundTitle(sel.ground))}</span></li>` : ''}
            <li><span class="when">${plural(P.nights(t.arrive, t.depart), 'night')}</span><span>${sel.stay ? `Stay at ${esc(sel.stay.name)}` : '<span class="muted">Place to stay not chosen yet</span>'}</span></li>
            ${W.events.filter((e) => P.stayDates(t.arrive, t.depart).includes(e.date)).map((e) => `<li><span class="when">${niceDate(e.date, true)}</span><span><b>${esc(e.name)}</b>, ${esc(e.time)}</span></li>`).join('')}
            ${sel.activities.map((a) => `<li><span class="when">Any free day</span><span>${esc(a.name)}</span></li>`).join('')}
            <li><span class="when">${niceDate(t.depart, true)}</span><span>Head home</span></li>
          </ul>
        </div>
        <div>
          <h3 class="sub-h">What it costs</h3>
          <table class="costs">
            ${row('Getting there', c.travel, b.caps.travel)}
            ${row('Place to stay', c.stay, b.caps.stay)}
            ${row('Car or shuttle', c.ground, b.caps.ground)}
            ${row('Things to do', c.activities, null)}
            <tr class="total"><th scope="row">Total</th><td>${fmt(c.total)}</td></tr>
            ${left == null ? '' : `<tr><th scope="row">Your budget</th><td>${fmt(b.total)} — <span class="fit ${left >= 0 ? 'good' : 'bad'}">${left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</span></td></tr>`}
          </table>
        </div>
      </div>
      <h3 class="sub-h">How to book, step by step</h3>
      <p class="muted">Each button opens the booking website with your dates and number of people filled in. Tick each step when it’s done.</p>
      <ol class="book-steps">${steps.join('')}</ol>
      <div class="btn-row">
        <button type="button" class="btn" data-action="print">Print my plan</button>
        <button type="button" class="btn" data-action="copy">Copy my plan to send to the couple</button>
        <button type="button" class="btn" data-action="save-trip">Save to compare</button>
        <button type="button" class="btn btn-quiet" data-action="clear">Start over</button>
      </div>
      ${compareTable()}`;
  }

  function bookStep(key, title, text, links) {
    const done = !!state.booked[key];
    return `<li class="book-step ${done ? 'done' : ''}">
      <h4>${title}</h4>
      <p>${text}</p>
      <div class="btn-row">${linkButtons(links, 'btn-book')}</div>
      <label class="check"><input type="checkbox" data-action="booked" data-key="${key}" ${done ? 'checked' : ''}/> I’ve booked this</label>
    </li>`;
  }

  function compareTable() {
    if (!state.saved.length) return '';
    const trips = state.saved;
    const min = (fn) => Math.min(...trips.map(fn));
    const best = (val, b) => (trips.length > 1 && val === b ? 'best' : '');
    const cell = (x, html, cls = '') => `<td class="${cls}">${html}</td>`;
    const row = (label, fn) => `<tr><th scope="row">${label}</th>${trips.map(fn).join('')}</tr>`;
    return `
      <h3 class="sub-h" id="compare">Compare your saved trips</h3>
      <div class="table-wrap"><table class="compare">
        <thead><tr><th></th>${trips.map((x) => `<th scope="col">${esc(x.name)}<div class="btn-row tight">
          <button type="button" class="btn btn-small" data-action="load-saved" data-id="${x.id}">Choose</button>
          <button type="button" class="btn btn-small btn-quiet" data-action="remove-saved" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">Remove</button></div></th>`).join('')}</tr></thead>
        <tbody>
          ${row('Getting there', (x) => cell(x, x.items.travel ? `${esc(travelTitle(x.items.travel))}<br/><span class="muted">${esc(travelLine(x.items.travel))}</span>` : '—'))}
          ${row('Door to venue', (x) => cell(x, hoursText(x.doorMinutes), best(x.doorMinutes, min((y) => y.doorMinutes))))}
          ${row('Place to stay', (x) => cell(x, x.items.stay ? esc(x.items.stay.name) : '—'))}
          ${row('Minutes to venue', (x) => cell(x, x.items.stay && x.items.stay.minutesToVenue != null ? x.items.stay.minutesToVenue : '—', best(x.items.stay ? x.items.stay.minutesToVenue : 999, min((y) => (y.items.stay ? y.items.stay.minutesToVenue : 999)))))}
          ${row('Getting around', (x) => cell(x, x.items.ground ? esc(groundTitle(x.items.ground)) : x.items.travel && x.items.travel.kind === 'drive' ? 'Own car' : 'None'))}
          ${row('Flights', (x) => cell(x, fmt(x.cost.travel), best(x.cost.travel, min((y) => y.cost.travel))))}
          ${row('Place to stay', (x) => cell(x, fmt(x.cost.stay), best(x.cost.stay, min((y) => y.cost.stay))))}
          ${row('Car or shuttle', (x) => cell(x, fmt(x.cost.ground), best(x.cost.ground, min((y) => y.cost.ground))))}
          ${row('Things to do', (x) => cell(x, fmt(x.cost.activities)))}
          <tr class="total"><th scope="row">Total</th>${trips.map((x) => cell(x, fmt(x.cost.total), best(x.cost.total, min((y) => y.cost.total)))).join('')}</tr>
        </tbody>
      </table></div>
      <p class="muted">The best value in each row is highlighted.</p>`;
  }

  function saveTrip(sel) {
    if (state.saved.length >= MAX_SAVED) {
      toast(`You can compare up to ${MAX_SAVED} trips. Remove one first.`);
      $('#step-mytrip').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const t = trip();
    state.saved.push({
      id: uid('trip'),
      name: `Trip ${String.fromCharCode(65 + state.saved.length)}`,
      trip: t,
      items: JSON.parse(JSON.stringify(sel)),
      cost: P.costBreakdown(sel, t),
      doorMinutes: P.doorToDoor(sel.travel, AIRPORT),
    });
    save();
    renderAll();
    toast('Saved. You’ll find it at the bottom of step 6.');
  }

  function planText() {
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown(sel, t);
    return [
      `My travel plans for the wedding in ${W.venue.city}:`,
      `${niceDate(t.arrive, true)} to ${niceDate(t.depart, true)}, ${plural(t.travelers, 'person', 'people')}`,
      sel.travel ? `Getting there: ${travelTitle(sel.travel)} — ${travelLine(sel.travel)}` : null,
      sel.stay ? `Staying at: ${sel.stay.name}` : null,
      sel.ground ? `Getting around: ${groundTitle(sel.ground)}` : null,
      sel.activities.length ? `Things to do: ${sel.activities.map((a) => a.name).join(', ')}` : null,
      `Estimated total: ${fmt(c.total)}`,
    ].filter(Boolean).join('\n');
  }

  // ---------------------------------------------------------------- trip bar
  function renderTripBar() {
    const bar = $('#tripbar');
    const sel = selected();
    const any = sel.travel || sel.stay || sel.ground || sel.activities.length;
    bar.hidden = !any;
    document.body.classList.toggle('has-tripbar', !!any);
    if (!any) return;
    const c = P.costBreakdown(sel, trip());
    const b = budget();
    const left = b.total == null ? null : b.total - c.total;
    bar.innerHTML = `
      <div class="tripbar-inner">
        <div>
          <span class="tb-label">Your trip so far</span>
          <span class="tb-total">${fmt(c.total)}</span>
          ${left == null ? '' : `<span class="tb-status ${left >= 0 ? 'good' : 'bad'}">${left >= 0 ? `${fmt(left)} left of ${fmt(b.total)}` : `${fmt(-left)} over your ${fmt(b.total)} budget`}</span>`}
        </div>
        <a class="btn btn-primary" href="#step-mytrip">See my trip</a>
      </div>`;
  }

  // ---------------------------------------------------------------- forms
  function fillForms() {
    const t = state.trip;
    const wf = $('#when-form');
    wf.arrive.value = t.arrive;
    wf.depart.value = t.depart;
    const bf = $('#budget-form');
    bf.budget.value = t.budget;
    bf['cap-travel'].value = state.caps.travel;
    bf['cap-stay'].value = state.caps.stay;
    bf['cap-ground'].value = state.caps.ground;
    if (Number(t.groupSize) > Number(t.travelers)) $('#sharing').open = true;
  }

  function wireForms() {
    $('#home-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#home-q').value;
      if (q.trim()) searchHome(q);
    });

    $('#geo-btn').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('Your browser can’t share your location. Please type your address.');
      $('#home-results').innerHTML = '<p class="muted">Finding your location…</p>';
      navigator.geolocation.getCurrentPosition(
        (pos) => setHome({ label: 'Your current location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {
          $('#home-results').innerHTML = '<div class="notice warn">We couldn’t get your location. Please type your address instead.</div>';
        },
        { timeout: 10000 }
      );
    });

    $('#when-form').addEventListener('input', (e) => {
      if (!['arrive', 'depart'].includes(e.target.name)) return;
      state.trip[e.target.name] = e.target.value;
      save();
      renderAll();
    });

    $('#budget-form').addEventListener('input', (e) => {
      const { name, value } = e.target;
      if (name === 'budget') state.trip.budget = value;
      else if (name.startsWith('cap-')) state.caps[name.slice(4)] = value;
      else return;
      state.showCount = defaults().showCount;
      save();
      renderAll();
    });
  }

  function onAddSubmit(form) {
    const d = Object.fromEntries(new FormData(form).entries());
    const n = (v) => Math.max(0, Number(v) || 0);
    if (form.dataset.add === 'flight') {
      const item = {
        id: uid('my-flight'), kind: 'flight', custom: true, carriers: d.airline.trim(), from: d.from.toUpperCase().trim(), to: d.to,
        stops: n(d.stops), via: [], durationMinutes: Math.round(n(d.hours) * 60), price: n(d.price), homeMinutes: 0, url: safeUrl(d.url),
      };
      state.custom.flights.push(item);
      state.selection.travelId = item.id;
    } else {
      const item = {
        id: uid('my-stay'), custom: true, name: d.name.trim(), type: d.type, nightly: n(d.nightly), maxGuests: Math.max(1, n(d.maxGuests)),
        cleaningFee: n(d.cleaningFee), taxRate: 0.13, url: safeUrl(d.url), amenities: [],
      };
      state.custom.stays.push(item);
      state.selection.stayId = item.id;
    }
    save();
    renderAll();
    toast('Added and chosen for your trip.');
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    const sizeBtn = e.target.closest('[data-text-size]');
    if (sizeBtn) {
      state.textSize = sizeBtn.dataset.textSize;
      save();
      applyTextSize();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      state.tab = tab.dataset.tab;
      save();
      renderTabs();
      renderBrowse();
      return;
    }
    const stepper = e.target.closest('[data-stepper]');
    if (stepper) {
      const key = stepper.dataset.stepper;
      const t = state.trip;
      t[key] = Math.min(30, Math.max(1, (Number(t[key]) || 1) + Number(stepper.dataset.delta)));
      if (key === 'travelers' && Number(t.groupSize) < t.travelers) t.groupSize = t.travelers;
      if (key === 'groupSize' && t.groupSize < Number(t.travelers)) t.groupSize = Number(t.travelers);
      save();
      renderAll();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn || btn.tagName === 'SELECT' || btn.tagName === 'INPUT') return;
    const { action, id } = btn.dataset;
    const s = state.selection;
    const f = state.filters;

    switch (action) {
      case 'pick-home':
        return setHome(searchResults[Number(btn.dataset.i)]);
      case 'change-home':
        state.home = null;
        state.origins = [];
        searchResults = null;
        $('#home-q').value = '';
        $('#home-q').focus();
        break;
      case 'toggle-origin': {
        const code = btn.dataset.code;
        state.origins = state.origins.includes(code) ? state.origins.filter((c) => c !== code) : [...state.origins, code];
        break;
      }
      case 'filter-stops': f.stops = Number(btn.dataset.val); break;
      case 'filter-arrival': f.arrival = btn.dataset.val; break;
      case 'filter-staytype': f.stayType = btn.dataset.val; break;
      case 'filter-ground': f.groundAirport = btn.dataset.val; break;
      case 'filter-easy': f.easyOnly = btn.dataset.val === '1'; break;
      case 'toggle-all': state.showAll = !state.showAll; state.showCount = defaults().showCount; break;
      case 'more': state.showCount += 6; break;
      case 'pick': {
        const key = `${btn.dataset.slot}Id`;
        s[key] = s[key] === id ? null : id;
        if (btn.dataset.slot === 'travel') {
          const tr = byId(travelOptions(), s.travelId);
          // Keep the car at the airport you're flying into.
          if (s.groundId) {
            const g = byId(GROUNDS, s.groundId);
            if (!tr || tr.kind === 'drive' || (g && g.airport !== tr.to)) s.groundId = null;
          }
          f.groundAirport = tr && tr.kind === 'flight' ? tr.to : '';
        }
        break;
      }
      case 'toggle-activity':
        s.activityIds = s.activityIds.includes(id) ? s.activityIds.filter((x) => x !== id) : [...s.activityIds, id];
        break;
      case 'use-plan': {
        const t = trip();
        const sel = selected();
        const left = budget().total - P.costBreakdown({ ...sel, activities: [] }, t).total;
        const acts = f.easyOnly ? W.activities.filter((a) => a.effort === 'Easy') : W.activities;
        s.activityIds = P.bestActivityPlan(acts, t, left, P.freeHours(t, W.date)).map((a) => a.id);
        toast('Added to your trip.');
        break;
      }
      case 'use-package': {
        const pkg = findPackage(id);
        s.travelId = pkg.travel ? pkg.travel.id : null;
        s.stayId = pkg.stay ? pkg.stay.id : null;
        s.groundId = pkg.ground ? pkg.ground.id : null;
        f.groundAirport = pkg.travel && pkg.travel.kind === 'flight' ? pkg.travel.to : '';
        state.booked = {};
        save();
        renderAll();
        toast('Great choice! Here’s how to book it. Add things to do in step 5.');
        $('#step-mytrip').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      case 'save-package': {
        const pkg = findPackage(id);
        return saveTrip({ ...pkg, activities: selected().activities });
      }
      case 'save-trip':
        return saveTrip(selected());
      case 'load-saved': {
        const rec = state.saved.find((x) => x.id === id);
        s.travelId = rec.items.travel ? rec.items.travel.id : null;
        s.stayId = rec.items.stay ? rec.items.stay.id : null;
        s.groundId = rec.items.ground ? rec.items.ground.id : null;
        s.activityIds = (rec.items.activities || []).map((a) => a.id);
        toast(`${rec.name} chosen.`);
        break;
      }
      case 'remove-saved':
        state.saved = state.saved.filter((x) => x.id !== id);
        break;
      case 'remove-custom':
        state.custom[btn.dataset.kind] = state.custom[btn.dataset.kind].filter((x) => x.id !== id);
        if (s.travelId === id) s.travelId = null;
        if (s.stayId === id) s.stayId = null;
        break;
      case 'clear':
        if (!confirm('Clear your chosen trip and start over?')) return;
        state.selection = defaults().selection;
        state.booked = {};
        break;
      case 'print':
        window.print();
        return;
      case 'copy': {
        const text = planText();
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(() => toast('Copied! Paste it into a text or email.'))
          .catch(() => prompt('Copy your plan:', text));
        return;
      }
      default:
        return;
    }
    save();
    renderAll();
  }

  function onChange(e) {
    const el = e.target;
    if (el.matches('[data-action="booked"]')) {
      state.booked[el.dataset.key] = el.checked;
      save();
      el.closest('.book-step').classList.toggle('done', el.checked);
      return;
    }
    if (el.matches('select[data-action="sort"]')) {
      state.sort = el.value;
      state.showCount = defaults().showCount;
      save();
      renderOptions();
      return;
    }
    if (el.matches('select[data-action="add-origin"]') && el.value) {
      if (!state.origins.includes(el.value)) state.origins.push(el.value);
      searchResults = null;
      save();
      renderAll();
    }
  }

  function onSubmit(e) {
    const form = e.target.closest('form[data-add]');
    if (!form) return;
    e.preventDefault();
    onAddSubmit(form);
  }

  function onKeydown(e) {
    // Arrow keys move between tabs
    const tab = e.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = [...document.querySelectorAll('#tabs [role="tab"]')];
    const i = (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[i].click();
    tabs[i].focus();
  }

  // ---------------------------------------------------------------- boot
  function renderAll() {
    renderHome();
    renderWhen();
    renderBudgetNotes();
    renderOptions();
    renderTabs();
    renderBrowse();
    renderMyTrip();
    renderTripBar();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKeydown);

  renderHeader();
  applyTextSize();
  fillForms();
  wireForms();
  renderAll();
})();
