import type { FlightProvider, FlightSearchResult } from './types';
import { encodeFlightSearch } from './protobuf-encoder';
import { fetchFlightPage } from './http-client';
import { parseFlightResponse } from './response-parser';
import { flightQueue } from './request-queue';

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
			console.error(`Flight search failed for ${origin}→${destination}:`, err);
			return {
				flights: [],
				fetchedAt: new Date().toISOString()
			};
		}
	}
}
