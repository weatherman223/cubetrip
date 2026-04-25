export const PREFS_SCHEMA_VERSION = 3;

const MAX_DISTANCE_KM = 20037;

type PrefsMigration = (data: Record<string, unknown>) => Record<string, unknown>;

const prefsMigrations: PrefsMigration[] = [
	// v0 -> v1: If homeAirport is set but coordinates are missing, clear all three
	// so the user re-selects (which sets all three atomically).
	(data) => {
		if (data.homeAirport != null && (data.homeLatitude == null || data.homeLongitude == null)) {
			data.homeAirport = null;
			data.homeLatitude = null;
			data.homeLongitude = null;
		}
		return data;
	},
	// v1 -> v2: Introduce maxDaysBeforeComp. Default is 3 so long-haul flights
	// (e.g. US -> Europe) have a chance to arrive before the competition starts.
	(data) => {
		if (
			typeof data.maxDaysBeforeComp !== 'number' ||
			data.maxDaysBeforeComp < 1 ||
			data.maxDaysBeforeComp > 7
		) {
			data.maxDaysBeforeComp = 3;
		}
		return data;
	},
	// v2 -> v3: Introduce maxDistanceKm and allowedCountries. Defaults preserve
	// existing behavior: max distance = no limit, no country allowlist.
	(data) => {
		if (typeof data.maxDistanceKm !== 'number' || data.maxDistanceKm <= 0) {
			data.maxDistanceKm = MAX_DISTANCE_KM;
		}
		if (!Array.isArray(data.allowedCountries)) {
			data.allowedCountries = [];
		}
		return data;
	}
];

export function migratePrefs(data: Record<string, unknown>): Record<string, unknown> {
	const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
	let result = data;
	for (let v = version; v < PREFS_SCHEMA_VERSION; v++) {
		result = prefsMigrations[v](result);
	}
	result.schemaVersion = PREFS_SCHEMA_VERSION;
	return result;
}
