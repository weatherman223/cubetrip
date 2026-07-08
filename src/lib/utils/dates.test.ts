import { describe, it, expect, vi, afterEach } from 'vitest';
import { toYMD, getWeekend, utcToVenueLocal } from './dates';

describe('toYMD', () => {
	it('formats a date as YYYY-MM-DD', () => {
		expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
	});

	it('pads single-digit months and days', () => {
		expect(toYMD(new Date(2026, 2, 7))).toBe('2026-03-07');
	});
});

describe('getWeekend', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('on Saturday (weeksAhead=1) returns today + tomorrow', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 28)); // Saturday March 28 2026
		const { start, end } = getWeekend(1);
		expect(start).toBe('2026-03-28');
		expect(end).toBe('2026-03-29');
	});

	it('on Saturday (weeksAhead=2) returns next Saturday + Sunday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 28));
		const { start, end } = getWeekend(2);
		expect(start).toBe('2026-04-04');
		expect(end).toBe('2026-04-05');
	});

	it('on Sunday (weeksAhead=1) returns upcoming Saturday + Sunday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 29)); // Sunday March 29
		const { start, end } = getWeekend(1);
		expect(start).toBe('2026-04-04');
		expect(end).toBe('2026-04-05');
	});

	it('on Wednesday (weeksAhead=1) returns coming Saturday + Sunday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 25)); // Wednesday March 25
		const { start, end } = getWeekend(1);
		expect(start).toBe('2026-03-28');
		expect(end).toBe('2026-03-29');
	});

	it('on Friday (weeksAhead=1) returns tomorrow + day after', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 27)); // Friday March 27
		const { start, end } = getWeekend(1);
		expect(start).toBe('2026-03-28');
		expect(end).toBe('2026-03-29');
	});

	it('handles year boundary (Friday Dec 31)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2027, 11, 31)); // Friday Dec 31 2027
		const { start, end } = getWeekend(1);
		expect(start).toBe('2028-01-01');
		expect(end).toBe('2028-01-02');
	});
});

describe('utcToVenueLocal', () => {
	it('converts a UTC instant into venue-local wall-clock time (US, DST)', () => {
		// 14:00Z on Aug 15 = 9:00 AM in Chicago (CDT, UTC-5)
		expect(utcToVenueLocal('2026-08-15T14:00:00Z', 'America/Chicago')).toBe('2026-08-15T09:00:00');
	});

	it('converts across a day boundary (EU, UTC+ zone)', () => {
		// 23:30Z on Aug 15 = 01:30 the NEXT day in Berlin (CEST, UTC+2)
		expect(utcToVenueLocal('2026-08-15T23:30:00Z', 'Europe/Berlin')).toBe('2026-08-16T01:30:00');
	});

	it('respects standard vs daylight offsets', () => {
		// Chicago in January is CST (UTC-6), not CDT.
		expect(utcToVenueLocal('2026-01-15T14:00:00Z', 'America/Chicago')).toBe('2026-01-15T08:00:00');
	});

	it('returns the input unchanged for an invalid IANA timezone', () => {
		expect(utcToVenueLocal('2026-08-15T14:00:00Z', 'Not/AZone')).toBe('2026-08-15T14:00:00Z');
	});

	it('formats midnight as 00, not 24', () => {
		// 05:00Z = midnight in Denver (MDT, UTC-6)... use a case landing exactly on 00:xx
		expect(utcToVenueLocal('2026-08-15T06:00:00Z', 'America/Denver')).toBe('2026-08-15T00:00:00');
	});
});
