/*
 * TripMap — draws a guest's journey on an OpenStreetMap map (via Leaflet).
 * route = {
 *   points: [{ lat, lon, label, kind: 'home'|'airport'|'connection'|'stay'|'venue' }],
 *   legs:   [{ from, to, mode: 'fly'|'drive' }]   // indexes into points
 * }
 * If Leaflet couldn't load (offline), the caller's written steps still show.
 */
(function (root) {
  'use strict';

  const COLORS = { fly: '#9a4a2c', drive: '#4f6a55' };
  const DOT = {
    home: { color: '#2a211c', radius: 9 },
    airport: { color: '#9a4a2c', radius: 8 },
    connection: { color: '#9a4a2c', radius: 6 },
    stay: { color: '#1f5fbf', radius: 9 },
    venue: { color: '#4f6a55', radius: 11 },
  };

  /** Points along a gentle arc between two places, so flights read as flights. */
  function arc(a, b, steps = 24) {
    const out = [];
    const dLat = b.lat - a.lat;
    const dLon = b.lon - a.lon;
    const bend = Math.min(6, Math.hypot(dLat, dLon) * 0.12);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lift = Math.sin(Math.PI * t) * bend;
      out.push([a.lat + dLat * t + lift, a.lon + dLon * t]);
    }
    return out;
  }

  const maps = new WeakMap();

  function render(el, route) {
    if (!el) return false;
    const L = root.L;
    if (!L) {
      el.innerHTML = '<p class="map-missing">The map couldn’t load. Check your internet connection. The steps below show your route.</p>';
      el.classList.add('is-missing');
      return false;
    }
    const old = maps.get(el);
    if (old) old.remove();

    const map = L.map(el, { scrollWheelZoom: false, tap: true, zoomControl: true });
    maps.set(el, map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const pts = route.points;
    route.legs.forEach((leg) => {
      const a = pts[leg.from];
      const b = pts[leg.to];
      const line = leg.mode === 'fly' ? arc(a, b) : [[a.lat, a.lon], [b.lat, b.lon]];
      L.polyline(line, {
        color: COLORS[leg.mode],
        weight: leg.mode === 'fly' ? 3 : 5,
        dashArray: leg.mode === 'fly' ? '8 8' : null,
        opacity: 0.9,
      }).addTo(map);
    });

    // Label the main stops; connections get a label on tap.
    const labelled = new Set();
    pts.forEach((p) => {
      const style = DOT[p.kind] || DOT.airport;
      const m = L.circleMarker([p.lat, p.lon], {
        radius: style.radius, color: '#fff', weight: 2, fillColor: style.color, fillOpacity: 1,
      }).addTo(map);
      const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      // Only home and the venue are always labelled, so labels don't pile up; tap the rest.
      const permanent = (p.kind === 'home' || p.kind === 'venue') && !labelled.has(key);
      labelled.add(key);
      m.bindTooltip(p.label, { permanent, direction: p.kind === 'venue' ? 'left' : 'right', className: `map-label map-${p.kind}` });
    });

    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lon]));
    const pad = { paddingTopLeft: [90, 40], paddingBottomRight: [90, 40] };
    map.fitBounds(bounds, pad);

    // Let the caller switch between the whole journey and the Moab end.
    el._showAll = () => map.fitBounds(bounds, pad);
    el._showLocal = () => {
      const local = pts.filter((p) => p.kind === 'stay' || p.kind === 'venue' || p.local);
      if (local.length) map.fitBounds(L.latLngBounds(local.map((p) => [p.lat, p.lon])), { padding: [50, 50], maxZoom: 13 });
    };
    setTimeout(() => map.invalidateSize(), 50);
    return true;
  }

  root.TripMap = { render };
})(window);
