import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/server/cache', () => ({
	getCache: vi.fn(() => null),
	setCache: vi.fn(),
	TTL: { COMPETITIONS: 3600000, WCIF: 7200000, FLIGHTS: 43200000 }
}));
vi.mock('$lib/server/cache/coalesce', () => ({
	withCoalesce: vi.fn((_key: string, fn: () => Promise<unknown>) => fn())
}));
vi.mock('$lib/utils/enrich-wcif', () => ({
	enrichWCIF: vi.fn((_cancelled: string | null, wcif: any) => ({
		onTheSpotRegistration: false,
		competitorLimit: wcif.competitorLimit,
		competitorCount: wcif.competitorCount,
		registrationStatus: 'open',
		scheduleStartTime: null,
		scheduleEndTime: null
	}))
}));

import {
	parseLinkHeader,
	WCAApiError,
	fetchCompetitions,
	fetchWCIF,
	fetchWCIFBatch,
	enrichCompetitions
} from './client';
import { getCache } from '$lib/server/cache';
import { makeCompetition, makeWCIF } from '$lib/test-utils/fixtures';

const WCA_API_BASE = 'https://www.worldcubeassociation.org/api/v0';

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		statusText: status === 200 ? 'OK' : 'Error',
		json: () => Promise.resolve(body),
		headers: {
			get: (name: string) => headers[name] ?? null
		}
	} as unknown as Response);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────
// parseLinkHeader — 7 existing tests
// ────────────────────────────────────────────────────────────────
describe('parseLinkHeader', () => {
	it('returns empty object for null', () => {
		expect(parseLinkHeader(null)).toEqual({});
	});

	it('returns empty object for empty string', () => {
		expect(parseLinkHeader('')).toEqual({});
	});

	it('parses single rel="next"', () => {
		const header = '<https://www.worldcubeassociation.org/api/v0/competitions?page=2>; rel="next"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://www.worldcubeassociation.org/api/v0/competitions?page=2'
		});
	});

	it('parses multiple rels', () => {
		const header =
			'<https://example.com?page=3>; rel="next", <https://example.com?page=1>; rel="prev"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://example.com?page=3',
			prev: 'https://example.com?page=1'
		});
	});

	it('returns empty for malformed (no angle brackets)', () => {
		expect(parseLinkHeader('https://example.com?page=2; rel="next"')).toEqual({});
	});

	it('returns empty for malformed (no rel)', () => {
		expect(parseLinkHeader('<https://example.com?page=2>')).toEqual({});
	});

	it('handles extra whitespace', () => {
		const header = '<https://example.com?page=2>;   rel="next"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://example.com?page=2'
		});
	});
});

