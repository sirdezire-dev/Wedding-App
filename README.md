# Deividas & Gina — Wedding Travel Planner

The Red Earth Venue, Moab, Utah

A simple, large-print website that helps every guest plan and book their trip to the wedding weekend (May 27–29, 2027). It covers flights, hotels, vacation homes, Airbnbs, rental cars, shuttles and things to do, all within the guest's budget.

It's designed so older guests can use it on their own: one step at a time, big text and buttons, a text-size switch, plain language, and step-by-step booking buttons.

## How it works for guests

1. **Where are you traveling from?** Guests type their home address, town or ZIP code, or tap "Use my current location". The site finds their nearest airports and how far they are from the venue.
2. **When, and who's coming?** Arrival and leaving days (prefilled with the suggested dates) and the number of people. There's an optional "sharing with other guests" setting that splits the cost of the house and car fairly. Guests are warned if their dates miss a wedding event.
3. **Budget.** A total for the whole trip, plus optional limits for flights, place to stay, and car or shuttle. Options over a limit are hidden. If there's no total, the limits are added together to make one.
4. **Choose a package.** Four packages at rising price levels within the budget: *Budget saver*, *Good value*, *Comfort* and *Treat yourself*. In each package, the flight, the place to stay and the car can be swapped with a drop-down. It only lists options found for that guest: their airports, their limits, and a car or shuttle at the airport they fly into. Every item has a **Check live price** button, and a **Found a different price online?** box where guests can type the real price. Totals update right away. **Show this trip on a map** draws the route (home → airport → connections → arrival → drive → place to stay → venue) with written steps and Google Maps directions.
5. **Choose each part yourself.** Tabs for Getting there (direct, 1-stop and 2-stop flights into Moab, Grand Junction, Salt Lake City or Denver, plus "drive your own car" when the trip is about 12 hours or less), Places to stay, Cars & shuttles (picked up at the airport they fly into), and Things to do (with an "easy only" filter).
6. **Your trip summary.** Every item the guest chose, each with a price (marked *Estimate* or *Price you found*), a **Book on …** button, a **Change** button and an "I've booked this" tick box. Below that: a map of the route, the total against the budget, a day-by-day view, and buttons to print it or copy it to send to the couple.

A bar at the bottom of the screen always shows the trip total and how much budget is left. Everything is saved on the guest's own device.

## About the prices

The flight fares and travel times are **estimates**, worked out from distance, number of stops and airport. Hotel, car and activity prices are typical late-May prices set in `data/wedding.js`. Guests always see the real price on the booking site before they pay. Address search and maps use the free OpenStreetMap service (maps are drawn with Leaflet). If that service doesn't respond, guests can pick their nearest airport instead.

## Make it yours: edit `data/wedding.js`

- `events`: the times and places for the weekend (they currently say "To be announced")
- `help`: a name and phone number guests can call for help with booking
- `stays`: add room-block codes with `perk: '...'` and your own booking links with `url: '...'`. Check the prices and the minutes to the venue.
- `cars`, `transfers`, `activities`: prices and notes

## Share it with guests (free, works on any phone)

The site is hosted for free with GitHub Pages. Guests only need the link: no app, no account and no Claude.

**One-time setup:** on GitHub, open the repository, then go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, pick the branch `claude/wedding-guest-travel-planner-0i8xpc` and the `/ (root)` folder, then click **Save**. After a minute or two, the site is live at:

**https://sirdezire-dev.github.io/Wedding-App/**

Text or email that link, or put it on your invitations (a QR code works too). Updates go live automatically a minute after each change.

## Run it locally and test

- Open `index.html` in a browser, or run `npm start`.
- Run the tests with `npm test`.
