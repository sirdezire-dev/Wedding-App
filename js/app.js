/*
 * Wedding Travel Planner — UI.
 * Data: data/wedding.js (window.WEDDING). Math: js/planner.js. Links: js/links.js.
 */
(function () {
  'use strict';

  const W = window.WEDDING;
  const P = window.Planner;
  const L = window.Links;
  const STORE_KEY = 'wedding-travel-planner:v1';
  const STAY_TYPES = { hotel: 'Hotel', villa: 'Villa', airbnb: 'Airbnb' };
  const MAX_COMPARE = 4;

  // ---------------------------------------------------------------- state
  const origins = [...new Map(W.flights.map((f) => [f.from, f.fromCity])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  const defaults = {
    tab: 'finder',
    trip: {
      origin: origins.length ? origins[0][0] : 'OTHER',
      originOther: '',
      arrive: W.suggestedArrive,
      depart: W.suggestedDepart,
      travelers: 2,
      groupSize: 2,
      budget: 2500,
    },
    filters: {
      finder: { sort: 'cheapest', maxStops: 2, types: ['hotel', 'villa', 'airbnb'], transport: 'any', show: 10 },
      flights: { maxStops: 2, sort: 'price' },
      stays: { types: ['hotel', 'villa', 'airbnb'], sort: 'price' },
      activities: { sort: 'rating' },
    },
    selection: { flightId: null, stayId: null, carId: null, activityIds: [] },
    saved: [],
    custom: { flights: [], stays: [], cars: [], activities: [] },
  };

  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!raw) return structuredClone(defaults);
      return {
        ...structuredClone(defaults),
        ...raw,
        trip: { ...defaults.trip, ...raw.trip },
        filters: {
          finder: { ...defaults.filters.finder, ...(raw.filters || {}).finder },
          flights: { ...defaults.filters.flights, ...(raw.filters || {}).flights },
          stays: { ...defaults.filters.stays, ...(raw.filters || {}).stays },
          activities: { ...defaults.filters.activities, ...(raw.filters || {}).activities },
        },
        selection: { ...defaults.selection, ...raw.selection },
        custom: { ...defaults.custom, ...raw.custom },
      };
    } catch (e) {
      return structuredClone(defaults);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — the app still works for this visit */
    }
  }

  // ---------------------------------------------------------------- helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: W.currency, maximumFractionDigits: 0 });
  const fmt = (n) => money.format(Math.round(n || 0));
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const dur = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  const niceDate = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  function trip() {
    const t = state.trip;
    return {
      ...t,
      travelers: Math.max(1, Number(t.travelers) || 1),
      groupSize: Math.max(Number(t.groupSize) || 1, Number(t.travelers) || 1),
      budget: Math.max(0, Number(t.budget) || 0),
    };
  }

  function originCode() {
    const t = state.trip;
    return (t.origin === 'OTHER' ? t.originOther : t.origin || '').toUpperCase().trim();
  }

  // Data merged with guest-added options
  const allFlights = () => [...W.flights.filter((f) => f.from === originCode()), ...state.custom.flights];
  const allStays = () => [...W.stays, ...state.custom.stays];
  const allCars = () => [...W.cars, ...state.custom.cars];
  const allActivities = () => [...W.activities, ...state.custom.activities];

  const byId = (list, id) => list.find((x) => x.id === id) || null;

  function selected() {
    const s = state.selection;
    return {
      flight: byId(allFlights(), s.flightId),
      stay: byId(allStays(), s.stayId),
      car: byId(allCars(), s.carId),
      activities: s.activityIds.map((id) => byId(allActivities(), id)).filter(Boolean),
    };
  }

  /** What would the trip total be if `item` replaced the current pick in `slot`? */
  function totalWith(slot, item) {
    const sel = selected();
    if (slot === 'activities') sel.activities = sel.activities.some((a) => a.id === item.id) ? sel.activities : [...sel.activities, item];
    else sel[slot] = item;
    return P.costBreakdown(sel, trip()).total;
  }

  function fitTag(slot, item) {
    const t = trip();
    if (!t.budget) return '';
    const total = totalWith(slot, item);
    return total <= t.budget
      ? `<span class="fit good">✓ Trip stays within budget (${fmt(t.budget - total)} left)</span>`
      : `<span class="fit bad">✕ Puts your trip ${fmt(total - t.budget)} over budget</span>`;
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function airportName(code) {
    const a = W.airports.find((x) => x.code === code);
    return a ? a.name : code;
  }

  function linkButtons(links) {
    return links
      .map((l) => `<a class="btn btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
      .join('');
  }

  // ---------------------------------------------------------------- header + form
  function renderHeader() {
    $('#couple').textContent = W.couple;
    $('#hero-meta').textContent = `${niceDate(W.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${W.venue.name}, ${W.venue.city}`;
    const days = Math.ceil((new Date(`${W.date}T00:00:00`) - new Date()) / 86400000);
    $('#countdown').textContent =
      days > 0 ? `${days} day${days === 1 ? '' : 's'} to go · ${W.venue.region}` : days === 0 ? 'Today’s the day!' : 'Thank you for celebrating with us!';
    $('#footer-tag').textContent = W.hashtag || '';
    document.title = `${W.couple} · Wedding Travel Planner`;
    $('#cur-symbol').textContent = (0).toLocaleString(undefined, { style: 'currency', currency: W.currency }).replace(/[\d.,\s]/g, '') || '$';
  }

  function renderForm() {
    const form = $('#trip-form');
    const sel = $('#origin');
    sel.innerHTML =
      origins.map(([code, city]) => `<option value="${esc(code)}">${esc(city)} (${esc(code)})</option>`).join('') +
      '<option value="OTHER">Somewhere else…</option>';
    const t = state.trip;
    form.origin.value = t.origin;
    form.originOther.value = t.originOther;
    form.arrive.value = t.arrive;
    form.depart.value = t.depart;
    form.travelers.value = t.travelers;
    form.groupSize.value = t.groupSize;
    form.budget.value = t.budget;
    $('#origin-other-wrap').hidden = t.origin !== 'OTHER';

    form.addEventListener('input', (e) => {
      const { name, value } = e.target;
      if (!(name in state.trip)) return;
      state.trip[name] = value;
      if (name === 'travelers' && Number(state.trip.groupSize) < Number(value)) {
        state.trip.groupSize = value;
        form.groupSize.value = value;
      }
      if (name === 'origin') {
        $('#origin-other-wrap').hidden = value !== 'OTHER';
        state.selection.flightId = null;
      }
      if (name === 'originOther') state.selection.flightId = null;
      save();
      renderAll();
    });
  }

  function renderNotes() {
    const t = trip();
    const n = P.nights(t.arrive, t.depart);
    const notes = [];
    if (!n) {
      notes.push(`<div class="note warn">Pick a leave date after your arrival date.</div>`);
    } else {
      notes.push(`<div class="note">🗓 ${n} night${n === 1 ? '' : 's'} · ${niceDate(t.arrive)} → ${niceDate(t.depart)}</div>`);
      notes.push(`<div class="note">⏱ About ${P.freeHours(t, W.date)} free hours for activities</div>`);
      const missed = P.missedEvents(W.events, t);
      if (missed.length)
        notes.push(
          `<div class="note warn">Heads up — your dates miss: ${missed.map((e) => `${esc(e.name)} (${niceDate(e.date)})`).join(', ')}</div>`
        );
      else notes.push(`<div class="note good">✓ You’ll be there for every wedding event</div>`);
    }
    if (t.groupSize > t.travelers)
      notes.push(`<div class="note">👥 Splitting lodging &amp; car with ${t.groupSize - t.travelers} other guest${t.groupSize - t.travelers === 1 ? '' : 's'} — you pay ${Math.round((t.travelers / t.groupSize) * 100)}%</div>`);
    $('#trip-notes').innerHTML = notes.join('');
  }

  // ---------------------------------------------------------------- budget bar
  function renderBudgetBar() {
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown(sel, t);
    const pct = (v) => (Math.max(c.total, t.budget) ? (v / Math.max(c.total, t.budget)) * 100 : 0);
    const left = t.budget - c.total;
    let status;
    if (!c.total) status = `<span class="bb-status">Pick options below — or let us build a trip for you ✨</span>`;
    else if (left >= 0)
      status = `<span class="bb-status ${left < t.budget * 0.1 ? 'warn' : 'good'}">${fmt(left)} left in your budget</span>`;
    else status = `<span class="bb-status bad">${fmt(-left)} over budget</span>`;

    const item = (cls, label, val, picked) =>
      `<span><span class="dot ${cls}"></span>${label} <b>${picked ? fmt(val) : '—'}</b></span>`;

    $('#budget-bar').innerHTML = `
      <div class="bb-top">
        <div class="bb-total">${fmt(c.total)} <small>of ${fmt(t.budget)} budget</small></div>
        ${status}
      </div>
      <div class="meter ${left < 0 ? 'over' : ''}" role="img" aria-label="Budget used">
        <span class="seg-flight" style="width:${pct(c.flight)}%"></span>
        <span class="seg-stay" style="width:${pct(c.stay)}%"></span>
        <span class="seg-car" style="width:${pct(c.car)}%"></span>
        <span class="seg-activities" style="width:${pct(c.activities)}%"></span>
      </div>
      <div class="bb-items">
        ${item('seg-flight', 'Flight', c.flight, sel.flight)}
        ${item('seg-stay', 'Stay', c.stay, sel.stay)}
        ${item('seg-car', 'Transport', c.car, sel.car)}
        ${item('seg-activities', 'Activities', c.activities, sel.activities.length)}
        <div class="bb-actions">
          <button class="btn btn-sm" data-action="clear-trip" ${c.total ? '' : 'disabled'}>Clear</button>
          <button class="btn btn-sm btn-primary" data-action="save-trip" ${c.total ? '' : 'disabled'}>Save to compare</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- tabs
  function renderTabs() {
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    $('#compare-count').textContent = state.saved.length || '';
  }

  const panels = {
    finder: renderFinder,
    flights: renderFlights,
    stays: renderStays,
    cars: renderCars,
    activities: renderActivities,
    compare: renderCompare,
  };

  function renderPanel() {
    $('#panel').innerHTML = panels[state.tab]();
  }

  function chips(group, options, isOn) {
    return `<div class="chips">${options
      .map(([val, label]) => `<button class="chip" data-chip="${group}" data-val="${esc(val)}" aria-pressed="${isOn(val)}">${label}</button>`)
      .join('')}</div>`;
  }

  // ---------------------------------------------------------------- finder
  function renderFinder() {
    const t = trip();
    const f = state.filters.finder;
    const flights = allFlights().filter((x) => x.stops <= f.maxStops);
    const stays = allStays().filter((s) => f.types.includes(s.type));
    const cars = f.transport === 'none' ? [] : allCars();
    const optional = allActivities();

    const toolbar = `
      <div class="toolbar">
        <label>Sort by
          <select data-filter="finder.sort">
            ${[['cheapest', 'Lowest total'], ['mostFun', 'Most activities'], ['rated', 'Best-rated stay'], ['closest', 'Closest to venue'], ['fastest', 'Shortest flight']]
              .map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`)
              .join('')}
          </select>
        </label>
        ${chips('finder.maxStops', [[0, 'Nonstop only'], [1, 'Up to 1 stop'], [2, 'Any stops']], (v) => Number(v) === f.maxStops)}
        ${chips('finder.types', Object.entries(STAY_TYPES).map(([k, v]) => [k, v + 's']), (v) => f.types.includes(v))}
        ${chips('finder.transport', [['any', 'Any transport'], ['none', 'No car needed']], (v) => v === f.transport)}
      </div>`;

    if (!P.nights(t.arrive, t.depart)) return toolbar + `<div class="empty">Choose your arrival and departure dates above to see trips.</div>`;
    if (!flights.length) return toolbar + noFlightsMessage();
    if (!stays.length) return toolbar + `<div class="empty">Turn on at least one type of stay.</div>`;

    const result = P.buildPackages({ flights, stays, cars, activities: optional, trip: t, weddingDate: W.date, sort: f.sort });

    const head = `<p class="summary-line"><b>${result.fits.length}</b> of ${result.count} trip combinations fit your <b>${fmt(t.budget)}</b> budget for ${t.travelers} traveler${t.travelers === 1 ? '' : 's'}, ${P.nights(t.arrive, t.depart)} nights.</p>`;

    if (!result.fits.length) {
      const closest = result.over.slice(0, 3);
      return `${toolbar}${head}
        <div class="empty"><div class="big">💸</div>Nothing fits ${fmt(t.budget)} yet. The cheapest trip for your dates is <b>${fmt(closest[0]?.total)}</b>.<br/>
        Try fewer nights, more stops, sharing a villa/Airbnb with other guests, or skipping the rental car.</div>
        <h3 style="margin:8px 0 12px">Closest options</h3>
        ${closest.map((p) => packageCard(p, t, false)).join('')}`;
    }

    const shown = result.fits.slice(0, f.show);
    return `${toolbar}${head}
      ${shown.map((p, i) => packageCard(p, t, i === 0)).join('')}
      ${result.fits.length > f.show ? `<div style="text-align:center;margin-top:16px"><button class="btn" data-action="more-packages">Show more trips (${result.fits.length - f.show} more)</button></div>` : ''}`;
  }

  function packageCard(p, t, best) {
    const fl = p.flight;
    const extra = p.activityPlan.length
      ? `🌴 With the <b>${fmt(p.leftover)}</b> left you could also do: ${p.activityPlan.map((a) => esc(a.name)).join(' · ')} (${fmt(p.activityPlanCost)})`
      : p.leftover >= 0
        ? `${fmt(p.leftover)} left over for meals &amp; extras`
        : `${fmt(-p.leftover)} over your budget`;
    return `
      <article class="pkg ${best ? 'best' : ''}">
        <div class="pkg-rows">
          ${best ? `<div class="ribbon">Top pick for your sort</div>` : ''}
          <div><span class="ico">✈️</span><span><b>${esc(fl.airline)}</b> ${esc(fl.from)} → ${esc(fl.to)} · ${P.stopsLabel(fl.stops)}${fl.via?.length ? ` via ${esc(fl.via.join(', '))}` : ''} · ${dur(fl.durationMinutes || 0)} — ${fmt(p.cost.flight)}</span></div>
          <div><span class="ico">🏨</span><span><b>${esc(p.stay.name)}</b> · ${STAY_TYPES[p.stay.type] || ''}${p.stay.rating ? ` · ★ ${p.stay.rating}` : ''}${p.stay.minutesToVenue != null ? ` · ${p.stay.minutesToVenue} min to venue` : ''} — ${fmt(p.cost.stay)}</span></div>
          <div><span class="ico">🚗</span><span>${p.car ? `<b>${esc(p.car.company)}</b> ${esc(p.car.name)} — ${fmt(p.cost.car)}` : 'No car — taxis / walk (budget a little extra)'}</span></div>
        </div>
        <div class="pkg-side">
          <span class="total">${fmt(p.total)}</span>
          <small class="muted">for ${t.travelers} · ${P.nights(t.arrive, t.depart)} nights</small>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn btn-sm" data-action="save-package" data-id="${esc(p.id)}">Save to compare</button>
            <button class="btn btn-sm btn-primary" data-action="use-package" data-id="${esc(p.id)}">Use this trip</button>
          </div>
        </div>
        <div class="pkg-extra ${p.activityPlan.length ? '' : 'none'}">${extra}</div>
      </article>`;
  }

  function findPackage(id) {
    const [fid, sid, cid] = id.split('|');
    return {
      flight: byId(allFlights(), fid),
      stay: byId(allStays(), sid),
      car: cid === 'none' ? null : byId(allCars(), cid),
    };
  }

  function packageActivities(pkg) {
    const t = trip();
    const c = P.costBreakdown(pkg, t);
    return P.bestActivityPlan(allActivities(), t, t.budget - c.total, P.freeHours(t, W.date));
  }

  function noFlightsMessage() {
    const code = originCode();
    return `<div class="empty"><div class="big">✈️</div>
      ${code ? `We don’t have sample fares from <b>${esc(code)}</b> yet.` : 'Enter your home airport code above.'}<br/>
      Search live prices below, then add the flight you like under <b>Flights → Add a flight you found</b> and we’ll build trips around it.
      ${code ? `<div class="links" style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${linkButtons(
        L.flightLinks({ from: code, to: W.airports[0].code, arrive: trip().arrive, depart: trip().depart, travelers: trip().travelers, maxStops: 2 })
      )}</div>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------- flights
  function renderFlights() {
    const t = trip();
    const f = state.filters.flights;
    const sorts = {
      price: (a, b) => a.price - b.price,
      duration: (a, b) => a.durationMinutes - b.durationMinutes,
      depart: (a, b) => String(a.departTime).localeCompare(String(b.departTime)),
    };
    const list = allFlights().filter((x) => x.stops <= f.maxStops).sort(sorts[f.sort] || sorts.price);
    const code = originCode();

    const toolbar = `
      <div class="toolbar">
        ${chips('flights.maxStops', [[0, 'Nonstop only'], [1, 'Up to 1 stop'], [2, 'Any number of stops']], (v) => Number(v) === f.maxStops)}
        <label>Sort by
          <select data-filter="flights.sort">
            ${[['price', 'Lowest price'], ['duration', 'Shortest travel time'], ['depart', 'Departure time']]
              .map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>`;

    const cards = list.length
      ? `<div class="grid">${list.map((fl) => flightCard(fl, t)).join('')}</div>`
      : noFlightsMessage();

    const live = code
      ? W.airports
          .map(
            (a) => `<div style="margin-bottom:10px"><p style="margin:0 0 6px"><b>${esc(code)} → ${esc(a.code)}</b> · ${esc(a.name)} (${a.minutesToVenue} min to venue)</p>
            <div class="links">${linkButtons(L.flightLinks({ from: code, to: a.code, arrive: t.arrive, depart: t.depart, travelers: t.travelers, maxStops: f.maxStops }))}</div></div>`
          )
          .join('')
      : '<p>Enter your airport code above to get live search links.</p>';

    return `${toolbar}${cards}
      <div class="live"><h3>🔎 Search live fares</h3><p>Opens each site with your airports, dates and party size filled in${f.maxStops === 0 ? ' (nonstop only)' : ''}.</p>${live}</div>
      ${addOwnForm('flight', 'Add a flight you found', `
        <label>Airline<input name="airline" required placeholder="e.g. Delta" /></label>
        <label>From<input name="from" required maxlength="4" value="${esc(code)}" /></label>
        <label>To<select name="to">${W.airports.map((a) => `<option>${esc(a.code)}</option>`).join('')}</select></label>
        <label>Stops<select name="stops"><option value="0">Nonstop</option><option value="1">1 stop</option><option value="2">2 stops</option><option value="3">3+ stops</option></select></label>
        <label>Connects in<input name="via" placeholder="e.g. ATL, MIA" /></label>
        <label>Travel time (hours)<input name="hours" type="number" step="0.25" min="0" required /></label>
        <label>Round-trip price per person<input name="price" type="number" min="0" required /></label>
        <label>Link (optional)<input name="url" type="url" placeholder="https://" /></label>`)}`;
  }

  function flightCard(fl, t) {
    const isSel = state.selection.flightId === fl.id;
    return `
      <article class="opt ${isSel ? 'is-selected' : ''}">
        <div class="opt-head">
          <div>
            <h3>${esc(fl.airline)}</h3>
            <div class="sub">${fl.departTime ? `Departs ${esc(fl.departTime)} · ` : ''}round trip</div>
          </div>
          <div class="price"><b>${fmt(P.flightCost(fl, t))}</b><small>${fmt(fl.price)} × ${t.travelers}</small></div>
        </div>
        <div class="route">${esc(fl.from)}<span class="line">${(fl.via || []).map((_, i, a) => `<i style="left:${((i + 1) / (a.length + 1)) * 100}%"></i>`).join('')}</span>${esc(fl.to)}</div>
        <div class="tags">
          <span class="tag ${fl.stops === 0 ? 'nonstop' : ''}">${P.stopsLabel(fl.stops)}${fl.via?.length ? ` · ${esc(fl.via.join(', '))}` : ''}</span>
          <span class="tag">${dur(fl.durationMinutes || 0)}</span>
          <span class="tag">${esc(airportName(fl.to))}</span>
          ${fl.custom ? '<span class="tag custom">Added by you</span>' : ''}
        </div>
        ${fitTag('flight', fl)}
        <div class="opt-actions">
          <button class="btn btn-sm ${isSel ? 'is-selected' : 'btn-primary'}" data-action="pick" data-slot="flight" data-id="${esc(fl.id)}">${isSel ? '✓ Selected' : 'Choose flight'}</button>
          ${safeUrl(fl.url) ? `<a class="btn btn-sm" href="${esc(fl.url)}" target="_blank" rel="noopener">Book ↗</a>` : ''}
          ${fl.custom ? `<button class="btn btn-sm btn-ghost" data-action="remove-custom" data-kind="flights" data-id="${esc(fl.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- stays
  function renderStays() {
    const t = trip();
    const f = state.filters.stays;
    const sorts = {
      price: (a, b) => P.stayCost(a, t) - P.stayCost(b, t),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      distance: (a, b) => (a.minutesToVenue ?? 999) - (b.minutesToVenue ?? 999),
    };
    const list = allStays().filter((s) => f.types.includes(s.type)).sort(sorts[f.sort] || sorts.price);

    const toolbar = `
      <div class="toolbar">
        ${chips('stays.types', Object.entries(STAY_TYPES).map(([k, v]) => [k, v + 's']), (v) => f.types.includes(v))}
        <label>Sort by
          <select data-filter="stays.sort">
            ${[['price', 'Lowest total for my trip'], ['rating', 'Highest rated'], ['distance', 'Closest to venue']]
              .map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>`;

    return `${toolbar}
      ${list.length ? `<div class="grid">${list.map((s) => stayCard(s, t)).join('')}</div>` : '<div class="empty">Turn on at least one type of stay.</div>'}
      <div class="live"><h3>🔎 Search more places to stay</h3><p>Opens with ${esc(W.venue.searchName)}, your dates and party size filled in.</p>
        <div class="links">${linkButtons(L.stayLinks({ place: W.venue.searchName, arrive: t.arrive, depart: t.depart, travelers: t.groupSize }))}</div></div>
      ${addOwnForm('stay', 'Add a hotel, villa or Airbnb you found', `
        <label>Name<input name="name" required /></label>
        <label>Type<select name="type">${Object.entries(STAY_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Price per night<input name="nightly" type="number" min="0" required /></label>
        <label>Sleeps (per room/home)<input name="maxGuests" type="number" min="1" value="2" required /></label>
        <label>Cleaning/one-time fee<input name="cleaningFee" type="number" min="0" value="0" /></label>
        <label>Taxes %<input name="taxPct" type="number" min="0" max="50" value="16" /></label>
        <label>Minutes to venue<input name="minutesToVenue" type="number" min="0" /></label>
        <label>Link (optional)<input name="url" type="url" placeholder="https://" /></label>`)}`;
  }

  function stayCard(s, t) {
    const isSel = state.selection.stayId === s.id;
    const n = P.nights(t.arrive, t.depart);
    const units = P.unitsNeeded(s, t);
    const unitWord = s.type === 'hotel' ? 'room' : 'home';
    const shareNote = t.groupSize > t.travelers ? ` · your share for ${t.travelers} of ${t.groupSize}` : '';
    return `
      <article class="opt ${isSel ? 'is-selected' : ''}">
        <div class="opt-head">
          <div>
            <h3>${esc(s.name)}</h3>
            <div class="sub">${s.rating ? `★ ${s.rating} · ` : ''}${s.minutesToVenue != null ? `${s.minutesToVenue} min to venue · ` : ''}sleeps ${s.maxGuests}/${unitWord}</div>
          </div>
          <div class="price"><b>${fmt(P.stayCost(s, t))}</b><small>${fmt(s.nightly)}/night</small></div>
        </div>
        <div class="tags">
          <span class="tag type-${esc(s.type)}">${STAY_TYPES[s.type] || esc(s.type)}</span>
          ${(s.amenities || []).map((a) => `<span class="tag">${esc(a)}</span>`).join('')}
          ${s.custom ? '<span class="tag custom">Added by you</span>' : ''}
        </div>
        ${s.perk ? `<div class="perk">💍 ${esc(s.perk)}</div>` : ''}
        <div class="sub">${n} night${n === 1 ? '' : 's'} × ${units} ${unitWord}${units === 1 ? '' : 's'}${s.cleaningFee ? ` + ${fmt(s.cleaningFee * units)} fees` : ''}${s.taxRate ? ` + ${Math.round(s.taxRate * 100)}% tax` : ''}${shareNote}</div>
        ${fitTag('stay', s)}
        <div class="opt-actions">
          <button class="btn btn-sm ${isSel ? 'is-selected' : 'btn-primary'}" data-action="pick" data-slot="stay" data-id="${esc(s.id)}">${isSel ? '✓ Selected' : 'Choose stay'}</button>
          ${safeUrl(s.url) ? `<a class="btn btn-sm" href="${esc(s.url)}" target="_blank" rel="noopener">Book ↗</a>` : ''}
          ${s.custom ? `<button class="btn btn-sm btn-ghost" data-action="remove-custom" data-kind="stays" data-id="${esc(s.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- cars
  function renderCars() {
    const t = trip();
    const list = [...allCars()].sort((a, b) => P.carCost(a, t) - P.carCost(b, t));
    return `
      <p class="summary-line muted">Venue is ${W.airports.map((a) => `${a.minutesToVenue} min from ${esc(a.code)}`).join(' and ')}. Rental prices include required local insurance.</p>
      <div class="grid">${list.map((c) => carCard(c, t)).join('')}</div>
      <div class="live"><h3>🔎 Search live rental prices</h3><p>Pick-up and drop-off on your travel dates.</p>
        ${W.airports.map((a) => `<p style="margin:0 0 6px"><b>${esc(a.code)}</b> · ${esc(a.name)}</p><div class="links" style="margin-bottom:10px">${linkButtons(L.carLinks({ airport: a.code, arrive: t.arrive, depart: t.depart }))}</div>`).join('')}
      </div>
      ${addOwnForm('car', 'Add a car or transfer you found', `
        <label>Company<input name="company" required /></label>
        <label>Car / service<input name="name" required placeholder="e.g. Midsize SUV" /></label>
        <label>Pricing<select name="pricing"><option value="daily">Per day</option><option value="flat">Flat, whole trip</option><option value="perPerson">Per person</option></select></label>
        <label>Price<input name="price" type="number" min="0" required /></label>
        <label>Seats<input name="seats" type="number" min="1" value="5" /></label>
        <label>Link (optional)<input name="url" type="url" placeholder="https://" /></label>`)}`;
  }

  function carCard(c, t) {
    const isSel = state.selection.carId === c.id;
    const n = Math.max(1, P.nights(t.arrive, t.depart));
    const detail =
      c.pricing === 'perPerson'
        ? `${fmt(c.price)} per person`
        : c.pricing === 'flat'
          ? `${fmt(c.price)} per vehicle, whole trip`
          : `${fmt(c.daily)}/day${c.insuranceDaily ? ` + ${fmt(c.insuranceDaily)} insurance` : ''} × ${n} days`;
    return `
      <article class="opt ${isSel ? 'is-selected' : ''}">
        <div class="opt-head">
          <div><h3>${esc(c.name)}</h3><div class="sub">${esc(c.company)} · ${esc(c.pickup || '')}</div></div>
          <div class="price"><b>${fmt(P.carCost(c, t))}</b><small>your cost</small></div>
        </div>
        <div class="tags">
          <span class="tag">${c.pricing === 'daily' ? 'Rental car' : 'Transfer / shuttle'}</span>
          <span class="tag">Seats ${c.seats}</span>
          ${c.custom ? '<span class="tag custom">Added by you</span>' : ''}
        </div>
        <div class="sub">${detail}</div>
        ${c.note ? `<div class="perk">💍 ${esc(c.note)}</div>` : ''}
        ${fitTag('car', c)}
        <div class="opt-actions">
          <button class="btn btn-sm ${isSel ? 'is-selected' : 'btn-primary'}" data-action="pick" data-slot="car" data-id="${esc(c.id)}">${isSel ? '✓ Selected' : 'Choose'}</button>
          ${safeUrl(c.url) ? `<a class="btn btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">Book ↗</a>` : ''}
          ${c.custom ? `<button class="btn btn-sm btn-ghost" data-action="remove-custom" data-kind="cars" data-id="${esc(c.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- activities
  function renderActivities() {
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown({ ...sel, activities: [] }, t);
    const moneyLeft = t.budget - c.total;
    const hours = P.freeHours(t, W.date);
    const usedHours = sel.activities.reduce((s, a) => s + (a.durationHours || 0), 0);
    const f = state.filters.activities;
    const sorts = {
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      price: (a, b) => a.price - b.price,
      time: (a, b) => a.durationHours - b.durationHours,
    };
    const list = [...allActivities()].sort(sorts[f.sort] || sorts.rating);
    const plan = P.bestActivityPlan(allActivities(), t, Math.max(0, moneyLeft), hours);

    const itinerary = W.events
      .map((e) => `<li><span class="d">${niceDate(e.date)} · ${esc(e.time)}</span><span><b>${esc(e.name)}</b> — ${esc(e.place)}</span></li>`)
      .join('');

    return `
      <div class="mytrip">
        <div>
          <h3>💍 Wedding weekend</h3>
          <ul class="itinerary">${itinerary}</ul>
        </div>
        <div>
          <h3>Your free time &amp; money</h3>
          <p style="margin:0 0 8px">After your flight, stay and transport you have <b>${fmt(moneyLeft)}</b> and about <b>${hours} free hours</b>${usedHours ? ` (${usedHours}h planned)` : ''}.</p>
          ${
            moneyLeft <= 0
              ? '<p class="muted">Your current picks use the whole budget. Free things: the beach, the town square, and every wedding event!</p>'
              : plan.length
                ? `<p class="muted" style="margin:0 0 8px">Most you can fit: <b>${plan.length} activities</b> for ${fmt(plan.reduce((s, a) => s + P.activityCost(a, t), 0))}</p>
                   <button class="btn btn-sm btn-primary" data-action="use-plan">Add all ${plan.length} to my trip</button>`
                : '<p class="muted">Nothing paid fits what’s left — the beach is free!</p>'
          }
        </div>
      </div>
      <div class="toolbar">
        <label>Sort by
          <select data-filter="activities.sort">
            ${[['rating', 'Top rated'], ['price', 'Lowest price'], ['time', 'Shortest']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="grid">${list.map((a) => activityCard(a, t, moneyLeft, hours - usedHours)).join('')}</div>
      <div class="live"><h3>🔎 Find more things to do</h3><p>Tours and experiences in ${esc(W.venue.city)}.</p>
        <div class="links">${linkButtons(L.activityLinks({ place: W.venue.searchName }))}</div></div>
      ${addOwnForm('activity', 'Add an activity you found', `
        <label>Name<input name="name" required /></label>
        <label>Price per person<input name="price" type="number" min="0" required /></label>
        <label>Hours<input name="durationHours" type="number" min="0.5" step="0.5" required /></label>
        <label>Link (optional)<input name="url" type="url" placeholder="https://" /></label>`)}`;
  }

  function activityCard(a, t, moneyLeft, hoursLeft) {
    const isSel = state.selection.activityIds.includes(a.id);
    const cost = P.activityCost(a, t);
    const afford = isSel || cost <= moneyLeft - P.costBreakdown({ activities: selected().activities }, t).activities;
    const time = isSel || a.durationHours <= hoursLeft;
    return `
      <article class="opt ${isSel ? 'is-selected' : ''}">
        <div class="opt-head">
          <div><h3>${esc(a.name)}</h3><div class="sub">${esc(a.category || 'Activity')}${a.rating ? ` · ★ ${a.rating}` : ''} · ${a.durationHours}h</div></div>
          <div class="price"><b>${fmt(cost)}</b><small>${fmt(a.price)} × ${t.travelers}</small></div>
        </div>
        <div class="tags">${a.custom ? '<span class="tag custom">Added by you</span>' : ''}</div>
        ${isSel ? '' : `<span class="fit ${afford && time ? 'good' : 'bad'}">${afford ? (time ? '✓ Fits your budget and schedule' : '✕ Not enough free time left') : '✕ Over what’s left in your budget'}</span>`}
        <div class="opt-actions">
          <button class="btn btn-sm ${isSel ? 'is-selected' : 'btn-primary'}" data-action="toggle-activity" data-id="${esc(a.id)}">${isSel ? '✓ In my trip' : 'Add to trip'}</button>
          ${safeUrl(a.url) ? `<a class="btn btn-sm" href="${esc(a.url)}" target="_blank" rel="noopener">Book ↗</a>` : ''}
          ${a.custom ? `<button class="btn btn-sm btn-ghost" data-action="remove-custom" data-kind="activities" data-id="${esc(a.id)}">Remove</button>` : ''}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- add-your-own
  function addOwnForm(kind, title, fields) {
    return `<details class="add-own"><summary>➕ ${esc(title)}</summary>
      <form class="inline-form" data-add="${kind}">${fields}<button class="btn btn-primary" type="submit">Add</button></form>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Saved only on this device. It’ll show up in your options and the budget finder.</p></details>`;
  }

  function onAddSubmit(form) {
    const d = Object.fromEntries(new FormData(form).entries());
    const num = (v) => Number(v) || 0;
    const kind = form.dataset.add;
    const url = safeUrl(d.url);
    let item;
    if (kind === 'flight') {
      const stops = num(d.stops);
      item = {
        id: uid('cf'), custom: true, airline: d.airline.trim(), from: d.from.toUpperCase().trim(), to: d.to,
        stops, via: d.via ? d.via.split(/[,\s]+/).filter(Boolean).map((x) => x.toUpperCase()) : [],
        durationMinutes: Math.round(num(d.hours) * 60), price: num(d.price), url,
      };
      state.custom.flights.push(item);
      state.selection.flightId = item.id;
    } else if (kind === 'stay') {
      item = {
        id: uid('cs'), custom: true, name: d.name.trim(), type: d.type, nightly: num(d.nightly),
        maxGuests: Math.max(1, num(d.maxGuests)), cleaningFee: num(d.cleaningFee), taxRate: num(d.taxPct) / 100,
        minutesToVenue: d.minutesToVenue === '' ? null : num(d.minutesToVenue), url, amenities: [],
      };
      state.custom.stays.push(item);
      state.selection.stayId = item.id;
    } else if (kind === 'car') {
      item = {
        id: uid('cc'), custom: true, company: d.company.trim(), name: d.name.trim(), pricing: d.pricing,
        seats: Math.max(1, num(d.seats)), url,
        ...(d.pricing === 'daily' ? { daily: num(d.price) } : { price: num(d.price) }),
      };
      state.custom.cars.push(item);
      state.selection.carId = item.id;
    } else if (kind === 'activity') {
      item = { id: uid('ca'), custom: true, name: d.name.trim(), category: 'Your find', price: num(d.price), durationHours: num(d.durationHours), url };
      state.custom.activities.push(item);
      state.selection.activityIds.push(item.id);
    }
    save();
    renderAll();
    toast('Added and selected for your trip');
  }

  // ---------------------------------------------------------------- compare
  function snapshot(name, sel) {
    const t = trip();
    const c = P.costBreakdown(sel, t);
    return {
      id: uid('trip'),
      name,
      createdAt: Date.now(),
      trip: { ...t, origin: originCode() },
      items: structuredClone({ flight: sel.flight, stay: sel.stay, car: sel.car, activities: sel.activities }),
      cost: c,
    };
  }

  function saveTrip(sel, name) {
    if (state.saved.length >= MAX_COMPARE) {
      toast(`You can compare up to ${MAX_COMPARE} trips — remove one first`);
      state.tab = 'compare';
      renderAll();
      return;
    }
    state.saved.push(snapshot(name || `Trip ${String.fromCharCode(65 + state.saved.length)}`, sel));
    save();
    renderAll();
    toast('Saved — see it under “Compare trips”');
  }

  function renderCompare() {
    const t = trip();
    const sel = selected();
    const cur = P.costBreakdown(sel, t);
    const missed = P.missedEvents(W.events, t);

    const current = `
      <div class="mytrip">
        <div>
          <h3>Your current trip</h3>
          <ul class="itinerary">
            <li><span class="d">${niceDate(t.arrive)}</span><span>${sel.flight ? `✈️ ${esc(sel.flight.airline)} ${esc(sel.flight.from)} → ${esc(sel.flight.to)} (${P.stopsLabel(sel.flight.stops)})` : '✈️ <span class="muted">No flight chosen</span>'}</span></li>
            <li><span class="d">${P.nights(t.arrive, t.depart)} nights</span><span>${sel.stay ? `🏨 ${esc(sel.stay.name)}` : '🏨 <span class="muted">No stay chosen</span>'}</span></li>
            <li><span class="d">Getting around</span><span>${sel.car ? `🚗 ${esc(sel.car.company)} — ${esc(sel.car.name)}` : '🚗 <span class="muted">No car / transfer</span>'}</span></li>
            ${W.events.filter((e) => !missed.includes(e)).map((e) => `<li><span class="d">${niceDate(e.date)}</span><span>💍 ${esc(e.name)} · ${esc(e.time)}</span></li>`).join('')}
            ${sel.activities.map((a) => `<li><span class="d">Anytime</span><span>🌴 ${esc(a.name)}</span></li>`).join('')}
            <li><span class="d">${niceDate(t.depart)}</span><span>🏠 Head home</span></li>
          </ul>
        </div>
        <div>
          <h3>${fmt(cur.total)} <small class="muted" style="font:500 14px var(--sans)">of ${fmt(t.budget)}</small></h3>
          <p class="muted" style="margin-top:0">${cur.total <= t.budget ? `${fmt(t.budget - cur.total)} left for meals, tips &amp; souvenirs` : `${fmt(cur.total - t.budget)} over budget`}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" data-action="save-trip" ${cur.total ? '' : 'disabled'}>Save to compare</button>
            <button class="btn" data-action="copy-summary" ${cur.total ? '' : 'disabled'}>Copy trip summary</button>
          </div>
        </div>
      </div>`;

    if (!state.saved.length) {
      return `${current}<div class="empty"><div class="big">⚖️</div>No saved trips yet.<br/>Build a trip, or tap <b>Save to compare</b> on any option in “What fits my budget”, then compare up to ${MAX_COMPARE} side by side.</div>`;
    }

    const trips = state.saved;
    const min = (fn) => Math.min(...trips.map(fn));
    const max = (fn) => Math.max(...trips.map(fn));
    const win = (val, best) => (trips.length > 1 && val === best ? 'win' : '');
    const total = (x) => x.cost.total;
    const flightMin = (x) => (x.items.flight ? x.items.flight.durationMinutes : Infinity);
    const stops = (x) => (x.items.flight ? x.items.flight.stops : Infinity);
    const venue = (x) => x.items.stay?.minutesToVenue ?? Infinity;
    const rating = (x) => x.items.stay?.rating || 0;
    const left = (x) => x.trip.budget - x.cost.total;

    const row = (label, cell) => `<tr><th scope="row">${label}</th>${trips.map(cell).join('')}</tr>`;
    const td = (content, cls = '') => `<td class="${cls}">${content}</td>`;

    return `${current}
      <h3 style="font-size:24px;margin-bottom:12px">Side-by-side</h3>
      <div class="compare-wrap"><table class="compare">
        <thead><tr><th></th>${trips
          .map(
            (x) => `<th><div class="col-name">${esc(x.name)}</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="btn btn-sm" data-action="load-saved" data-id="${x.id}">Use</button>
              <button class="btn btn-sm btn-ghost" data-action="rename-saved" data-id="${x.id}">Rename</button>
              <button class="btn btn-sm btn-ghost" data-action="remove-saved" data-id="${x.id}">✕</button>
            </div></th>`
          )
          .join('')}</tr></thead>
        <tbody>
          ${row('Dates', (x) => td(`${niceDate(x.trip.arrive)} → ${niceDate(x.trip.depart)}<br/><span class="muted">${P.nights(x.trip.arrive, x.trip.depart)} nights · ${x.trip.travelers} traveler${x.trip.travelers === 1 ? '' : 's'}</span>`))}
          ${row('Flight', (x) => td(x.items.flight ? `${esc(x.items.flight.airline)} · ${esc(x.items.flight.from)} → ${esc(x.items.flight.to)}` : '—'))}
          ${row('Stops', (x) => td(x.items.flight ? P.stopsLabel(x.items.flight.stops) : '—', win(stops(x), min(stops))))}
          ${row('Travel time', (x) => td(x.items.flight ? dur(x.items.flight.durationMinutes) : '—', win(flightMin(x), min(flightMin))))}
          ${row('Flight cost', (x) => td(fmt(x.cost.flight), win(x.cost.flight, min((y) => y.cost.flight))))}
          ${row('Stay', (x) => td(x.items.stay ? `${esc(x.items.stay.name)}<br/><span class="muted">${STAY_TYPES[x.items.stay.type] || ''}</span>` : '—'))}
          ${row('Rating', (x) => td(x.items.stay?.rating ? `★ ${x.items.stay.rating}` : '—', win(rating(x), max(rating))))}
          ${row('To venue', (x) => td(x.items.stay?.minutesToVenue != null ? `${x.items.stay.minutesToVenue} min` : '—', win(venue(x), min(venue))))}
          ${row('Lodging cost', (x) => td(fmt(x.cost.stay), win(x.cost.stay, min((y) => y.cost.stay))))}
          ${row('Transport', (x) => td(x.items.car ? `${esc(x.items.car.company)} — ${esc(x.items.car.name)}<br/>${fmt(x.cost.car)}` : `None<br/>${fmt(0)}`))}
          ${row('Activities', (x) => td(x.items.activities.length ? `${x.items.activities.map((a) => esc(a.name)).join(', ')}<br/>${fmt(x.cost.activities)}` : '—'))}
          <tr class="total"><th scope="row">Total</th>${trips.map((x) => td(fmt(x.cost.total), win(total(x), min(total)))).join('')}</tr>
          ${row('vs. budget', (x) => td(left(x) >= 0 ? `<span class="fit good">${fmt(left(x))} under</span>` : `<span class="fit bad">${fmt(-left(x))} over</span>`, win(left(x), max(left))))}
        </tbody>
      </table></div>
      <p class="muted" style="font-size:13px">Green = best in that row.</p>`;
  }

  function summaryText() {
    const t = trip();
    const sel = selected();
    const c = P.costBreakdown(sel, t);
    const lines = [
      `My trip to ${W.couple}'s wedding 💍`,
      `${niceDate(t.arrive)} → ${niceDate(t.depart)} (${P.nights(t.arrive, t.depart)} nights, ${t.travelers} traveler${t.travelers === 1 ? '' : 's'})`,
      sel.flight ? `✈️ ${sel.flight.airline} ${sel.flight.from}→${sel.flight.to}, ${P.stopsLabel(sel.flight.stops)} — ${fmt(c.flight)}` : null,
      sel.stay ? `🏨 ${sel.stay.name} — ${fmt(c.stay)}` : null,
      sel.car ? `🚗 ${sel.car.company} ${sel.car.name} — ${fmt(c.car)}` : null,
      sel.activities.length ? `🌴 ${sel.activities.map((a) => a.name).join(', ')} — ${fmt(c.activities)}` : null,
      `Total: ${fmt(c.total)} (budget ${fmt(t.budget)})`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      state.tab = tabBtn.dataset.tab;
      save();
      renderTabs();
      renderPanel();
      return;
    }

    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const [scope, key] = chip.dataset.chip.split('.');
      const f = state.filters[scope];
      const val = chip.dataset.val;
      if (Array.isArray(f[key])) {
        f[key] = f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val];
      } else {
        f[key] = key === 'maxStops' ? Number(val) : val;
      }
      if (scope === 'finder') f.show = defaults.filters.finder.show;
      save();
      renderPanel();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const s = state.selection;

    switch (action) {
      case 'pick': {
        const key = `${btn.dataset.slot}Id`;
        s[key] = s[key] === id ? null : id;
        break;
      }
      case 'toggle-activity':
        s.activityIds = s.activityIds.includes(id) ? s.activityIds.filter((x) => x !== id) : [...s.activityIds, id];
        break;
      case 'use-plan': {
        const t = trip();
        const c = P.costBreakdown({ ...selected(), activities: [] }, t);
        s.activityIds = P.bestActivityPlan(allActivities(), t, t.budget - c.total, P.freeHours(t, W.date)).map((a) => a.id);
        toast('Activities added to your trip');
        break;
      }
      case 'use-package': {
        const pkg = findPackage(id);
        s.flightId = pkg.flight?.id || null;
        s.stayId = pkg.stay?.id || null;
        s.carId = pkg.car?.id || null;
        s.activityIds = packageActivities(pkg).map((a) => a.id);
        toast('Trip loaded — check the budget bar');
        $('#budget-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'save-package': {
        const pkg = findPackage(id);
        saveTrip({ ...pkg, activities: packageActivities(pkg) });
        return;
      }
      case 'more-packages':
        state.filters.finder.show += 10;
        break;
      case 'save-trip':
        saveTrip(selected());
        return;
      case 'clear-trip':
        state.selection = structuredClone(defaults.selection);
        break;
      case 'remove-custom': {
        const kind = btn.dataset.kind;
        state.custom[kind] = state.custom[kind].filter((x) => x.id !== id);
        if (s.flightId === id) s.flightId = null;
        if (s.stayId === id) s.stayId = null;
        if (s.carId === id) s.carId = null;
        s.activityIds = s.activityIds.filter((x) => x !== id);
        break;
      }
      case 'remove-saved':
        state.saved = state.saved.filter((x) => x.id !== id);
        break;
      case 'rename-saved': {
        const tripRec = state.saved.find((x) => x.id === id);
        const name = prompt('Name this trip', tripRec.name);
        if (name && name.trim()) tripRec.name = name.trim().slice(0, 40);
        break;
      }
      case 'load-saved': {
        const rec = state.saved.find((x) => x.id === id);
        // Restore custom items that may have been removed since saving.
        ['flight', 'stay', 'car'].forEach((k) => {
          const item = rec.items[k];
          const listKey = { flight: 'flights', stay: 'stays', car: 'cars' }[k];
          if (item && item.custom && !state.custom[listKey].some((x) => x.id === item.id)) state.custom[listKey].push(item);
        });
        rec.items.activities.forEach((a) => {
          if (a.custom && !state.custom.activities.some((x) => x.id === a.id)) state.custom.activities.push(a);
        });
        const { origin, arrive, depart, travelers, groupSize, budget } = rec.trip;
        const isListed = origins.some(([code]) => code === origin);
        state.trip = { ...state.trip, origin: isListed ? origin : 'OTHER', originOther: isListed ? '' : origin, arrive, depart, travelers, groupSize, budget };
        s.flightId = rec.items.flight?.id || null;
        s.stayId = rec.items.stay?.id || null;
        s.carId = rec.items.car?.id || null;
        s.activityIds = rec.items.activities.map((a) => a.id);
        save();
        syncForm();
        renderAll();
        toast(`Loaded “${rec.name}”`);
        return;
      }
      case 'copy-summary': {
        const text = summaryText();
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(() => toast('Trip summary copied — paste it anywhere'))
          .catch(() => prompt('Copy your trip summary:', text));
        return;
      }
      default:
        return;
    }
    save();
    renderAll();
  }

  function onChange(e) {
    const sel = e.target.closest('[data-filter]');
    if (!sel) return;
    const [scope, key] = sel.dataset.filter.split('.');
    state.filters[scope][key] = sel.value;
    if (scope === 'finder') state.filters.finder.show = defaults.filters.finder.show;
    save();
    renderPanel();
  }

  function onSubmit(e) {
    const form = e.target.closest('form[data-add]');
    if (!form) return;
    e.preventDefault();
    onAddSubmit(form);
  }

  function syncForm() {
    const form = $('#trip-form');
    const t = state.trip;
    form.origin.value = t.origin;
    form.originOther.value = t.originOther;
    form.arrive.value = t.arrive;
    form.depart.value = t.depart;
    form.travelers.value = t.travelers;
    form.groupSize.value = t.groupSize;
    form.budget.value = t.budget;
    $('#origin-other-wrap').hidden = t.origin !== 'OTHER';
  }

  // ---------------------------------------------------------------- boot
  function renderAll() {
    renderNotes();
    renderBudgetBar();
    renderTabs();
    renderPanel();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('submit', onSubmit);

  renderHeader();
  renderForm();
  renderAll();
})();
