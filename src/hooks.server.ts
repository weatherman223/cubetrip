import { randomUUID } from 'node:crypto';
import type { Handle } from '@sveltejs/kit';

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.cubing.net",
	"font-src 'self' https://fonts.gstatic.com",
	"img-src 'self' data: https://*.tile.openstreetmap.org",
	"connect-src 'self'"
].join('; ');

function setSecurityHeaders(response: Response) {
	response.headers.set('Content-Security-Policy', CSP);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export const handle: Handle = async ({ event, resolve }) => {
	// Generate request ID for API routes (aids debugging and log correlation)
	if (event.url.pathname.startsWith('/api/')) {
		const requestId = randomUUID().slice(0, 8);
		console.log(`[${requestId}] ${event.request.method} ${event.url.pathname}${event.url.search}`);

		const response = await resolve(event);
		response.headers.set('X-Request-Id', requestId);
		setSecurityHeaders(response);
		return response;
	}

	const response = await resolve(event);
	setSecurityHeaders(response);
	return response;
};
