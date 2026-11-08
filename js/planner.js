/*
 * Planner — pure trip-cost and budget logic (no DOM).
 * Works in the browser (window.Planner) and in Node (require) for tests.
 */
(function (root) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  }

  function toISO(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  /** Number of nights between arrival and departure (never negative). */
  function nights(arrive, depart) {
    if (!arrive || !depart) return 0;
    return Math.max(0, Math.round((parseDate(depart) - parseDate(arrive)) / DAY_MS));
  }

  /** Every date (ISO) from arrival up to, not including, departure. */
  function stayDates(arrive, depart) {
    const out = [];
    const n = nights(arrive, depart);
    for (let i = 0; i < n; i++) out.push(toISO(parseDate(arrive) + i * DAY_MS));
    return out;
  }

  function share(trip) {
    const group = Math.max(trip.groupSize || trip.travelers || 1, trip.travelers || 1);
    return { group, fraction: (trip.travelers || 1) / group };
  }

  /** Round-trip flight cost for the whole party. */
  function flightCost(flight, trip) {
    if (!flight) return 0;
    return Math.round(flight.price * (trip.travelers || 1));
  }

  /** Units (rooms / homes) needed so everyone in the group has a bed. */
  function unitsNeeded(stay, trip) {
    const { group } = share(trip);
    return Math.max(1, Math.ceil(group / Math.max(1, stay.maxGuests || 2)));
  }

  /** Lodging cost for this party: nightly x nights x units + fees + tax, split by group share. */
  function stayCost(stay, trip) {
    if (!stay) return 0;
    const n = nights(trip.arrive, trip.depart);
    if (n === 0) return 0;
    const units = unitsNeeded(stay, trip);
    const base = stay.nightly * n * units + (stay.cleaningFee || 0) * units;
    const withTax = base * (1 + (stay.taxRate || 0));
    return Math.round(withTax * share(trip).fraction);
  }

  /** Ground transport cost for this party. */
  function carCost(car, trip) {
    if (!car) return 0;
    const { group, fraction } = share(trip);
    const vehicles = Math.max(1, Math.ceil(group / Math.max(1, car.seats || 4)));
    if (car.pricing === 'perPerson') return Math.round(car.price * (trip.travelers || 1));
    if (car.pricing === 'flat') return Math.round(car.price * vehicles * fraction);
    const days = Math.max(1, nights(trip.arrive, trip.depart));
    const daily = (car.daily || 0) + (car.insuranceDaily || 0);
    return Math.round(daily * days * vehicles * fraction);
  }

  function activityCost(activity, trip) {
    return Math.round((activity.price || 0) * (trip.travelers || 1));
  }

  /**
   * Free hours available for optional activities.
   * Arrival day: 4h, wedding day: 0h, other full days: 8h. Departure day isn't counted.
   */
  function freeHours(trip, weddingDate) {
    return stayDates(trip.arrive, trip.depart).reduce((sum, d, i) => {
      if (d === weddingDate) return sum;
      return sum + (i === 0 ? 4 : 8);
    }, 0);
  }

  /** Wedding events the guest's dates would miss. */
  function missedEvents(events, trip) {
    const dates = new Set(stayDates(trip.arrive, trip.depart));
    return events.filter((e) => !dates.has(e.date));
  }

  function stopsLabel(stops) {
    if (stops === 0) return 'Nonstop';
    return stops === 1 ? '1 stop' : `${stops} stops`;
  }

  function costBreakdown(sel, trip) {
    const flight = flightCost(sel.flight, trip);
    const stay = stayCost(sel.stay, trip);
    const car = carCost(sel.car, trip);
    const activities = (sel.activities || []).reduce((s, a) => s + activityCost(a, trip), 0);
    return { flight, stay, car, activities, total: flight + stay + car + activities };
  }

  /**
   * Choose the most optional activities that fit both the money and the free time.
   * Exact search for small lists, greedy (cheapest first) for large ones.
   * Tie-break: higher total rating, then lower cost.
   */
  function bestActivityPlan(activities, trip, moneyLeft, hoursLeft) {
    const items = activities.filter(
      (a) => activityCost(a, trip) <= moneyLeft && (a.durationHours || 0) <= hoursLeft
    );
    const score = (set) => {
      const cost = set.reduce((s, a) => s + activityCost(a, trip), 0);
      const hours = set.reduce((s, a) => s + (a.durationHours || 0), 0);
      const rating = set.reduce((s, a) => s + (a.rating || 0), 0);
      return { cost, hours, rating };
    };

    if (items.length > 14) {
      const picked = [];
      let money = moneyLeft;
      let hours = hoursLeft;
      [...items]
        .sort((a, b) => activityCost(a, trip) - activityCost(b, trip))
        .forEach((a) => {
          const c = activityCost(a, trip);
          if (c <= money && a.durationHours <= hours) {
            picked.push(a);
            money -= c;
            hours -= a.durationHours;
          }
        });
      return picked;
    }

    let best = [];
    let bestScore = { cost: 0, rating: 0 };
    const total = 1 << items.length;
    for (let mask = 1; mask < total; mask++) {
      const set = items.filter((_, i) => mask & (1 << i));
      const s = score(set);
      if (s.cost > moneyLeft || s.hours > hoursLeft) continue;
      const better =
        set.length > best.length ||
        (set.length === best.length &&
          (s.rating > bestScore.rating ||
            (s.rating === bestScore.rating && s.cost < bestScore.cost)));
      if (better) {
        best = set;
        bestScore = s;
      }
    }
    return best;
  }

  const SORTS = {
    cheapest: (a, b) => a.total - b.total,
    rated: (a, b) => (b.stay.rating || 0) - (a.stay.rating || 0) || a.total - b.total,
    closest: (a, b) =>
      (a.stay.minutesToVenue ?? 999) - (b.stay.minutesToVenue ?? 999) || a.total - b.total,
    fastest: (a, b) =>
      (a.flight.durationMinutes || 0) - (b.flight.durationMinutes || 0) || a.total - b.total,
    mostFun: (a, b) => b.activityPlan.length - a.activityPlan.length || a.total - b.total,
  };

  /**
   * Every flight x stay x ground-transport combination, priced for this party,
   * split into the ones that fit the budget and the ones that don't.
   */
  function buildPackages({ flights, stays, cars, activities, trip, weddingDate, sort = 'cheapest' }) {
    const carOptions = [null, ...cars];
    const hours = freeHours(trip, weddingDate);
    const budget = Number(trip.budget) || 0;
    const all = [];

    flights.forEach((flight) => {
      stays.forEach((stay) => {
        carOptions.forEach((car) => {
          const cost = costBreakdown({ flight, stay, car }, trip);
          const leftover = budget - cost.total;
          const activityPlan =
            leftover > 0 ? bestActivityPlan(activities, trip, leftover, hours) : [];
          all.push({
            id: `${flight.id}|${stay.id}|${car ? car.id : 'none'}`,
            flight,
            stay,
            car,
            cost,
            total: cost.total,
            leftover,
            activityPlan,
            activityPlanCost: activityPlan.reduce((s, a) => s + activityCost(a, trip), 0),
          });
        });
      });
    });

    const fits = all.filter((p) => p.total <= budget).sort(SORTS[sort] || SORTS.cheapest);
    const over = all.filter((p) => p.total > budget).sort(SORTS.cheapest);
    return { fits, over, count: all.length, freeHours: hours };
  }

  const api = {
    nights,
    stayDates,
    flightCost,
    stayCost,
    carCost,
    activityCost,
    unitsNeeded,
    freeHours,
    missedEvents,
    stopsLabel,
    costBreakdown,
    bestActivityPlan,
    buildPackages,
  };

  root.Planner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
