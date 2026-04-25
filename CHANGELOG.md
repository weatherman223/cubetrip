# Changelog

All notable changes to CubeTrip are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [SemVer](https://semver.org/).

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
