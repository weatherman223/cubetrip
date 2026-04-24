import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Airport } from '$lib/types';
import airports from '$lib/data/airports.json';
import { apiError } from '$lib/server/api-errors';

const airportList = airports as Airport[];

/**
 * GET /api/airports?q=DEN
 * Server-side airport autocomplete. Returns up to 10 matches by IATA code, city, or name.
 * Minimum query length: 2 characters.
 * Response: { airports: Airport[] }
 */
export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q) {
		return apiError('MISSING_PARAMETER', 'Missing required parameter: q', 400);
	}
	if (q.length < 2) {
		return apiError('INVALID_QUERY', 'Query must be at least 2 characters', 400);
	}

	const lower = q.toLowerCase();

	// Exact IATA match first
	const exactIata = airportList.filter((a) => a.iata.toLowerCase() === lower);
	// IATA starts with query
	const iataStartsWith = airportList.filter(
		(a) => a.iata.toLowerCase().startsWith(lower) && a.iata.toLowerCase() !== lower
	);
	// City/name matches
	const otherMatches = airportList.filter(
		(a) =>
			!a.iata.toLowerCase().startsWith(lower) &&
			(a.city.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower))
	);

	const results = [...exactIata, ...iataStartsWith, ...otherMatches].slice(0, 10);
	return json({ airports: results });
};
