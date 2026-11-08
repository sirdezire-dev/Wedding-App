/*
 * Links — prefilled "search live prices" links for popular travel sites.
 */
(function (root) {
  'use strict';

  const enc = encodeURIComponent;
  const yymmdd = (iso) => iso.replace(/-/g, '').slice(2);

  function flightLinks({ from, to, arrive, depart, travelers, maxStops }) {
    const f = (from || '').toUpperCase();
    const kayakStops = maxStops === 0 ? '&fs=stops=0' : maxStops === 1 ? '&fs=stops=-2' : '';
    return [
      {
        label: 'Google Flights',
        url: `https://www.google.com/travel/flights?q=${enc(
          `Flights from ${f} to ${to} on ${arrive} through ${depart} ${travelers} passengers${maxStops === 0 ? ' nonstop' : ''}`
        )}`,
      },
      {
        label: 'Kayak',
        url: `https://www.kayak.com/flights/${f}-${to}/${arrive}/${depart}/${travelers}adults?sort=bestflight_a${kayakStops}`,
      },
      {
        label: 'Skyscanner',
        url: `https://www.skyscanner.com/transport/flights/${f.toLowerCase()}/${to.toLowerCase()}/${yymmdd(arrive)}/${yymmdd(depart)}/?adults=${travelers}${maxStops === 0 ? '&preferdirects=true' : ''}`,
      },
      {
        label: 'Expedia',
        url: `https://www.expedia.com/Flights-Search?trip=roundtrip&leg1=${enc(`from:${f},to:${to},departure:${arrive}TANYT`)}&leg2=${enc(`from:${to},to:${f},departure:${depart}TANYT`)}&passengers=${enc(`adults:${travelers}`)}`,
      },
    ];
  }

  function stayLinks({ place, arrive, depart, travelers }) {
    return [
      { label: 'Booking.com (hotels)', url: `https://www.booking.com/searchresults.html?ss=${enc(place)}&checkin=${arrive}&checkout=${depart}&group_adults=${travelers}&no_rooms=1` },
      { label: 'Airbnb', url: `https://www.airbnb.com/s/${enc(place)}/homes?checkin=${arrive}&checkout=${depart}&adults=${travelers}` },
      { label: 'Vrbo (villas & homes)', url: `https://www.vrbo.com/search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
      { label: 'Expedia', url: `https://www.expedia.com/Hotel-Search?destination=${enc(place)}&startDate=${arrive}&endDate=${depart}&adults=${travelers}` },
      { label: 'Google Hotels', url: `https://www.google.com/travel/search?q=${enc(`hotels in ${place}`)}&checkin=${arrive}&checkout=${depart}` },
    ];
  }

  function carLinks({ airport, arrive, depart }) {
    return [
      { label: 'Kayak cars', url: `https://www.kayak.com/cars/${airport}/${arrive}/${depart}` },
      { label: 'Expedia cars', url: `https://www.expedia.com/carsearch?locn=${airport}&date1=${arrive}&date2=${depart}` },
      { label: 'Discover Cars', url: `https://www.discovercars.com/?q=${enc(airport + ' airport')}` },
    ];
  }

  function activityLinks({ place }) {
    return [
      { label: 'Viator', url: `https://www.viator.com/searchResults/all?text=${enc(place)}` },
      { label: 'GetYourGuide', url: `https://www.getyourguide.com/s/?q=${enc(place)}` },
      { label: 'Airbnb Experiences', url: `https://www.airbnb.com/s/${enc(place)}/experiences` },
    ];
  }

  root.Links = { flightLinks, stayLinks, carLinks, activityLinks };
})(window);
