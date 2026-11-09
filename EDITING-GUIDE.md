# Deividas & Gina wedding travel site — guide for editing

This guide is for anyone editing the site, including AI assistants like ChatGPT or Claude. It explains what the site does, where everything is, and how to make changes safely.

## Links

- **Live site for guests:** https://sirdezire-dev.github.io/Wedding-App/
- **Couple's "Who's staying with who" page:** https://sirdezire-dev.github.io/Wedding-App/couple.html (needs the passcode set in the Google Sheet script)
- **Code (GitHub):** https://github.com/sirdezire-dev/Wedding-App (branch `claude/wedding-guest-travel-planner-0i8xpc`, which is the default branch and what the live site publishes)
- **Guest answers (Google Sheet, private):** https://docs.google.com/spreadsheets/d/1MHg4Br30pPgHFvzlk7lh_hBgT_3V_-1bM6fDpex-L5I/edit
- **Steps to turn on guest answers (Google Doc):** https://docs.google.com/document/d/1MdUGGSzga4fV0VBlenWN9yGdaZe9vDnUIkTHyAr-8cs/edit

## What the site does

A travel planner for guests coming to the wedding weekend, **May 27–29, 2027**, at **The Red Earth Venue, 545 W State Road 313, Moab, Utah**. It's designed so older guests can book on their own: large text, big buttons, plain language and one step at a time.

- **Book directly:** big buttons to Google Flights, Booking.com, Airbnb, Vrbo and rental cars, with the wedding dates already filled in.
- **Six guided steps:** each is a collapsible section, and finishing one opens the next.
  1. Where are you traveling from? (address search with OpenStreetMap; finds the nearest airports)
  2. Dates, number of people, names, and **"Will you be staying with other wedding guests?"** If yes, guests tap an existing group or start a new one; group names come from the Google Sheet (`?action=groups`).
  3. Budget for the whole trip, plus optional limits for flights, place to stay, and car or shuttle
  4. Three packages (Saver, Comfort, Luxury) that open and close. Each part can be swapped, prices found online can be entered, and the trip can be shown on a map.
  5. Add things to do, or change any part
  6. Summary of everything chosen, with booking buttons, "I've booked this" tick boxes, a route map, the total against the budget, and a button to send the plans to the couple
- **$ USD / £ GBP switch** for every price
- **Couple's page (couple.html):** groups guests who are staying together, with a passcode

Flight prices are **estimates**, worked out from distance, number of stops and airport. Hotel, car and activity prices are typical late-May prices set in `data/wedding.js`. Guests see the real price on the booking site.

## Where things are

| File | What it is |
|---|---|
| `data/wedding.js` | **Most edits happen here:** names, dates, venue, events, hotels and homes, cars, shuttles, activities, the exchange-rate fallback, and the Google Sheet link |
| `data/airports.js` | Airports used to estimate flights |
| `index.html` | Guest page layout |
| `couple.html` | Couple's "Who's staying with who" page |
| `css/styles.css` | Look and feel (large type, terracotta colors) |
| `js/app.js` | Guest page behavior (steps, packages, summary, currency, sending answers) |
| `js/planner.js` | Cost and budget maths (tested) |
| `js/travel.js` | Nearest airports, flight estimates, the drive option, address search |
| `js/links.js` | Booking-site links |
| `js/tripmap.js` | Trip map (Leaflet + OpenStreetMap) |
| `js/couple.js` | Couple's page logic |
| `google-apps-script/Code.gs` | The script pasted into the Google Sheet that stores guests' answers |
| `tests/planner.test.js` | Automated tests (`npm test`) |

## Still to do

1. **Turn on guest answers.** Follow the Google Doc linked above, then put the Web app URL in `data/wedding.js` → `responses.endpoint`.
2. **Event times and places.** In `data/wedding.js` → `events`, they currently say "To be announced".
3. **Hotel room blocks or discount codes** (optional). In `data/wedding.js` → `stays`, add `perk: '...'`, and a booking link with `url: '...'`.
4. **"Need help booking?" contact** (optional). In `data/wedding.js` → `help: { name: '...', phone: '...' }`.

## How to make a change

**Easiest way (no tools needed):** open the file on GitHub, click the pencil icon, make the change, then click **Commit changes**. The live site updates about a minute later.

To get write access, a person needs a GitHub account. The repository owner then adds them under **Settings → Collaborators → Add people**.

## Rules for AI assistants editing this site

- It's a **plain static site**: HTML, CSS and JavaScript, with no build step and no frameworks. Keep it that way, so it keeps working on GitHub Pages.
- Commit to the branch `claude/wedding-guest-travel-planner-0i8xpc`. That's the branch the live site publishes from.
- **Prices in `data/wedding.js` are in US dollars.** The currency switch converts them for display. Don't store prices in pounds.
- After changing any file in `js/` or `css/`, **raise the `?v=` number** on the `<script>` and `<link>` tags in `index.html` and `couple.html` (for example `?v=9` → `?v=10`), so guests' phones load the new version.
- Keep the design large, simple and readable for older guests: big buttons (at least 48px tall), plain words, high contrast.
- If you change what gets sent to the Google Sheet, update **both** `plansPayload()` in `js/app.js` **and** `HEADERS` / `doPost` in `google-apps-script/Code.gs`. Then redeploy the script in Google (Deploy → Manage deployments → Edit → New version).
- **Never put the couple's passcode in this repository.** It lives only in the Google Sheet's script.
- Run `npm test` after changing `js/planner.js` or `js/travel.js`.
