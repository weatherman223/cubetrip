import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnrichedCompetition, makeFlightResult } from '$lib/test-utils/fixtures';

vi.mock('./airport-lookup', () => ({
	findNearestAirports: vi.fn(() => [
		{
			airport: {
				iata: 'LAX',
				name: 'LAX',
				latitude: 33.94,
				longitude: -118.41,
				city: 'LA',
				country: 'US'
			},
			distanceKm: 50
		},
		{
			airport: {
				iata: 'SFO',
				name: 'SFO',
				latitude: 37.62,
				longitude: -122.38,
				city: 'SF',
				country: 'US'
			},
			distanceKm: 200
		},
		{
			airport: {
				iata: 'SAN',
				name: 'SAN',
				latitude: 32.73,
				longitude: -117.19,
				city: 'San Diego',
				country: 'US'
			},
			distanceKm: 180
		},
		{
			airport: {
				iata: 'SJC',
				name: 'SJC',
				latitude: 37.36,
				longitude: -121.93,
				city: 'San Jose',
				country: 'US'
			},
			distanceKm: 250
		},
		{
			airport: {
				iata: 'OAK',
				name: 'OAK',
				latitude: 37.72,
				longitude: -122.22,
				city: 'Oakland',
				country: 'US'
			},
			distanceKm: 260
		},
		{
			airport: {
				iata: 'SMF',
				name: 'SMF',
				latitude: 38.7,
				longitude: -121.59,
				city: 'Sacramento',
				country: 'US'
			},
			distanceKm: 400
		},
		{
			airport: {
				iata: 'BUR',
				name: 'BUR',
				latitude: 34.2,
				longitude: -118.36,
				city: 'Burbank',
				country: 'US'
			},
			distanceKm: 60
		},
		{
			airport: {
				iata: 'LGB',
				name: 'LGB',
				latitude: 33.82,
				longitude: -118.15,
				city: 'Long Beach',
				country: 'US'
			},
			distanceKm: 70
		},
		{
			airport: {
				iata: 'ONT',
				name: 'ONT',
				latitude: 34.06,
				longitude: -117.6,
				city: 'Ontario',
				country: 'US'
			},
			distanceKm: 90
		},
		{
			airport: {
				iata: 'SNA',
				name: 'SNA',
				latitude: 33.68,
				longitude: -117.87,
				city: 'Santa Ana',
				country: 'US'
			},
			distanceKm: 100
		},
		{
			airport: {
				iata: 'PSP',
				name: 'PSP',
				latitude: 33.83,
				longitude: -116.51,
				city: 'Palm Springs',
				country: 'US'
			},
			distanceKm: 200
		},
		{
			airport: {
				iata: 'FAT',
				name: 'FAT',
				latitude: 36.78,
				longitude: -119.72,
				city: 'Fresno',
				country: 'US'
			},
			distanceKm: 350
		},
		{
			airport: {
				iata: 'RNO',
				name: 'RNO',
				latitude: 39.5,
				longitude: -119.77,
				city: 'Reno',
				country: 'US'
			},
			distanceKm: 500
		},
		{
			airport: {
				iata: 'LAS',
				name: 'LAS',
				latitude: 36.08,
				longitude: -115.15,
				city: 'Las Vegas',
				country: 'US'
			},
			distanceKm: 370
		},
		{
			airport: {
				iata: 'PHX',
				name: 'PHX',
				latitude: 33.44,
				longitude: -112.01,
				city: 'Phoenix',
				country: 'US'
			},
			distanceKm: 580
		},
		{
			airport: {
				iata: 'TUS',
				name: 'TUS',
				latitude: 32.12,
				longitude: -110.94,
				city: 'Tucson',
				country: 'US'
			},
			distanceKm: 680
		},
		{
			airport: {
				iata: 'ABQ',
				name: 'ABQ',
				latitude: 35.04,
				longitude: -106.61,
				city: 'Albuquerque',
				country: 'US'
			},
			distanceKm: 950
		},
		{
			airport: {
				iata: 'SEA',
				name: 'SEA',
				latitude: 47.45,
				longitude: -122.31,
				city: 'Seattle',
				country: 'US'
			},
			distanceKm: 1500
		},
		{
			airport: {
				iata: 'PDX',
				name: 'PDX',
				latitude: 45.59,
				longitude: -122.6,
				city: 'Portland',
				country: 'US'
			},
			distanceKm: 1300
		},
		{
			airport: {
				iata: 'SLC',
				name: 'SLC',
				latitude: 40.79,
				longitude: -111.98,
				city: 'Salt Lake City',
				country: 'US'
			},
			distanceKm: 800
		}
	])
}));

import {
	shiftDate,
	fetchFlightForAirport,
	searchFlightsForComp,
	fetchFlightsForCompetitions,
	isFlightLate
} from './flight-search';
import { findNearestAirports } from './airport-lookup';

function makeFetchResponse(flights: ReturnType<typeof makeFlightResult>[], fallbackUrl?: string) {
	return {
		ok: true,
		json: async () => ({
			flights,
			fetchedAt: '2025-08-14T00:00:00Z',
			fallbackUrl
		})
	} as unknown as Response;
}

