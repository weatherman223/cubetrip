import type { FlightResult } from '$lib/server/flights/types';

export interface AirportFlight {
	flight: FlightResult;
	fetchedAt: string;
	fallbackUrl: string | null;
}

export interface CompFlightData {
	/** The cheapest flight across all nearby airports — always shown as primary */
	primary: AirportFlight | null;
	/** A farther airport with a cheaper flight (savings option) */
	cheaperAlt: AirportFlight | null;
	fallbackUrl: string | null;
}
