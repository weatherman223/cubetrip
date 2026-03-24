import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCompetitions, enrichCompetitions, WCAApiError } from '$lib/server/wca';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = async ({ url }) => {
	const start = url.searchParams.get('start');
	const end = url.searchParams.get('end');

	if (!start) {
		return json({ error: 'Missing required parameter: start' }, { status: 400 });
	}
	if (!end) {
		return json({ error: 'Missing required parameter: end' }, { status: 400 });
	}
	if (!DATE_RE.test(start)) {
		return json({ error: 'Invalid start date format. Expected YYYY-MM-DD' }, { status: 400 });
	}
	if (!DATE_RE.test(end)) {
		return json({ error: 'Invalid end date format. Expected YYYY-MM-DD' }, { status: 400 });
	}

	try {
		const raw = await fetchCompetitions({ start, end });
		const competitions = await enrichCompetitions(raw);
		return json({ competitions });
	} catch (err) {
		if (err instanceof WCAApiError) {
			return json({ error: err.message }, { status: 502 });
		}
		console.error('Unexpected error fetching competitions:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
