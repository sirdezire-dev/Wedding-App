/*
 * ============================================================
 *  YOUR WEDDING DETAILS — edit this file to customize the site
 * ============================================================
 *  Everything guests see comes from here. Replace the sample
 *  names, prices and links with your own. Prices are in the
 *  currency below. Dates use YYYY-MM-DD.
 *
 *  Prices here are SAMPLE ESTIMATES. Guests always confirm the
 *  live price on the booking site before paying.
 */
window.WEDDING = {
  couple: 'Alex & Jordan',
  date: '2027-05-22',
  currency: 'USD',
  hashtag: '#AlexAndJordanSayIDo',

  venue: {
    name: 'Hacienda Las Palmas',
    city: 'Tulum',
    region: 'Quintana Roo, Mexico',
    searchName: 'Tulum, Mexico', // used to prefill hotel/Airbnb search sites
  },

  // Dates you'd suggest guests arrive and leave
  suggestedArrive: '2027-05-20',
  suggestedDepart: '2027-05-24',

  airports: [
    { code: 'CUN', name: 'Cancún International', minutesToVenue: 110 },
    { code: 'TQO', name: 'Tulum International', minutesToVenue: 30 },
  ],

  // ---------- WEDDING EVENTS (free, shown on everyone's itinerary) ----------
  events: [
    { id: 'welcome', name: 'Welcome Party', date: '2027-05-21', time: '7:00 PM', place: 'Casa Selva rooftop' },
    { id: 'ceremony', name: 'Ceremony & Reception', date: '2027-05-22', time: '4:00 PM', place: 'Hacienda Las Palmas' },
    { id: 'brunch', name: 'Farewell Brunch', date: '2027-05-23', time: '11:00 AM', place: 'Playa Azul beach club' },
  ],

  // ---------- PLACES TO STAY ----------
  // type: 'hotel' | 'villa' | 'airbnb'
  // nightly = price per room/home per night; maxGuests = people per room/home
  // taxRate = taxes as a decimal (0.19 = 19%); cleaningFee = one-time per room/home
  stays: [
    {
      id: 's-oasis', type: 'hotel', name: 'Grand Oasis Tulum Resort', nightly: 289, maxGuests: 3,
      taxRate: 0.19, rating: 4.6, minutesToVenue: 10,
      perk: 'Wedding room block — use code ALEXJORDAN27 for 15% off (book by Mar 1)',
      amenities: ['All-inclusive option', 'Beachfront', 'Pool', 'Shuttle to venue'],
      url: 'https://www.booking.com/',
    },
    {
      id: 's-selva', type: 'hotel', name: 'Casa Selva Boutique Hotel', nightly: 185, maxGuests: 2,
      taxRate: 0.19, rating: 4.7, minutesToVenue: 15,
      perk: 'Welcome party is on the rooftop here',
      amenities: ['Breakfast included', 'Rooftop pool', 'Walk to town'],
      url: 'https://www.booking.com/',
    },
    {
      id: 's-playa', type: 'hotel', name: 'Playa Azul Beach Hotel', nightly: 340, maxGuests: 2,
      taxRate: 0.19, rating: 4.8, minutesToVenue: 20,
      amenities: ['Beachfront', 'Spa', 'Adults only'],
      url: 'https://www.booking.com/',
    },
    {
      id: 's-centro', type: 'hotel', name: 'Hotel Centro Tulum', nightly: 112, maxGuests: 3,
      taxRate: 0.19, rating: 4.2, minutesToVenue: 25,
      amenities: ['Pool', 'Free parking', 'Near bus station'],
      url: 'https://www.booking.com/',
    },
    {
      id: 's-coco', type: 'hotel', name: 'Hostal Coco (budget)', nightly: 64, maxGuests: 2,
      taxRate: 0.16, rating: 4.0, minutesToVenue: 25,
      amenities: ['Private rooms', 'Bike rental', 'Social vibe'],
      url: 'https://www.hostelworld.com/',
    },
    {
      id: 's-jaguar', type: 'villa', name: 'Villa Sol de Jaguar — 5BR, private pool', nightly: 950, maxGuests: 10,
      cleaningFee: 250, taxRate: 0.16, rating: 4.9, minutesToVenue: 12,
      perk: 'Great for a family or friend group — split the cost',
      amenities: ['Private chef available', 'Private pool', '5 bedrooms'],
      url: 'https://www.vrbo.com/',
    },
    {
      id: 's-mar', type: 'villa', name: 'Villa Mar — 3BR near the beach', nightly: 520, maxGuests: 6,
      cleaningFee: 180, taxRate: 0.16, rating: 4.7, minutesToVenue: 18,
      amenities: ['Plunge pool', 'Bikes included', '3 bedrooms'],
      url: 'https://www.vrbo.com/',
    },
    {
      id: 's-loft', type: 'airbnb', name: 'Jungle Loft — 1BR', nightly: 140, maxGuests: 2,
      cleaningFee: 60, taxRate: 0.16, rating: 4.85, minutesToVenue: 14,
      amenities: ['Hammock deck', 'Kitchen', 'Wi-Fi'],
      url: 'https://www.airbnb.com/',
    },
    {
      id: 's-zama', type: 'airbnb', name: 'Aldea Zama Condo — 2BR', nightly: 210, maxGuests: 4,
      cleaningFee: 90, taxRate: 0.16, rating: 4.75, minutesToVenue: 16,
      amenities: ['Shared pool', 'Kitchen', 'Gym'],
      url: 'https://www.airbnb.com/',
    },
    {
      id: 's-house', type: 'airbnb', name: 'Family House — 4BR with garden', nightly: 420, maxGuests: 8,
      cleaningFee: 150, taxRate: 0.16, rating: 4.8, minutesToVenue: 20,
      amenities: ['Garden', 'BBQ', 'Washer'],
      url: 'https://www.airbnb.com/',
    },
  ],

  // ---------- FLIGHTS ----------
  // price = ROUND-TRIP per person. stops: 0 = direct. via = connection airports.
  // Add any home airports your guests fly from. Guests can also add flights they find.
  flights: [
    // New York
    { id: 'f-jfk-1', from: 'JFK', fromCity: 'New York', to: 'CUN', airline: 'JetBlue', stops: 0, via: [], durationMinutes: 245, departTime: '08:00', price: 520 },
    { id: 'f-jfk-2', from: 'JFK', fromCity: 'New York', to: 'TQO', airline: 'Delta', stops: 0, via: [], durationMinutes: 260, departTime: '09:45', price: 610 },
    { id: 'f-jfk-3', from: 'JFK', fromCity: 'New York', to: 'CUN', airline: 'Delta', stops: 1, via: ['ATL'], durationMinutes: 400, departTime: '06:10', price: 410 },
    { id: 'f-jfk-4', from: 'JFK', fromCity: 'New York', to: 'CUN', airline: 'American', stops: 1, via: ['MIA'], durationMinutes: 415, departTime: '11:30', price: 385 },
    { id: 'f-jfk-5', from: 'JFK', fromCity: 'New York', to: 'CUN', airline: 'Spirit', stops: 2, via: ['BWI', 'FLL'], durationMinutes: 680, departTime: '05:30', price: 265 },
    // Los Angeles
    { id: 'f-lax-1', from: 'LAX', fromCity: 'Los Angeles', to: 'CUN', airline: 'American', stops: 0, via: [], durationMinutes: 285, departTime: '07:15', price: 560 },
    { id: 'f-lax-2', from: 'LAX', fromCity: 'Los Angeles', to: 'CUN', airline: 'United', stops: 1, via: ['IAH'], durationMinutes: 425, departTime: '06:00', price: 430 },
    { id: 'f-lax-3', from: 'LAX', fromCity: 'Los Angeles', to: 'CUN', airline: 'Volaris', stops: 1, via: ['GDL'], durationMinutes: 470, departTime: '10:20', price: 390 },
    { id: 'f-lax-4', from: 'LAX', fromCity: 'Los Angeles', to: 'CUN', airline: 'Spirit', stops: 2, via: ['LAS', 'FLL'], durationMinutes: 720, departTime: '22:30', price: 300 },
    // Chicago
    { id: 'f-ord-1', from: 'ORD', fromCity: 'Chicago', to: 'CUN', airline: 'United', stops: 0, via: [], durationMinutes: 235, departTime: '08:40', price: 480 },
    { id: 'f-ord-2', from: 'ORD', fromCity: 'Chicago', to: 'CUN', airline: 'Southwest', stops: 1, via: ['HOU'], durationMinutes: 370, departTime: '07:05', price: 360 },
    { id: 'f-ord-3', from: 'ORD', fromCity: 'Chicago', to: 'CUN', airline: 'Frontier', stops: 2, via: ['DEN', 'MCO'], durationMinutes: 610, departTime: '06:00', price: 250 },
    // Atlanta
    { id: 'f-atl-1', from: 'ATL', fromCity: 'Atlanta', to: 'CUN', airline: 'Delta', stops: 0, via: [], durationMinutes: 155, departTime: '09:30', price: 420 },
    { id: 'f-atl-2', from: 'ATL', fromCity: 'Atlanta', to: 'TQO', airline: 'Delta', stops: 0, via: [], durationMinutes: 170, departTime: '12:15', price: 480 },
    { id: 'f-atl-3', from: 'ATL', fromCity: 'Atlanta', to: 'CUN', airline: 'Southwest', stops: 1, via: ['MCO'], durationMinutes: 320, departTime: '07:40', price: 330 },
    // Dallas
    { id: 'f-dfw-1', from: 'DFW', fromCity: 'Dallas', to: 'CUN', airline: 'American', stops: 0, via: [], durationMinutes: 170, departTime: '10:05', price: 440 },
    { id: 'f-dfw-2', from: 'DFW', fromCity: 'Dallas', to: 'CUN', airline: 'Spirit', stops: 1, via: ['IAH'], durationMinutes: 360, departTime: '06:45', price: 290 },
    { id: 'f-dfw-3', from: 'DFW', fromCity: 'Dallas', to: 'CUN', airline: 'Volaris', stops: 2, via: ['MTY', 'MEX'], durationMinutes: 590, departTime: '05:50', price: 240 },
    // Houston
    { id: 'f-iah-1', from: 'IAH', fromCity: 'Houston', to: 'CUN', airline: 'United', stops: 0, via: [], durationMinutes: 140, departTime: '09:00', price: 380 },
    { id: 'f-iah-2', from: 'IAH', fromCity: 'Houston', to: 'CUN', airline: 'Spirit', stops: 1, via: ['FLL'], durationMinutes: 300, departTime: '13:20', price: 260 },
    // Miami
    { id: 'f-mia-1', from: 'MIA', fromCity: 'Miami', to: 'CUN', airline: 'American', stops: 0, via: [], durationMinutes: 115, departTime: '10:40', price: 350 },
    { id: 'f-mia-2', from: 'MIA', fromCity: 'Miami', to: 'TQO', airline: 'American', stops: 0, via: [], durationMinutes: 125, departTime: '14:10', price: 395 },
    { id: 'f-mia-3', from: 'MIA', fromCity: 'Miami', to: 'CUN', airline: 'Avianca', stops: 1, via: ['SAL'], durationMinutes: 390, departTime: '06:30', price: 240 },
    // San Francisco
    { id: 'f-sfo-1', from: 'SFO', fromCity: 'San Francisco', to: 'CUN', airline: 'United', stops: 0, via: [], durationMinutes: 320, departTime: '00:15', price: 590 },
    { id: 'f-sfo-2', from: 'SFO', fromCity: 'San Francisco', to: 'CUN', airline: 'Alaska', stops: 1, via: ['LAX'], durationMinutes: 460, departTime: '07:00', price: 470 },
    { id: 'f-sfo-3', from: 'SFO', fromCity: 'San Francisco', to: 'CUN', airline: 'Delta', stops: 1, via: ['ATL'], durationMinutes: 490, departTime: '08:25', price: 520 },
    { id: 'f-sfo-4', from: 'SFO', fromCity: 'San Francisco', to: 'CUN', airline: 'Spirit', stops: 2, via: ['LAS', 'IAH'], durationMinutes: 760, departTime: '21:00', price: 380 },
    // Toronto
    { id: 'f-yyz-1', from: 'YYZ', fromCity: 'Toronto', to: 'CUN', airline: 'Air Canada', stops: 0, via: [], durationMinutes: 240, departTime: '08:20', price: 650 },
    { id: 'f-yyz-2', from: 'YYZ', fromCity: 'Toronto', to: 'CUN', airline: 'WestJet', stops: 0, via: [], durationMinutes: 245, departTime: '13:45', price: 590 },
    { id: 'f-yyz-3', from: 'YYZ', fromCity: 'Toronto', to: 'CUN', airline: 'American', stops: 1, via: ['MIA'], durationMinutes: 420, departTime: '06:15', price: 480 },
    // London
    { id: 'f-lhr-1', from: 'LHR', fromCity: 'London', to: 'CUN', airline: 'British Airways', stops: 0, via: [], durationMinutes: 660, departTime: '10:35', price: 1150 },
    { id: 'f-lhr-2', from: 'LHR', fromCity: 'London', to: 'CUN', airline: 'American', stops: 1, via: ['MIA'], durationMinutes: 840, departTime: '09:10', price: 890 },
    { id: 'f-lhr-3', from: 'LHR', fromCity: 'London', to: 'CUN', airline: 'Iberia', stops: 2, via: ['MAD', 'MEX'], durationMinutes: 1080, departTime: '07:00', price: 720 },
  ],

  // ---------- CAR RENTALS & GETTING AROUND ----------
  // pricing: 'daily' (daily + insuranceDaily, per vehicle) | 'flat' (per vehicle, whole trip) | 'perPerson' (whole trip)
  cars: [
    { id: 'c-economy', company: 'Hertz', name: 'Economy (Nissan March or similar)', pricing: 'daily', daily: 38, insuranceDaily: 22, seats: 4, pickup: 'CUN airport', url: 'https://www.hertz.com/' },
    { id: 'c-suv', company: 'Avis', name: 'Compact SUV (Kia Seltos or similar)', pricing: 'daily', daily: 62, insuranceDaily: 24, seats: 5, pickup: 'CUN airport', url: 'https://www.avis.com/' },
    { id: 'c-jeep', company: 'America Car Rental', name: 'Jeep Wrangler 4-door', pricing: 'daily', daily: 85, insuranceDaily: 25, seats: 4, pickup: 'CUN airport', url: 'https://www.americacarrental.com/' },
    { id: 'c-van', company: 'Enterprise', name: 'Minivan (Toyota Sienna or similar)', pricing: 'daily', daily: 95, insuranceDaily: 26, seats: 7, pickup: 'CUN airport', url: 'https://www.enterprise.com/' },
    { id: 'c-shuttle', company: 'Wedding Shuttle', name: 'Shared airport shuttle (round trip)', pricing: 'perPerson', price: 45, seats: 12, pickup: 'CUN & TQO', note: 'Runs May 20–24 to all wedding hotels' },
    { id: 'c-transfer', company: 'Tulum Transfers', name: 'Private van transfer (round trip)', pricing: 'flat', price: 260, seats: 8, pickup: 'CUN airport', url: 'https://www.google.com/search?q=cancun+airport+private+transfer+tulum' },
  ],
  // Note: Mexico requires local liability insurance on rentals — it's included above as insuranceDaily.

  // ---------- THINGS TO DO ----------
  // price = per person. durationHours = how long it takes.
  activities: [
    { id: 'a-ruins', name: 'Tulum Ruins guided tour', category: 'Culture', price: 45, durationHours: 3, rating: 4.7 },
    { id: 'a-cenote', name: 'Cenote snorkeling trip', category: 'Adventure', price: 85, durationHours: 4, rating: 4.9 },
    { id: 'a-beach', name: 'Beach club day pass', category: 'Relax', price: 50, durationHours: 5, rating: 4.4 },
    { id: 'a-coba', name: 'Cobá ruins by bike', category: 'Adventure', price: 70, durationHours: 5, rating: 4.6 },
    { id: 'a-cooking', name: 'Mexican cooking class', category: 'Food', price: 95, durationHours: 3, rating: 4.8 },
    { id: 'a-spa', name: 'Mayan spa massage', category: 'Relax', price: 120, durationHours: 2, rating: 4.7 },
    { id: 'a-sian', name: "Sian Ka'an biosphere boat tour", category: 'Nature', price: 150, durationHours: 7, rating: 4.9 },
    { id: 'a-chichen', name: 'Chichén Itzá day trip', category: 'Culture', price: 139, durationHours: 10, rating: 4.6 },
    { id: 'a-isla', name: 'Isla Mujeres catamaran', category: 'Adventure', price: 110, durationHours: 8, rating: 4.5 },
    { id: 'a-tacos', name: 'Tulum taco crawl', category: 'Food', price: 40, durationHours: 3, rating: 4.6 },
  ],
};
