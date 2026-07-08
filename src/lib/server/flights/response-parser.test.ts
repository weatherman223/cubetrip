import { describe, it, expect } from 'vitest';
import {
	parseFlightResponse,
	combineDateAndTime,
	normalizeDate,
	normalizeTime,
	FlightParseError
} from './response-parser';

describe('normalizeDate', () => {
	it('converts Google`s array form [year, month, day] to YYYY-MM-DD', () => {
		expect(normalizeDate([2026, 4, 25])).toBe('2026-04-25');
	});

	it('pads single-digit month and day', () => {
		expect(normalizeDate([2026, 1, 5])).toBe('2026-01-05');
	});

	it('passes through string form untouched (older payload shape)', () => {
		expect(normalizeDate('2026-04-25')).toBe('2026-04-25');
	});

	it('returns empty for null/undefined/malformed arrays', () => {
		expect(normalizeDate(null)).toBe('');
		expect(normalizeDate(undefined)).toBe('');
		expect(normalizeDate([2026])).toBe('');
		expect(normalizeDate(['2026', '4', '25'])).toBe('');
	});
});

describe('normalizeTime', () => {
	it('converts [hour, minute] array to HH:MM', () => {
		expect(normalizeTime([17, 40])).toBe('17:40');
	});

	it('pads single-digit hour and minute', () => {
		expect(normalizeTime([7, 5])).toBe('07:05');
	});

	it('treats missing minute as :00 (observed for exact-hour departures)', () => {
		expect(normalizeTime([16])).toBe('16:00');
	});

	it('passes through string form untouched', () => {
		expect(normalizeTime('9:35 AM')).toBe('9:35 AM');
	});

	it('returns empty for null/undefined/malformed arrays', () => {
		expect(normalizeTime(null)).toBe('');
		expect(normalizeTime([])).toBe('');
		expect(normalizeTime(['17', '40'])).toBe('');
	});

	it('treats null hour as midnight — Google encodes hour 0 as null ([null, 11] = 00:11)', () => {
		expect(normalizeTime([null, 11])).toBe('00:11');
	});

	it('treats [null] as exactly midnight', () => {
		expect(normalizeTime([null])).toBe('00:00');
	});
});

describe('combineDateAndTime', () => {
	it('returns empty for empty date', () => {
		expect(combineDateAndTime('', '1:30 PM')).toBe('');
	});

	it('returns empty for empty time', () => {
		expect(combineDateAndTime('2025-06-01', '')).toBe('');
	});

	it('handles 12:00 AM (midnight)', () => {
		expect(combineDateAndTime('2025-06-01', '12:00 AM')).toBe('2025-06-01T00:00:00');
	});

	it('handles 12:00 PM (noon)', () => {
		expect(combineDateAndTime('2025-06-01', '12:00 PM')).toBe('2025-06-01T12:00:00');
	});

	it('handles 1:30 PM', () => {
		expect(combineDateAndTime('2025-06-01', '1:30 PM')).toBe('2025-06-01T13:30:00');
	});

	it('handles 11:59 PM', () => {
		expect(combineDateAndTime('2025-06-01', '11:59 PM')).toBe('2025-06-01T23:59:00');
	});

	it('handles 12:01 AM', () => {
		expect(combineDateAndTime('2025-06-01', '12:01 AM')).toBe('2025-06-01T00:01:00');
	});

	it('handles 1:00 AM', () => {
		expect(combineDateAndTime('2025-06-01', '1:00 AM')).toBe('2025-06-01T01:00:00');
	});

	it('handles 24h format 13:30', () => {
		expect(combineDateAndTime('2025-06-01', '13:30')).toBe('2025-06-01T13:30:00');
	});

	it('handles 24h format 0:00 (midnight)', () => {
		expect(combineDateAndTime('2025-06-01', '0:00')).toBe('2025-06-01T00:00:00');
	});

	it('handles 24h format 23:59', () => {
		expect(combineDateAndTime('2025-06-01', '23:59')).toBe('2025-06-01T23:59:00');
	});

	it('handles ISO date format with AM/PM time', () => {
		expect(combineDateAndTime('2025-06-01', '9:00 AM')).toBe('2025-06-01T09:00:00');
	});

	it('rejects year-less fallback dates instead of defaulting to 2001', () => {
		expect(combineDateAndTime('Mon, Jan 1', '1:30 PM')).toBe('');
	});

	it('fallback branch emits the same naive local format as the ISO branch', () => {
		expect(combineDateAndTime('Aug 15, 2026', '1:30 PM')).toBe(
			combineDateAndTime('2026-08-15', '1:30 PM')
		);
	});
});

/** Build a minimal structurally-valid ds:1 page containing exactly one flight. */
function buildDs1Html(extraStringValue = 'plain note'): string {
	// per-flight k: k[0][1]=airline codes, k[0][2]=segments, k[1][0][1]=price
	// segment: [3]=origin [6]=dest [8]=departTime [10]=arrivalTime [11]=duration
	//          [20]=departDate [21]=arrivalDate
	const segment: unknown[] = [];
	segment[3] = 'SLC';
	segment[6] = 'ORD';
	segment[8] = [9, 30];
	segment[10] = [13, 5];
	segment[11] = 215;
	segment[20] = [2026, 8, 14];
	segment[21] = [2026, 8, 14];

	const k: unknown[] = [];
	k[0] = [];
	(k[0] as unknown[])[1] = ['UA'];
	(k[0] as unknown[])[2] = [segment];
	(k[0] as unknown[])[5] = extraStringValue; // free-text slot — airline notice etc.
	k[1] = [[null, 263]]; // k[1][0][1] = price

	const payload: unknown[] = [];
	payload[2] = [[k]]; // "Top departing flights" at payload[2][0]
	payload[3] = [[]]; // "Other departing flights" at payload[3][0]
	payload[7] = [];
	(payload[7] as unknown[])[1] = [];
	((payload[7] as unknown[])[1] as unknown[])[1] = [['UA', 'United Airlines']];

	const json = JSON.stringify(payload);
	return `<html><body><script class="ds:1">AF_initDataCallback({key: 'ds:1', hash: '2', data:${json}, sideChannel: {}});</script></body></html>`;
}

