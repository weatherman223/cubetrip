import type { WCACompetition } from '$lib/server/wca/types';
import type { WCIFPublicData, EnrichedCompetition, EnrichedWCIF } from '$lib/server/wca/types';
import type { FlightResult } from '$lib/server/flights/types';

export function makeCompetition(overrides: Partial<WCACompetition> = {}): WCACompetition {
	return {
		id: 'TestComp2025',
		name: 'Test Competition 2025',
		short_name: 'Test 2025',
		short_display_name: 'Test 2025',
		start_date: '2025-08-15',
		end_date: '2025-08-16',
		registration_open: '2025-06-01T00:00:00.000Z',
		registration_close: '2025-08-01T00:00:00.000Z',
		announced_at: '2025-05-01T00:00:00.000Z',
		cancelled_at: null,
		results_posted_at: null,
		competitor_limit: 100,
		venue: 'Test Convention Center',
		venue_address: '123 Main St',
		venue_details: 'Room A',
		city: 'Denver',
		country_iso2: 'US',
		latitude_degrees: 39.7392,
		longitude_degrees: -104.9903,
		url: 'https://www.worldcubeassociation.org/competitions/TestComp2025',
		website: 'https://example.com',
		event_ids: ['333', '222', '444'],
		date_range: 'Aug 15 - 16, 2025',
		time_until_registration: '',
		delegates: [],
		organizers: [],
		class: 'competition',
		...overrides
	};
}

export function makeWCIF(overrides: Partial<WCIFPublicData> = {}): WCIFPublicData {
	return {
		id: 'TestComp2025',
		name: 'Test Competition 2025',
		competitorLimit: 100,
		competitorCount: 50,
		registrationInfo: {
			openTime: '2025-06-01T00:00:00.000Z',
			closeTime: '2025-08-01T00:00:00.000Z',
			baseEntryFee: 2000,
			currencyCode: 'USD',
			onTheSpotRegistration: false,
			useWcaRegistration: true
		},
		schedule: {
			startDate: '2025-08-15',
			numberOfDays: 2,
			venues: []
		},
		...overrides
	};
}

export function makeFlightResult(overrides: Partial<FlightResult> = {}): FlightResult {
	return {
		price: 199,
		currency: 'USD',
		airline: 'United Airlines',
		departureTime: '2025-08-14T08:00:00',
		arrivalTime: '2025-08-14T11:30:00',
		duration: 210,
		stops: 0,
		origin: 'DEN',
		destination: 'LAX',
		...overrides
	};
}

export function makeEnrichedCompetition(
	overrides: Partial<WCACompetition> & { wcif?: EnrichedWCIF | null } = {}
): EnrichedCompetition {
	const { wcif = null, ...compOverrides } = overrides;
	return {
		...makeCompetition(compOverrides),
		wcif
	};
}

export function makeEvent(
	path: string,
	searchParams: Record<string, string> = {},
	params: Record<string, string> = {}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
	const url = new URL(`http://localhost${path}`);
	for (const [k, v] of Object.entries(searchParams)) {
		url.searchParams.set(k, v);
	}
	return { url, params };
}
