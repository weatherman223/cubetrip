import { describe, it, expect } from 'vitest';
import { MockProvider } from './mock-provider';

describe('MockProvider', () => {
	const provider = new MockProvider();

	it('returns exactly 5 flights', async () => {
		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		expect(result.flights).toHaveLength(5);
	});

	it('sorted by price ascending', async () => {
		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const prices = result.flights.map((f) => f.price);
		for (let i = 1; i < prices.length; i++) {
			expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
		}
	});

	it('all prices >= 99', async () => {
		const result = await provider.searchFlights('JFK', 'SFO', '2025-09-15', '2025-09-20');
		for (const flight of result.flights) {
			expect(flight.price).toBeGreaterThanOrEqual(99);
		}
	});

	it('deterministic: same inputs produce same outputs', async () => {
		const result1 = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const result2 = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const prices1 = result1.flights.map((f) => f.price);
		const prices2 = result2.flights.map((f) => f.price);
		expect(prices1).toEqual(prices2);
	});

	it('different routes produce different prices', async () => {
		const result1 = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const result2 = await provider.searchFlights('JFK', 'SFO', '2025-08-01', '2025-08-05');
		const prices1 = result1.flights.map((f) => f.price);
		const prices2 = result2.flights.map((f) => f.price);
		expect(prices1).not.toEqual(prices2);
	});

	it('origin/destination match inputs', async () => {
		const result = await provider.searchFlights('ORD', 'MIA', '2025-10-10', '2025-10-14');
		for (const flight of result.flights) {
			expect(flight.origin).toBe('ORD');
			expect(flight.destination).toBe('MIA');
		}
	});

	it('valid ISO datetimes for departure/arrival', async () => {
		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
		for (const flight of result.flights) {
			expect(flight.departureTime).toMatch(isoRegex);
			expect(flight.arrivalTime).toMatch(isoRegex);
			expect(Date.parse(flight.departureTime)).not.toBeNaN();
			expect(Date.parse(flight.arrivalTime)).not.toBeNaN();
		}
	});

	it('currency always USD', async () => {
		const result = await provider.searchFlights('DEN', 'LAX', '2025-08-01', '2025-08-05');
		for (const flight of result.flights) {
			expect(flight.currency).toBe('USD');
		}
	});
});
