import protobuf from 'protobufjs/light';

const { Type, Field, Enum, Root } = protobuf;

// Build the protobuf schema programmatically to match fast-flights flights.proto.
// Field numbers are reverse-engineered from Google's internal binary wire format.
// Source: fast-flights Python project (github.com/AWeirdDev/flights).
// Do NOT renumber fields — changing them silently breaks flight search.
const root = new Root();

// Airport message
const Airport = new Type('Airport');
Airport.add(new Field('airport', 2, 'string'));
root.add(Airport);

// Seat enum
const Seat = new Enum('Seat');
Seat.add('UNKNOWN_SEAT', 0);
Seat.add('ECONOMY', 1);
Seat.add('PREMIUM_ECONOMY', 2);
Seat.add('BUSINESS', 3);
Seat.add('FIRST', 4);
root.add(Seat);

// Trip enum
const Trip = new Enum('Trip');
Trip.add('UNKNOWN_TRIP', 0);
Trip.add('ROUND_TRIP', 1);
Trip.add('ONE_WAY', 2);
root.add(Trip);

// Passenger enum
const Passenger = new Enum('Passenger');
Passenger.add('UNKNOWN_PASSENGER', 0);
Passenger.add('ADULT', 1);
Passenger.add('CHILD', 2);
Passenger.add('INFANT_IN_SEAT', 3);
Passenger.add('INFANT_ON_LAP', 4);
root.add(Passenger);

// FlightData message
const FlightData = new Type('FlightData');
FlightData.add(new Field('date', 2, 'string'));
FlightData.add(new Field('maxStops', 5, 'int32', 'optional'));
FlightData.add(new Field('airlines', 6, 'string', 'repeated'));
FlightData.add(new Field('fromAirport', 13, 'Airport'));
FlightData.add(new Field('toAirport', 14, 'Airport'));
root.add(FlightData);

// Info message (top-level)
const Info = new Type('Info');
Info.add(new Field('data', 3, 'FlightData', 'repeated'));
Info.add(new Field('passengers', 8, 'Passenger', 'repeated'));
Info.add(new Field('seat', 9, 'Seat'));
Info.add(new Field('trip', 19, 'Trip'));
root.add(Info);

/**
 * Encode a flight search into a Base64 string for the Google Flights tfs URL parameter.
 * @param origin — Origin IATA code (e.g., "DEN")
 * @param destination — Destination IATA code (e.g., "LAX")
 * @param departDate — Departure date YYYY-MM-DD
 * @param returnDate — Return date YYYY-MM-DD (omit for one-way)
 */
export function encodeFlightSearch(
	origin: string,
	destination: string,
	departDate: string,
	returnDate?: string
): string {
	const flightLegs = [
		{
			date: departDate,
			fromAirport: { airport: origin },
			toAirport: { airport: destination }
		}
	];

	if (returnDate) {
		flightLegs.push({
			date: returnDate,
			fromAirport: { airport: destination },
			toAirport: { airport: origin }
		});
	}

	const message = Info.create({
		data: flightLegs,
		passengers: [Passenger.values.ADULT],
		seat: Seat.values.ECONOMY,
		trip: returnDate ? Trip.values.ROUND_TRIP : Trip.values.ONE_WAY
	});

	const buffer = Info.encode(message).finish();
	return Buffer.from(buffer).toString('base64');
}

/**
 * Build the full Google Flights search URL for a given tfs parameter.
 */
export function buildFlightsUrl(tfsParam: string, currency = 'USD'): string {
	return `https://www.google.com/travel/flights/search?tfs=${encodeURIComponent(tfsParam)}&hl=en&curr=${currency}`;
}