describe('shiftDate', () => {
	it('normal subtract: 2025-06-15 - 1 = 2025-06-14', () => {
		expect(shiftDate('2025-06-15', -1)).toBe('2025-06-14');
	});

	it('normal add: 2025-06-15 + 1 = 2025-06-16', () => {
		expect(shiftDate('2025-06-15', 1)).toBe('2025-06-16');
	});

	it('month boundary: 2025-07-01 - 1 = 2025-06-30', () => {
		expect(shiftDate('2025-07-01', -1)).toBe('2025-06-30');
	});

	it('year boundary: 2026-01-01 - 1 = 2025-12-31', () => {
		expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
	});
});

describe('fetchFlightForAirport', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('success returns AirportFlight with correct shape', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi
			.fn()
			.mockResolvedValue(makeFetchResponse([flight], 'https://flights.google.com'));

		const result = await fetchFlightForAirport('DEN', 'LAX', '2025-08-14', '2025-08-17');

		expect(result).not.toBeNull();
		// Narrow past NO_INVENTORY for property access below.
		if (result === null || typeof result === 'symbol') throw new Error('expected AirportFlight');
		expect(result.flight.origin).toBe('DEN');
		expect(result.flight.destination).toBe('LAX');
		expect(result.flight.price).toBe(199);
		expect(result.fetchedAt).toBe('2025-08-14T00:00:00Z');
		expect(result.fallbackUrl).toBe('https://flights.google.com');
	});

	it('HTTP error (res.ok=false) returns null', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);

		const result = await fetchFlightForAirport('DEN', 'LAX', '2025-08-14', '2025-08-17');
		expect(result).toBeNull();
	});

	it('fetch throws returns null', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

		const result = await fetchFlightForAirport('DEN', 'LAX', '2025-08-14', '2025-08-17');
		expect(result).toBeNull();
	});
});

describe('searchFlightsForComp', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('first batch has results: returns primary flight', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi
			.fn()
			.mockResolvedValue(makeFetchResponse([flight], 'https://flights.google.com'));

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34.0,
			longitude_degrees: -118.0,
			start_date: '2025-08-15',
			end_date: '2025-08-16'
		});

		const result = await searchFlightsForComp(comp, ['DEN']);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.destination).toBe('LAX');
		expect(result.fallbackUrl).toBe('https://flights.google.com');
	});

	it('first batch empty, expands to second batch', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'SMF', price: 250 });
		let callCount = 0;
		global.fetch = vi.fn().mockImplementation(() => {
			callCount++;
			// First 5 calls return no flights, next batch returns results
			if (callCount <= 5) {
				return Promise.resolve(makeFetchResponse([]));
			}
			return Promise.resolve(makeFetchResponse([flight], 'https://flights.google.com'));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34.0,
			longitude_degrees: -118.0,
			start_date: '2025-08-15',
			end_date: '2025-08-16'
		});

		const result = await searchFlightsForComp(comp, ['DEN']);

		expect(result.primary).not.toBeNull();
		// Should have searched beyond the first batch of 5
		expect(callCount).toBeGreaterThan(5);
	});

	it('sets cheaperAlt when farther airport is cheaper', async () => {
		const flights: Record<string, ReturnType<typeof makeFlightResult>> = {
			LAX: makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 300 }),
			SFO: makeFlightResult({ origin: 'DEN', destination: 'SFO', price: 150 }),
			SAN: makeFlightResult({ origin: 'DEN', destination: 'SAN', price: 400 }),
			SJC: makeFlightResult({ origin: 'DEN', destination: 'SJC', price: 350 }),
			OAK: makeFlightResult({ origin: 'DEN', destination: 'OAK', price: 280 })
		};

		global.fetch = vi.fn().mockImplementation((url: string) => {
			const dest = new URL(url, 'http://localhost').searchParams.get('destination');
			const flight = dest && flights[dest];
			if (flight) {
				return Promise.resolve(makeFetchResponse([flight]));
			}
			return Promise.resolve(makeFetchResponse([]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34.0,
			longitude_degrees: -118.0,
			start_date: '2025-08-15',
			end_date: '2025-08-16'
		});

		const result = await searchFlightsForComp(comp, ['DEN']);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.destination).toBe('LAX');
		expect(result.cheaperAlt).not.toBeNull();
		expect(result.cheaperAlt!.flight.destination).toBe('SFO');
		expect(result.cheaperAlt!.flight.price).toBeLessThan(result.primary!.flight.price);
	});

	it('excludes home airport from destinations', async () => {
		// Set up findNearestAirports to include the home airport
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'DEN',
					name: 'DEN',
					latitude: 39.86,
					longitude: -104.67,
					city: 'Denver',
					country: 'US'
				},
				distanceKm: 10
			},
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 33.94,
					longitude: -118.41,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 1400
			}
		]);

		const fetchCalls: string[] = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const dest = new URL(url, 'http://localhost').searchParams.get('destination');
			fetchCalls.push(dest!);
			const flight = makeFlightResult({ origin: 'DEN', destination: dest!, price: 199 });
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 39.7,
			longitude_degrees: -104.9,
			start_date: '2025-08-15',
			end_date: '2025-08-16'
		});

		await searchFlightsForComp(comp, ['DEN']);

		// DEN should not appear as a destination in any fetch call
		expect(fetchCalls).not.toContain('DEN');
	});
});