describe('parseFlightResponse', () => {
	// Extraction failures THROW so the flights route can cache them as a
	// transient failure (failKey/503) instead of sticky no-inventory. [] is
	// reserved for a successfully parsed payload with zero itineraries.
	it('throws FlightParseError for empty string', () => {
		expect(() => parseFlightResponse('')).toThrow(FlightParseError);
	});

	it('throws no-ds1-tag for pages without the payload (consent page, CAPTCHA)', () => {
		const consentHtml =
			'<html><head><title>Before you continue to Google</title></head>' +
			'<body>We use cookies... <form action="https://consent.google.com/save"></form></body></html>';
		try {
			parseFlightResponse(consentHtml);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(FlightParseError);
			expect((err as FlightParseError).reason).toBe('no-ds1-tag');
		}
	});

	it('throws json-parse-failed for malformed payload', () => {
		expect(() => parseFlightResponse('<script class="ds:1">data:[undefined]</script>')).toThrow(
			FlightParseError
		);
	});

	it('throws unrecognized-structure when the flight-list slots hold unexpected values', () => {
		// Valid JSON payload, but the list slots contain non-array, non-null
		// junk — a format change, not a zero-flight route.
		const payload: unknown[] = [];
		payload[2] = 'unexpected';
		payload[3] = { moved: true };
		const html = `<script class="ds:1">AF_initDataCallback({data:${JSON.stringify(payload)}, sideChannel: {}});</script>`;
		try {
			parseFlightResponse(html);
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(FlightParseError);
			expect((err as FlightParseError).reason).toBe('unrecognized-structure');
		}
	});

	it('returns [] for the null zero-results encoding (route with no airline service)', () => {
		// Mirrors the live payload shape observed for DEN→BED / DEN→CXH
		// (seaplane bases, GA-only strips): valid payload, metadata intact,
		// both list slots EXPLICITLY null. This is Google's "no flights found"
		// encoding — it must be sticky no-inventory, not a parse failure.
		const payload: unknown[] = [
			[null, [[1783532818222151, 55304871, 956782753]], 0, 'token'], // [0] page meta
			[[[['DEN', 0], 'Denver International Airport']]], // [1] airport info
			null, // [2] best-flights slot — explicitly null
			null, // [3] other-flights slot — explicitly null
			null,
			null,
			[1], // [6] present on observed empty pages
			[] // [7] airline meta container
		];
		const html = `<script class="ds:1">AF_initDataCallback({data:${JSON.stringify(payload)}, sideChannel: {}});</script>`;
		expect(parseFlightResponse(html)).toEqual([]);
	});

	it('still throws when only one slot is null and the other is junk', () => {
		const payload: unknown[] = [];
		payload[2] = null;
		payload[3] = 42;
		const html = `<script class="ds:1">AF_initDataCallback({data:${JSON.stringify(payload)}, sideChannel: {}});</script>`;
		expect(() => parseFlightResponse(html)).toThrow(FlightParseError);
	});

	it('parses a minimal structurally-valid payload to one flight (control)', () => {
		const flights = parseFlightResponse(buildDs1Html());
		expect(flights).toHaveLength(1);
		expect(flights[0].price).toBe(263);
		expect(flights[0].airline).toBe('United Airlines');
		expect(flights[0].origin).toBe('SLC');
		expect(flights[0].destination).toBe('ORD');
		expect(flights[0].departureTime).toBe('2026-08-14T09:30:00');
		expect(flights[0].arrivalTime).toBe('2026-08-14T13:05:00');
	});

	it('returns [] (not a throw) when lists are present but contain no flights', () => {
		const payload: unknown[] = [];
		payload[2] = [[]];
		payload[3] = [[]];
		const emptyHtml = `<script class="ds:1">AF_initDataCallback({data:${JSON.stringify(payload)}, sideChannel: {}});</script>`;
		expect(parseFlightResponse(emptyHtml)).toEqual([]);
	});

	it('survives "]" inside a string value (bracket counter must skip strings)', () => {
		const flights = parseFlightResponse(buildDs1Html('Arrives Terminal ]A'));
		expect(flights).toHaveLength(1);
		expect(flights[0].price).toBe(263);
	});

	it('survives "}" inside a string value', () => {
		expect(parseFlightResponse(buildDs1Html('Fare rules} apply'))).toHaveLength(1);
	});

	it('survives escaped quotes and brackets inside string values', () => {
		// JSON.stringify turns the inner quotes into \" escapes — the scanner
		// must not treat the escaped quote as a string terminator.
		expect(parseFlightResponse(buildDs1Html('a "quoted]" note'))).toHaveLength(1);
	});
});
