import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./enrich-wcif', () => ({
	enrichWCIF: vi.fn((_cancelled: string | null, wcif: any) => ({
		onTheSpotRegistration: false,
		competitorLimit: wcif.competitorLimit ?? null,
		competitorCount: wcif.competitorCount ?? 0,
		registrationStatus: 'open' as const,
		scheduleStartTime: null,
		scheduleEndTime: null
	}))
}));

import { retryUnknownComps } from './wcif-retry';
import { makeEnrichedCompetition, makeWCIF } from '$lib/test-utils/fixtures';

function mockFetchOk(wcif: unknown) {
	return Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve({ wcif })
	} as unknown as Response);
}

function mockFetchFail(status = 500) {
	return Promise.resolve({
		ok: false,
		status,
		json: () => Promise.resolve({})
	} as unknown as Response);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('fetch', vi.fn());
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('retryUnknownComps', () => {
	it('no unknown comps: returns immediately without fetching', async () => {
		const comps = [
			makeEnrichedCompetition({
				id: 'HasWcif',
				wcif: {
					onTheSpotRegistration: false,
					competitorLimit: 100,
					competitorCount: 50,
					registrationStatus: 'open',
					scheduleStartTime: null,
					scheduleEndTime: null
				}
			})
		];
		const onUpdate = vi.fn();

		await retryUnknownComps(comps, onUpdate);

		expect(fetch).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('all succeed on first attempt: all comps get wcif populated', async () => {
		const comps = [
			makeEnrichedCompetition({ id: 'CompA', wcif: null }),
			makeEnrichedCompetition({ id: 'CompB', wcif: null })
		];
		const onUpdate = vi.fn();
		const wcifData = makeWCIF();

		vi.mocked(fetch).mockImplementation(() => mockFetchOk(wcifData));

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		expect(comps[0].wcif).not.toBeNull();
		expect(comps[1].wcif).not.toBeNull();
		expect(comps[0].wcif!.competitorCount).toBe(wcifData.competitorCount);
		expect(comps[1].wcif!.competitorCount).toBe(wcifData.competitorCount);
	});

	it('some fail then succeed on retry', async () => {
		const comps = [
			makeEnrichedCompetition({ id: 'CompA', wcif: null }),
			makeEnrichedCompetition({ id: 'CompB', wcif: null })
		];
		const onUpdate = vi.fn();
		const wcifData = makeWCIF();

		let compBAttempt = 0;
		vi.mocked(fetch).mockImplementation((url) => {
			if (String(url).includes('CompB')) {
				compBAttempt++;
				if (compBAttempt === 1) return mockFetchFail(500);
			}
			return mockFetchOk(wcifData);
		});

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		// CompA succeeds on first attempt, CompB on second
		expect(comps[0].wcif).not.toBeNull();
		expect(comps[1].wcif).not.toBeNull();
		// CompB was fetched twice (first fail, then success)
		expect(compBAttempt).toBe(2);
	});

	it('stops after MAX_RETRIES', async () => {
		const comps = [makeEnrichedCompetition({ id: 'AlwaysFails', wcif: null })];
		const onUpdate = vi.fn();

		vi.mocked(fetch).mockImplementation(() => mockFetchFail(500));

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		// MAX_RETRIES = 3 (tightened from 5), so fetch is called 3 times
		expect(vi.mocked(fetch).mock.calls.length).toBe(3);
		// wcif should still be null since all attempts failed
		expect(comps[0].wcif).toBeNull();
	});

	it('onUpdate fires once per attempt that resolves at least one comp', async () => {
		// All succeed on first attempt → single onUpdate.
		const comps = Array.from({ length: 7 }, (_, i) =>
			makeEnrichedCompetition({ id: `Comp${i}`, wcif: null })
		);
		const onUpdate = vi.fn();
		const wcifData = makeWCIF();

		vi.mocked(fetch).mockImplementation(() => mockFetchOk(wcifData));

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		expect(onUpdate).toHaveBeenCalledTimes(1);
		// Each call receives an array (spread copy of competitions)
		expect(Array.isArray(onUpdate.mock.calls[0][0])).toBe(true);
	});

	it('fans out all unresolved comps in parallel per attempt', async () => {
		// 20 comps; attempt 1 fails 3 of them. Attempt 2 should fire exactly those
		// 3 in a single parallel burst, not batched.
		const comps = Array.from({ length: 20 }, (_, i) =>
			makeEnrichedCompetition({ id: `ParComp${i}`, wcif: null })
		);
		const onUpdate = vi.fn();
		const wcifData = makeWCIF();
		const failIds = new Set(['ParComp3', 'ParComp11', 'ParComp17']);
		const seen = new Map<string, number>(); // id -> times requested
		let attempt1Calls = 0;
		let attempt2Calls = 0;
		let inflight = 0;
		let peakInflight = 0;

		vi.mocked(fetch).mockImplementation(async (url) => {
			const id = String(url).split('/').pop()!;
			const seenCount = (seen.get(id) ?? 0) + 1;
			seen.set(id, seenCount);
			inflight++;
			peakInflight = Math.max(peakInflight, inflight);
			if (seenCount === 1) attempt1Calls++;
			else attempt2Calls++;
			// Yield so concurrent callers can increment inflight too
			await Promise.resolve();
			inflight--;
			if (seenCount === 1 && failIds.has(id)) return mockFetchFail(500);
			return mockFetchOk(wcifData);
		});

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		expect(attempt1Calls).toBe(20);
		expect(attempt2Calls).toBe(3);
		expect(peakInflight).toBeGreaterThanOrEqual(20);
		for (const c of comps) expect(c.wcif).not.toBeNull();
	});

	it('mutates competitions array in place', async () => {
		const comps = [
			makeEnrichedCompetition({ id: 'Mutate1', wcif: null }),
			makeEnrichedCompetition({ id: 'Mutate2', wcif: null })
		];
		const originalRef = comps;
		const onUpdate = vi.fn();
		const wcifData = makeWCIF();

		vi.mocked(fetch).mockImplementation(() => mockFetchOk(wcifData));

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		// Same array reference — mutations happen in place
		expect(comps).toBe(originalRef);
		// wcif was populated on the original objects
		expect(comps[0].wcif).not.toBeNull();
		expect(comps[1].wcif).not.toBeNull();
		// onUpdate receives a spread copy, not the same reference
		expect(onUpdate.mock.calls[0][0]).not.toBe(comps);
	});

	it('backoff increases between retries', async () => {
		const comps = [makeEnrichedCompetition({ id: 'BackoffComp', wcif: null })];
		const onUpdate = vi.fn();

		vi.mocked(fetch).mockImplementation(() => mockFetchFail(500));

		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

		const promise = retryUnknownComps(comps, onUpdate);
		await vi.runAllTimersAsync();
		await promise;

		// Extract the delay values passed to setTimeout for backoff waits.
		// MAX_RETRIES=3 and backoff base=1000: attempts 1..2 wait 1000, 2000ms.
		// Filter is broad to tolerate future tuning; what we care about is the
		// exponential shape, not the absolute magnitude.
		const delays = setTimeoutSpy.mock.calls
			.map((call) => call[1])
			.filter((d): d is number => typeof d === 'number' && d >= 500);

		expect(delays.length).toBeGreaterThanOrEqual(2);
		// Verify delays are in strictly increasing order (exponential shape).
		for (let i = 1; i < delays.length; i++) {
			expect(delays[i]).toBeGreaterThan(delays[i - 1]);
		}

		setTimeoutSpy.mockRestore();
	});
});
