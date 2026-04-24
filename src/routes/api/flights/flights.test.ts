import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeEvent } from '$lib/test-utils/fixtures';

vi.mock('@sveltejs/kit', () => ({
	json: (body: unknown, init?: ResponseInit) => {
		const status = init?.status ?? 200;
		const headers = new Headers(init?.headers);
		return new Response(JSON.stringify(body), { status, headers });
	}
}));

vi.mock('$app/environment', () => ({ dev: false }));

vi.mock('$lib/server/flights', () => ({
	flightProvider: { searchFlights: vi.fn() }
}));

vi.mock('$lib/server/cache', () => ({
	getCache: vi.fn(() => null),
	setCache: vi.fn(),
	TTL: { COMPETITIONS: 3600000, WCIF: 7200000, FLIGHTS: 43200000 }
}));

vi.mock('$lib/server/cache/coalesce', () => ({
	withCoalesce: vi.fn((_key: string, fn: () => Promise<unknown>) => fn())
}));

vi.mock('$lib/server/flights/protobuf-encoder', () => ({
	encodeFlightSearch: vi.fn(() => 'mock-tfs'),
	buildFlightsUrl: vi.fn(() => 'https://www.google.com/travel/flights/mock')
}));

vi.mock('$lib/server/flights/request-queue', () => {
	class QueueFullError extends Error {
		constructor() {
			super('queue full');
			this.name = 'QueueFullError';
		}
	}
	return { QueueFullError };
});

import { GET } from './+server';
import { flightProvider } from '$lib/server/flights';
import { getCache, setCache, TTL } from '$lib/server/cache';
import { QueueFullError } from '$lib/server/flights/request-queue';

const event = (searchParams: Record<string, string>) => makeEvent('/api/flights', searchParams);

const validParams = {
	origin: 'DEN',
	destination: 'LAX',
	departDate: '2025-08-01',
	returnDate: '2025-08-05'
};

describe('GET /api/flights', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: new Date('2025-07-01T00:00:00Z') });
		vi.mocked(flightProvider.searchFlights).mockReset();
		vi.mocked(getCache).mockReset().mockReturnValue(null);
		vi.mocked(setCache).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns 400 for 4-letter IATA code', async () => {
		const response = await GET(event({ ...validParams, origin: 'DENX' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/origin/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns 400 for 2-letter IATA code', async () => {
		const response = await GET(event({ ...validParams, destination: 'DE' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/destination/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns 400 when departDate is missing', async () => {
		const { departDate, ...params } = validParams;
		const response = await GET(event(params));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/departDate/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns cached result when cache has a positive hit', async () => {
		const cachedData = {
			flights: [{ price: 200, airline: 'United' }],
			fetchedAt: '2025-07-01T00:00:00Z'
		};
		vi.mocked(getCache).mockImplementation((key: string) => {
			if (key === 'flights:DEN:LAX:2025-08-01:2025-08-05') return cachedData as any;
			return null;
		});

		const response = await GET(event(validParams));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.flights).toEqual([{ price: 200, airline: 'United' }]);
		expect(body.fallbackUrl).toBeTruthy();
		expect(flightProvider.searchFlights).not.toHaveBeenCalled();
	});

	it('returns 503 SCRAPE_UNAVAILABLE when failKey hits (scrape error cache)', async () => {
		vi.mocked(getCache).mockImplementation((key: string) => {
			if (key === 'flights:fail:DEN:LAX:2025-08-01:2025-08-05') return true as any;
			return null;
		});

		const response = await GET(event(validParams));
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.code).toBe('SCRAPE_UNAVAILABLE');
		expect(body.error).toMatch(/temporarily unavailable/i);
		expect(body.fallbackUrl).toBeTruthy();
		expect(flightProvider.searchFlights).not.toHaveBeenCalled();
	});

	it('returns 200 with empty flights when emptyKey hits (no-inventory cache)', async () => {
		// This is the key fix for the NO_INVENTORY regression — the client maps
		// 200-empty to NO_INVENTORY (sticky skip), not null (transient retry).
		vi.mocked(getCache).mockImplementation((key: string) => {
			if (key === 'flights:empty:DEN:LAX:2025-08-01:2025-08-05') return true as any;
			return null;
		});

		const response = await GET(event(validParams));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.flights).toEqual([]);
		expect(body.fallbackUrl).toBeTruthy();
		expect(flightProvider.searchFlights).not.toHaveBeenCalled();
	});

	it('returns 429 with Retry-After header on QueueFullError', async () => {
		vi.mocked(flightProvider.searchFlights).mockRejectedValue(new QueueFullError());

		const response = await GET(event(validParams));
		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('2');
		const body = await response.json();
		expect(body.error).toMatch(/too many/i);
		expect(body.code).toBe('QUEUE_FULL');
	});

	it('returns 503 with SCRAPE_UNAVAILABLE on fresh scrape failure', async () => {
		vi.mocked(flightProvider.searchFlights).mockRejectedValue(new Error('scrape failed'));

		const response = await GET(event(validParams));
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.code).toBe('SCRAPE_UNAVAILABLE');
		expect(body.error).toMatch(/temporarily unavailable/i);
		expect(body.fallbackUrl).toBeTruthy();
	});

	it('caches successful results with FLIGHTS TTL', async () => {
		const result = {
			flights: [{ price: 150, airline: 'Southwest' }],
			fetchedAt: '2025-07-01T00:00:00Z'
		};
		vi.mocked(flightProvider.searchFlights).mockResolvedValue(result as any);

		const response = await GET(event(validParams));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.flights).toHaveLength(1);
		expect(setCache).toHaveBeenCalledWith(
			'flights:DEN:LAX:2025-08-01:2025-08-05',
			result,
			TTL.FLIGHTS
		);
	});

	it('caches empty-inventory under flights:empty:* (sticky, drives client NO_INVENTORY)', async () => {
		const result = {
			flights: [],
			fetchedAt: '2025-07-01T00:00:00Z'
		};
		vi.mocked(flightProvider.searchFlights).mockResolvedValue(result as any);

		const response = await GET(event(validParams));
		expect(response.status).toBe(200);
		// Zero-inventory writes the empty-key, NOT the fail-key — scrape errors and
		// "upstream said no flights" must stay distinguishable so the client's
		// per-comp noInventory skip set only locks on genuine empties.
		expect(setCache).toHaveBeenCalledWith(
			'flights:empty:DEN:LAX:2025-08-01:2025-08-05',
			true,
			5 * 60 * 1000
		);
	});

	it('always includes fallbackUrl in response body', async () => {
		const result = {
			flights: [{ price: 99, airline: 'Frontier' }],
			fetchedAt: '2025-07-01T00:00:00Z'
		};
		vi.mocked(flightProvider.searchFlights).mockResolvedValue(result as any);

		const response = await GET(event(validParams));
		const body = await response.json();
		expect(body.fallbackUrl).toBe('https://www.google.com/travel/flights/mock');
	});
});
