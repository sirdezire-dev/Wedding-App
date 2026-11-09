/*
 * Links — booking and search links with the guest's details filled in.
 */
(function (root) {
  'use strict';

  const enc = encodeURIComponent;
  let cur = 'USD'; // booking sites open in the guest's chosen currency where they support it
  const setCurrency = (c) => (cur = c);

  function flight({ from, to, arrive, depart, travelers, stops }) {
    const nonstop = stops === 0;
    return [
      {
        label: 'Google Flights',
        url: `https://www.google.com/travel/flights?q=${enc(
          `Flights from ${from} to ${to} on ${arrive} through ${depart} ${travelers} adults${nonstop ? ' nonstop' : ''}`
        )}&curr=${cur}`,
      },
      {
        label: 'Kayak',
        url: `https://www.kayak.com/flights/${from}-${to}/${arrive}/${depart}/${travelers}adults?sort=bestflight_a${nonstop ? '&fs=stops=0' : stops === 1 ? '&fs=stops=-2' : ''}`,
      },
      {
        label: 'Expedia',
        url: `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=${enc(`from:${from},to:${to},departure:${arrive}TANYT`)}&leg2=${enc(`from:${to},to:${from},departure:${depart}TANYT`)}&passengers=${enc(`adults:${travelers}`)}`,
      },
    ];
  }

  /** Google Flights search to an airport, with or without a home airport. */
  function flightTo({ from, to, arrive, depart, travelers }) {
    const q = `Flights ${from ? `from ${from} ` : ''}to ${to} on ${arrive} through ${depart} ${travelers} adults`;
    return `https://www.google.com/travel/flights?q=${enc(q)}&curr=${cur}`;
  }

  /** Where to book a particular stay. Uses the couple's link when there is one. */
  function stay(s, { place, arrive, depart, travelers }) {
    if (s.url) return [{ label: 'Book this place', url: s.url }];
    if (s.type === 'hotel')
      return [
        { label: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(`${s.name}, ${place}`)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1&selected_currency=${cur}` },
        { label: 'Google Hotels', url: `https://www.google.com/travel/search?q=${enc(`${s.name} ${place}`)}&checkin=${arrive}&checkout=${depart}` },
      ];
    if (s.type === 'villa')
      return [
        { label: 'Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
        { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}&currency=${cur}` },
      ];
    return [
      { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}&currency=${cur}` },
      { label: 'Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
    ];
  }

  function staySearch({ place, arrive, depart, travelers }) {
    return [
      { label: 'Hotels on Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(place)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1&selected_currency=${cur}` },
      { label: 'Homes on Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}&currency=${cur}` },
      { label: 'Vacation homes on Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
    ];
  }

  function car({ airport, arrive, depart }) {
    return [
      { label: 'Kayak', url: `https://www.kayak.com/cars/${airport}/${arrive}/${depart}` },
      { label: 'Expedia', url: `https://www.expedia.com/carsearch?locn=${airport}&date1=${arrive}&date2=${depart}` },
    ];
  }

  function transfer(t, venue) {
    if (t.url) return [{ label: 'Book this ride', url: t.url }];
    return [{ label: 'Find this service', url: `https://www.google.com/search?q=${enc(`${t.name} ${t.airport} to ${venue.city} ${venue.region}`)}` }];
  }

  function drive(home, venue) {
    const origin = home ? `${home.lat},${home.lon}` : '';
    return [{ label: 'Driving directions', url: `https://www.google.com/maps/dir/?api=1&origin=${enc(origin)}&destination=${enc(venue.address)}` }];
  }

  function venueMap(venue) {
    return `https://www.google.com/maps/search/?api=1&query=${enc(`${venue.name}, ${venue.address}`)}`;
  }

  function activitySearch(place) {
    return [
      { label: 'Viator', url: `https://www.viator.com/searchResults/all?text=${enc(place)}` },
      { label: 'GetYourGuide', url: `https://www.getyourguide.com/s/?q=${enc(place)}` },
    ];
  }

  const yymmdd = (iso) => iso.replace(/-/g, '').slice(2);

  /** Every flight site for a route. Sites that need a home airport are left out without one. */
  function flightSites({ from, to, arrive, depart, travelers }) {
    const f = (from || '').toUpperCase();
    const list = [{ label: 'Google Flights', url: flightTo({ from: f, to, arrive, depart, travelers }) }];
    if (f) {
      list.push(
        { label: 'Kayak', url: `https://www.kayak.com/flights/${f}-${to}/${arrive}/${depart}/${travelers}adults?sort=bestflight_a` },
        { label: 'Skyscanner', url: `https://www.skyscanner.com/transport/flights/${f.toLowerCase()}/${to.toLowerCase()}/${yymmdd(arrive)}/${yymmdd(depart)}/?adults=${travelers}` },
        { label: 'Expedia', url: `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=${enc(`from:${f},to:${to},departure:${arrive}TANYT`)}&leg2=${enc(`from:${to},to:${f},departure:${depart}TANYT`)}&passengers=${enc(`adults:${travelers}`)}` }
      );
    }
    list.push(
      { label: 'Delta', url: 'https://www.delta.com/' },
      { label: 'United', url: 'https://www.united.com/' },
      { label: 'American', url: 'https://www.aa.com/' },
      { label: 'Southwest', url: 'https://www.southwest.com/' }
    );
    return list;
  }

  function hotelSites({ place, arrive, depart, travelers }) {
    return [
      { label: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(place)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1&selected_currency=${cur}` },
      { label: 'Expedia', url: `https://www.expedia.com/Hotel-Search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
      { label: 'Hotels.com', url: `https://www.hotels.com/Hotel-Search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
      { label: 'Kayak', url: `https://www.kayak.com/hotels/${enc(place.replace(/, Utah$/, ',UT'))}/${arrive}/${depart}/${travelers}adults` },
      { label: 'Google Hotels', url: `https://www.google.com/travel/search?q=${enc(`hotels in ${place}`)}&checkin=${arrive}&checkout=${depart}` },
    ];
  }

  function homeSites({ place, arrive, depart, travelers }) {
    return [
      { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}&currency=${cur}` },
      { label: 'Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
      { label: 'Booking.com homes', url: `https://www.booking.com/searchresults.html?ss=${enc(place)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&nflt=ht_id%3D220&selected_currency=${cur}` },
      { label: 'Google vacation rentals', url: `https://www.google.com/travel/search?q=${enc(`vacation rentals in ${place}`)}&checkin=${arrive}&checkout=${depart}` },
    ];
  }

  function carSites({ airport, arrive, depart }) {
    return [
      { label: 'Kayak', url: `https://www.kayak.com/cars/${airport}/${arrive}/${depart}` },
      { label: 'Expedia', url: `https://www.expedia.com/carsearch?locn=${airport}&date1=${arrive}&date2=${depart}` },
      { label: 'Discover Cars', url: `https://www.discovercars.com/?q=${enc(airport + ' airport')}` },
      { label: 'Enterprise', url: 'https://www.enterprise.com/' },
      { label: 'Hertz', url: 'https://www.hertz.com/' },
      { label: 'Avis', url: 'https://www.avis.com/' },
      { label: 'Turo', url: 'https://turo.com/' },
    ];
  }

  root.Links = { setCurrency, flight, flightTo, stay, staySearch, car, transfer, drive, venueMap, activitySearch, flightSites, hotelSites, homeSites, carSites };
})(window);
