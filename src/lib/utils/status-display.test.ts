import { describe, it, expect } from 'vitest';
import { getStatusHex, getStatusTailwind } from './status-display';

describe('getStatusHex', () => {
	it('maps open → BOARDING green', () => {
		expect(getStatusHex('open')).toEqual({ label: 'BOARDING', color: '#22c55e' });
	});

	it('maps on-the-spot → STANDBY yellow', () => {
		expect(getStatusHex('on-the-spot')).toEqual({ label: 'STANDBY', color: '#eab308' });
	});

	it('maps waitlist → WAITLIST amber', () => {
		expect(getStatusHex('waitlist')).toEqual({ label: 'WAITLIST', color: '#f59e0b' });
	});

	it('maps closed → GATE CLOSED gray', () => {
		expect(getStatusHex('closed')).toEqual({ label: 'GATE CLOSED', color: '#94a3b8' });
	});

	it('maps cancelled → CANCELLED red', () => {
		expect(getStatusHex('cancelled')).toEqual({ label: 'CANCELLED', color: '#ef4444' });
	});

	it('returns default for undefined', () => {
		expect(getStatusHex(undefined)).toEqual({ label: 'CHECKING STATUS', color: '#94a3b8' });
	});

	it('returns default for empty string', () => {
		expect(getStatusHex('')).toEqual({ label: 'CHECKING STATUS', color: '#94a3b8' });
	});

	it('returns default for unknown value', () => {
		expect(getStatusHex('garbage')).toEqual({ label: 'CHECKING STATUS', color: '#94a3b8' });
	});
});

describe('getStatusTailwind', () => {
	it('maps open → BOARDING with airline-open classes', () => {
		const result = getStatusTailwind('open');
		expect(result.label).toBe('BOARDING');
		expect(result.color).toBe('bg-airline-open');
	});

	it('isCancelled overrides any status', () => {
		const result = getStatusTailwind('open', true);
		expect(result.label).toBe('CANCELLED');
		expect(result.color).toBe('bg-airline-cancelled');
	});

	it('returns default for undefined status', () => {
		const result = getStatusTailwind(undefined);
		expect(result.label).toBe('CHECKING STATUS');
		expect(result.color).toBe('bg-airline-slate');
		expect(result.dot).toBe('bg-airline-amber');
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
