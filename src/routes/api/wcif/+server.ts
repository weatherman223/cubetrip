import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchWCIF, WCAApiError } from '$lib/server/wca';
import { invalidateCache } from '$lib/server/cache';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'Missing required parameter: id' }, { status: 400 });
	}

	const nocache = url.searchParams.get('nocache') === '1';
	if (nocache) {
		invalidateCache(`wcif:${id}`);
	}

	try {
		const wcif = await fetchWCIF(id);
		return json({ wcif });
	} catch (err) {
		if (err instanceof WCAApiError) {
			return json({ error: err.message }, { status: 502 });
		}
		return json({ error: 'Failed to fetch WCIF data' }, { status: 500 });
	}
};
