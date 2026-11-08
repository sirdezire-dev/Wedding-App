/*
 * Links — booking and search links with the guest's details filled in.
 */
(function (root) {
  'use strict';

  const enc = encodeURIComponent;

  function flight({ from, to, arrive, depart, travelers, stops }) {
    const nonstop = stops === 0;
    return [
      {
        label: 'Google Flights',
        url: `https://www.google.com/travel/flights?q=${enc(
          `Flights from ${from} to ${to} on ${arrive} through ${depart} ${travelers} adults${nonstop ? ' nonstop' : ''}`
        )}`,
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
    return `https://www.google.com/travel/flights?q=${enc(q)}`;
  }

  /** Where to book a particular stay. Uses the couple's link when there is one. */
  function stay(s, { place, arrive, depart, travelers }) {
    if (s.url) return [{ label: 'Book this place', url: s.url }];
    if (s.type === 'hotel')
      return [
        { label: 'Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(`${s.name}, ${place}`)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1` },
        { label: 'Google Hotels', url: `https://www.google.com/travel/search?q=${enc(`${s.name} ${place}`)}&checkin=${arrive}&checkout=${depart}` },
      ];
    if (s.type === 'villa')
      return [
        { label: 'Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
        { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}` },
      ];
    return [
      { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}` },
      { label: 'Vrbo', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
    ];
  }

  function staySearch({ place, arrive, depart, travelers }) {
    return [
      { label: 'Hotels on Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(place)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1` },
      { label: 'Homes on Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}` },
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

  root.Links = { flight, flightTo, stay, staySearch, car, transfer, drive, venueMap, activitySearch };
})(window);
