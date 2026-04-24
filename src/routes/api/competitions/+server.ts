import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCompetitions, WCAApiError } from '$lib/server/wca';
import { isValidDate, isDateRangeValid } from '$lib/utils/validation';
import { logger } from '$lib/server/logger';
import { apiError } from '$lib/server/api-errors';

/**
 * GET /api/competitions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns WCA competitions in a date range (max 90 days) with wcif: null.
 * WCIF data is lazy-loaded per-card by the client via /api/wcif/:id.
 * Response: { competitions: EnrichedCompetition[], total: number, fetchedAt: string }
 */
export const GET: RequestHandler = async ({ url }) => {
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');

	if (!start) {
		return apiError('MISSING_PARAMETER', 'Missing required parameter: start', 400);
	}
	if (!end) {
		return apiError('MISSING_PARAMETER', 'Missing required parameter: end', 400);
	}
	if (!isValidDate(start)) {
		return apiError('INVALID_PARAMETER', 'Invalid start date. Expected a valid YYYY-MM-DD', 400);
	}
	if (!isValidDate(end)) {
		return apiError('INVALID_PARAMETER', 'Invalid end date. Expected a valid YYYY-MM-DD', 400);
	}
	if (!isDateRangeValid(start, end, 90)) {
		return apiError('INVALID_PARAMETER', 'Date range too large. Maximum span is 90 days', 400);
	}

	try {
		const raw = await fetchCompetitions({ start, end });
		// Return competitions immediately with wcif: null — the client
		// lazy-loads WCIF per-card via /api/wcif and retryUnknownComps
		const competitions = raw.map((comp) => ({ ...comp, wcif: null }));
		return json({ competitions, total: competitions.length, fetchedAt: new Date().toISOString() });
	} catch (err) {
		if (err instanceof WCAApiError) {
			logger.error({ err }, 'WCA API error fetching competitions');
			return apiError('UPSTREAM_UNAVAILABLE', 'WCA API temporarily unavailable', 502);
		}
		logger.error({ err }, 'unexpected error fetching competitions');
		return apiError('INTERNAL_ERROR', 'Internal server error', 500);
	}
};
