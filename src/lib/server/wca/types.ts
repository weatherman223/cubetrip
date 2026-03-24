/**
 * TypeScript interfaces matching the WCA API v0 response shapes.
 * Source: https://www.worldcubeassociation.org/api/v0
 */

/** Delegate or organizer attached to a competition. */
export interface WCAPerson {
	id: number;
	name: string;
	wca_id: string | null;
	country_iso2: string;
	delegate_status: string | null;
	url: string;
}

/** Competition object returned by /api/v0/competitions. */
export interface WCACompetition {
	id: string;
	name: string;
	short_name: string;
	short_display_name: string;
	start_date: string;
	end_date: string;
	registration_open: string;
	registration_close: string;
	announced_at: string;
	cancelled_at: string | null;
	results_posted_at: string | null;
	competitor_limit: number;
	venue: string;
	venue_address: string;
	venue_details: string;
	city: string;
	country_iso2: string;
	latitude_degrees: number;
	longitude_degrees: number;
	url: string;
	website: string;
	event_ids: string[];
	date_range: string;
	time_until_registration: string;
	delegates: WCAPerson[];
	organizers: WCAPerson[];
	class: 'competition';
}

// ── WCIF Public Data Types ──────────────────────────────────────────

export interface WCIFRegistrationInfo {
	openTime: string;
	closeTime: string;
	baseEntryFee: number;
	currencyCode: string;
	onTheSpotRegistration: boolean;
	useWcaRegistration: boolean;
}

export interface WCIFActivity {
	id: number;
	name: string;
	activityCode: string;
	startTime: string;
	endTime: string;
	childActivities: WCIFActivity[];
}

export interface WCIFRoom {
	id: number;
	name: string;
	activities: WCIFActivity[];
}

export interface WCIFVenue {
	id: number;
	name: string;
	latitudeMicrodegrees: number;
	longitudeMicrodegrees: number;
	countryIso2: string;
	timezone: string;
	rooms: WCIFRoom[];
}

export interface WCIFSchedule {
	startDate: string;
	numberOfDays: number;
	venues: WCIFVenue[];
}

/** Trimmed WCIF public data — only the fields CubeTrip needs. */
export interface WCIFPublicData {
	id: string;
	name: string;
	competitorLimit: number | null;
	competitorCount: number;
	registrationInfo: WCIFRegistrationInfo;
	schedule: WCIFSchedule;
}

// ── Enriched Competition (WCA + WCIF merged) ───────────────────────

export type RegistrationStatus = 'open' | 'waitlist' | 'on-the-spot' | 'closed';

export interface EnrichedWCIF {
	onTheSpotRegistration: boolean;
	competitorLimit: number | null;
	competitorCount: number;
	registrationStatus: RegistrationStatus;
	scheduleStartTime: string | null;
	scheduleEndTime: string | null;
}

/** WCA competition enriched with WCIF data. wcif is null if WCIF fetch failed. */
export interface EnrichedCompetition extends WCACompetition {
	wcif: EnrichedWCIF | null;
}
