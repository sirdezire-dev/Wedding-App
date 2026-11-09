/*
 * ============================================================
 *  YOUR WEDDING DETAILS — edit this file to customize the site
 * ============================================================
 *  Everything guests see comes from here. Dates use YYYY-MM-DD.
 *  Prices are ESTIMATES for late May. Guests always see the live
 *  price on the booking site before they pay.
 */
(function (root) {
  const WEDDING = {
    couple: 'Deividas & Gina',
    date: '2027-05-29', // the ceremony day
    weekendStart: '2027-05-27',
    weekendEnd: '2027-05-29',
    currency: 'USD', // prices below are in US dollars
    gbpPerUsd: 0.76, // fallback exchange rate if today's rate can't be loaded

    venue: {
      name: 'The Red Earth Venue',
      address: '545 W State Road 313, Moab, UT 84532',
      city: 'Moab',
      region: 'Utah',
      searchName: 'Moab, Utah', // used to fill in hotel and Airbnb searches
      lat: 38.629,
      lon: -109.695,
    },

    // We suggest arriving the day before the weekend starts and leaving the morning after.
    suggestedArrive: '2027-05-26',
    suggestedDepart: '2027-05-30',

    // Where guests' answers are saved (who they're staying with, where, when).
    // Paste your Google Apps Script web-app address here — see google-apps-script/SETUP.md.
    responses: {
      endpoint: 'https://script.google.com/macros/s/AKfycbxvg3CAdkFRMzFqIjL6f6zW7rz-7zEIBayFcSoZpXz5jvjSCWddId2vm-KYReoZ_torRA/exec', // the Google Sheet's script (Deploy → Web app URL)
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1MHg4Br30pPgHFvzlk7lh_hBgT_3V_-1bM6fDpex-L5I/edit', // your Google Sheet (private to you)
    },

    // Someone guests can call if they need help booking. Set to null to hide it.
    help: null, // e.g. { name: 'Aunt Linda', phone: '555-123-4567' }

    // Airports guests can fly into. minutesToVenue = drive time to the venue.
    // carPriceFactor = rental cars cost this much compared with Salt Lake City.
    // Add noCarOk: true to let guests skip the car/shuttle for that airport (Moab really needs one).
    airports: [
      { code: 'CNY', name: 'Moab (Canyonlands Regional)', minutesToVenue: 15, carPriceFactor: 1.35, note: 'Closest airport. Small, with few flights, mostly through Denver.' },
      { code: 'GJT', name: 'Grand Junction, Colorado', minutesToVenue: 115, carPriceFactor: 1.15, note: 'About 2 hours’ drive. Scenic route along the Colorado River.' },
      { code: 'SLC', name: 'Salt Lake City, Utah', minutesToVenue: 225, carPriceFactor: 1.0, note: 'Most direct flights and cheapest cars. About 3¾ hours’ drive.' },
      { code: 'DEN', name: 'Denver, Colorado', minutesToVenue: 330, carPriceFactor: 0.95, note: 'Many direct flights, but a long 5½-hour drive.' },
    ],

    // ---------- WEDDING WEEKEND (shown on everyone's itinerary) ----------
    // everyone: false = for the wedding party and family only.
    events: [
      { id: 'welcome', name: 'Welcome Evening', date: '2027-05-27', time: '6:00 PM', place: 'To be announced', everyone: true },
      { id: 'rehearsal', name: 'Rehearsal Dinner', date: '2027-05-28', time: '6:00 PM', place: 'To be announced', everyone: false },
      { id: 'ceremony', name: 'Ceremony & Reception', date: '2027-05-29', time: '5:00 PM', place: 'The Red Earth Venue', everyone: true },
    ],

    // ---------- PLACES TO STAY ----------
    // type: 'hotel' | 'villa' (vacation home) | 'airbnb'
    // nightly = price per room or home per night; maxGuests = people per room or home
    // taxRate 0.13 = 13% lodging tax; cleaningFee = one-time per room or home
    // perk: optional text, e.g. 'Wedding room block — mention the Smith wedding'
    // url: optional booking link. Without one, the site builds a search for the guest's dates.
    // lat/lon: approximate location, used for the trip map.
    stays: [
      { id: 's-hoodoo', lat: 38.5745, lon: -109.5515, type: 'hotel', name: 'Hoodoo Moab, Curio Collection by Hilton', nightly: 349, maxGuests: 2, taxRate: 0.13, rating: 4.6, minutesToVenue: 18, amenities: ['Pool', 'Restaurant', 'Walk to downtown'] },
      { id: 's-hyatt', lat: 38.596, lon: -109.5655, type: 'hotel', name: 'Hyatt Place Moab', nightly: 289, maxGuests: 4, taxRate: 0.13, rating: 4.5, minutesToVenue: 15, amenities: ['Free breakfast', 'Elevator', 'Pool'] },
      { id: 's-hampton', lat: 38.58, lon: -109.5525, type: 'hotel', name: 'Hampton Inn Moab', nightly: 259, maxGuests: 4, taxRate: 0.13, rating: 4.4, minutesToVenue: 16, amenities: ['Free breakfast', 'Elevator', 'Pool'] },
      { id: 's-bw', lat: 38.5728, lon: -109.55, type: 'hotel', name: 'Best Western Plus Canyonlands Inn', nightly: 239, maxGuests: 4, taxRate: 0.13, rating: 4.3, minutesToVenue: 18, amenities: ['Free breakfast', 'Downtown'] },
      { id: 's-bighorn', lat: 38.565, lon: -109.547, type: 'hotel', name: 'Big Horn Lodge', nightly: 149, maxGuests: 4, taxRate: 0.13, rating: 4.0, minutesToVenue: 19, amenities: ['Budget-friendly', 'Pool', 'Ground-floor rooms'] },
      { id: 's-redcliffs', lat: 38.73, lon: -109.413, type: 'hotel', name: 'Red Cliffs Lodge', nightly: 329, maxGuests: 4, taxRate: 0.13, rating: 4.5, minutesToVenue: 35, amenities: ['On the Colorado River', 'Restaurant', 'Horseback riding'] },
      { id: 's-sorrel', lat: 38.713, lon: -109.385, type: 'hotel', name: 'Sorrel River Ranch Resort & Spa', nightly: 950, maxGuests: 2, taxRate: 0.13, rating: 4.8, minutesToVenue: 45, amenities: ['Luxury', 'Spa', 'River views'] },
      { id: 's-canvas', lat: 38.665, lon: -109.64, type: 'hotel', name: 'Under Canvas Moab (glamping)', nightly: 309, maxGuests: 4, taxRate: 0.13, rating: 4.4, minutesToVenue: 10, amenities: ['Safari tents', 'Stargazing', 'Near Arches'] },
      { id: 's-retreat', lat: 38.52, lon: -109.5, type: 'villa', name: '4-bedroom home with hot tub', nightly: 525, maxGuests: 8, cleaningFee: 250, taxRate: 0.13, rating: 4.8, minutesToVenue: 22, amenities: ['Hot tub', 'Full kitchen', 'Sleeps 8'] },
      { id: 's-ranch', lat: 38.505, lon: -109.475, type: 'villa', name: '6-bedroom ranch house for big groups', nightly: 980, maxGuests: 14, cleaningFee: 350, taxRate: 0.13, rating: 4.9, minutesToVenue: 25, amenities: ['Sleeps 14', 'Big yard', 'Fire pit'] },
      { id: 's-townhome', lat: 38.574, lon: -109.548, type: 'airbnb', name: 'Downtown 2-bedroom townhome', nightly: 245, maxGuests: 6, cleaningFee: 150, taxRate: 0.13, rating: 4.8, minutesToVenue: 17, amenities: ['Full kitchen', 'Walk to shops'] },
      { id: 's-casita', lat: 38.555, lon: -109.53, type: 'airbnb', name: 'Cozy 1-bedroom casita, no stairs', nightly: 175, maxGuests: 2, cleaningFee: 95, taxRate: 0.13, rating: 4.9, minutesToVenue: 20, amenities: ['Single level', 'Patio', 'Quiet'] },
      { id: 's-condo', lat: 38.56, lon: -109.535, type: 'airbnb', name: '3-bedroom condo with pool', nightly: 365, maxGuests: 8, cleaningFee: 180, taxRate: 0.13, rating: 4.7, minutesToVenue: 21, amenities: ['Shared pool', 'Full kitchen'] },
    ],

    // ---------- RENTAL CARS (prices at Salt Lake City; other airports adjusted above) ----------
    // daily = price per day; feesRate 0.22 = airport taxes and fees
    cars: [
      { id: 'car-economy', name: 'Small car', example: 'Toyota Corolla or similar', seats: 4, daily: 55, feesRate: 0.22 },
      { id: 'car-midsuv', name: 'Midsize SUV', example: 'Toyota RAV4 or similar', seats: 5, daily: 79, feesRate: 0.22 },
      { id: 'car-minivan', name: 'Minivan', example: 'Chrysler Pacifica or similar', seats: 7, daily: 99, feesRate: 0.22 },
      { id: 'car-fullsuv', name: 'Large SUV', example: 'Chevy Tahoe or similar', seats: 7, daily: 115, feesRate: 0.22 },
    ],

    // ---------- SHUTTLES & PRIVATE DRIVERS ----------
    // pricing: 'perPerson' (round trip) | 'flat' (per vehicle, round trip). airports = where it picks up.
    transfers: [
      { id: 'tr-cny', name: 'Airport shuttle to Moab', pricing: 'perPerson', price: 60, seats: 12, airports: ['CNY'], note: 'Book ahead — seats are limited.' },
      { id: 'tr-gjt', name: 'Private driver from Grand Junction', pricing: 'flat', price: 700, seats: 6, airports: ['GJT'], note: 'Price is an estimate — ask for a quote.' },
      { id: 'tr-slc', name: 'Private van from Salt Lake City', pricing: 'flat', price: 1400, seats: 10, airports: ['SLC'], note: 'Price is an estimate — ask for a quote. Good for groups.' },
    ],

    // ---------- THINGS TO DO ----------
    // price = per person. effort: 'Easy' | 'Moderate' | 'Active'
    activities: [
      { id: 'a-arches', name: 'Arches National Park scenic drive', price: 15, durationHours: 4, effort: 'Easy', rating: 4.9, note: 'A timed-entry reservation may be needed — check nps.gov/arch before you go.', url: 'https://www.nps.gov/arch/' },
      { id: 'a-deadhorse', name: 'Dead Horse Point sunset', price: 12, durationHours: 3, effort: 'Easy', rating: 4.9, note: 'Just up the road from the venue.', url: 'https://stateparks.utah.gov/parks/dead-horse/' },
      { id: 'a-island', name: 'Canyonlands, Island in the Sky drive', price: 15, durationHours: 4, effort: 'Easy', rating: 4.8, url: 'https://www.nps.gov/cany/' },
      { id: 'a-dino', name: 'Moab Giants dinosaur park', price: 25, durationHours: 2, effort: 'Easy', rating: 4.4 },
      { id: 'a-stars', name: 'Guided stargazing evening', price: 75, durationHours: 2, effort: 'Easy', rating: 4.8 },
      { id: 'a-jetboat', name: 'Colorado River jet-boat ride', price: 99, durationHours: 3, effort: 'Easy', rating: 4.7 },
      { id: 'a-dinner', name: 'Sunset dinner boat cruise', price: 120, durationHours: 3, effort: 'Easy', rating: 4.6 },
      { id: 'a-flight', name: 'Scenic plane ride over Canyonlands', price: 199, durationHours: 1.5, effort: 'Easy', rating: 4.8 },
      { id: 'a-jeep', name: 'Off-road Jeep tour', price: 149, durationHours: 3, effort: 'Moderate', rating: 4.9, note: 'Bumpy ride — not for bad backs.' },
      { id: 'a-horse', name: 'Horseback ride', price: 110, durationHours: 2, effort: 'Moderate', rating: 4.6 },
      { id: 'a-raft', name: 'Half-day river rafting', price: 95, durationHours: 4, effort: 'Active', rating: 4.8 },
      { id: 'a-delicate', name: 'Hike to Delicate Arch', price: 15, durationHours: 3, effort: 'Active', rating: 4.9, note: '3 miles round trip, steep and no shade.' },
    ],
  };

  root.WEDDING = WEDDING;
  if (typeof module !== 'undefined' && module.exports) module.exports = WEDDING;
})(typeof window !== 'undefined' ? window : globalThis);
