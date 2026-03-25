import type { FlightResult } from './types';

// Hoisted regex constants for combineDateAndTime
const TIME_12H_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const TIME_24H_RE = /(\d{1,2}):(\d{2})/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse Google Flights HTML response to extract flight data.
 * Returns empty array on any parsing failure (graceful degradation).
 */
export function parseFlightResponse(html: string): FlightResult[] {
	try {
		const payload = extractPayload(html);
		if (!payload) return [];

		const airlineMap = buildAirlineMap(payload);
		return extractFlights(payload, airlineMap);
	} catch (err) {
		console.warn('Flight response parsing failed:', err);
		return [];
	}
}

/**
 * Extract the nested data payload from the HTML script tag.
 */
function extractPayload(html: string): unknown[] | null {
	// Extract the script tag with class="ds:1" containing flight data
	const scriptMatch = html.match(/<script[^>]+class="ds:1"[^>]*>([\s\S]*?)<\/script>/);
	if (!scriptMatch) {
		console.warn('Could not find script.ds:1 tag');
		return null;
	}

	const scriptText = scriptMatch[1];
	if (!scriptText) return null;

	// The script content contains something like: ... data:[ ... ], ...
	// We need to extract the data array
	const dataIdx = scriptText.indexOf('data:');
	if (dataIdx === -1) {
		console.warn('Could not find "data:" in script content');
		return null;
	}

	const afterData = scriptText.substring(dataIdx + 5);

	// Find the matching end — the data value is followed by ", sideChannel:"
	// We need to parse the JSON array that starts after "data:"
	// Use a bracket counter to find the matching closing bracket
	let depth = 0;
	let start = -1;
	let end = -1;

	for (let i = 0; i < afterData.length; i++) {
		const ch = afterData[i];
		if (ch === '[' || ch === '{') {
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
		console.warn('Could not bracket-match the data payload');
		return null;
	}

	const jsonStr = afterData.substring(start, end);

	try {
		return JSON.parse(jsonStr) as unknown[];
	} catch {
		console.warn('Failed to parse data payload JSON');
		return null;
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any;

/**
 * Build a map of airline code → airline name from the payload metadata.
 *
 * Google Flights payload structure (reverse-engineered from fast-flights Python source):
 *   payload[3][0]       — flight results list
 *   payload[7][1][1]    — airline metadata array [[code, name], ...]
 *   k[1][0][1]          — price (integer, USD)
 *   k[0][1]             — airline IATA codes array
 *   k[0][2]             — flight segments array
 *   firstSeg[3]         — origin airport IATA
 *   lastSeg[6]          — destination airport IATA
 *   firstSeg[8]         — departure time string
 *   firstSeg[20]        — departure date string
 *   lastSeg[10]         — arrival time string
 *   lastSeg[21]         — arrival date string
 *   seg[11]             — segment duration in minutes
 */
function buildAirlineMap(payload: Payload): Map<string, string> {
	const map = new Map<string, string>();
	try {
		const airlines = payload[7]?.[1]?.[1]; // airline metadata map
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

	try {
		const flightList = payload[3]?.[0]; // flight results list
		if (!Array.isArray(flightList)) return [];

		for (const k of flightList) {
			try {
				const flight = parseOneFlight(k, airlineMap);
				if (flight) flights.push(flight);
			} catch {
				// Skip individual flights that fail to parse
			}
		}
	} catch {
		// Flight list not available
	}

	return flights;
}

/**
 * Parse a single flight entry from the payload.
 */
function parseOneFlight(k: Payload, airlineMap: Map<string, string>): FlightResult | null {
	const price = k[1]?.[0]?.[1]; // price in USD
	if (typeof price !== 'number' || price <= 0) return null;

	const airlineCodes: string[] = k[0]?.[1] ?? []; // airline IATA codes
	const airlineName =
		airlineCodes
			.map((code: string) => airlineMap.get(code) ?? code)
			.filter(Boolean)
			.join(', ') || 'Unknown Airline';

	const segments = k[0]?.[2]; // flight segments
	if (!Array.isArray(segments) || segments.length === 0) return null;

	const firstSeg = segments[0];
	const lastSeg = segments[segments.length - 1];

	const origin = String(firstSeg[3] ?? ''); // origin IATA
	const destination = String(lastSeg[6] ?? ''); // destination IATA
	if (!origin || !destination) return null;

	const departTime = String(firstSeg[8] ?? ''); // departure time
	const departDate = String(firstSeg[20] ?? ''); // departure date
	const arrivalTime = String(lastSeg[10] ?? ''); // arrival time
	const arrivalDate = String(lastSeg[21] ?? ''); // arrival date

	let totalDuration = 0;
	for (const seg of segments) {
		const dur = seg[11]; // segment duration in minutes
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

	// Otherwise try to parse the date string
	const parsed = new Date(`${date} ${time}`);
	if (!isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}

	return '';
}
