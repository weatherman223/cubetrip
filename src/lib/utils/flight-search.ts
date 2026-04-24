import type { EnrichedCompetition } from '$lib/server/wca/types';
import type { FlightResult, FlightSearchResult } from '$lib/server/flights/types';
import type { AirportFlight, CompFlightData } from '$lib/types';
import { findNearestAirports } from './airport-lookup';

interface FlightApiResponse extends FlightSearchResult {
	fallbackUrl?: string;
}

export function shiftDate(dateStr: string, days: number): string {
	const d = new Date(dateStr + 'T00:00:00');
	d.setDate(d.getDate() + days);
	return d.toISOString().split('T')[0];
}

/**
 * Whether a flight lands too late to attend the full competition.
 *
 * Three tiers of precision:
 *   1. WCIF schedule start + parsed arrival time → exact datetime compare.
 *   2. No WCIF, parsed arrival time → date-only compare (arriving on day 1 counts as late).
 *   3. Missing arrival time (scraper couldn't extract it) + known depart date + duration
 *      → estimate the arrival calendar day. Needed because long-haul legs like DEN → WAW
 *      frequently come back from Google Flights with blank departure/arrival times while
 *      still reporting a duration.
 */
export function isFlightLate(
	flight: Pick<FlightResult, 'arrivalTime'> & Partial<Pick<FlightResult, 'duration'>>,
	comp: Pick<EnrichedCompetition, 'start_date' | 'wcif'>,
	daysBefore?: number
): boolean {
	if (flight.arrivalTime) {
		const scheduleStart = comp.wcif?.scheduleStartTime;
		if (scheduleStart) return flight.arrivalTime > scheduleStart;
		return flight.arrivalTime.split('T')[0] >= comp.start_date;
	}

	// Fallback: estimate arrival date from depart date + duration.
	// Anchor the departure at local noon so the calendar-day estimate stays
	// consistent with how comp.start_date is interpreted (a bare local YYYY-MM-DD).
	// Reconstruct the date with local getters — toISOString() would return the UTC
	// calendar day, which differs from local by ±1 near timezone edges.
	if (daysBefore !== undefined && typeof flight.duration === 'number' && flight.duration > 0) {
		const departDate = shiftDate(comp.start_date, -daysBefore);
		const anchor = new Date(departDate + 'T12:00:00');
		anchor.setMinutes(anchor.getMinutes() + flight.duration);
		const y = anchor.getFullYear();
		const m = String(anchor.getMonth() + 1).padStart(2, '0');
		const d = String(anchor.getDate()).padStart(2, '0');
		const estArrivalDate = `${y}-${m}-${d}`;
		return estArrivalDate >= comp.start_date;
	}

	return false;
}

/**
 * Sentinel for "route successfully queried but has no inventory". Distinct
 * from `null`, which represents an error (HTTP failure, network, parse, 429).
 * Callers use this to decide whether it's safe to skip the route on later
 * searches within the same comp — errors shouldn't be sticky.
 */
export const NO_INVENTORY = Symbol('no-inventory');
export type FetchFlightResult = AirportFlight | typeof NO_INVENTORY | null;

export async function fetchFlightForAirport(
	homeAirport: string,
	destIata: string,
	departDate: string,
	returnDate: string,
	skipCache = false,
	daysBefore = 1
): Promise<FetchFlightResult> {
	try {
		const cacheParam = skipCache ? '&nocache=1' : '';
		const res = await fetch(
			`/api/flights?origin=${homeAirport}&destination=${destIata}&departDate=${departDate}&returnDate=${returnDate}${cacheParam}`
		);
		if (!res.ok) return null;
		const data: FlightApiResponse = await res.json();
		if (data.flights.length === 0) return NO_INVENTORY;
		return {
			flight: data.flights[0],
			fetchedAt: data.fetchedAt,
			fallbackUrl: data.fallbackUrl ?? null,
			daysBefore
		};
	} catch {
		return null;
	}
}

