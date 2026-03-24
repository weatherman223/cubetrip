import type { FlightProvider, FlightResult, FlightSearchResult } from './types';

const AIRLINES = [
	'United Airlines',
	'Delta Air Lines',
	'American Airlines',
	'Southwest Airlines',
	'JetBlue Airways'
];

const MOCK_FLIGHTS: Array<{
	priceBase: number;
	airlineIndex: number;
	departHour: number;
	durationMin: number;
	stops: number;
}> = [
	{ priceBase: 187, airlineIndex: 0, departHour: 6, durationMin: 195, stops: 0 },
	{ priceBase: 243, airlineIndex: 1, departHour: 9, durationMin: 310, stops: 1 },
	{ priceBase: 159, airlineIndex: 3, departHour: 12, durationMin: 180, stops: 0 },
	{ priceBase: 412, airlineIndex: 2, departHour: 15, durationMin: 255, stops: 0 },
	{ priceBase: 534, airlineIndex: 4, departHour: 18, durationMin: 385, stops: 1 }
];

/** Simple deterministic hash from a string to vary prices per route. */
function simpleHash(s: string): number {
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		hash = (hash * 31 + s.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export class MockProvider implements FlightProvider {
	async searchFlights(
		origin: string,
		destination: string,
		departDate: string,
		_returnDate: string
	): Promise<FlightSearchResult> {
		const seed = simpleHash(`${origin}:${destination}:${departDate}`);

		const flights: FlightResult[] = MOCK_FLIGHTS.map((template, i) => {
			// Vary price deterministically per route
			const priceOffset = ((seed + i * 37) % 120) - 60;
			const price = Math.max(99, template.priceBase + priceOffset);

			const departureDate = new Date(
				`${departDate}T${String(template.departHour).padStart(2, '0')}:00:00`
			);
			const arrivalDate = new Date(departureDate.getTime() + template.durationMin * 60 * 1000);

			return {
				price,
				currency: 'USD',
				airline: AIRLINES[template.airlineIndex],
				departureTime: departureDate.toISOString(),
				arrivalTime: arrivalDate.toISOString(),
				duration: template.durationMin,
				stops: template.stops,
				origin,
				destination
			};
		});

		// Sort by price ascending
		flights.sort((a, b) => a.price - b.price);

		return {
			flights,
			fetchedAt: new Date().toISOString()
		};
	}
}
