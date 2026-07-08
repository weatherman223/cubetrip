import type { FlightResult } from './types';

// Hoisted regex constants for combineDateAndTime
const TIME_12H_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const TIME_24H_RE = /(\d{1,2}):(\d{2})/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export type FlightParseFailureReason =
	| 'no-ds1-tag'
	| 'no-data-key'
	| 'bracket-mismatch'
	| 'json-parse-failed'
	| 'unrecognized-structure';

/**
 * Extraction/structure failure while parsing a Google Flights page. Thrown
 * (never swallowed) so callers can tell "the scrape failed" apart from "the
 * route genuinely has no flights" — a consent page, CAPTCHA interstitial, or
 * payload-format change must surface as a transient failure (failKey/503),
 * not get cached as sticky no-inventory.
 */
export class FlightParseError extends Error {
	constructor(
		public readonly reason: FlightParseFailureReason,
		message: string
	) {
		super(message);
		this.name = 'FlightParseError';
	}
}

/**
 * Parse Google Flights HTML response to extract flight data.
 * Returns [] only for a successfully parsed payload containing no itineraries;
 * throws FlightParseError when the payload can't be extracted or recognized.
 */
export function parseFlightResponse(html: string): FlightResult[] {
	try {
		const payload = extractPayload(html);
		const airlineMap = buildAirlineMap(payload);
		return extractFlights(payload, airlineMap);
	} catch (err) {
		if (err instanceof FlightParseError) throw err;
		throw new FlightParseError(
			'unrecognized-structure',
			`unexpected parse failure: ${err instanceof Error ? err.message : String(err)}`
		);
	}
}

/**
 * Extract the nested data payload from the HTML script tag.
 * Throws FlightParseError when the page doesn't look like a flight-results
 * payload (missing ds:1 tag, missing data key, malformed JSON).
 */