const INITIAL_AIRPORT_COUNT = 5;
const MAX_AIRPORT_COUNT = 20;
const MIN_DAYS_BEFORE = 1;
const MAX_DAYS_BEFORE = 7;

interface DayResult {
	daysBefore: number;
	primary: AirportFlight;
	cheaperAlt: AirportFlight | null;
	nearestAirportIata?: string;
}

/**
 * Run the chunked airport-fan-out for a single departure date. Mirrors the
 * original single-day search semantics: picks the nearest airport that has
 * availability as the primary, and surfaces a cheaper-but-farther option if
 * one exists within the same successful chunk.
 */
async function searchSingleDay(
	allNearby: ReturnType<typeof findNearestAirports>,
	homeAirport: string,
	departDate: string,
	returnDate: string,
	daysBefore: number,
	skipCache: boolean,
	// Destinations the caller has proven empty on prior day searches within this
	// comp. We skip them before even issuing a request. Populated by this call
	// too — every destination that returns NO_INVENTORY is added so later day
	// iterations don't re-scrape it.
	noInventory?: Set<string>
): Promise<{ dayResult: DayResult | null; fallbackUrl: string | null }> {
	let searched = 0;
	const rawResults: AirportFlight[] = [];
	let fallbackUrl: string | null = null;
	let chunksSinceFirstHit = 0;

	while (searched < allNearby.length) {
		const chunk = allNearby
			.slice(searched, searched + INITIAL_AIRPORT_COUNT)
			.filter((a) => !noInventory?.has(a.airport.iata));
		searched += INITIAL_AIRPORT_COUNT;
		if (chunk.length === 0) continue;

		const results = await Promise.all(
			chunk.map((a) =>
				fetchFlightForAirport(
					homeAirport,
					a.airport.iata,
					departDate,
					returnDate,
					skipCache,
					daysBefore
				)
			)
		);
		for (let i = 0; i < results.length; i++) {
			const r = results[i];
			if (r === NO_INVENTORY) {
				noInventory?.add(chunk[i].airport.iata);
			} else if (r) {
				rawResults.push(r);
				if (!fallbackUrl) fallbackUrl = r.fallbackUrl;
			}
		}

		if (rawResults.length > 0) chunksSinceFirstHit++;

		// Stop conditions:
		//   - 2+ distinct destinations in hand → enough material for primary +
		//     cheaperAlt selection; more chunks would be pure latency.
		//   - We've probed one extra chunk past the first hit → bail out even if
		//     we still only have one destination (e.g. only one hub exists within
		//     range). Probing one extra chunk is the key fix for cases like Cape
		//     May where the nearest commercial airport is small and overpriced
		//     (SBY) but a real hub (PHL) sits one chunk away.
		const distinctDestinations = new Set(rawResults.map((r) => r.flight.destination)).size;
		if (distinctDestinations >= 2) break;
		if (chunksSinceFirstHit >= 2) break;
	}

	if (rawResults.length === 0) {
		return { dayResult: null, fallbackUrl };
	}

	const primary = rawResults[0];

	let cheaperAlt: AirportFlight | null = null;
	const cheaperFarther = rawResults
		.slice(1)
		.filter(
			(r) =>
				r.flight.price < primary.flight.price && r.flight.destination !== primary.flight.destination
		)
		.sort((a, b) => a.flight.price - b.flight.price)[0];
	if (cheaperFarther) {
		cheaperAlt = cheaperFarther;
	}

	const nearestIata = allNearby[0]?.airport.iata;
	const nearestAirportIata =
		nearestIata && nearestIata !== primary.flight.destination ? nearestIata : undefined;

	return {
		dayResult: { daysBefore, primary, cheaperAlt, nearestAirportIata },
		fallbackUrl
	};
}

interface OriginDayResult extends DayResult {
	origin: string;
}

