import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCache, dbMode } from '$lib/server/cache';
import { flightQueue } from '$lib/server/flights/request-queue';

/**
 * GET /api/health
 * Health check endpoint. Returns DB connectivity, DB mode, queue depth, and memory usage.
 * Response: { status, uptime, cacheOk, dbMode, queueDepth, backoffErrors, memoryMB }
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
	const mem = process.memoryUsage();

	return json(
		{
			status,
			uptime: Math.floor(process.uptime()),
			cacheOk,
			dbMode,
			queueDepth: flightQueue.queueDepth,
			backoffErrors: flightQueue.backoffErrors,
			memoryMB: Math.round(mem.rss / 1024 / 1024)
		},
		{ status: httpStatus }
	);
};
