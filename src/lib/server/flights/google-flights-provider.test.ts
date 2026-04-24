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

	it('parse error returns empty flights', async () => {
		vi.mocked(parseFlightResponse).mockImplementation(() => {
			throw new Error('parse failed');
		});

		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(result.flights).toEqual([]);
		expect(result.fetchedAt).toBeTruthy();
	});

	it('fetch error (non-QueueFull) returns empty flights', async () => {
		vi.mocked(fetchFlightPage).mockRejectedValue(new Error('network error'));

		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(result.flights).toEqual([]);
		expect(result.fetchedAt).toBeTruthy();
	});

	it('fetchedAt is set on both success and error paths', async () => {
		const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

		// Success path
		vi.mocked(parseFlightResponse).mockReturnValue([]);
		const successResult = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(successResult.fetchedAt).toMatch(isoDateRegex);

		// Error path (non-QueueFull error gets caught)
		vi.mocked(fetchFlightPage).mockRejectedValue(new Error('fail'));
		const errorResult = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(errorResult.fetchedAt).toMatch(isoDateRegex);
	});
});
