import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { fetchWCIF, WCAApiError } from '$lib/server/wca';

const WCA_ID_RE = /^[A-Za-z0-9]+$/;

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	if (!WCA_ID_RE.test(id)) {
		return json({ error: 'Invalid competition ID format' }, { status: 400 });
	}

	// In dev mode, nocache=1 skips the cache read but still writes back (no TOCTOU gap)
	const skipCache = dev && url.searchParams.get('nocache') === '1';

	try {
		const wcif = await fetchWCIF(id, skipCache);
		return json({ wcif });
	} catch (err) {
		if (err instanceof WCAApiError) {
			console.error('WCA API error:', err.message);
			return json({ error: 'WCA API temporarily unavailable' }, { status: 502 });
		}
		console.error('Unexpected error fetching WCIF:', err);
		return json({ error: 'Failed to fetch WCIF data' }, { status: 500 });
	}
};
