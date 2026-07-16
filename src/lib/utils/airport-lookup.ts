import airports from '$lib/data/airports.json';
import type { Airport } from '$lib/types';
import { haversine } from './distance';

const airportList = airports as Airport[];

// Memoize by rounded coordinates — competitions in the same area share results
const lookupCache = new Map<string, { airport: Airport; distanceKm: number }[]>();
const nearbyCache = new Map<string, Airport[]>();

function cacheKey(lat: number, lng: number, count: number): string {
	return `${lat.toFixed(1)},${lng.toFixed(1)},${count}`;
}

/**
 * Rank airports for autocomplete: exact IATA match first, then IATA prefix,
 * then city/name substring. Case-insensitive; queries under 2 chars return [].
 */
export function searchAirports(query: string, limit = 10): Airport[] {
	const q = query.trim().toLowerCase();
	if (q.length < 2) return [];
	const exact: Airport[] = [];
	const prefix: Airport[] = [];
	const other: Airport[] = [];
	for (const a of airportList) {
		const iata = a.iata.toLowerCase();
		if (iata === q) exact.push(a);
		else if (iata.startsWith(q)) prefix.push(a);
		else if (a.city.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) other.push(a);
	}
	return [...exact, ...prefix, ...other].slice(0, limit);
}

/**
 * Find the N nearest airports to a given coordinate, sorted by distance.
 * Results are memoized by rounded (lat, lng) to avoid redundant scans.
 */
export function findNearestAirports(
	lat: number,
	lng: number,
	count: number
): { airport: Airport; distanceKm: number }[] {
	const key = cacheKey(lat, lng, count);
	const cached = lookupCache.get(key);
	if (cached) return cached;

	const withDist = airportList.map((a) => ({
		airport: a,
		distanceKm: haversine(lat, lng, a.latitude, a.longitude)
	}));
	withDist.sort((a, b) => a.distanceKm - b.distanceKm);
	const result = withDist.slice(0, count);

	lookupCache.set(key, result);
	return result;
}

/**
 * Find all airports within `radiusKm` of a coordinate, sorted by distance ascending.
 * Excludes any IATA codes in `excludeIatas` (typically the primary home + airports
 * the user has already added as extra origins). Memoizes on rounded coordinates and
 * radius — the exclude set is applied after cache lookup so adding/removing a chip
 * doesn't invalidate the scan.
 */
export function findNearbyAirports(
	lat: number,
	lng: number,
	radiusKm: number,
	excludeIatas: string[] = []
): Airport[] {
	const key = `${lat.toFixed(1)},${lng.toFixed(1)},${radiusKm}`;
	let candidates = nearbyCache.get(key);
	if (!candidates) {
		candidates = airportList
			.map((a) => ({ airport: a, distanceKm: haversine(lat, lng, a.latitude, a.longitude) }))
			.filter((x) => x.distanceKm <= radiusKm)
			.sort((a, b) => a.distanceKm - b.distanceKm)
			.map((x) => x.airport);
		nearbyCache.set(key, candidates);
	}
	if (excludeIatas.length === 0) return candidates;
	const excluded = new Set(excludeIatas);
	return candidates.filter((a) => !excluded.has(a.iata));
}