export async function searchFlightsForComp(
	comp: EnrichedCompetition,
	homeAirports: string[],
	maxDaysBeforeComp = MIN_DAYS_BEFORE,
	skipCache = false,
	onDayProgress?: (daysCompleted: number, totalDays: number) => void
): Promise<CompFlightData> {
	if (homeAirports.length === 0) {
		return { primary: null, cheaperAlt: null, fallbackUrl: null };
	}

	const userMax = Math.max(
		MIN_DAYS_BEFORE,
		Math.min(MAX_DAYS_BEFORE, Math.floor(maxDaysBeforeComp))
	);
	const returnDate = shiftDate(comp.end_date, 1);

	// Per-origin config. Each origin gets its own allNearby (excluding itself so
	// we don't search DEN→DEN) and its own noInventory set (a route proven empty
	// from JFK is NOT empty from EWR). noInventory is skipped when skipCache=true
	// so the per-card refresh path always re-probes every destination.
	const originConfigs = homeAirports.map((origin) => ({
		origin,
		allNearby: findNearestAirports(
			comp.latitude_degrees,
			comp.longitude_degrees,
			MAX_AIRPORT_COUNT
		).filter((a) => a.airport.iata !== origin),
		noInventory: skipCache ? undefined : new Set<string>()
	}));

	const allResults: OriginDayResult[] = [];
	let globalFallbackUrl: string | null = null;
	const recordFallback = (url: string | null) => {
		if (!globalFallbackUrl && url) globalFallbackUrl = url;
	};

	// The slider has two modes.
	// userMax === 1 → "default with safety net": prefer a day-before flight when one
	// arrives in time (even if an earlier departure would be cheaper), but widen
	// beyond 1 day up to the hard ceiling if day-1 would land during the comp.
	// userMax >= 2 → "find the cheapest in my window": search every day 1..userMax
	// and pick the cheapest in-time flight. Do not widen beyond userMax.
	//
	// Loop structure: day-outer, origin-inner — both sequential. Each day iterates
	// origins one at a time, and each origin's searchSingleDay already fans out to
	// 5 airports in parallel. Parallelising origins or days on top of that would
	// burst `origins * days * 5` concurrent requests per comp into the queue and
	// cascade 429s at weekend scale (the same hang bug we fixed for days alone).
	const maxDay = userMax === MIN_DAYS_BEFORE ? MAX_DAYS_BEFORE : userMax;
	// onDayProgress is only meaningful in mode B: mode A early-exits as soon as the
	// first in-time day is found, so its progress ceiling isn't known up front.
	const emitProgress = onDayProgress && userMax >= 2;
	for (let daysBefore = MIN_DAYS_BEFORE; daysBefore <= maxDay; daysBefore++) {
		const thisDayResults: OriginDayResult[] = [];
		for (const cfg of originConfigs) {
			const { dayResult, fallbackUrl } = await searchSingleDay(
				cfg.allNearby,
				cfg.origin,
				shiftDate(comp.start_date, -daysBefore),
				returnDate,
				daysBefore,
				skipCache,
				cfg.noInventory
			);
			recordFallback(fallbackUrl);
			if (dayResult) thisDayResults.push({ ...dayResult, origin: cfg.origin });
		}
		allResults.push(...thisDayResults);

		if (userMax === MIN_DAYS_BEFORE) {
			// Mode A: stop as soon as any origin has an in-time flight on this day.
			const anyInTime = thisDayResults.some(
				(r) => !isFlightLate(r.primary.flight, comp, r.daysBefore)
			);
			if (anyInTime) break;
			// Mode A day-1 guard: if no origin produced a result on day-1 (server
			// error, empty scrape, failure cache), do NOT widen — otherwise a stale
			// day-2 success cache would pop up as "LEAVES 2 DAYS BEFORE" even though
			// the user has the slider at 1.
			if (daysBefore === MIN_DAYS_BEFORE && thisDayResults.length === 0) break;
		}

		if (emitProgress) onDayProgress(daysBefore, userMax);
	}

	if (allResults.length === 0) {
		return { primary: null, cheaperAlt: null, fallbackUrl: globalFallbackUrl };
	}

	// Primary selection: cheapest in-time across all (day × origin) results. If
	// none arrive in time, fall back to cheapest late (partial attendance). Mode A
	// breaks on the first day with in-time results, so the in-time pool is all
	// from the same daysBefore — picking cheapest among them honors mode A's
	// "prefer the latest departure that arrives in time" rule too.
	const inTime = allResults.filter((r) => !isFlightLate(r.primary.flight, comp, r.daysBefore));
	const byPrimaryPrice = (a: OriginDayResult, b: OriginDayResult) =>
		a.primary.flight.price - b.primary.flight.price;
	const pool = inTime.length > 0 ? inTime : allResults;
	const chosen = [...pool].sort(byPrimaryPrice)[0];

	// cheaperAlt selection: flatten every other (origin, destination) combination
	// we have data for — other origins' primaries, and each day's within-chunk
	// cheaperAlt — and pick the cheapest that's cheaper than primary AND differs
	// by either origin or destination. This is the key multi-origin surfacing:
	// "$280 via EWR" appears alongside "$410 via JFK" even though both are NYC.
	const primaryOrigin = chosen.primary.flight.origin;
	const primaryDest = chosen.primary.flight.destination;
	const altCandidates: AirportFlight[] = [];
	for (const r of allResults) {
		altCandidates.push(r.primary);
		if (r.cheaperAlt) altCandidates.push(r.cheaperAlt);
	}
	const cheaperAlt =
		altCandidates
			.filter(
				(f) =>
					f !== chosen.primary &&
					(f.flight.origin !== primaryOrigin || f.flight.destination !== primaryDest) &&
					f.flight.price < chosen.primary.flight.price
			)
			.sort((a, b) => a.flight.price - b.flight.price)[0] ?? null;

	return {
		primary: chosen.primary,
		cheaperAlt,
		fallbackUrl: chosen.primary.fallbackUrl ?? globalFallbackUrl,
		nearestAirportIata: chosen.nearestAirportIata
	};
}