describe('isFlightLate', () => {
	it('WCIF present: compares against schedule start (precise)', () => {
		const flight = { arrivalTime: '2025-08-15T11:30:00' };
		const comp = makeEnrichedCompetition({
			start_date: '2025-08-15',
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: null,
				competitorCount: 0,
				registrationStatus: 'open',
				scheduleStartTime: '2025-08-15T12:00:00Z',
				scheduleEndTime: '2025-08-16T18:00:00Z'
			}
		});
		expect(isFlightLate(flight, comp)).toBe(false);
	});

	it('WCIF present: arrival after schedule start is late', () => {
		const flight = { arrivalTime: '2025-08-15T13:30:00' };
		const comp = makeEnrichedCompetition({
			start_date: '2025-08-15',
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: null,
				competitorCount: 0,
				registrationStatus: 'open',
				scheduleStartTime: '2025-08-15T12:00:00',
				scheduleEndTime: '2025-08-16T18:00:00'
			}
		});
		expect(isFlightLate(flight, comp)).toBe(true);
	});

	it('WCIF null: arriving on comp start date is treated as late', () => {
		const flight = { arrivalTime: '2025-08-15T03:30:00' };
		const comp = makeEnrichedCompetition({ start_date: '2025-08-15', wcif: null });
		expect(isFlightLate(flight, comp)).toBe(true);
	});

	it('WCIF null: arriving the day before is not late', () => {
		const flight = { arrivalTime: '2025-08-14T23:55:00' };
		const comp = makeEnrichedCompetition({ start_date: '2025-08-15', wcif: null });
		expect(isFlightLate(flight, comp)).toBe(false);
	});

	it('flight with empty arrivalTime and no duration hint is not flagged', () => {
		const flight = { arrivalTime: '', duration: 0 };
		const comp = makeEnrichedCompetition({ start_date: '2025-08-15', wcif: null });
		expect(isFlightLate(flight, comp)).toBe(false);
	});

	it('falls back to duration estimate when arrivalTime is missing (long-haul)', () => {
		// 14h47m DEN -> WAW leaving one day before: noon + 887m = Apr 26 local.
		const flight = { arrivalTime: '', duration: 887 };
		const comp = makeEnrichedCompetition({ start_date: '2026-04-26', wcif: null });
		expect(isFlightLate(flight, comp, 1)).toBe(true);
	});

	it('duration-estimate says not late for short-haul one day before', () => {
		// 3h flight leaving the day before lands the same (prior) day.
		const flight = { arrivalTime: '', duration: 180 };
		const comp = makeEnrichedCompetition({ start_date: '2026-04-26', wcif: null });
		expect(isFlightLate(flight, comp, 1)).toBe(false);
	});
});

