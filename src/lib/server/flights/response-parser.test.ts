import { describe, it, expect } from 'vitest';
import { parseFlightResponse, combineDateAndTime } from './response-parser';

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
		expect(
			parseFlightResponse('<script class="ds:1">data:[undefined]</script>')
		).toEqual([]);
	});
});
