import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WCIFPublicData, WCIFActivity } from '$lib/server/wca/types';
import {
	enrichWCIF,
	computeRegistrationStatus,
	collectActivities,
	computeScheduleTimes
} from './enrich-wcif';

// Helper to build a minimal WCIFPublicData
function makeWcif(overrides: Partial<WCIFPublicData> = {}): WCIFPublicData {
	return {
		id: 'Test2026',
		name: 'Test Competition 2026',
		competitorLimit: 100,
		competitorCount: 50,
		registrationInfo: {
			openTime: '2025-01-01T00:00:00Z',
			closeTime: '2025-12-31T23:59:59Z',
			baseEntryFee: 1500,
			currencyCode: 'USD',
			onTheSpotRegistration: false,
			useWcaRegistration: true
		},
		schedule: { startDate: '2025-06-01', numberOfDays: 2, venues: [] },
		...overrides
	};
}

function makeActivity(
	id: number,
	start: string,
	end: string,
	children: WCIFActivity[] = []
): WCIFActivity {
	return {
		id,
		name: `Activity ${id}`,
		activityCode: `other-${id}`,
		startTime: start,
		endTime: end,
		childActivities: children
	};
}

describe('computeRegistrationStatus', () => {
	afterEach(() => vi.useRealTimers());

	it('returns closed when cancelled', () => {
		expect(computeRegistrationStatus('2025-01-01T00:00:00Z', makeWcif())).toBe('closed');
	});

	it('returns not-open-yet before open window (no OTS)', () => {
		vi.useFakeTimers({ now: new Date('2024-06-01T00:00:00Z') });
		const wcif = makeWcif({
			registrationInfo: {
				...makeWcif().registrationInfo,
				openTime: '2025-01-01T00:00:00Z',
				closeTime: '2025-12-31T23:59:59Z',
				onTheSpotRegistration: false
			}
		});
		expect(computeRegistrationStatus(null, wcif)).toBe('not-open-yet');
	});

	it('returns not-open-yet before open window even when OTS is true', () => {
		vi.useFakeTimers({ now: new Date('2024-06-01T00:00:00Z') });
		const wcif = makeWcif({
			registrationInfo: {
				...makeWcif().registrationInfo,
				openTime: '2025-01-01T00:00:00Z',
				closeTime: '2025-12-31T23:59:59Z',
				onTheSpotRegistration: true
			}
		});
		expect(computeRegistrationStatus(null, wcif)).toBe('not-open-yet');
	});

	it('returns open when in window and under limit', () => {
		vi.useFakeTimers({ now: new Date('2025-06-15T00:00:00Z') });
		expect(computeRegistrationStatus(null, makeWcif({ competitorCount: 50 }))).toBe('open');
	});

	it('returns open when in window and no competitor limit', () => {
		vi.useFakeTimers({ now: new Date('2025-06-15T00:00:00Z') });
		expect(
			computeRegistrationStatus(null, makeWcif({ competitorLimit: null, competitorCount: 999 }))
		).toBe('open');
	});

	it('returns waitlist when in window and at limit (boundary)', () => {
		vi.useFakeTimers({ now: new Date('2025-06-15T00:00:00Z') });
		expect(
			computeRegistrationStatus(null, makeWcif({ competitorLimit: 100, competitorCount: 100 }))
		).toBe('waitlist');
	});

	it('returns waitlist when in window and over limit', () => {
		vi.useFakeTimers({ now: new Date('2025-06-15T00:00:00Z') });
		expect(
			computeRegistrationStatus(null, makeWcif({ competitorLimit: 100, competitorCount: 150 }))
		).toBe('waitlist');
	});

	it('returns on-the-spot after close when OTS is true', () => {
		vi.useFakeTimers({ now: new Date('2026-06-01T00:00:00Z') });
		const wcif = makeWcif({
			registrationInfo: {
				...makeWcif().registrationInfo,
				onTheSpotRegistration: true
			}
		});
		expect(computeRegistrationStatus(null, wcif)).toBe('on-the-spot');
	});

	it('returns closed after close when OTS is false', () => {
		vi.useFakeTimers({ now: new Date('2026-06-01T00:00:00Z') });
		expect(computeRegistrationStatus(null, makeWcif())).toBe('closed');
	});

	it('returns open when now equals openTime (boundary)', () => {
		vi.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
		expect(computeRegistrationStatus(null, makeWcif())).toBe('open');
	});

	it('returns open when now equals closeTime (boundary)', () => {
		vi.useFakeTimers({ now: new Date('2025-12-31T23:59:59Z') });
		expect(computeRegistrationStatus(null, makeWcif())).toBe('open');
	});
});

