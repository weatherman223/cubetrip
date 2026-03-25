import { describe, it, expect } from 'vitest';
import { haversine, haversineMiles } from './distance';

describe('haversine', () => {
	it('returns 0 for the same point', () => {
		expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
	});

	it('calculates NYC (JFK) to LAX correctly (~3983 km)', () => {
		const dist = haversine(40.6413, -73.7781, 33.9425, -118.4081);
		expect(dist).toBeGreaterThan(3960);
		expect(dist).toBeLessThan(4010);
	});

	it('calculates antipodal points (~20015 km)', () => {
		const dist = haversine(0, 0, 0, 180);
		expect(dist).toBeGreaterThan(20000);
		expect(dist).toBeLessThan(20030);
	});

	it('calculates north pole to south pole (~20015 km)', () => {
		const dist = haversine(90, 0, -90, 0);
		expect(dist).toBeGreaterThan(20000);
		expect(dist).toBeLessThan(20030);
	});

	it('calculates a short distance (~1 km)', () => {
		// ~1 km north in London
		const dist = haversine(51.5074, -0.1278, 51.5164, -0.1278);
		expect(dist).toBeGreaterThan(0.9);
		expect(dist).toBeLessThan(1.1);
	});

	it('handles crossing the date line', () => {
		// 2 degrees apart at the equator across the 180th meridian
		const dist = haversine(0, 179, 0, -179);
		expect(dist).toBeGreaterThan(200);
		expect(dist).toBeLessThan(230);
	});
});

describe('haversineMiles', () => {
	it('returns 0 for the same point', () => {
		expect(haversineMiles(0, 0, 0, 0)).toBe(0);
	});

	it('calculates NYC to LAX in miles (~2475)', () => {
		const dist = haversineMiles(40.6413, -73.7781, 33.9425, -118.4081);
		expect(dist).toBeGreaterThan(2460);
		expect(dist).toBeLessThan(2500);
	});
});
