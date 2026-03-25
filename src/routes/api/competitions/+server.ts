import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCompetitions, WCAApiError } from '$lib/server/wca';
import { isValidDate, isDateRangeValid } from '$lib/utils/validation';

export const GET: RequestHandler = async ({ url }) => {
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');

	if (!start) {
		return json({ error: 'Missing required parameter: start' }, { status: 400 });
	}
	if (!end) {
		return json({ error: 'Missing required parameter: end' }, { status: 400 });
	}
	if (!isValidDate(start)) {
		return json({ error: 'Invalid start date. Expected a valid YYYY-MM-DD' }, { status: 400 });
	}
	if (!isValidDate(end)) {
		return json({ error: 'Invalid end date. Expected a valid YYYY-MM-DD' }, { status: 400 });
	}
	if (!isDateRangeValid(start, end, 90)) {
		return json(
			{ error: 'Date range too large. Maximum span is 90 days' },
			{ status: 400 }
		);
	}

	try {
		const raw = await fetchCompetitions({ start, end });
		// Return competitions immediately with wcif: null — the client
		// lazy-loads WCIF per-card via /api/wcif and retryUnknownComps
		const competitions = raw.map((comp) => ({ ...comp, wcif: null }));
		return json({ competitions });
	} catch (err) {
		if (err instanceof WCAApiError) {
			console.error('WCA API error:', err.message);
			return json({ error: 'WCA API temporarily unavailable' }, { status: 502 });
		}
		console.error('Unexpected error fetching competitions:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
