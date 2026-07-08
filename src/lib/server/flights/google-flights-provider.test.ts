import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./protobuf-encoder', () => ({
	encodeFlightSearch: vi.fn(() => 'mock-tfs')
}));

vi.mock('./http-client', () => ({
	fetchFlightPage: vi.fn(() => Promise.resolve('<html>mock</html>'))
}));

vi.mock('./response-parser', () => ({
	parseFlightResponse: vi.fn(() => [])
}));

vi.mock('./request-queue', () => {
	class QueueFullError extends Error {
		constructor() {
			super('queue full');
			this.name = 'QueueFullError';
		}
	}
	return {
		QueueFullError,
		flightQueue: {
			enqueue: vi.fn((fn: () => Promise<unknown>) => fn())
		}
	};
});

import { GoogleFlightsProtobufProvider } from './google-flights-provider';
import { parseFlightResponse } from './response-parser';
import { fetchFlightPage } from './http-client';
import { QueueFullError, flightQueue } from './request-queue';

describe('GoogleFlightsProtobufProvider', () => {
	let provider: GoogleFlightsProtobufProvider;

	beforeEach(() => {
		vi.mocked(parseFlightResponse).mockReturnValue([]);
		vi.mocked(fetchFlightPage).mockResolvedValue('<html>mock</html>');
		vi.mocked(flightQueue.enqueue).mockImplementation(
			(fn: () => Promise<unknown>) => fn() as Promise<never>
		);
		provider = new GoogleFlightsProtobufProvider();
	});

	it('happy path: returns flights from parsed response', async () => {
		vi.mocked(parseFlightResponse).mockReturnValue([
			{
				price: 150,
				currency: 'USD',
				airline: 'United',
				departureTime: '2025-08-01T06:00:00',
				arrivalTime: '2025-08-01T09:15:00',
				duration: 195,
				stops: 0,
				origin: 'DEN',
				destination: 'LAX'
			}
		]);

		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(result.flights).toHaveLength(1);
		expect(result.flights[0].price).toBe(150);
		expect(result.fetchedAt).toBeTruthy();
	});

	it('flights sorted by price ascending', async () => {
		vi.mocked(parseFlightResponse).mockReturnValue([
			{
				price: 300,
				currency: 'USD',
				airline: 'Delta',
				departureTime: '2025-08-01T09:00:00',
				arrivalTime: '2025-08-01T14:10:00',
				duration: 310,
				stops: 1,
				origin: 'DEN',
				destination: 'LAX'
			},
			{
				price: 100,
				currency: 'USD',
				airline: 'Southwest',
				departureTime: '2025-08-01T12:00:00',
				arrivalTime: '2025-08-01T15:00:00',
				duration: 180,
				stops: 0,
				origin: 'DEN',
				destination: 'LAX'
			},
			{
				price: 200,
				currency: 'USD',
				airline: 'United',
				departureTime: '2025-08-01T06:00:00',
				arrivalTime: '2025-08-01T09:15:00',
				duration: 195,
				stops: 0,
				origin: 'DEN',
				destination: 'LAX'
			}
		]);

		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(result.flights.map((f) => f.price)).toEqual([100, 200, 300]);
	});

	it('QueueFullError is re-thrown', async () => {
		vi.mocked(flightQueue.enqueue).mockRejectedValue(new QueueFullError());

		await expect(provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05')).rejects.toThrow(
			'queue full'
		);
	});

	// Scrape failures must PROPAGATE, not resolve as {flights: []} — the route
	// distinguishes "scrape failed" (failKey + 503, transient) from "scraped
	// fine, zero flights" (emptyKey + 200, sticky no-inventory) by whether
	// searchFlights throws. Swallowing errors here caches bot-blocks and parse
	// breakage as authoritative empty routes.
	it('parse error (FlightParseError) is re-thrown', async () => {
		vi.mocked(parseFlightResponse).mockImplementation(() => {
			throw new Error('parse failed');
		});

		await expect(provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05')).rejects.toThrow(
			'parse failed'
		);
	});

	it('fetch error (403 bot-block, timeout, network) is re-thrown', async () => {
		vi.mocked(fetchFlightPage).mockRejectedValue(
			new Error('Google Flights returned 403 Forbidden')
		);

		await expect(provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05')).rejects.toThrow(
			'403'
		);
	});

	it('fetchedAt is set on the success path', async () => {
		vi.mocked(parseFlightResponse).mockReturnValue([]);
		const successResult = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(successResult.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});
});
