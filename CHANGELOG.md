# Changelog

All notable changes to CubeTrip are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [SemVer](https://semver.org/).

## [0.3.1] — 2026-07-15

A housekeeping release from a whole-repo over-engineering audit: nine findings adversarially verified, eight applied, one rejected. Net −416 lines and one fewer API route, with no intended behavior change.

### Removed

- **Dead server-side WCIF batch-enrichment path** (`enrichCompetitions`, `fetchWCIFBatch` and their tests) — leftover architecture from before per-card lazy loading. The competitions route returns `wcif: null` and the client fetches `/api/wcif/:id` per card, so nothing called it.
- **`/api/airports` endpoint.** The full ~500-entry `airports.json` already ships in the client bundle for nearest-airport lookups, so the autocomplete was making a debounced network round-trip to filter data it already had locally. It now filters in the browser via a new `searchAirports()` in `airport-lookup.ts` (same exact-IATA → IATA-prefix → city/name ranking); the fetch, 150ms debounce timer, and network-error dropdown state went with it. Suggestions are now instant.
- `invalidateCache` (cache db) and `COUNTRIES_BY_ISO2` — no callers outside their own tests.

### Changed

- **`RouteEvent` flattened** from a four-variant discriminated union to a single interface with an optional `price` (present only on `hit`), removing the distributive-`Omit` type gymnastics the union forced on the emit path. No runtime change.
- **Status display maps merged.** `hexMap` and `tailwindMap` duplicated all six status labels; one table now holds both the hex tokens and the Tailwind classes per status, and `getStatusHex` / `getStatusTailwind` project the exact same shapes as before.
- **Cache-db migration framework inlined.** The migrations array + `user_version` transaction loop hosted exactly one migration, which was itself an idempotent "add version column if missing" check; the check now runs inline in `initTable`. Marked in-code to reintroduce the loop when a second migration actually exists.
- `wca/index.ts` barrel shrunk to its three real exports (`fetchCompetitions`, `fetchWCIF`, `WCAApiError`) — all consumers already import types from `wca/types` directly.

### Considered and rejected

- Replacing the `COUNTRIES_BY_CONTINENT` builder with `Map.groupBy`: Vite 7's default browser target includes Safari 16, which lacks `Map.groupBy` (17.4+), and esbuild doesn't polyfill APIs — the swap would throw at module load. The hand-rolled loop stays.

### Tests

- 349 tests across 23 files (was 357/24): tests for deleted code went with it, `searchAirports` ranking coverage was ported from the deleted route tests, and the cache-db tests now assert behavior (version column exists, `initTable` is idempotent) rather than the `user_version` mechanism. Autocomplete verified live in-browser against a mock-flights dev server.

## [0.3.0] — 2026-07-15

A correctness-and-polish release driven by a full-codebase audit: the flight pipeline now fails loud instead of caching failures as "no flights," all date/time math is timezone-correct, and a 15-finding UX/accessibility sweep landed.

### Fixed — flight pipeline correctness

- **Scrape failures are no longer cached as "no flights on this route."** Previously every failure in the scrape pipeline — Google 403 bot-block, timeout, consent-page/CAPTCHA interstitial, payload-format change — was swallowed into `{ flights: [] }`, cached under the sticky `flights:empty` key, and served as authoritative no-inventory (the route's 503/`failKey` path was unreachable). Now the parser throws a typed `FlightParseError` on extraction/structure failures (`[]` is reserved for a successfully parsed payload with zero itineraries), the provider rethrows instead of swallowing, and failures take the transient 5-minute `failKey`/503 path. A structural-anomaly guard also fails loud if the flight-list slots hold anything unrecognized — a format change now surfaces as an error instead of silently reporting zero flights everywhere. Routes with no airline service at all (seaplane bases, GA-only strips) return a valid payload with both list slots explicitly null — that shape (observed live on DEN→BED/DEN→CXH) is recognized as genuine "no flights" and stays sticky no-inventory.
- **Payload bracket scanner survives brackets inside strings.** The `ds:1` payload extractor counted every `[ ] { }` including those inside JSON string values, so free text like `"Terminal ]A"` truncated the payload and killed the whole parse. The scanner now tracks string state (with escape handling).
- **"Check on Google Flights" fallback link now renders when no route returned a flight** — the one case it exists for. `empty` and `error` route results now carry the server's `fallbackUrl` (including from 503 bodies) instead of discarding it; `fetchFlightForAirport` returns a discriminated `hit`/`empty`/`error` union in place of the old `AirportFlight | NO_INVENTORY | null`.
- **Red-eye flights no longer lose their times.** Google encodes the midnight hour as `null` (`[null, 11]` = 00:11); `normalizeTime` treated that as unparseable and returned `""`, feeding blank arrival times into the late-flight check.
- **`shiftDate` was off by one day for every user in a UTC+ timezone** (even a zero-day shift returned the previous day), so depart/return dates were wrong for roughly half the world. Now pure UTC calendar math, timezone-independent by construction; suite verified under `America/Denver`, `Asia/Tokyo`, and `UTC`.
- **"ARRIVES LATE" is now computed in the venue's timezone.** WCIF schedule starts are UTC instants but Google arrival times are naive venue-local, and the old string compare was wrong by the venue's full UTC offset in both directions: US comps showed late arrivals as in-time, EU comps flagged in-time arrivals as late (hiding valid flights). The schedule start is now converted to venue-local wall-clock time via the venue's IANA timezone (new `venueTimezone` on `EnrichedWCIF`, new `utcToVenueLocal` util) before comparing.
- **Year-less fallback dates no longer become 2001 timestamps.** `combineDateAndTime`'s non-ISO branch rejected nothing and serialized via `toISOString()`, producing `2001-01-01T…Z` garbage in a different format than the ISO branch; it now rejects dates without a 4-digit year and emits the same naive local format as the ISO branch.

### Fixed — UX & accessibility sweep

- **Escape in the airport dropdown no longer closes the whole settings modal.** The event is contained to the dropdown; a second Escape closes (and saves) the dialog.
- **Settings modal dismissal is consistent: every path saves.** The ✕ button previously discarded staged edits silently while Escape/backdrop/SAVE committed them; ✕ now saves too. Backdrop click actually works (the dimming layer was swallowing clicks before the dead-zone check), focus returns to the ⚙ SETTINGS trigger on close, the ✕ button has an accessible name, and the driveable-radius slider is labeled.
- **Typed airport codes commit on Enter** (exact IATA match, else top suggestion) instead of doing nothing without an arrow-key highlight; free text that was never committed reverts on blur so the input can't display an unsaved code.
- **Searching a >90-day range from the landing hero shows an inline error** instead of failing silently, and the end-date picker caps at start + 90 days.
- **Zero-results empty state names the filters that hid everything** ("All 84 competitions found for these dates are hidden by your filters (84 beyond your country filter)…") instead of always blaming the date range.
- **Status badges meet WCAG AA contrast**: badges keep white text but move to new darkened `-deep` status backgrounds (all ≥4.9:1 vs white; the bright originals sat at ~1.9–2.6:1 and stay in use for map markers and status dots on light surfaces). Selected event chips use dark text on amber, matching the sort-control idiom. Map popup badges match the cards.
- **Map legend and color-mode toggle render again** — they referenced undefined Tailwind tokens (`airline-dark`, `airline-dark-card`), leaving 9px white legend text floating directly on light map tiles. Map markers (competitions + homes) now expose accessible names instead of being unnamed focusable elements.
- **Screen-reader flooding fixed**: the live flight-search ticker is `aria-live="off"` with a throttled sr-only fare-progress announcer (at most one line per 25% milestone), and the loading screen announces once instead of re-reading its cycling flavor text every 2 seconds.
- **Skip link works everywhere** — it targeted `#main-content`, which only existed on the results screen; the hero and loading screens are now proper `<main id="main-content">` landmarks.

### Tests

- 357 tests across 24 files (was 326). New coverage: parse-failure taxonomy (consent page, malformed JSON, structural anomaly) vs genuine-empty, bracket-in-string payloads (with a structurally-valid control fixture), provider error propagation, fallbackUrl survival through all-empty and all-error comp searches, midnight-hour time encoding, venue-timezone late checks (US/EU/invalid-zone), `utcToVenueLocal` (DST, day boundary, midnight), `shiftDate` identity, and a contrast-computing test that fails if any badge background drops below WCAG AA against its text color. Full suite passes under three process timezones. UX fixes verified with a browser e2e checklist against a mock-flights dev server.

## [0.2.0] — 2026-04-25

### Added

- **Travel filters: max distance + country/continent allowlist.** New collapsible "TRAVEL FILTERS" section on the hero, in a popover on the post-search control bar, and in the Settings modal — all backed by the same persisted preferences. Slider caps at half the equator (~20 000 km / 12 450 mi) and reads "NO LIMIT" at max. Country picker has continent chips (with all/some/none tri-state) and a searchable country list sourced from a static `countries.json` (205 entries from WCA's `/api/v0/countries`). Filters fully exclude comps from the list — they don't count toward the "+N hidden" badge.
- **Live flight-search feed.** A rolling ticker below the FLIGHT FARES progress bar shows the actual route probes happening underneath: `EVANSTON FMC SPRING 2026 · SLC → ORD · ✓ $360`, with status glyphs (`⟳` searching, `✓` hit + price, faint `· empty`, red `✕` error). Capped at 60 events with a 6-row visible window; new rows fade in from the top. Driven by a new `onRouteEvent` callback threaded through `fetchFlightForAirport` / `searchSingleDay` / `searchFlightsForComp` / `fetchFlightsForCompetitions`.
- **`Cheaper from secondary` flight card.** A second alt slot below the primary fare, distinct from the existing "cheaper but farther" card. Surfaces the cheapest flight to the _same_ destination as the primary when it comes from a secondary home airport (e.g. EWR → LAX $550 alongside JFK → LAX $600). Rendered with a sky-blue accent so it's visually distinct from the green "cheaper but farther" card.
- **Heads-up message on the search hero** when the upcoming search will likely take a few minutes — triggered by 3+ origin airports, 3+ week date range, or both. Inline message, no popup.
- **Tutorial marker on multi-origin selection.** When at least one secondary airport is set, both the hero and the Settings modal show an info-styled note explaining that the user's primary home now always shows in the main fare slot, with secondaries surfacing as "Cheaper from …" alternatives.

### Changed

- **Primary home airport always wins the primary slot when it returned anything** — even if a secondary is cheaper or arrives in-time when the primary doesn't. Tier order is: primary in-time → primary late → any-origin in-time → any-origin late. The `allowPartial` toggle is now the right place to express "I'd rather miss the comp than fly out of PVU."
- **Mode A (`maxDaysBeforeComp = 1`) widens to find a non-late primary.** Previously the day-loop broke as soon as _any_ origin had an in-time flight on day-1, which short-circuited the primary's chance to expand. Now it only breaks on the primary home's in-time hit. So if SLC → ORD on day-1 lands after the comp starts but day-2 lands in-time, day-2 SLC wins — instead of a late SLC or a non-primary in-time.
- **`SHOW ALL DEPARTURES` toggle renamed to `SHOW FULL/CLOSED COMPETITIONS`** to make explicit that "hidden" means _registration full/closed_, not _filtered out by location_.
- **`closedCount` semantics tightened.** The `+N HIDDEN` badge now reflects only comps that survived the new location filters — otherwise toggling the switch would promise comps that wouldn't actually appear.
- **Existing `cheaperAlt` slot narrowed to "different destination only"** now that "different origin, same destination" has its own dedicated card. Each slot now has a single, specific meaning.

### Fixed

- **Flight search no longer probes comps that are filtered out by location.** Previously the effect iterated the unfiltered `competitions` array, so picking "North America only" or capping distance still kicked off probes for excluded comps (e.g. Provo → Bogotá), wasting queue capacity and polluting the live feed.

### Migrations

- **Preferences schema bumped to v3.** Adds `maxDistanceKm` (default `20037` km, the "no limit" sentinel) and `allowedCountries` (default `[]`). Migration runs automatically on next localStorage read.

### Tests

- 326 tests across 24 files (was 93 at 0.1.0). New coverage for: country dataset sanity, location filter helper, preferences v2→v3 migration, route-event ordering, primary-home priority across all four selector tiers, mode-A widening for primary, the new `cheaperFromAlt` slot in three configurations.

## [0.1.0-beta.1] — Beta

Initial public beta. Multi-origin search, flight performance work, progress UI, vitest infrastructure (93 tests), CSP header, accessibility pass, and JSDoc on all API routes. See `git log v0.1.0-beta.1` for the full commit history.
