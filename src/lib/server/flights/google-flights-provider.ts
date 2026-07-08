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
			// All errors propagate: the route maps QueueFullError to 429 and
			// everything else (fetch failure, timeout, FlightParseError) to the
			// transient failKey + 503 path. Swallowing errors into {flights: []}
			// here would make a failed scrape indistinguishable from a genuinely
			// empty route and cache it as sticky no-inventory.
			if (!(err instanceof QueueFullError)) {
				logger.error({ err, origin, destination }, 'flight search failed');
			}
			throw err;
		}
	}
}
