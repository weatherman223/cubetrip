import airports from '$lib/data/airports.json';
import { haversine } from './distance';

interface Airport {
	iata: string;
	name: string;
	latitude: number;
	longitude: number;
	city: string;
	country: string;
}

const airportList = airports as Airport[];

// Memoize by rounded coordinates — competitions in the same area share results
const lookupCache = new Map<string, { airport: Airport; distanceKm: number }[]>();

function cacheKey(lat: number, lng: number, count: number): string {
	return `${lat.toFixed(1)},${lng.toFixed(1)},${count}`;
}

/**
 * Find the nearest airport to a given coordinate.
 * Returns the airport and the distance in km.
 */
export function findNearestAirport(
	lat: number,
	lng: number
): { airport: Airport; distanceKm: number } {
	const ranked = findNearestAirports(lat, lng, 1);
	return { airport: ranked[0].airport, distanceKm: ranked[0].distanceKm };
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
