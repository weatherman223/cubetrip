import { describe, it, expect } from 'vitest';
import {
	parseFlightResponse,
	combineDateAndTime,
	normalizeDate,
	normalizeTime
} from './response-parser';

describe('normalizeDate', () => {
	it('converts Google`s array form [year, month, day] to YYYY-MM-DD', () => {
		expect(normalizeDate([2026, 4, 25])).toBe('2026-04-25');
	});

	it('pads single-digit month and day', () => {
		expect(normalizeDate([2026, 1, 5])).toBe('2026-01-05');
	});

	it('passes through string form untouched (older payload shape)', () => {
		expect(normalizeDate('2026-04-25')).toBe('2026-04-25');
	});

	it('returns empty for null/undefined/malformed arrays', () => {
		expect(normalizeDate(null)).toBe('');
		expect(normalizeDate(undefined)).toBe('');
		expect(normalizeDate([2026])).toBe('');
		expect(normalizeDate(['2026', '4', '25'])).toBe('');
	});
});

describe('normalizeTime', () => {
	it('converts [hour, minute] array to HH:MM', () => {
		expect(normalizeTime([17, 40])).toBe('17:40');
	});

	it('pads single-digit hour and minute', () => {
		expect(normalizeTime([7, 5])).toBe('07:05');
	});

	it('treats missing minute as :00 (observed for exact-hour departures)', () => {
		expect(normalizeTime([16])).toBe('16:00');
	});

	it('passes through string form untouched', () => {
		expect(normalizeTime('9:35 AM')).toBe('9:35 AM');
	});

	it('returns empty for null/undefined/malformed arrays', () => {
		expect(normalizeTime(null)).toBe('');
		expect(normalizeTime([])).toBe('');
		expect(normalizeTime(['17', '40'])).toBe('');
	});
});

describe('combineDateAndTime', () => {
	it('returns empty for empty date', () => {
		expect(combineDateAndTime('', '1:30 PM')).toBe('');
	});

	it('returns empty for empty time', () => {
		expect(combineDateAndTime('2025-06-01', '')).toBe('');
	});

	it('handles 12:00 AM (midnight)', () => {
		expect(combineDateAndTime('2025-06-01', '12:00 AM')).toBe('2025-06-01T00:00:00');
	});

	it('handles 12:00 PM (noon)', () => {
		expect(combineDateAndTime('2025-06-01', '12:00 PM')).toBe('2025-06-01T12:00:00');
	});

	it('handles 1:30 PM', () => {
		expect(combineDateAndTime('2025-06-01', '1:30 PM')).toBe('2025-06-01T13:30:00');
	});

	it('handles 11:59 PM', () => {
		expect(combineDateAndTime('2025-06-01', '11:59 PM')).toBe('2025-06-01T23:59:00');
	});

	it('handles 12:01 AM', () => {
		expect(combineDateAndTime('2025-06-01', '12:01 AM')).toBe('2025-06-01T00:01:00');
	});

	it('handles 1:00 AM', () => {
		expect(combineDateAndTime('2025-06-01', '1:00 AM')).toBe('2025-06-01T01:00:00');
	});

	it('handles 24h format 13:30', () => {
		expect(combineDateAndTime('2025-06-01', '13:30')).toBe('2025-06-01T13:30:00');
	});

	it('handles 24h format 0:00 (midnight)', () => {
		expect(combineDateAndTime('2025-06-01', '0:00')).toBe('2025-06-01T00:00:00');
	});

	it('handles 24h format 23:59', () => {
		expect(combineDateAndTime('2025-06-01', '23:59')).toBe('2025-06-01T23:59:00');
	});

	it('handles ISO date format with AM/PM time', () => {
		expect(combineDateAndTime('2025-06-01', '9:00 AM')).toBe('2025-06-01T09:00:00');
	});
});

describe('parseFlightResponse', () => {
	it('returns empty array for empty string', () => {
		expect(parseFlightResponse('')).toEqual([]);
	});

	it('returns empty array when no ds:1 script tag', () => {
		expect(parseFlightResponse('<html><body>hello</body></html>')).toEqual([]);
	});

	it('returns empty array for malformed payload', () => {
		expect(parseFlightResponse('<script class="ds:1">data:[undefined]</script>')).toEqual([]);
	});
});
