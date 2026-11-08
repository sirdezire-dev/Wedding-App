/*
 * Travel — turns a guest's home location into ways of getting to the wedding.
 *   - nearest airports to their address
 *   - estimated flights (direct, 1 stop, 2 stops) to each arrival airport
 *   - a "drive your own car" option when it's close enough
 *   - address lookup (geocoding) using free OpenStreetMap services
 * Fares and times are estimates; guests confirm live prices on booking sites.
 */
(function (root) {
  'use strict';

  const AIRPORTS = root.AIRPORTS || (typeof require !== 'undefined' ? require('../data/airports.js').AIRPORTS : []);
  const HUBS = root.HUBS || (typeof require !== 'undefined' ? require('../data/airports.js').HUBS : {});
  const byCode = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]));

  /** Great-circle distance in miles. */
  function miles(a, b) {
    const R = 3958.8;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const ROAD_FACTOR = 1.25; // roads are longer than a straight line
  const roadMiles = (a, b) => miles(a, b) * ROAD_FACTOR;

  /**
   * Airports a guest could fly from: the closest one, plus any others within
   * `maxMiles`, never more than `limit`. `exclude` = small airports right by the venue.
   */
  function nearestAirports(home, exclude = [], { limit = 3, maxMiles = 90 } = {}) {
    const list = AIRPORTS.filter((a) => !exclude.includes(a.code))
      .map((a) => ({ ...a, distance: miles(home, a) }))
      .sort((a, b) => a.distance - b.distance);
    const near = list.filter((a) => a.distance <= maxMiles).slice(0, limit);
    return near.length ? near : list.slice(0, 1);
  }

  // Which airports fly direct to each arrival airport, and who usually flies it.
  const DIRECT = {
    SLC: (o) => (o.big ? 'Delta' : null),
    DEN: (o) => (o.big ? 'United or Southwest' : null),
    GJT: (o) => ({ DEN: 'United', DFW: 'American', PHX: 'American', SLC: 'Delta', LAS: 'Allegiant' }[o.code] || null),
    CNY: (o) => (o.code === 'DEN' ? 'United' : null),
  };
  // Hubs with direct flights onward to each arrival airport.
  const ONWARD = {
    SLC: ['DEN', 'PHX', 'DFW', 'ATL', 'MSP', 'LAS', 'ORD'],
    DEN: ['ORD', 'DFW', 'ATL', 'PHX', 'LAS', 'MSP', 'SLC'],
    GJT: ['DEN', 'DFW', 'PHX', 'SLC', 'LAS'],
    CNY: ['DEN'],
  };
  const FIRST_HUBS = ['ATL', 'ORD', 'DFW', 'DEN', 'PHX', 'MSP', 'LAS', 'CLT'];
  // Smaller airports cost more to fly into.
  const DEST_PRICE = { SLC: 1.0, DEN: 0.95, GJT: 1.3, CNY: 1.7 };

  function legMinutes(m) {
    return Math.round((m / 460) * 60 + 30); // cruise ~460 mph + taxi/climb
  }

  /** Round-trip fare per person (estimate). */
  function fare(totalMiles, stops, origin, to) {
    let p = 90 + 0.12 * totalMiles;
    p *= DEST_PRICE[to] || 1;
    p *= [1.12, 1.0, 0.85, 0.8][Math.min(stops, 3)];
    if (origin.intl) p *= 1.3;
    return Math.round(p / 5) * 5;
  }

  function route(origin, to, via) {
    const points = [origin, ...via.map((c) => byCode[c]), byCode[to]];
    let total = 0;
    let minutes = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const m = miles(points[i], points[i + 1]);
      total += m;
      minutes += legMinutes(m);
    }
    minutes += via.length * 85; // time to change planes
    return { totalMiles: total, minutes };
  }

  /** Estimated flights from one home airport to one arrival airport. */
  function flightsBetween(origin, to, homeMiles) {
    if (origin.code === to) return [];
    // Too close to bother flying — driving is quicker.
    if (miles(origin, byCode[to]) < 200) return [];
    const out = [];
    const make = (via, carriers) => {
      const r = route(origin, to, via);
      out.push({
        id: `fl-${origin.code}-${to}-${via.join('-') || 'direct'}`,
        kind: 'flight',
        from: origin.code,
        fromCity: origin.city,
        to,
        stops: via.length,
        via,
        viaCities: via.map((c) => byCode[c].city),
        carriers,
        durationMinutes: r.minutes,
        price: fare(r.totalMiles, via.length, origin, to),
        homeMiles: Math.round(homeMiles),
        homeMinutes: Math.round(((homeMiles * ROAD_FACTOR) / 45) * 60),
        estimated: true,
      });
    };

    const direct = DIRECT[to](origin);
    if (direct) make([], direct);

    // Best single connection
    const one = ONWARD[to]
      .filter((h) => h !== origin.code && h !== to)
      .map((h) => ({ h, d: route(origin, to, [h]).totalMiles }))
      .sort((a, b) => a.d - b.d)[0];
    if (one) make([one.h], HUBS[one.h] || 'Several airlines');

    // Best two connections (often the cheapest fares)
    let best = null;
    FIRST_HUBS.forEach((a) =>
      ONWARD[to].forEach((b) => {
        if (a === b || a === origin.code || b === origin.code || a === to || b === to) return;
        const d = route(origin, to, [a, b]).totalMiles;
        if (!best || d < best.d) best = { via: [a, b], d };
      })
    );
    // Only offer it when it isn't a silly detour.
    if (best && (!one || best.d <= one.d * 1.6)) make(best.via, 'Mixed airlines');

    return out;
  }

  /** Estimated flights from each home airport to each arrival airport. */
  function estimateFlights(home, originCodes, arrivalCodes) {
    const out = [];
    originCodes.forEach((code) => {
      const origin = byCode[code];
      if (!origin) return;
      const homeMiles = home ? miles(home, origin) : 0;
      arrivalCodes.forEach((to) => out.push(...flightsBetween(origin, to, homeMiles)));
    });
    return out;
  }

  /**
   * Driving your own car, when the venue is within a long day's drive (~12 hours).
   * Cost = fuel both ways + a motel night each way when it's over ~9 hours.
   */
  function driveOption(home, venue, trip, { fuelPerMile = 0.17, motel = 140, maxMiles = 650 } = {}) {
    if (!home) return null;
    const road = roadMiles(home, venue);
    if (road > maxMiles) return null;
    const hours = road / 55 + Math.floor(road / 250) * 0.25; // breaks
    const overnight = hours > 9;
    const rooms = Math.max(1, Math.ceil((trip.travelers || 1) / 2));
    const cost = road * 2 * fuelPerMile + (overnight ? 2 * motel * rooms : 0);
    return {
      id: 'drive',
      kind: 'drive',
      miles: Math.round(road),
      durationMinutes: Math.round(hours * 60),
      overnight,
      cost: Math.round(cost),
    };
  }

  // ------------------------------------------------------------------ geocoding

  async function fetchJSON(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /** Match a typed city or airport code against our airport list (works offline). */
  function matchAirportText(q) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return AIRPORTS.filter((a) => a.code.toLowerCase() === s || a.city.toLowerCase().includes(s))
      .slice(0, 5)
      .map((a) => ({ label: `${a.city} (${a.code} airport)`, lat: a.lat, lon: a.lon }));
  }

  /**
   * Address -> up to 5 matches [{ label, lat, lon }].
   * Tries OpenStreetMap Nominatim, then Photon, then our own airport list.
   */
  async function geocode(q) {
    const query = q.trim();
    if (!query) return [];
    try {
      const rows = await fetchJSON(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`
      );
      if (rows.length) return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
    } catch (e) {
      /* try the next service */
    }
    try {
      const data = await fetchJSON(`https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`);
      const rows = (data.features || []).map((f) => {
        const p = f.properties || {};
        const label = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street || p.name, p.city, p.state, p.country]
          .filter(Boolean)
          .join(', ');
        return { label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
      });
      if (rows.length) return rows;
    } catch (e) {
      /* fall back to our own list */
    }
    return matchAirportText(query);
  }

  const api = { miles, roadMiles, nearestAirports, estimateFlights, flightsBetween, driveOption, geocode, matchAirportText, byCode };
  root.Travel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