export async function fetchFlightsForCompetitions(
	comps: EnrichedCompetition[],
	homeAirports: string[],
	distances: Map<string, number>,
	radius: number,
	onUpdate: (flights: Map<string, CompFlightData>) => void,
	maxDaysBeforeComp = MIN_DAYS_BEFORE,
	onDayProgress?: (compId: string, daysCompleted: number, totalDays: number) => void,
	skipClosed = false
): Promise<Map<string, CompFlightData>> {
	const nonDriveable = comps.filter((c) => {
		const dist = distances.get(c.id);
		return dist === undefined || dist > radius;
	});

	// Split by registration status:
	//   - priority: non-closed OR status-unknown (wcif null). These are comps the
	//     user might actually register for — their flight prices are actionable.
	//   - deferred: closed. Prices are decorative; fetch them only after priority
	//     finishes so the queue isn't split between relevant and irrelevant work.
	// When skipClosed is on, deferred is dropped entirely.
	const isClosed = (c: EnrichedCompetition) => c.wcif?.registrationStatus === 'closed';
	const priority = nonDriveable.filter((c) => !isClosed(c));
	const deferred = skipClosed ? [] : nonDriveable.filter(isClosed);

	const newFlights = new Map<string, CompFlightData>();

	const runPhase = async (bucket: EnrichedCompetition[]) => {
		await Promise.allSettled(
			bucket.map(async (comp) => {
				const result = await searchFlightsForComp(
					comp,
					homeAirports,
					maxDaysBeforeComp,
					false,
					onDayProgress ? (done, total) => onDayProgress(comp.id, done, total) : undefined
				);
				newFlights.set(comp.id, result);
				onUpdate(new Map(newFlights));
			})
		);
	};

	await runPhase(priority);
	await runPhase(deferred);

	return newFlights;
}
