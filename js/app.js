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
  const BASE_GROUNDS = P.expandGround(W.cars, W.transfers, W.airports);
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
    found: {}, // prices guests found online, by option id
    tierEdits: {}, // swaps made inside each budget package
    openStep: 1, // which step is open (1-6), or null
    quickOpen: false,
    confirmed: { when: false, budget: false, extras: false },
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
        found: { ...d.found, ...raw.found },
        tierEdits: { ...d.tierEdits, ...raw.tierEdits },
        confirmed: { ...d.confirmed, ...raw.confirmed },
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
    return out.map((o) => (o.kind === 'flight' && state.found[o.id] != null ? { ...o, price: state.found[o.id], foundOnline: true } : o));
  }
  const allStays = () =>
    [...W.stays, ...state.custom.stays].map((x) => (state.found[x.id] != null ? { ...x, nightly: state.found[x.id], foundOnline: true } : x));
  function grounds() {
    return BASE_GROUNDS.map((g) => {
      const v = state.found[g.id];
      if (v == null) return g;
      return g.kind === 'car' ? { ...g, daily: v, foundOnline: true } : { ...g, price: v, foundOnline: true };
    });
  }
  const byId = (list, id) => list.find((x) => x.id === id) || null;

  function selected() {
    const s = state.selection;
    return {
      travel: byId(travelOptions(), s.travelId),
      stay: byId(allStays(), s.stayId),
      ground: byId(grounds(), s.groundId),
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

  // ---------------------------------------------------------------- quick booking
  function renderQuick() {
    const t = trip();
    const n = P.nights(t.arrive, t.depart);
    const from = state.origins[0] || '';
    const ok = n > 0;
    const d = { arrive: t.arrive, depart: t.depart, travelers: t.travelers };
    const tile = (title, hint, links) => `
      <div class="quick-tile">
        <h3>${title}</h3>
        <p class="muted">${hint}</p>
        <div class="quick-btns">${linkButtons(links.slice(0, 1), 'btn-primary')}${linkButtons(links.slice(1))}</div>
      </div>`;
    $('#quick-body').innerHTML = `
      <p class="lead">Each button opens the booking website with the wedding dates already filled in:
        <b>${ok ? `${niceDate(t.arrive, true)} to ${niceDate(t.depart, true)}` : 'choose your dates in step 2'}</b>, ${plural(t.travelers, 'person', 'people')}.
        <button type="button" class="link-btn" data-open-step="2">Change dates or people</button></p>
      <div class="quick-grid">
        ${tile('Flights', `Salt Lake City has the most flights (3¾ hours’ drive). Moab’s own airport is 15 minutes away but has few flights.${from ? ` Searching from ${esc(airportLabel(from))}.` : ''}`, [
          { label: 'Flights to Salt Lake City', url: L.flightTo({ from, to: 'SLC', ...d }) },
          { label: 'Flights to Moab', url: L.flightTo({ from, to: 'CNY', ...d }) },
          { label: 'Flights to Grand Junction', url: L.flightTo({ from, to: 'GJT', ...d }) },
        ])}
        ${tile('Hotels', 'Hotels in Moab, about 15–20 minutes from the venue.', [
          { label: 'Hotels on Booking.com', url: L.staySearch({ place: W.venue.searchName, ...d })[0].url },
          { label: 'Google Hotels', url: `https://www.google.com/travel/search?q=${encodeURIComponent(`hotels in ${W.venue.searchName}`)}&checkin=${t.arrive}&checkout=${t.depart}` },
        ])}
        ${tile('Airbnbs & vacation homes', 'Good for families or groups sharing a house.', L.staySearch({ place: W.venue.searchName, ...d, travelers: t.groupSize }).slice(1))}
        ${tile('Rental cars', 'You’ll need a car in Moab. Pick it up at the airport you fly into.', [
          { label: 'Cars at Salt Lake City', url: L.car({ airport: 'SLC', arrive: t.arrive, depart: t.depart })[0].url },
          { label: 'Cars at Moab airport', url: L.car({ airport: 'CNY', arrive: t.arrive, depart: t.depart })[0].url },
          { label: 'Cars at Grand Junction', url: L.car({ airport: 'GJT', arrive: t.arrive, depart: t.depart })[0].url },
        ])}
      </div>`;
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
    toast('Found you! Next, your dates.');
    openStep(2);
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
      grounds: grounds(),
      activities: state.filters.easyOnly ? W.activities.filter((a) => a.effort === 'Easy') : W.activities,
      trip: trip(),
      weddingDate: W.date,
      budget: budget(),
      airports: W.airports,
      sort,
    });
  }

  /** Options that pass the guest's per-part limits ("what we found for you"). */
  function okLists() {
    const t = trip();
    const caps = budget().caps;
    return {
      travel: travelOptions().filter((x) => P.withinCap(P.travelCost(x, t), caps.travel)),
      stays: allStays().filter((x) => P.withinCap(P.stayCost(x, t), caps.stay)),
      grounds: grounds().filter((x) => P.withinCap(P.groundCost(x, t), caps.ground)),
    };
  }

  function makePackage(travel, stay, ground, planFor) {
    const t = trip();
    const b = budget();
    const cost = P.costBreakdown({ travel, stay, ground }, t);
    const leftover = b.total == null ? null : b.total - cost.total;
    const activityPlan = leftover != null && leftover > 0 && planFor ? planFor(leftover) : [];
    return {
      id: `${travel.id}|${stay.id}|${ground ? ground.id : 'none'}`,
      travel, stay, ground, cost, total: cost.total, leftover,
      doorMinutes: P.doorToDoor(travel, AIRPORT),
      stops: travel.kind === 'drive' ? 0 : travel.stops,
      activityPlan,
    };
  }

  /** The four budget packages, with any swaps the guest made applied. */
  function currentTiers(res) {
    const t = trip();
    const lists = okLists();
    const acts = state.filters.easyOnly ? W.activities.filter((a) => a.effort === 'Easy') : W.activities;
    const planFor = P.activityPlanner(acts, t, P.freeHours(t, W.date));
    return P.budgetTiers(res.fits, budget().total).map((tier) => {
      const e = state.tierEdits[tier.key];
      if (!e) return { ...tier, edited: false };
      const travel = byId(lists.travel, e.travelId) || tier.pkg.travel;
      const stay = byId(lists.stays, e.stayId) || tier.pkg.stay;
      let ground = e.groundId === 'none' ? null : byId(lists.grounds, e.groundId) || tier.pkg.ground;
      ground = P.matchGround(travel, ground, lists.grounds, W.airports);
      return { ...tier, edited: true, pkg: makePackage(travel, stay, ground, planFor) };
    });
  }

  function renderOptions() {
    const el = $('#options');
    const t = trip();
    if (!travelOptions().length) {
      el.innerHTML = `<div class="empty">Start with <button type="button" class="link-btn" data-open-step="1">step 1</button> — tell us where you’re traveling from and your packages will appear here.</div>${compareTable()}`;
      return;
    }
    if (!P.nights(t.arrive, t.depart)) {
      el.innerHTML = `<div class="empty">Choose your travel dates in <button type="button" class="link-btn" data-open-step="2">step 2</button>.</div>`;
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
        ${closest.length ? `<h3 class="sub-h">The closest options</h3>${closest.map((p) => tripCard(p)).join('')}` : ''}${compareTable()}`;
      return;
    }

    const tiers = currentTiers(res);
    const intro = `<p class="lead">${b.total == null ? 'Four packages, from the lowest price up.' : `Four packages at different price levels, all within your <b>${fmt(b.total)}</b> budget.`}
      Don’t like a part? Use <b>Change</b> to swap it for another option we found. Found a better price online? Enter it and the total updates.</p>`;

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

    el.innerHTML = `${intro}${capNote}<div class="picks">${tiers.map((tier) => tripCard(tier.pkg, tier)).join('')}</div>${all}${compareTable()}`;
    drawMaps(el);
  }

  function capRemovalNote(removed) {
    const b = budget();
    const bits = [];
    if (removed.travel) bits.push(`${plural(removed.travel, 'way', 'ways')} of getting here (over ${fmt(b.caps.travel)})`);
    if (removed.stays) bits.push(`${plural(removed.stays, 'place', 'places')} to stay (over ${fmt(b.caps.stay)})`);
    if (removed.grounds) bits.push(`${plural(removed.grounds, 'car or shuttle', 'cars and shuttles')} (over ${fmt(b.caps.ground)})`);
    return bits.length ? `<p class="muted">Your limits are hiding ${bits.join(', ')}.</p>` : '';
  }

  // ---- labels and links used by package rows and the summary
  function travelShort(o) {
    if (o.kind === 'drive') return 'Drive your own car';
    const stops = o.stops === 0 ? 'Direct' : P.stopsLabel(o.stops);
    return `${stops}: ${o.from} to ${cityOf(o.to)}`;
  }
  function travelLinks(o, t) {
    if (o.kind === 'drive') return L.drive(state.home, W.venue);
    if (o.url && safeUrl(o.url)) return [{ label: 'Book this flight', url: o.url }];
    return L.flight({ from: o.from, to: o.to, arrive: t.arrive, depart: t.depart, travelers: t.travelers, stops: o.stops });
  }
  const stayLinks = (x, t) => L.stay(x, { place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize });
  const groundLinks = (g, t) => (g.kind === 'car' ? L.car({ airport: g.airport, arrive: t.arrive, depart: t.depart }) : L.transfer(g, W.venue));

  /** What a typed-in "price I found" means for each kind of option. */
  function priceUnit(slot, item) {
    if (slot === 'travel') return { label: 'Round-trip price per person', base: item.price };
    if (slot === 'stay') return { label: 'Price per night (before tax)', base: item.nightly };
    if (item.kind === 'car') return { label: 'Price per day', base: item.daily };
    return { label: item.pricing === 'perPerson' ? 'Price per person' : 'Price for the ride', base: item.price };
  }

  function priceTag(item) {
    if (!item) return '';
    if (item.foundOnline) return '<span class="price-tag found">Price you found</span>';
    if (item.kind === 'drive') return '<span class="price-tag">Fuel estimate</span>';
    return '<span class="price-tag">Estimate</span>';
  }

  /** "Check live price" + "Found a different price?" for one item. */
  function liveControls(slot, item, links) {
    if (!item || item.kind === 'drive') return '';
    const u = priceUnit(slot, item);
    return `
      <div class="live-row">
        ${linkButtons(links.slice(0, 1).map((l) => ({ ...l, label: 'Check live price' })), 'btn-small')}
        <details class="found">
          <summary>Found a different price online?</summary>
          <form class="found-form" data-found="${esc(item.id)}">
            <label class="field"><span>${u.label}</span>
              <span class="money"><span aria-hidden="true">$</span><input type="number" inputmode="decimal" name="price" min="0" step="1" value="${item.foundOnline ? esc(u.base) : ''}" placeholder="${esc(u.base)}" /></span></label>
            <div class="btn-row tight"><button type="submit" class="btn btn-small btn-primary">Use this price</button>
            ${item.foundOnline ? `<button type="button" class="btn btn-small btn-quiet" data-action="clear-found" data-id="${esc(item.id)}">Go back to our estimate</button>` : ''}</div>
          </form>
        </details>
      </div>`;
  }

  /** A drop-down to swap one part of a package for another option we found. */
  function swapSelect(tier, slot, p) {
    const t = trip();
    const b = budget();
    const lists = okLists();
    let options;
    let current;
    if (slot === 'travel') {
      options = lists.travel.map((o) => ({ id: o.id, label: travelShort(o), cost: P.travelCost(o, t) }));
      current = p.travel.id;
    } else if (slot === 'stay') {
      options = lists.stays.map((o) => ({ id: o.id, label: o.name, cost: P.stayCost(o, t) }));
      current = p.stay.id;
    } else {
      if (p.travel.kind === 'drive') return '';
      const here = lists.grounds.filter((g) => g.airport === p.travel.to);
      options = here.map((o) => ({ id: o.id, label: o.kind === 'car' ? o.name : o.name, cost: P.groundCost(o, t) }));
      if (AIRPORT[p.travel.to] && AIRPORT[p.travel.to].noCarOk) options.unshift({ id: 'none', label: 'No car', cost: 0 });
      current = p.ground ? p.ground.id : 'none';
    }
    if (options.length < 2) return '';
    const curCost = options.find((o) => o.id === current)?.cost ?? 0;
    options.sort((a, c) => a.cost - c.cost);
    const opts = options
      .map((o) => {
        const diff = o.cost - curCost;
        const over = b.total != null && p.total + diff > b.total;
        const note = o.id === current ? '' : ` (${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}${over ? ', over budget' : ''})`;
        return `<option value="${esc(o.id)}" ${o.id === current ? 'selected' : ''}>${o.id === current ? '✓ ' : ''}${esc(o.label)}, ${fmt(o.cost)}${note}</option>`;
      })
      .join('');
    const name = { travel: 'how you get there', stay: 'where you stay', ground: 'your car or shuttle' }[slot];
    return `<label class="swap"><span>Change ${name}</span><select data-action="swap" data-tier="${tier.key}" data-slot="${slot}">${opts}</select></label>`;
  }

  // ---------------------------------------------------------------- maps
  const mapRoutes = {}; // map element id -> route
  const openMaps = new Set(); // package maps the guest has opened

  /** The journey for a package: points and legs for the map, plus plain-language steps. */
  function routeFor(p) {
    const points = [];
    const legs = [];
    const steps = [];
    const add = (pt) => (points.push(pt), points.length - 1);
    const tr = p.travel;
    const stay = p.stay;
    const venue = W.venue;
    const stayHas = stay && stay.lat != null;
    let last = null;
    if (state.home) last = add({ lat: state.home.lat, lon: state.home.lon, label: 'Home', kind: 'home' });

    if (tr.kind === 'drive') {
      const to = stayHas ? add({ lat: stay.lat, lon: stay.lon, label: stay.name, kind: 'stay' }) : null;
      if (last != null && to != null) legs.push({ from: last, to, mode: 'drive' });
      steps.push(`Drive from home to ${stay ? stay.name : W.venue.city}: ${tr.miles.toLocaleString()} miles, ${hoursText(tr.durationMinutes)}${tr.overnight ? '. Plan an overnight stop on the way' : ''}.`);
      last = to != null ? to : last;
    } else {
      const from = T.byCode[tr.from];
      const arrival = T.byCode[tr.to];
      const arrivalInfo = AIRPORT[tr.to];
      let at = null;
      if (from) {
        at = add({ lat: from.lat, lon: from.lon, label: `${cityOf(tr.from)} airport (${tr.from})`, kind: 'airport' });
        if (last != null) legs.push({ from: last, to: at, mode: 'drive' });
        if (state.home && tr.homeMinutes) steps.push(`Get to ${airportLabel(tr.from)} airport — ${hoursText(tr.homeMinutes)} from home. Arrive about 1½ hours before your flight.`);
      }
      (tr.via || []).forEach((code) => {
        const v = T.byCode[code];
        if (!v) return;
        const i = add({ lat: v.lat, lon: v.lon, label: `Change planes in ${cityOf(code)} (${code})`, kind: 'connection' });
        if (at != null) legs.push({ from: at, to: i, mode: 'fly' });
        at = i;
      });
      if (arrival) {
        const i = add({ lat: arrival.lat, lon: arrival.lon, label: `Land in ${cityOf(tr.to)} (${tr.to})`, kind: 'airport', local: arrivalInfo && arrivalInfo.minutesToVenue <= 30 });
        if (at != null) legs.push({ from: at, to: i, mode: 'fly' });
        at = i;
      }
      const via = (tr.via || []).length ? `, changing planes in ${tr.via.map(cityOf).join(' and ')}` : ', direct';
      steps.push(`Fly from ${airportLabel(tr.from)} to ${airportLabel(tr.to)}${via} — ${hoursText(tr.durationMinutes)} of travel.`);
      const drive = arrivalInfo ? hoursText(arrivalInfo.minutesToVenue) : '';
      const where = stay ? stay.name : W.venue.city;
      if (p.ground && p.ground.kind === 'car') steps.push(`Pick up your rental car (${p.ground.name}) at the airport and drive to ${where} — ${drive}.`);
      else if (p.ground) steps.push(`Take the ${p.ground.name} to ${where} — ${drive}.`);
      else steps.push(`Take a taxi or ride to ${where} — ${drive}.`);
      if (stayHas) {
        const i = add({ lat: stay.lat, lon: stay.lon, label: stay.name, kind: 'stay' });
        if (at != null) legs.push({ from: at, to: i, mode: 'drive' });
        at = i;
      }
      last = at;
    }
    const v = add({ lat: venue.lat, lon: venue.lon, label: venue.name, kind: 'venue' });
    if (last != null) legs.push({ from: last, to: v, mode: 'drive' });
    if (stay) steps.push(`On the wedding day: ${stay.name} to ${venue.name}${stay.minutesToVenue != null ? ` — about ${stay.minutesToVenue} minutes` : ''}.`);

    const start = tr.kind === 'drive' ? (state.home ? `${state.home.lat},${state.home.lon}` : '') : `${tr.to} airport`;
    const directions = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(venue.address)}${stay ? `&waypoints=${encodeURIComponent(stayHas ? `${stay.lat},${stay.lon}` : `${stay.name}, ${venue.city}`)}` : ''}&travelmode=driving`;
    return { points, legs, steps, directions };
  }

  function mapBlock(id, p) {
    const r = routeFor(p);
    mapRoutes[id] = r;
    return `
      <div class="trip-map-wrap">
        <div class="trip-map" id="${id}" role="img" aria-label="Map of the journey from ${esc(state.home ? 'home' : airportLabel(p.travel.from || ''))} to ${esc(W.venue.name)}"></div>
        <div class="map-btns">
          <button type="button" class="btn btn-small" data-action="map-all" data-map="${id}">Whole journey</button>
          <button type="button" class="btn btn-small" data-action="map-local" data-map="${id}">Zoom to Moab</button>
          <span class="map-key"><span class="k fly"></span>Flight <span class="k drive"></span>Drive</span>
        </div>
        <ol class="route-steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <a class="btn btn-small" href="${esc(r.directions)}" target="_blank" rel="noopener">Driving directions in Google Maps<span class="ext" aria-hidden="true"> ↗</span></a>
      </div>`;
  }

  /** Draw any maps that are on screen (after a re-render). */
  function drawMaps(scope = document) {
    scope.querySelectorAll('.trip-map').forEach((el) => {
      const details = el.closest('details');
      if (details && !details.open) return;
      if (el.closest('[hidden]')) return; // drawn when its step opens
      if (mapRoutes[el.id]) window.TripMap.render(el, mapRoutes[el.id]);
    });
  }

  function tripCard(p, tier) {
    const t = trip();
    const n = P.nights(t.arrive, t.depart);
    const b = budget();
    const tr = p.travel;
    const arrival = tr.kind === 'flight' ? AIRPORT[tr.to] : null;
    const editable = tier && tier.key;
    const extras = p.leftover == null
      ? ''
      : p.leftover < 0
        ? `<p class="tc-extra over">This is <b>${fmt(-p.leftover)}</b> over your budget.</p>`
        : p.activityPlan.length
          ? `<p class="tc-extra">You’d have <b>${fmt(p.leftover)}</b> left. That’s enough for: ${p.activityPlan.map((a) => esc(a.name)).join(', ')}.</p>`
          : `<p class="tc-extra plain">You’d have <b>${fmt(p.leftover)}</b> left for meals and extras.</p>`;
    const isChosen = state.selection.travelId === tr.id && state.selection.stayId === p.stay.id && (state.selection.groundId || 'none') === (p.ground ? p.ground.id : 'none');
    const level = tier && tier.key ? ['saver', 'value', 'comfort', 'splurge'].indexOf(tier.key) + 1 : 0;
    return `
      <article class="trip-card ${tier ? 'is-pick' : ''} ${isChosen ? 'is-chosen' : ''}">
        <header class="tc-head">
          <div>
            ${tier ? `<p class="tc-level">${level ? `${'$'.repeat(level)}<span class="sr-only">Level ${level} of 4</span>` : ''}</p><p class="tc-label">${esc(tier.label)}</p><p class="tc-why">${esc(tier.why)}</p>` : ''}
          </div>
          <div class="tc-total"><span>${fmt(p.total)}</span><small>total for ${plural(t.travelers, 'person', 'people')}, ${plural(n, 'night')}${b.total != null ? `<br/>${Math.round((p.total / b.total) * 100)}% of your budget` : ''}</small></div>
        </header>
        <div class="tc-parts">
          <section class="tc-part">
            <div class="tc-row"><h4>Getting there</h4><p class="amt">${fmt(p.cost.travel)}${priceTag(tr)}</p></div>
            <p><b>${esc(travelTitle(tr))}</b><br/>${esc(travelLine(tr))}${tr.kind === 'flight' ? ` · ${hoursText(tr.durationMinutes)} of travel` : ''}</p>
            ${editable ? swapSelect(tier, 'travel', p) + liveControls('travel', tr, travelLinks(tr, t)) : ''}
          </section>
          <section class="tc-part">
            <div class="tc-row"><h4>Staying at</h4><p class="amt">${fmt(p.cost.stay)}${priceTag(p.stay)}</p></div>
            <p><b>${esc(p.stay.name)}</b><br/>${STAY_TYPES[p.stay.type]}${p.stay.rating ? ` · rated ${p.stay.rating} of 5` : ''}${p.stay.minutesToVenue != null ? ` · ${p.stay.minutesToVenue} min to the venue` : ''}</p>
            ${editable ? swapSelect(tier, 'stay', p) + liveControls('stay', p.stay, stayLinks(p.stay, t)) : ''}
          </section>
          <section class="tc-part">
            <div class="tc-row"><h4>Getting around</h4><p class="amt">${fmt(p.cost.ground)}${p.ground ? priceTag(p.ground) : ''}</p></div>
            <p>${p.ground ? `<b>${esc(groundTitle(p.ground))}</b>${arrival ? `<br/>Then ${hoursText(arrival.minutesToVenue)} to the venue` : ''}` : tr.kind === 'drive' ? 'Your own car' : 'No car — you’ll need taxis or rides'}</p>
            ${editable ? swapSelect(tier, 'ground', p) + (p.ground ? liveControls('ground', p.ground, groundLinks(p.ground, t)) : '') : ''}
          </section>
        </div>
        <p class="tc-door">Door to venue: ${hoursText(p.doorMinutes)} each way</p>
        ${extras}
        ${tier && tier.key ? `<details class="more map-details" data-map-key="${tier.key}" ${openMaps.has(tier.key) ? 'open' : ''}>
          <summary>Show this trip on a map</summary>${mapBlock(`map-${tier.key}`, p)}</details>` : ''}
        <div class="tc-actions">
          <button type="button" class="btn btn-primary" data-action="use-package" data-id="${esc(p.id)}">${isChosen ? 'Chosen ✓ — see your summary' : 'Choose this package'}</button>
          <button type="button" class="btn btn-quiet" data-action="save-package" data-id="${esc(p.id)}">Save to compare</button>
          ${tier && tier.edited ? `<button type="button" class="btn btn-quiet" data-action="reset-tier" data-tier="${tier.key}">Undo my changes</button>` : ''}
        </div>
      </article>`;
  }

  function findPackage(id) {
    const [tid, sid, gid] = id.split('|');
    return { travel: byId(travelOptions(), tid), stay: byId(allStays(), sid), ground: gid === 'none' ? null : byId(grounds(), gid) };
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

  function choiceButton(slot, id, isSel, label = 'Add to my plan') {
    return `<button type="button" class="btn ${isSel ? 'btn-chosen' : ''}" data-action="pick" data-slot="${slot}" data-id="${esc(id)}" aria-pressed="${isSel}">${isSel ? 'In my plan ✓' : label}</button>`;
  }

  /** The main "Book on …" button for an option. */
  function bookButton(links) {
    return linkButtons(links.slice(0, 1).map((l) => ({ ...l, label: /^Book/.test(l.label) ? l.label : `Book on ${l.label}` })), 'btn-primary');
  }

  function browseTravel() {
    const t = trip();
    const f = state.filters;
    const opts = travelOptions();
    if (!opts.length) return `<div class="empty">Tell us where you’re traveling from in <button type="button" class="link-btn" data-open-step="1">step 1</button> to see flights.</div>`;
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
          <div class="card-actions">${linkButtons(L.drive(state.home, W.venue), 'btn-primary')}${choiceButton('travel', o.id, isSel)}</div>
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
          ${bookButton(o.url && safeUrl(o.url) ? [{ label: 'Book this flight', url: o.url }] : L.flight({ from: o.from, to: o.to, arrive: t.arrive, depart: t.depart, travelers: t.travelers, stops: o.stops }))}
          ${choiceButton('travel', o.id, isSel)}
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
          ${bookButton(L.stay(s, { place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize }))}
          ${choiceButton('stay', s.id, isSel)}
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
    const list = grounds().filter((g) => g.airport === airport).sort((a, b) => P.groundCost(a, t) - P.groundCost(b, t));
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
          ${bookButton(g.kind === 'car' ? L.car({ airport: g.airport, arrive: t.arrive, depart: t.depart }) : L.transfer(g, W.venue))}
          ${choiceButton('ground', g.id, isSel)}
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

  // ---------------------------------------------------------------- step 6: summary
  function renderMyTrip() {
    const el = $('#mytrip');
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown(sel, t);
    const b = budget();
    const any = sel.travel || sel.stay || sel.ground || sel.activities.length;

    if (!any) {
      el.innerHTML = `<div class="empty">Nothing chosen yet. Choose a package in <button type="button" class="link-btn" data-open-step="4">step 4</button>, or pick each part in <button type="button" class="link-btn" data-open-step="5">step 5</button>. Everything you choose will be listed here with a button to book it.</div>`;
      return;
    }

    const n = P.nights(t.arrive, t.depart);
    const items = [];
    if (sel.travel)
      items.push(summaryItem('travel', sel.travel.kind === 'drive' ? 'Getting there' : 'Flights', travelTitle(sel.travel),
        sel.travel.kind === 'drive'
          ? `${travelLine(sel.travel)}.`
          : `${travelLine(sel.travel)}. Leave ${niceDate(t.arrive, true)}, return ${niceDate(t.depart, true)}. ${plural(t.travelers, 'passenger')}.`,
        c.travel, b.caps.travel, sel.travel, travelLinks(sel.travel, t), '#step-browse', 'travel'));
    if (sel.stay)
      items.push(summaryItem('stay', 'Place to stay', sel.stay.name,
        `${STAY_TYPES[sel.stay.type]}. Check in ${niceDate(t.arrive, true)}, check out ${niceDate(t.depart, true)} (${plural(n, 'night')}).${sel.stay.perk ? ` ${sel.stay.perk}` : ''}`,
        c.stay, b.caps.stay, sel.stay, stayLinks(sel.stay, t), '#step-browse', 'stays'));
    if (sel.ground)
      items.push(summaryItem('ground', sel.ground.kind === 'car' ? 'Rental car' : 'Ride', groundTitle(sel.ground),
        sel.ground.kind === 'car' ? `Pick up ${niceDate(t.arrive, true)}, return ${niceDate(t.depart, true)}. ${sel.ground.example || ''}` : sel.ground.note || '',
        c.ground, b.caps.ground, sel.ground, groundLinks(sel.ground, t), '#step-browse', 'ground'));
    else if (sel.travel && sel.travel.kind === 'flight')
      items.push(`<li class="sum-item missing"><div class="sum-head"><div><p class="sum-kind">Car or shuttle</p><h4>Not chosen yet</h4></div></div>
        <p>You’ll need a way to get from ${esc(airportLabel(sel.travel.to))} to Moab.</p>
        <div class="btn-row"><button type="button" class="btn btn-primary" data-action="goto-tab" data-tab-target="ground">Choose a car or shuttle</button></div></li>`);
    sel.activities.forEach((a) =>
      items.push(summaryItem(`act-${a.id}`, 'Thing to do', a.name, `${a.effort} · ${a.durationHours} hours${a.note ? `. ${a.note}` : ''}`,
        P.activityCost(a, t), null, a, safeUrl(a.url) ? [{ label: 'More info & tickets', url: a.url }] : L.activitySearch(W.venue.searchName), '#step-browse', 'activities')));

    const left = b.total == null ? null : b.total - c.total;

    el.innerHTML = `
      <p class="lead">Here’s everything you chose for ${niceDate(t.arrive, true)} to ${niceDate(t.depart, true)}, ${plural(t.travelers, 'person', 'people')}. Book each item with its button, then tick it off.</p>
      <ol class="sum-list">${items.join('')}</ol>
      ${sel.travel && sel.stay ? `<h3 class="sub-h">Your route</h3>${mapBlock('map-summary', { travel: sel.travel, stay: sel.stay, ground: sel.ground })}` : ''}

      <div class="sum-total">
        <table class="costs">
          ${costRow('Getting there', c.travel, b.caps.travel, !!sel.travel)}
          ${costRow('Place to stay', c.stay, b.caps.stay, !!sel.stay)}
          ${costRow('Car or shuttle', c.ground, b.caps.ground, !!sel.ground)}
          ${costRow('Things to do', c.activities, null, sel.activities.length > 0)}
          <tr class="total"><th scope="row">Total</th><td>${fmt(c.total)}</td></tr>
          ${left == null ? '' : `<tr><th scope="row">Your budget</th><td>${fmt(b.total)} — <span class="fit ${left >= 0 ? 'good' : 'bad'}">${left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</span></td></tr>`}
        </table>
        <p class="muted">Prices marked “Estimate” are our best guess. The booking site always shows the real price before you pay.</p>
      </div>

      <details class="more">
        <summary>See it day by day</summary>
        <ul class="schedule">
          <li><span class="when">${niceDate(t.arrive, true)}</span><span>${sel.travel ? esc(travelTitle(sel.travel)) : 'Arrive'}${sel.ground ? `, then ${esc(groundTitle(sel.ground))}` : ''}${sel.stay ? `. Check in at ${esc(sel.stay.name)}` : ''}</span></li>
          ${W.events.filter((e) => P.stayDates(t.arrive, t.depart).includes(e.date)).map((e) => `<li><span class="when">${niceDate(e.date, true)}</span><span><b>${esc(e.name)}</b>, ${esc(e.time)}${e.everyone === false ? ' (wedding party &amp; family)' : ''}</span></li>`).join('')}
          ${sel.activities.map((a) => `<li><span class="when">Any free day</span><span>${esc(a.name)}</span></li>`).join('')}
          <li><span class="when">${niceDate(t.depart, true)}</span><span>Head home</span></li>
        </ul>
      </details>

      <div class="btn-row">
        <button type="button" class="btn" data-action="print">Print my summary</button>
        <button type="button" class="btn" data-action="copy">Copy my summary to send to the couple</button>
        <button type="button" class="btn btn-quiet" data-action="clear">Start over</button>
      </div>`;
    drawMaps(el);
  }

  function costRow(label, val, cap, chosen) {
    const over = cap != null && val > cap;
    return `<tr><th scope="row">${label}</th><td>${chosen ? fmt(val) : '<span class="muted">not chosen</span>'}${cap != null ? ` <span class="${over ? 'fit bad' : 'muted'}">(limit ${fmt(cap)})</span>` : ''}</td></tr>`;
  }

  function summaryItem(key, kind, title, text, cost, cap, item, links, changeHref, tab) {
    const done = !!state.booked[key];
    const over = cap != null && cost > cap;
    return `<li class="sum-item ${done ? 'done' : ''}">
      <div class="sum-head">
        <div><p class="sum-kind">${esc(kind)}</p><h4>${esc(title)}</h4></div>
        <p class="amt">${fmt(cost)}${priceTag(item)}${over ? '<span class="fit bad">Over your limit</span>' : ''}</p>
      </div>
      <p>${esc(text)}</p>
      <div class="btn-row">${linkButtons(links.slice(0, 1).map((l) => ({ ...l, label: /^(Book|More|Driving)/.test(l.label) ? l.label : `Book on ${l.label}` })), 'btn-primary')}${linkButtons(links.slice(1))}
        <button type="button" class="btn btn-quiet" data-action="goto-tab" data-tab-target="${tab}">Change</button></div>
      <label class="check"><input type="checkbox" data-action="booked" data-key="${esc(key)}" ${done ? 'checked' : ''}/> I’ve booked this</label>
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
      <details class="more" id="compare" open><summary>Compare your ${plural(trips.length, 'saved trip')}</summary>
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
      <p class="muted">The best value in each row is highlighted.</p></details>`;
  }

  function saveTrip(sel) {
    if (state.saved.length >= MAX_SAVED) {
      toast(`You can compare up to ${MAX_SAVED} trips. Remove one first.`);
      $('#compare') && $('#compare').scrollIntoView({ behavior: 'smooth' });
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
    toast('Saved. Compare it at the bottom of step 4.');
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
        <button type="button" class="btn btn-primary" data-open-step="6">See my trip</button>
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
    const opener = e.target.closest('[data-open-step]');
    if (opener) {
      const n = opener.dataset.openStep;
      // Clicking the open step's header closes it.
      if (opener.classList.contains('step-toggle') && n !== 'quick' && state.openStep === Number(n)) {
        state.openStep = null;
        save();
        renderSteps();
        return;
      }
      openStep(n);
      return;
    }
    const nx = e.target.closest('[data-action="next-step"]');
    if (nx) return nextStep(Number(nx.dataset.step));
    if (e.target.closest('[data-action="build-own"]')) {
      state.tab = 'travel';
      save();
      renderTabs();
      renderBrowse();
      openStep(5);
      return;
    }
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
            const g = byId(grounds(), s.groundId);
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
        state.tab = 'activities';
        save();
        renderAll();
        toast('Package chosen! Add things to do, or continue to your summary.');
        openStep(5);
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
      case 'map-all':
      case 'map-local': {
        const m = document.getElementById(btn.dataset.map);
        if (m && m._showAll) (action === 'map-all' ? m._showAll : m._showLocal)();
        return;
      }
      case 'reset-tier':
        delete state.tierEdits[btn.dataset.tier];
        break;
      case 'clear-found':
        delete state.found[id];
        toast('Back to our estimate.');
        break;
      case 'goto-tab':
        state.tab = btn.dataset.tabTarget;
        save();
        renderTabs();
        renderBrowse();
        openStep(5);
        return;
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
        state.confirmed.extras = false;
        save();
        renderAll();
        openStep(4);
        return;
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
      el.closest('.sum-item').classList.toggle('done', el.checked);
      return;
    }
    if (el.matches('select[data-action="swap"]')) {
      swapPart(el.dataset.tier, el.dataset.slot, el.value);
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

  /** Swap one part of a budget package for another option. */
  function swapPart(key, slot, newId) {
    const tier = currentTiers(packages(state.sort)).find((x) => x.key === key);
    if (!tier) return;
    const lists = okLists();
    const p = tier.pkg;
    const next = { travelId: p.travel.id, stayId: p.stay.id, groundId: p.ground ? p.ground.id : 'none' };
    if (slot === 'travel') {
      const travel = byId(lists.travel, newId);
      const ground = P.matchGround(travel, p.ground, lists.grounds, W.airports);
      next.travelId = newId;
      next.groundId = ground ? ground.id : 'none';
    } else if (slot === 'stay') next.stayId = newId;
    else next.groundId = newId;
    state.tierEdits[key] = next;
    save();
    renderOptions();
    const card = document.querySelector(`select[data-tier="${key}"][data-slot="${slot}"]`);
    if (card) card.focus();
    toast('Package updated.');
  }

  function onSubmit(e) {
    const found = e.target.closest('form[data-found]');
    if (found) {
      e.preventDefault();
      const v = Number(found.price.value);
      if (!found.price.value || !(v >= 0)) return toast('Please type a price.');
      state.found[found.dataset.found] = v;
      save();
      renderAll();
      toast('Updated with the price you found.');
      return;
    }
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

  // ---------------------------------------------------------------- steps (one open at a time)
  const STEP_IDS = { 1: 'step-home', 2: 'step-when', 3: 'step-budget', 4: 'step-options', 5: 'step-browse', 6: 'step-mytrip' };

  function stepDone(n) {
    const t = trip();
    const sel = state.selection;
    switch (n) {
      case 1: return !!(state.home || state.origins.length);
      case 2: return state.confirmed.when && P.nights(t.arrive, t.depart) > 0;
      case 3: return state.confirmed.budget;
      case 4: return !!(sel.travelId && sel.stayId);
      case 5: return state.confirmed.extras && stepDone(4);
      default: return false;
    }
  }

  /** Steps open in order: 1-3 one after another, 4 and 5 once 1-3 are done, 6 once a trip is chosen. */
  function stepAvailable(n) {
    if (n <= 1) return true;
    if (n <= 4) return stepDone(n - 1) && stepAvailable(n - 1);
    if (n === 5) return stepDone(1) && stepDone(2) && stepDone(3);
    return stepAvailable(5) && stepDone(4);
  }

  function firstOpenable() {
    for (let n = 1; n <= 6; n++) if (!stepDone(n) && stepAvailable(n)) return n;
    return 6;
  }

  function stepSummary(n) {
    const t = trip();
    const b = budget();
    const sel = selected();
    if (n === 1) {
      const place = state.home ? state.home.label.split(',').slice(0, 2).join(',') : 'Chosen airport';
      return `${place}${state.origins.length ? ` · flying from ${state.origins.join(', ')}` : ''}`;
    }
    if (n === 2) return `${niceDate(t.arrive)} to ${niceDate(t.depart)} · ${plural(t.travelers, 'person', 'people')}${t.groupSize > t.travelers ? `, sharing with ${t.groupSize - t.travelers} more` : ''}`;
    if (n === 3) {
      if (b.total == null) return 'No budget set, so we’ll show everything';
      const caps = [['travel', 'flights'], ['stay', 'stay'], ['ground', 'car']].filter(([k]) => b.caps[k] != null).map(([k, l]) => `${l} up to ${fmt(b.caps[k])}`);
      return `${fmt(b.total)} for the whole trip${caps.length ? ` · ${caps.join(', ')}` : ''}`;
    }
    if (n === 4) {
      if (!sel.travel || !sel.stay) return '';
      return `${travelShort(sel.travel)} · ${sel.stay.name} · ${fmt(P.costBreakdown({ ...sel, activities: [] }, t).total)}`;
    }
    if (n === 5) return sel.activities.length ? `${plural(sel.activities.length, 'thing', 'things')} to do added` : 'No extras added';
    return '';
  }

  function nextControls(n) {
    const t = trip();
    if (n === 1) return stepDone(1) ? `<button type="button" class="btn btn-primary btn-next" data-action="next-step" data-step="1">Continue to dates</button>` : '';
    if (n === 2) {
      return P.nights(t.arrive, t.depart) > 0
        ? `<button type="button" class="btn btn-primary btn-next" data-action="next-step" data-step="2">Continue to budget</button>`
        : '';
    }
    if (n === 3) {
      const b = budget();
      return `<button type="button" class="btn btn-primary btn-next" data-action="next-step" data-step="3">Show my packages</button>
        ${b.total == null ? '<p class="muted">No budget? That’s fine. We’ll show packages from the lowest price up.</p>' : ''}`;
    }
    if (n === 4) {
      return `<div class="btn-row">
        ${stepDone(4) ? '<button type="button" class="btn btn-primary btn-next" data-action="next-step" data-step="4">Continue with my chosen package</button>' : ''}
        <button type="button" class="btn ${stepDone(4) ? 'btn-quiet' : ''}" data-action="build-own">I’d rather pick each part myself</button></div>`;
    }
    if (n === 5) {
      return stepDone(4)
        ? `<button type="button" class="btn btn-primary btn-next" data-action="next-step" data-step="5">Continue to my summary</button>`
        : `<p class="notice warn">To see your summary, choose how you’ll get there and where you’ll stay (use the tabs above), or pick a package in step 4.</p>`;
    }
    return '';
  }

  function renderSteps() {
    for (let n = 1; n <= 6; n++) {
      const sec = document.getElementById(STEP_IDS[n]);
      const open = state.openStep === n;
      const done = stepDone(n);
      const avail = stepAvailable(n);
      sec.classList.toggle('is-open', open);
      sec.classList.toggle('is-done', done && !open);
      sec.classList.toggle('is-locked', !avail);
      $(`#body-${n}`).hidden = !open;
      const btn = sec.querySelector('.step-toggle');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-disabled', String(!avail));
      $(`#sum-${n}`).textContent = !open && done ? stepSummary(n) : !avail ? `Finish step ${firstOpenable()} first` : '';
      $(`#cue-${n}`).textContent = open ? 'Close' : done ? 'Change' : avail ? 'Open' : '';
      $(`#next-${n}`).innerHTML = nextControls(n);
    }
    const quickOpen = !!state.quickOpen;
    $('#body-quick').hidden = !quickOpen;
    $('#quick').classList.toggle('is-open', quickOpen);
    $('#quick .step-toggle').setAttribute('aria-expanded', String(quickOpen));
    $('#cue-quick').textContent = quickOpen ? 'Close' : 'Open';
    $('#browse-lead').textContent = stepDone(4)
      ? 'Your package is in place. Add things to do (optional), or change any part using the tabs.'
      : 'Pick how you’ll get there, where you’ll stay and how you’ll get around. Then add things to do if you like.';
  }

  /** Open one step (closing the others) and bring it into view. */
  function openStep(n, { scroll = true } = {}) {
    if (n === 'quick') {
      state.quickOpen = !state.quickOpen;
      save();
      renderSteps();
      if (state.quickOpen && scroll) $('#quick').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    n = Number(n);
    if (!stepAvailable(n)) {
      toast(`Please finish step ${firstOpenable()} first.`);
      n = firstOpenable();
    }
    state.openStep = n;
    save();
    renderSteps();
    const sec = document.getElementById(STEP_IDS[n]);
    drawMaps(sec);
    if (scroll) {
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sec.querySelector('.step-toggle').focus({ preventScroll: true });
    }
  }

  function nextStep(n) {
    if (n === 2) state.confirmed.when = true;
    if (n === 3) state.confirmed.budget = true;
    if (n === 5) state.confirmed.extras = true;
    save();
    renderAll();
    openStep(n === 4 ? 5 : n + 1);
  }

  // ---------------------------------------------------------------- boot
  function renderAll() {
    renderSteps();
    renderQuick();
    renderHome();
    renderWhen();
    renderBudgetNotes();
    renderOptions();
    renderTabs();
    renderBrowse();
    renderMyTrip();
    renderTripBar();
  }

  $('#share-btn').addEventListener('click', () => {
    const url = location.href.split('#')[0];
    const data = { title: document.title, text: `Book your trip to ${W.couple}’s wedding in ${W.venue.city}:`, url };
    if (navigator.share) navigator.share(data).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied — paste it into a text or email.'));
    else prompt('Copy this link:', url);
  });

  // Draw a package's map when its "Show on a map" section is opened.
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.dataset.mapKey) return;
    if (d.open) {
      openMaps.add(d.dataset.mapKey);
      drawMaps(d);
    } else openMaps.delete(d.dataset.mapKey);
  }, true);

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKeydown);

  if (state.openStep != null && !stepAvailable(state.openStep)) state.openStep = firstOpenable();
  renderHeader();
  applyTextSize();
  fillForms();
  wireForms();
  renderAll();
})();