// ────────────────────────────────────────────────────────────────
// wcaFetch via fetchCompetitions — test the internal fetch wrapper
// ────────────────────────────────────────────────────────────────
describe('wcaFetch via fetchCompetitions', () => {
	it('success: returns competitions', async () => {
		const comps = [makeCompetition()];
		vi.mocked(fetch).mockReturnValue(mockFetchResponse(comps));

		const result = await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		expect(result).toEqual(comps);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('500 then 200: retries and succeeds', async () => {
		vi.useFakeTimers();
		const comps = [makeCompetition()];

		vi.mocked(fetch)
			.mockReturnValueOnce(mockFetchResponse(null, 500))
			.mockReturnValueOnce(mockFetchResponse(comps));

		const promise = fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toEqual(comps);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('404: throws WCAApiError immediately', async () => {
		vi.mocked(fetch).mockReturnValue(mockFetchResponse(null, 404));

		await expect(fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' })).rejects.toThrow(
			WCAApiError
		);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('throws WCAApiError with correct status', async () => {
		vi.mocked(fetch).mockReturnValue(mockFetchResponse(null, 429));

		try {
			await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(WCAApiError);
			expect((err as WCAApiError).status).toBe(429);
		}
	});
});

// ────────────────────────────────────────────────────────────────
// fetchCompetitions — pagination and caching
// ────────────────────────────────────────────────────────────────
describe('fetchCompetitions', () => {
	it('follows pagination across 3 pages', async () => {
		const page1 = [makeCompetition({ id: 'Comp1' })];
		const page2 = [makeCompetition({ id: 'Comp2' })];
		const page3 = [makeCompetition({ id: 'Comp3' })];

		vi.mocked(fetch)
			.mockReturnValueOnce(
				mockFetchResponse(page1, 200, {
					Link: `<${WCA_API_BASE}/competitions?page=2>; rel="next"`
				})
			)
			.mockReturnValueOnce(
				mockFetchResponse(page2, 200, {
					Link: `<${WCA_API_BASE}/competitions?page=3>; rel="next"`
				})
			)
			.mockReturnValueOnce(mockFetchResponse(page3));

		const result = await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		expect(result).toHaveLength(3);
		expect(result.map((c) => c.id)).toEqual(['Comp1', 'Comp2', 'Comp3']);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('stops at MAX_PAGES=20', async () => {
		// Every page returns a next link, so pagination would go forever
		vi.mocked(fetch).mockImplementation((_url) => {
			return mockFetchResponse([makeCompetition()], 200, {
				Link: `<${WCA_API_BASE}/competitions?page=999>; rel="next"`
			});
		});

		const result = await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		// MAX_PAGES is 20, so we get 20 pages of 1 competition each
		expect(result).toHaveLength(20);
		expect(fetch).toHaveBeenCalledTimes(20);
	});

	it('rejects non-WCA pagination URLs', async () => {
		const page1 = [makeCompetition({ id: 'Comp1' })];

		vi.mocked(fetch).mockReturnValueOnce(
			mockFetchResponse(page1, 200, {
				Link: '<https://evil.com/api?page=2>; rel="next"'
			})
		);

		const result = await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		// Should stop after page 1 because the next URL is not WCA
		expect(result).toEqual(page1);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('returns cached result on second call', async () => {
		const cached = [makeCompetition({ id: 'CachedComp' })];
		vi.mocked(getCache).mockReturnValueOnce(cached);

		const result = await fetchCompetitions({ start: '2025-08-01', end: '2025-08-31' });
		expect(result).toEqual(cached);
		expect(fetch).not.toHaveBeenCalled();
	});
});

// ────────────────────────────────────────────────────────────────
// fetchWCIF — registration counting and edge cases
// ────────────────────────────────────────────────────────────────
describe('fetchWCIF', () => {
	it('counts only accepted registrations', async () => {
		const rawWcif = {
			id: 'TestComp2025',
			name: 'Test Competition 2025',
			competitorLimit: 100,
			persons: [
				{ registration: { status: 'accepted' } },
				{ registration: { status: 'accepted' } },
				{ registration: { status: 'pending' } },
				{ registration: { status: 'deleted' } }
			],
			registrationInfo: makeWCIF().registrationInfo,
			schedule: makeWCIF().schedule
		};

		vi.mocked(fetch).mockReturnValue(mockFetchResponse(rawWcif));

		const result = await fetchWCIF('TestComp2025');
		expect(result.competitorCount).toBe(2);
	});

	it('handles undefined persons array', async () => {
		const rawWcif = {
			id: 'TestComp2025',
			name: 'Test Competition 2025',
			competitorLimit: 100,
			// persons is undefined
			registrationInfo: makeWCIF().registrationInfo,
			schedule: makeWCIF().schedule
		};

		vi.mocked(fetch).mockReturnValue(mockFetchResponse(rawWcif));

		const result = await fetchWCIF('TestComp2025');
		expect(result.competitorCount).toBe(0);
	});
});

// ────────────────────────────────────────────────────────────────
// fetchWCIFBatch — concurrency and failure tolerance
// ────────────────────────────────────────────────────────────────
describe('fetchWCIFBatch', () => {
	it('processes in chunks with delay', async () => {
		vi.useFakeTimers();

		const wcifTemplate = makeWCIF();
		// 5 ids with concurrency 2 => 3 chunks
		const ids = ['A', 'B', 'C', 'D', 'E'];

		vi.mocked(fetch).mockImplementation((url) => {
			const idMatch = String(url).match(/\/wcif\/public$/);
			return mockFetchResponse({
				id: idMatch ? 'matched' : 'unknown',
				name: 'Comp',
				competitorLimit: 100,
				persons: [{ registration: { status: 'accepted' } }],
				registrationInfo: wcifTemplate.registrationInfo,
				schedule: wcifTemplate.schedule
			});
		});

		const promise = fetchWCIFBatch(ids, { concurrency: 2, delayMs: 100 });
		await vi.runAllTimersAsync();
		const results = await promise;

		expect(results.size).toBe(5);
		// 5 ids at concurrency 2 = 3 chunks, each chunk fetches individually
		expect(fetch).toHaveBeenCalledTimes(5);
	});

	it('tolerates individual failures', async () => {
		vi.useFakeTimers();

		const wcifTemplate = makeWCIF();
		const ids = ['OK1', 'FAIL', 'OK2'];

		vi.mocked(fetch).mockImplementation((url) => {
			if (String(url).includes('FAIL')) {
				return mockFetchResponse(null, 500);
			}
			return mockFetchResponse({
				id: 'comp',
				name: 'Comp',
				competitorLimit: 100,
				persons: [{ registration: { status: 'accepted' } }],
				registrationInfo: wcifTemplate.registrationInfo,
				schedule: wcifTemplate.schedule
			});
		});

		const promise = fetchWCIFBatch(ids, { concurrency: 3 });
		await vi.runAllTimersAsync();
		const results = await promise;

		// FAIL will throw after retries, so it won't be in the map
		expect(results.has('OK1')).toBe(true);
		expect(results.has('OK2')).toBe(true);
		expect(results.has('FAIL')).toBe(false);
	});
});

// ────────────────────────────────────────────────────────────────
// enrichCompetitions — WCIF merging
// ────────────────────────────────────────────────────────────────
describe('enrichCompetitions', () => {
	it('merges WCIF into competitions', async () => {
		vi.useFakeTimers();

		const comps = [makeCompetition({ id: 'Comp1' }), makeCompetition({ id: 'Comp2' })];
		const wcifTemplate = makeWCIF();

		vi.mocked(fetch).mockImplementation(() => {
			return mockFetchResponse({
				id: 'comp',
				name: 'Comp',
				competitorLimit: 80,
				persons: [
					{ registration: { status: 'accepted' } },
					{ registration: { status: 'accepted' } }
				],
				registrationInfo: wcifTemplate.registrationInfo,
				schedule: wcifTemplate.schedule
			});
		});

		const promise = enrichCompetitions(comps);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toHaveLength(2);
		expect(result[0].wcif).not.toBeNull();
		expect(result[0].wcif!.competitorLimit).toBe(80);
		expect(result[0].wcif!.competitorCount).toBe(2);
		expect(result[1].wcif).not.toBeNull();
	});

	it('sets wcif=null for failed WCIF fetches', async () => {
		vi.useFakeTimers();

		const comps = [makeCompetition({ id: 'GoodComp' }), makeCompetition({ id: 'BadComp' })];
		const wcifTemplate = makeWCIF();

		vi.mocked(fetch).mockImplementation((url) => {
			if (String(url).includes('BadComp')) {
				return mockFetchResponse(null, 500);
			}
			return mockFetchResponse({
				id: 'GoodComp',
				name: 'Good',
				competitorLimit: 100,
				persons: [{ registration: { status: 'accepted' } }],
				registrationInfo: wcifTemplate.registrationInfo,
				schedule: wcifTemplate.schedule
			});
		});

		const promise = enrichCompetitions(comps);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toHaveLength(2);
		const good = result.find((c) => c.id === 'GoodComp');
		const bad = result.find((c) => c.id === 'BadComp');
		expect(good!.wcif).not.toBeNull();
		expect(bad!.wcif).toBeNull();
	});
});
