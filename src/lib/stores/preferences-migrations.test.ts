import { describe, it, expect } from 'vitest';
import { migratePrefs, PREFS_SCHEMA_VERSION } from './preferences-migrations';

describe('preferences migrations', () => {
	it('sets schemaVersion on a v0 blob with no schemaVersion field', () => {
		const result = migratePrefs({ driveableRadius: 300, unit: 'miles' });
		expect(result.schemaVersion).toBe(PREFS_SCHEMA_VERSION);
	});

	it('does not re-run migrations on a blob already at current version', () => {
		const input = {
			schemaVersion: PREFS_SCHEMA_VERSION,
			homeAirport: 'JFK',
			homeLatitude: null,
			homeLongitude: null
		};
		const result = migratePrefs(input);
		// Already at v1, so the v0->v1 migration should NOT run.
		// homeAirport should remain untouched because the migration wasn't applied.
		expect(result.homeAirport).toBe('JFK');
		expect(result.schemaVersion).toBe(PREFS_SCHEMA_VERSION);
	});

	describe('v0 -> v1: homeAirport/coords atomicity', () => {
		it('preserves homeAirport when both coords are present', () => {
			const result = migratePrefs({
				homeAirport: 'LAX',
				homeLatitude: 33.9425,
				homeLongitude: -118.408
			});
			expect(result.homeAirport).toBe('LAX');
			expect(result.homeLatitude).toBe(33.9425);
			expect(result.homeLongitude).toBe(-118.408);
		});

		it('clears all three when homeLatitude is null', () => {
			const result = migratePrefs({
				homeAirport: 'LAX',
				homeLatitude: null,
				homeLongitude: -118.408
			});
			expect(result.homeAirport).toBeNull();
			expect(result.homeLatitude).toBeNull();
			expect(result.homeLongitude).toBeNull();
		});

		it('clears all three when homeLongitude is null', () => {
			const result = migratePrefs({
				homeAirport: 'LAX',
				homeLatitude: 33.9425,
				homeLongitude: null
			});
			expect(result.homeAirport).toBeNull();
			expect(result.homeLatitude).toBeNull();
			expect(result.homeLongitude).toBeNull();
		});

		it('clears all three when both coords are null', () => {
			const result = migratePrefs({
				homeAirport: 'LAX',
				homeLatitude: null,
				homeLongitude: null
			});
			expect(result.homeAirport).toBeNull();
			expect(result.homeLatitude).toBeNull();
			expect(result.homeLongitude).toBeNull();
		});

		it('clears all three when coords are missing entirely (undefined)', () => {
			const result = migratePrefs({ homeAirport: 'LAX' });
			expect(result.homeAirport).toBeNull();
			expect(result.homeLatitude).toBeNull();
			expect(result.homeLongitude).toBeNull();
		});

		it('leaves null homeAirport alone', () => {
			const result = migratePrefs({ homeAirport: null });
			expect(result.homeAirport).toBeNull();
		});

		it('leaves absent homeAirport alone', () => {
			const result = migratePrefs({ unit: 'km' });
			expect(result.homeAirport).toBeUndefined();
		});
	});

	it('preserves extra fields through migration', () => {
		const result = migratePrefs({
			homeAirport: null,
			customField: 'keep-me',
			nested: { a: 1 }
		});
		expect(result.customField).toBe('keep-me');
		expect(result.nested).toEqual({ a: 1 });
	});
});
