import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeEvent } from '$lib/test-utils/fixtures';

vi.mock('@sveltejs/kit', () => ({
	json: (body: unknown, init?: ResponseInit) => {
		const status = init?.status ?? 200;
		const headers = new Headers(init?.headers);
		return new Response(JSON.stringify(body), { status, headers });
	}
}));

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
		fetchCompetitions: vi.fn(),
		WCAApiError
	};
});

import { GET } from './+server';
import { fetchCompetitions, WCAApiError } from '$lib/server/wca';

const event = (searchParams: Record<string, string>) =>
	makeEvent('/api/competitions', searchParams);

describe('GET /api/competitions', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: new Date('2025-07-01T00:00:00Z') });
		vi.mocked(fetchCompetitions).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns 400 when start param is missing', async () => {
		const response = await GET(event({ end: '2025-08-01' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/missing.*start/i);
		expect(body.code).toBe('MISSING_PARAMETER');
	});

	it('returns 400 for invalid date format', async () => {
		const response = await GET(event({ start: '2025-13-01', end: '2025-08-01' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/invalid start date/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns 400 when date range exceeds 90 days', async () => {
		const response = await GET(event({ start: '2025-01-01', end: '2025-07-01' }));
		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(/date range too large/i);
		expect(body.code).toBe('INVALID_PARAMETER');
	});

	it('returns 502 when WCA API throws WCAApiError', async () => {
		vi.mocked(fetchCompetitions).mockRejectedValue(new WCAApiError(503, 'WCA down'));
		const response = await GET(event({ start: '2025-07-15', end: '2025-08-15' }));
		expect(response.status).toBe(502);
		const body = await response.json();
		expect(body.error).toMatch(/wca api temporarily unavailable/i);
		expect(body.code).toBe('UPSTREAM_UNAVAILABLE');
	});

	it('returns competitions with wcif set to null on success', async () => {
		const mockComps = [
			{ id: 'TestComp2025', name: 'Test Comp', city: 'Denver', wcif: { some: 'data' } },
			{ id: 'AnotherComp2025', name: 'Another Comp', city: 'LA', wcif: { other: 'data' } }
		];
		vi.mocked(fetchCompetitions).mockResolvedValue(mockComps as any);

		const response = await GET(event({ start: '2025-07-15', end: '2025-08-15' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.competitions).toHaveLength(2);
		expect(body.competitions[0].wcif).toBeNull();
		expect(body.competitions[1].wcif).toBeNull();
		expect(body.competitions[0].id).toBe('TestComp2025');
		expect(body.total).toBe(2);
		expect(body.fetchedAt).toBeTruthy();
	});
});
