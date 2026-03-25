import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCache } from '$lib/server/cache';

/**
 * GET /api/health
 * Health check endpoint. Returns DB connectivity status and process uptime.
 * Response: { status: 'ok' | 'degraded', uptime: number, cacheOk: boolean }
 * Returns 200 if healthy, 503 if DB is unreachable.
 */
export const GET: RequestHandler = async () => {
	let cacheOk = false;
	try {
		// Test DB connectivity with a harmless read
		getCache('__health_check__');
		cacheOk = true;
	} catch {
		// DB is unreachable
	}

	const status = cacheOk ? 'ok' : 'degraded';
	const httpStatus = cacheOk ? 200 : 503;

	return json(
		{
			status,
			uptime: Math.floor(process.uptime()),
			cacheOk
		},
		{ status: httpStatus }
	);
};
