import { randomUUID } from 'node:crypto';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { logger, runWithRequestId } from '$lib/server/logger';

// --- Security headers (non-CSP — SvelteKit handles CSP via config) ---
function setSecurityHeaders(response: Response) {
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Generate request ID for API routes (aids debugging and log correlation)
	if (event.url.pathname.startsWith('/api/')) {
		const requestId = randomUUID().slice(0, 8);
		event.locals.requestId = requestId;

		return runWithRequestId(requestId, async () => {
			logger.info({ method: event.request.method, path: event.url.pathname }, 'request');

			const response = await resolve(event);
			response.headers.set('X-Request-Id', requestId);
			setSecurityHeaders(response);
			return response;
		});
	}

	const response = await resolve(event);
	setSecurityHeaders(response);
	return response;
};

export const handleError: HandleServerError = ({ error, event, status }) => {
	// Reuse the id set in `handle` when available so the error log, the earlier
	// `request` info log, and the X-Request-Id header all share one correlation id.
	// Fall back to a fresh id for errors that fire before `handle` runs (routing errors).
	const requestId = event.locals.requestId ?? randomUUID().slice(0, 8);

	logger.error(
		{
			err: error,
			status,
			method: event.request.method,
			path: event.url.pathname,
			requestId
		},
		'unhandled error'
	);

	return { message: `Internal error (ref: ${requestId})` };
};