describe('searchFlightsForComp — multi-day', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'VCE',
					name: 'Venice Marco Polo',
					latitude: 45.51,
					longitude: 12.35,
					city: 'Venice',
					country: 'IT'
				},
				distanceKm: 30
			}
		]);
	});

	// Build a fetch mock keyed by departDate so each day can return a distinct flight.
	function fetchByDepartDate(byDate: Record<string, Partial<FlightFixture> | null>) {
		return vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			const spec = byDate[departDate];
			if (!spec) return Promise.resolve(makeFetchResponse([]));
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: spec.price,
				arrivalTime: spec.arrivalTime
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
	}

	it('Case A: daysBefore=1 arrives in time → picks daysBefore=1', async () => {
		global.fetch = fetchByDepartDate({
			'2026-05-29': { price: 1200, arrivalTime: '2026-05-29T18:00:00' },
			'2026-05-28': { price: 1800, arrivalTime: '2026-05-28T18:00:00' },
			'2026-05-27': { price: 2000, arrivalTime: '2026-05-27T18:00:00' }
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 3);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBe(1);
		expect(result.primary!.flight.price).toBe(1200);
	});

	it('Case B: daysBefore=1 late, daysBefore=2 in time → picks daysBefore=2', async () => {
		global.fetch = fetchByDepartDate({
			// Leaves May 29, arrives May 30 during comp (late)
			'2026-05-29': { price: 1346, arrivalTime: '2026-05-30T10:00:00' },
			// Leaves May 28, arrives May 29 (in time)
			'2026-05-28': { price: 1500, arrivalTime: '2026-05-29T12:00:00' },
			'2026-05-27': { price: 1700, arrivalTime: '2026-05-28T12:00:00' }
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 3);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBe(2);
		expect(result.primary!.flight.price).toBe(1500);
	});

	it('Case C: all days late within max → picks cheapest late (partial)', async () => {
		global.fetch = fetchByDepartDate({
			'2026-05-29': { price: 1346, arrivalTime: '2026-05-30T10:00:00' },
			'2026-05-28': { price: 900, arrivalTime: '2026-05-30T08:00:00' },
			'2026-05-27': { price: 1100, arrivalTime: '2026-05-30T07:00:00' }
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 3);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.price).toBe(900);
		// This flight is still late (partial attendance).
		expect(isFlightLate(result.primary!.flight, comp)).toBe(true);
	});

	it('Case D: max=2 searches both days and picks cheapest in-time', async () => {
		// Mode B: user opted into a 2-day window, so we compare both and the cheaper
		// in-time option wins even though the later departure (day-1) also arrives in time.
		const queriedDates = new Set<string>();
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			queriedDates.add(departDate);
			const price = departDate === '2026-05-29' ? 1500 : 800;
			const arrivalTime = `${departDate}T18:00:00`;
			const flight = makeFlightResult({ origin: 'DEN', destination, price, arrivalTime });
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 2);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBe(2);
		expect(result.primary!.flight.price).toBe(800);
		expect(queriedDates.has('2026-05-29')).toBe(true);
		expect(queriedDates.has('2026-05-28')).toBe(true);
	});

	it('Case E: scheduleStartTime null + arrival on comp start date → treated as late', async () => {
		// Only one in-window option lands on the comp start date itself.
		global.fetch = fetchByDepartDate({
			'2026-05-29': { price: 1000, arrivalTime: '2026-05-30T03:00:00' },
			'2026-05-28': { price: 1200, arrivalTime: '2026-05-29T03:00:00' }
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31',
			wcif: null
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 2);

		expect(result.primary).not.toBeNull();
		// Day-before-1 is treated as late (arrivalDate == start_date), so day-before-2 wins.
		expect(result.primary!.daysBefore).toBe(2);
		expect(result.primary!.flight.price).toBe(1200);
	});

	it('Case F: maxDaysBeforeComp=1 matches today — only one date tuple queried', async () => {
		let callCount = 0;
		const departDates = new Set<string>();
		global.fetch = vi.fn().mockImplementation((url: string) => {
			callCount++;
			const parsed = new URL(url, 'http://localhost');
			departDates.add(parsed.searchParams.get('departDate')!);
			const flight = makeFlightResult({
				origin: 'DEN',
				destination: 'VCE',
				price: 1200,
				arrivalTime: '2026-05-29T18:00:00'
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 1);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBe(1);
		expect(departDates.size).toBe(1);
		expect(departDates.has('2026-05-29')).toBe(true);
		expect(callCount).toBe(1);
	});

	it('max=1 does NOT widen when day-1 returns null (server error / failure cache)', async () => {
		// Repro of the "slider 2→1 but card stays at LEAVES 2 DAYS BEFORE" bug:
		// day-1 is unavailable (e.g., failure-cached from a previous mode-B=2 run)
		// but day-2 has success-cached data. Mode A must NOT silently fall through
		// to day-2 — it should surface the day-1 unavailability instead.
		const queriedDates = new Set<string>();
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			queriedDates.add(departDate);
			if (departDate === '2026-05-01') {
				// Day-1 server returns no flights (mimics failure cache hit)
				return Promise.resolve(makeFetchResponse([]));
			}
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: 326,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 36.85,
			longitude_degrees: -76,
			start_date: '2026-05-02',
			end_date: '2026-05-02'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 1);

		expect(result.primary).toBeNull();
		// Only day-1 was queried; we did not fall through to day-2.
		expect(queriedDates.has('2026-05-01')).toBe(true);
		expect(queriedDates.has('2026-04-30')).toBe(false);
	});

	it('Case G: max=1 auto-widens beyond the window when day-1 arrives late', async () => {
		// Day-1 lands during the comp; mode A should keep widening past the user's cap
		// of 1 up to the hard ceiling to find an in-time option.
		const queriedDates = new Set<string>();
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			queriedDates.add(departDate);
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: 1000,
				// Day-1 (May 29) arrives during comp; day-2 (May 28) and day-3 (May 27) arrive before.
				arrivalTime:
					departDate === '2026-05-29'
						? '2026-05-30T10:00:00'
						: `${shiftDateForTest(departDate, 1)}T10:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 1);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBeGreaterThan(1);
		// Mode A is sequential and breaks on the first in-time day, which is day-2 here.
		expect(result.primary!.daysBefore).toBe(2);
		expect(queriedDates.has('2026-05-29')).toBe(true);
		expect(queriedDates.has('2026-05-28')).toBe(true);
	});

	it('onDayProgress fires once per day in order (mode B only)', async () => {
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const destination = parsed.searchParams.get('destination')!;
			const departDate = parsed.searchParams.get('departDate')!;
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: 1000,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const progress: Array<[number, number]> = [];
		await searchFlightsForComp(comp, ['DEN'], 3, false, (done, total) => {
			progress.push([done, total]);
		});

		expect(progress).toEqual([
			[1, 3],
			[2, 3],
			[3, 3]
		]);
	});

	it('onDayProgress is silent in mode A (max=1)', async () => {
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: 1000,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const onProgress = vi.fn();
		await searchFlightsForComp(comp, ['DEN'], 1, false, onProgress);

		expect(onProgress).not.toHaveBeenCalled();
	});

	it('no-inventory cache: day-2 skips destinations that returned empty on day-1', async () => {
		// Setup: 5 nearby airports. Day-1 (2026-05-29) → 4 return empty, 1 (VCE)
		// has a flight. Day-2 should skip the 4 empty ones entirely.
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: { iata: 'VCE', name: 'VCE', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 30
			},
			{
				airport: { iata: 'TSF', name: 'TSF', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 40
			},
			{
				airport: { iata: 'VRN', name: 'VRN', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 50
			},
			{
				airport: { iata: 'BGY', name: 'BGY', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 60
			},
			{
				airport: { iata: 'LIN', name: 'LIN', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 70
			}
		]);

		const requestLog: Array<{ dest: string; date: string }> = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const dest = parsed.searchParams.get('destination')!;
			const date = parsed.searchParams.get('departDate')!;
			requestLog.push({ dest, date });
			if (dest === 'VCE') {
				const flight = makeFlightResult({
					origin: 'DEN',
					destination: 'VCE',
					price: 1000,
					arrivalTime: `${date}T18:00:00`
				});
				return Promise.resolve(makeFetchResponse([flight]));
			}
			// Empty inventory for the other 4 airports.
			return Promise.resolve(makeFetchResponse([]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		await searchFlightsForComp(comp, ['DEN'], 2);

		const day1Requests = requestLog.filter((r) => r.date === '2026-05-29');
		const day2Requests = requestLog.filter((r) => r.date === '2026-05-28');

		// Day 1 probed all 5 airports (nothing known to be empty yet).
		expect(day1Requests.map((r) => r.dest).sort()).toEqual(['BGY', 'LIN', 'TSF', 'VCE', 'VRN']);
		// Day 2 skipped the 4 confirmed-empty airports and only probed VCE.
		expect(day2Requests.map((r) => r.dest)).toEqual(['VCE']);
	});

	it('no-inventory cache: errored destinations (non-ok) are NOT marked empty', async () => {
		// HTTP errors (429, 500, etc.) shouldn't poison the skip set — they
		// might succeed on retry. Only genuinely-empty scrapes are sticky.
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: { iata: 'VCE', name: 'VCE', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 30
			}
		]);

		const requestLog: Array<{ dest: string; date: string }> = [];
		let call = 0;
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			requestLog.push({
				dest: parsed.searchParams.get('destination')!,
				date: parsed.searchParams.get('departDate')!
			});
			call++;
			// First request fails (429-ish), later requests succeed with a flight.
			if (call === 1) return Promise.resolve({ ok: false } as Response);
			const flight = makeFlightResult({
				origin: 'DEN',
				destination: 'VCE',
				price: 1000,
				arrivalTime: '2026-05-28T18:00:00'
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		await searchFlightsForComp(comp, ['DEN'], 2);

		// Day-1 errored. Day-2 should still probe VCE — the error didn't
		// mark it as no-inventory.
		expect(requestLog.filter((r) => r.date === '2026-05-28').map((r) => r.dest)).toEqual(['VCE']);
	});

	it('no-inventory cache: skipCache=true disables the skip set (refresh path)', async () => {
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: { iata: 'VCE', name: 'VCE', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 30
			},
			{
				airport: { iata: 'TSF', name: 'TSF', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 40
			}
		]);

		const requestLog: Array<{ dest: string; date: string }> = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const dest = parsed.searchParams.get('destination')!;
			const date = parsed.searchParams.get('departDate')!;
			requestLog.push({ dest, date });
			if (dest === 'VCE') {
				const flight = makeFlightResult({
					origin: 'DEN',
					destination: 'VCE',
					price: 1000,
					arrivalTime: `${date}T18:00:00`
				});
				return Promise.resolve(makeFetchResponse([flight]));
			}
			return Promise.resolve(makeFetchResponse([]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		// skipCache=true — mimics the per-card refresh button.
		await searchFlightsForComp(comp, ['DEN'], 2, true);

		// With the skip disabled, day-2 re-probes TSF (even though day-1 proved it empty).
		const day2 = requestLog.filter((r) => r.date === '2026-05-28').map((r) => r.dest);
		expect(day2).toContain('TSF');
		expect(day2).toContain('VCE');
	});

	it('probes one extra chunk for a cheaperAlt when first chunk has only one destination', async () => {
		// Repro of the Cape May issue: DOV (Dover AFB) is nearest but has no
		// commercial flights, SBY (Salisbury) is next and has an expensive
		// one-stop, then a hub airport (PHL) sits in chunk 2. The algorithm
		// should surface PHL as the cheaperAlt instead of stopping at SBY.
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			// Chunk 1 — 5 closest
			{
				airport: { iata: 'DOV', name: 'DOV', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 50
			},
			{
				airport: { iata: 'ACY', name: 'ACY', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 60
			},
			{
				airport: { iata: 'OXB', name: 'OXB', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 70
			},
			{
				airport: { iata: 'SBY', name: 'SBY', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 80
			},
			{
				airport: { iata: 'ILG', name: 'ILG', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 90
			},
			// Chunk 2 — hubs
			{
				airport: { iata: 'PHL', name: 'PHL', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 100
			},
			{
				airport: { iata: 'EWR', name: 'EWR', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 120
			}
		]);

		const queried: string[] = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const dest = parsed.searchParams.get('destination')!;
			const date = parsed.searchParams.get('departDate')!;
			queried.push(dest);
			// Chunk-1 non-commercial / empty: DOV, OXB, ILG. SBY has $778. ACY empty (redirects here).
			const priceMap: Record<string, number> = { SBY: 778, PHL: 300, EWR: 310 };
			const price = priceMap[dest];
			if (price === undefined) return Promise.resolve(makeFetchResponse([]));
			const flight = makeFlightResult({
				origin: 'DEN',
				destination: dest,
				price,
				arrivalTime: `${date}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 38.93,
			longitude_degrees: -74.91,
			start_date: '2026-06-20',
			end_date: '2026-06-20'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 1);

		// Primary stays as SBY (nearest airport with flights).
		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.destination).toBe('SBY');
		expect(result.primary!.flight.price).toBe(778);

		// cheaperAlt surfaces PHL — cheapest in-hand that's cheaper than SBY.
		expect(result.cheaperAlt).not.toBeNull();
		expect(result.cheaperAlt!.flight.destination).toBe('PHL');
		expect(result.cheaperAlt!.flight.price).toBe(300);

		// Both chunks were probed (chunk-2 is what surfaced PHL).
		expect(queried).toContain('SBY');
		expect(queried).toContain('PHL');
	});

	it('stops at chunk 1 when it has ≥2 distinct destinations already', async () => {
		// No need to probe chunk 2 if chunk 1 has enough material for
		// primary + cheaperAlt. Avoids doubling the request count in the common
		// case where major airports are close (e.g. LA with LAX + BUR + LGB).
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: { iata: 'LAX', name: 'LAX', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 30
			},
			{
				airport: { iata: 'BUR', name: 'BUR', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 40
			},
			{
				airport: { iata: 'LGB', name: 'LGB', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 45
			},
			{
				airport: { iata: 'ONT', name: 'ONT', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 60
			},
			{
				airport: { iata: 'SNA', name: 'SNA', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 70
			},
			// Chunk 2 — should NOT be probed.
			{
				airport: { iata: 'PHX', name: 'PHX', latitude: 0, longitude: 0, city: '', country: '' },
				distanceKm: 600
			}
		]);

		const queried: string[] = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const dest = parsed.searchParams.get('destination')!;
			const date = parsed.searchParams.get('departDate')!;
			queried.push(dest);
			// Two distinct destinations with flights in chunk 1.
			if (dest === 'LAX' || dest === 'BUR') {
				const flight = makeFlightResult({
					origin: 'DEN',
					destination: dest,
					price: dest === 'LAX' ? 200 : 180,
					arrivalTime: `${date}T18:00:00`
				});
				return Promise.resolve(makeFetchResponse([flight]));
			}
			return Promise.resolve(makeFetchResponse([]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-06-20',
			end_date: '2026-06-20'
		});

		await searchFlightsForComp(comp, ['DEN'], 1);

		// chunk-2 airport was never queried; we had enough after chunk 1.
		expect(queried).not.toContain('PHX');
	});

	it('Case H: max=3 searches every day and picks cheapest in-time', async () => {
		const queriedDates = new Set<string>();
		const prices: Record<string, number> = {
			'2026-05-29': 1500,
			'2026-05-28': 800,
			'2026-05-27': 1200
		};
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const departDate = parsed.searchParams.get('departDate')!;
			const destination = parsed.searchParams.get('destination')!;
			queriedDates.add(departDate);
			const flight = makeFlightResult({
				origin: 'DEN',
				destination,
				price: prices[departDate] ?? 9999,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});
		const comp = makeEnrichedCompetition({
			latitude_degrees: 45.6,
			longitude_degrees: 12.2,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['DEN'], 3);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.daysBefore).toBe(2);
		expect(result.primary!.flight.price).toBe(800);
		expect(queriedDates.size).toBe(3);
	});

	// ---- Multi-origin cases ----------------------------------------------------

	it('multi-origin: picks cheapest in-time primary across origins', async () => {
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 34,
					longitude: -118,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			}
		]);

		const queriedOrigins: string[] = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const origin = parsed.searchParams.get('origin')!;
			const destination = parsed.searchParams.get('destination')!;
			const departDate = parsed.searchParams.get('departDate')!;
			queriedOrigins.push(origin);
			// EWR cheaper than JFK for the same route.
			const price = origin === 'EWR' ? 280 : 410;
			const flight = makeFlightResult({
				origin,
				destination,
				price,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['JFK', 'EWR'], 1);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.origin).toBe('EWR');
		expect(result.primary!.flight.price).toBe(280);
		// Both origins were queried.
		expect(queriedOrigins).toContain('JFK');
		expect(queriedOrigins).toContain('EWR');
	});

	it('multi-origin: cheaperAlt surfaces a cheaper flight from a different origin', async () => {
		// Setup: EWR has a cheaper alt to a different destination than the chosen
		// primary (JFK→LAX). This is the intended "Cheaper from EWR" path.
		//   EWR→LAX $550 (per-origin primary — beats JFK→LAX $600)
		//   JFK→BUR $400 (within-chunk alt under JFK, different origin AND dest from primary)
		// Global primary = EWR→LAX $550. cheaperAlt candidate = JFK→BUR $400.
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 34,
					longitude: -118,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			},
			{
				airport: {
					iata: 'BUR',
					name: 'BUR',
					latitude: 34.2,
					longitude: -118.4,
					city: 'Burbank',
					country: 'US'
				},
				distanceKm: 60
			}
		]);

		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const origin = parsed.searchParams.get('origin')!;
			const destination = parsed.searchParams.get('destination')!;
			const departDate = parsed.searchParams.get('departDate')!;
			const priceMap: Record<string, number> = {
				'JFK:LAX': 600,
				'JFK:BUR': 400,
				'EWR:LAX': 550
			};
			const price = priceMap[`${origin}:${destination}`];
			if (price === undefined) return Promise.resolve(makeFetchResponse([]));
			const flight = makeFlightResult({
				origin,
				destination,
				price,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['JFK', 'EWR'], 1);

		expect(result.primary!.flight.origin).toBe('EWR');
		expect(result.primary!.flight.destination).toBe('LAX');
		expect(result.primary!.flight.price).toBe(550);
		// Cheaper alt: JFK→BUR $400. Different origin AND different destination.
		expect(result.cheaperAlt).not.toBeNull();
		expect(result.cheaperAlt!.flight.origin).toBe('JFK');
		expect(result.cheaperAlt!.flight.destination).toBe('BUR');
		expect(result.cheaperAlt!.flight.price).toBe(400);
	});

	it('multi-origin: one origin empty falls back to origin with inventory', async () => {
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 34,
					longitude: -118,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			}
		]);

		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const origin = parsed.searchParams.get('origin')!;
			const destination = parsed.searchParams.get('destination')!;
			const departDate = parsed.searchParams.get('departDate')!;
			if (origin === 'JFK') return Promise.resolve(makeFetchResponse([])); // empty
			const flight = makeFlightResult({
				origin,
				destination,
				price: 280,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['JFK', 'EWR'], 1);

		expect(result.primary).not.toBeNull();
		expect(result.primary!.flight.origin).toBe('EWR');
	});

	it('multi-origin: all origins empty → null primary', async () => {
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 34,
					longitude: -118,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			}
		]);

		global.fetch = vi.fn().mockImplementation(() => {
			return Promise.resolve(makeFetchResponse([]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		const result = await searchFlightsForComp(comp, ['JFK', 'EWR'], 1);
		expect(result.primary).toBeNull();
	});

	it('multi-origin: noInventory sets are isolated per-origin', async () => {
		// JFK→LAX returns empty, so LAX gets added to JFK's noInventory.
		// EWR→LAX has a flight, and should not be skipped despite JFK's cache entry.
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 34,
					longitude: -118,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			}
		]);

		const queryLog: Array<{ origin: string; destination: string }> = [];
		global.fetch = vi.fn().mockImplementation((url: string) => {
			const parsed = new URL(url, 'http://localhost');
			const origin = parsed.searchParams.get('origin')!;
			const destination = parsed.searchParams.get('destination')!;
			const departDate = parsed.searchParams.get('departDate')!;
			queryLog.push({ origin, destination });
			if (origin === 'JFK') return Promise.resolve(makeFetchResponse([]));
			const flight = makeFlightResult({
				origin,
				destination,
				price: 280,
				arrivalTime: `${departDate}T18:00:00`
			});
			return Promise.resolve(makeFetchResponse([flight]));
		});

		const comp = makeEnrichedCompetition({
			latitude_degrees: 34,
			longitude_degrees: -118,
			start_date: '2026-05-30',
			end_date: '2026-05-31'
		});

		// mode B max=2 so the day loop runs twice — tests that per-origin noInventory
		// is scoped correctly: JFK skips LAX on day-2 (confirmed empty), EWR still probes it.
		await searchFlightsForComp(comp, ['JFK', 'EWR'], 2);

		const day2JfkQueries = queryLog.filter((q) => q.origin === 'JFK' && q.destination === 'LAX');
		const day2EwrQueries = queryLog.filter((q) => q.origin === 'EWR' && q.destination === 'LAX');
		// JFK probed LAX only on day-1 (day-2 skipped via its own noInventory set).
		expect(day2JfkQueries.length).toBe(1);
		// EWR probed LAX on both days — its noInventory set is independent.
		expect(day2EwrQueries.length).toBe(2);
	});
});

