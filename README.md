# Wedding Travel Planner

A website for your wedding guests to plan their trip: flights, hotels, villas, Airbnbs, car rentals and things to do. Guests enter their budget, see every trip that fits it, and compare their options side by side.

There's no build step and no server. It's plain HTML, CSS and JavaScript, so you can host it for free on GitHub Pages.

## What guests can do

1. **Enter their trip details.** Home airport, arrival and departure dates, number of travelers, budget, and how many people are sharing costs.
2. **✨ What fits my budget.** Every combination of flight, stay and transport, priced for their party and dates. They can sort by lowest total, most activities, best-rated stay, closest to the venue or shortest flight, and filter by stops, stay type, or "no car". Each trip shows what the leftover money buys in activities that also fit their free time.
3. **✈️ Flights.** Nonstop, 1-stop and multi-stop options, sorted by price, travel time or departure time. One-tap live searches on Google Flights, Kayak, Skyscanner and Expedia, with their airports, dates and party size filled in.
4. **🏨 Stays.** Hotels, villas and Airbnbs with total cost: nights × rooms + fees + taxes, split fairly when sharing. Room-block perks are highlighted. Live searches on Booking.com, Airbnb, Vrbo, Expedia and Google Hotels.
5. **🚗 Cars & transport.** Rental cars (including required local insurance), shuttles and private transfers, plus live searches on Kayak, Expedia and Discover Cars.
6. **🌴 Things to do.** The wedding-weekend itinerary, the free hours they have, and the most activities they can afford. Each activity shows whether it fits their budget and their schedule.
7. **⚖️ Compare trips.** Save up to 4 trips and compare them side by side. The best value in each row is highlighted. They can also copy a trip summary to share.

The sticky budget bar always shows what's spent, what's left, and whether they're over budget. If their home airport isn't listed, or they find a better deal elsewhere, they can **add their own flight, stay, car or activity**, and it's included in the budget finder. Everything saves in their browser automatically.

## Make it yours

Edit **`data/wedding.js`**. Everything guests see comes from this file:

- names, date, venue and suggested arrival and departure dates
- airports near the venue
- wedding events (welcome party, ceremony, brunch…)
- stays (`hotel` / `villa` / `airbnb`) with nightly price, sleeps, fees, tax, room-block codes and booking links
- flights from your guests' home cities (`stops: 0` = direct)
- cars, shuttles and transfers
- activities

The data in the file now is **sample data** (a Tulum, Mexico wedding). Replace it with your own details.

## Run it

Open `index.html` in a browser, or run `npm start` for a local server.

Run the tests with `npm test`.

## Publish on GitHub Pages

Go to **Settings → Pages → Build and deployment**. Choose *Deploy from a branch*, pick your branch and `/ (root)`, then save. Share the link with your guests.
