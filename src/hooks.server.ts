import { randomUUID } from 'node:crypto';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Generate request ID for API routes (aids debugging and log correlation)
	if (event.url.pathname.startsWith('/api/')) {
		const requestId = randomUUID().slice(0, 8);
		console.log(`[${requestId}] ${event.request.method} ${event.url.pathname}${event.url.search}`);

		const response = await resolve(event);

		// Security headers + request ID
		response.headers.set('X-Request-Id', requestId);
		response.headers.set('X-Frame-Options', 'DENY');
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

		return response;
	}

	const response = await resolve(event);

	// Security headers on all responses
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
