import { describe, it, expect, vi } from 'vitest';
import { makeEvent } from '$lib/test-utils/fixtures';

vi.mock('@sveltejs/kit', () => ({
	json: (body: unknown, init?: ResponseInit) => {
		const status = init?.status ?? 200;
		const headers = new Headers(init?.headers);
		return new Response(JSON.stringify(body), { status, headers });
	}
}));

import { GET } from './+server';

const event = (searchParams: Record<string, string>) => makeEvent('/api/airports', searchParams);

describe('GET /api/airports', () => {
	it('returns Denver airport for query "DEN"', async () => {
		const response = await GET(event({ q: 'DEN' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.airports.length).toBeGreaterThan(0);
		expect(body.airports[0].iata).toBe('DEN');
	});

	it('returns 400 with INVALID_QUERY for 1-char query', async () => {
		const response = await GET(event({ q: 'D' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe('INVALID_QUERY');
		expect(body.error).toMatch(/at least 2 characters/i);
	});

	it('returns 400 with MISSING_PARAMETER when query param is missing', async () => {
		const response = await GET(event({}));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe('MISSING_PARAMETER');
		expect(body.error).toMatch(/missing.*q/i);
	});

	it('returns empty array for valid query with no matches', async () => {
		const response = await GET(event({ q: 'ZZZZZZ' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.airports).toEqual([]);
	});

	it('exact IATA match ranks first even with lowercase input', async () => {
		const response = await GET(event({ q: 'den' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.airports.length).toBeGreaterThan(0);
		expect(body.airports[0].iata).toBe('DEN');
	});

	it('returns at most 10 results for broad queries', async () => {
		const response = await GET(event({ q: 'new' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.airports.length).toBeLessThanOrEqual(10);
		expect(body.airports.length).toBeGreaterThan(0);
	});
});
