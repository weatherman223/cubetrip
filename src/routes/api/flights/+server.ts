import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { flightProvider } from '$lib/server/flights';
import { getCache, setCache, TTL } from '$lib/server/cache';
import { withCoalesce } from '$lib/server/cache/coalesce';
import type { FlightSearchResult } from '$lib/server/flights';
import { encodeFlightSearch, buildFlightsUrl } from '$lib/server/flights/protobuf-encoder';
import { QueueFullError } from '$lib/server/flights/request-queue';
import { isValidDate } from '$lib/utils/validation';
import { logger } from '$lib/server/logger';
import { apiError } from '$lib/server/api-errors';

const IATA_RE = /^[A-Z]{3}$/;
const FAILURE_TTL = 5 * 60 * 1000; // 5 minutes — short enough to recover from transient failures

/**
 * GET /api/flights?origin=DEN&destination=LAX&departDate=YYYY-MM-DD&returnDate=YYYY-MM-DD
 * Scrapes Google Flights for prices. Results are cached with two negative-cache kinds:
 *   - `flights:empty:*` — a successful scrape that found zero flights. Returned as
 *     200 with `{ flights: [] }`. The client maps this to an `empty` result and adds
 *     the destination to its per-comp skip set, which keeps mode-B day iterations
 *     from re-scraping known-empty routes.
 *   - `flights:fail:*` — a scrape that threw (network, parse, 5xx). Returned as
 *     503 so the client treats it as transient (doesn't poison the skip set).
 * Concurrent requests for the same route are coalesced into a single upstream fetch.
 * Response: { flights: FlightResult[], fetchedAt: string, fallbackUrl: string }
 * Errors: 400 (bad params), 429 (queue full), 503 (scrape failure)
 */
export const GET: RequestHandler = async ({ url }) => {
	const origin = url.searchParams.get('origin')?.toUpperCase();
	const destination = url.searchParams.get('destination')?.toUpperCase();
	const departDate = url.searchParams.get('departDate');
	const returnDate = url.searchParams.get('returnDate');

	if (!origin || !IATA_RE.test(origin)) {
		return apiError('INVALID_PARAMETER', 'Invalid or missing origin IATA code', 400);
	}
	if (!destination || !IATA_RE.test(destination)) {
		return apiError('INVALID_PARAMETER', 'Invalid or missing destination IATA code', 400);
	}
	if (!departDate || !isValidDate(departDate)) {
		return apiError('INVALID_PARAMETER', 'Invalid or missing departDate (YYYY-MM-DD)', 400);
	}
	if (!returnDate || !isValidDate(returnDate)) {
		return apiError('INVALID_PARAMETER', 'Invalid or missing returnDate (YYYY-MM-DD)', 400);
	}

	// Build the Google Flights deep link (always available as fallback)
	const tfs = encodeFlightSearch(origin, destination, departDate, returnDate);
	const fallbackUrl = buildFlightsUrl(tfs);

	const skipCache = url.searchParams.get('nocache') === '1';

	// Check positive cache
	const cacheKey = `flights:${origin}:${destination}:${departDate}:${returnDate}`;
	if (!skipCache) {
		const cached = getCache<FlightSearchResult>(cacheKey);
		if (cached) return json({ ...cached, fallbackUrl });
	}

	// Two separate negative-cache keys. emptyKey is the sticky "scrape said no
	// inventory" signal that drives the client's no-inventory skip set; failKey
	// is the transient "scrape errored" signal that surfaces as 503 so the
	// client retries on refresh.
	const emptyKey = `flights:empty:${origin}:${destination}:${departDate}:${returnDate}`;
	const failKey = `flights:fail:${origin}:${destination}:${departDate}:${returnDate}`;

	if (!skipCache) {
		if (getCache<boolean>(emptyKey)) {
			return json({ flights: [], fetchedAt: new Date().toISOString(), fallbackUrl });
		}
		if (getCache<boolean>(failKey)) {
			return apiError('SCRAPE_UNAVAILABLE', 'Flight data temporarily unavailable', 503, {
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
			// Scrape succeeded but route has no inventory. Sticky — the client
			// reads this as `empty` and skips the route on later days.
			setCache(emptyKey, true, FAILURE_TTL);
		}

		return json({ ...result, fallbackUrl });
	} catch (err) {
		if (err instanceof QueueFullError) {
			return apiError('QUEUE_FULL', 'Too many flight requests. Try again later.', 429, undefined, {
				'Retry-After': '2'
			});
		}
		logger.error({ err }, 'flight search failed');
		// Transient — don't pollute the no-inventory signal.
		setCache(failKey, true, FAILURE_TTL);
		return apiError('SCRAPE_UNAVAILABLE', 'Flight data temporarily unavailable', 503, {
			fallbackUrl
		});
	}
};
