export interface FlightResult {
	price: number;
	currency: string;
	airline: string;
	departureTime: string;
	arrivalTime: string;
	duration: number;
	stops: number;
	origin: string;
	destination: string;
}

export interface FlightSearchResult {
	flights: FlightResult[];
	fetchedAt: string;
}

export interface FlightProvider {
	searchFlights(
		origin: string,
		destination: string,
		departDate: string,
		returnDate: string
	): Promise<FlightSearchResult>;
}
