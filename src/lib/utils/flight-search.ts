import type { EnrichedCompetition } from '$lib/server/wca/types';
import type { FlightSearchResult } from '$lib/server/flights/types';
import type { AirportFlight, CompFlightData } from '$lib/types';
import { findNearestAirports } from './airport-lookup';

interface FlightApiResponse extends FlightSearchResult {
	fallbackUrl?: string;
}

function shiftDate(dateStr: string, days: number): string {
	const d = new Date(dateStr + 'T00:00:00');
	d.setDate(d.getDate() + days);
	return d.toISOString().split('T')[0];
}

export async function fetchFlightForAirport(
	homeAirport: string,
	destIata: string,
	departDate: string,
	returnDate: string,
	nocache = false
): Promise<AirportFlight | null> {
	try {
		const cacheParam = nocache ? '&nocache=1' : '';
		const res = await fetch(
			`/api/flights?origin=${homeAirport}&destination=${destIata}&departDate=${departDate}&returnDate=${returnDate}${cacheParam}`
		);
		if (!res.ok) return null;
		const data: FlightApiResponse = await res.json();
		if (data.flights.length === 0) return null;
		return {
			flight: data.flights[0],
			fetchedAt: data.fetchedAt,
			fallbackUrl: data.fallbackUrl ?? null
		};
	} catch {
		return null;
	}
}

const INITIAL_AIRPORT_COUNT = 5;
const MAX_AIRPORT_COUNT = 20;

export async function searchFlightsForComp(
	comp: EnrichedCompetition,
	homeAirport: string,
	nocache = false
): Promise<CompFlightData> {
	const dayBefore = shiftDate(comp.start_date, -1);
	const dayAfter = shiftDate(comp.end_date, 1);
	const allNearby = findNearestAirports(
		comp.latitude_degrees,
		comp.longitude_degrees,
		MAX_AIRPORT_COUNT
	).filter((a) => a.airport.iata !== homeAirport);

	let searched = 0;
	const allResults: NonNullable<Awaited<ReturnType<typeof fetchFlightForAirport>>>[] = [];
	let fallbackUrl: string | null = null;

	while (searched < allNearby.length && allResults.length === 0) {
		const chunk = allNearby.slice(searched, searched + INITIAL_AIRPORT_COUNT);
		const results = await Promise.all(
			chunk.map((a) =>
				fetchFlightForAirport(homeAirport, a.airport.iata, dayBefore, dayAfter, nocache)
			)
		);
		for (const r of results) {
			if (r) {
				allResults.push(r);
				if (!fallbackUrl) fallbackUrl = r.fallbackUrl;
			}
		}
		searched += INITIAL_AIRPORT_COUNT;
	}

	if (allResults.length === 0) {
		return { primary: null, cheaperAlt: null, fallbackUrl };
	}

	const primary: AirportFlight = {
		flight: allResults[0].flight,
		fetchedAt: allResults[0].fetchedAt,
		fallbackUrl: allResults[0].fallbackUrl
	};

	let cheaperAlt: AirportFlight | null = null;
	const cheaperFarther = allResults
		.slice(1)
		.filter(
			(r) =>
				r.flight.price < allResults[0].flight.price &&
				r.flight.destination !== allResults[0].flight.destination
		)
		.sort((a, b) => a.flight.price - b.flight.price)[0];
	if (cheaperFarther) {
		cheaperAlt = {
			flight: cheaperFarther.flight,
			fetchedAt: cheaperFarther.fetchedAt,
			fallbackUrl: cheaperFarther.fallbackUrl
		};
	}

	return { primary, cheaperAlt, fallbackUrl };
}

export async function fetchFlightsForCompetitions(
	comps: EnrichedCompetition[],
	homeAirport: string,
	distances: Map<string, number>,
	radius: number,
	onUpdate: (flights: Map<string, CompFlightData>) => void
): Promise<Map<string, CompFlightData>> {
	const nonDriveable = comps.filter((c) => {
		const dist = distances.get(c.id);
		return dist === undefined || dist > radius;
	});

	const newFlights = new Map<string, CompFlightData>();
	const BATCH_SIZE = 3;

	for (let i = 0; i < nonDriveable.length; i += BATCH_SIZE) {
		const batch = nonDriveable.slice(i, i + BATCH_SIZE);
		await Promise.allSettled(
			batch.map(async (comp) => {
				const result = await searchFlightsForComp(comp, homeAirport);
				newFlights.set(comp.id, result);
			})
		);
		onUpdate(new Map(newFlights));
	}

	return newFlights;
}
