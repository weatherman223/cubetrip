import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import airports from '$lib/data/airports.json';

interface Airport {
	iata: string;
	name: string;
	latitude: number;
	longitude: number;
	city: string;
	country: string;
}

const airportList = airports as Airport[];

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) {
		return json({ airports: [] });
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
