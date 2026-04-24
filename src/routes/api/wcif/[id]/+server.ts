import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchWCIF, WCAApiError } from '$lib/server/wca';
import type { WCIFPublicData } from '$lib/server/wca/types';
import { getCache, setCache, TTL } from '$lib/server/cache';
import { logger } from '$lib/server/logger';
import { apiError } from '$lib/server/api-errors';

const WCA_ID_RE = /^[A-Za-z0-9]+$/;

/**
 * GET /api/wcif/:id
 * Fetches enriched WCIF public data for a competition (registration status, schedule, competitor count).
 * Results are cached for 2 hours (success) or 5 minutes (failure). ?nocache=1 bypasses both caches.
 * Response: { wcif: WCIFPublicData }
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	if (!WCA_ID_RE.test(id)) {
		return apiError('INVALID_PARAMETER', 'Invalid competition ID format', 400);
	}

	const skipCache = url.searchParams.get('nocache') === '1';
	const cacheKey = `wcif:${id}`;
	const failKey = `wcif:fail:${id}`;

	// Positive cache wins over the failure cache. If a prior successful scrape
	// populated wcif:${id} (2h TTL) and a later `nocache=1` refresh hit a
	// transient upstream error (5min failKey), a normal request must still get
	// the cached-good data instead of a 502 — otherwise one user's failed
	// refresh poisons every other user's view for 5 minutes.
	if (!skipCache) {
		const cached = getCache<WCIFPublicData>(cacheKey);
		if (cached) return json({ wcif: cached });
		if (getCache<boolean>(failKey)) {
			return apiError('UPSTREAM_UNAVAILABLE', 'WCA API temporarily unavailable', 502);
		}
	}

	try {
		const wcif = await fetchWCIF(id, skipCache);
		return json({ wcif });
	} catch (err) {
		if (err instanceof WCAApiError) {
			logger.error({ err }, 'WCA API error fetching WCIF');
			setCache(failKey, true, TTL.WCIF_FAILURE);
			return apiError('UPSTREAM_UNAVAILABLE', 'WCA API temporarily unavailable', 502);
		}
		logger.error({ err }, 'unexpected error fetching WCIF');
		setCache(failKey, true, TTL.WCIF_FAILURE);
		return apiError('INTERNAL_ERROR', 'Failed to fetch WCIF data', 500);
	}
};
