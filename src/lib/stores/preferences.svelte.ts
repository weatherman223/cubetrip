import { browser } from '$app/environment';
import { migratePrefs, PREFS_SCHEMA_VERSION } from './preferences-migrations';
import type { Airport } from '$lib/types';

const STORAGE_KEY = 'cubetrip-preferences';

export type DistanceUnit = 'miles' | 'km';

export interface UserPreferences {
	/** Home airport IATA code. Set atomically with homeLatitude/homeLongitude via airport selection. */
	homeAirport: string | null;
	/** Home airport latitude. Always set/cleared together with homeAirport. */
	homeLatitude: number | null;
	/** Home airport longitude. Always set/cleared together with homeAirport. */
	homeLongitude: number | null;
	/**
	 * Extra origins the user wants included in flight search alongside the primary home.
	 * Typical use case is multi-airport metros (NYC: JFK + LGA + EWR). The primary home
	 * still drives distance/map/drive-radius; these only participate in flight search.
	 */
	additionalHomeAirports: Airport[];
	driveableRadius: number;
	unit: DistanceUnit;
	defaultEvents: string[];
	allowPartialDefault: boolean;
	/** Maximum days before comp start that the user is willing to depart, 1–7. */
	maxDaysBeforeComp: number;
	/**
	 * Skip flight search for competitions whose registration is closed. Since a
	 * user can't register, the prices are decorative; skipping them keeps the
	 * request queue focused on actionable comps. Default on.
	 */
	skipClosedFlights: boolean;
	/**
	 * Maximum travel distance in km. Stored in km regardless of `unit` so toggling
	 * between miles/km doesn't silently shift the filter. The cap MAX_DISTANCE_KM
	 * (~half the equator) is treated as "no limit" — comps further than that
	 * physically don't exist on Earth.
	 */
	maxDistanceKm: number;
	/**
	 * Allowlist of country ISO 3166-1 alpha-2 codes. Empty array means no filter
	 * (show all countries). Non-empty means only competitions in these countries
	 * are shown.
	 */
	allowedCountries: string[];
}

/** Half the equator in km — used as the "no limit" sentinel for maxDistanceKm. */
export const MAX_DISTANCE_KM = 20037;

const defaults: UserPreferences = {
	homeAirport: null,
	homeLatitude: null,
	homeLongitude: null,
	additionalHomeAirports: [],
	driveableRadius: 300,
	unit: 'miles',
	defaultEvents: [],
	allowPartialDefault: false,
	maxDaysBeforeComp: 3,
	skipClosedFlights: true,
	maxDistanceKm: MAX_DISTANCE_KM,
	allowedCountries: []
};

function load(): UserPreferences {
	if (!browser) return { ...defaults };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...defaults };
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const migrated = migratePrefs(parsed);
		const prefs = { ...defaults, ...migrated } as UserPreferences;
		// Persist migrated data so migrations only run once
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ ...prefs, schemaVersion: PREFS_SCHEMA_VERSION })
		);
		return prefs;
	} catch {
		return { ...defaults };
	}
}

function save(prefs: UserPreferences): void {
	if (!browser) return;
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({ ...prefs, schemaVersion: PREFS_SCHEMA_VERSION })
	);
}

function createPreferencesStore() {
	let state = $state<UserPreferences>(load());

	return {
		get current() {
			return state;
		},
		update(partial: Partial<UserPreferences>) {
			state = { ...state, ...partial };
			save(state);
		},
		reset() {
			state = { ...defaults };
			save(state);
		}
	};
}

export const preferences = createPreferencesStore();
