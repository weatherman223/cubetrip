import { describe, it, expect, vi, afterEach } from 'vitest';
import { isValidDate, isDateRangeValid } from './validation';

describe('isValidDate', () => {
	afterEach(() => vi.useRealTimers());

	it('accepts a valid date', () => {
		vi.useFakeTimers({ now: new Date('2026-03-25') });
		expect(isValidDate('2026-06-15')).toBe(true);
	});

	it('rejects slash separators', () => {
		expect(isValidDate('2025/06/15')).toBe(false);
	});

	it('rejects missing leading zeros', () => {
		expect(isValidDate('2025-6-15')).toBe(false);
	});

	it('rejects Feb 30 (impossible date)', () => {
		expect(isValidDate('2025-02-30')).toBe(false);
	});

	it('rejects month 13', () => {
		expect(isValidDate('2025-13-01')).toBe(false);
	});

	it('rejects month 00', () => {
		expect(isValidDate('2025-00-01')).toBe(false);
	});

	it('rejects day 00', () => {
		expect(isValidDate('2025-01-00')).toBe(false);
	});

	it('accepts leap year Feb 29', () => {
		vi.useFakeTimers({ now: new Date('2024-01-01') });
		expect(isValidDate('2024-02-29')).toBe(true);
	});

	it('rejects non-leap year Feb 29', () => {
		expect(isValidDate('2025-02-29')).toBe(false);
	});

	it('rejects dates before 2020', () => {
		expect(isValidDate('2019-12-31')).toBe(false);
	});

	it('accepts exactly 2020-01-01', () => {
		vi.useFakeTimers({ now: new Date('2025-01-01') });
		expect(isValidDate('2020-01-01')).toBe(true);
	});

	it('rejects dates more than 1 year in the future', () => {
		vi.useFakeTimers({ now: new Date('2026-03-25') });
		expect(isValidDate('2027-03-26')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(isValidDate('')).toBe(false);
	});

	it('rejects garbage', () => {
		expect(isValidDate('not-a-date')).toBe(false);
	});
});

describe('isDateRangeValid', () => {
	it('accepts same day', () => {
		expect(isDateRangeValid('2025-06-01', '2025-06-01', 7)).toBe(true);
	});

	it('rejects end before start', () => {
		expect(isDateRangeValid('2025-06-10', '2025-06-01', 30)).toBe(false);
	});

	it('accepts exactly maxDays', () => {
		expect(isDateRangeValid('2025-06-01', '2025-06-08', 7)).toBe(true);
	});

	it('rejects one day over maxDays', () => {
		expect(isDateRangeValid('2025-06-01', '2025-06-09', 7)).toBe(false);
	});

	it('handles maxDays=0 same day', () => {
		expect(isDateRangeValid('2025-06-01', '2025-06-01', 0)).toBe(true);
	});

	it('rejects maxDays=0 different days', () => {
		expect(isDateRangeValid('2025-06-01', '2025-06-02', 0)).toBe(false);
	});
});
