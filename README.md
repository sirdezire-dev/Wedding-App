# Deividas & Gina — Wedding Travel Planner

The Red Earth Venue, Moab, Utah

A simple, large-print website that helps every guest plan and book their trip to the wedding weekend (May 27–29, 2027). It covers flights, hotels, vacation homes, Airbnbs, rental cars, shuttles and things to do, all within the guest's budget.

It's designed so older guests can use it on their own: one step at a time, big text and buttons, a text-size switch, plain language, and step-by-step booking buttons.

## How it works for guests

The page is a guided series of sections that open one at a time. Each section is collapsed to a one-line header until it's reached. Finishing a step closes it, shows the answer in its header (with a "Change" button), and opens the next step. Later steps stay locked until earlier ones are done. A separate **Book directly** section at the top is for guests who already know what they want.

1. **Where are you traveling from?** Guests type their home address, town or ZIP code, or tap "Use my current location". The site finds their nearest airports and how far they are from the venue.
2. **When, and who's coming?** Arrival and leaving days (prefilled with the suggested dates) and the number of people. There's an optional "sharing with other guests" setting that splits the cost of the house and car fairly. Guests are warned if their dates miss a wedding event.
3. **Budget.** A total for the whole trip, plus optional limits for flights, place to stay, and car or shuttle. Options over a limit are hidden. If there's no total, the limits are added together to make one.
4. **Choose a package.** Four packages at rising price levels within the budget: *Budget saver*, *Good value*, *Comfort* and *Treat yourself*. In each package, the flight, the place to stay and the car can be swapped with a drop-down. It only lists options found for that guest: their airports, their limits, and a car or shuttle at the airport they fly into. Every item has a **Check live price** button, and a **Found a different price online?** box where guests can type the real price. Totals update right away. **Show this trip on a map** draws the route (home → airport → connections → arrival → drive → place to stay → venue) with written steps and Google Maps directions.
5. **Add things to do, or change any part.** Tabs for Getting there (direct, 1-stop and 2-stop flights into Moab, Grand Junction, Salt Lake City or Denver, plus "drive your own car" when the trip is about 12 hours or less), Places to stay, Cars & shuttles (picked up at the airport they fly into), and Things to do (with an "easy only" filter).
6. **Your trip summary.** Every item the guest chose, each with a price (marked *Estimate* or *Price you found*), a **Book on …** button, a **Change** button and an "I've booked this" tick box. Below that: a map of the route, the total against the budget, a day-by-day view, and buttons to print it or copy it to send to the couple.

A bar at the bottom of the screen always shows the trip total and how much budget is left. Everything is saved on the guest's own device.

## Who's staying with who (for the couple)

In step 2, each guest gives their name(s) and answers **"Will you be staying with other wedding guests?"** If they say yes, a **"Which group are you staying with?"** panel opens. They tap a group someone has already created (it shows how many people are in it and where they're staying), or start a new one that others can then tap. If the group has chosen a place, they're offered **"Choose the same place"**. They also say how many people in total (this splits the cost of the house and car). Other guests only ever see group names, head counts and places. When they continue, and again from their summary, their answers are sent to your **Google Sheet**: names, who they're staying with, where, dates and arrival airport. Their address and budget are never sent.

Open **couple.html** (there's a link at the bottom of the site) and enter your passcode to see:
- **Staying together:** groups of guests who named each other, people who were named but haven't answered yet, and warnings when a group picked different places
- **By place to stay:** who's at each hotel or house
- **Everyone:** a full table, with search and print

Until the sheet is connected, couple.html shows example answers. To connect it, follow [`google-apps-script/SETUP.md`](google-apps-script/SETUP.md) (about 5 minutes), then put the web-app URL in `data/wedding.js` → `responses.endpoint`.

## Currency: US dollars or British pounds

A **$ USD / £ GBP** switch at the top of every page converts every price on the site: packages, totals, every option, the budget boxes, and "price you found" entries. Prices are stored in US dollars and converted with a recent exchange rate (from open.er-api.com, refreshed twice a day), or with `gbpPerUsd` in `data/wedding.js` if that can't be loaded. Phones set to UK English start in pounds. Google Flights, Booking.com and Airbnb open in the chosen currency.

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
