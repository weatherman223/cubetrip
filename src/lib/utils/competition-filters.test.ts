import { describe, it, expect } from 'vitest';
import { applyLocationFilters } from './competition-filters';
import type { EnrichedCompetition } from '$lib/server/wca/types';
import { MAX_DISTANCE_KM } from '$lib/stores/preferences.svelte';

function comp(id: string, country_iso2: string): EnrichedCompetition {
	return {
		id,
		country_iso2
		// Minimal stub — applyLocationFilters only reads id + country_iso2
	} as unknown as EnrichedCompetition;
}

const us = comp('us-comp', 'US');
const ca = comp('ca-comp', 'CA');
const jp = comp('jp-comp', 'JP');
const de = comp('de-comp', 'DE');

const allComps = [us, ca, jp, de];

const distances = new Map<string, number>([
	['us-comp', 100], // close
	['ca-comp', 500], // medium
	['jp-comp', 7000], // far
	['de-comp', 4500] // medium-far
]);

describe('applyLocationFilters', () => {
	const basePrefs = {
		maxDistanceKm: MAX_DISTANCE_KM,
		allowedCountries: [] as string[],
		homeLatitude: 40.0,
		unit: 'miles' as const
	};

	it('returns everything when no filters are active', () => {
		const result = applyLocationFilters(allComps, distances, basePrefs);
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp', 'jp-comp', 'de-comp']);
	});

	it('filters by allowed countries when allowlist is non-empty', () => {
		const result = applyLocationFilters(allComps, distances, {
			...basePrefs,
			allowedCountries: ['US', 'CA']
		});
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp']);
	});

	it('treats max distance at MAX_DISTANCE_KM as no-op (no limit)', () => {
		const result = applyLocationFilters(allComps, distances, {
			...basePrefs,
			maxDistanceKm: MAX_DISTANCE_KM
		});
		expect(result.length).toBe(4);
	});

	it('excludes comps farther than max distance (miles unit)', () => {
		// distances Map stores miles since unit='miles'. 1000 mi limit → keeps us(100) + ca(500), drops jp/de.
		const result = applyLocationFilters(allComps, distances, {
			...basePrefs,
			maxDistanceKm: 1000 * 1.60934 // 1000 miles in km
		});
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp']);
	});

	it('excludes comps farther than max distance (km unit)', () => {
		const kmDistances = new Map([
			['us-comp', 200],
			['ca-comp', 800],
			['jp-comp', 11000],
			['de-comp', 7000]
		]);
		const result = applyLocationFilters(allComps, kmDistances, {
			...basePrefs,
			unit: 'km',
			maxDistanceKm: 1500
		});
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp']);
	});

	it('keeps comps with no distance entry (not yet computed) under the limit', () => {
		const partial = new Map([['us-comp', 100]]); // others missing
		const result = applyLocationFilters(allComps, partial, {
			...basePrefs,
			maxDistanceKm: 1000 * 1.60934
		});
		// Comps without a distance entry pass through (haven't been geo-tagged yet)
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp', 'jp-comp', 'de-comp']);
	});

	it('bypasses the distance filter entirely when no home airport is set', () => {
		// homeLatitude null → distance filter cannot apply, even if a limit is set
		const result = applyLocationFilters(allComps, distances, {
			...basePrefs,
			homeLatitude: null,
			maxDistanceKm: 100 // would normally exclude all
		});
		expect(result.length).toBe(4);
	});

	it('applies country and distance filters together', () => {
		const result = applyLocationFilters(allComps, distances, {
			...basePrefs,
			allowedCountries: ['US', 'CA', 'JP'],
			maxDistanceKm: 1000 * 1.60934
		});
		// JP allowed but too far → only US + CA survive
		expect(result.map((c) => c.id)).toEqual(['us-comp', 'ca-comp']);
	});
});
