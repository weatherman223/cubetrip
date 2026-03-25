import type { Handle } from '@sveltejs/kit';

// --- In-memory per-IP rate limiter for flight scraping ---
// Only rate-limit /api/flights since it hits Google. Other API routes hit
// our own cache/WCA public API and don't need aggressive limiting.
const FLIGHT_RATE_LIMIT = 120; // flight requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute
const ipCounts = new Map<string, { count: number; resetAt: number }>();

// Clean up stale entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of ipCounts) {
		if (entry.resetAt < now) ipCounts.delete(ip);
	}
}, 5 * 60_000);

function isRateLimited(ip: string): { limited: boolean; retryAfter: number } {
	const now = Date.now();
	const entry = ipCounts.get(ip);

	if (!entry || entry.resetAt < now) {
		ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return { limited: false, retryAfter: 0 };
	}

	entry.count++;
	if (entry.count > FLIGHT_RATE_LIMIT) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return { limited: true, retryAfter };
	}

	return { limited: false, retryAfter: 0 };
}

export const handle: Handle = async ({ event, resolve }) => {
	// Rate-limit only flight API (the one that scrapes Google)
	if (event.url.pathname === '/api/flights') {
		const ip =
			event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			event.getClientAddress();

		const { limited, retryAfter } = isRateLimited(ip);
		if (limited) {
			return new Response(JSON.stringify({ error: 'Too many flight requests. Please slow down.' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(retryAfter)
				}
			});
		}
	}

	const response = await resolve(event);

	// Security headers on all responses
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
