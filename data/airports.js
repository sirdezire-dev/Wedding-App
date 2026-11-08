/*
 * Airports used to work out the nearest airport to a guest's address and to
 * estimate flight options. lat/lon are approximate (good enough for distances).
 * big: 1 = has direct flights to Salt Lake City and Denver.
 */
(function (root) {
  const A = (code, city, lat, lon, big, intl) => ({ code, city, lat, lon, big: !!big, intl: !!intl });
  const AIRPORTS = [
    A('ATL', 'Atlanta, GA', 33.64, -84.43, 1), A('AUS', 'Austin, TX', 30.19, -97.67, 1),
    A('BNA', 'Nashville, TN', 36.12, -86.68, 1), A('BOI', 'Boise, ID', 43.56, -116.22, 1),
    A('BOS', 'Boston, MA', 42.36, -71.01, 1), A('BUR', 'Burbank, CA', 34.20, -118.36, 1),
    A('BWI', 'Baltimore, MD', 39.18, -76.67, 1), A('BZN', 'Bozeman, MT', 45.78, -111.15, 1),
    A('CLE', 'Cleveland, OH', 41.41, -81.85, 0), A('CLT', 'Charlotte, NC', 35.21, -80.94, 1),
    A('CMH', 'Columbus, OH', 40.00, -82.89, 1), A('COS', 'Colorado Springs, CO', 38.81, -104.70, 0),
    A('CVG', 'Cincinnati, OH', 39.05, -84.66, 1), A('DAL', 'Dallas Love Field, TX', 32.85, -96.85, 0),
    A('DCA', 'Washington National, DC', 38.85, -77.04, 1), A('DEN', 'Denver, CO', 39.86, -104.67, 1),
    A('DFW', 'Dallas/Fort Worth, TX', 32.90, -97.04, 1), A('DSM', 'Des Moines, IA', 41.53, -93.66, 0),
    A('DTW', 'Detroit, MI', 42.21, -83.35, 1), A('ELP', 'El Paso, TX', 31.81, -106.38, 0),
    A('EWR', 'Newark, NJ', 40.69, -74.17, 1), A('FLL', 'Fort Lauderdale, FL', 26.07, -80.15, 0),
    A('HNL', 'Honolulu, HI', 21.32, -157.92, 1), A('HOU', 'Houston Hobby, TX', 29.65, -95.28, 0),
    A('IAD', 'Washington Dulles, VA', 38.95, -77.46, 1), A('IAH', 'Houston, TX', 29.99, -95.34, 1),
    A('IND', 'Indianapolis, IN', 39.72, -86.29, 1), A('JAX', 'Jacksonville, FL', 30.49, -81.69, 0),
    A('JFK', 'New York JFK, NY', 40.64, -73.78, 1), A('LAS', 'Las Vegas, NV', 36.08, -115.15, 1),
    A('LAX', 'Los Angeles, CA', 33.94, -118.41, 1), A('LGA', 'New York LaGuardia, NY', 40.78, -73.87, 1),
    A('LGB', 'Long Beach, CA', 33.82, -118.15, 1), A('MCI', 'Kansas City, MO', 39.30, -94.71, 1),
    A('MCO', 'Orlando, FL', 28.43, -81.31, 1), A('MDW', 'Chicago Midway, IL', 41.79, -87.75, 1),
    A('MEM', 'Memphis, TN', 35.04, -89.98, 0), A('MIA', 'Miami, FL', 25.80, -80.29, 0),
    A('MKE', 'Milwaukee, WI', 42.95, -87.90, 1), A('MSP', 'Minneapolis, MN', 44.88, -93.22, 1),
    A('MSY', 'New Orleans, LA', 29.99, -90.26, 1), A('OAK', 'Oakland, CA', 37.72, -122.22, 1),
    A('OKC', 'Oklahoma City, OK', 35.39, -97.60, 0), A('OMA', 'Omaha, NE', 41.30, -95.89, 1),
    A('ONT', 'Ontario, CA', 34.06, -117.60, 1), A('ORD', "Chicago O'Hare, IL", 41.98, -87.90, 1),
    A('PDX', 'Portland, OR', 45.59, -122.60, 1), A('PHL', 'Philadelphia, PA', 39.87, -75.24, 1),
    A('PHX', 'Phoenix, AZ', 33.43, -112.01, 1), A('PIT', 'Pittsburgh, PA', 40.49, -80.23, 0),
    A('RDU', 'Raleigh-Durham, NC', 35.88, -78.79, 1), A('RIC', 'Richmond, VA', 37.51, -77.32, 0),
    A('RNO', 'Reno, NV', 39.50, -119.77, 1), A('SAN', 'San Diego, CA', 32.73, -117.19, 1),
    A('SAT', 'San Antonio, TX', 29.53, -98.47, 1), A('SDF', 'Louisville, KY', 38.17, -85.74, 0),
    A('SEA', 'Seattle, WA', 47.45, -122.31, 1), A('SFO', 'San Francisco, CA', 37.62, -122.38, 1),
    A('SJC', 'San Jose, CA', 37.36, -121.93, 1), A('SMF', 'Sacramento, CA', 38.70, -121.59, 1),
    A('SNA', 'Orange County, CA', 33.68, -117.87, 1), A('STL', 'St. Louis, MO', 38.75, -90.37, 1),
    A('TPA', 'Tampa, FL', 27.98, -82.53, 1), A('TUL', 'Tulsa, OK', 36.20, -95.89, 0),
    A('TUS', 'Tucson, AZ', 32.12, -110.94, 1), A('ABQ', 'Albuquerque, NM', 35.04, -106.61, 1),
    A('ANC', 'Anchorage, AK', 61.17, -150.00, 1),
    A('YYZ', 'Toronto, Canada', 43.68, -79.63, 0, 1), A('YVR', 'Vancouver, Canada', 49.19, -123.18, 1, 1),
    A('YYC', 'Calgary, Canada', 51.13, -114.01, 1, 1), A('YUL', 'Montreal, Canada', 45.47, -73.74, 0, 1),
    A('MEX', 'Mexico City, Mexico', 19.44, -99.07, 0, 1), A('LHR', 'London, UK', 51.47, -0.45, 0, 1),
    A('FRA', 'Frankfurt, Germany', 50.04, 8.56, 0, 1), A('AMS', 'Amsterdam, Netherlands', 52.31, 4.76, 0, 1),
    // Arrival airports near the venue (also needed for connections)
    A('SLC', 'Salt Lake City, UT', 40.79, -111.98, 1), A('GJT', 'Grand Junction, CO', 39.12, -108.53, 0),
    A('CNY', 'Moab (Canyonlands), UT', 38.755, -109.755, 0),
  ];

  // Connection hubs and the airlines that usually fly through them.
  const HUBS = {
    DEN: 'United or Southwest', PHX: 'American or Southwest', DFW: 'American', ATL: 'Delta',
    MSP: 'Delta', LAS: 'Southwest', SLC: 'Delta', ORD: 'United or American', CLT: 'American',
  };

  root.AIRPORTS = AIRPORTS;
  root.HUBS = HUBS;
  if (typeof module !== 'undefined' && module.exports) module.exports = { AIRPORTS, HUBS };
})(typeof window !== 'undefined' ? window : globalThis);
