import type { Handle } from '@sveltejs/kit';

// --- In-memory per-IP rate limiter for API routes ---
const RATE_LIMIT = 30; // requests per window
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
	if (entry.count > RATE_LIMIT) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return { limited: true, retryAfter };
	}

	return { limited: false, retryAfter: 0 };
}

export const handle: Handle = async ({ event, resolve }) => {
	// Apply rate limiting to API routes only
	if (event.url.pathname.startsWith('/api/')) {
		const ip =
			event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			event.getClientAddress();

		const { limited, retryAfter } = isRateLimited(ip);
		if (limited) {
			return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
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
