# CubeTrip

## What is this?
A web app for speedcubers to find WCA competitions they can spontaneously travel to.
Pick a date → see open competitions → see flight costs or driving distance.

## Stack
- SvelteKit + TypeScript + Tailwind CSS
- Leaflet + OpenStreetMap for map view
- Custom Google Flights scraper via Protobuf URL construction (port of fast-flights Python approach)
- WCA API v0 for competition data + WCIF public endpoint for registration/schedule details
- SQLite (better-sqlite3) for server-side caching
- No authentication required — preferences stored in localStorage

## Project Structure
- src/lib/server/flights/ — Flight scraping module (FlightProvider interface + GoogleFlightsProtobufProvider)
- src/lib/server/wca/ — WCA API client
- src/lib/server/cache/ — SQLite caching layer
- src/lib/utils/ — Haversine distance, date helpers, airport lookup
- src/lib/stores/ — Svelte stores for user preferences (localStorage-backed)
- src/lib/components/ — Reusable UI components
- src/lib/data/airports.json — Static airport dataset (~500 airports)

## Key Design Decisions
- ALL external API calls happen server-side only (SvelteKit +server.ts routes)
- Cache-first architecture: always check SQLite cache before any external request
- Flight scraping uses Protobuf URL construction (not Playwright/headless browser)
- Request queue with rate limiting: max 1 concurrent Google request, 2s spacing
- FlightProvider interface allows swapping scraping implementation without frontend changes
- Graceful degradation: if scraping fails, show "Check on Google Flights" link

## WCA API
- Base: https://worldcubeassociation.org/api/v0
- /competitions?start=YYYY-MM-DD&end=YYYY-MM-DD — paginated 25/page
- /competitions/:id/wcif/public — schedule, registration info, on-the-spot reg

## Reference
- fast-flights Python source (for Protobuf schema): github.com/AWeirdDev/flights
- WCIF spec: github.com/thewca/wcif/blob/stable/specification.md
