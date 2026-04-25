import type { FlightResult } from '$lib/server/flights/types';

export interface Airport {
	iata: string;
	name: string;
	latitude: number;
	longitude: number;
	city: string;
	country: string;
}

export interface AirportFlight {
	flight: FlightResult;
	fetchedAt: string;
	fallbackUrl: string | null;
	/** Days before the competition start date that the outbound flight departs (1 = day before, 2 = two days before, ...). */
	daysBefore: number;
}

export interface CompFlightData {
	/** Flight from the nearest airport to the competition with availability */
	primary: AirportFlight | null;
	/** A different (typically farther) destination airport with a cheaper flight */
	cheaperAlt: AirportFlight | null;
	/** Same destination as primary but cheaper from a secondary home airport */
	cheaperFromAlt: AirportFlight | null;
	fallbackUrl: string | null;
	/** Nearest airport IATA when primary flight uses a farther fallback airport */
	nearestAirportIata?: string;
}
