import type { EnrichedCompetition } from '$lib/server/wca/types';
import { MAX_DISTANCE_KM } from '$lib/stores/preferences.svelte';

const KM_PER_MILE = 1.60934;

export interface LocationFilterPrefs {
	maxDistanceKm: number;
	allowedCountries: string[];
	homeLatitude: number | null;
	unit: 'miles' | 'km';
}

/**
 * Apply the "permanent exclude" filters (country allowlist, max distance) that
 * sit before the toggleable show-closed and event filters. Distances are in the
 * user's display unit; we convert maxDistanceKm into that unit for comparison.
 *
 * Distance filter is bypassed when the user has no home airport set (no distances
 * to compare against) or when maxDistanceKm is at MAX_DISTANCE_KM ("no limit").
 */
export function applyLocationFilters(
	comps: readonly EnrichedCompetition[],
	distances: ReadonlyMap<string, number>,
	prefs: LocationFilterPrefs
): EnrichedCompetition[] {
	let result: readonly EnrichedCompetition[] = comps;

	if (prefs.allowedCountries.length > 0) {
		const allowed = new Set(prefs.allowedCountries);
		result = result.filter((c) => allowed.has(c.country_iso2));
	}

	if (prefs.homeLatitude !== null && prefs.maxDistanceKm < MAX_DISTANCE_KM) {
		const limit = prefs.unit === 'km' ? prefs.maxDistanceKm : prefs.maxDistanceKm / KM_PER_MILE;
		result = result.filter((c) => {
			const d = distances.get(c.id);
			return d === undefined || d <= limit;
		});
	}

	return result as EnrichedCompetition[];
}