function extractPayload(html: string): unknown[] {
	// Extract the script tag with class="ds:1" containing flight data
	const scriptMatch = html.match(/<script[^>]+class="ds:1"[^>]*>([\s\S]*?)<\/script>/);
	if (!scriptMatch || !scriptMatch[1]) {
		throw new FlightParseError(
			'no-ds1-tag',
			'could not find script.ds:1 tag — consent page, CAPTCHA, or layout change'
		);
	}

	const scriptText = scriptMatch[1];

	// The script content contains something like: ... data:[ ... ], ...
	// We need to extract the data array
	const dataIdx = scriptText.indexOf('data:');
	if (dataIdx === -1) {
		throw new FlightParseError('no-data-key', 'could not find "data:" in script content');
	}

	const afterData = scriptText.substring(dataIdx + 5);

	// Find the matching end — the data value is followed by ", sideChannel:"
	// We need to parse the JSON array that starts after "data:"
	// Use a bracket counter to find the matching closing bracket, tracking
	// string state so brackets inside string values (airline notices, fare
	// rules — e.g. "Terminal ]A") don't corrupt the depth count.
	let depth = 0;
	let start = -1;
	let end = -1;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < afterData.length; i++) {
		const ch = afterData[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
		} else if (ch === '[' || ch === '{') {
			if (start === -1) start = i;
			depth++;
		} else if (ch === ']' || ch === '}') {
			depth--;
			if (depth === 0 && start !== -1) {
				end = i + 1;
				break;
			}
		}
	}

	if (start === -1 || end === -1) {
		throw new FlightParseError('bracket-mismatch', 'could not bracket-match the data payload');
	}

	const jsonStr = afterData.substring(start, end);

	try {
		return JSON.parse(jsonStr) as unknown[];
	} catch {
		throw new FlightParseError('json-parse-failed', 'failed to parse data payload JSON');
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any;

/**
 * Build a map of airline code → airline name from the payload metadata.
 *
 * Google Flights payload structure — reverse-engineered from the fast-flights Python project:
 *   https://github.com/AWeirdDev/flights
 *
 * These indices mirror Google's internal response format and may break without warning
 * if Google changes their payload structure. The named constants below (IDX_*) map each
 * raw index to its semantic meaning so readers don't have to guess.
 */

// --- Payload-level paths ---
// Google returns flights in two lists: "Top departing flights" (best) and "Other departing flights".
// Parse both or we miss the top-ranked (often cheapest) results.
const IDX_BEST_FLIGHT_LIST = [2, 0] as const; // payload → "Top departing flights" array
const IDX_OTHER_FLIGHT_LIST = [3, 0] as const; // payload → "Other departing flights" array
const IDX_AIRLINE_META = [7, 1, 1] as const; // payload → [[code, name], ...]

// --- Per-flight (k) paths ---
const IDX_PRICE = [1, 0, 1] as const; // k → price (integer, USD)
const IDX_AIRLINE_CODES = [0, 1] as const; // k → airline IATA code array
const IDX_SEGMENTS = [0, 2] as const; // k → flight segments array

// --- Per-segment indices ---
const SEG_ORIGIN = 3; // segment → origin airport IATA
const SEG_DESTINATION = 6; // segment → destination airport IATA
const SEG_DEPART_TIME = 8; // segment → departure time string
const SEG_ARRIVAL_TIME = 10; // segment → arrival time string
const SEG_DURATION = 11; // segment → duration in minutes
const SEG_DEPART_DATE = 20; // segment → departure date string
const SEG_ARRIVAL_DATE = 21; // segment → arrival date string
function buildAirlineMap(payload: Payload): Map<string, string> {
	const map = new Map<string, string>();
	try {
		const airlines = payload[IDX_AIRLINE_META[0]]?.[IDX_AIRLINE_META[1]]?.[IDX_AIRLINE_META[2]];
		if (Array.isArray(airlines)) {
			for (const entry of airlines) {
				if (Array.isArray(entry) && entry.length >= 2) {
					map.set(String(entry[0]), String(entry[1]));
				}
			}
		}
	} catch {
		// Airline metadata not available — we'll use codes as fallback
	}
	return map;
}

/**
 * Extract individual flights from the payload.
 */
function extractFlights(payload: Payload, airlineMap: Map<string, string>): FlightResult[] {
	const flights: FlightResult[] = [];
	const seen = new Set<string>();

	const bestSlot = payload[IDX_BEST_FLIGHT_LIST[0]];
	const otherSlot = payload[IDX_OTHER_FLIGHT_LIST[0]];
	const best = bestSlot?.[IDX_BEST_FLIGHT_LIST[1]];
	const other = otherSlot?.[IDX_OTHER_FLIGHT_LIST[1]];

	if (!Array.isArray(best) && !Array.isArray(other)) {
		// Genuine zero-results encoding: routes with no airline service at all
		// (seaplane bases, GA-only strips — e.g. DEN→BED, DEN→CXH, observed
		// live 2026-07) return a full, valid payload whose two list slots are
		// both EXPLICITLY null while the surrounding metadata is intact. That
		// is "no flights", not a format change — return [] so the route caches
		// it as sticky no-inventory and the client skips the destination.
		if (bestSlot === null && otherSlot === null) return [];

		// Anything else in the list slots (objects, strings, truncated arrays)
		// is a payload shape we don't recognize — a Google format change. Fail
		// loud so the route caches it as a transient failure (5-min failKey /
		// 503) instead of silently reporting zero flights everywhere.
		throw new FlightParseError(
			'unrecognized-structure',
			'flight-list slots are neither arrays nor the null zero-results encoding — payload format may have changed'
		);
	}

	const parseList = (list: unknown) => {
		if (!Array.isArray(list)) return;
		for (const k of list) {
			try {
				const flight = parseOneFlight(k, airlineMap);
				if (!flight) continue;
				// Dedup in case the same itinerary appears in both Best and Other lists
				const key = `${flight.price}|${flight.airline}|${flight.departureTime}|${flight.arrivalTime}|${flight.origin}|${flight.destination}`;
				if (seen.has(key)) continue;
				seen.add(key);
				flights.push(flight);
			} catch {
				// Skip individual flights that fail to parse
			}
		}
	};

	parseList(best);
	parseList(other);

	return flights;
}

/**
 * Parse a single flight entry from the payload.
 */
function parseOneFlight(k: Payload, airlineMap: Map<string, string>): FlightResult | null {
	const price = k[IDX_PRICE[0]]?.[IDX_PRICE[1]]?.[IDX_PRICE[2]];
	if (typeof price !== 'number' || price <= 0) return null;

	const airlineCodes: string[] = k[IDX_AIRLINE_CODES[0]]?.[IDX_AIRLINE_CODES[1]] ?? [];
	const airlineName =
		airlineCodes
			.map((code: string) => airlineMap.get(code) ?? code)
			.filter(Boolean)
			.join(', ') || 'Unknown Airline';

	const segments = k[IDX_SEGMENTS[0]]?.[IDX_SEGMENTS[1]];
	if (!Array.isArray(segments) || segments.length === 0) return null;

	const firstSeg = segments[0];
	const lastSeg = segments[segments.length - 1];

	const origin = String(firstSeg[SEG_ORIGIN] ?? '');
	const destination = String(lastSeg[SEG_DESTINATION] ?? '');
	if (!origin || !destination) return null;

	const departTime = normalizeTime(firstSeg[SEG_DEPART_TIME]);
	const departDate = normalizeDate(firstSeg[SEG_DEPART_DATE]);
	const arrivalTime = normalizeTime(lastSeg[SEG_ARRIVAL_TIME]);
	const arrivalDate = normalizeDate(lastSeg[SEG_ARRIVAL_DATE]);

	let totalDuration = 0;
	for (const seg of segments) {
		const dur = seg[SEG_DURATION];
		if (typeof dur === 'number') {
			totalDuration += dur;
		}
	}

	return {
		price,
		currency: 'USD',
		airline: airlineName,
		departureTime: combineDateAndTime(departDate, departTime),
		arrivalTime: combineDateAndTime(arrivalDate, arrivalTime),
		duration: totalDuration,
		stops: segments.length - 1,
		origin,
		destination
	};
}

/**
 * Normalize Google's per-segment date into "YYYY-MM-DD".
 * Observed shapes: `[year, month, day]` for multi-stop itineraries,
 * occasionally a pre-formatted string for simple ones.
 */
export function normalizeDate(raw: unknown): string {
	if (Array.isArray(raw) && raw.length >= 3) {
		const [y, m, d] = raw;
		if (typeof y === 'number' && typeof m === 'number' && typeof d === 'number') {
			return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		}
	}
	return typeof raw === 'string' ? raw : '';
}

/**
 * Normalize Google's per-segment time into "HH:MM".
 * Observed shapes: `[hour, minute]`, `[hour]` when minutes are 0, and
 * `[null, minute]` / `[null]` for the midnight hour — Google encodes hour 0
 * as null (observed on live red-eye flights, e.g. a 00:11 arrival as [null, 11]).
 */
export function normalizeTime(raw: unknown): string {
	if (Array.isArray(raw) && raw.length >= 1) {
		const h = raw[0] == null ? 0 : raw[0];
		const m = typeof raw[1] === 'number' ? raw[1] : 0;
		if (typeof h === 'number') {
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		}
	}
	return typeof raw === 'string' ? raw : '';
}

/**
 * Combine a date string and time string into an ISO 8601 datetime.
 * Date formats from Google: "YYYY-MM-DD" or "Mon, Jan 1"
 * Time formats: "1:30 PM" or "13:30"
 */
export function combineDateAndTime(date: string, time: string): string {
	if (!date || !time) return '';

	// Try to parse the time
	let hours = 0;
	let minutes = 0;

	const time12 = time.match(TIME_12H_RE);
	if (time12) {
		hours = parseInt(time12[1], 10);
		minutes = parseInt(time12[2], 10);
		const period = time12[3].toUpperCase();
		if (period === 'PM' && hours !== 12) hours += 12;
		if (period === 'AM' && hours === 12) hours = 0;
	} else {
		const time24 = time.match(TIME_24H_RE);
		if (time24) {
			hours = parseInt(time24[1], 10);
			minutes = parseInt(time24[2], 10);
		}
	}

	// If date is already YYYY-MM-DD format
	if (DATE_ISO_RE.test(date)) {
		return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
	}

	// Otherwise try to parse the date string. Reject year-less dates outright
	// ("Mon, Jan 1") — JS would default them to 2001 and produce silently-wrong
	// timestamps; better to return '' and let the duration-based fallback in
	// isFlightLate estimate the arrival day.
	if (!/\d{4}/.test(date)) return '';
	const parsed = new Date(`${date} ${time}`);
	if (!isNaN(parsed.getTime())) {
		// Serialize with local getters to match the ISO branch's naive local
		// format — toISOString() would shift into UTC and mix two different
		// formats (and timezone semantics) in downstream comparisons.
		const y = parsed.getFullYear();
		const mo = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		const hh = String(parsed.getHours()).padStart(2, '0');
		const mm = String(parsed.getMinutes()).padStart(2, '0');
		return `${y}-${mo}-${d}T${hh}:${mm}:00`;
	}

	return '';
}