describe('collectActivities', () => {
	it('returns empty for empty input', () => {
		expect(collectActivities([])).toEqual([]);
	});

	it('returns single activity with no children', () => {
		const a = makeActivity(1, 'T09:00', 'T10:00');
		expect(collectActivities([a])).toEqual([a]);
	});

	it('flattens one level of children (DFS pre-order)', () => {
		const child = makeActivity(2, 'T09:30', 'T10:00');
		const parent = makeActivity(1, 'T09:00', 'T10:00', [child]);
		const result = collectActivities([parent]);
		expect(result.map((a) => a.id)).toEqual([1, 2]);
	});

	it('flattens deeply nested children', () => {
		const grandchild = makeActivity(3, 'T09:30', 'T09:45');
		const child = makeActivity(2, 'T09:00', 'T10:00', [grandchild]);
		const parent = makeActivity(1, 'T08:00', 'T11:00', [child]);
		const result = collectActivities([parent]);
		expect(result.map((a) => a.id)).toEqual([1, 2, 3]);
	});

	it('handles multiple siblings with children', () => {
		const c1 = makeActivity(3, 'T09:00', 'T10:00');
		const c2 = makeActivity(4, 'T11:00', 'T12:00');
		const p1 = makeActivity(1, 'T09:00', 'T10:00', [c1]);
		const p2 = makeActivity(2, 'T11:00', 'T12:00', [c2]);
		expect(collectActivities([p1, p2]).map((a) => a.id)).toEqual([1, 3, 2, 4]);
	});
});

describe('computeScheduleTimes', () => {
	it('returns nulls for empty venues', () => {
		const wcif = makeWcif({ schedule: { startDate: '2025-06-01', numberOfDays: 1, venues: [] } });
		expect(computeScheduleTimes(wcif)).toEqual({ start: null, end: null });
	});

	it('returns nulls for rooms with no activities', () => {
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'UTC',
						rooms: [{ id: 1, name: 'R', activities: [] }]
					}
				]
			}
		});
		expect(computeScheduleTimes(wcif)).toEqual({ start: null, end: null });
	});

	it('returns times for a single activity', () => {
		const a = makeActivity(1, '2025-06-01T09:00:00Z', '2025-06-01T10:00:00Z');
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'UTC',
						rooms: [{ id: 1, name: 'R', activities: [a] }]
					}
				]
			}
		});
		expect(computeScheduleTimes(wcif)).toEqual({
			start: '2025-06-01T09:00:00Z',
			end: '2025-06-01T10:00:00Z'
		});
	});

	it('picks min start and max end across multiple activities', () => {
		const a1 = makeActivity(1, '2025-06-01T09:00:00Z', '2025-06-01T10:00:00Z');
		const a2 = makeActivity(2, '2025-06-01T08:00:00Z', '2025-06-01T11:00:00Z');
		const a3 = makeActivity(3, '2025-06-01T10:00:00Z', '2025-06-01T12:00:00Z');
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'UTC',
						rooms: [{ id: 1, name: 'R', activities: [a1, a2, a3] }]
					}
				]
			}
		});
		expect(computeScheduleTimes(wcif)).toEqual({
			start: '2025-06-01T08:00:00Z',
			end: '2025-06-01T12:00:00Z'
		});
	});

	it('includes nested child activities in min/max', () => {
		const child = makeActivity(2, '2025-06-01T06:00:00Z', '2025-06-01T13:00:00Z');
		const parent = makeActivity(1, '2025-06-01T09:00:00Z', '2025-06-01T12:00:00Z', [child]);
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'UTC',
						rooms: [{ id: 1, name: 'R', activities: [parent] }]
					}
				]
			}
		});
		expect(computeScheduleTimes(wcif)).toEqual({
			start: '2025-06-01T06:00:00Z',
			end: '2025-06-01T13:00:00Z'
		});
	});
});

describe('enrichWCIF', () => {
	it('composes registration status and schedule times', () => {
		vi.useFakeTimers({ now: new Date('2025-06-15T00:00:00Z') });
		const a = makeActivity(1, '2025-06-01T09:00:00Z', '2025-06-01T17:00:00Z');
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'UTC',
						rooms: [{ id: 1, name: 'R', activities: [a] }]
					}
				]
			}
		});
		const result = enrichWCIF(null, wcif);
		expect(result.registrationStatus).toBe('open');
		expect(result.scheduleStartTime).toBe('2025-06-01T09:00:00Z');
		expect(result.scheduleEndTime).toBe('2025-06-01T17:00:00Z');
		expect(result.competitorCount).toBe(50);
		vi.useRealTimers();
	});

	it('handles cancelled competition', () => {
		const result = enrichWCIF('2025-01-01', makeWcif());
		expect(result.registrationStatus).toBe('closed');
	});

	it('surfaces the first venue timezone for venue-local schedule comparisons', () => {
		const wcif = makeWcif({
			schedule: {
				startDate: '2025-06-01',
				numberOfDays: 1,
				venues: [
					{
						id: 1,
						name: 'V',
						latitudeMicrodegrees: 0,
						longitudeMicrodegrees: 0,
						countryIso2: 'US',
						timezone: 'America/Chicago',
						rooms: []
					}
				]
			}
		});
		expect(enrichWCIF(null, wcif).venueTimezone).toBe('America/Chicago');
	});

	it('venueTimezone is null when the schedule has no venues', () => {
		const wcif = makeWcif({
			schedule: { startDate: '2025-06-01', numberOfDays: 1, venues: [] }
		});
		expect(enrichWCIF(null, wcif).venueTimezone).toBeNull();
	});
});
