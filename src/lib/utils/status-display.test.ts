import { describe, it, expect } from 'vitest';
import { getStatusHex, getStatusTailwind } from './status-display';

describe('getStatusHex', () => {
	it('maps open → BOARDING green', () => {
		expect(getStatusHex('open')).toEqual({ label: 'BOARDING', color: '#22c55e', deep: '#15803d' });
	});

	it('maps on-the-spot → STANDBY yellow', () => {
		expect(getStatusHex('on-the-spot')).toEqual({
			label: 'STANDBY',
			color: '#eab308',
			deep: '#a16207'
		});
	});

	it('maps waitlist → WAITLIST amber', () => {
		expect(getStatusHex('waitlist')).toEqual({
			label: 'WAITLIST',
			color: '#f59e0b',
			deep: '#b45309'
		});
	});

	it('maps closed → GATE CLOSED gray', () => {
		expect(getStatusHex('closed')).toEqual({
			label: 'GATE CLOSED',
			color: '#94a3b8',
			deep: '#475569'
		});
	});

	it('maps cancelled → CANCELLED red', () => {
		expect(getStatusHex('cancelled')).toEqual({
			label: 'CANCELLED',
			color: '#ef4444',
			deep: '#b91c1c'
		});
	});

	it('returns default for undefined', () => {
		expect(getStatusHex(undefined)).toEqual({
			label: 'CHECKING STATUS',
			color: '#94a3b8',
			deep: '#334155'
		});
	});

	it('returns default for empty string', () => {
		expect(getStatusHex('')).toEqual({
			label: 'CHECKING STATUS',
			color: '#94a3b8',
			deep: '#334155'
		});
	});

	it('returns default for unknown value', () => {
		expect(getStatusHex('garbage')).toEqual({
			label: 'CHECKING STATUS',
			color: '#94a3b8',
			deep: '#334155'
		});
	});

	it('every deep badge background sustains white text at WCAG AA (>=4.5:1)', () => {
		const lum = (hex: string) => {
			const c = [1, 3, 5]
				.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		};
		for (const status of [
			'open',
			'on-the-spot',
			'waitlist',
			'not-open-yet',
			'closed',
			'cancelled',
			undefined
		]) {
			const { deep } = getStatusHex(status);
			const contrast = 1.05 / (lum(deep) + 0.05);
			expect(contrast, `${status ?? 'default'} deep ${deep}`).toBeGreaterThanOrEqual(4.5);
		}
	});
});

describe('getStatusTailwind', () => {
	it('maps open → BOARDING with deep badge bg and bright dot', () => {
		const result = getStatusTailwind('open');
		expect(result.label).toBe('BOARDING');
		expect(result.color).toBe('bg-airline-open-deep');
		expect(result.dot).toBe('bg-airline-open');
	});

	it('isCancelled overrides any status', () => {
		const result = getStatusTailwind('open', true);
		expect(result.label).toBe('CANCELLED');
		expect(result.color).toBe('bg-airline-cancelled-deep');
	});

	it('returns default for undefined status', () => {
		const result = getStatusTailwind(undefined);
		expect(result.label).toBe('CHECKING STATUS');
		expect(result.color).toBe('bg-airline-slate');
		expect(result.dot).toBe('bg-airline-amber');
	});

	it('pairs every status badge with white text on a deep (darkened) background', () => {
		for (const status of [
			'open',
			'on-the-spot',
			'waitlist',
			'not-open-yet',
			'closed',
			'cancelled'
		]) {
			const result = getStatusTailwind(status);
			expect(result.text).toBe('text-white');
			expect(result.color, status).toMatch(/-deep$/);
		}
	});

	it('keeps bright (non-deep) tokens for the status dots', () => {
		expect(getStatusTailwind('open').dot).toBe('bg-airline-open');
		expect(getStatusTailwind('waitlist').dot).toBe('bg-airline-amber');
	});

	it('keeps white text on the dark slate default background', () => {
		expect(getStatusTailwind(undefined).text).toBe('text-white');
		expect(getStatusTailwind('garbage').text).toBe('text-white');
	});

	it('isCancelled=true with undefined status still returns cancelled', () => {
		const result = getStatusTailwind(undefined, true);
		expect(result.label).toBe('CANCELLED');
	});

	it('maps waitlist correctly', () => {
		expect(getStatusTailwind('waitlist').label).toBe('WAITLIST');
	});

	it('maps on-the-spot correctly', () => {
		expect(getStatusTailwind('on-the-spot').label).toBe('STANDBY');
	});

	it('maps closed correctly', () => {
		expect(getStatusTailwind('closed').label).toBe('GATE CLOSED');
	});

	it('returns default for unknown value', () => {
		expect(getStatusTailwind('garbage').label).toBe('CHECKING STATUS');
	});
});
