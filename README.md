# Deividas & Gina — Wedding Travel Planner

The Red Earth Venue, Moab, Utah

A simple, large-print website that helps every guest plan and book their trip to the wedding weekend (May 27–29, 2027). It covers flights, hotels, vacation homes, Airbnbs, rental cars, shuttles and things to do, all within the guest's budget.

It's designed so older guests can use it on their own: one step at a time, big text and buttons, a text-size switch, plain language, and step-by-step booking buttons.

## How it works for guests

1. **Where are you traveling from?** Guests type their home address, town or ZIP code, or tap "Use my current location". The site finds their nearest airports and how far they are from the venue.
2. **When, and who's coming?** Arrival and leaving days (prefilled with the suggested dates) and the number of people. There's an optional "sharing with other guests" setting that splits the cost of the house and car fairly. Guests are warned if their dates miss a wedding event.
3. **Budget.** A total for the whole trip, plus optional limits for flights, place to stay, and car or shuttle. Options over a limit are hidden. If there's no total, the limits are added together to make one.
4. **Trip options.** Three clear suggestions: *Best price*, *Easiest journey* (least door-to-venue time) and *Most comfortable*. Each one shows the full cost and what the leftover money would buy in things to do. Guests can also see every trip that fits, sorted how they like.
5. **Choose each part yourself.** Tabs for Getting there (direct, 1-stop and 2-stop flights into Moab, Grand Junction, Salt Lake City or Denver, plus "drive your own car" when the trip is about 12 hours or less), Places to stay, Cars & shuttles (picked up at the airport they fly into), and Things to do (with an "easy only" filter).
6. **Your trip and how to book it.** The full itinerary, the costs against the budget, and numbered booking steps. Each button opens Google Flights, Kayak, Booking.com, Airbnb and similar sites with the dates and party size already filled in. There are "I've booked this" checkboxes, plus buttons to print the plan, copy it to send to the couple, and compare up to 3 saved trips side by side.

A bar at the bottom of the screen always shows the trip total and how much budget is left. Everything is saved on the guest's own device.

## About the prices

The flight fares and travel times are **estimates**, worked out from distance, number of stops and airport. Hotel, car and activity prices are typical late-May prices set in `data/wedding.js`. Guests always see the real price on the booking site before they pay. Address search uses the free OpenStreetMap service. If that service doesn't respond, guests can pick their nearest airport instead.

## Make it yours: edit `data/wedding.js`

- `events`: the times and places for the weekend (they currently say "To be announced")
- `help`: a name and phone number guests can call for help with booking
- `stays`: add room-block codes with `perk: '...'` and your own booking links with `url: '...'`. Check the prices and the minutes to the venue.
- `cars`, `transfers`, `activities`: prices and notes

## Run it, test it, publish it

- Open `index.html` in a browser, or run `npm start`.
- Run the tests with `npm test`.
- To publish for free: go to GitHub **Settings → Pages**, choose *Deploy from a branch*, pick this branch and `/ (root)`, and save. Share the link with your guests.
