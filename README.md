# CubeTrip

A web app for speedcubers to find WCA competitions they can spontaneously travel to. Pick a date range, see open competitions worldwide, and compare flight costs or driving distances.

## Features

- Search WCA competitions by date range with live registration status
- Flight price scraping via Google Flights (Protobuf URL construction)
- **Multi-origin airport search** — add a primary home plus extra origins (JFK + LGA + EWR, LAX + BUR + LGB, etc.) and see fares from every one. Auto-suggests nearby airports within 120 km of your primary.
- **Two departure-window modes** — at slider=1 we show day-before flights and quietly widen only when the day-before flight would land during the comp; at 2+ we search the whole window and show the cheapest.
- `SKIP CLOSED COMPS` toggle — don't waste requests on competitions where registration is already closed. On by default.
- Progress bars for WCIF loading and flight fares, with per-card "Day N of M" in multi-day mode.
- Driving distance estimation with configurable radius (takes the closest home airport when multi-origin)
- Map view with Leaflet + OpenStreetMap — one 🏠 marker per home
- Competition filtering by event, registration status, and schedule conflicts
- SQLite caching with schema versioning and automatic cleanup
- Per-route no-inventory cache so day-2 and day-3 skip airports proven dead on day-1

## Beta / Known Limitations

This is an early beta. A few rough edges to be aware of:

- **Google Flights scraping is fragile.** The parser reverse-engineers Google's HTML and breaks when Google changes their markup. A recent parser regression around multi-stop long-haul itineraries was caught and fixed; similar regressions may recur.
- **First cold search of a busy weekend takes 20–30 seconds.** The server queue (10 concurrent scrapes @ 150ms spacing) is the bottleneck, not the code. Subsequent searches hit the 12-hour success cache and are near-instant.
- **Running a publicly shared instance risks Google rate-limiting the IP.** For reliable use, run locally or behind trusted users. If you see sustained 429s in the logs, the circuit breaker in `src/lib/server/flights/request-queue.ts` kicks in automatically.
- **WCIF can be slow or missing.** Some newly-announced competitions haven't published their schedule yet; they'll show `STATUS UNKNOWN` until the next retry round or cache expiry.
- **No authentication.** User preferences live entirely in `localStorage`. Sharing a browser profile shares preferences.

## Prerequisites

- **Node.js 22+** (see `.nvmrc`)
- **C++ build tools** for `better-sqlite3` native bindings:
  - macOS: `xcode-select --install`
  - Ubuntu/Debian: `sudo apt install build-essential python3`
  - Windows: [windows-build-tools](https://github.com/nicedoc/windows-build-tools)

## Setup

```sh
git clone https://github.com/weatherman223/cubetrip.git
cd cubetrip
cp .env.example .env
npm install
```

### Environment Variables

See `.env.example` for all options:

| Variable           | Default           | Description                                                      |
| ------------------ | ----------------- | ---------------------------------------------------------------- |
| `USE_MOCK_FLIGHTS` | `false`           | Use deterministic mock flight data (recommended for development) |
| `DB_PATH`          | `./data/cache.db` | SQLite database file path                                        |

## Development

```sh
npm run dev          # Start dev server (http://localhost:5173)
npm run check        # TypeScript type checking
npm run test         # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run lint         # Prettier + ESLint
npm run build        # Production build
```

Set `USE_MOCK_FLIGHTS=true` in `.env` to avoid hitting Google Flights during development.

## API Routes

| Endpoint                                                    | Method | Description                                           |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------- |
| `/api/competitions?start=&end=`                             | GET    | Search WCA competitions in a date range (max 90 days) |
| `/api/wcif/:id`                                             | GET    | Fetch enriched WCIF data for a competition            |
| `/api/flights?origin=&destination=&departDate=&returnDate=` | GET    | Search flight prices                                  |
| `/api/airports?q=`                                          | GET    | Airport autocomplete search                           |
| `/api/health`                                               | GET    | Health check (DB connectivity + uptime)               |

## Deployment

### Docker

```sh
docker build -t cubetrip .
docker run -p 3000:3000 -v cubetrip-data:/app/data cubetrip
```

### Node.js

```sh
npm run build
node build
```

The app uses `@sveltejs/adapter-node` and listens on port 3000 by default. The `data/` directory must be writable for the SQLite cache.

## Tech Stack

- SvelteKit + TypeScript + Tailwind CSS
- Leaflet + OpenStreetMap for map view
- Google Flights scraper via Protobuf URL construction
- WCA API v0 for competition data
- SQLite (better-sqlite3) for server-side caching
