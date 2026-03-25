# CubeTrip

A web app for speedcubers to find WCA competitions they can spontaneously travel to. Pick a date range, see open competitions worldwide, and compare flight costs or driving distances.

## Features

- Search WCA competitions by date range with live registration status
- Flight price scraping via Google Flights (Protobuf URL construction)
- Driving distance estimation with configurable radius
- Map view with Leaflet + OpenStreetMap
- Competition filtering by event, registration status, and schedule conflicts
- SQLite caching with schema versioning and automatic cleanup

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

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_MOCK_FLIGHTS` | `false` | Use deterministic mock flight data (recommended for development) |
| `DB_PATH` | `./data/cache.db` | SQLite database file path |

## Development

```sh
npm run dev          # Start dev server (http://localhost:5173)
npm run check        # TypeScript type checking
npm run lint         # Prettier + ESLint
npm run build        # Production build
```

Set `USE_MOCK_FLIGHTS=true` in `.env` to avoid hitting Google Flights during development.

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/competitions?start=&end=` | GET | Search WCA competitions in a date range (max 90 days) |
| `/api/wcif/:id` | GET | Fetch enriched WCIF data for a competition |
| `/api/flights?origin=&destination=&departDate=&returnDate=` | GET | Search flight prices |
| `/api/airports?q=` | GET | Airport autocomplete search |
| `/api/health` | GET | Health check (DB connectivity + uptime) |

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
