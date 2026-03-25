import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { flightProvider } from '$lib/server/flights';
import { getCache, setCache, TTL } from '$lib/server/cache';
import { withCoalesce } from '$lib/server/cache/coalesce';
import type { FlightSearchResult } from '$lib/server/flights';
import { encodeFlightSearch, buildFlightsUrl } from '$lib/server/flights/protobuf-encoder';
import { QueueFullError } from '$lib/server/flights/request-queue';
import { isValidDate } from '$lib/utils/validation';

const IATA_RE = /^[A-Z]{3}$/;
const FAILURE_TTL = 5 * 60 * 1000; // 5 minutes — short enough to recover from transient failures

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.searchParams.get('origin')?.toUpperCase();
	const destination = url.searchParams.get('destination')?.toUpperCase();
	const departDate = url.searchParams.get('departDate');
	const returnDate = url.searchParams.get('returnDate');

	if (!origin || !IATA_RE.test(origin)) {
		return json({ error: 'Invalid or missing origin IATA code' }, { status: 400 });
	}
	if (!destination || !IATA_RE.test(destination)) {
		return json({ error: 'Invalid or missing destination IATA code' }, { status: 400 });
	}
	if (!departDate || !isValidDate(departDate)) {
		return json({ error: 'Invalid or missing departDate (YYYY-MM-DD)' }, { status: 400 });
	}
	if (!returnDate || !isValidDate(returnDate)) {
		return json({ error: 'Invalid or missing returnDate (YYYY-MM-DD)' }, { status: 400 });
	}

	// Build the Google Flights deep link (always available as fallback)
	const tfs = encodeFlightSearch(origin, destination, departDate, returnDate);
	const fallbackUrl = buildFlightsUrl(tfs);

	const nocache = dev && url.searchParams.get('nocache') === '1';

	// Check positive cache
	const cacheKey = `flights:${origin}:${destination}:${departDate}:${returnDate}`;
	if (!nocache) {
		const cached = getCache<FlightSearchResult>(cacheKey);
		if (cached) return json({ ...cached, fallbackUrl });
	}

	// Check negative cache (failed scrape)
	const failKey = `flights:fail:${origin}:${destination}:${departDate}:${returnDate}`;
	if (!nocache) {
		const failCached = getCache<boolean>(failKey);
		if (failCached) {
			return json({
				flights: [],
				fetchedAt: new Date().toISOString(),
				fallbackUrl
			});
		}
	}

	try {
		const result = await withCoalesce(cacheKey, () =>
			flightProvider.searchFlights(origin, destination, departDate, returnDate)
		);

		if (result.flights.length > 0) {
			setCache(cacheKey, result, TTL.FLIGHTS);
		} else {
			// Cache the failure so we don't re-hammer Google
			setCache(failKey, true, FAILURE_TTL);
		}

		return json({ ...result, fallbackUrl });
	} catch (err) {
		if (err instanceof QueueFullError) {
			return json(
				{ error: 'Too many flight requests. Try again later.' },
				{ status: 429, headers: { 'Retry-After': '2' } }
			);
		}
		console.error('Flight search failed:', err);
		setCache(failKey, true, FAILURE_TTL);
		return json(
			{ error: 'Flight data temporarily unavailable', fallbackUrl },
			{ status: 503 }
		);
	}
};
