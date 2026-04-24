import { describe, it, expect } from 'vitest';
import protobuf from 'protobufjs/light';
import { encodeFlightSearch, buildFlightsUrl } from './protobuf-encoder';

const { Type, Field, Enum, Root } = protobuf;

// Rebuild the same protobuf schema so we can decode and verify encoded output
const root = new Root();

const Airport = new Type('Airport');
Airport.add(new Field('airport', 2, 'string'));
root.add(Airport);

const Seat = new Enum('Seat');
Seat.add('UNKNOWN_SEAT', 0);
Seat.add('ECONOMY', 1);
Seat.add('PREMIUM_ECONOMY', 2);
Seat.add('BUSINESS', 3);
Seat.add('FIRST', 4);
root.add(Seat);

const Trip = new Enum('Trip');
Trip.add('UNKNOWN_TRIP', 0);
Trip.add('ROUND_TRIP', 1);
Trip.add('ONE_WAY', 2);
root.add(Trip);

const Passenger = new Enum('Passenger');
Passenger.add('UNKNOWN_PASSENGER', 0);
Passenger.add('ADULT', 1);
Passenger.add('CHILD', 2);
Passenger.add('INFANT_IN_SEAT', 3);
Passenger.add('INFANT_ON_LAP', 4);
root.add(Passenger);

const FlightData = new Type('FlightData');
FlightData.add(new Field('date', 2, 'string'));
FlightData.add(new Field('maxStops', 5, 'int32', 'optional'));
FlightData.add(new Field('airlines', 6, 'string', 'repeated'));
FlightData.add(new Field('fromAirport', 13, 'Airport'));
FlightData.add(new Field('toAirport', 14, 'Airport'));
root.add(FlightData);

const Info = new Type('Info');
Info.add(new Field('data', 3, 'FlightData', 'repeated'));
Info.add(new Field('passengers', 8, 'Passenger', 'repeated'));
Info.add(new Field('seat', 9, 'Seat'));
Info.add(new Field('trip', 19, 'Trip'));
root.add(Info);

function decode(base64: string) {
	const buffer = Buffer.from(base64, 'base64');
	return Info.decode(buffer) as unknown as {
		data: Array<{
			date: string;
			fromAirport: { airport: string };
			toAirport: { airport: string };
		}>;
		passengers: number[];
		seat: number;
		trip: number;
	};
}

describe('encodeFlightSearch', () => {
	it('one-way encodes as ONE_WAY with single leg', () => {
		const result = encodeFlightSearch('DEN', 'LAX', '2025-08-01');
		const decoded = decode(result);
		expect(decoded.trip).toBe(2); // ONE_WAY = 2
		expect(decoded.data).toHaveLength(1);
	});

	it('round-trip encodes as ROUND_TRIP with two legs', () => {
		const result = encodeFlightSearch('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const decoded = decode(result);
		expect(decoded.trip).toBe(1); // ROUND_TRIP = 1
		expect(decoded.data).toHaveLength(2);
	});

	it('return leg has origin/destination swapped', () => {
		const result = encodeFlightSearch('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const decoded = decode(result);
		const outbound = decoded.data[0];
		const returnLeg = decoded.data[1];
		expect(outbound.fromAirport.airport).toBe('DEN');
		expect(outbound.toAirport.airport).toBe('LAX');
		expect(returnLeg.fromAirport.airport).toBe('LAX');
		expect(returnLeg.toAirport.airport).toBe('DEN');
	});

	it('always includes exactly one ADULT passenger', () => {
		const result = encodeFlightSearch('JFK', 'SFO', '2025-09-15');
		const decoded = decode(result);
		expect(decoded.passengers).toEqual([1]); // ADULT = 1
	});

	it('always uses ECONOMY seat class', () => {
		const result = encodeFlightSearch('ORD', 'MIA', '2025-10-10', '2025-10-14');
		const decoded = decode(result);
		expect(decoded.seat).toBe(1); // ECONOMY = 1
	});

	it('departure date in first leg date field', () => {
		const result = encodeFlightSearch('DEN', 'LAX', '2025-08-01', '2025-08-05');
		const decoded = decode(result);
		expect(decoded.data[0].date).toBe('2025-08-01');
		expect(decoded.data[1].date).toBe('2025-08-05');
	});

	it('output is valid base64', () => {
		const result = encodeFlightSearch('DEN', 'LAX', '2025-08-01');
		expect(() => Buffer.from(result, 'base64')).not.toThrow();
		// Verify it roundtrips: encode to base64 then back gives same bytes
		const bytes = Buffer.from(result, 'base64');
		expect(bytes.toString('base64')).toBe(result);
	});
});

describe('buildFlightsUrl', () => {
	it('produces correct Google URL', () => {
		const url = buildFlightsUrl('abc123');
		expect(url).toBe('https://www.google.com/travel/flights/search?tfs=abc123&hl=en&curr=USD');
	});

	it('URI-encodes tfs param', () => {
		const tfs = 'a+b/c=d';
		const url = buildFlightsUrl(tfs);
		expect(url).toContain(`tfs=${encodeURIComponent(tfs)}`);
		expect(url).not.toContain('tfs=a+b/c=d');
	});

	it('defaults to USD', () => {
		const url = buildFlightsUrl('test');
		expect(url).toContain('curr=USD');
	});

	it('accepts custom currency', () => {
		const url = buildFlightsUrl('test', 'EUR');
		expect(url).toContain('curr=EUR');
		expect(url).not.toContain('curr=USD');
	});
});
