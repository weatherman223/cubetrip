import type { FlightProvider, FlightSearchResult } from './types';
import { encodeFlightSearch } from './protobuf-encoder';
import { fetchFlightPage } from './http-client';
import { parseFlightResponse } from './response-parser';
import { flightQueue, QueueFullError } from './request-queue';
import { logger } from '$lib/server/logger';

export class GoogleFlightsProtobufProvider implements FlightProvider {
	async searchFlights(
		origin: string,
		destination: string,
		departDate: string,
		returnDate: string
	): Promise<FlightSearchResult> {
		try {
			const tfs = encodeFlightSearch(origin, destination, departDate, returnDate);

			// Only the HTTP fetch goes through the queue — encoding and parsing are instant
			const html = await flightQueue.enqueue(() => fetchFlightPage(tfs));
			const flights = parseFlightResponse(html);

			flights.sort((a, b) => a.price - b.price);

			return {
				flights,
				fetchedAt: new Date().toISOString()
			};
		} catch (err) {
			// Re-throw queue errors so the route handler can return 429
			if (err instanceof QueueFullError) throw err;
			logger.error({ err, origin, destination }, 'flight search failed');
			return {
				flights: [],
				fetchedAt: new Date().toISOString()
			};
		}
	}
}
