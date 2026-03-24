import { browser } from '$app/environment';

const STORAGE_KEY = 'cubetrip-preferences';

export type DistanceUnit = 'miles' | 'km';

export interface UserPreferences {
	homeAirport: string | null;
	homeLatitude: number | null;
	homeLongitude: number | null;
	driveableRadius: number;
	unit: DistanceUnit;
	defaultEvents: string[];
	allowPartialDefault: boolean;
}

const defaults: UserPreferences = {
	homeAirport: null,
	homeLatitude: null,
	homeLongitude: null,
	driveableRadius: 300,
	unit: 'miles',
	defaultEvents: [],
	allowPartialDefault: false
};

function load(): UserPreferences {
	if (!browser) return { ...defaults };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...defaults };
		return { ...defaults, ...JSON.parse(raw) };
	} catch {
		return { ...defaults };
	}
}

function save(prefs: UserPreferences): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
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
