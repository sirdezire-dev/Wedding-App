const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/planner.js');

const trip = { arrive: '2027-05-20', depart: '2027-05-24', travelers: 2, groupSize: 2, budget: 3000 };

test('nights and stay dates', () => {
  assert.equal(P.nights('2027-05-20', '2027-05-24'), 4);
  assert.equal(P.nights('2027-05-24', '2027-05-20'), 0);
  assert.deepEqual(P.stayDates('2027-05-30', '2027-06-02'), ['2027-05-30', '2027-05-31', '2027-06-01']);
});

test('flight cost is per person', () => {
  assert.equal(P.flightCost({ price: 400 }, trip), 800);
});

test('stay cost: rooms, fees, tax and group share', () => {
  const hotel = { nightly: 100, maxGuests: 2, taxRate: 0.1 };
  assert.equal(P.stayCost(hotel, trip), 440); // 100*4*1*1.1
  assert.equal(P.stayCost(hotel, { ...trip, travelers: 3, groupSize: 3 }), 880); // 2 rooms
  const villa = { nightly: 1000, maxGuests: 10, cleaningFee: 200, taxRate: 0 };
  // 10-person villa split: 2 of 8 people pay 25%
  assert.equal(P.stayCost(villa, { ...trip, groupSize: 8 }), Math.round((4000 + 200) * 0.25));
});

test('car cost by pricing type', () => {
  assert.equal(P.carCost({ pricing: 'daily', daily: 40, insuranceDaily: 10, seats: 4 }, trip), 200);
  assert.equal(P.carCost({ pricing: 'perPerson', price: 45 }, trip), 90);
  assert.equal(P.carCost({ pricing: 'flat', price: 260, seats: 8 }, { ...trip, groupSize: 4 }), 130);
});

test('free hours skip the wedding day', () => {
  // May 20 arrival 4h, 21: 8h, 22 wedding 0h, 23: 8h
  assert.equal(P.freeHours(trip, '2027-05-22'), 20);
});

test('missed events', () => {
  const events = [{ date: '2027-05-21' }, { date: '2027-05-23' }];
  assert.equal(P.missedEvents(events, { arrive: '2027-05-22', depart: '2027-05-25' }).length, 1);
});

test('activity plan maximizes count within money and time', () => {
  const acts = [
    { id: 'a', price: 100, durationHours: 3, rating: 5 },
    { id: 'b', price: 40, durationHours: 3, rating: 4 },
    { id: 'c', price: 40, durationHours: 3, rating: 4 },
    { id: 'd', price: 10, durationHours: 20, rating: 5 },
  ];
  const plan = P.bestActivityPlan(acts, { travelers: 1 }, 100, 10);
  assert.deepEqual(plan.map((a) => a.id).sort(), ['b', 'c']);
});

test('packages split into fits and over budget', () => {
  const flights = [{ id: 'f1', price: 300, stops: 0, durationMinutes: 200 }, { id: 'f2', price: 800, stops: 1, durationMinutes: 400 }];
  const stays = [{ id: 's1', nightly: 100, maxGuests: 2, rating: 4 }];
  const cars = [{ id: 'c1', pricing: 'perPerson', price: 50 }];
  const r = P.buildPackages({ flights, stays, cars, activities: [], trip: { ...trip, budget: 1100 }, weddingDate: '2027-05-22' });
  assert.equal(r.count, 4);
  // f1+s1 = 600+400 = 1000 fits; +car 100 = 1100 fits; f2 = 1600+ doesn't
  assert.deepEqual(r.fits.map((p) => p.id), ['f1|s1|none', 'f1|s1|c1']);
  assert.equal(r.over.length, 2);
});
