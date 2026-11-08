const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/planner.js');
const T = require('../js/travel.js');
const W = require('../data/wedding.js');

const trip = { arrive: '2027-05-26', depart: '2027-05-30', travelers: 2, groupSize: 2 };

test('nights and stay dates', () => {
  assert.equal(P.nights(trip.arrive, trip.depart), 4);
  assert.equal(P.nights('2027-05-30', '2027-05-26'), 0);
  assert.deepEqual(P.stayDates('2027-05-31', '2027-06-02'), ['2027-05-31', '2027-06-01']);
});

test('travel cost: flights per person, driving per car', () => {
  assert.equal(P.travelCost({ kind: 'flight', price: 400 }, trip), 800);
  assert.equal(P.travelCost({ kind: 'drive', cost: 160 }, trip), 160);
});

test('stay cost: rooms, fees, tax and sharing', () => {
  const hotel = { nightly: 100, maxGuests: 2, taxRate: 0.1 };
  assert.equal(P.stayCost(hotel, trip), 440);
  assert.equal(P.stayCost(hotel, { ...trip, travelers: 3, groupSize: 3 }), 880);
  const home = { nightly: 1000, maxGuests: 10, cleaningFee: 200, taxRate: 0 };
  assert.equal(P.stayCost(home, { ...trip, groupSize: 8 }), Math.round(4200 * 0.25));
});

test('ground cost: rental car days, fees and shuttles', () => {
  assert.equal(P.groundCost({ kind: 'car', daily: 50, feesRate: 0.2, seats: 5 }, trip), 240);
  assert.equal(P.groundCost({ pricing: 'perPerson', price: 60 }, trip), 120);
  assert.equal(P.groundCost({ pricing: 'flat', price: 700, seats: 6 }, { ...trip, groupSize: 4 }), 350);
});

test('budget plan: total, per-part limits, limits only', () => {
  const both = P.budgetPlan('3000', { travel: '800', stay: '1500', ground: '' });
  assert.equal(both.total, 3000);
  assert.deepEqual(both.caps, { travel: 800, stay: 1500, ground: null });
  assert.equal(both.capSum, 2300);
  assert.equal(both.capsOverTotal, false);

  const capsOnly = P.budgetPlan('', { travel: '800', stay: '1500', ground: '400' });
  assert.equal(capsOnly.total, 2700);
  assert.equal(capsOnly.fromCaps, true);

  assert.equal(P.budgetPlan('', {}).total, null);
  assert.equal(P.budgetPlan('1000', { stay: '1500' }).capsOverTotal, true);
});

test('free hours skip the wedding day; missed events ignore family-only ones', () => {
  // 26: 4h, 27: 8h, 28: 8h, 29 wedding: 0h
  assert.equal(P.freeHours(trip, '2027-05-29'), 20);
  const missed = P.missedEvents(W.events, { arrive: '2027-05-28', depart: '2027-05-30' });
  assert.deepEqual(missed.map((e) => e.id), ['welcome']);
});

test('activity plan fits money and time', () => {
  const acts = [
    { id: 'a', price: 100, durationHours: 3, rating: 5 },
    { id: 'b', price: 40, durationHours: 3, rating: 4 },
    { id: 'c', price: 40, durationHours: 3, rating: 4 },
    { id: 'd', price: 10, durationHours: 20, rating: 5 },
  ];
  assert.deepEqual(P.bestActivityPlan(acts, { travelers: 1 }, 100, 10).map((a) => a.id).sort(), ['b', 'c']);
  assert.deepEqual(P.bestActivityPlan(acts, { travelers: 1 }, 0, 10), []);
});

const airports = [
  { code: 'CNY', minutesToVenue: 15, carPriceFactor: 1, noCarOk: true },
  { code: 'SLC', minutesToVenue: 225, carPriceFactor: 1 },
];
const grounds = P.expandGround([{ id: 'car', daily: 50, seats: 5, feesRate: 0 }], [], airports);
const flights = [
  { id: 'f-slc', kind: 'flight', to: 'SLC', price: 300, stops: 0, durationMinutes: 240, homeMinutes: 20 },
  { id: 'f-cny', kind: 'flight', to: 'CNY', price: 600, stops: 1, durationMinutes: 360, homeMinutes: 20 },
];
const stays = [{ id: 's1', nightly: 100, maxGuests: 2, rating: 4 }];

test('packages: cars match the arrival airport; no car only near the venue', () => {
  const r = P.buildPackages({ travel: flights, stays, grounds, activities: [], trip, weddingDate: '2027-05-29', budget: P.budgetPlan(''), airports });
  const ids = r.fits.map((p) => p.id).sort();
  assert.deepEqual(ids, ['f-cny|s1|car@CNY', 'f-cny|s1|none', 'f-slc|s1|car@SLC']);
});

test('packages: per-part limits remove options, total budget splits fits/over', () => {
  const plan = P.budgetPlan('1500', { travel: '700' });
  const r = P.buildPackages({ travel: flights, stays, grounds, activities: [], trip, weddingDate: '2027-05-29', budget: plan, airports });
  assert.equal(r.removedByCaps.travel, 1); // the $1,200 CNY flight
  // SLC: 600 flight + 400 stay + 200 car = 1200
  assert.deepEqual(r.fits.map((p) => p.id), ['f-slc|s1|car@SLC']);
  assert.equal(r.fits[0].total, 1200);
  assert.equal(P.recommendations(r.fits).length, 1);
});

test('travel estimates: nearest airports and direct-to-multi-stop flights', () => {
  const columbus = { lat: 39.96, lon: -83.0 };
  assert.equal(T.nearestAirports(columbus, ['CNY', 'GJT'])[0].code, 'CMH');
  const f = T.estimateFlights(columbus, ['CMH'], ['CNY', 'GJT', 'SLC', 'DEN']);
  const stops = new Set(f.map((x) => x.stops));
  assert.ok(stops.has(0) && stops.has(1) && stops.has(2));
  assert.ok(f.every((x) => x.price > 0 && x.durationMinutes > 0));
  assert.ok(!f.some((x) => x.to === 'CNY' && x.stops === 0)); // CNY has no direct from Ohio
  // Short hops aren't offered as flights
  assert.equal(T.estimateFlights(null, ['COS'], ['DEN']).length, 0);
});

test('drive option offered when close, not when far', () => {
  const venue = W.venue;
  assert.ok(T.driveOption({ lat: 33.45, lon: -112.07 }, venue, trip)); // Phoenix
  assert.equal(T.driveOption({ lat: 40.71, lon: -74.0 }, venue, trip), null); // New York
});
