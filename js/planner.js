/*
 * Planner — pure trip-cost and budget logic (no DOM).
 * Works in the browser (window.Planner) and in Node (require) for tests.
 *
 * Vocabulary
 *   travel  — how the guest gets there: { kind: 'flight' | 'drive', ... }
 *   stay    — hotel / villa / airbnb
 *   ground  — rental car or shuttle at the arrival airport (null = none)
 */
(function (root) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  }
  const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);

  function nights(arrive, depart) {
    if (!arrive || !depart) return 0;
    return Math.max(0, Math.round((parseDate(depart) - parseDate(arrive)) / DAY_MS));
  }

  function stayDates(arrive, depart) {
    const out = [];
    for (let i = 0; i < nights(arrive, depart); i++) out.push(toISO(parseDate(arrive) + i * DAY_MS));
    return out;
  }

  function share(trip) {
    const travelers = Math.max(1, trip.travelers || 1);
    const group = Math.max(trip.groupSize || travelers, travelers);
    return { travelers, group, fraction: travelers / group };
  }

  // ------------------------------------------------------------------ costs

  /** Getting there: flights are per person (round trip); driving is per car. */
  function travelCost(travel, trip) {
    if (!travel) return 0;
    if (travel.kind === 'drive') return Math.round(travel.cost || 0);
    return Math.round((travel.price || 0) * share(trip).travelers);
  }

  function unitsNeeded(stay, trip) {
    return Math.max(1, Math.ceil(share(trip).group / Math.max(1, stay.maxGuests || 2)));
  }

  /** Lodging: nightly x nights x rooms + one-time fees, plus tax, split by headcount. */
  function stayCost(stay, trip) {
    if (!stay) return 0;
    const n = nights(trip.arrive, trip.depart);
    if (!n) return 0;
    const units = unitsNeeded(stay, trip);
    const base = (stay.nightly * n + (stay.cleaningFee || 0)) * units;
    return Math.round(base * (1 + (stay.taxRate || 0)) * share(trip).fraction);
  }

  /** Rental car or shuttle, split by headcount when shared. */
  function groundCost(ground, trip) {
    if (!ground) return 0;
    const { travelers, group, fraction } = share(trip);
    const vehicles = Math.max(1, Math.ceil(group / Math.max(1, ground.seats || 4)));
    if (ground.pricing === 'perPerson') return Math.round(ground.price * travelers);
    if (ground.pricing === 'flat') return Math.round(ground.price * vehicles * fraction);
    const days = Math.max(1, nights(trip.arrive, trip.depart));
    return Math.round(ground.daily * days * vehicles * (1 + (ground.feesRate || 0)) * fraction);
  }

  const activityCost = (a, trip) => Math.round((a.price || 0) * share(trip).travelers);

  function costBreakdown(sel, trip) {
    const travel = travelCost(sel.travel, trip);
    const stay = stayCost(sel.stay, trip);
    const ground = groundCost(sel.ground, trip);
    const activities = (sel.activities || []).reduce((s, a) => s + activityCost(a, trip), 0);
    return { travel, stay, ground, activities, total: travel + stay + ground + activities };
  }

  // ------------------------------------------------------------------ budget

  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));

  /**
   * The guest can give a whole-trip budget, limits for each part, or both.
   * With limits only, the whole-trip budget is what the limits add up to.
   */
  function budgetPlan(totalInput, capsInput = {}) {
    const caps = { travel: num(capsInput.travel), stay: num(capsInput.stay), ground: num(capsInput.ground) };
    const capSum = Object.values(caps).reduce((s, v) => s + (v || 0), 0);
    const total = num(totalInput);
    const effective = total != null && total > 0 ? total : capSum > 0 ? capSum : null;
    return {
      total: effective, // null = no budget given
      fromCaps: !(total > 0) && capSum > 0,
      caps,
      capSum,
      capsOverTotal: total > 0 && capSum > total,
    };
  }

  /** Is this option within the guest's limit for its part of the trip? */
  const withinCap = (cost, cap) => cap == null || cost <= cap;

  // ------------------------------------------------------------------ time

  /** Free hours for activities: arrival day 4h, wedding day 0h, other days 8h. */
  function freeHours(trip, weddingDate) {
    return stayDates(trip.arrive, trip.depart).reduce(
      (sum, d, i) => sum + (d === weddingDate ? 0 : i === 0 ? 4 : 8),
      0
    );
  }

  function missedEvents(events, trip) {
    const dates = new Set(stayDates(trip.arrive, trip.depart));
    return events.filter((e) => e.everyone !== false && !dates.has(e.date));
  }

  function stopsLabel(stops) {
    if (stops === 0) return 'Direct flight';
    return stops === 1 ? '1 stop' : `${stops} stops`;
  }

  /** Door-to-venue minutes for one direction of the trip. */
  function doorToDoor(travel, airportsByCode) {
    if (!travel) return 0;
    if (travel.kind === 'drive') return travel.durationMinutes;
    const arrival = airportsByCode[travel.to];
    // home -> airport, ~90 min at the airport, the flight, then the drive to the venue
    return (travel.homeMinutes || 0) + 90 + (travel.durationMinutes || 0) + (arrival ? arrival.minutesToVenue : 0);
  }

  // ------------------------------------------------------------------ activities

  /**
   * Returns a function money -> the most activities that fit that money and the free time.
   * Ties go to higher total rating, then lower cost. Exact for up to 14 activities.
   */
  function activityPlanner(activities, trip, hours) {
    const items = activities.filter((a) => (a.durationHours || 0) <= hours);
    const cost = (a) => activityCost(a, trip);

    if (items.length > 14) {
      const sorted = [...items].sort((a, b) => cost(a) - cost(b));
      return (money) => {
        const out = [];
        let m = money;
        let h = hours;
        sorted.forEach((a) => {
          if (cost(a) <= m && a.durationHours <= h) {
            out.push(a);
            m -= cost(a);
            h -= a.durationHours;
          }
        });
        return out;
      };
    }

    const subsets = [];
    for (let mask = 1; mask < 1 << items.length; mask++) {
      let c = 0;
      let h = 0;
      let r = 0;
      let n = 0;
      for (let i = 0; i < items.length; i++) {
        if (mask & (1 << i)) {
          c += cost(items[i]);
          h += items[i].durationHours || 0;
          r += items[i].rating || 0;
          n++;
        }
      }
      if (h <= hours) subsets.push({ mask, c, r, n });
    }
    subsets.sort((a, b) => b.n - a.n || b.r - a.r || a.c - b.c);
    return (money) => {
      const best = subsets.find((s) => s.c <= money);
      return best ? items.filter((_, i) => best.mask & (1 << i)) : [];
    };
  }

  function bestActivityPlan(activities, trip, money, hours) {
    return activityPlanner(activities, trip, hours)(money);
  }

  // ------------------------------------------------------------------ packages

  const SORTS = {
    cheapest: (a, b) => a.total - b.total,
    easiest: (a, b) => a.doorMinutes - b.doorMinutes || a.stops - b.stops || a.total - b.total,
    comfort: (a, b) => (b.stay.rating || 0) - (a.stay.rating || 0) || a.total - b.total,
    closest: (a, b) => (a.stay.minutesToVenue ?? 999) - (b.stay.minutesToVenue ?? 999) || a.total - b.total,
    mostFun: (a, b) => b.activityPlan.length - a.activityPlan.length || a.total - b.total,
  };

  /** Ground options that make sense for a way of getting there. */
  function groundFor(travel, grounds, airportsByCode) {
    if (travel.kind === 'drive') return [null]; // bringing their own car
    const airport = airportsByCode[travel.to];
    const options = grounds.filter((g) => g.airport === travel.to);
    // Going without a car or shuttle only if the couple says it's OK for this airport.
    const noCarOk = !!(airport && airport.noCarOk);
    return noCarOk ? [null, ...options] : options;
  }

  /**
   * Every way-to-get-there x stay x ground combination, priced for this party.
   * Options over a part's limit are left out. The rest are split into
   * trips that fit the whole-trip budget and trips that don't.
   */
  function buildPackages({ travel, stays, grounds, activities, trip, weddingDate, budget, airports, sort = 'cheapest' }) {
    const airportsByCode = Object.fromEntries((airports || []).map((a) => [a.code, a]));
    const plan = budget || budgetPlan(trip.budget);
    const caps = plan.caps || {};
    const hours = freeHours(trip, weddingDate);
    const planFor = activityPlanner(activities, trip, hours);

    const okTravel = travel.filter((t) => withinCap(travelCost(t, trip), caps.travel));
    const okStays = stays.filter((s) => withinCap(stayCost(s, trip), caps.stay));
    const okGrounds = grounds.filter((g) => withinCap(groundCost(g, trip), caps.ground));

    const all = [];
    okTravel.forEach((t) => {
      const doorMinutes = doorToDoor(t, airportsByCode);
      groundFor(t, okGrounds, airportsByCode).forEach((g) => {
        okStays.forEach((s) => {
          const cost = costBreakdown({ travel: t, stay: s, ground: g }, trip);
          const leftover = plan.total == null ? null : plan.total - cost.total;
          const activityPlan = leftover != null && leftover > 0 ? planFor(leftover) : [];
          all.push({
            id: `${t.id}|${s.id}|${g ? g.id : 'none'}`,
            travel: t,
            stay: s,
            ground: g,
            cost,
            total: cost.total,
            leftover,
            doorMinutes,
            stops: t.kind === 'drive' ? 0 : t.stops,
            activityPlan,
            activityPlanCost: activityPlan.reduce((sum, a) => sum + activityCost(a, trip), 0),
          });
        });
      });
    });

    const by = SORTS[sort] || SORTS.cheapest;
    const fits = (plan.total == null ? all : all.filter((p) => p.total <= plan.total)).sort(by);
    const over = plan.total == null ? [] : all.filter((p) => p.total > plan.total).sort(SORTS.cheapest);
    return {
      fits,
      over,
      count: all.length,
      freeHours: hours,
      removedByCaps: {
        travel: travel.length - okTravel.length,
        stays: stays.length - okStays.length,
        grounds: grounds.length - okGrounds.length,
      },
    };
  }

  /** Three easy-to-understand picks: lowest price, easiest journey, nicest stay. */
  function recommendations(fits) {
    if (!fits.length) return [];
    const picks = [];
    const used = new Set();
    const add = (key, label, why, list) => {
      const p = list.find((x) => !used.has(x.id));
      if (p) {
        used.add(p.id);
        picks.push({ key, label, why, pkg: p });
      }
    };
    add('value', 'Best price', 'The lowest total cost for your dates.', [...fits].sort(SORTS.cheapest));
    add('easy', 'Easiest journey', 'The least time traveling from your door to the venue.', [...fits].sort(SORTS.easiest));
    add('comfort', 'Most comfortable', 'The best-reviewed place to stay that fits your budget.', [...fits].sort(SORTS.comfort));
    return picks;
  }

  /** Rental cars at each arrival airport, plus shuttles. */
  function expandGround(cars, transfers, airports) {
    const out = [];
    airports.forEach((a) => {
      cars.forEach((c) =>
        out.push({ ...c, id: `${c.id}@${a.code}`, kind: 'car', airport: a.code, daily: Math.round(c.daily * (a.carPriceFactor || 1)) })
      );
    });
    transfers.forEach((t) =>
      (t.airports || []).forEach((code) => out.push({ ...t, id: `${t.id}@${code}`, kind: 'transfer', airport: code }))
    );
    return out;
  }

  const api = {
    nights,
    stayDates,
    travelCost,
    stayCost,
    groundCost,
    activityCost,
    unitsNeeded,
    costBreakdown,
    budgetPlan,
    withinCap,
    freeHours,
    missedEvents,
    stopsLabel,
    doorToDoor,
    activityPlanner,
    bestActivityPlan,
    buildPackages,
    recommendations,
    expandGround,
  };

  root.Planner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