function shiftDateForTest(dateStr: string, days: number): string {
	const d = new Date(dateStr + 'T00:00:00');
	d.setDate(d.getDate() + days);
	return d.toISOString().split('T')[0];
}

interface FlightFixture {
	price: number;
	arrivalTime: string;
}

describe('fetchFlightsForCompetitions', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		// Restore the default mock for findNearestAirports
		const mockFn = findNearestAirports as ReturnType<typeof vi.fn>;
		mockFn.mockReturnValue([
			{
				airport: {
					iata: 'LAX',
					name: 'LAX',
					latitude: 33.94,
					longitude: -118.41,
					city: 'LA',
					country: 'US'
				},
				distanceKm: 50
			},
			{
				airport: {
					iata: 'SFO',
					name: 'SFO',
					latitude: 37.62,
					longitude: -122.38,
					city: 'SF',
					country: 'US'
				},
				distanceKm: 200
			}
		]);
	});

	it('filters out driveable competitions', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi.fn().mockResolvedValue(makeFetchResponse([flight]));

		const comp1 = makeEnrichedCompetition({
			id: 'NearComp2025',
			latitude_degrees: 39.7,
			longitude_degrees: -104.9
		});
		const comp2 = makeEnrichedCompetition({
			id: 'FarComp2025',
			latitude_degrees: 34.0,
			longitude_degrees: -118.0
		});

		const distances = new Map<string, number>();
		distances.set('NearComp2025', 50); // driveable (within radius)
		distances.set('FarComp2025', 1500); // not driveable

		const onUpdate = vi.fn();
		const result = await fetchFlightsForCompetitions(
			[comp1, comp2],
			['DEN'],
			distances,
			500, // radius in km
			onUpdate
		);

		// Only the far competition should have flight data
		expect(result.has('FarComp2025')).toBe(true);
		expect(result.has('NearComp2025')).toBe(false);
	});

	it('calls onUpdate once per competition', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi.fn().mockResolvedValue(makeFetchResponse([flight]));

		// Create 5 competitions, all non-driveable
		const comps = Array.from({ length: 5 }, (_, i) =>
			makeEnrichedCompetition({
				id: `Comp${i}`,
				latitude_degrees: 34.0 + i,
				longitude_degrees: -118.0
			})
		);

		const distances = new Map<string, number>();
		// All beyond driving radius
		for (const c of comps) {
			distances.set(c.id, 2000);
		}

		const onUpdate = vi.fn();
		await fetchFlightsForCompetitions(comps, ['DEN'], distances, 500, onUpdate);

		// Streaming: onUpdate fires once per resolved comp
		expect(onUpdate).toHaveBeenCalledTimes(5);
		// Each call receives a Map
		for (const call of onUpdate.mock.calls) {
			expect(call[0]).toBeInstanceOf(Map);
		}
	});

	it('defers closed comps: non-closed resolve before closed', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi.fn().mockResolvedValue(makeFetchResponse([flight]));

		const openComp = makeEnrichedCompetition({
			id: 'OpenComp',
			latitude_degrees: 34,
			longitude_degrees: -118,
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: 100,
				competitorCount: 20,
				registrationStatus: 'open',
				scheduleStartTime: null,
				scheduleEndTime: null
			}
		});
		const closedComp = makeEnrichedCompetition({
			id: 'ClosedComp',
			latitude_degrees: 35,
			longitude_degrees: -118,
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: 100,
				competitorCount: 100,
				registrationStatus: 'closed',
				scheduleStartTime: null,
				scheduleEndTime: null
			}
		});

		const distances = new Map<string, number>();
		distances.set('OpenComp', 2000);
		distances.set('ClosedComp', 2000);

		const resolveOrder: string[] = [];
		const onUpdate = vi.fn((updated: Map<string, unknown>) => {
			// Record which comp IDs appear for the first time in each onUpdate call.
			for (const id of updated.keys()) {
				if (!resolveOrder.includes(id)) resolveOrder.push(id);
			}
		});

		await fetchFlightsForCompetitions(
			[openComp, closedComp],
			['DEN'],
			distances,
			500,
			onUpdate,
			1,
			undefined,
			false // skipClosed=false — closed still fetched, just deferred
		);

		expect(resolveOrder).toEqual(['OpenComp', 'ClosedComp']);
	});

	it('skipClosed=true: closed comps are skipped entirely', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi.fn().mockResolvedValue(makeFetchResponse([flight]));

		const openComp = makeEnrichedCompetition({
			id: 'OpenComp',
			latitude_degrees: 34,
			longitude_degrees: -118,
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: 100,
				competitorCount: 20,
				registrationStatus: 'open',
				scheduleStartTime: null,
				scheduleEndTime: null
			}
		});
		const closedComp = makeEnrichedCompetition({
			id: 'ClosedComp',
			latitude_degrees: 35,
			longitude_degrees: -118,
			wcif: {
				onTheSpotRegistration: false,
				competitorLimit: 100,
				competitorCount: 100,
				registrationStatus: 'closed',
				scheduleStartTime: null,
				scheduleEndTime: null
			}
		});

		const distances = new Map<string, number>();
		distances.set('OpenComp', 2000);
		distances.set('ClosedComp', 2000);

		const onUpdate = vi.fn();
		const result = await fetchFlightsForCompetitions(
			[openComp, closedComp],
			['DEN'],
			distances,
			500,
			onUpdate,
			1,
			undefined,
			true // skipClosed=true
		);

		expect(result.has('OpenComp')).toBe(true);
		expect(result.has('ClosedComp')).toBe(false);
	});

	it('status-unknown comps (wcif=null) are NOT treated as closed', async () => {
		const flight = makeFlightResult({ origin: 'DEN', destination: 'LAX', price: 199 });
		global.fetch = vi.fn().mockResolvedValue(makeFetchResponse([flight]));

		const unknownComp = makeEnrichedCompetition({
			id: 'UnknownComp',
			latitude_degrees: 34,
			longitude_degrees: -118,
			wcif: null
		});

		const distances = new Map<string, number>();
		distances.set('UnknownComp', 2000);

		const result = await fetchFlightsForCompetitions(
			[unknownComp],
			['DEN'],
			distances,
			500,
			vi.fn(),
			1,
			undefined,
			true // skipClosed=true shouldn't affect unknowns
		);

		expect(result.has('UnknownComp')).toBe(true);
	});
});
