import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEvent } from '$lib/test-utils/fixtures';

vi.mock('@sveltejs/kit', () => ({
	json: (body: unknown, init?: ResponseInit) => {
		const status = init?.status ?? 200;
		return new Response(JSON.stringify(body), { status });
	}
}));

vi.mock('$app/environment', () => ({ dev: false }));

vi.mock('$lib/server/wca', () => {
	class WCAApiError extends Error {
		status: number;
		constructor(status: number, msg: string) {
			super(msg);
			this.status = status;
			this.name = 'WCAApiError';
		}
	}
	return {
		fetchWCIF: vi.fn(),
		WCAApiError
	};
});

// In-memory stand-in for the failure cache so tests can assert cache hit/miss.
vi.mock('$lib/server/cache', () => {
	const store = new Map<string, unknown>();
	return {
		getCache: vi.fn((key: string) => (store.has(key) ? store.get(key) : null)),
		setCache: vi.fn((key: string, value: unknown) => {
			store.set(key, value);
		}),
		TTL: { WCIF_FAILURE: 5 * 60 * 1000 },
		__cacheStore: store
	};
});

import { GET } from './[id]/+server';
import { fetchWCIF, WCAApiError } from '$lib/server/wca';
import * as cacheModule from '$lib/server/cache';

const event = (params: Record<string, string>, searchParams: Record<string, string> = {}) =>
	makeEvent('/api/wcif/TestComp2025', searchParams, params);

function makeWCIF() {
	return {
		formatVersion: '1.0',
		id: 'TestComp2025',
		name: 'Test Competition 2025',
		shortName: 'Test 2025',
		persons: [],
		events: [],
		schedule: { numberOfDays: 2, venues: [] }
	};
}

describe('GET /api/wcif/:id', () => {
	beforeEach(() => {
		vi.mocked(fetchWCIF).mockReset();
		// Reset the in-memory cache between tests.
		const store = (cacheModule as unknown as { __cacheStore: Map<string, unknown> }).__cacheStore;
		store.clear();
		vi.mocked(cacheModule.getCache).mockClear();
		vi.mocked(cacheModule.setCache).mockClear();
	});

	it('returns 400 for ID with special characters', async () => {
		const response = await GET(event({ id: 'Test!@#' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/invalid competition id/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns 502 when WCA API throws WCAApiError', async () => {
		vi.mocked(fetchWCIF).mockRejectedValue(new WCAApiError(503, 'WCA unavailable'));

		const response = await GET(event({ id: 'TestComp2025' }));
		expect(response.status).toBe(502);
		const body = await response.json();
		expect(body.error).toMatch(/wca api temporarily unavailable/i);
		expect(body.code).toBe('UPSTREAM_UNAVAILABLE');
	});

	it('returns 500 with INTERNAL_ERROR on unexpected error', async () => {
		vi.mocked(fetchWCIF).mockRejectedValue(new Error('boom'));

		const response = await GET(event({ id: 'TestComp2025' }));
		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.code).toBe('INTERNAL_ERROR');
	});

	it('second failing GET hits the failure cache instead of fetchWCIF', async () => {
		vi.mocked(fetchWCIF).mockRejectedValue(new WCAApiError(503, 'WCA unavailable'));

		const first = await GET(event({ id: 'TestComp2025' }));
		expect(first.status).toBe(502);
		expect(vi.mocked(fetchWCIF)).toHaveBeenCalledTimes(1);

		const second = await GET(event({ id: 'TestComp2025' }));
		expect(second.status).toBe(502);
		// Second request served from failure cache — fetchWCIF not called again.
		expect(vi.mocked(fetchWCIF)).toHaveBeenCalledTimes(1);
	});

	it('nocache=1 bypasses the failure cache', async () => {
		vi.mocked(fetchWCIF).mockRejectedValue(new WCAApiError(503, 'WCA unavailable'));

		await GET(event({ id: 'TestComp2025' }));
		expect(vi.mocked(fetchWCIF)).toHaveBeenCalledTimes(1);

		await GET(event({ id: 'TestComp2025' }, { nocache: '1' }));
		// nocache=1 forces a fresh upstream call even with a warm failure cache.
		expect(vi.mocked(fetchWCIF)).toHaveBeenCalledTimes(2);
	});

	it('positive cache wins over failKey: refresh failure does not poison cached data', async () => {
		// Scenario: a successful scrape earlier populated wcif:TestComp2025 (2h TTL).
		// Then a per-card refresh (nocache=1) triggered a transient upstream error
		// that wrote wcif:fail:TestComp2025 (5min TTL). A third NORMAL request
		// must serve the cached-good data, not the 502. Otherwise one user's failed
		// refresh dead-ends every other user's view for 5 minutes.
		const cachedWcif = makeWCIF();
		const store = (cacheModule as unknown as { __cacheStore: Map<string, unknown> }).__cacheStore;
		store.set('wcif:TestComp2025', cachedWcif);
		store.set('wcif:fail:TestComp2025', true);

		const response = await GET(event({ id: 'TestComp2025' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.wcif).toEqual(cachedWcif);
		// Positive cache served directly — fetchWCIF never called.
		expect(vi.mocked(fetchWCIF)).not.toHaveBeenCalled();
	});

	it('returns wcif data on success', async () => {
		const wcif = makeWCIF();
		vi.mocked(fetchWCIF).mockResolvedValue(wcif as any);

		const response = await GET(event({ id: 'TestComp2025' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.wcif).toEqual(wcif);
		expect(body.wcif.id).toBe('TestComp2025');
		expect(body.wcif.name).toBe('Test Competition 2025');
	});
});
