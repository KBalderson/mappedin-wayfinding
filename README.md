# Mall Wayfinding

A mobile-first web app that gets a first-time visitor from where they parked to a specific store. They pick their parking entrance, search for a store and follow step-by-step directions that name real storefronts along the way. It's built with Next.js and [Mappedin JS v6](https://developer.mappedin.com/web-sdk/getting-started).

## Run it

```sh
asdf install            # Node 24 (see .tool-versions)
npm install
cp .env.example .env.local
npm run dev             # http://localhost:3000
```

Other scripts: `npm test` (Vitest), `npm run lint`, `npm run build`.

`.env.example` holds Mappedin's public Enterprise demo credentials. They're read only on the server (see [Credentials](#credentials-server-action)).

## The flow

1. **Where did you park?** The choices are Parking Garage I (main-level or Upper Level entrance), Lot A and Lot B. The choice is remembered for the next visit.
2. **Where to?** Search by store or category, filter with category chips, see recent stores, or tap a storefront on the map. A floor badge flags stores on the Upper Level.
3. **Route preview.** Shows walking time, distance and step count, and whether the trip includes an escalator or elevator.
4. **Turn-by-turn.** One large instruction card with Next/Previous buttons (swiping works too) and an optional list of all steps. For each step the map:
   - highlights that stretch of the route,
   - moves the **You are here** marker to where the step begins,
   - frames the store the instruction mentions, and
   - switches floors automatically.

Routes are deep-linkable: `/?from=garage-main&to=<location id>`. That's also how a printed QR code at each parking entrance would work: `/?from=lot-a` opens with the starting point already set.

## How I built this

I built it with **Claude Code**, using plan mode with a second model as a reviewer, and **Claude in Chrome** to drive the running app and check each change against the map. It took one session, from pasting the brief at 13:02 to a verified build at 16:44 on Oct 26: under four hours of a two-day budget.

**What the AI did fast**
- **Map research.** In the first four minutes it read Mappedin's docs, downloaded both Maker mall bundles and fitted one onto the other. The result: the same floor plan at 2.18× scale, rotated about 11°, with no routable parking. That ruled out combining them before I'd spent any time on it.
- **Keeping the secret server-side.** It read the SDK's minified source to confirm that a server-minted token alone switches it into enterprise mode. That's why the secret can stay on the server (see [Credentials](#credentials-server-action)).
- **Building and checking.** It scaffolded, built and checked all four parking origins in the browser, including floor changes, deep links and the unroutable store.

**Where I steered**
- **The map.** While it was still comparing the Maker maps, I pointed it at the Enterprise demo mall, the one venue with a real parking garage.
- **Scope.** It asked whether to offer a parking picker and whether to route Upper Level stores. I chose both. I deferred real indoor positioning (beacons) and kept QR deep links as the stopgap.
- **Architecture.** I rejected its first plan because it used API routes: server work goes in Server Actions.
- **Direction quality, over three rounds of reading real routes on screen:**
  1. "Turn right, then turn left at Nordstorm" was really a sideways jog into the rotunda. I asked for "Continue straight past the Information Desk", which led to the sidestep detection and the prominent-landmark rule.
  2. "Turn left at The Bombay Company" was a 4 m kink the SDK calls a turn. Before adding a 25° "kink" rule, it swept every route from all four origins: of 6,066 left/right turns, real ones cluster at 70–100°, with a gap around 50–60°.
  3. It then over-applied the sidestep rule to a 25 m jog across the food court. I had it undo that. The sidestep limit dropped from 30 m to 15 m, and a test now pins the food-court case.

**What I didn't take on trust**

Every change to the step wording was checked on the map in the browser, not just in tests. The instruction-engine tests grew from 16 to 21 across those rounds. I also confirmed the key and secret don't appear anywhere in the build output.

**The next day (Oct 27)**

I asked Claude to review the submission the way a Mappedin hiring manager would. That pass produced the [QA checklist](#qa-checklist) from routes run in the app. It also found and fixed the "shoes" search gap and the "Nordstorm" typo. One catch: part of the QA had first been run against a stale build, so I re-ran those routes on the current one.

The work was committed in logical chunks after the fact, on Oct 27. Commit times are when the commits were made, not backdated; the times above are the real build timeline from the session.

## Design decisions

### Which map
The demo page offers two Maker mall maps, "Mall Demo – Consumer" (stores) and "Mall Demo – Facility" (parking). Their MVF bundles turned out to be the **same floor plan at different scales (about 2.2×) and different geolocations**. The Facility map's only parking feature is a single point with no route node attached. They can't be rendered together, so "combining" them would have meant copying labels from one onto the other.

The **Enterprise "Mappedin Demo – Mall"** (`mappedin-demo-mall`) is one coherent venue:
- 2 levels and about 250 tenants, with logos and categories
- **Parking Garage I** connecting on both levels, plus surface Lots A and B
- escalators and elevators between floors

That venue makes the parking-to-store story real instead of stitched together, so the app uses it. The Lower Level is the venue's default floor and is treated as the "main level". Upper Level stores are routed through the escalator or elevator.

### Credentials (Server Action)
`lib/actions/mappedin.ts` is a Server Action that exchanges the key and secret for a short-lived access token. It caches the token until shortly before it expires. The browser only ever receives that token. The SDK recognizes enterprise mode from the token's claims, so the key never ships to the client. There are no `app/api` routes.

The protection is narrower than it might sound. The action is still a public endpoint that hands any visitor a token, which a public map viewer needs anyway. What stays server-side is the **secret**, which could mint tokens indefinitely. The token handed out is read-only and expires. In production I'd add rate limiting on the action and keep the secret in a secrets manager.

### Instructions people can follow
The SDK's raw instructions are just "Turn Right", with distances and no landmarks. `lib/instructions.ts` (pure and unit-tested) turns them into steps:
- **Landmarks.** Each turn is anchored to the nearest storefront within 10 m, measured to the store's *outline* rather than its center. Large stores have their center far from their front. This gives "Turn left at Sephora". Amenities read naturally ("at the ATM"), parking areas are excluded, and the same landmark isn't used twice in a row.
- **Sidesteps.** The route graph often jogs sideways, for example where a corridor opens into a court. The SDK reports that as "Turn Right" and then "Turn Left". Headings are measured along the path over about 15 m. When two opposite turns come within 15 m and leave the walker facing the same way, they become one "Continue straight past …" step. Wider jogs, like crossing a food court, keep both turns because the walker really does have to cross over.
- **Prominent landmarks.** Freestanding kiosks (the Information Desk, Guest Services) can be seen from across a court. A "continue straight" step can name them from up to 30 m away; storefronts need to be within 10 m.
- **Consolidation.** Turns a few steps apart merge ("Turn right at Adidas, then turn left"). A "continue straight" with nothing to anchor it folds its distance into the next step.
- **Distances** are the walk *to* each action ("In 85 m"), rounded to 5 m.
- **Floor changes.** "Take the escalator up to Upper Level", then "Step off on Upper Level". The SDK reports the wrong floor on its exit instruction, so the app uses the exit point's floor instead.
- **Arrival** says whether the store is ahead, on the left or on the right. If the route ends inside the storefront, it says "straight ahead".

### "You are here" without indoor positioning
The marker follows the chosen parking entrance, then the start of each step. `YouAreHere` takes a `PositionSource`, so a live source can replace the step-driven one later.

## Structure

```
app/                     layout, page (renders the client-only app)
components/
  AppLoader.tsx          next/dynamic(ssr: false) — the SDK needs WebGL/workers/window
  WayfindingApp.tsx      calls the Server Action, loads map data
  MallExperience.tsx     state + route + layout (bottom sheet / side panel)
  map/                   MapScene, RouteLayer, YouAreHere, DestinationHighlight, FloorSwitcher
  ui/                    ParkingPicker, StoreDirectory, RoutePreview, DirectionsPanel
lib/
  actions/mappedin.ts    Server Action: token minting
  mall.ts                SDK → app data (parking origins, stores, landmarks), store search (+ tests)
  instructions.ts        raw instructions → human steps (+ tests)
  useWayfinding.ts       flow state, URL + localStorage persistence
  useRoute.ts            origin + store → directions + steps
```

## QA checklist

Tested on the production build (`npm run build && npm start`) in desktop Chrome on macOS, at desktop width and at a 390 × 844 phone-sized viewport.

### Automated
- [x] `npm test`: 29 unit tests pass. 21 cover the instruction engine (landmarks, outlines, sidesteps, kinks, merged turns, floor changes, arrival side), 6 cover store search and 2 cover the name fixes
- [x] `npm run lint` and `tsc --noEmit` are clean
- [x] `npm run build` succeeds

### Parking → store routes
Each route was opened in the app and its steps read through. Every one completed.

| From | To | Result |
|---|---|---|
| Garage, main level | Oak + Fort, Subway, Torrid (Lower) | 6–8 steps, every turn anchored except two on Torrid |
| Garage, main level | Fred Perry (Upper) | Escalator up, "Step off on Upper Level", 13 steps |
| Garage, main level | MAC Cosmetics (Upper) | Router picks the elevator; the preview says "via the elevator" |
| Garage, Upper Level | Fred Perry (Upper) | Stays upstairs; the preview says "all on this level" |
| Garage, Upper Level | Oak + Fort (Lower) | Escalator down |
| Lot A | Oak + Fort (Lower), Fred Perry (Upper) | Starts with "walk toward the mall" |
| Lot B | Subway (Lower) | Completes; see the 265 m leg below |
| Any | Urban Kids | No route in the venue data; the fallback asks the visitor to visit Guest Services, and Start is disabled |

### Flow and state
- [x] Choosing a parking spot leads to the directory; choosing a store leads to the preview; Start leads to turn-by-turn; Done returns to the directory
- [x] Change parking from the directory and from the preview; Back from the preview keeps the parking spot and clears the store
- [x] `?from=` deep links open with the origin already set (`garage-main`, `lot-a`), and the URL stays in sync as you move through the app
- [x] Parking choice and recent stores survive a fresh visit; recents are newest first and capped at 5
- [x] Next / Previous / All steps; the map highlights the active stretch, moves "You are here" and switches floors

### Directory and search
- [x] All 247 tenants listed A–Z with category and floor badge
- [x] Search ignores case, stray spaces and accents ("SEPH" finds Sephora; "café" finds "Cafe")
- [x] Everyday words find their category. "shoes" returns 22 stores (Ecco Shoes and Groovy Shoes first, then Footwear), "makeup" gives Health & Beauty, "bank" gives Finance. They also work mid-word from 3 letters ("sho")
- [x] Category chips toggle on and off and combine with search; the empty state names the active category

### Layout
- [x] Phone: bottom sheet. The directory takes about 70% of the screen; the turn-by-turn sheet is about 250 px, so the map, the highlighted route and "You are here" stay visible
- [x] Desktop: floating side panel, with the camera framing routes beside it

### Not yet tested
- Real phones (iOS Safari, Android Chrome): touch swipe between steps, safe-area insets, landscape
- Tapping a storefront on the map to select it
- Screen readers (VoiceOver, TalkBack) and keyboard-only use. The markup has the right labels and live regions, but nobody has listened to it
- Failure paths: auth failure and the retry screen, slow or offline networks, and a token expiring mid-session
- Lot B and the Upper Level garage entrance by deep link (tested through the parking picker only)
- Walking any route in a real building

### Known gaps found in QA
- **"Nordstorm" (fixed for now).** The venue data misspells Nordstrom. Before the fix, the typo was the first landmark on every route from the main garage, and searching the correct spelling, "nordstrom", found nothing. `NAME_FIXES` in `lib/mall.ts` now corrects the name for the directory, search and directions. The real fix belongs in the customer's map data, and I'd raise it with them. The patch is keyed on the misspelling, so once the data is fixed it simply stops matching; nothing breaks, and saved state and deep links use location IDs, not names. Delete the entry then.
- **"Shoes" search (fixed).** QA found that "shoes" matched only the 2 stores with "Shoes" in their name and none of the Footwear stores, even though the empty state suggests searching "shoes". `CATEGORY_WORDS` in `lib/mall.ts` now maps everyday words to 11 of the venue's 12 categories ("Specialty" is too mixed to have any), and stores named for the query come first. The word list is hand-written for this venue. A real deployment should build it from the customer's search logs.
- **Long outdoor legs.** From Lot B, the first step is "Bear right at Funk N Frost" in 265 m. Outdoor lots have no landmarks to anchor turns, so those stretches would need entrance signage or door names.
- **Unanchored and back-to-back turns.** A few indoor legs have no landmark ("Turn right — In 70 m"). Two lefts in quick succession read as "Turn left at WATCH IT!, then turn left" without saying it's a U-turn.
- **Arrival phrasing.** When the store is right at the last turn, the step reads "Right away — Oak + Fort is straight ahead".

### Before handing it to the customer
1. **Sweep every route.** Script every origin × store pair (4 × 247) and flag anything that has no route, a leg over 60 m with no landmark, or a doubled turn. This is how Urban Kids and the long legs get found systematically rather than by luck.
2. **Test on site.** Walk the 10 most-searched stores from each entrance with the app in hand, ideally with someone who has never been to the mall.
3. **Test on real devices.** Run the flow on iOS Safari and Android Chrome, plus a VoiceOver pass.
4. **Add end-to-end tests.** A short Playwright suite covering parking → search → preview → steps → done, run against the production build.

## Known limitations and next steps

- **Real positioning.** Beacons (BLE), Wi-Fi RTT or UWB need a native app or wrapper with a positioning SDK feeding `mapView.BlueDot`, because browsers can't scan for beacons. QR codes at entrances (already supported through `?from=`) are the web-friendly stopgap.
- **Accessible routing.** The SDK supports `getDirections(..., { accessible: true })` to avoid stairs and escalators. A toggle in the preview would make this a one-line change.
- **Languages.** The venue ships 8 languages, and both the SDK and the step phrasing could be localized.
- **Data quality.** One tenant (Urban Kids) has no walkable route in the demo data, and the app shows a friendly fallback for it. Some names have typos in the source data ("Nordstorm"). The app corrects known ones in `NAME_FIXES` until the data is fixed. The venue models no doors, so routes end at a store's single route node and not at a specific entrance. With doors in the data, the router would pick the nearest entrance.
- **Dev-only console noise.** React Strict Mode mounts the map twice in development, which logs an aborted tile request. Production builds don't show it.
